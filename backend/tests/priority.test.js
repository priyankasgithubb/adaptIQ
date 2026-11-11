import { describe, it, expect } from "vitest";
import { calculatePriorities } from "../src/lib/priority.js";

const now = new Date("2026-11-10T00:00:00Z");

describe("calculatePriorities", () => {
  it("ranks a weak subject with a near exam above a strong one", () => {
    const subjects = [
      { id: "math", name: "Mathematics", weight: 2, averagePercent: 40 },
      { id: "dbms", name: "DBMS", weight: 2, averagePercent: 90 },
    ];
    const exams = [{ subjectId: "math", examAt: new Date("2026-11-20T00:00:00Z"), importance: 1 }];

    const result = calculatePriorities(subjects, exams, now);
    expect(result[0].name).toBe("Mathematics");
  });

  it("uses a middle learning gap when a subject has no marks", () => {
    const result = calculatePriorities(
      [{ id: "x", name: "X", weight: 1, averagePercent: null }],
      [],
      now
    );
    expect(result[0].factors.learningGap).toBe(0.5);
  });

  it("ignores exams that have already passed", () => {
    const result = calculatePriorities(
      [{ id: "x", name: "X", weight: 1, averagePercent: 50 }],
      [{ subjectId: "x", examAt: new Date("2026-11-01T00:00:00Z"), importance: 1 }],
      now
    );
    expect(result[0].factors.examUrgency).toBe(0);
  });

  it("keeps every score between 0 and 1", () => {
    const result = calculatePriorities(
      [{ id: "x", name: "X", weight: 99, averagePercent: 0 }],
      [{ subjectId: "x", examAt: new Date("2026-11-11T00:00:00Z"), importance: 1 }],
      now
    );
    expect(result[0].score).toBeGreaterThanOrEqual(0);
    expect(result[0].score).toBeLessThanOrEqual(1);
  });
});