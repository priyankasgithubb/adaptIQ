import { useCallback, useEffect, useMemo, useState } from "react";
import SubjectInsights from "./SubjectInsights";
import ManageSubjects from "./ManageSubjects";
import ManageAvailability from "./ManageAvailability";
import ManageProfile from "./ManageProfile";
import PlanRegeneration from "./PlanRegeneration";
import AdaptiveRecovery from "./AdaptiveRecovery";
import StudentAnalytics from "./StudentAnalytics";
import AdaptiveQuiz from "./AdaptiveQuiz";
import SpacedRepetition from "./SpacedRepetition";
import StudyRecommendations from "./StudyRecommendations";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const STATUS_STYLES = {
  planned: "bg-[#F1E9E2] text-[#78665D]",
  completed: "bg-[#E2F0E6] text-[#3F7654]",
  partial: "bg-[#FFF0D8] text-[#966A2E]",
  missed: "bg-[#F9E3E0] text-[#A2584F]",
};

function toMinutes(time) {
  if (typeof time !== "string") return 0;

  const [hours, minutes] = time.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

function duration(session) {
  return Math.max(
    0,
    toMinutes(session.endTime) - toMinutes(session.startTime)
  );
}

function formatTime(time) {
  if (!time) return "—";

  const [hours, minutes] = time.split(":").map(Number);
  const hour = hours % 12 || 12;

  return `${hour}:${String(minutes).padStart(2, "0")} ${
    hours >= 12 ? "PM" : "AM"
  }`;
}

function formatDuration(minutes) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const remaining = total % 60;

  if (!hours) return `${remaining}m`;
  if (!remaining) return `${hours}h`;

  return `${hours}h ${remaining}m`;
}

function StatCard({ label, value, detail, icon }) {
  return (
    <div className="rounded-[20px] border border-[#E9DFD5] bg-white p-5">
      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5EAE2] text-lg text-[#A86F5E]">
        {icon}
      </div>

      <p className="text-xs font-medium text-muted">{label}</p>

      <p className="mt-2 text-3xl font-semibold tracking-tight text-espresso">
        {value}
      </p>

      <p className="mt-2 text-xs text-muted">{detail}</p>
    </div>
  );
}

