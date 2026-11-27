
import { describe, it, expect } from "vitest";

import {
  buildCalendarEvents,
} from "./calendarEvents.js";

const plan = {
  week_start: "2026-11-30",
  version: 1,
};

const mondaySession = {
  id: "session-1",
  subjectId: "subject-1",
  subjectName: "Mathematics",
  weekday: 0,
  startTime: "09:00",
  endTime: "10:30",
  status: "planned",
};

describe("AdaptIQ Calendar Event Builder", () => {
  it("converts Monday sessions correctly", () => {
    const events = buildCalendarEvents({
      plan,
      blocks: [mondaySession],
      timezone: "Asia/Kolkata",
    });

    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2026-11-30");
    expect(events[0].startTime).toBe("09:00");
    expect(events[0].endTime).toBe("10:30");
    expect(events[0].durationMinutes).toBe(90);
  });

  it("calculates Sunday using Monday as day zero", () => {
    const events = buildCalendarEvents({
      plan,
      blocks: [
        {
          ...mondaySession,
          id: "session-2",
          weekday: 6,
        },
      ],
      timezone: "Asia/Kolkata",
    });

    expect(events[0].date).toBe("2026-12-06");
  });

  it("preserves the student's timezone", () => {
    const events = buildCalendarEvents({
      plan,
      blocks: [mondaySession],
      timezone: "Asia/Dubai",
    });

    expect(events[0].timezone).toBe("Asia/Dubai");
    expect(events[0].startTime).toBe("09:00");
  });

  it("sorts events by date and time", () => {
    const events = buildCalendarEvents({
      plan,
      blocks: [
        {
          ...mondaySession,
          id: "session-2",
          weekday: 2,
        },
        {
          ...mondaySession,
          id: "session-3",
          startTime: "08:00",
          endTime: "09:00",
        },
        mondaySession,
      ],
      timezone: "Asia/Kolkata",
    });

    expect(events.map((event) => event.id)).toEqual([
      "session-3",
      "session-1",
      "session-2",
    ]);
  });

  it("rejects an invalid timezone", () => {
    expect(() =>
      buildCalendarEvents({
        plan,
        blocks: [mondaySession],
        timezone: "Invalid/Timezone",
      })
    ).toThrow(/valid timezone/);
  });

  it("rejects an invalid session time", () => {
    expect(() =>
      buildCalendarEvents({
        plan,
        blocks: [
          {
            ...mondaySession,
            endTime: "08:00",
          },
        ],
        timezone: "Asia/Kolkata",
      })
    ).toThrow(/after start time/);
  });

  it("rejects a non-Monday week start", () => {
    expect(() =>
      buildCalendarEvents({
        plan: { week_start: "2026-12-01" },
        blocks: [mondaySession],
        timezone: "Asia/Kolkata",
      })
    ).toThrow(/Monday/);
  });

  it("returns an empty list for a plan with no sessions", () => {
    const events = buildCalendarEvents({
      plan,
      blocks: [],
      timezone: "Asia/Kolkata",
    });

    expect(events).toEqual([]);
  });
});
