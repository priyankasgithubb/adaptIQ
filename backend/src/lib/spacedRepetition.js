
/**
 * AdaptIQ Spaced Repetition Scheduler
 *
 * SM-2-inspired review scheduling.
 *
 * Quality:
 * 0 = Complete blackout
 * 1 = Incorrect
 * 2 = Difficult recall
 * 3 = Correct with difficulty
 * 4 = Correct
 * 5 = Perfect recall
 */

const MIN_EASE = 1.3;
const MAX_EASE = 5.0;
const DEFAULT_EASE = 2.5;

const MAX_INTERVAL_DAYS = 3650;

export function calculateNextReview({
  quality,
  easeFactor = DEFAULT_EASE,
  intervalDays = 0,
  repetitions = 0,
  lapses = 0,
  reviewedAt = new Date(),
}) {
  // Validate the recall rating.
  if (
    !Number.isInteger(quality) ||
    quality < 0 ||
    quality > 5
  ) {
    throw new Error(
      "Quality must be an integer between 0 and 5."
    );
  }

  // Validate existing scheduling values.
  const ease = Number(easeFactor);

  if (
    !Number.isFinite(ease) ||
    ease < MIN_EASE ||
    ease > MAX_EASE
  ) {
    throw new Error(
      "Ease factor must be between 1.30 and 5.00."
    );
  }

  if (
    !Number.isSafeInteger(intervalDays) ||
    intervalDays < 0 ||
    !Number.isSafeInteger(repetitions) ||
    repetitions < 0 ||
    !Number.isSafeInteger(lapses) ||
    lapses < 0
  ) {
    throw new Error(
      "Invalid review scheduling values."
    );
  }

  const reviewDate = new Date(reviewedAt);

  if (Number.isNaN(reviewDate.getTime())) {
    throw new Error("Invalid review date.");
  }

  // Standard SM-2 ease adjustment.
  const adjustment =
    0.1 -
    (5 - quality) *
      (0.08 + (5 - quality) * 0.02);

  const nextEaseFactor = Math.min(
    MAX_EASE,
    Math.max(
      MIN_EASE,
      Math.round((ease + adjustment) * 100) / 100
    )
  );

  let nextRepetitions = repetitions;
  let nextIntervalDays = intervalDays;
  let nextLapses = lapses;

  if (quality < 3) {
    // Failed recall: restart the review cycle.
    nextRepetitions = 0;
    nextIntervalDays = 1;
    nextLapses += 1;
  } else {
    // Successful recall.
    nextRepetitions += 1;

    if (nextRepetitions === 1) {
      nextIntervalDays = 1;
    } else if (nextRepetitions === 2) {
      nextIntervalDays = 6;
    } else {
      nextIntervalDays = Math.max(
        1,
        Math.round(intervalDays * nextEaseFactor)
      );
    }
  }

  // Prevent unreasonably distant review dates.
  nextIntervalDays = Math.min(
    MAX_INTERVAL_DAYS,
    nextIntervalDays
  );

  // Calculate review date using UTC to avoid
  // daylight-saving issues.
  const nextReviewAt = new Date(
    reviewDate.getTime() +
      nextIntervalDays * 24 * 60 * 60 * 1000
  );

  return {
    quality,
    easeFactor: nextEaseFactor,
    intervalDays: nextIntervalDays,
    repetitions: nextRepetitions,
    lapses: nextLapses,
    reviewedAt: reviewDate.toISOString(),
    nextReviewAt: nextReviewAt.toISOString(),
  };
}
