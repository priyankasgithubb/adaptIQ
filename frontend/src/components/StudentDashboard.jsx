
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

const NAV_GROUPS = [
  {
    label: "Study Planner",
    items: [
      { label: "My Subjects", view: "subjects" },
      { label: "My Schedule", view: "schedule" },
      { label: "Update Timetable", view: "regenerate" },
      { label: "Adaptive Recovery", view: "recovery" },
    ],
  },
  {
    label: "Practice",
    items: [
      { label: "Adaptive Quizzes", view: "quizzes" },
      { label: "Spaced Repetition", view: "reviews" },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Study Analytics", view: "analytics" },
      {
        label: "Study Recommendations",
        view: "recommendations",
      },
    ],
  },
];

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
  const total = Math.max(
    0,
    Math.floor(Number(minutes) || 0)
  );

  const hours = Math.floor(total / 60);
  const remaining = total % 60;

  if (!hours) return `${remaining}m`;
  if (!remaining) return `${hours}h`;

  return `${hours}h ${remaining}m`;
}

// =====================================================
// STAT CARD
// =====================================================

function StatCard({ label, value, detail, icon }) {
  return (
    <div className="rounded-[20px] border border-[#E9DFD5] bg-white p-5">
      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5EAE2] text-lg text-[#A86F5E]">
        {icon}
      </div>

      <p className="text-xs font-medium text-muted">
        {label}
      </p>

      <p className="mt-2 text-3xl font-semibold tracking-tight text-espresso">
        {value}
      </p>

      <p className="mt-2 text-xs text-muted">
        {detail}
      </p>
    </div>
  );
}

// =====================================================
// STUDY SESSION CARD
// =====================================================

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
        `Enter a whole number between 1 and ${
          scheduledMinutes - 1
        }.`
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
    "min-h-11 min-w-0 rounded-lg border px-2 py-2.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral disabled:cursor-not-allowed disabled:opacity-40 sm:px-3";

  return (
    <div className="min-w-0 rounded-xl border border-[#EDE1D8] bg-white p-4 sm:p-5">
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
            <label
              htmlFor={`partial-minutes-${session.id}`}
              className="block text-xs font-semibold text-espresso"
            >
              Minutes actually studied
            </label>

            <p className="mt-1 text-[11px] text-muted">
              Scheduled: {scheduledMinutes} minutes
            </p>

            <input
              id={`partial-minutes-${session.id}`}
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
              aria-invalid={Boolean(validationError)}
              aria-describedby={
                validationError
                  ? `partial-error-${session.id}`
                  : undefined
              }
              placeholder="Enter minutes"
              className="mt-3 w-full rounded-lg border border-[#DED5CD] bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-coral"
            />

            {validationError && (
              <p
                id={`partial-error-${session.id}`}
                role="alert"
                className="mt-2 text-xs text-red-700"
              >
                {validationError}
              </p>
            )}

            <button
              type="submit"
              disabled={updating}
              className="mt-3 w-full rounded-lg bg-espresso px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {updating
                ? "Saving..."
                : "Save partial progress"}
            </button>
          </form>
        )}

        {updating && (
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-xs text-muted"
          >
            Saving your study progress...
          </p>
        )}
      </div>
    </div>
  );
}

// =====================================================
// STUDENT DASHBOARD
// =====================================================

