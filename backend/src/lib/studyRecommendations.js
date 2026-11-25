
/**
 * AdaptIQ — Personalized Study Recommendations
 *
 * Rule-based recommendation engine.
 *
 * This module is independent of Express,
 * PostgreSQL, and the frontend.
 */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function generateStudyRecommendations({
  subjectBreakdown = [],
  topicBreakdown = [],
  dueCards = [],
  subjectPriorities = [],
}) {
  const recommendations = [];

  const priorities = new Map(
    subjectPriorities.map((item) => [
      item.subjectId,
      clamp(Number(item.priorityScore) || 0, 0, 100),
    ])
  );

  const reviewsBySubject = new Map();

  for (const card of dueCards) {
    if (!card?.subjectId) continue;

    const count =
      reviewsBySubject.get(card.subjectId) || 0;

    reviewsBySubject.set(card.subjectId, count + 1);
  }

  const topicsBySubject = new Map();

  for (const topic of topicBreakdown) {
    if (!topic?.subjectId) continue;

    const existing =
      topicsBySubject.get(topic.subjectId) || [];

    existing.push(topic);
    topicsBySubject.set(topic.subjectId, existing);
  }

  const allSubjectIds = new Set([
    ...subjectBreakdown.map((item) => item.subjectId),
    ...reviewsBySubject.keys(),
    ...priorities.keys(),
  ]);

  for (const subjectId of allSubjectIds) {
    if (!subjectId) continue;

    const subject = subjectBreakdown.find(
      (item) => item.subjectId === subjectId
    );

    const dueCount =
      reviewsBySubject.get(subjectId) || 0;

    const topics =
      topicsBySubject.get(subjectId) || [];

    const weakTopics = topics
      .filter(
        (topic) =>
          topic.performanceLevel === "needs_practice"
      )
      .sort(
        (a, b) =>
          Number(a.accuracyPercent) -
          Number(b.accuracyPercent)
      );

    const answeredQuestions =
      Number(subject?.answeredQuestions) || 0;

    const accuracy =
      clamp(Number(subject?.accuracyPercent) || 0, 0, 100);

    const priorityScore =
      priorities.get(subjectId) || 0;

    // Quiz performance contributes up to 40 points.
    // No quiz evidence contributes zero, not 40.
    const quizWeight =
      answeredQuestions > 0
        ? ((100 - accuracy) / 100) * 40
        : 0;

    // Due reviews contribute up to 30 points.
    const reviewWeight = Math.min(dueCount * 10, 30);

    // Existing planner priority contributes up to 20.
    const plannerWeight = priorityScore * 0.2;

    // Weak topics contribute up to 10.
    const topicWeight = Math.min(
      weakTopics.length * 5,
      10
    );

    const recommendationScore = Math.round(
      quizWeight +
        reviewWeight +
        plannerWeight +
        topicWeight
    );

    const reasons = [];

    if (answeredQuestions > 0 && accuracy < 50) {
      reasons.push(
        `Quiz accuracy is ${Math.round(accuracy)}%, suggesting this subject needs more practice.`
      );
    } else if (
      answeredQuestions > 0 &&
      accuracy < 80
    ) {
      reasons.push(
        `Quiz accuracy is ${Math.round(accuracy)}%, leaving room for improvement.`
      );
    }

    if (dueCount > 0) {
      reasons.push(
        `${dueCount} spaced repetition ${
          dueCount === 1 ? "topic is" : "topics are"
        } due for review.`
      );
    }

    if (weakTopics.length > 0) {
      reasons.push(
        `Focus on ${weakTopics
          .slice(0, 3)
          .map((topic) => topic.topic)
          .join(", ")}.`
      );
    }

    if (priorityScore >= 70) {
      reasons.push(
        "This subject has a high priority in your study planner."
      );
    }

    if (reasons.length === 0) {
      continue;
    }

    let urgency = "low";

    if (recommendationScore >= 60) {
      urgency = "high";
    } else if (recommendationScore >= 30) {
      urgency = "medium";
    }

    recommendations.push({
      subjectId,
      subjectName:
        subject?.subjectName ||
        topics[0]?.subjectName ||
        dueCards.find(
          (card) => card.subjectId === subjectId
        )?.subjectName ||
        "Subject",
      recommendationScore,
      urgency,
      quizAccuracy:
        answeredQuestions > 0 ? accuracy : null,
      dueReviews: dueCount,
      weakTopics: weakTopics
        .slice(0, 5)
        .map((topic) => topic.topic),
      reasons,
    });
  }

  return recommendations.sort(
    (a, b) =>
      b.recommendationScore -
        a.recommendationScore ||
      a.subjectName.localeCompare(b.subjectName)
  );
}

