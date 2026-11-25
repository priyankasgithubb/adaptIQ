
import { Router } from "express";

import { pool, query } from "../lib/db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

import {
  calculateNextReview,
} from "../lib/spacedRepetition.js";

const router = Router();

router.use(requireAuth);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ====================================================
// POST /api/reviews/cards
// Create a revision topic.
// ====================================================

router.post(
  "/cards",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;

    const {
      subjectId,
      topic,
      notes,
    } = req.body ?? {};

    if (
      typeof subjectId !== "string" ||
      !uuidPattern.test(subjectId)
    ) {
      return res.status(400).json({
        error: "A valid subject ID is required.",
      });
    }

    if (
      typeof topic !== "string" ||
      !topic.trim() ||
      topic.trim().length > 150
    ) {
      return res.status(400).json({
        error:
          "Topic must contain between 1 and 150 characters.",
      });
    }

    if (
      notes !== undefined &&
      notes !== null &&
      typeof notes !== "string"
    ) {
      return res.status(400).json({
        error: "Notes must be text.",
      });
    }

    try {
      // INSERT ... SELECT ensures the subject belongs
      // to the authenticated student.
      const result = await query(
        `INSERT INTO spaced_repetition_cards
           (user_id, subject_id, topic, notes)
         SELECT
           $1,
           s.id,
           $3,
           $4
         FROM subjects s
         WHERE s.id = $2
           AND s.user_id = $1
         RETURNING
           id,
           subject_id AS "subjectId",
           topic,
           notes,
           ease_factor AS "easeFactor",
           interval_days AS "intervalDays",
           repetitions,
           lapses,
           next_review_at AS "nextReviewAt",
           status`,
        [
          userId,
          subjectId,
          topic.trim(),
          notes?.trim() || null,
        ]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          error: "Subject not found.",
        });
      }

      return res.status(201).json({
        message: "Review topic created successfully.",
        card: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          error:
            "This review topic already exists for the subject.",
        });
      }

      throw error;
    }
  })
);

// ====================================================
// GET /api/reviews/cards
// List a student's review topics.
// ====================================================

router.get(
  "/cards",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;

    const result = await query(
      `SELECT
         c.id,
         c.subject_id AS "subjectId",
         s.name AS "subjectName",
         c.topic,
         c.notes,
         c.ease_factor AS "easeFactor",
         c.interval_days AS "intervalDays",
         c.repetitions,
         c.lapses,
         c.next_review_at AS "nextReviewAt",
         c.last_reviewed_at AS "lastReviewedAt",
         c.status,
         c.created_at AS "createdAt"
       FROM spaced_repetition_cards c
       JOIN subjects s
         ON s.id = c.subject_id
       WHERE c.user_id = $1
         AND s.user_id = $1
       ORDER BY
         CASE WHEN c.status = 'active'
              THEN 0 ELSE 1 END,
         c.next_review_at ASC,
         c.created_at DESC
       LIMIT 200`,
      [userId]
    );

    return res.json({
      count: result.rows.length,
      cards: result.rows,
    });
  })
);

// ====================================================
// GET /api/reviews/due
// Retrieve active topics due for revision.
// ====================================================

router.get(
  "/due",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;

    const result = await query(
      `SELECT
         c.id,
         c.subject_id AS "subjectId",
         s.name AS "subjectName",
         c.topic,
         c.notes,
         c.ease_factor AS "easeFactor",
         c.interval_days AS "intervalDays",
         c.repetitions,
         c.lapses,
         c.next_review_at AS "nextReviewAt",
         c.last_reviewed_at AS "lastReviewedAt"
       FROM spaced_repetition_cards c
       JOIN subjects s
         ON s.id = c.subject_id
       WHERE c.user_id = $1
         AND s.user_id = $1
         AND c.status = 'active'
         AND c.next_review_at <= NOW()
       ORDER BY c.next_review_at ASC
       LIMIT 100`,
      [userId]
    );

    return res.json({
      count: result.rows.length,
      dueCards: result.rows,
    });
  })
);

// ====================================================
// POST /api/reviews/cards/:id/review
// Save recall rating and schedule the next review.
// ====================================================

router.post(
  "/cards/:id/review",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const cardId = req.params.id;

    const { quality } = req.body ?? {};

    if (!uuidPattern.test(cardId)) {
      return res.status(400).json({
        error: "Invalid review card ID.",
      });
    }

    if (
      !Number.isInteger(quality) ||
      quality < 0 ||
      quality > 5
    ) {
      return res.status(400).json({
        error:
          "Quality must be an integer between 0 and 5.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Lock the card so simultaneous submissions
      // cannot overwrite one another's calculations.
      const cardResult = await client.query(
        `SELECT
           c.id,
           c.status,
           c.ease_factor AS "easeFactor",
           c.interval_days AS "intervalDays",
           c.repetitions,
           c.lapses
         FROM spaced_repetition_cards c
         JOIN subjects s
           ON s.id = c.subject_id
         WHERE c.id = $1
           AND c.user_id = $2
           AND s.user_id = $2
         FOR UPDATE OF c`,
        [cardId, userId]
      );

      if (!cardResult.rows.length) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Review card not found.",
        });
      }

      const card = cardResult.rows[0];

      if (card.status !== "active") {
        await client.query("ROLLBACK");

        return res.status(409).json({
          error: "This review card is paused.",
        });
      }

      const next = calculateNextReview({
        quality,
        easeFactor: Number(card.easeFactor),
        intervalDays: Number(card.intervalDays),
        repetitions: Number(card.repetitions),
        lapses: Number(card.lapses),
        reviewedAt: new Date(),
      });

      const updated = await client.query(
        `UPDATE spaced_repetition_cards
         SET ease_factor = $1,
             interval_days = $2,
             repetitions = $3,
             lapses = $4,
             last_reviewed_at = $5,
             next_review_at = $6,
             updated_at = NOW()
         WHERE id = $7
         RETURNING
           id,
           topic,
           ease_factor AS "easeFactor",
           interval_days AS "intervalDays",
           repetitions,
           lapses,
           next_review_at AS "nextReviewAt",
           last_reviewed_at AS "lastReviewedAt"`,
        [
          next.easeFactor,
          next.intervalDays,
          next.repetitions,
          next.lapses,
          next.reviewedAt,
          next.nextReviewAt,
          cardId,
        ]
      );

      // Record the review in permanent history.
      const historyResult = await client.query(
        `INSERT INTO spaced_repetition_reviews
           (
             card_id,
             user_id,
             quality,
             ease_factor_after,
             interval_days_after,
             repetitions_after,
             next_review_at,
             reviewed_at
           )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING
           id,
           quality,
           reviewed_at AS "reviewedAt",
           next_review_at AS "nextReviewAt"`,
        [
          cardId,
          userId,
          quality,
          next.easeFactor,
          next.intervalDays,
          next.repetitions,
          next.nextReviewAt,
          next.reviewedAt,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        message: "Review saved successfully.",
        card: updated.rows[0],
        review: historyResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

export default router;
