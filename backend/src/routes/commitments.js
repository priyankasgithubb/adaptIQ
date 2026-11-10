import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const commitmentInput = z
  .object({
    kind: z.enum(["class", "fixed", "blocked", "free"]),
    title: z.string().trim().min(1, "Title is required").max(80),
    weekday: z.number().int().min(0, "Weekday must be 0 (Monday) to 6 (Sunday)").max(6),
    startTime: z.string().regex(timeRegex, "Use HH:MM, for example 09:00"),
    endTime: z.string().regex(timeRegex, "Use HH:MM, for example 10:30"),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

const err = (res, status, message) => res.status(status).json({ error: message });

const isUuid = (value) => z.string().uuid().safeParse(value).success;

// Two time ranges overlap when each one starts before the other one ends.
// ignoreId lets an update skip the commitment being changed.
async function findClash(userId, weekday, startTime, endTime, ignoreId = null) {
  const { rows } = await query(
    `SELECT id, title, start_time, end_time
       FROM commitments
      WHERE user_id = $1
        AND weekday = $2
        AND start_time < $4
        AND end_time > $3
        AND ($5::uuid IS NULL OR id <> $5)`,
    [userId, weekday, startTime, endTime, ignoreId]
  );
  return rows[0] ?? null;
}

// The database returns times like "09:00:00". Cut off the seconds.
function toCommitment(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    weekday: row.weekday,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
  };
}

function clashMessage(clash) {
  return `Clashes with "${clash.title}" (${clash.start_time.slice(0, 5)}–${clash.end_time.slice(0, 5)})`;
}

// GET /api/commitments
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id, kind, title, weekday, start_time, end_time
         FROM commitments
        WHERE user_id = $1
        ORDER BY weekday, start_time`,
      [req.session.userId]
    );
    res.json({ commitments: rows.map(toCommitment) });
  })
);

// POST /api/commitments
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = commitmentInput.safeParse(req.body);
    if (!parsed.success) return err(res, 400, parsed.error.issues[0].message);
    const d = parsed.data;

    const clash = await findClash(req.session.userId, d.weekday, d.startTime, d.endTime);
    if (clash) return err(res, 409, clashMessage(clash));

    const { rows } = await query(
      `INSERT INTO commitments (user_id, kind, title, weekday, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, kind, title, weekday, start_time, end_time`,
      [req.session.userId, d.kind, d.title, d.weekday, d.startTime, d.endTime]
    );
    res.status(201).json({ commitment: toCommitment(rows[0]) });
  })
);

// PUT /api/commitments/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return err(res, 404, "Commitment not found");
    const parsed = commitmentInput.safeParse(req.body);
    if (!parsed.success) return err(res, 400, parsed.error.issues[0].message);
    const d = parsed.data;

    const clash = await findClash(
      req.session.userId,
      d.weekday,
      d.startTime,
      d.endTime,
      req.params.id
    );
    if (clash) return err(res, 409, clashMessage(clash));

    const { rows } = await query(
      `UPDATE commitments
          SET kind = $3, title = $4, weekday = $5, start_time = $6, end_time = $7
        WHERE id = $1 AND user_id = $2
        RETURNING id, kind, title, weekday, start_time, end_time`,
      [req.params.id, req.session.userId, d.kind, d.title, d.weekday, d.startTime, d.endTime]
    );
    if (!rows[0]) return err(res, 404, "Commitment not found");
    res.json({ commitment: toCommitment(rows[0]) });
  })
);

// DELETE /api/commitments/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return err(res, 404, "Commitment not found");
    const { rowCount } = await query(
      "DELETE FROM commitments WHERE id = $1 AND user_id = $2",
      [req.params.id, req.session.userId]
    );
    if (!rowCount) return err(res, 404, "Commitment not found");
    res.json({ ok: true });
  })
);

export default router;