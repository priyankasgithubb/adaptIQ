import { Router } from "express";
import { pool, query } from "../lib/db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);

const validDifficulties = ["easy", "medium", "hard"];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownsSubject(userId, subjectId) {
  const result = await query(
    `SELECT id
     FROM subjects
     WHERE id = $1
       AND user_id = $2`,
    [subjectId, userId]
  );

  return result.rows.length > 0;
}

// POST /api/quizzes/questions
// Add a question to the authenticated user's subject.
router.post(
  "/questions",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;

    const {
      subjectId,
      topic,
      questionText,
      options,
      correctOption,
      difficulty = "easy",
      explanation,
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
        error: "Topic must contain between 1 and 150 characters.",
      });
    }

    if (
      typeof questionText !== "string" ||
      !questionText.trim()
    ) {
      return res.status(400).json({
        error: "Question text is required.",
      });
    }

    if (
      !Array.isArray(options) ||
      options.length !== 4 ||
      !options.every(
        (option) =>
          typeof option === "string" &&
          option.trim().length > 0
      )
    ) {
      return res.status(400).json({
        error: "Exactly four non-empty answer options are required.",
      });
    }

    if (
      !Number.isInteger(correctOption) ||
      correctOption < 0 ||
      correctOption > 3
    ) {
      return res.status(400).json({
        error: "Correct option must be an integer from 0 to 3.",
      });
    }

    if (!validDifficulties.includes(difficulty)) {
      return res.status(400).json({
        error: "Difficulty must be easy, medium, or hard.",
      });
    }

    if (
      explanation != null &&
      typeof explanation !== "string"
    ) {
      return res.status(400).json({
        error: "Explanation must be text.",
      });
    }

    const subjectExists = await ownsSubject(
      userId,
      subjectId
    );

    if (!subjectExists) {
      return res.status(404).json({
        error: "Subject not found.",
      });
    }

    const result = await query(
      `INSERT INTO quiz_questions
         (
           subject_id,
           topic,
           question_text,
           options,
           correct_option,
           difficulty,
           explanation
         )
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       RETURNING
         id,
         subject_id AS "subjectId",
         topic,
         question_text AS "questionText",
         difficulty,
         created_at AS "createdAt"`,
      [
        subjectId,
        topic.trim(),
        questionText.trim(),
        JSON.stringify(
          options.map((option) => option.trim())
        ),
        correctOption,
        difficulty,
        explanation?.trim() || null,
      ]
    );

    return res.status(201).json({
      message: "Quiz question created successfully.",
      question: result.rows[0],
    });
  })
);

// GET /api/quizzes/questions?subjectId=...
// Return questions without revealing correct answers.
router.get(
  "/questions",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const { subjectId } = req.query;

    if (
      typeof subjectId !== "string" ||
      !uuidPattern.test(subjectId)
    ) {
      return res.status(400).json({
        error: "A valid subject ID is required.",
      });
    }

    const subjectExists = await ownsSubject(
      userId,
      subjectId
    );

    if (!subjectExists) {
      return res.status(404).json({
        error: "Subject not found.",
      });
    }

    const result = await query(
      `SELECT
         id,
         subject_id AS "subjectId",
         topic,
         question_text AS "questionText",
         options,
         difficulty
       FROM quiz_questions
       WHERE subject_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 100`,
      [subjectId]
    );

    return res.json({
      subjectId,
      count: result.rows.length,
      questions: result.rows,
    });
  })
);


// ====================================================
// Phase 6.2.3B — Quiz Attempts and Answer Submissions
// ====================================================

