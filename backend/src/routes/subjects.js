import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth); // every route in this file needs a logged-in user

const subjectInput = z.object({
  name: z.string().trim().min(1, "Subject name is required").max(80),
  weight: z.number().min(0.1).max(10).default(1),
  targetScore: z.number().min(0).max(100).nullable().optional(),
  status: z.enum(["weak", "strong", "unknown"]).default("unknown"),
});

const topicInput = z.object({
  name: z.string().trim().min(1, "Topic name is required").max(80),
});

const assessmentInput = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    marks: z.number().min(0),
    maxMarks: z.number().positive("Max marks must be more than 0"),
    confidence: z.number().int().min(1).max(5).nullable().optional(),
    assessedAt: z.string().datetime({ offset: true, message: "Use a date like 2026-11-01T10:00:00Z" }),
    topicId: z.string().uuid().nullable().optional(),
  })
  .refine((d) => d.marks <= d.maxMarks, {
    message: "Marks cannot be more than max marks",
    path: ["marks"],
  });

const err = (res, status, message) => res.status(status).json({ error: message });

const isUuid = (value) => z.string().uuid().safeParse(value).success;

// Returns the subject only if it exists AND belongs to the logged-in user.
async function findOwnedSubject(subjectId, userId) {
  if (!isUuid(subjectId)) return null;
  const { rows } = await query("SELECT id FROM subjects WHERE id = $1 AND user_id = $2", [
    subjectId,
    userId,
  ]);
  return rows[0] ?? null;
}

// Database numbers can arrive as text, so convert them to real numbers here.
function toSubject(row) {
  return {
    id: row.id,
    name: row.name,
    weight: Number(row.weight),
    targetScore: row.target_score === null ? null : Number(row.target_score),
    status: row.status,
    averagePercent: row.average_percent === null ? null : Number(row.average_percent),
  };
}

function toAssessment(row) {
  const marks = Number(row.marks);
  const maxMarks = Number(row.max_marks);
  return {
    id: row.id,
    title: row.title,
    marks,
    maxMarks,
    percent: Math.round((marks / maxMarks) * 1000) / 10,
    confidence: row.confidence,
    assessedAt: row.assessed_at,
    topicId: row.topic_id,
  };
}

// GET /api/subjects  (list, with each subject's average percentage)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT s.id, s.name, s.weight, s.target_score, s.status,
              (SELECT ROUND(AVG(a.marks / a.max_marks * 100), 1)
                 FROM assessments a
                WHERE a.subject_id = s.id) AS average_percent
         FROM subjects s
        WHERE s.user_id = $1
        ORDER BY s.name`,
      [req.session.userId]
    );
    res.json({ subjects: rows.map(toSubject) });
  })
);

// POST /api/subjects
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = subjectInput.safeParse(req.body);
    if (!parsed.success) return err(res, 400, parsed.error.issues[0].message);
    const d = parsed.data;

    try {
      const { rows } = await query(
        `INSERT INTO subjects (user_id, name, weight, target_score, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, weight, target_score, status, NULL::numeric AS average_percent`,
        [req.session.userId, d.name, d.weight, d.targetScore ?? null, d.status]
      );
      res.status(201).json({ subject: toSubject(rows[0]) });
    } catch (e) {
      if (e.code === "23505") return err(res, 409, "You already have a subject with this name");
      throw e;
    }
  })
);

// PUT /api/subjects/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return err(res, 404, "Subject not found");
    const parsed = subjectInput.safeParse(req.body);
    if (!parsed.success) return err(res, 400, parsed.error.issues[0].message);
    const d = parsed.data;

    const { rows } = await query(
      `UPDATE subjects
          SET name = $3, weight = $4, target_score = $5, status = $6
        WHERE id = $1 AND user_id = $2
        RETURNING id, name, weight, target_score, status, NULL::numeric AS average_percent`,
      [req.params.id, req.session.userId, d.name, d.weight, d.targetScore ?? null, d.status]
    );
    if (!rows[0]) return err(res, 404, "Subject not found");
    res.json({ subject: toSubject(rows[0]) });
  })
);

// DELETE /api/subjects/:id  (also deletes its topics and marks)
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return err(res, 404, "Subject not found");
    const { rowCount } = await query("DELETE FROM subjects WHERE id = $1 AND user_id = $2", [
      req.params.id,
      req.session.userId,
    ]);
    if (!rowCount) return err(res, 404, "Subject not found");
    res.json({ ok: true });
  })
);

// POST /api/subjects/:id/topics
router.post(
  "/:id/topics",
  asyncHandler(async (req, res) => {
    const subject = await findOwnedSubject(req.params.id, req.session.userId);
    if (!subject) return err(res, 404, "Subject not found");

    const parsed = topicInput.safeParse(req.body);
    if (!parsed.success) return err(res, 400, parsed.error.issues[0].message);

    try {
      const { rows } = await query(
        "INSERT INTO topics (subject_id, name) VALUES ($1, $2) RETURNING id, name",
        [subject.id, parsed.data.name]
      );
      res.status(201).json({ topic: rows[0] });
    } catch (e) {
      if (e.code === "23505") return err(res, 409, "This topic already exists");
      throw e;
    }
  })
);

// POST /api/subjects/:id/assessments  (add a test or assignment mark)
router.post(
  "/:id/assessments",
  asyncHandler(async (req, res) => {
    const subject = await findOwnedSubject(req.params.id, req.session.userId);
    if (!subject) return err(res, 404, "Subject not found");

    const parsed = assessmentInput.safeParse(req.body);
    if (!parsed.success) return err(res, 400, parsed.error.issues[0].message);
    const d = parsed.data;

    // A topic must belong to the same subject.
    if (d.topicId) {
      const topic = await query("SELECT id FROM topics WHERE id = $1 AND subject_id = $2", [
        d.topicId,
        subject.id,
      ]);
      if (!topic.rows[0]) return err(res, 400, "That topic does not belong to this subject");
    }

    const { rows } = await query(
      `INSERT INTO assessments (subject_id, topic_id, title, marks, max_marks, confidence, assessed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, marks, max_marks, confidence, assessed_at, topic_id`,
      [subject.id, d.topicId ?? null, d.title, d.marks, d.maxMarks, d.confidence ?? null, d.assessedAt]
    );
    res.status(201).json({ assessment: toAssessment(rows[0]) });
  })
);

// GET /api/subjects/:id/assessments
router.get(
  "/:id/assessments",
  asyncHandler(async (req, res) => {
    const subject = await findOwnedSubject(req.params.id, req.session.userId);
    if (!subject) return err(res, 404, "Subject not found");

    const { rows } = await query(
      `SELECT id, title, marks, max_marks, confidence, assessed_at, topic_id
         FROM assessments
        WHERE subject_id = $1
        ORDER BY assessed_at DESC`,
      [subject.id]
    );
    res.json({ assessments: rows.map(toAssessment) });
  })
);

export default router;