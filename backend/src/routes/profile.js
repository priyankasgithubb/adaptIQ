import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const isValidTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const profileSchema = z.object({
  educationLevel: z.enum(["school", "college", "university"]),
  yearOrClass: z.string().max(50).optional(),
  semester: z.string().max(50).optional(),
  timezone: z.string().refine(isValidTimezone, "Unknown timezone").default("UTC"),
  studyGoal: z.string().max(200).optional(),
  desiredGrade: z.string().max(10).optional(),
  preferredSessionMin: z.number().int().min(15).max(180).default(45),
  dailyStudyLimitMin: z.number().int().min(30).max(720).default(240),
  sleepStart: z.string().regex(timeRegex, "Use HH:MM").optional(),
  sleepEnd: z.string().regex(timeRegex, "Use HH:MM").optional(),
  breakPreferences: z.record(z.any()).optional(),
});

// The database uses snake_case. The frontend gets camelCase.
function toProfile(row) {
  if (!row) return null;
  return {
    educationLevel: row.education_level,
    yearOrClass: row.year_or_class,
    semester: row.semester,
    timezone: row.timezone,
    studyGoal: row.study_goal,
    desiredGrade: row.desired_grade,
    preferredSessionMin: row.preferred_session_min,
    dailyStudyLimitMin: row.daily_study_limit_min,
    sleepStart: row.sleep_start,
    sleepEnd: row.sleep_end,
    breakPreferences: row.break_preferences,
    updatedAt: row.updated_at,
  };
}

// GET /api/profile
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query("SELECT * FROM learner_profiles WHERE user_id = $1", [
      req.session.userId,
    ]);
    res.json({ profile: toProfile(rows[0]) });
  })
);

// PUT /api/profile (creates the first time, updates after)
router.put(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const d = parsed.data;

    const { rows } = await query(
      `INSERT INTO learner_profiles (
         user_id, education_level, year_or_class, semester, timezone, study_goal,
         desired_grade, preferred_session_min, daily_study_limit_min,
         sleep_start, sleep_end, break_preferences, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
       ON CONFLICT (user_id) DO UPDATE SET
         education_level       = EXCLUDED.education_level,
         year_or_class         = EXCLUDED.year_or_class,
         semester              = EXCLUDED.semester,
         timezone              = EXCLUDED.timezone,
         study_goal            = EXCLUDED.study_goal,
         desired_grade         = EXCLUDED.desired_grade,
         preferred_session_min = EXCLUDED.preferred_session_min,
         daily_study_limit_min = EXCLUDED.daily_study_limit_min,
         sleep_start           = EXCLUDED.sleep_start,
         sleep_end             = EXCLUDED.sleep_end,
         break_preferences     = EXCLUDED.break_preferences,
         updated_at            = now()
       RETURNING *`,
      [
        req.session.userId,
        d.educationLevel,
        d.yearOrClass ?? null,
        d.semester ?? null,
        d.timezone,
        d.studyGoal ?? null,
        d.desiredGrade ?? null,
        d.preferredSessionMin,
        d.dailyStudyLimitMin,
        d.sleepStart ?? null,
        d.sleepEnd ?? null,
        d.breakPreferences ? JSON.stringify(d.breakPreferences) : null,
      ]
    );
    res.json({ profile: toProfile(rows[0]) });
  })
);

export default router;