// POST /api/quizzes/attempts
// Start a quiz using up to 5 existing subject questions.
router.post(
  "/attempts",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const { subjectId } = req.body ?? {};

    if (
      typeof subjectId !== "string" ||
      !uuidPattern.test(subjectId)
    ) {
      return res.status(400).json({
        error: "A valid subject ID is required.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const subjectResult = await client.query(
        `SELECT id
         FROM subjects
         WHERE id = $1 AND user_id = $2`,
        [subjectId, userId]
      );

      if (!subjectResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Subject not found.",
        });
      }


      // Determine the preferred difficulty using the
      // student's most recent completed quiz for this subject.
      const previousResult = await client.query(
        `SELECT score_percent AS "scorePercent"
         FROM quiz_attempts
         WHERE user_id = $1
           AND subject_id = $2
           AND status = 'completed'
         ORDER BY completed_at DESC, id DESC
         LIMIT 1`,
        [userId, subjectId]
      );

      const previousScore =
        previousResult.rows.length > 0
          ? Number(previousResult.rows[0].scorePercent)
          : null;

      let targetDifficulty = "easy";

      if (previousScore !== null) {
        if (previousScore >= 80) {
          targetDifficulty = "hard";
        } else if (previousScore >= 50) {
          targetDifficulty = "medium";
        }
      }

      // Prefer questions at the selected difficulty.
      // If fewer than five exist, fill the remaining
      // positions from other difficulty levels.
      const questionResult = await client.query(
        `SELECT
           id,
           topic,
           question_text AS "questionText",
           options,
           difficulty
         FROM quiz_questions
         WHERE subject_id = $1
         ORDER BY
           CASE
             WHEN difficulty = $2 THEN 0
             ELSE 1
           END,
           RANDOM()
         LIMIT 5`,
        [subjectId, targetDifficulty]
      );


      const questions = questionResult.rows;

      if (!questions.length) {
        await client.query("ROLLBACK");
        return res.status(422).json({
          error:
            "Add at least one question to this subject before starting a quiz.",
        });
      }

      const attemptResult = await client.query(
        `INSERT INTO quiz_attempts
           (user_id, subject_id, total_questions)
         VALUES ($1, $2, $3)
         RETURNING
           id,
           subject_id AS "subjectId",
           status,
           total_questions AS "totalQuestions",
           started_at AS "startedAt"`,
        [userId, subjectId, questions.length]
      );

      const attempt = attemptResult.rows[0];

      // Reserve the questions for this attempt.
      // Answers have not been submitted yet.
      for (const question of questions) {
        await client.query(
          `INSERT INTO quiz_attempt_answers
             (attempt_id, question_id)
           VALUES ($1, $2)`,
          [attempt.id, question.id]
        );
      }

      await client.query("COMMIT");


      return res.status(201).json({
        message: "Quiz started successfully.",
        attempt,
        adaptive: {
          previousScore,
          targetDifficulty,
          selectionMethod:
            "Most recent completed quiz score",
        },
        questions,
      });

    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

// GET /api/quizzes/attempts/:id
// Retrieve an existing attempt owned by the user.
router.get(
  "/attempts/:id",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const attemptId = req.params.id;

    if (!uuidPattern.test(attemptId)) {
      return res.status(400).json({
        error: "Invalid quiz attempt ID.",
      });
    }

    const attemptResult = await query(
      `SELECT
         id,
         subject_id AS "subjectId",
         status,
         total_questions AS "totalQuestions",
         correct_answers AS "correctAnswers",
         score_percent AS "scorePercent",
         started_at AS "startedAt",
         completed_at AS "completedAt"
       FROM quiz_attempts
       WHERE id = $1 AND user_id = $2`,
      [attemptId, userId]
    );

    if (!attemptResult.rows.length) {
      return res.status(404).json({
        error: "Quiz attempt not found.",
      });
    }

    const attempt = attemptResult.rows[0];

    const questionResult = await query(
      `SELECT
         q.id,
         q.topic,
         q.question_text AS "questionText",
         q.options,
         q.difficulty,
         a.selected_option AS "selectedOption",
         a.is_correct AS "isCorrect",
         CASE
           WHEN qa.status = 'completed'
           THEN q.correct_option
           ELSE NULL
         END AS "correctOption",
         CASE
           WHEN qa.status = 'completed'
           THEN q.explanation
           ELSE NULL
         END AS explanation
       FROM quiz_attempt_answers a
       JOIN quiz_questions q
         ON q.id = a.question_id
       JOIN quiz_attempts qa
         ON qa.id = a.attempt_id
       WHERE a.attempt_id = $1
       ORDER BY q.id`,
      [attemptId]
    );

    const questions = questionResult.rows.map((question) => {
      if (attempt.status === "completed") {
        return question;
      }

      // Never expose solutions before submission.
      const {
        correctOption,
        explanation,
        isCorrect,
        ...safeQuestion
      } = question;

      return safeQuestion;
    });

    return res.json({
      attempt,
      questions,
    });
  })
);

