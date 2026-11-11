import { Router } from "express";
import { query } from "../lib/db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { loadPriorities } from "../lib/loadPriorities.js";

const router = Router();
router.use(requireAuth);

const PLANNER_URL = process.env.PLANNER_URL || "http://127.0.0.1:8000";
const SUBJECT_WEEK_CAP_MIN = 240; // at most 4 hours per subject per week

// "09:30" -> 570 (minutes since midnight)
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

// 570 -> "09:30"
const fromMinutes = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

// GET /api/plan  (builds this week's timetable)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;

    const profileResult = await query(
      "SELECT daily_study_limit_min, preferred_session_min FROM learner_profiles WHERE user_id = $1",
      [userId]
    );
    const profile = profileResult.rows[0];
    if (!profile) return res.status(400).json({ error: "Set up your study profile first" });

    // Free windows are the times you marked as "free" for studying.
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
    if (freeWindows.length === 0) {
      return res.status(400).json({ error: "Add some free time first" });
    }

    const priorities = await loadPriorities(userId);
    if (priorities.length === 0) {
      return res.status(400).json({ error: "Add some subjects first" });
    }

    // Send everything to the Python planner.
    let plannerResponse;
    try {
      plannerResponse = await fetch(`${PLANNER_URL}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freeWindows,
          subjects: priorities.map((p) => ({ id: p.subjectId, name: p.name, score: p.score })),
          dailyLimitMin: profile.daily_study_limit_min,
          subjectWeekCapMin: SUBJECT_WEEK_CAP_MIN,
          minBlockMin: profile.preferred_session_min,
        }),
      });
    } catch {
      return res.status(503).json({ error: "The planner is not running. Start it and try again." });
    }

    if (!plannerResponse.ok) {
      return res.status(502).json({ error: "The planner could not build a timetable" });
    }

    const { blocks } = await plannerResponse.json();
    res.json({
      blocks: blocks.map((b) => ({
        weekday: b.weekday,
        startTime: fromMinutes(b.startMin),
        endTime: fromMinutes(b.endMin),
        subjectId: b.subjectId,
        subjectName: b.subjectName,
      })),
    });
  })
);

export default router;