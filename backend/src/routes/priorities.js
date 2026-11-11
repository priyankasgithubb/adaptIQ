import { Router } from "express";
import { query } from "../lib/db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { calculatePriorities } from "../lib/priority.js";

const router = Router();
router.use(requireAuth);

// GET /api/priorities  (which subjects to study first, and why)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;

    const subjectResult = await query(
      `SELECT s.id, s.name, s.weight,
              (SELECT ROUND(AVG(a.marks / a.max_marks * 100), 1)
                 FROM assessments a
                WHERE a.subject_id = s.id) AS average_percent
         FROM subjects s
        WHERE s.user_id = $1`,
      [userId]
    );

    const examResult = await query(
      `SELECT subject_id, exam_at, importance
         FROM exams
        WHERE user_id = $1 AND exam_at > now()`,
      [userId]
    );

    const subjects = subjectResult.rows.map((r) => ({
      id: r.id,
      name: r.name,
      weight: Number(r.weight),
      averagePercent: r.average_percent === null ? null : Number(r.average_percent),
    }));

    const exams = examResult.rows.map((r) => ({
      subjectId: r.subject_id,
      examAt: new Date(r.exam_at),
      importance: Number(r.importance),
    }));

    res.json({ priorities: calculatePriorities(subjects, exams) });
  })
);

export default router;