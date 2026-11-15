
import { useEffect, useState } from "react";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function formatTime(value) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;

  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function sessionMinutes(session) {
  const start = session.startTime.split(":").map(Number);
  const end = session.endTime.split(":").map(Number);

  return (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]);
}

function SummaryCard({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-[#E8DED5] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-espresso">
        {value}
      </p>

      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

export default function PlanOnboarding({ children }) {
  const [plan, setPlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [checking, setChecking] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkExistingPlan() {
      try {
        const response = await fetch("/api/plan/current", {
          credentials: "include",
        });

        if (response.status === 404) {
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load your timetable");
        }

        if (active && data.plan) {
          setPlan(data.plan);
          setSessions(data.blocks || []);

          // Returning users with a saved plan
          // do not need to repeat onboarding.
          setCompleted(true);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    checkExistingPlan();

    return () => {
      active = false;
    };
  }, []);

  async function generatePlan() {
    if (generating) return;

    setGenerating(true);
    setError("");

    try {
      // Generate and save the weekly plan.
      const response = await fetch("/api/plan/save", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not generate your study plan"
        );
      }

      // Retrieve the saved plan in the standard frontend format.
      const currentResponse = await fetch("/api/plan/current", {
        credentials: "include",
      });

      const currentData = await currentResponse.json();

      if (!currentResponse.ok) {
        throw new Error(
          currentData.error || "Could not load the saved timetable"
        );
      }

      setPlan(currentData.plan);
      setSessions(currentData.blocks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  if (checking) {
    return (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center bg-cream"
      >
        <p className="text-sm text-muted">
          Checking your study timetable...
        </p>
      </div>
    );
  }

  if (completed) {
    return children;
  }

  const totalMinutes = sessions.reduce(
    (total, session) => total + sessionMinutes(session),
    0
  );

  const totalHours = (totalMinutes / 60).toFixed(1);

  const subjectCount = new Set(
    sessions.map((session) => session.subjectId)
  ).size;

  return (
    <main className="min-h-screen bg-cream px-5 py-8 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <div className="text-2xl font-bold tracking-[-0.06em] text-espresso">
            adapt<span className="text-coral">IQ</span>
          </div>

          <span className="rounded-full border border-[#E0D4C9] px-4 py-2 text-xs font-semibold text-muted">
            Getting started · 4 of 4
          </span>
        </header>

        <div className="mt-10 h-1.5 overflow-hidden rounded-full bg-sand">
          <div className="h-full w-full rounded-full bg-coral" />
        </div>

        <div className="mt-12">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47763]">
            YOUR PERSONALIZED STUDY PLAN
          </span>

          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.06em] text-espresso sm:text-5xl">
            Your week,
            <span className="font-serif italic text-[#C77761]">
              {" "}intelligently planned.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">
            AdaptIQ uses your subjects, learning priorities,
            and available study hours to create a timetable
            that fits your routine.
          </p>
        </div>

        {!plan ? (
          <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_0.85fr]">
            <section className="rounded-[26px] bg-espresso p-8 text-white sm:p-11">
              <div className="inline-flex rounded-full bg-[#5A443A] px-4 py-2 text-xs font-semibold text-[#F1C6B7]">
                READY WHEN YOU ARE
              </div>

              <h2 className="mt-8 max-w-md text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                Less time planning.
                <br />
                More time learning.
              </h2>

              <p className="mt-5 max-w-md text-sm leading-7 text-[#D0BCB1]">
                Your personalized schedule is one step away.
                We'll organize study sessions according to
                your priorities and free time.
              </p>

              <button
                type="button"
                onClick={generatePlan}
                disabled={generating}
                className="mt-9 w-full rounded-xl bg-coral px-6 py-4 text-sm font-semibold text-espresso transition hover:bg-[#F1A18D] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {generating
                  ? "Creating your timetable..."
                  : "Generate my study plan →"}
              </button>
            </section>

            <section className="rounded-[26px] border border-[#E8DED5] bg-white p-8 sm:p-10">
              <h3 className="text-xl font-semibold text-espresso">
                How your plan is created
              </h3>

              <div className="mt-8 space-y-7">
                {[
                  {
                    number: "01",
                    title: "Understand your priorities",
                    detail:
                      "Consider your subjects, assessment performance, and upcoming exams.",
                  },
                  {
                    number: "02",
                    title: "Find available study time",
                    detail:
                      "Use the free study windows you've added to your weekly routine.",
                  },
                  {
                    number: "03",
                    title: "Build balanced sessions",
                    detail:
                      "Use the scheduling engine to allocate study time within your limits.",
                  },
                ].map((item) => (
                  <div key={item.number} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4E6DD] text-xs font-bold text-[#B47763]">
                      {item.number}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-espresso">
                        {item.title}
                      </h4>

                      <p className="mt-2 text-sm leading-6 text-muted">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <SummaryCard
                label="Study sessions"
                value={sessions.length}
                detail="Scheduled this week"
              />

              <SummaryCard
                label="Study hours"
                value={`${totalHours}h`}
                detail="Total planned study time"
              />

              <SummaryCard
                label="Subjects"
                value={subjectCount}
                detail="Included in your timetable"
              />
            </div>

            <section className="mt-8 rounded-[26px] border border-[#E8DED5] bg-white p-6 sm:p-9">
              <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-espresso">
                    Weekly timetable
                  </h2>

                  <p className="mt-2 text-sm text-muted">
                    Your personalized study schedule
                  </p>
                </div>

                <span className="rounded-full bg-[#F4E6DD] px-4 py-2 text-xs font-semibold text-[#A76F5D]">
                  Version {plan.version}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {DAYS.map((day, dayIndex) => {
                  const daySessions = sessions
                    .filter((session) => session.weekday === dayIndex)
                    .sort((a, b) =>
                      a.startTime.localeCompare(b.startTime)
                    );

                  return (
                    <div
                      key={day}
                      className="min-h-[185px] rounded-2xl border border-[#EAE1D9] bg-[#FCFAF8] p-5"
                    >
                      <div className="mb-5 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-espresso">
                          {day}
                        </h3>

                        <span className="text-xs text-muted">
                          {daySessions.length} sessions
                        </span>
                      </div>

                      {daySessions.length === 0 ? (
                        <p className="mt-7 text-center text-xs text-[#AAA097]">
                          No study sessions
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {daySessions.map((session) => (
                            <div
                              key={session.id}
                              className="rounded-xl border border-[#EAD8CB] bg-white p-3.5"
                            >
                              <div className="mb-2 h-1 w-8 rounded-full bg-coral" />

                              <p className="text-sm font-semibold text-espresso">
                                {session.subjectName}
                              </p>

                              <p className="mt-1 text-xs text-muted">
                                {formatTime(session.startTime)}
                                {" – "}
                                {formatTime(session.endTime)}
                              </p>

                              <p className="mt-2 text-xs font-medium text-[#B47763]">
                                {sessionMinutes(session)} min
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#F1E7DE] p-6">
              <div>
                <h3 className="text-lg font-semibold text-espresso">
                  Your learning space is ready.
                </h3>

                <p className="mt-2 text-sm text-muted">
                  You can view your study plan and track
                  your progress from your workspace.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCompleted(true)}
                className="rounded-xl bg-espresso px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#48362F]"
              >
                Go to my workspace →
              </button>
            </div>
          </>
        )}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