export default function StudentDashboard({
  user,
  onLogout,
  logoutLoading,
  logoutError,
}) {
  const [activeView, setActiveView] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [plan, setPlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [updatingSessionId, setUpdatingSessionId] =
    useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ===================================================
  // LOAD CURRENT STUDY PLAN
  // ===================================================

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);

      setError("");

      try {
        const response = await fetch(
          "/api/plan/current",
          {
            credentials: "include",
          }
        );

        const data = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to load your study plan."
          );
        }

        setPlan(data.plan);

        setSessions(
          Array.isArray(data.blocks)
            ? data.blocks
            : []
        );

        return true;
      } catch (err) {
        setError(err.message);
        return false;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // ===================================================
  // CALENDAR EXPORT
  // ===================================================

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
          data.error ||
            "Unable to export your calendar."
        );
      }

      const blob = await response.blob();

      const contentDisposition =
        response.headers.get("Content-Disposition");

      const filenameMatch = contentDisposition?.match(
        /filename="([^"]+)"/
      );

      const filename =
        filenameMatch?.[1] ||
        "adaptiq-study-plan.ics";

      const url = URL.createObjectURL(blob);

      try {
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        setTimeout(
          () => URL.revokeObjectURL(url),
          1000
        );
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

  // ===================================================
  // UPDATE STUDY SESSION
  // ===================================================

  async function handleSessionUpdate(
    id,
    status,
    actualMinutes
  ) {
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

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not update study session."
        );
      }

      setSessions((previous) =>
        previous.map((session) =>
          session.id === id
            ? {
                ...session,
                status: data.session.status,
                actualMinutes:
                  data.session.actualMinutes,
              }
            : session
        )
      );

      setSuccess(
        "Study session updated successfully."
      );

      await loadDashboard(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingSessionId(null);
    }
  }

  // ===================================================
  // DASHBOARD STATISTICS
  // ===================================================

  const stats = useMemo(() => {
    const plannedMinutes = sessions.reduce(
      (total, session) =>
        total + duration(session),
      0
    );

    const studiedMinutes = sessions.reduce(
      (total, session) => {
        if (
          session.status !== "completed" &&
          session.status !== "partial"
        ) {
          return total;
        }

        const actual = Number(
          session.actualMinutes
        );

        return (
          total +
          (Number.isFinite(actual)
            ? Math.max(0, actual)
            : 0)
        );
      },
      0
    );

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
            (completedSessions /
              sessions.length) *
              100
          )
        : 0,
    };
  }, [sessions]);

  // ===================================================
  // NAVIGATION VIEWS
  // ===================================================

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

  // ===================================================
  // MAIN DASHBOARD
  // ===================================================

  return (
    <div className="min-h-screen bg-cream text-espresso">
      {/* HEADER */}
      <header className="relative z-20 border-b border-[#E9DFD5] bg-[#FFFCF9]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-espresso text-xl font-bold text-coral">
              a.
            </div>

            <div>
              <span className="block text-xl font-bold tracking-[-0.03em] text-espresso">
                adapt
                <span className="text-coral">
                  IQ
                </span>
              </span>

              <span className="block text-[11px] text-muted">
                Student workspace
              </span>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-4">
            <span className="hidden max-w-[240px] truncate text-xs text-muted sm:block">
              {user.email}
            </span>

            <button
              type="button"
              onClick={onLogout}
              disabled={logoutLoading}
              className="rounded-lg border border-[#DED5CD] bg-white px-4 py-2.5 text-xs font-semibold text-espresso transition hover:bg-[#F5F0EC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral disabled:opacity-50"
            >
              {logoutLoading
                ? "Signing out..."
                : "Sign out"}
            </button>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav
          aria-label="Main navigation"
          className="border-t border-[#F0E8E1]"
        >
          {/* DESKTOP NAVIGATION */}
          <div className="mx-auto hidden max-w-7xl items-center gap-2 px-10 py-2 md:flex">
            <button
              type="button"
              aria-current="page"
              className="rounded-lg bg-[#F2E5DC] px-4 py-2.5 text-sm font-semibold text-espresso"
            >
              Overview
            </button>

            {NAV_GROUPS.map((group) => (
              <details
                key={group.label}
                className="group relative"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-[#69564C] transition hover:bg-[#F5F0EC] hover:text-espresso focus-visible:outline focus-visible:outline-2 focus-visible:outline-coral [&::-webkit-details-marker]:hidden">
                  {group.label}

                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-4 w-4 transition-transform group-open:rotate-180"
                  >
                    <path
                      d="m6 9 6 6 6-6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>

                <div className="absolute left-0 top-full z-30 mt-2 w-56 rounded-xl border border-[#E9DFD5] bg-white p-2 shadow-lg shadow-black/5">
                  {group.items.map((item) => (
                    <button
                      key={item.view}
                      type="button"
                      onClick={() =>
                        setActiveView(item.view)
                      }
                      className="block w-full rounded-lg px-3 py-3 text-left text-sm text-[#69564C] transition hover:bg-[#F8F2ED] hover:text-espresso focus-visible:outline focus-visible:outline-2 focus-visible:outline-coral"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </details>
            ))}

            <button
              type="button"
              onClick={() => setActiveView("settings")}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-[#69564C] transition hover:bg-[#F5F0EC] hover:text-espresso focus-visible:outline focus-visible:outline-2 focus-visible:outline-coral"
            >
              Settings
            </button>
          </div>

          {/* MOBILE NAVIGATION */}
          <div className="md:hidden">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
              <span className="text-xs font-semibold text-[#78665D]">
                Navigation
              </span>

              <button
                type="button"
                onClick={() =>
                  setMobileMenuOpen((previous) => !previous)
                }
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation-menu"
                aria-label={
                  mobileMenuOpen
                    ? "Close navigation menu"
                    : "Open navigation menu"
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#DED5CD] bg-white px-4 text-sm font-medium text-espresso focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
              >
                {mobileMenuOpen ? "Close" : "Menu"}

                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4"
                >
                  {mobileMenuOpen ? (
                    <path
                      d="M6 6l12 12M18 6 6 18"
                      strokeLinecap="round"
                    />
                  ) : (
                    <path
                      d="M4 7h16M4 12h16M4 17h16"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
              </button>
            </div>

            {mobileMenuOpen && (
              <div
                id="mobile-navigation-menu"
                className="border-t border-[#E9DFD5] bg-[#FFFCF9] px-5 pb-5 pt-3"
              >
                <button
                  type="button"
                  aria-current="page"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block min-h-11 w-full rounded-lg bg-[#F2E5DC] px-4 py-3 text-left text-sm font-semibold text-espresso"
                >
                  Overview
                </button>

                {NAV_GROUPS.map((group) => (
                  <details
                    key={group.label}
                    className="border-b border-[#F0E8E1]"
                  >
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-espresso focus-visible:outline focus-visible:outline-2 focus-visible:outline-coral [&::-webkit-details-marker]:hidden">
                      {group.label}

                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-4 w-4"
                      >
                        <path
                          d="m6 9 6 6 6-6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </summary>

                    <div className="space-y-1 pb-3 pl-3">
                      {group.items.map((item) => (
                        <button
                          key={item.view}
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            setActiveView(item.view);
                          }}
                          className="block min-h-11 w-full rounded-lg px-4 py-3 text-left text-sm text-[#69564C] transition hover:bg-[#F8F2ED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-coral"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </details>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setActiveView("settings");
                  }}
                  className="mt-2 block min-h-11 w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-espresso transition hover:bg-[#F8F2ED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-coral"
                >
                  Settings
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
        {/* PAGE INTRODUCTION */}
        <div className="flex flex-col gap-6 border-b border-[#E9DFD5] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#957565]">
              Student dashboard
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-espresso sm:text-4xl">
              Study overview
            </h1>

            <p className="mt-3 text-sm leading-6 text-muted">
              Your schedule, progress, and next steps.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCalendarExport}
              disabled={exportingCalendar || loading || !plan}
              className="rounded-lg border border-[#D8CABF] bg-white px-4 py-2.5 text-sm font-medium text-espresso transition-colors hover:bg-[#F5F0EC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportingCalendar
                ? "Exporting..."
                : "Export calendar"}
            </button>

            <button
              type="button"
              onClick={() => {
                setSuccess("");
                loadDashboard();
              }}
              disabled={loading || Boolean(updatingSessionId)}
              className="rounded-lg bg-espresso px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#654E43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {(error || logoutError) && (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error || logoutError}
          </div>
        )}

        {/* SUCCESS MESSAGE */}
        {success && !error && (
          <div
            role="status"
            className="mt-8 rounded-xl border border-[#CFE7D6] bg-[#EFF8F0] p-4 text-sm text-[#3F7654]"
          >
            {success}
          </div>
        )}

        {/* DASHBOARD CONTENT */}
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
              Your dashboard will display your study
              sessions after a weekly plan has been saved.
            </p>
          </div>
        ) : (
          <>
            {/* WEEKLY PROGRESS */}
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
                    {sessions.length} scheduled sessions
                    across {stats.subjectCount} subjects.
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
                    {stats.completedSessions} /{" "}
                    {sessions.length}
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

            {/* STATISTICS */}
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

            {/* SUBJECT INSIGHTS */}
            <SubjectInsights />

            {/* WEEKLY TIMETABLE */}
            <section className="mt-12">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-espresso">
                    Weekly timetable
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-muted">
                    Your study sessions, organized by day.
                  </p>
                </div>

                <span className="rounded-lg border border-[#E1D6CB] bg-white px-3 py-2 text-xs font-medium text-[#78665D]">
                  Week of{" "}
                  {String(plan.week_start || "").slice(0, 10)}
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#E9DFD5] bg-white">
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
                      className={`grid gap-4 p-5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-8 sm:p-6 ${
                        index !== 0
                          ? "border-t border-[#F0E7E0]"
                          : ""
                      }`}
                    >
                      <div className="sm:pt-1">
                        <h3 className="text-sm font-semibold text-espresso">
                          {day}
                        </h3>

                        <p className="mt-1 text-xs text-muted">
                          {daySessions.length === 0
                            ? "No sessions"
                            : `${daySessions.length} ${
                                daySessions.length === 1
                                  ? "session"
                                  : "sessions"
                              }`}
                        </p>
                      </div>

                      {daySessions.length === 0 ? (
                        <div className="flex min-h-12 items-center rounded-lg bg-[#FCFAF8] px-4">
                          <p className="text-xs text-[#93857D]">
                            No study sessions scheduled
                          </p>
                        </div>
                      ) : (
                        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
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
              Your study progress is saved automatically.
              Missed sessions can be managed through Adaptive Recovery.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
