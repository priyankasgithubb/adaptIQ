
import { useEffect, useMemo, useState } from "react";

function formatDuration(minutes) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const remaining = total % 60;

  if (!hours) return `${remaining}m`;
  if (!remaining) return `${hours}h`;

  return `${hours}h ${remaining}m`;
}

function StatCard({ label, value, description }) {
  return (
    <div className="rounded-[20px] border border-[#E9DFD5] bg-white p-5">
      <p className="text-xs font-medium text-muted">{label}</p>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-espresso">
        {value}
      </p>

      <p className="mt-2 text-xs text-muted">{description}</p>
    </div>
  );
}

function ProgressBar({ value, max, color = "bg-coral" }) {
  const percentage =
    max > 0
      ? Math.max(0, Math.min(100, (value / max) * 100))
      : 0;

  return (
    <div className="h-3 overflow-hidden rounded-full bg-[#F0E7DF]">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function WeeklyChart({ weeks }) {
  const sorted = [...weeks].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart)
  );

  const maxMinutes = Math.max(
    60,
    ...sorted.map((week) => Number(week.plannedMinutes) || 0)
  );

  if (!sorted.length) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        No weekly study data available yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-5 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-[#E8D5C8]" />
          Planned
        </div>

        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-coral" />
          Completed
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[420px] items-end gap-4">
          {sorted.map((week) => {
            const planned = Number(week.plannedMinutes) || 0;
            const completed = Number(week.completedMinutes) || 0;

            const plannedHeight = (planned / maxMinutes) * 170;
            const completedHeight = (completed / maxMinutes) * 170;

            return (
              <div
                key={week.weekStart}
                className="min-w-0 flex-1 text-center"
              >
                <div className="flex h-[180px] items-end justify-center gap-1.5">
                  <div
                    title={`Planned: ${formatDuration(planned)}`}
                    className="w-5 rounded-t-md bg-[#E8D5C8]"
                    style={{ height: `${plannedHeight}px` }}
                  />

                  <div
                    title={`Completed: ${formatDuration(completed)}`}
                    className="w-5 rounded-t-md bg-coral"
                    style={{ height: `${completedHeight}px` }}
                  />
                </div>

                <p className="mt-3 text-[11px] font-medium text-espresso">
                  {week.weekStart.slice(5)}
                </p>

                <p className="mt-1 text-[10px] text-muted">
                  {week.adherencePercent}%
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted">
        Dates represent the start of each recorded study week.
        Bars show scheduled versus recorded minutes.
      </p>
    </div>
  );
}

function SubjectBreakdown({ subjects }) {
  if (!subjects.length) {
    return (
      <p className="py-8 text-sm text-muted">
        No subjects are included in this week's active timetable.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {subjects.map((subject) => {
        const planned = Number(subject.plannedMinutes) || 0;
        const completed = Number(subject.completedMinutes) || 0;

        return (
          <div key={subject.subjectId}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-espresso">
                {subject.subjectName}
              </p>

              <p className="text-xs text-muted">
                {formatDuration(completed)} / {formatDuration(planned)}
              </p>
            </div>

            <ProgressBar
              value={completed}
              max={planned}
            />

            <p className="mt-2 text-xs text-muted">
              {subject.sessionCount} scheduled sessions
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function StudentAnalytics({ onBack }) {
  const [data, setData] = useState(null);
  const [mlStatus, setMlStatus] = useState(null);
  const [mlLoading, setMlLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Phase 6.1: Historical analytics.
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      try {
        const response = await fetch(
          "/api/analytics/overview",
          { credentials: "include" }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load analytics."
          );
        }

        if (active) {
          setData(result);
        }
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

    loadAnalytics();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMLStatus() {
      try {
        const response = await fetch("/api/ml/status", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("ML status unavailable");
        }

        const result = await response.json();

        if (active) {
          setMlStatus(result);
        }
      } catch {
        if (active) {
          setMlStatus(null);
        }
      } finally {
        if (active) {
          setMlLoading(false);
        }
      }
    }

    loadMLStatus();

    return () => {
      active = false;
    };
  }, []);

  // Phase 6.1: Load historical study activity separately.
  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const response = await fetch(
          "/api/analytics/history",
          { credentials: "include" }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load historical analytics."
          );
        }

        if (active) {
          setHistory(result);
        }
      } catch (err) {
        if (active) {
          setHistoryError(err.message);
        }
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, []);

  const overview = data?.overview;

  const totalRecordedSessions = useMemo(() => {
    if (!overview) return 0;

    return (
      Number(overview.completedSessions || 0) +
      Number(overview.partialSessions || 0) +
      Number(overview.missedSessions || 0)
    );
  }, [overview]);

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
            className="rounded-xl border border-[#DED5CD] bg-white px-5 py-3 text-sm font-semibold transition hover:bg-sand"
          >
            Back to overview
          </button>
        </div>

        <div className="mt-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47763]">
            STUDY ANALYTICS
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Your progress,{" "}
            <span className="font-serif italic text-[#C77761]">
              in perspective.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">
            Understand how your planned study sessions compare
            with the time you've actually completed.
            Track your consistency and see how you're
            distributing your study time across subjects.
          </p>
        </div>

        {loading && (
          <p role="status" className="mt-10 text-sm text-muted">
            Loading your study analytics...
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#F2E4D9] px-4 py-2 text-xs font-semibold text-[#A36752]">
                Week of {data.weekStart}
              </span>

              {data.planVersion != null && (
                <span className="rounded-full border border-[#E9DFD5] px-4 py-2 text-xs text-muted">
                  Timetable v{data.planVersion}
                </span>
              )}
            </div>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Planned study time"
                value={formatDuration(overview.plannedMinutes)}
                description="Scheduled in your active weekly plan"
              />

              <StatCard
                label="Completed study time"
                value={formatDuration(overview.completedMinutes)}
                description="Actual minutes recorded in the active plan"
              />

              <StatCard
                label="Study adherence"
                value={`${overview.adherencePercent}%`}
                description="Recorded time compared with planned time"
              />

              <StatCard
                label="Updated sessions"
                value={totalRecordedSessions}
                description="Completed, partial, or missed"
              />
            </section>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <section className="rounded-[22px] border border-[#E8DED5] bg-white p-6 sm:p-8">
                <h2 className="text-xl font-semibold">
                  Weekly study trends
                </h2>

                <p className="mb-7 mt-2 text-sm text-muted">
                  Study time across your recorded weekly plans.
                </p>

                <WeeklyChart weeks={data.weeklyTrends || []} />
              </section>

              <section className="rounded-[22px] border border-[#E8DED5] bg-white p-6 sm:p-8">
                <h2 className="text-xl font-semibold">
                  Study time by subject
                </h2>

                <p className="mb-7 mt-2 text-sm text-muted">
                  Your planned and completed study time this week.
                </p>

                <SubjectBreakdown
                  subjects={data.subjectBreakdown || []}
                />
              </section>
            </div>

            <section className="mt-6 rounded-[22px] border border-[#E8DED5] bg-white p-6 sm:p-8">
              <h2 className="text-xl font-semibold">
                Session progress
              </h2>

              <p className="mt-2 text-sm text-muted">
                Status breakdown for the active weekly timetable.
              </p>

              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="Completed"
                  value={overview.completedSessions}
                  description="Sessions marked as completed"
                />

                <StatCard
                  label="Partially completed"
                  value={overview.partialSessions}
                  description="Sessions with unfinished study time"
                />

                <StatCard
                  label="Missed"
                  value={overview.missedSessions}
                  description="Sessions marked as missed"
                />
              </div>
            </section>

            {/* Phase 6.1: Historical study progress */}
            <section className="mt-6 rounded-[22px] border border-[#E8DED5] bg-white p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B47763]">
                STUDY HISTORY
              </p>

              <h2 className="mt-3 text-xl font-semibold text-espresso">
                Historical study progress
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                Review your recorded study activity across
                current and archived timetable versions.
                Sessions with matching tracking IDs are
                counted once per week.
              </p>

              {historyLoading && (
                <p
                  role="status"
                  className="mt-6 text-sm text-muted"
                >
                  Loading your study history...
                </p>
              )}

              {!historyLoading && historyError && (
                <div
                  role="alert"
                  className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  {historyError}
                </div>
              )}

              {!historyLoading && !historyError && history && (
                <>
                  <div className="mt-7 grid gap-4 sm:grid-cols-3">
                    <StatCard
                      label="Historical planned time"
                      value={formatDuration(
                        history.totals?.plannedMinutes
                      )}
                      description="Scheduled minutes across the available study history"
                    />

                    <StatCard
                      label="Historical recorded time"
                      value={formatDuration(
                        history.totals?.completedMinutes
                      )}
                      description="Recorded study minutes across timetable versions"
                    />

                    <StatCard
                      label="Historical sessions"
                      value={history.totals?.sessions ?? 0}
                      description="Distinct tracked sessions in the available history"
                    />
                  </div>

                  <div className="mt-7 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-[20px] bg-[#FCF8F4] p-5 sm:p-6">
                      <h3 className="text-base font-semibold text-espresso">
                        Historical weekly trends
                      </h3>

                      <p className="mb-6 mt-2 text-xs leading-5 text-muted">
                        Scheduled and recorded study minutes
                        across up to eight study weeks.
                      </p>

                      <WeeklyChart
                        weeks={history.weeklyTrends || []}
                      />
                    </div>

                    <div className="rounded-[20px] bg-[#FCF8F4] p-5 sm:p-6">
                      <h3 className="text-base font-semibold text-espresso">
                        Historical progress by subject
                      </h3>

                      <p className="mb-6 mt-2 text-xs leading-5 text-muted">
                        Recorded activity for each subject
                        across the available study history.
                      </p>

                      {(history.subjectBreakdown || []).length > 0 ? (
                        <SubjectBreakdown
                          subjects={history.subjectBreakdown}
                        />
                      ) : (
                        <p className="py-8 text-sm text-muted">
                          No historical subject activity available yet.
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="mt-6 text-xs leading-6 text-muted">
                    Historical results include archived and active
                    timetable versions. Matching tracking IDs
                    are deduplicated within each week.
                    Sessions copied before tracking IDs were
                    introduced may still be counted separately,
                    so older totals may be inaccurate.
                  </p>
                </>
              )}
            </section>

            <section className="mt-6 rounded-[22px] border border-[#E8DED5] bg-white p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B47763]">
                MACHINE LEARNING
              </p>

              <h2 className="mt-3 text-xl font-semibold text-espresso">
                Academic performance predictions
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                AdaptIQ is developing prediction models to estimate
                future assessment performance using academic history
                and study activity.
              </p>

              <div className="mt-6 rounded-xl bg-[#FCF8F4] p-5">
                {mlLoading ? (
                  <p role="status" className="text-sm text-muted">
                    Checking prediction availability...
                  </p>
                ) : mlStatus ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-espresso">
                        Prediction service
                      </p>

                      <span className="rounded-full bg-[#F5E4D7] px-3 py-1.5 text-xs font-semibold text-[#A36752]">
                        {mlStatus.available
                          ? "Service reports available"
                          : "Not yet available"}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-muted">
                      {mlStatus.message}
                    </p>

                    <p className="mt-4 text-xs text-muted">
                      Validation status:{" "}
                      <span className="font-semibold text-espresso">
                        {mlStatus.validation === "synthetic_only"
                          ? "Synthetic data only"
                          : mlStatus.validation || "Unknown"}
                      </span>
                    </p>

                    <p className="mt-2 text-xs text-muted">
                      Models:{" "}
                      {Array.isArray(mlStatus.models)
                        ? mlStatus.models
                            .map((model) =>
                              model.replaceAll("_", " ")
                            )
                            .join(", ")
                        : "Unavailable"}
                    </p>

                    {mlStatus.validation === "synthetic_only" && (
                      <p className="mt-4 text-xs leading-5 text-[#A36752]">
                        Predictions are disabled until a model has
                        been evaluated using suitable real historical
                        student data.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    Prediction service status could not be retrieved.
                    Study analytics are still available.
                  </p>
                )}
              </div>
            </section>

            <p className="mb-8 mt-6 text-xs leading-6 text-muted">
              Current-week overview statistics include active
              timetable versions only. The historical study
              progress section also includes archived versions
              and deduplicates records with matching tracking
              IDs. Older copied sessions may not be linked
              reliably. These are recorded study activity metrics,
              not predictions of academic performance.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
