
import { describe, it, expect } from "vitest";

import {
  generateCalendarIcs,
  localTimeToUtc,
} from "./calendarExport.js";

const plan = {
  week_start: "2026-11-30",
  version: 1,
};

const blocks = [
  {
    id: "session-1",
    subjectId: "subject-1",
    subjectName: "Mathematics",
    weekday: 0,
    startTime: "09:00",
    endTime: "10:30",
    status: "planned",
  },
];

describe("AdaptIQ Calendar Export", () => {
  it("generates a valid calendar structure", () => {
    const ics = generateCalendarIcs({
      plan,
      blocks,
      timezone: "Asia/Kolkata",
      generatedAt: "2026-11-27T10:00:00Z",
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("converts Indian local time to UTC", () => {
    const ics = generateCalendarIcs({
      plan,
      blocks,
      timezone: "Asia/Kolkata",
    });

    expect(ics).toContain(
      "DTSTART:20261130T033000Z"
    );

    expect(ics).toContain(
      "DTEND:20261130T050000Z"
    );
  });

  it("converts Dubai local time to UTC", () => {
    const result = localTimeToUtc(
      "2026-11-30",
      "09:00",
      "Asia/Dubai"
    );

    expect(result.toISOString()).toBe(
      "2026-11-30T05:00:00.000Z"
    );
  });

  it("handles daylight-saving time", () => {
    const result = localTimeToUtc(
      "2026-07-06",
      "09:00",
      "America/New_York"
    );

    expect(result.toISOString()).toBe(
      "2026-07-06T13:00:00.000Z"
    );
  });

  it("rejects nonexistent spring-forward times", () => {
    expect(() =>
      localTimeToUtc(
        "2026-03-08",
        "02:30",
        "America/New_York"
      )
    ).toThrow(/does not exist/);
  });

  it("uses the earlier occurrence of ambiguous times", () => {
    const result = localTimeToUtc(
      "2026-11-01",
      "01:30",
      "America/New_York"
    );

    expect(result.toISOString()).toBe(
      "2026-11-01T05:30:00.000Z"
    );
  });

  it("escapes special characters in event titles", () => {
    const ics = generateCalendarIcs({
      plan,
      blocks: [
        {
          ...blocks[0],
          subjectName: "Math, Logic; Algorithms",
        },
      ],
      timezone: "UTC",
    });

    expect(ics).toContain(
      "SUMMARY:Math\\, Logic\\; Algorithms"
    );
  });

  it("generates no events for an empty timetable", () => {
    const ics = generateCalendarIcs({
      plan,
      blocks: [],
      timezone: "UTC",
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
