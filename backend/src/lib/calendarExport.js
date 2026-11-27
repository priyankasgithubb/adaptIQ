
import { buildCalendarEvents } from "./calendarEvents.js";

/**
 * AdaptIQ — iCalendar (.ics) Export
 *
 * Produces RFC 5545-style calendar data.
 * Local study-session times are converted to UTC
 * using the student's configured IANA timezone.
 */

function timezoneFormatter(timezone) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function localParts(timestamp, formatter) {
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function utcOffsetAt(timestamp, formatter) {
  const p = localParts(timestamp, formatter);

  const wallTimeAsUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second
  );

  return wallTimeAsUtc - timestamp;
}

/**
 * Find the UTC instant matching a local clock time.
 *
 * If a daylight-saving transition makes the time
 * ambiguous, choose the earlier occurrence.
 *
 * If the local time does not exist (spring-forward
 * gap), reject it rather than exporting an event
 * at an incorrect time.
 */
export function localTimeToUtc(date, time, timezone) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    typeof time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    throw new Error("Invalid local calendar date or time.");
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  const nominalUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    0
  );

  const nominalDate = new Date(nominalUtc);

  if (
    nominalDate.getUTCFullYear() !== year ||
    nominalDate.getUTCMonth() !== month - 1 ||
    nominalDate.getUTCDate() !== day
  ) {
    throw new Error("Invalid calendar date.");
  }

  const formatter = timezoneFormatter(timezone);

  // Check offsets on both sides of a possible
  // daylight-saving transition.
  const sampleTimes = [
    nominalUtc - 36 * 60 * 60 * 1000,
    nominalUtc,
    nominalUtc + 36 * 60 * 60 * 1000,
  ];

  const offsets = new Set(
    sampleTimes.map((timestamp) =>
      utcOffsetAt(timestamp, formatter)
    )
  );

  const matches = [];

  for (const offset of offsets) {
    const candidate = nominalUtc - offset;
    const p = localParts(candidate, formatter);

    if (
      p.year === year &&
      p.month === month &&
      p.day === day &&
      p.hour === hour &&
      p.minute === minute &&
      p.second === 0
    ) {
      matches.push(candidate);
    }
  }

  if (matches.length === 0) {
    throw new Error(
      `Local time ${date} ${time} does not exist in ${timezone}.`
    );
  }

  return new Date(Math.min(...matches));
}

function formatUtc(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/**
 * Fold content lines at 75 UTF-8 octets.
 * Continuation lines begin with one space.
 */
function foldLine(line) {
  const output = [];
  let current = "";
  let bytes = 0;

  for (const character of line) {
    const length = Buffer.byteLength(
      character,
      "utf8"
    );

    if (bytes + length > 75) {
      output.push(current);
      current = " ";
      bytes = 1;
    }

    current += character;
    bytes += length;
  }

  output.push(current);

  return output.join("\r\n");
}

export function generateCalendarIcs({
  plan,
  blocks,
  timezone,
  generatedAt = new Date(),
}) {
  const events = buildCalendarEvents({
    plan,
    blocks,
    timezone,
  });

  const stamp = formatUtc(new Date(generatedAt));

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AdaptIQ//Study Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:AdaptIQ Study Plan",
  ];

  for (const event of events) {
    const start = localTimeToUtc(
      event.date,
      event.startTime,
      timezone
    );

    const end = localTimeToUtc(
      event.date,
      event.endTime,
      timezone
    );

    if (end <= start) {
      throw new Error(
        `Invalid calendar interval for ${event.subjectName}.`
      );
    }

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@adaptiq.study`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatUtc(start)}`,
      `DTEND:${formatUtc(end)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(
        `AdaptIQ study session\nSubject: ${event.subjectName}\nStatus: ${event.status}`
      )}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  return (
    lines.map(foldLine).join("\r\n") + "\r\n"
  );
}