// POST /api/quizzes/attempts/:id/submit
// Score the quiz using server-side correct answers.
router.post(
  "/attempts/:id/submit",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const attemptId = req.params.id;
    const { answers } = req.body ?? {};

    if (!uuidPattern.test(attemptId)) {
      return res.status(400).json({
        error: "Invalid quiz attempt ID.",
      });
    }

    if (
      !Array.isArray(answers) ||
      answers.length === 0 ||
      answers.length > 5
    ) {
      return res.status(400).json({
        error: "Provide answers for every quiz question.",
      });
    }

    const answerMap = new Map();

    for (const answer of answers) {
      if (
        !answer ||
        typeof answer.questionId !== "string" ||
        !uuidPattern.test(answer.questionId) ||
        !Number.isInteger(answer.selectedOption) ||
        answer.selectedOption < 0 ||
        answer.selectedOption > 3 ||
        answerMap.has(answer.questionId)
      ) {
        return res.status(400).json({
          error: "Invalid or duplicate quiz answer.",
        });
      }

      answerMap.set(
        answer.questionId,
        answer.selectedOption
      );
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Lock the attempt to prevent concurrent submissions.
      const attemptResult = await client.query(
        `SELECT
           id,
           status,
           total_questions
         FROM quiz_attempts
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [attemptId, userId]
      );

      if (!attemptResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Quiz attempt not found.",
        });
      }

      const attempt = attemptResult.rows[0];

      if (attempt.status !== "in_progress") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "This quiz has already been submitted.",
        });
      }

      const questionResult = await client.query(
        `SELECT
           q.id,
           q.correct_option AS "correctOption",
           q.explanation
         FROM quiz_attempt_answers a
         JOIN quiz_questions q
           ON q.id = a.question_id
         WHERE a.attempt_id = $1`,
        [attemptId]
      );

      const questions = questionResult.rows;

      // Require exactly the assigned questions.
      if (
        answers.length !== Number(attempt.total_questions) ||
        questions.length !== Number(attempt.total_questions) ||
        questions.some(
          (question) => !answerMap.has(question.id)
        )
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "All assigned quiz questions must be answered.",
        });
      }

      let correctAnswers = 0;
      const results = [];

      for (const question of questions) {
        const selectedOption = answerMap.get(question.id);

        const isCorrect =
          selectedOption === question.correctOption;

        if (isCorrect) {
          correctAnswers += 1;
        }

        await client.query(
          `UPDATE quiz_attempt_answers
           SET selected_option = $1,
               is_correct = $2,
               answered_at = NOW()
           WHERE attempt_id = $3
             AND question_id = $4`,
          [
            selectedOption,
            isCorrect,
            attemptId,
            question.id,
          ]
        );

        results.push({
          questionId: question.id,
          selectedOption,
          correctOption: question.correctOption,
          isCorrect,
          explanation: question.explanation,
        });
      }

      const totalQuestions = questions.length;

      const scorePercent = Number(
        (
          (correctAnswers / totalQuestions) *
          100
        ).toFixed(2)
      );

      const completedResult = await client.query(
        `UPDATE quiz_attempts
         SET status = 'completed',
             correct_answers = $1,
             score_percent = $2,
             completed_at = NOW()
         WHERE id = $3
         RETURNING
           id,
           status,
           total_questions AS "totalQuestions",
           correct_answers AS "correctAnswers",
           score_percent AS "scorePercent",
           completed_at AS "completedAt"`,
        [
          correctAnswers,
          scorePercent,
          attemptId,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        message: "Quiz submitted successfully.",
        attempt: completedResult.rows[0],
        results,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);


// ====================================================
// Phase 6.2.6A — Quiz-Based Subject Insights
// ====================================================

// GET /api/quizzes/insights
// Analyze completed quizzes across the student's subjects.
router.get(
  "/insights",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;

    // Overall completed quiz performance by subject.
    const subjectResult = await query(
      `SELECT
         s.id AS "subjectId",
         s.name AS "subjectName",
         COUNT(DISTINCT qa.id)::int AS "quizCount",
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
       FROM quiz_attempts qa
       JOIN subjects s
         ON s.id = qa.subject_id
       JOIN quiz_attempt_answers a
         ON a.attempt_id = qa.id
       WHERE qa.user_id = $1
         AND s.user_id = $1
         AND qa.status = 'completed'
       GROUP BY s.id, s.name
       ORDER BY s.name`,
      [userId]
    );

    // Topic-level performance within completed quizzes.
    const topicResult = await query(
      `SELECT
         s.id AS "subjectId",
         s.name AS "subjectName",
         q.topic,
         COUNT(a.id)::int AS "answeredQuestions",
         COUNT(a.id) FILTER (
           WHERE a.is_correct = true
         )::int AS "correctAnswers",
         COUNT(a.id) FILTER (
           WHERE a.is_correct = false
         )::int AS "incorrectAnswers",
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
       JOIN subjects s
         ON s.id = qa.subject_id
       WHERE qa.user_id = $1
         AND s.user_id = $1
         AND qa.status = 'completed'
         AND q.subject_id = qa.subject_id
       GROUP BY s.id, s.name, q.topic
       ORDER BY s.name, q.topic`,
      [userId]
    );

    // Recent completed quizzes for performance trends.
    const recentResult = await query(
      `SELECT
         qa.id AS "attemptId",
         s.id AS "subjectId",
         s.name AS "subjectName",
         qa.total_questions AS "totalQuestions",
         qa.correct_answers AS "correctAnswers",
         qa.score_percent AS "scorePercent",
         qa.completed_at AS "completedAt"
       FROM quiz_attempts qa
       JOIN subjects s
         ON s.id = qa.subject_id
       WHERE qa.user_id = $1
         AND s.user_id = $1
         AND qa.status = 'completed'
       ORDER BY qa.completed_at DESC, qa.id DESC
       LIMIT 20`,
      [userId]
    );

    const subjectBreakdown = subjectResult.rows.map(
      (row) => ({
        ...row,
        accuracyPercent: Number(
          row.accuracyPercent ?? 0
        ),
      })
    );

    const topicBreakdown = topicResult.rows.map(
      (row) => {
        const accuracy = Number(
          row.accuracyPercent ?? 0
        );

        // Three answered questions is a minimum
        // evidence threshold for practice feedback.
        let performanceLevel = "insufficient_data";
        let recommendation =
          "Complete more practice questions on this topic.";

        if (row.answeredQuestions >= 3) {
          if (accuracy < 50) {
            performanceLevel = "needs_practice";
            recommendation =
              "Prioritize reviewing this topic before your next quiz.";
          } else if (accuracy < 80) {
            performanceLevel = "developing";
            recommendation =
              "Continue practicing this topic to improve consistency.";
          } else {
            performanceLevel = "strong";
            recommendation =
              "Good progress. Maintain this topic with occasional revision.";
          }
        }

        return {
          ...row,
          accuracyPercent: accuracy,
          performanceLevel,
          recommendation,
        };
      }
    );

    const recentAttempts = recentResult.rows.map(
      (row) => ({
        ...row,
        scorePercent: Number(row.scorePercent ?? 0),
      })
    );

    const overallAnswered = subjectBreakdown.reduce(
      (total, subject) =>
        total + subject.answeredQuestions,
      0
    );

    const overallCorrect = subjectBreakdown.reduce(
      (total, subject) =>
        total + subject.correctAnswers,
      0
    );

    const totalQuizzes = subjectBreakdown.reduce(
      (total, subject) => total + subject.quizCount,
      0
    );

    const overallAccuracy =
      overallAnswered > 0
        ? Number(
            (
              (overallCorrect / overallAnswered) *
              100
            ).toFixed(2)
          )
        : 0;

    // Topics are prioritized using measured quiz
    // accuracy, with the lowest accuracy first.
    const focusTopics = topicBreakdown
      .filter(
        (topic) =>
          topic.performanceLevel === "needs_practice"
      )
      .sort(
        (a, b) =>
          a.accuracyPercent - b.accuracyPercent ||
          b.incorrectAnswers - a.incorrectAnswers
      )
      .slice(0, 5);

    return res.json({
      overview: {
        totalQuizzes,
        answeredQuestions: overallAnswered,
        correctAnswers: overallCorrect,
        overallAccuracy,
        subjectsPracticed: subjectBreakdown.length,
      },
      subjectBreakdown,
      topicBreakdown,
      focusTopics,
      recentAttempts,
      methodology: {
        scope: "completed_quizzes_only",
        accuracy:
          "Correct submitted answers divided by all submitted answers.",
        performanceThresholds: {
          minimumAnswers: 3,
          needsPractice: "Accuracy below 50%",
          developing: "Accuracy from 50% to below 80%",
          strong: "Accuracy of 80% or higher",
        },
        limitations: [
          "Topics with fewer than three answers are not classified.",
          "Results represent performance on available practice questions, not confirmed subject mastery.",
          "Repeated questions may influence accuracy.",
          "Deleted question-bank records may reduce historical answer coverage.",
        ],
      },
    });
  })
);



export default router;
