
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

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function duration(block) {
  return Math.max(
    0,
    toMinutes(block.endTime) - toMinutes(block.startTime)
  );
}

function totalMinutes(blocks) {
  return blocks.reduce(
    (total, block) => total + duration(block),
    0
  );
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (!hours) return `${remainder}m`;
  if (!remainder) return `${hours}h`;

  return `${hours}h ${remainder}m`;
}

function formatTime(time) {
  const [hours, minutes] = time.split(":").map(Number);

  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${
    hours >= 12 ? "PM" : "AM"
  }`;
}

function Timetable({ title, blocks, description }) {
  return (
    <section className="rounded-[22px] border border-[#E8DED5] bg-white p-5 sm:p-7">
      <h2 className="text-xl font-semibold text-espresso">
        {title}
      </h2>

      <p className="mt-2 text-xs leading-5 text-muted">
        {description}
      </p>

      <div className="mt-6 space-y-4">
        {DAYS.map((day, index) => {
          const dayBlocks = blocks
            .filter(
              (block) => Number(block.weekday) === index
            )
            .sort((a, b) =>
              a.startTime.localeCompare(b.startTime)
            );

          return (
            <div
              key={day}
              className="rounded-xl border border-[#EEE5DD] bg-[#FCFAF8] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-espresso">
                  {day}
                </h3>

                <span className="text-xs text-muted">
                  {dayBlocks.length} sessions
                </span>
              </div>

              {dayBlocks.length === 0 ? (
                <p className="py-3 text-xs text-[#A99A90]">
                  No study sessions
                </p>
              ) : (
                <div className="space-y-2">
                  {dayBlocks.map((block, blockIndex) => (
                    <div
                      key={
                        block.id ||
                        `${index}-${blockIndex}`
                      }
                      className="rounded-xl border border-[#EAD8CB] bg-white p-3.5"
                    >
                      <div className="mb-2 h-1 w-7 rounded-full bg-coral" />

                      <p className="text-sm font-semibold text-espresso">
                        {block.subjectName}
                      </p>

                      <p className="mt-1 text-xs text-muted">
                        {formatTime(block.startTime)}
                        {" – "}
                        {formatTime(block.endTime)}
                      </p>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-[#A76C59]">
                          {formatDuration(duration(block))}
                        </span>

                        {block.status && (
                          <span className="text-xs capitalize text-muted">
                            {block.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function PlanRegeneration({ onBack }) {
  const [currentPlan, setCurrentPlan] = useState(null);
  const [currentBlocks, setCurrentBlocks] = useState([]);
  const [proposedBlocks, setProposedBlocks] = useState(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCurrent() {
      try {
        const data = await request("/api/plan/current");

        if (!active) return;

        setCurrentPlan(data.plan);
        setCurrentBlocks(data.blocks || []);
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCurrent();

    return () => {
      active = false;
    };
  }, []);

  const progressCount = useMemo(
    () =>
      currentBlocks.filter(
        (block) => block.status !== "planned"
      ).length,
    [currentBlocks]
  );

  async function generatePreview() {
    if (generating || saving) return;

    setGenerating(true);
    setError("");
    setSuccess("");
    setProposedBlocks(null);

    try {
      // Refresh the active plan before generating a preview.
      const current = await request("/api/plan/current");

      setCurrentPlan(current.plan);
      setCurrentBlocks(current.blocks || []);

      // Generate a proposed timetable without saving it.
      const data = await request("/api/plan");

      if (!Array.isArray(data.blocks)) {
        throw new Error(
          "The planner returned an invalid timetable."
        );
      }

      if (!data.blocks.length) {
        throw new Error(
          "No study sessions could be scheduled with the current availability."
        );
      }

      setProposedBlocks(data.blocks);
    } catch (err) {
      setError(
        err.message || "Could not generate a timetable."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function approvePreview() {
    if (
      saving ||
      generating ||
      !proposedBlocks ||
      !currentPlan?.id
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const data = await request(
        "/api/plan/regenerate/approve",
        {
          method: "POST",
          body: JSON.stringify({
            expectedPlanId: currentPlan.id,
            previewBlocks: proposedBlocks,
          }),
        }
      );

      // Approval succeeded. Refresh the actual saved
      // timetable from PostgreSQL.
      setProposedBlocks(null);

      try {
        const latest = await request("/api/plan/current");

        setCurrentPlan(latest.plan);
        setCurrentBlocks(latest.blocks || []);

        setSuccess(
          data.message ||
            "Your updated timetable has been saved successfully. Your recorded progress has been protected."
        );
      } catch {
        setCurrentPlan(null);
        setCurrentBlocks([]);

        setSuccess(
          "Your timetable was approved and saved, but the latest version could not be loaded. Return to Overview and refresh."
        );
      }
    } catch (err) {
      setError(
        err.message || "Could not save the timetable."
      );
    } finally {
      setSaving(false);
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
            disabled={saving}
            className="rounded-xl border border-[#DED5CD] bg-white px-5 py-3 text-sm font-semibold transition hover:bg-sand disabled:opacity-50"
          >
            Back to overview
          </button>
        </div>

        <div className="mt-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47763]">
            STUDY PLAN MANAGEMENT
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Rethink your{" "}
            <span className="font-serif italic text-[#C77761]">
              week.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">
            Changed your subjects, schedule, or study
            preferences? Preview an updated timetable
            before replacing the one you've already saved.
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
            Loading your current timetable...
          </p>
        ) : (
          <>
            {currentPlan && (
              <div className="mt-9 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#E8DED5] bg-white p-5">
                  <p className="text-xs text-muted">
                    Current plan
                  </p>

                  <p className="mt-2 text-2xl font-semibold">
                    Version {currentPlan.version}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E8DED5] bg-white p-5">
                  <p className="text-xs text-muted">
                    Scheduled study time
                  </p>

                  <p className="mt-2 text-2xl font-semibold">
                    {formatDuration(
                      totalMinutes(currentBlocks)
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E8DED5] bg-white p-5">
                  <p className="text-xs text-muted">
                    Sessions with recorded status
                  </p>

                  <p className="mt-2 text-2xl font-semibold">
                    {progressCount}
                  </p>
                </div>
              </div>
            )}

            <section className="mt-8 rounded-[22px] bg-espresso p-7 text-white sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D4A99A]">
                GENERATE A PREVIEW
              </p>

              <h2 className="mt-3 text-2xl font-semibold">
                See what your updated week could look like.
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#D0BCB1]">
                AdaptIQ will use your latest saved subjects,
                free study windows, and study preferences.
                Previewing won't overwrite your current plan.
              </p>

              <button
                type="button"
                onClick={generatePreview}
                disabled={generating || saving}
                className="mt-7 rounded-xl bg-coral px-6 py-3.5 text-sm font-semibold text-espresso transition hover:bg-[#F1A18D] disabled:opacity-50"
              >
                {generating
                  ? "Generating preview..."
                  : proposedBlocks
                    ? "Generate another preview"
                    : "Preview updated timetable"}
              </button>
            </section>

            {proposedBlocks && (
              <>
                <div className="mt-8 rounded-2xl border border-[#E9D5C2] bg-[#FFF5E9] p-5">
                  <h3 className="text-sm font-semibold">
                    Preview only — no changes saved
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-muted">
                    Review the proposed timetable before
                    approving it. AdaptIQ will protect
                    previously recorded progress and reject
                    changes that cannot be safely applied.
                  </p>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-white p-5">
                    <p className="text-xs text-muted">
                      Current scheduled time
                    </p>

                    <p className="mt-2 text-2xl font-semibold">
                      {formatDuration(
                        totalMinutes(currentBlocks)
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-5">
                    <p className="text-xs text-muted">
                      Proposed scheduled time
                    </p>

                    <p className="mt-2 text-2xl font-semibold">
                      {formatDuration(
                        totalMinutes(proposedBlocks)
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-7 grid gap-6 lg:grid-cols-2">
                  <Timetable
                    title="Current timetable"
                    description="The version currently saved in PostgreSQL."
                    blocks={currentBlocks}
                  />

                  <Timetable
                    title="Proposed timetable"
                    description="Generated from your latest settings. Not saved."
                    blocks={proposedBlocks}
                  />
                </div>

                <div className="mt-8 rounded-2xl border border-[#E8DED5] bg-white p-6">
                  <p className="text-sm font-semibold">
                    Approval and saving
                  </p>

                  <p className="mt-2 text-sm leading-6 text-muted">
                    Your existing plan will be archived and
                    the approved timetable will become
                    active. Recorded sessions are preserved
                    only when their subject and time remain
                    unchanged. If any recorded progress
                    would be lost, AdaptIQ will reject
                    the replacement.
                  </p>

                  <button
                    type="button"
                    onClick={approvePreview}
                    disabled={
                      saving ||
                      generating ||
                      !currentPlan?.id
                    }
                    className="mt-5 rounded-xl bg-espresso px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#48362F] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "Saving timetable..."
                      : "Approve new timetable"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
