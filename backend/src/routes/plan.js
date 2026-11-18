
import { Router } from "express";
import { pool, query } from "../lib/db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { loadPriorities } from "../lib/loadPriorities.js";

const router = Router();
router.use(requireAuth);

const PLANNER_URL = process.env.PLANNER_URL || "http://127.0.0.1:8000";
const SUBJECT_WEEK_CAP_MIN = 240;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

const fromMinutes = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

function getWeekStart(timezone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    Number(parts.find((p) => p.type === type).value);

  const date = new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"))
  );

  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);

  return date.toISOString().slice(0, 10);
}

async function getProfile(userId) {
  const { rows } = await query(
    `SELECT daily_study_limit_min,
            preferred_session_min,
            timezone
     FROM learner_profiles
     WHERE user_id = $1`,
    [userId]
  );

  return rows[0];
}

async function generatePlan(userId, profile) {
  const freeResult = await query(
    `SELECT weekday, start_time, end_time
     FROM commitments
     WHERE user_id = $1 AND kind = 'free'
     ORDER BY weekday, start_time`,
    [userId]
  );

  const freeWindows = freeResult.rows.map((r) => ({
    weekday: r.weekday,
    startMin: toMinutes(r.start_time),
    endMin: toMinutes(r.end_time),
  }));

  if (!freeWindows.length) {
    return { error: "Add some free time first" };
  }

  const priorities = await loadPriorities(userId);

  if (!priorities.length) {
    return { error: "Add some subjects first" };
  }

  let response;

  try {
    response = await fetch(`${PLANNER_URL}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        freeWindows,
        subjects: priorities.map((p) => ({
          id: p.subjectId,
          name: p.name,
          score: p.score,
        })),
        dailyLimitMin: profile.daily_study_limit_min,
        subjectWeekCapMin: SUBJECT_WEEK_CAP_MIN,
        minBlockMin: profile.preferred_session_min,
      }),
    });
  } catch {
    return {
      error: "The planner is not running. Start it and try again.",
      status: 503,
    };
  }

  if (!response.ok) {
    return {
      error: "The planner could not build a timetable",
      status: 502,
    };
  }

  const data = await response.json();

  if (!Array.isArray(data.blocks)) {
    return { error: "Invalid planner response", status: 502 };
  }

  const allowedSubjects = new Set(
    priorities.map((p) => p.subjectId)
  );

  const valid = data.blocks.every(
    (b) =>
      Number.isInteger(b.weekday) &&
      b.weekday >= 0 &&
      b.weekday <= 6 &&
      Number.isInteger(b.startMin) &&
      Number.isInteger(b.endMin) &&
      b.startMin >= 0 &&
      b.endMin <= 1440 &&
      b.endMin > b.startMin &&
      allowedSubjects.has(b.subjectId)
  );

  if (!valid) {
    return {
      error: "Invalid timetable returned by planner",
      status: 502,
    };
  }

  return {
    blocks: data.blocks.map((b) => ({
      weekday: b.weekday,
      startTime: fromMinutes(b.startMin),
      endTime: fromMinutes(b.endMin),
      subjectId: b.subjectId,
      subjectName: b.subjectName,
    })),
  };
}

// GET /api/plan
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const profile = await getProfile(req.session.userId);

    if (!profile) {
      return res.status(400).json({
        error: "Set up your study profile first",
      });
    }

    const result = await generatePlan(
      req.session.userId,
      profile
    );

    if (result.error) {
      return res.status(result.status || 400).json(result);
    }

    res.json(result);
  })
);

// POST /api/plan/save
router.post(
  "/save",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const profile = await getProfile(userId);

    if (!profile) {
      return res.status(400).json({
        error: "Set up your study profile first",
      });
    }

    const result = await generatePlan(userId, profile);

    if (result.error) {
      return res.status(result.status || 400).json(result);
    }

    if (!result.blocks.length) {
      return res.status(422).json({
        error: "No study sessions could be scheduled",
      });
    }

    const weekStart = getWeekStart(profile.timezone || "UTC");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [`${userId}:${weekStart}`]
      );

      const versionResult = await client.query(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM study_plans
         WHERE user_id = $1 AND week_start = $2`,
        [userId, weekStart]
      );

      const version = Number(
        versionResult.rows[0].next_version
      );

      await client.query(
        `UPDATE study_plans
         SET status = 'archived', updated_at = NOW()
         WHERE user_id = $1
           AND week_start = $2
           AND status = 'active'`,
        [userId, weekStart]
      );

      const planResult = await client.query(
        `INSERT INTO study_plans
           (user_id, week_start, version, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING id, week_start, version, status`,
        [userId, weekStart, version]
      );

      const plan = planResult.rows[0];
      const sessions = [];

      for (const block of result.blocks) {
        const sessionResult = await client.query(
          `INSERT INTO study_sessions
             (plan_id, subject_id, weekday, start_time, end_time)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, subject_id, weekday,
                     start_time, end_time, status, actual_minutes`,
          [
            plan.id,
            block.subjectId,
            block.weekday,
            block.startTime,
            block.endTime,
          ]
        );

        sessions.push(sessionResult.rows[0]);
      }

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Study plan saved successfully",
        plan,
        sessions,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

/**
 * POST /api/plan/regenerate/approve
 *
 * Approves a previously previewed timetable.
 * Preserves recorded progress only when the matching
 * subject, weekday, and time slot remain unchanged.
 */
router.post(
  "/regenerate/approve",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const { expectedPlanId, previewBlocks } = req.body ?? {};

    if (
      typeof expectedPlanId !== "string" ||
      !Array.isArray(previewBlocks) ||
      previewBlocks.length === 0
    ) {
      return res.status(400).json({
        error: "A current plan and valid preview are required.",
      });
    }

    const profile = await getProfile(userId);

    if (!profile) {
      return res.status(400).json({
        error: "Set up your study profile first.",
      });
    }

    // Generate again using current server-side data.
    // Never blindly trust timetable blocks sent by the browser.
    const result = await generatePlan(userId, profile);

    if (result.error) {
      return res.status(result.status || 400).json(result);
    }

    const blockKey = (block) =>
      [
        String(block.subjectId),
        Number(block.weekday),
        String(block.startTime).slice(0, 5),
        String(block.endTime).slice(0, 5),
      ].join("|");

    const signature = (blocks) =>
      blocks.map(blockKey).sort().join("\n");

    if (
      signature(previewBlocks) !== signature(result.blocks)
    ) {
      return res.status(409).json({
        error:
          "Your study inputs or generated timetable have changed. Please generate a fresh preview.",
      });
    }

    const weekStart = getWeekStart(profile.timezone || "UTC");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Serialize regeneration for this user and week.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [`${userId}:${weekStart}`]
      );

      const activeResult = await client.query(
        `SELECT id, version
         FROM study_plans
         WHERE user_id = $1
           AND week_start = $2
           AND status = 'active'
         FOR UPDATE`,
        [userId, weekStart]
      );

      const active = activeResult.rows[0];

      if (!active || active.id !== expectedPlanId) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          error:
            "Your active timetable has changed. Please refresh and generate a new preview.",
        });
      }

      // Preserve the original tracking ID for matched sessions.
      const sessionsResult = await client.query(
        `SELECT id,
                subject_id AS "subjectId",
                weekday,
                TO_CHAR(start_time, 'HH24:MI') AS "startTime",
                TO_CHAR(end_time, 'HH24:MI') AS "endTime",
                status,
                actual_minutes AS "actualMinutes",
                tracking_id AS "trackingId"
         FROM study_sessions
         WHERE plan_id = $1
         FOR UPDATE`,
        [active.id]
      );

      const oldSessions = sessionsResult.rows;

      // Group existing sessions by their exact time slot.
      const oldByKey = new Map();

      for (const session of oldSessions) {
        const key = blockKey(session);

        if (!oldByKey.has(key)) {
          oldByKey.set(key, []);
        }

        oldByKey.get(key).push(session);
      }

      // Prefer retaining recorded sessions when duplicate
      // matching time slots exist.
      for (const matches of oldByKey.values()) {
        matches.sort((a, b) => {
          const aTracked = a.status !== "planned" ? 1 : 0;
          const bTracked = b.status !== "planned" ? 1 : 0;

          return bTracked - aTracked;
        });
      }

      const replacements = [];

      for (const block of result.blocks) {
        const matches = oldByKey.get(blockKey(block)) || [];
        const previous = matches.shift() || null;

        replacements.push({ block, previous });
      }

      // Don't allow recorded progress to disappear
      // from the new active timetable.
      const removedTrackedSessions = [
        ...oldByKey.values(),
      ]
        .flat()
        .filter((session) => session.status !== "planned");

      if (removedTrackedSessions.length > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          error:
            "This timetable would move or remove sessions with recorded progress. Your current plan is unchanged. Preserve those sessions or use adaptive recovery before replacing the plan.",
          protectedSessions: removedTrackedSessions.length,
        });
      }

      const versionResult = await client.query(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM study_plans
         WHERE user_id = $1 AND week_start = $2`,
        [userId, weekStart]
      );

      const nextVersion = Number(
        versionResult.rows[0].next_version
      );

      await client.query(
        `UPDATE study_plans
         SET status = 'archived',
             updated_at = NOW()
         WHERE id = $1`,
        [active.id]
      );

      const planResult = await client.query(
        `INSERT INTO study_plans
           (user_id, week_start, version, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING id, week_start, version, status`,
        [userId, weekStart, nextVersion]
      );

      const newPlan = planResult.rows[0];
      const savedSessions = [];

      for (const { block, previous } of replacements) {
        const tracked =
          previous && previous.status !== "planned";

        // Reuse tracking_id for an existing matched session.
        // A new session receives a new tracking_id.
        const sessionResult = await client.query(
          `INSERT INTO study_sessions
             (
               plan_id,
               subject_id,
               weekday,
               start_time,
               end_time,
               status,
               actual_minutes,
               tracking_id
             )
           VALUES (
               $1, $2, $3, $4, $5, $6, $7,
               COALESCE($8::uuid, gen_random_uuid())
             )
           RETURNING id,
                     subject_id AS "subjectId",
                     weekday,
                     TO_CHAR(start_time, 'HH24:MI') AS "startTime",
                     TO_CHAR(end_time, 'HH24:MI') AS "endTime",
                     status,
                     actual_minutes AS "actualMinutes"`,
          [
            newPlan.id,
            block.subjectId,
            block.weekday,
            block.startTime,
            block.endTime,
            tracked ? previous.status : "planned",
            tracked ? previous.actualMinutes : 0,
            previous?.trackingId ?? null,
          ]
        );

        savedSessions.push(sessionResult.rows[0]);
      }

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Updated timetable approved and saved.",
        plan: newPlan,
        sessions: savedSessions,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

// GET /api/plan/current
router.get(
  "/current",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const profile = await getProfile(userId);

    if (!profile) {
      return res.status(400).json({
        error: "Set up your study profile first",
      });
    }

    const weekStart = getWeekStart(profile.timezone || "UTC");

    const planResult = await query(
      `SELECT id, week_start, version, status, created_at
       FROM study_plans
       WHERE user_id = $1
         AND week_start = $2
         AND status = 'active'
       LIMIT 1`,
      [userId, weekStart]
    );

    if (!planResult.rows.length) {
      return res.status(404).json({
        error: "No saved study plan for this week",
      });
    }

    const plan = planResult.rows[0];

    const sessionsResult = await query(
      `SELECT ss.id,
              ss.subject_id AS "subjectId",
              s.name AS "subjectName",
              ss.weekday,
              TO_CHAR(ss.start_time, 'HH24:MI') AS "startTime",
              TO_CHAR(ss.end_time, 'HH24:MI') AS "endTime",
              ss.status,
              ss.actual_minutes AS "actualMinutes"
       FROM study_sessions ss
       JOIN subjects s ON s.id = ss.subject_id
       WHERE ss.plan_id = $1
         AND s.user_id = $2
       ORDER BY ss.weekday, ss.start_time`,
      [plan.id, userId]
    );

    res.json({
      plan,
      blocks: sessionsResult.rows,
    });
  })
);

// PATCH /api/plan/sessions/:id
router.patch(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const sessionId = req.params.id;
    const { status, actualMinutes } = req.body ?? {};

    const validStatuses = [
      "planned",
      "completed",
      "partial",
      "missed",
    ];

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        sessionId
      )
    ) {
      return res.status(400).json({
        error: "Invalid session ID",
      });
    }

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid session status",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT ss.id,
                ss.status,
                FLOOR(EXTRACT(EPOCH FROM
                  (ss.end_time - ss.start_time)) / 60)::int
                  AS scheduled_minutes
         FROM study_sessions ss
         JOIN study_plans sp ON sp.id = ss.plan_id
         WHERE ss.id = $1
           AND sp.user_id = $2
           AND sp.status = 'active'
         FOR UPDATE OF ss`,
        [sessionId, userId]
      );

      if (!result.rows.length) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Active study session not found",
        });
      }

      const session = result.rows[0];
      const duration = session.scheduled_minutes;

      let minutes = 0;

      if (status === "completed") {
        minutes = duration;
      }

      if (status === "partial") {
        if (
          !Number.isInteger(actualMinutes) ||
          actualMinutes <= 0 ||
          actualMinutes >= duration
        ) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            error:
              "Partial minutes must be greater than zero and less than the session duration",
          });
        }

        minutes = actualMinutes;
      }

      const updated = await client.query(
        `UPDATE study_sessions
         SET status = $1,
             actual_minutes = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING
           id,
           plan_id AS "planId",
           subject_id AS "subjectId",
           weekday,
           TO_CHAR(start_time, 'HH24:MI') AS "startTime",
           TO_CHAR(end_time, 'HH24:MI') AS "endTime",
           status,
           actual_minutes AS "actualMinutes",
           updated_at AS "updatedAt"`,
        [status, minutes, sessionId]
      );

      await client.query("COMMIT");

      return res.json({
        message: "Study session updated successfully",
        session: {
          ...updated.rows[0],
          scheduledMinutes: duration,
          remainingMinutes: duration - minutes,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

function recoverySnapshot(sessions, backlog) {
  return JSON.stringify({
    sessions: sessions
      .map((s) => [
        String(s.id),
        String(s.status),
        Number(s.actualMinutes ?? 0),
      ])
      .sort((a, b) => a[0].localeCompare(b[0])),

    backlog: backlog
      .map((b) => [
        String(b.subjectId),
        Number(b.remainingMin),
      ])
      .sort((a, b) => a[0].localeCompare(b[0])),
  });
}

function recoveryBlockSignature(blocks) {
  return blocks
    .map((b) =>
      [
        b.subjectId,
        b.weekday,
        b.startTime,
        b.endTime,
      ].join("|")
    )
    .sort()
    .join("\n");
}

function recoveryRemainingSignature(items) {
  return items
    .map((item) =>
      [
        item.subjectId,
        Number(item.requestedMin),
        Number(item.scheduledMin),
        Number(item.unscheduledMin),
      ].join("|")
    )
    .sort()
    .join("\n");
}

// Phase 3: Recovery preview and apply
const rescheduleHandler = asyncHandler(async (req, res) => {
  const applying = req.path === "/reschedule/apply";
  const userId = req.session.userId;
  const profile = await getProfile(userId);

  if (!profile) {
    return res.status(400).json({
      error: "Set up your study profile first",
    });
  }

  const timezone = profile.timezone || "UTC";
  const weekStart = getWeekStart(timezone);

  const planResult = await query(
    `SELECT id, week_start, version
     FROM study_plans
     WHERE user_id = $1
       AND week_start = $2
       AND status = 'active'
     LIMIT 1`,
    [userId, weekStart]
  );

  if (!planResult.rows.length) {
    return res.status(404).json({
      error: "Save a weekly timetable before rescheduling",
    });
  }

  const plan = planResult.rows[0];

  const sessionsResult = await query(
    `SELECT ss.id,
            ss.subject_id AS "subjectId",
            s.name AS "subjectName",
            ss.weekday,
            TO_CHAR(ss.start_time, 'HH24:MI') AS "startTime",
            TO_CHAR(ss.end_time, 'HH24:MI') AS "endTime",
            ss.status,
            ss.actual_minutes AS "actualMinutes"
     FROM study_sessions ss
     JOIN subjects s ON s.id = ss.subject_id
     WHERE ss.plan_id = $1
       AND s.user_id = $2
     ORDER BY ss.weekday, ss.start_time`,
    [plan.id, userId]
  );

  const sessions = sessionsResult.rows;

  // Calculate unfinished minutes from missed/partial sessions.
  const unfinished = new Map();

  for (const session of sessions) {
    if (!["missed", "partial"].includes(session.status)) {
      continue;
    }

    const duration =
      toMinutes(session.endTime) -
      toMinutes(session.startTime);

    const remaining = Math.max(
      0,
      duration - session.actualMinutes
    );

    if (!remaining) continue;

    const item = unfinished.get(session.subjectId) || {
      id: session.subjectId,
      name: session.subjectName,
      remainingMin: 0,
    };

    item.remainingMin += remaining;
    unfinished.set(session.subjectId, item);
  }

  // Load unfinished minutes saved from earlier recovery attempts.
  const backlogResult = await query(
    `SELECT b.subject_id AS "subjectId",
            s.name AS "subjectName",
            b.remaining_minutes AS "remainingMin"
     FROM study_plan_backlogs b
     JOIN subjects s ON s.id = b.subject_id
     WHERE b.plan_id = $1
       AND s.user_id = $2
       AND b.remaining_minutes > 0`,
    [plan.id, userId]
  );

  for (const backlog of backlogResult.rows) {
    const existing = unfinished.get(backlog.subjectId) || {
      id: backlog.subjectId,
      name: backlog.subjectName,
      remainingMin: 0,
    };

    existing.remainingMin += Number(backlog.remainingMin);
    unfinished.set(backlog.subjectId, existing);
  }

  const snapshot = recoverySnapshot(
    sessions,
    backlogResult.rows
  );

  const expected = applying ? req.body?.preview : null;

  if (applying) {
    if (
      !expected ||
      typeof expected.planId !== "string" ||
      !Number.isInteger(Number(expected.version)) ||
      typeof expected.snapshot !== "string" ||
      !Array.isArray(expected.blocks) ||
      !Array.isArray(expected.remaining)
    ) {
      return res.status(400).json({
        error: "Generate a recovery preview before applying.",
      });
    }

    if (
      expected.planId !== plan.id ||
      Number(expected.version) !== Number(plan.version) ||
      expected.snapshot !== snapshot
    ) {
      return res.status(409).json({
        error:
          "Your timetable or study progress has changed. Generate a fresh recovery preview.",
      });
    }
  }

  if (!unfinished.size) {
    return res.json({
      message: "No unfinished sessions or backlog to recover",
      previewOnly: !applying,
      blocks: [],
      remaining: [],
    });
  }

  const priorities = await loadPriorities(userId);

  const priorityMap = new Map(
    priorities.map((p) => [p.subjectId, p.score])
  );

  const subjects = [...unfinished.values()].map((s) => ({
    ...s,
    score: Math.max(
      0,
      Number(priorityMap.get(s.id) ?? 0)
    ),
  }));

  // Determine the student's current local time.
  const nowParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const part = (name) =>
    Number(nowParts.find((p) => p.type === name).value);

  const today = new Date(
    Date.UTC(
      part("year"),
      part("month") - 1,
      part("day")
    )
  );

  const currentWeekday =
    (today.getUTCDay() + 6) % 7;

  const currentMinute =
    part("hour") * 60 + part("minute");

  const nextSlot =
    Math.ceil(currentMinute / 15) * 15;

  const freeResult = await query(
    `SELECT weekday, start_time, end_time
     FROM commitments
     WHERE user_id = $1
       AND kind = 'free'
     ORDER BY weekday, start_time`,
    [userId]
  );

  // Only future free windows in the current week.
  const freeWindows = freeResult.rows
    .filter((w) => w.weekday >= currentWeekday)
    .map((w) => ({
      weekday: w.weekday,
      startMin:
        w.weekday === currentWeekday
          ? Math.max(toMinutes(w.start_time), nextSlot)
          : toMinutes(w.start_time),
      endMin: toMinutes(w.end_time),
    }))
    .filter((w) => w.endMin > w.startMin);

  // Existing sessions remain reserved.
  const blockedWindows = sessions.map((s) => ({
    weekday: s.weekday,
    startMin: toMinutes(s.startTime),
    endMin: toMinutes(s.endTime),
  }));

  if (!freeWindows.length) {
    const noSpace = {
      message: "No future free time remains this week",
      previewOnly: !applying,
      blocks: [],
      remaining: subjects.map((s) => ({
        subjectId: s.id,
        subjectName: s.name,
        requestedMin: s.remainingMin,
        scheduledMin: 0,
        unscheduledMin: s.remainingMin,
      })),
    };

    return applying
      ? res.status(422).json({
          error: noSpace.message,
          ...noSpace,
        })
      : res.json(noSpace);
  }

  let response;

  try {
    response = await fetch(`${PLANNER_URL}/reschedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        freeWindows,
        subjects,
        blockedWindows,
        dailyLimitMin: profile.daily_study_limit_min,
        minBlockMin: profile.preferred_session_min,
      }),
    });
  } catch {
    return res.status(503).json({
      error: "The Python planner is not running",
    });
  }

  if (!response.ok) {
    return res.status(502).json({
      error: "The recovery planner returned an error",
    });
  }

  const result = await response.json();

  if (
    !Array.isArray(result.blocks) ||
    !Array.isArray(result.remaining)
  ) {
    return res.status(502).json({
      error: "Invalid recovery planner response",
    });
  }

  // Validate the recovery timetable.
  const subjectIds = new Set(
    subjects.map((s) => s.id)
  );

  const requested = new Map(
    subjects.map((s) => [s.id, s.remainingMin])
  );

  const scheduled = new Map();
  const proposed = [];
  let valid = true;

  for (const b of result.blocks) {
    if (
      !(
        Number.isInteger(b.weekday) &&
        b.weekday >= 0 &&
        b.weekday <= 6 &&
        Number.isInteger(b.startMin) &&
        Number.isInteger(b.endMin) &&
        b.startMin >= 0 &&
        b.endMin <= 1440 &&
        b.endMin > b.startMin &&
        (b.endMin - b.startMin) % 15 === 0 &&
        subjectIds.has(b.subjectId)
      )
    ) {
      valid = false;
      break;
    }

    const inFreeWindow = freeWindows.some(
      (w) =>
        w.weekday === b.weekday &&
        b.startMin >= w.startMin &&
        b.endMin <= w.endMin
    );

    const overlapsExisting = blockedWindows.some(
      (w) =>
        w.weekday === b.weekday &&
        b.startMin < w.endMin &&
        b.endMin > w.startMin
    );

    const overlapsProposed = proposed.some(
      (p) =>
        p.weekday === b.weekday &&
        b.startMin < p.endMin &&
        b.endMin > p.startMin
    );

    if (
      !inFreeWindow ||
      overlapsExisting ||
      overlapsProposed
    ) {
      valid = false;
      break;
    }

    const minutes =
      (scheduled.get(b.subjectId) || 0) +
      (b.endMin - b.startMin);

    if (minutes > requested.get(b.subjectId)) {
      valid = false;
      break;
    }

    scheduled.set(b.subjectId, minutes);
    proposed.push(b);
  }

  if (!valid) {
    return res.status(502).json({
      error: "Invalid recovery timetable returned by planner",
    });
  }

  const remaining = subjects.map((s) => ({
    subjectId: s.id,
    subjectName: s.name,
    requestedMin: s.remainingMin,
    scheduledMin: scheduled.get(s.id) || 0,
    unscheduledMin:
      s.remainingMin - (scheduled.get(s.id) || 0),
  }));

  const blocks = proposed.map((b) => ({
    weekday: b.weekday,
    startTime: fromMinutes(b.startMin),
    endTime: fromMinutes(b.endMin),
    subjectId: b.subjectId,
    subjectName: subjects.find(
      (s) => s.id === b.subjectId
    ).name,
  }));

  // Read-only preview.
  if (!applying) {
    return res.json({
      message: "Recovery timetable preview generated",
      planId: plan.id,
      version: plan.version,
      snapshot,
      previewOnly: true,
      blocks,
      remaining,
    });
  }

  // Ensure the user approves the exact timetable
  // and remaining workload returned by the preview.
  if (
    recoveryBlockSignature(expected.blocks) !==
      recoveryBlockSignature(blocks) ||
    recoveryRemainingSignature(expected.remaining) !==
      recoveryRemainingSignature(remaining)
  ) {
    return res.status(409).json({
      error:
        "The proposed recovery timetable has changed. Generate a fresh preview.",
    });
  }

  const outstanding = remaining.reduce(
    (total, s) => total + s.unscheduledMin,
    0
  );

  // Save partial recovery only if at least one block fits.
  if (!blocks.length) {
    return res.status(422).json({
      error: "No recovery sessions can fit into the available time",
      unscheduledMinutes: outstanding,
      blocks,
      remaining,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`${userId}:${weekStart}`]
    );

    // Ensure the plan has not changed.
    const active = await client.query(
      `SELECT id, version
       FROM study_plans
       WHERE user_id = $1
         AND week_start = $2
         AND status = 'active'
       FOR UPDATE`,
      [userId, weekStart]
    );

    if (
      active.rows.length !== 1 ||
      active.rows[0].id !== plan.id ||
      Number(active.rows[0].version) !== Number(plan.version)
    ) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "The timetable changed. Retry rescheduling.",
      });
    }

    // Verify session progress is unchanged.
    const lockedSessions = await client.query(
      `SELECT id,
              status,
              actual_minutes AS "actualMinutes"
       FROM study_sessions
       WHERE plan_id = $1
       FOR UPDATE`,
      [plan.id]
    );

    const sessionSnapshot = new Map(
      sessions.map((s) => [s.id, s])
    );

    const unchanged =
      lockedSessions.rows.length === sessions.length &&
      lockedSessions.rows.every((s) => {
        const old = sessionSnapshot.get(s.id);

        return (
          old &&
          old.status === s.status &&
          Number(old.actualMinutes) ===
            Number(s.actualMinutes)
        );
      });

    if (!unchanged) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "Session progress changed. Retry rescheduling.",
      });
    }

    // Verify the backlog has not changed.
    const lockedBacklog = await client.query(
      `SELECT subject_id AS "subjectId",
              remaining_minutes AS "remainingMin"
       FROM study_plan_backlogs
       WHERE plan_id = $1
       FOR UPDATE`,
      [plan.id]
    );

    const backlogSnapshot = new Map(
      backlogResult.rows.map((b) => [
        b.subjectId,
        Number(b.remainingMin),
      ])
    );

    const backlogUnchanged =
      lockedBacklog.rows.length === backlogSnapshot.size &&
      lockedBacklog.rows.every(
        (b) =>
          backlogSnapshot.has(b.subjectId) &&
          Number(b.remainingMin) ===
            backlogSnapshot.get(b.subjectId)
      );

    if (!backlogUnchanged) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "Study backlog changed. Retry rescheduling.",
      });
    }

    // Compare locked database records against
    // the originally approved preview.
    if (
      recoverySnapshot(
        lockedSessions.rows,
        lockedBacklog.rows
      ) !== expected.snapshot
    ) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error:
          "Study progress changed after the preview. Generate a fresh recovery plan.",
      });
    }

    const nextVersionResult = await client.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM study_plans
       WHERE user_id = $1
         AND week_start = $2`,
      [userId, weekStart]
    );

    const nextVersion = Number(
      nextVersionResult.rows[0].next_version
    );

    // Keep the previous plan as historical data.
    await client.query(
      `UPDATE study_plans
       SET status = 'archived',
           updated_at = NOW()
       WHERE id = $1`,
      [plan.id]
    );

    const newPlanResult = await client.query(
      `INSERT INTO study_plans
         (user_id, week_start, version, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id, week_start, version, status`,
      [userId, weekStart, nextVersion]
    );

    const newPlan = newPlanResult.rows[0];

    // Carry forward existing planned/completed sessions,
    // preserving their original tracking IDs.
    await client.query(
      `INSERT INTO study_sessions
         (plan_id, subject_id, weekday,
          start_time, end_time, status, actual_minutes,
          tracking_id)
       SELECT $1, subject_id, weekday,
              start_time, end_time, status, actual_minutes,
              tracking_id
       FROM study_sessions
       WHERE plan_id = $2
         AND status IN ('planned', 'completed')`,
      [newPlan.id, plan.id]
    );

    // Save newly scheduled recovery sessions.
    // PostgreSQL assigns new tracking IDs automatically.
    for (const b of blocks) {
      await client.query(
        `INSERT INTO study_sessions
           (plan_id, subject_id, weekday,
            start_time, end_time, status, actual_minutes)
         VALUES ($1, $2, $3, $4, $5, 'planned', 0)`,
        [
          newPlan.id,
          b.subjectId,
          b.weekday,
          b.startTime,
          b.endTime,
        ]
      );
    }

    // Save unfinished minutes against the new plan.
    for (const item of remaining) {
      if (item.unscheduledMin <= 0) continue;

      await client.query(
        `INSERT INTO study_plan_backlogs
           (plan_id, subject_id, remaining_minutes)
         VALUES ($1, $2, $3)`,
        [
          newPlan.id,
          item.subjectId,
          item.unscheduledMin,
        ]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Study timetable rescheduled successfully",
      previousVersion: plan.version,
      plan: newPlan,
      recoveryBlocks: blocks,
      remaining,
      partialRecovery: outstanding > 0,
      unscheduledMinutes: outstanding,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/reschedule/preview", rescheduleHandler);
router.post("/reschedule/apply", rescheduleHandler);

export default router;
