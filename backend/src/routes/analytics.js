
import { Router } from "express";
import { query } from "../lib/db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);

function toMinutes(value) {
  if (!value) return 0;

  const [hours, minutes] = String(value)
    .slice(0, 5)
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

function sessionDuration(session) {
  return Math.max(
    0,
    toMinutes(session.endTime) -
      toMinutes(session.startTime)
  );
}

function createSummary(weekStart) {
  return {
    weekStart,
    plannedMinutes: 0,
    completedMinutes: 0,
    plannedSessions: 0,
    completedSessions: 0,
    partialSessions: 0,
    missedSessions: 0,
    adherencePercent: 0,
  };
}

function finalizeSummary(summary) {
  summary.adherencePercent =
    summary.plannedMinutes > 0
      ? Math.round(
          Math.min(
            100,
            (summary.completedMinutes /
              summary.plannedMinutes) *
              100
          )
        )
      : 0;

  return summary;
}

// GET /api/analytics/overview
router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;

    // Determine the current week in the
    // student's configured timezone.
    const weekResult = await query(
      `SELECT
         date_trunc(
           'week',
           NOW() AT TIME ZONE COALESCE(
             (
               SELECT timezone
               FROM learner_profiles
               WHERE user_id = $1
             ),
             'UTC'
           )
         )::date::text AS "weekStart"`,
      [userId]
    );

    const currentWeekStart =
      weekResult.rows[0].weekStart;

    // Read up to eight active weekly plans.
    // Archived versions are excluded to avoid
    // double-counting copied study sessions.
    const result = await query(
      `SELECT
         p.id AS "planId",
         p.week_start::text AS "weekStart",
         p.version,
         ss.id AS "sessionId",
         ss.subject_id AS "subjectId",
         s.name AS "subjectName",
         ss.weekday,
         TO_CHAR(
           ss.start_time, 'HH24:MI'
         ) AS "startTime",
         TO_CHAR(
           ss.end_time, 'HH24:MI'
         ) AS "endTime",
         ss.status,
         ss.actual_minutes AS "actualMinutes"
       FROM (
         SELECT id, week_start, version
         FROM study_plans
         WHERE user_id = $1
           AND status = 'active'
         ORDER BY week_start DESC
         LIMIT 8
       ) p
       LEFT JOIN study_sessions ss
         ON ss.plan_id = p.id
       LEFT JOIN subjects s
         ON s.id = ss.subject_id
       ORDER BY
         p.week_start DESC,
         ss.weekday,
         ss.start_time`,
      [userId]
    );

    const weeklyMap = new Map();
    const subjectMap = new Map();

    let currentPlanVersion = null;

    for (const session of result.rows) {
      const weekStart = session.weekStart;

      if (!weeklyMap.has(weekStart)) {
        weeklyMap.set(
          weekStart,
          createSummary(weekStart)
        );
      }

      const week = weeklyMap.get(weekStart);

      if (weekStart === currentWeekStart) {
        currentPlanVersion = session.version;
      }

      // LEFT JOIN returns a row even when a
      // weekly plan has no sessions.
      if (!session.sessionId) {
        continue;
      }

      const planned = sessionDuration(session);

      // Only recorded study time counts as
      // completed work.
      const completed = Math.min(
        planned,
        Math.max(
          0,
          Number(session.actualMinutes || 0)
        )
      );

      week.plannedMinutes += planned;
      week.completedMinutes += completed;
      week.plannedSessions += 1;

      if (session.status === "completed") {
        week.completedSessions += 1;
      }

      if (session.status === "partial") {
        week.partialSessions += 1;
      }

      if (session.status === "missed") {
        week.missedSessions += 1;
      }

      // Subject breakdown for the current week.
      if (weekStart === currentWeekStart) {
        const subjectId = session.subjectId;

        if (!subjectMap.has(subjectId)) {
          subjectMap.set(subjectId, {
            subjectId,
            subjectName: session.subjectName,
            plannedMinutes: 0,
            completedMinutes: 0,
            sessionCount: 0,
          });
        }

        const subject = subjectMap.get(subjectId);

        subject.plannedMinutes += planned;
        subject.completedMinutes += completed;
        subject.sessionCount += 1;
      }
    }

    const weeklyTrends = Array.from(
      weeklyMap.values()
    )
      .map(finalizeSummary)
      .sort((a, b) =>
        a.weekStart.localeCompare(b.weekStart)
      );

    const overview =
      weeklyMap.get(currentWeekStart) ||
      createSummary(currentWeekStart);

    finalizeSummary(overview);

    const subjectBreakdown = Array.from(
      subjectMap.values()
    ).sort(
      (a, b) =>
        b.completedMinutes - a.completedMinutes
    );

    return res.json({
      weekStart: currentWeekStart,
      planVersion: currentPlanVersion,
      overview,
      subjectBreakdown,
      weeklyTrends,
      methodology: {
        scope: "active_plan_versions",
        includesArchivedSessions: false,
        completedTime:
          "Recorded actual minutes on active-plan sessions",
        adherence:
          "Recorded minutes divided by scheduled minutes, capped at 100%",
        limitation:
          "Superseded sessions in archived timetable versions are excluded. Historical recorded work may therefore be understated after regeneration or recovery.",
      },
    });
  })
);

