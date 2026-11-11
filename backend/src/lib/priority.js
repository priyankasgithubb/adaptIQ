// Starting weights from the blueprint. Tune them later if the ranking feels wrong.
export const WEIGHTS = {
  learningGap: 0.35,
  examUrgency: 0.25,
  assessmentImportance: 0.2,
  unfinishedBacklog: 0.1,
  revisionDue: 0.1,
};

const DAY_MS = 86400000;
const URGENCY_WINDOW_DAYS = 30; // exams further away than this add no urgency

const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Urgency rises as the exam gets closer. It's zero if the exam is 30+ days away.
function examUrgency(subjectId, exams, now) {
  const next = exams
    .filter((e) => e.subjectId === subjectId && e.examAt > now)
    .sort((a, b) => a.examAt - b.examAt)[0];
  if (!next) return 0;

  const daysLeft = (next.examAt - now) / DAY_MS;
  const closeness = 1 - Math.min(daysLeft, URGENCY_WINDOW_DAYS) / URGENCY_WINDOW_DAYS;
  return clamp01(closeness * next.importance);
}

// subjects: [{ id, name, weight, averagePercent }]
// exams:    [{ subjectId, examAt (Date), importance }]
export function calculatePriorities(subjects, exams, now = new Date()) {
  const ranked = subjects.map((s) => {
    const factors = {
      // No marks yet = assume a middle gap of 0.5
      learningGap: s.averagePercent === null ? 0.5 : clamp01(1 - s.averagePercent / 100),
      examUrgency: examUrgency(s.id, exams, now),
      assessmentImportance: clamp01(s.weight / 10),
      unfinishedBacklog: 0, // placeholder until study sessions are logged
      revisionDue: 0, // placeholder until study sessions are logged
    };

    // Each factor's share of the final score, used to explain the ranking.
    const contributions = Object.fromEntries(
      Object.entries(WEIGHTS).map(([key, weight]) => [key, weight * factors[key]])
    );
    const score = Object.values(contributions).reduce((sum, c) => sum + c, 0);
    const mainReason = Object.entries(contributions).sort((a, b) => b[1] - a[1])[0][0];

    return {
      subjectId: s.id,
      name: s.name,
      score: Math.round(score * 1000) / 1000,
      mainReason,
      factors,
    };
  });

  return ranked.sort((a, b) => b.score - a.score);
}