
import { query } from "./db.js";
import { loadPriorities } from "./loadPriorities.js";

/**
 * AdaptIQ — Personalized Recommendation Data Loader
 *
 * Retrieves data for one authenticated student:
 * 1. Completed quiz performance by subject
 * 2. Completed quiz performance by topic
 * 3. Spaced repetition reviews currently due
 * 4. Existing planner subject priorities
 *
 * Returns the exact field structure expected by
 * generateStudyRecommendations().
 */

export async function loadRecommendationInputs(userId) {
  if (!userId) {
    throw new Error("A user ID is required.");
  }

  // 1. Subject-level quiz performance.
  // Count only completed attempts and their assigned answers.
  const subjectResult = await query(
    `SELECT
       s.id AS "subjectId",
       s.name AS "subjectName",
       COUNT(a.id)::int AS "answeredQuestions",
       COUNT(a.id) FILTER (
         WHERE a.is_correct = true
       )::int AS "correctAnswers",
       ROUND(
         100.0 * COUNT(a.id) FILTER (
           WHERE a.is_correct = true
         ) / NULLIF(COUNT(a.id), 0),
         2
       ) AS "accuracyPercent"
     FROM subjects s
     JOIN quiz_attempts qa
       ON qa.subject_id = s.id
       AND qa.user_id = $1
       AND qa.status = 'completed'
     JOIN quiz_attempt_answers a
       ON a.attempt_id = qa.id
     WHERE s.user_id = $1
     GROUP BY s.id, s.name
     ORDER BY s.name`,
    [userId]
  );

  const subjectBreakdown = subjectResult.rows.map(
    (row) => ({
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      answeredQuestions: Number(row.answeredQuestions),
      correctAnswers: Number(row.correctAnswers),
      accuracyPercent: Number(row.accuracyPercent ?? 0),
    })
  );

  // 2. Topic-level quiz performance.
  // Match questions to the same subject as the attempt.
  const topicResult = await query(
    `SELECT
       s.id AS "subjectId",
       s.name AS "subjectName",
       q.topic,
       COUNT(a.id)::int AS "answeredQuestions",
       COUNT(a.id) FILTER (
         WHERE a.is_correct = true
       )::int AS "correctAnswers",
       ROUND(
         100.0 * COUNT(a.id) FILTER (
           WHERE a.is_correct = true
         ) / NULLIF(COUNT(a.id), 0),
         2
       ) AS "accuracyPercent"
     FROM quiz_attempt_answers a
     JOIN quiz_attempts qa
       ON qa.id = a.attempt_id
     JOIN quiz_questions q
       ON q.id = a.question_id
       AND q.subject_id = qa.subject_id
     JOIN subjects s
       ON s.id = qa.subject_id
     WHERE qa.user_id = $1
       AND s.user_id = $1
       AND qa.status = 'completed'
     GROUP BY s.id, s.name, q.topic
     ORDER BY s.name, q.topic`,
    [userId]
  );

  const topicBreakdown = topicResult.rows.map((row) => {
    const answeredQuestions = Number(
      row.answeredQuestions
    );

    const accuracyPercent = Number(
      row.accuracyPercent ?? 0
    );

    let performanceLevel = "insufficient_data";

    // Use the same thresholds as /api/quizzes/insights.
    if (answeredQuestions >= 3) {
      if (accuracyPercent < 50) {
        performanceLevel = "needs_practice";
      } else if (accuracyPercent < 80) {
        performanceLevel = "developing";
      } else {
        performanceLevel = "strong";
      }
    }

    return {
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      topic: row.topic,
      answeredQuestions,
      correctAnswers: Number(row.correctAnswers),
      accuracyPercent,
      performanceLevel,
    };
  });

  // 3. Due spaced repetition topics.
  // Include only active cards that are due now.
  const dueResult = await query(
    `SELECT
       c.id,
       c.subject_id AS "subjectId",
       s.name AS "subjectName",
       c.topic,
       c.next_review_at AS "nextReviewAt"
     FROM spaced_repetition_cards c
     JOIN subjects s
       ON s.id = c.subject_id
     WHERE c.user_id = $1
       AND s.user_id = $1
       AND c.status = 'active'
       AND c.next_review_at <= NOW()
     ORDER BY c.next_review_at ASC`,
    [userId]
  );

  const dueCards = dueResult.rows;

  // 4. Reuse the existing planner's priority calculations.
  // The planner returns scores on a 0–1 scale.
  const plannerPriorities = await loadPriorities(userId);

  const subjectPriorities = plannerPriorities.map(
    (priority) => ({
      subjectId: priority.subjectId,
      subjectName: priority.name,
      priorityScore: Math.max(
        0,
        Math.min(100, Number(priority.score) * 100)
      ),
      mainReason: priority.mainReason,
    })
  );

  return {
    subjectBreakdown,
    topicBreakdown,
    dueCards,
    subjectPriorities,
  };
}