// GET /api/analytics/history
// Historical activity across timetable versions.
//
// Use the latest version of each tracking ID
// so copied study sessions aren't counted twice.
router.get(
  "/history",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;

    const result = await query(
      `WITH recent_weeks AS (
         SELECT DISTINCT week_start
         FROM study_plans
         WHERE user_id = $1
         ORDER BY week_start DESC
         LIMIT 8
       ),
       unique_sessions AS (
         SELECT DISTINCT ON (
           sp.week_start,
           ss.tracking_id
         )
           sp.week_start::text AS "weekStart",
           sp.version,
           ss.id AS "sessionId",
           ss.tracking_id AS "trackingId",
           ss.subject_id AS "subjectId",
           s.name AS "subjectName",
           ss.status,
           ss.actual_minutes AS "actualMinutes",
           TO_CHAR(
             ss.start_time, 'HH24:MI'
           ) AS "startTime",
           TO_CHAR(
             ss.end_time, 'HH24:MI'
           ) AS "endTime"
         FROM study_sessions ss
         JOIN study_plans sp
           ON sp.id = ss.plan_id
         JOIN subjects s
           ON s.id = ss.subject_id
         JOIN recent_weeks rw
           ON rw.week_start = sp.week_start
         WHERE sp.user_id = $1
           AND s.user_id = $1
         ORDER BY
           sp.week_start,
           ss.tracking_id,
           sp.version DESC,
           ss.updated_at DESC,
           ss.id DESC
       )
       SELECT *
       FROM unique_sessions
       ORDER BY "weekStart", "subjectName"`,
      [userId]
    );

    const weeklyMap = new Map();
    const subjectMap = new Map();

    const totals = {
      plannedMinutes: 0,
      completedMinutes: 0,
      sessions: 0,
      completedSessions: 0,
      partialSessions: 0,
      missedSessions: 0,
    };

    for (const session of result.rows) {
      const weekStart = session.weekStart;

      if (!weeklyMap.has(weekStart)) {
        weeklyMap.set(
          weekStart,
          createSummary(weekStart)
        );
      }

      const week = weeklyMap.get(weekStart);

      const planned = sessionDuration(session);

      const completed = Math.min(
        planned,
        Math.max(
          0,
          Number(session.actualMinutes || 0)
        )
      );

      // Count each logical session once per week.
      week.plannedMinutes += planned;
      week.completedMinutes += completed;
      week.plannedSessions += 1;

      totals.plannedMinutes += planned;
      totals.completedMinutes += completed;
      totals.sessions += 1;

      if (session.status === "completed") {
        week.completedSessions += 1;
        totals.completedSessions += 1;
      }

      if (session.status === "partial") {
        week.partialSessions += 1;
        totals.partialSessions += 1;
      }

      if (session.status === "missed") {
        week.missedSessions += 1;
        totals.missedSessions += 1;
      }

      const subjectId = session.subjectId;

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          subjectId,
          subjectName: session.subjectName,
          plannedMinutes: 0,
          completedMinutes: 0,
          sessionCount: 0,
        });
      }

      const subject = subjectMap.get(subjectId);

      subject.plannedMinutes += planned;
      subject.completedMinutes += completed;
      subject.sessionCount += 1;
    }

    const weeklyTrends = Array.from(
      weeklyMap.values()
    )
      .map(finalizeSummary)
      .sort((a, b) =>
        a.weekStart.localeCompare(b.weekStart)
      );

    const subjectBreakdown = Array.from(
      subjectMap.values()
    ).sort(
      (a, b) =>
        b.completedMinutes - a.completedMinutes
    );

    return res.json({
      totals,
      weeklyTrends,
      subjectBreakdown,
      methodology: {
        scope: "latest_session_per_tracking_id",
        maximumWeeks: 8,
        includesArchivedSessions: true,
        deduplication:
          "Each tracking ID is counted once per week, using its latest timetable version.",
        completedTime:
          "Recorded actual study minutes from the latest record of each tracked session.",
        limitations: [
          "Records created before migration 007 may have different tracking IDs even when they represent the same session.",
          "These totals describe recorded study activity and cannot independently verify that studying occurred.",
          "The latest recorded status is used when a tracked session has changed across timetable versions.",
          "Historical totals may be inaccurate for legacy records whose copies cannot be identified.",
        ],
      },
    });
  })
);

export default router;
