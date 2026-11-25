
import { describe, it, expect } from "vitest";

import {
  calculateNextReview,
} from "./spacedRepetition.js";

const reviewDate = "2026-11-25T10:00:00.000Z";

describe("AdaptIQ Spaced Repetition Scheduler", () => {
  it("schedules 1 day after the first successful review", () => {
    const result = calculateNextReview({
      quality: 4,
      reviewedAt: reviewDate,
    });

    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(1);
    expect(result.lapses).toBe(0);
  });

  it("schedules 6 days after the second successful review", () => {
    const result = calculateNextReview({
      quality: 4,
      intervalDays: 1,
      repetitions: 1,
      reviewedAt: reviewDate,
    });

    expect(result.intervalDays).toBe(6);
    expect(result.repetitions).toBe(2);
  });

  it("increases the interval after the third successful review", () => {
    const result = calculateNextReview({
      quality: 4,
      easeFactor: 2.5,
      intervalDays: 6,
      repetitions: 2,
      reviewedAt: reviewDate,
    });

    expect(result.intervalDays).toBe(15);
    expect(result.repetitions).toBe(3);
  });

  it("restarts scheduling after a failed review", () => {
    const result = calculateNextReview({
      quality: 1,
      easeFactor: 2.5,
      intervalDays: 15,
      repetitions: 3,
      lapses: 0,
      reviewedAt: reviewDate,
    });

    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.lapses).toBe(1);
  });

  it("never reduces the ease factor below 1.30", () => {
    const result = calculateNextReview({
      quality: 0,
      easeFactor: 1.3,
      reviewedAt: reviewDate,
    });

    expect(result.easeFactor).toBe(1.3);
  });

  it("calculates the next review date correctly", () => {
    const result = calculateNextReview({
      quality: 4,
      reviewedAt: reviewDate,
    });

    expect(result.nextReviewAt).toBe(
      "2026-11-26T10:00:00.000Z"
    );
  });

  it("rejects an invalid quality rating", () => {
    expect(() =>
      calculateNextReview({
        quality: 7,
        reviewedAt: reviewDate,
      })
    ).toThrow(/Quality must be/);
  });
});
