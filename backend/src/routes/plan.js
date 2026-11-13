
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

  const get = (type) => Number(parts.find((p) => p.type === type).value);

  const date = new Date(Date.UTC(
    get("year"),
    get("month") - 1,
    get("day")
  ));

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

  const allowedSubjects = new Set(priorities.map((p) => p.subjectId));

  const valid = data.blocks.every((b) =>
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
    return { error: "Invalid timetable returned by planner", status: 502 };
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

router.get("/", asyncHandler(async (req, res) => {
  const profile = await getProfile(req.session.userId);

  if (!profile) {
    return res.status(400).json({
      error: "Set up your study profile first",
    });
  }

  const result = await generatePlan(req.session.userId, profile);

  if (result.error) {
    return res.status(result.status || 400).json(result);
  }

  res.json(result);
}));

router.post("/save", asyncHandler(async (req, res) => {
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

    const version = Number(versionResult.rows[0].next_version);

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
}));

router.get("/current", asyncHandler(async (req, res) => {
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
}));

export default router;
