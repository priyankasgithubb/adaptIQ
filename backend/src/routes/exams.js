import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

const examInput = z.object({
  subjectId: z.string().uuid("Choose a subject"),
  title: z.string().trim().min(1, "Title is required").max(120),
  examAt: z.string().datetime({ offset: true, message: "Use a date like 2026-12-01T09:00:00Z" }),
  importance: z.number().min(0, "Importance must be 0 to 1").max(1, "Importance must be 0 to 1").default(1),
  syllabusScope: z.string().trim().max(500).nullable().optional(),
});

const err = (res, status, message) => res.status(status).json({ error: message });

const isUuid = (value) => z.string().uuid().safeParse(value).success;

// The subject must exist and belong to this user.
async function subjectBelongsToUser(subjectId, userId) {
  const { rows } = await query("SELECT id FROM subjects WHERE id = $1 AND user_id = $2", [
    subjectId,
    userId,
  ]);
  return rows.length > 0;
}

// Shared query: an exam plus the name of its subject.
const EXAM_SELECT = `
  SELECT e.id, e.subject_id, s.name AS subject_name, e.title,
         e.exam_at, e.importance, e.syllabus_scope
    FROM exams e
    JOIN subjects s ON s.id = e.subject_id`;

function toExam(row) {
  const examAt = new Date(row.exam_at);
  return {
    id: row.id,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    title: row.title,
    examAt: examAt.toISOString(),
    importance: Number(row.importance),
    syllabusScope: row.syllabus_scope,
    daysUntil: Math.ceil((examAt - Date.now()) / 86400000),
  };
}

async function fetchExam(id, userId) {
  const { rows } = await query(`${EXAM_SELECT} WHERE e.id = $1 AND e.user_id = $2`, [id, userId]);
  return rows[0] ? toExam(rows[0]) : null;
}

// GET /api/exams (soonest first)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await query(`${EXAM_SELECT} WHERE e.user_id = $1 ORDER BY e.exam_at`, [
      req.session.userId,
    ]);
    res.json({ exams: rows.map(toExam) });
  })
);

// POST /api/exams
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = examInput.safeParse(req.body);
    if (!parsed.success) return err(res, 400, parsed.error.issues[0].message);
    const d = parsed.data;

    if (!(await subjectBelongsToUser(d.subjectId, req.session.userId))) {
      return err(res, 400, "Subject not found");
    }

    const { rows } = await query(
      `INSERT INTO exams (user_id, subject_id, title, exam_at, importance, syllabus_scope)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.session.userId, d.subjectId, d.title, d.examAt, d.importance, d.syllabusScope ?? null]
    );
    res.status(201).json({ exam: await fetchExam(rows[0].id, req.session.userId) });
  })
);

// PUT /api/exams/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return err(res, 404, "Exam not found");
    const parsed = examInput.safeParse(req.body);
    if (!parsed.success) return err(res, 400, parsed.error.issues[0].message);
    const d = parsed.data;

    if (!(await subjectBelongsToUser(d.subjectId, req.session.userId))) {
      return err(res, 400, "Subject not found");
    }

    const { rows } = await query(
      `UPDATE exams
          SET subject_id = $3, title = $4, exam_at = $5, importance = $6, syllabus_scope = $7
        WHERE id = $1 AND user_id = $2
        RETURNING id`,
      [
        req.params.id,
        req.session.userId,
        d.subjectId,
        d.title,
        d.examAt,
        d.importance,
        d.syllabusScope ?? null,
      ]
    );
    if (!rows[0]) return err(res, 404, "Exam not found");
    res.json({ exam: await fetchExam(rows[0].id, req.session.userId) });
  })
);

// DELETE /api/exams/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return err(res, 404, "Exam not found");
    const { rowCount } = await query("DELETE FROM exams WHERE id = $1 AND user_id = $2", [
      req.params.id,
      req.session.userId,
    ]);
    if (!rowCount) return err(res, 404, "Exam not found");
    res.json({ ok: true });
  })
);

export default router;
