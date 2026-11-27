
/**
 * AdaptIQ — Calendar Event Builder
 *
 * Converts a saved weekly study plan into
 * local calendar event descriptors.
 *
 * Important:
 * Study session times are LOCAL clock times.
 * They must not be interpreted as UTC.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidTimezone(timezone) {
  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
    });
    return true;
  } catch {
    return false;
  }
}

function parseWeekStart(value) {
  const dateString = String(value || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error("Invalid study plan week start.");
  }

  const date = new Date(`${dateString}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateString
  ) {
    throw new Error("Invalid study plan week start.");
  }

  // PostgreSQL week_start should always be a Monday.
  if (date.getUTCDay() !== 1) {
    throw new Error(
      "Study plan week start must be a Monday."
    );
  }

  return date;
}

function dateForWeekday(weekStart, weekday) {
  const timestamp =
    weekStart.getTime() + weekday * DAY_MS;

  return new Date(timestamp)
    .toISOString()
    .slice(0, 10);
}

function minutesFromTime(time) {
  if (typeof time !== "string") {
    throw new Error("Invalid study session time.");
  }

  const match = TIME_REGEX.exec(time);

  if (!match) {
    throw new Error(
      "Study session time must use HH:MM."
    );
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

export function buildCalendarEvents({
  plan,
  blocks,
  timezone,
}) {
  if (!plan || typeof plan !== "object") {
    throw new Error("A saved study plan is required.");
  }

  if (!Array.isArray(blocks)) {
    throw new Error(
      "Study sessions must be provided as an array."
    );
  }

  if (
    typeof timezone !== "string" ||
    !isValidTimezone(timezone)
  ) {
    throw new Error("A valid timezone is required.");
  }

  const weekStart = parseWeekStart(
    plan.week_start ?? plan.weekStart
  );

  const events = blocks.map((session) => {
    if (
      !session ||
      !Number.isInteger(Number(session.weekday)) ||
      Number(session.weekday) < 0 ||
      Number(session.weekday) > 6
    ) {
      throw new Error("Invalid session weekday.");
    }

    const weekday = Number(session.weekday);

    const startMinutes = minutesFromTime(
      session.startTime
    );

    const endMinutes = minutesFromTime(
      session.endTime
    );

    if (endMinutes <= startMinutes) {
      throw new Error(
        "Session end time must be after start time."
      );
    }

    if (
      typeof session.subjectName !== "string" ||
      !session.subjectName.trim()
    ) {
      throw new Error(
        "A subject name is required for every event."
      );
    }

    if (
      typeof session.id !== "string" ||
      !session.id.trim()
    ) {
      throw new Error(
        "A session ID is required for every event."
      );
    }

    const date = dateForWeekday(
      weekStart,
      weekday
    );

    return {
      id: session.id,

      subjectId: session.subjectId,

      subjectName: session.subjectName,

      title: `${session.subjectName} — Study Session`,

      date,

      startTime: session.startTime,

      endTime: session.endTime,

      timezone,

      status: session.status || "planned",

      durationMinutes: endMinutes - startMinutes,
    };
  });

  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime) ||
      a.id.localeCompare(b.id)
  );
}