function SessionCard({ session, updating, onUpdate }) {
  const status = session.status || "planned";
  const scheduledMinutes = duration(session);

  const [showPartial, setShowPartial] = useState(false);
  const [partialMinutes, setPartialMinutes] = useState(
    session.status === "partial" &&
      session.actualMinutes != null
      ? String(session.actualMinutes)
      : ""
  );
  const [validationError, setValidationError] = useState("");

  function submitPartial(event) {
    event.preventDefault();

    const value = Number(partialMinutes);

    if (
      !Number.isInteger(value) ||
      value <= 0 ||
      value >= scheduledMinutes
    ) {
      setValidationError(
        `Enter a whole number between 1 and ${scheduledMinutes - 1}.`
      );
      return;
    }

    setValidationError("");
    onUpdate(session.id, "partial", value);
  }

  function updateStatus(nextStatus) {
    setValidationError("");
    setShowPartial(false);
    onUpdate(session.id, nextStatus);
  }

  const buttonClass =
    "rounded-lg border px-3 py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="rounded-xl border border-[#EDE1D8] bg-white p-3.5">
      <div className="mb-3 h-1 w-8 rounded-full bg-coral" />

      <p className="break-words text-sm font-semibold text-espresso">
        {session.subjectName}
      </p>

      <p className="mt-2 text-xs leading-5 text-muted">
        {formatTime(session.startTime)} –{" "}
        {formatTime(session.endTime)}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#A76C59]">
          {formatDuration(scheduledMinutes)}
        </span>

        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${
            STATUS_STYLES[status] || STATUS_STYLES.planned
          }`}
        >
          {status}
        </span>
      </div>

      {(status === "completed" || status === "partial") && (
        <p className="mt-3 text-xs text-muted">
          Actual study time:{" "}
          <span className="font-semibold text-espresso">
            {formatDuration(session.actualMinutes)}
          </span>
        </p>
      )}

      <div className="mt-4 border-t border-[#F0E7E0] pt-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Update session
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={updating || status === "completed"}
            onClick={() => updateStatus("completed")}
            className={`${buttonClass} border-[#D4E6D8] bg-[#EAF5EC] text-[#3E7551] hover:bg-[#DCEEDF]`}
          >
            ✓ Completed
          </button>

          <button
            type="button"
            disabled={updating || scheduledMinutes <= 1}
            onClick={() => {
              setShowPartial((previous) => !previous);
              setValidationError("");
            }}
            className={`${buttonClass} border-[#EFDFC3] bg-[#FFF5E5] text-[#946C35] hover:bg-[#FFF0D3]`}
          >
            ◷ Partial
          </button>

          <button
            type="button"
            disabled={updating || status === "missed"}
            onClick={() => updateStatus("missed")}
            className={`${buttonClass} border-[#F0D8D5] bg-[#FFF0ED] text-[#A45850] hover:bg-[#FAE1DD]`}
          >
            ✕ Missed
          </button>

          <button
            type="button"
            disabled={updating || status === "planned"}
            onClick={() => updateStatus("planned")}
            className={`${buttonClass} border-[#E7DDD5] bg-[#FAF7F4] text-[#76665E] hover:bg-[#F0E9E3]`}
          >
            ↺ Reset
          </button>
        </div>

        {showPartial && (
          <form
            onSubmit={submitPartial}
            className="mt-4 rounded-xl bg-[#FCF7F1] p-3"
          >
            <label className="block text-xs font-semibold text-espresso">
              Minutes actually studied
            </label>

            <p className="mt-1 text-[11px] text-muted">
              Scheduled: {scheduledMinutes} minutes
            </p>

            <input
              type="number"
              min={1}
              max={scheduledMinutes - 1}
              step={1}
              required
              value={partialMinutes}
              onChange={(event) => {
                setPartialMinutes(event.target.value);
                setValidationError("");
              }}
              disabled={updating}
              placeholder="Enter minutes"
              className="mt-3 w-full rounded-lg border border-[#DED5CD] bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-coral"
            />

            {validationError && (
              <p role="alert" className="mt-2 text-xs text-red-700">
                {validationError}
              </p>
            )}

            <button
              type="submit"
              disabled={updating}
              className="mt-3 w-full rounded-lg bg-espresso px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {updating ? "Saving..." : "Save partial progress"}
            </button>
          </form>
        )}

        {updating && (
          <p role="status" className="mt-3 text-xs text-muted">
            Updating session...
          </p>
        )}
      </div>
    </div>
  );
}

export default function StudentDashboard({
  user,
  onLogout,
  logoutLoading,
  logoutError,
}) {
  const [activeView, setActiveView] = useState("overview");
  const [plan, setPlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingSessionId, setUpdatingSessionId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/plan/current", {
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load your study plan."
        );
      }

      setPlan(data.plan);
      setSessions(
        Array.isArray(data.blocks) ? data.blocks : []
      );

      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);


  const [exportingCalendar, setExportingCalendar] =
    useState(false);

  async function handleCalendarExport() {
    if (exportingCalendar) return;

    setExportingCalendar(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        "/api/calendar/export",
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          data.error || "Unable to export your calendar."
        );
      }

      const blob = await response.blob();

      const contentDisposition =
        response.headers.get("Content-Disposition");

      const filenameMatch = contentDisposition?.match(
        /filename="([^"]+)"/
      );

      const filename =
        filenameMatch?.[1] || "adaptiq-study-plan.ics";

      const url = URL.createObjectURL(blob);

      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        // Release the object URL after initiating
        // the browser download.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      setSuccess(
        "Calendar exported successfully. Import the downloaded .ics file into your calendar app."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setExportingCalendar(false);
    }
  }


  async function handleSessionUpdate(id, status, actualMinutes) {
    if (updatingSessionId) return;

    setUpdatingSessionId(id);
    setError("");
    setSuccess("");

    try {
      const payload = { status };

      if (status === "partial") {
        payload.actualMinutes = actualMinutes;
      }

      const response = await fetch(
        `/api/plan/sessions/${id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "Could not update study session."
        );
      }

      // Update the visible session immediately.
      // Keep subjectName and other fields from the original session.
      setSessions((previous) =>
        previous.map((session) =>
          session.id === id
            ? {
                ...session,
                status: data.session.status,
                actualMinutes: data.session.actualMinutes,
              }
            : session
        )
      );

      setSuccess("Study session updated successfully.");

      // Reload the authoritative data from PostgreSQL.
      await loadDashboard(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingSessionId(null);
    }
  }

  const stats = useMemo(() => {
    const plannedMinutes = sessions.reduce(
      (total, session) => total + duration(session),
      0
    );

    const studiedMinutes = sessions.reduce((total, session) => {
      if (
        session.status !== "completed" &&
        session.status !== "partial"
      ) {
        return total;
      }

      const actual = Number(session.actualMinutes);

      return (
        total +
        (Number.isFinite(actual) ? Math.max(0, actual) : 0)
      );
    }, 0);

    const completedSessions = sessions.filter(
      (session) => session.status === "completed"
    ).length;

    const partialSessions = sessions.filter(
      (session) => session.status === "partial"
    ).length;

    const missedSessions = sessions.filter(
      (session) => session.status === "missed"
    ).length;

    const subjectCount = new Set(
      sessions.map((session) => session.subjectId)
    ).size;

    return {
      plannedMinutes,
      studiedMinutes,
      completedSessions,
      partialSessions,
      missedSessions,
      subjectCount,
      completionPercent: sessions.length
        ? Math.round(
            (completedSessions / sessions.length) * 100
          )
        : 0,
    };
  }, [sessions]);


if (activeView === "subjects") {
  return (
    <ManageSubjects
      user={user}
      onBack={() => {
        setActiveView("overview");
        loadDashboard();
      }}
      onLogout={onLogout}
      logoutLoading={logoutLoading}
    />
  );
}


if (activeView === "schedule") {
  return (
    <ManageAvailability
      user={user}
      onBack={() => {
        setActiveView("overview");
        loadDashboard();
      }}
      onLogout={onLogout}
      logoutLoading={logoutLoading}
    />
  );
}


if (activeView === "settings") {
  return (
    <ManageProfile
      user={user}
      onBack={() => {
        setActiveView("overview");
        loadDashboard();
      }}
      onLogout={onLogout}
      logoutLoading={logoutLoading}
    />
  );
}


if (activeView === "regenerate") {
  return (
    <PlanRegeneration
      onBack={() => {
        setActiveView("overview");
        loadDashboard();
      }}
    />
  );
}

if (activeView === "recovery") {
  return (
    <AdaptiveRecovery
      onBack={() => {
        setActiveView("overview");
        loadDashboard();
      }}
    />
  );
}

if (activeView === "analytics") {
  return (
    <StudentAnalytics
      onBack={() => {
        setActiveView("overview");
        loadDashboard();
      }}
    />
  );
}


if (activeView === "quizzes") {
  return (
    <AdaptiveQuiz
      onBack={() => {
        setActiveView("overview");
        loadDashboard();
      }}
    />
  );
}


if (activeView === "reviews") {
  return (
    <SpacedRepetition
      onBack={() => {
        setActiveView("overview");
        loadDashboard();
      }}
    />
  );
}


if (activeView === "recommendations") {
  return (
    <StudyRecommendations
      onBack={() => {
        setActiveView("overview");
        loadDashboard();
      }}
    />
  );
}




  return (
    <div className="min-h-screen bg-cream text-espresso">
      <header className="border-b border-[#E9DFD5] bg-[#FFFCF9]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-espresso text-xl font-bold text-coral">
              a.
            </div>

            <span className="text-xl font-bold tracking-[-0.06em]">
              adapt<span className="text-coral">IQ</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
                type="button"
                onClick={() => setActiveView("subjects")}
                className="rounded-xl border border-[#DED5CD] px-4 py-2.5 text-xs font-semibold text-espresso transition hover:bg-sand"
            >
                My Subjects
            </button>

            <button
                type="button"
                onClick={() => setActiveView("schedule")}
                className="rounded-xl border border-[#DED5CD] px-4 py-2.5 text-xs font-semibold text-espresso transition hover:bg-sand"
            >
                My Schedule
            </button>


            <button
                 type="button"
                onClick={() => setActiveView("settings")}
                className="rounded-xl border border-[#DED5CD] px-4 py-2.5 text-xs font-semibold text-espresso transition hover:bg-sand"
            >
                Study Settings
            </button>

            <button
                type="button"
                    onClick={() => setActiveView("analytics")}
                    className="rounded-xl border border-[#DED5CD] px-4 py-2.5 text-xs font-semibold text-espresso transition hover:bg-sand"
            >
                Study Analytics
            </button>


            <button
              type="button"
                onClick={() => setActiveView("quizzes")}
                className="rounded-xl border border-[#DED5CD] px-4 py-2.5 text-xs font-semibold text-espresso transition hover:bg-sand"
          >
              Adaptive Quizzes
          </button>


          <button
          type="button"
            onClick={() => setActiveView("reviews")}
            className="rounded-xl border border-[#DED5CD] px-4 py-2.5 text-xs font-semibold text-espresso transition hover:bg-sand"
        >
            Spaced Repetition
          </button>


          <button
            type="button"
            onClick={() => setActiveView("recommendations")}
            className="rounded-xl border border-[#DED5CD] px-4 py-2.5 text-xs font-semibold text-espresso transition hover:bg-sand"
          >
              Study Recommendations
            </button>


            <button
                type="button"
                onClick={() => setActiveView("regenerate")}
                className="rounded-xl border border-[#DED5CD] px-4 py-2.5 text-xs font-semibold text-espresso transition hover:bg-sand"
            >
                Update Timetable
            </button>

            <button
                type="button"
                onClick={() => setActiveView("recovery")}
                className="rounded-xl border border-[#DED5CD] px-4 py-2.5 text-xs font-semibold text-espresso transition hover:bg-sand"
            >
                Adaptive Recovery
            </button>

            <span className="hidden max-w-[220px] truncate text-xs text-muted sm:block">
              {user.email}
            </span>

            <button
              type="button"
              onClick={onLogout}
              disabled={logoutLoading}
              className="rounded-xl border border-[#DED5CD] px-4 py-2.5 text-xs font-semibold transition hover:bg-sand disabled:opacity-50"
            >
              {logoutLoading ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47763]">
              YOUR LEARNING WORKSPACE
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
              Your study{" "}
              <span className="font-serif italic text-[#C77761]">
                overview.
              </span>
            </h1>

            <p className="mt-4 text-sm leading-6 text-muted">
              Your weekly study plan and progress,
              all in one place.
            </p>
          </div>


          <button
            type="button"
            onClick={handleCalendarExport}
            disabled={exportingCalendar || loading || !plan}
            className="rounded-xl border border-[#D8CABF] bg-white px-5 py-3 text-xs font-semibold text-espresso transition hover:bg-sand disabled:cursor-not-allowed disabled:opacity-50"
          >
           {exportingCalendar
            ? "Exporting..."
            : "Download Calendar"}
          </button>


          <button
            type="button"
            onClick={() => {
              setSuccess("");
              loadDashboard();
            }}
            disabled={loading || Boolean(updatingSessionId)}
            className="rounded-xl border border-[#D8CABF] bg-white px-5 py-3 text-xs font-semibold transition hover:bg-sand disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "↻ Refresh dashboard"}
          </button>
        </div>

        {(error || logoutError) && (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error || logoutError}
          </div>
        )}

        {success && !error && (
          <div
            role="status"
            className="mt-8 rounded-xl border border-[#CFE7D6] bg-[#EFF8F0] p-4 text-sm text-[#3F7654]"
          >
            {success}
          </div>
        )}

        {loading && !plan ? (
          <p className="mt-12 text-sm text-muted">
            Loading your study dashboard...
          </p>
        ) : !plan ? (
          <div className="mt-10 rounded-2xl border border-[#E8DED5] bg-white p-8">
            <h2 className="text-xl font-semibold">
              No timetable available
            </h2>
            <p className="mt-3 text-sm text-muted">
              Your dashboard will display your study sessions
              after a weekly plan has been saved.
            </p>
          </div>
        ) : (
          <>
            <section className="mt-10 rounded-[25px] bg-espresso p-7 text-white sm:p-9">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#D4A99A]">
                    THIS WEEK'S PLAN
                  </p>

                  <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Small steps. Meaningful progress.
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#D0BCB1]">
                    {sessions.length} scheduled sessions across{" "}
                    {stats.subjectCount} subjects.
                  </p>
                </div>

                <span className="rounded-full bg-[#5B453C] px-4 py-2 text-xs text-[#F3D2C4]">
                  Plan version {plan.version}
                </span>
              </div>

              <div className="mt-9">
                <div className="mb-3 flex justify-between text-xs">
                  <span className="text-[#E8D4CB]">
                    Completed sessions
                  </span>
                  <span className="font-semibold">
                    {stats.completedSessions} / {sessions.length}
                  </span>
                </div>

                <div
                  role="progressbar"
                  aria-label="Completed study sessions"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={stats.completionPercent}
                  className="h-2.5 overflow-hidden rounded-full bg-white/15"
                >
                  <div
                    className="h-full rounded-full bg-coral transition-all"
                    style={{
                      width: `${stats.completionPercent}%`,
                    }}
                  />
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon="◷"
                label="Planned study time"
                value={formatDuration(stats.plannedMinutes)}
                detail="Total scheduled this week"
              />

              <StatCard
                icon="✓"
                label="Time studied"
                value={formatDuration(stats.studiedMinutes)}
                detail="Recorded actual study time"
              />

              <StatCard
                icon="▦"
                label="Completed sessions"
                value={stats.completedSessions}
                detail={`${stats.partialSessions} partial · ${stats.missedSessions} missed`}
              />

              <StatCard
                icon="◇"
                label="Scheduled subjects"
                value={stats.subjectCount}
                detail="Subjects included in your plan"
              />
            </section>

            <SubjectInsights />

            <section className="mt-10">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Weekly timetable
                  </h2>

                  <p className="mt-2 text-sm text-muted">
                    Review your study sessions and record
                    your progress.
                  </p>
                </div>

                <span className="rounded-full border border-[#E1D6CB] px-4 py-2 text-xs text-muted">
                  Week of{" "}
                  {String(plan.week_start || "").slice(0, 10)}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {DAYS.map((day, index) => {
                  const daySessions = sessions
                    .filter(
                      (session) =>
                        Number(session.weekday) === index
                    )
                    .sort(
                      (a, b) =>
                        toMinutes(a.startTime) -
                        toMinutes(b.startTime)
                    );

                  return (
                    <div
                      key={day}
                      className="min-h-48 rounded-[20px] border border-[#E9DFD5] bg-[#FCFAF8] p-4"
                    >
                      <div className="mb-5 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                          {day}
                        </h3>

                        <span className="text-xs text-muted">
                          {daySessions.length} sessions
                        </span>
                      </div>

                      {daySessions.length === 0 ? (
                        <p className="py-8 text-center text-xs text-[#A99A90]">
                          No sessions planned
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {daySessions.map((session) => (
                            <SessionCard
                              key={session.id}
                              session={session}
                              updating={
                                updatingSessionId === session.id
                              }
                              onUpdate={handleSessionUpdate}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <p className="mt-8 text-center text-xs text-muted">
              Your progress is saved to PostgreSQL.
              Adaptive recovery for missed sessions
              will be added in a later step.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
