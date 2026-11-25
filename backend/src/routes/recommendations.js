
import { Router } from "express";

import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

import {
  loadRecommendationInputs,
} from "../lib/loadRecommendationInputs.js";

import {
  generateStudyRecommendations,
} from "../lib/studyRecommendations.js";

const router = Router();

router.use(requireAuth);

// ====================================================
// GET /api/recommendations
// Personalized study recommendations for the
// currently authenticated student.
// ====================================================

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;

    // 1. Collect existing student performance data.
    const inputs = await loadRecommendationInputs(userId);

    // 2. Generate rule-based recommendations.
    const recommendations =
      generateStudyRecommendations(inputs);

    // 3. Summarize the results.
    const summary = {
      totalRecommendations: recommendations.length,

      highPriority: recommendations.filter(
        (item) => item.urgency === "high"
      ).length,

      mediumPriority: recommendations.filter(
        (item) => item.urgency === "medium"
      ).length,

      lowPriority: recommendations.filter(
        (item) => item.urgency === "low"
      ).length,

      totalDueReviews: inputs.dueCards.length,

      subjectsWithQuizData:
        inputs.subjectBreakdown.length,
    };

    // 4. Return the ranked list.
    return res.json({
      summary,
      recommendations,
      generatedAt: new Date().toISOString(),

      methodology: {
        type: "rule_based",

        factors: {
          quizPerformance: 40,
          dueReviews: 30,
          plannerPriority: 20,
          weakTopics: 10,
        },

        description:
          "Recommendations combine completed quiz performance, due spaced repetition reviews, existing planner priorities, and topics needing additional practice.",

        limitations: [
          "Recommendations are based on recorded student activity.",
          "The recommendation score is a relative prioritization measure, not a prediction of mastery.",
          "Quiz performance may be affected by repeated questions or limited question-bank coverage.",
          "Existing planner priority factors are reused without modifying the scheduling algorithm.",
        ],
      },
    });
  })
);

export default router;
