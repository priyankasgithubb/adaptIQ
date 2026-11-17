
import { useEffect, useMemo, useState } from "react";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed (${response.status})`
    );
  }

  return data;
}

function minutesBetween(block) {
  const [sh, sm] = block.startTime.split(":").map(Number);
  const [eh, em] = block.endTime.split(":").map(Number);

  return Math.max(0, eh * 60 + em - sh * 60 - sm);
}

function formatDuration(minutes) {
  const value = Number(minutes) || 0;
  const hours = Math.floor(value / 60);
  const remaining = value % 60;

  if (!hours) return `${remaining}m`;
  if (!remaining) return `${hours}h`;

  return `${hours}h ${remaining}m`;
}

function formatTime(time) {
  const [hour, minute] = time.split(":").map(Number);

  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${
    hour >= 12 ? "PM" : "AM"
  }`;
}

function StatCard({ label, value, description }) {
  return (
    <div className="rounded-2xl border border-[#E8DED5] bg-white p-5">
      <p className="text-xs text-muted">{label}</p>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-espresso">
        {value}
      </p>

      {description && (
        <p className="mt-2 text-xs leading-5 text-muted">
          {description}
        </p>
      )}
    </div>
  );
}

function RecoverySessions({ blocks }) {
  const sorted = [...blocks].sort(
    (a, b) =>
      Number(a.weekday) - Number(b.weekday) ||
      a.startTime.localeCompare(b.startTime)
  );

  if (!sorted.length) {
    return (
      <p className="rounded-xl bg-[#FCF8F4] p-5 text-sm text-muted">
        No additional recovery sessions could be scheduled.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((block, index) => (
        <div
          key={`${block.subjectId}-${block.weekday}-${block.startTime}-${index}`}
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E9DFD5] bg-white p-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-12 w-1 shrink-0 rounded-full bg-coral" />

            <div>
              <p className="text-sm font-semibold text-espresso">
                {block.subjectName}
              </p>

              <p className="mt-1 text-xs text-muted">
                {DAYS[Number(block.weekday)]}
                {" · "}
                {formatTime(block.startTime)}
                {" – "}
                {formatTime(block.endTime)}
              </p>
            </div>
          </div>

          <span className="rounded-full bg-[#F8E9DF] px-3 py-1.5 text-xs font-semibold text-[#A36752]">
            +{formatDuration(minutesBetween(block))}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdaptiveRecovery({ onBack }) {
  const [currentPlan, setCurrentPlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [preview, setPreview] = useState(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPlan() {
      try {
        const data = await request("/api/plan/current");

        if (!active) return;

        setCurrentPlan(data.plan);
        setSessions(data.blocks || []);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPlan();

    return () => {
      active = false;
    };
  }, []);

  const unfinishedSessions = useMemo(
    () =>
      sessions.filter((session) =>
        ["missed", "partial"].includes(session.status)
      ),
    [sessions]
  );

  const unfinishedMinutes = useMemo(
    () =>
      unfinishedSessions.reduce((total, session) => {
        return (
          total +
          Math.max(
            0,
            minutesBetween(session) -
              Number(session.actualMinutes || 0)
          )
        );
      }, 0),
    [unfinishedSessions]
  );

  const scheduledMinutes = useMemo(
    () =>
      (preview?.blocks || []).reduce(
        (total, block) => total + minutesBetween(block),
        0
      ),
    [preview]
  );

  const unscheduledMinutes = useMemo(
    () =>
      (preview?.remaining || []).reduce(
        (total, item) =>
          total + Number(item.unscheduledMin || 0),
        0
      ),
    [preview]
  );

  async function generatePreview() {
    if (generating || applying) return;

    setGenerating(true);
    setError("");
    setSuccess("");
    setPreview(null);

    try {
      // Reload the active plan before requesting recovery.
      const current = await request("/api/plan/current");

      setCurrentPlan(current.plan);
      setSessions(current.blocks || []);

      const data = await request(
        "/api/plan/reschedule/preview",
        { method: "POST" }
      );

      if (
        !Array.isArray(data.blocks) ||
        !Array.isArray(data.remaining)
      ) {
        throw new Error(
          "The recovery planner returned an invalid response."
        );
      }

      // A recovery preview must never write to PostgreSQL.
      if (data.previewOnly !== true) {
        throw new Error(
          "The server did not confirm preview-only mode."
        );
      }

      setPreview(data);
    } catch (err) {
      setError(
        err.message || "Could not generate recovery preview."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function applyRecovery() {
    if (
      applying ||
      generating ||
      !preview ||
      preview.previewOnly !== true ||
      !preview.planId ||
      !preview.snapshot ||
      !preview.blocks?.length
    ) {
      return;
    }

    setApplying(true);
    setError("");
    setSuccess("");

    try {
      const result = await request(
        "/api/plan/reschedule/apply",
        {
          method: "POST",
          body: JSON.stringify({
            preview: {
              planId: preview.planId,
              version: preview.version,
              snapshot: preview.snapshot,
              blocks: preview.blocks,
              remaining: preview.remaining,
            },
          }),
        }
      );

      // Prevent the same preview from being applied twice.
      setPreview(null);

      const message = result.partialRecovery
        ? `Recovery saved. ${formatDuration(
            result.unscheduledMinutes
          )} still couldn't fit into this week.`
        : "Your recovery timetable has been saved successfully.";

      setSuccess(message);

      // Reload the active timetable from PostgreSQL.
      try {
        const current = await request("/api/plan/current");

        setCurrentPlan(current.plan);
        setSessions(current.blocks || []);
      } catch {
        setSuccess(
          `${message} Return to Overview and refresh to see the latest timetable.`
        );
      }
    } catch (err) {
      setError(err.message || "Could not apply recovery.");

      // The old preview may no longer be valid.
      setPreview(null);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream px-5 py-8 text-espresso sm:px-10">
      <main className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-2xl font-bold tracking-[-0.06em]">
            adapt<span className="text-coral">IQ</span>
          </div>

          <button
            type="button"
            onClick={onBack}
            disabled={applying}
            className="rounded-xl border border-[#DED5CD] bg-white px-5 py-3 text-sm font-semibold transition hover:bg-sand disabled:opacity-50"
          >
            Back to overview
          </button>
        </div>

        <div className="mt-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47763]">
            ADAPTIVE STUDY PLANNING
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Get back{" "}
            <span className="font-serif italic text-[#C77761]">
              on track.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">
            Missed a session or couldn't finish studying?
            AdaptIQ can find new study windows for unfinished
            work while considering your subject priorities
            and remaining availability this week.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mt-7 rounded-xl border border-[#D0E7D6] bg-[#EFF8F0] p-4 text-sm text-[#3F7654]"
          >
            {success}
          </div>
        )}

        {loading ? (
          <p
            role="status"
            className="mt-10 text-sm text-muted"
          >
            Loading your study progress...
          </p>
        ) : (
          <>
            <section className="mt-9 grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Current timetable"
                value={
                  currentPlan
                    ? `Version ${currentPlan.version}`
                    : "—"
                }
                description="Your active weekly study plan"
              />

              <StatCard
                label="Unfinished sessions"
                value={unfinishedSessions.length}
                description="Missed or partially completed"
              />

              <StatCard
                label="Unfinished study time"
                value={formatDuration(unfinishedMinutes)}
                description="From sessions in the active plan; excludes earlier backlog"
              />
            </section>

            <section className="mt-8 rounded-[22px] bg-espresso p-7 text-white sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D4A99A]">
                RECOVERY PLANNER
              </p>

              <h2 className="mt-3 text-2xl font-semibold">
                Find time for unfinished work.
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#D0BCB1]">
                AdaptIQ checks your missed sessions, partial
                progress, previously saved recovery backlog,
                and remaining free study windows.
                Previewing does not change your active plan.
              </p>

              <button
                type="button"
                onClick={generatePreview}
                disabled={generating || applying || !currentPlan}
                className="mt-7 rounded-xl bg-coral px-6 py-3.5 text-sm font-semibold text-espresso transition hover:bg-[#F1A18D] disabled:opacity-50"
              >
                {generating
                  ? "Finding recovery sessions..."
                  : preview
                    ? "Generate another preview"
                    : "Preview recovery plan"}
              </button>
            </section>

            {preview && (
              <div className="mt-8 space-y-8">
                <div className="rounded-2xl border border-[#E9D5C2] bg-[#FFF5E9] p-5">
                  <h2 className="text-sm font-semibold">
                    Preview only — your current plan is unchanged
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-muted">
                    {preview.message}
                  </p>
                </div>

                <section className="grid gap-4 sm:grid-cols-3">
                  <StatCard
                    label="Additional study time"
                    value={formatDuration(scheduledMinutes)}
                    description="Recovery time the planner found"
                  />

                  <StatCard
                    label="Still unscheduled"
                    value={formatDuration(unscheduledMinutes)}
                    description="Unfinished time that could not fit"
                  />

                  <StatCard
                    label="Recovery sessions"
                    value={preview.blocks.length}
                    description="Proposed new study sessions"
                  />
                </section>

                <section className="rounded-[22px] border border-[#E8DED5] bg-white p-6 sm:p-8">
                  <h2 className="text-xl font-semibold">
                    Proposed recovery sessions
                  </h2>

                  <p className="mt-2 mb-6 text-sm text-muted">
                    These sessions would be added to your
                    existing weekly timetable.
                  </p>

                  <RecoverySessions blocks={preview.blocks} />
                </section>

                {preview.remaining.length > 0 && (
                  <section className="rounded-[22px] border border-[#E8DED5] bg-white p-6 sm:p-8">
                    <h2 className="text-xl font-semibold">
                      Recovery by subject
                    </h2>

                    <div className="mt-5 space-y-3">
                      {preview.remaining.map((item) => (
                        <div
                          key={item.subjectId}
                          className="rounded-xl border border-[#EEE5DD] bg-[#FCFAF8] p-4"
                        >
                          <p className="text-sm font-semibold">
                            {item.subjectName}
                          </p>

                          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                            <div>
                              <p className="text-muted">
                                Needed
                              </p>

                              <p className="mt-1 font-semibold">
                                {formatDuration(
                                  item.requestedMin
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-muted">
                                Scheduled
                              </p>

                              <p className="mt-1 font-semibold">
                                {formatDuration(
                                  item.scheduledMin
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-muted">
                                Remaining
                              </p>

                              <p className="mt-1 font-semibold">
                                {formatDuration(
                                  item.unscheduledMin
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="rounded-2xl border border-[#E8DED5] bg-white p-6">
                  <h2 className="text-sm font-semibold">
                    Apply recovery plan
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-muted">
                    Review the proposed sessions before
                    approving. AdaptIQ will verify that your
                    timetable and recorded progress haven't
                    changed since the preview. Your previous
                    timetable will remain archived as
                    historical data.
                  </p>

                  <button
                    type="button"
                    onClick={applyRecovery}
                    disabled={
                      applying ||
                      generating ||
                      !preview?.snapshot ||
                      !preview?.blocks?.length
                    }
                    className="mt-5 rounded-xl bg-espresso px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#48362F] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {applying
                      ? "Applying recovery..."
                      : "Approve and apply recovery"}
                  </button>
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
