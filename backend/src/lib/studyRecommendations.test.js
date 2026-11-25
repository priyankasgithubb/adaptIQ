
import { describe, it, expect } from "vitest";

import {
  generateStudyRecommendations,
} from "./studyRecommendations.js";

describe("AdaptIQ Study Recommendations", () => {
  it("prioritizes a struggling subject", () => {
    const result = generateStudyRecommendations({
      subjectBreakdown: [
        {
          subjectId: "math",
          subjectName: "Mathematics",
          accuracyPercent: 40,
          answeredQuestions: 10,
        },
        {
          subjectId: "cs",
          subjectName: "Computer Science",
          accuracyPercent: 90,
          answeredQuestions: 10,
        },
      ],
      dueCards: [
        {
          subjectId: "math",
          subjectName: "Mathematics",
        },
        {
          subjectId: "math",
          subjectName: "Mathematics",
        },
      ],
    });

    expect(result[0].subjectName).toBe("Mathematics");
    expect(result[0].dueReviews).toBe(2);
  });

  it("identifies topics needing practice", () => {
    const result = generateStudyRecommendations({
      subjectBreakdown: [
        {
          subjectId: "math",
          subjectName: "Mathematics",
          accuracyPercent: 40,
          answeredQuestions: 5,
        },
      ],
      topicBreakdown: [
        {
          subjectId: "math",
          subjectName: "Mathematics",
          topic: "Algebra",
          accuracyPercent: 30,
          performanceLevel: "needs_practice",
        },
      ],
    });

    expect(result[0].weakTopics).toContain("Algebra");
  });

  it("includes subjects with due reviews but no quizzes", () => {
    const result = generateStudyRecommendations({
      dueCards: [
        {
          subjectId: "physics",
          subjectName: "Physics",
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].dueReviews).toBe(1);
    expect(result[0].quizAccuracy).toBeNull();
  });

  it("does not treat missing quiz scores as poor performance", () => {
    const result = generateStudyRecommendations({
      subjectBreakdown: [
        {
          subjectId: "math",
          subjectName: "Mathematics",
          answeredQuestions: 0,
          accuracyPercent: 0,
        },
      ],
    });

    expect(result).toHaveLength(0);
  });

  it("returns no recommendations when no evidence exists", () => {
    const result = generateStudyRecommendations({});

    expect(result).toEqual([]);
  });

  it("ranks high-priority subjects appropriately", () => {
    const result = generateStudyRecommendations({
      subjectPriorities: [
        {
          subjectId: "math",
          priorityScore: 95,
        },
        {
          subjectId: "physics",
          priorityScore: 75,
        },
      ],
    });

    expect(result[0].subjectId).toBe("math");
  });
});
