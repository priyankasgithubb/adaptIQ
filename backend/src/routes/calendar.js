
import { Router } from "express";

import { query } from "../lib/db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

import {
  generateCalendarIcs,
} from "../lib/calendarExport.js";

const router = Router();

router.use(requireAuth);

// GET /api/calendar/export
// Download the authenticated student's active
// study timetable for the current local week.
router.get(
  "/export",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;

    const profileResult = await query(
      `SELECT timezone
       FROM learner_profiles
       WHERE user_id = $1`,
      [userId]
    );

    if (!profileResult.rows.length) {
      return res.status(400).json({
        error: "Set up your study profile first.",
      });
    }

    const timezone =
      profileResult.rows[0].timezone || "UTC";

    // Match the current-week convention used
    // by the existing study plan API.
    const planResult = await query(
      `SELECT
         id,
         week_start::text AS week_start,
         version,
         status
       FROM study_plans
       WHERE user_id = $1
         AND week_start = (
           date_trunc(
             'week',
             NOW() AT TIME ZONE $2
           )::date
         )
         AND status = 'active'
       LIMIT 1`,
      [userId, timezone]
    );

    if (!planResult.rows.length) {
      return res.status(404).json({
        error:
          "No saved study plan for the current week.",
      });
    }

    const plan = planResult.rows[0];

    const sessionsResult = await query(
      `SELECT
         ss.id,
         ss.subject_id AS "subjectId",
         s.name AS "subjectName",
         ss.weekday,
         TO_CHAR(
           ss.start_time, 'HH24:MI'
         ) AS "startTime",
         TO_CHAR(
           ss.end_time, 'HH24:MI'
         ) AS "endTime",
         ss.status
       FROM study_sessions ss
       JOIN subjects s
         ON s.id = ss.subject_id
       WHERE ss.plan_id = $1
         AND s.user_id = $2
       ORDER BY ss.weekday, ss.start_time`,
      [plan.id, userId]
    );

    const ics = generateCalendarIcs({
      plan,
      blocks: sessionsResult.rows,
      timezone,
    });

    const filename =
      `adaptiq-study-plan-${plan.week_start}.ics`;

    res.set({
      "Content-Type":
        "text/calendar; charset=utf-8",
      "Content-Disposition":
        `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    });

    return res.status(200).send(ics);
  })
);

export default router;
