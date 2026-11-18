
import { useCallback, useEffect, useMemo, useState } from "react";

const REASONS = {
  learningGap: {
    title: "Learning gap",
    description: "Based on available assessment performance.",
  },
  examUrgency: {
    title: "Upcoming exam",
    description: "An approaching exam is influencing this priority.",
  },
  assessmentImportance: {
    title: "Subject importance",
    description: "The subject's assigned importance affects its ranking.",
  },
  unfinishedBacklog: {
    title: "Unfinished study",
    description: "Unfinished study workload.",
  },
  revisionDue: {
    title: "Revision needed",
    description: "Revision requirements.",
  },
};

function displayNumber(value) {
  if (value === null || value === undefined) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ScoreBar({ label, value, max = 100 }) {
  const numericValue = displayNumber(value);
  const percentage =
    numericValue === null
      ? 0
      : Math.min(100, Math.max(0, (numericValue / max) * 100));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-semibold text-espresso">
          {numericValue === null
            ? "Not assessed"
            : `${numericValue}%`}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[#EFE7DF]">
        <div
          className="h-full rounded-full bg-coral transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SubjectCard({ priority, subject, study, rank }) {
  const average = displayNumber(subject?.averagePercent);
  const target = displayNumber(subject?.targetScore);

  const gap =
    average === null || target === null
      ? null
      : Math.max(0, target - average);

  const reason = REASONS[priority.mainReason];

  const isEstimated = average === null;

  // This number is a weighted ranking score,
  // not a test result or a percentage of knowledge.
  const rankingScore = displayNumber(priority.score) ?? 0;

  return (
    <article className="rounded-[22px] border border-[#E8DED5] bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3E4DA] text-sm font-bold text-[#A66A57]">
            {String(rank).padStart(2, "0")}
          </div>

          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold text-espresso">
              {priority.name}
            </h3>
            <p className="mt-1 text-xs text-muted">
              Priority rank #{rank}
            </p>
          </div>
        </div>

        <div className="shrink-0 rounded-xl bg-[#FAEFE8] px-3 py-2 text-right">
          <p className="text-xs font-bold text-[#AD6B56]">
            {rankingScore.toFixed(3)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted">
            Priority score
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <ScoreBar label="Current assessment average" value={average} />
        <ScoreBar label="Target score" value={target} />

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#FCF8F4] p-4">
            <p className="text-xs text-muted">Learning gap to target</p>
            <p className="mt-2 text-xl font-semibold text-espresso">
              {gap === null ? "—" : `${gap.toFixed(1)} pts`}
            </p>
          </div>

          <div className="rounded-xl bg-[#FCF8F4] p-4">
            <p className="text-xs text-muted">Subject importance</p>
            <p className="mt-2 text-xl font-semibold text-espresso">
              {subject?.weight ?? "—"}
              <span className="ml-1 text-xs font-normal text-muted">
                / 10
              </span>
            </p>
          </div>
        </div>


        
<div className="rounded-xl bg-[#FCF8F4] p-4">
  <p className="text-[11px] font-bold uppercase tracking-wider text-[#AC745F]">
    Study activity this week
  </p>

  <div className="mt-4 grid grid-cols-2 gap-4">
    <div>
      <p className="text-xs text-muted">
        Planned study time
      </p>

      <p className="mt-2 text-xl font-semibold text-espresso">
        {study?.plannedMinutes ?? 0} min
      </p>
    </div>

    <div>
      <p className="text-xs text-muted">
        Completed study time
      </p>

      <p className="mt-2 text-xl font-semibold text-espresso">
        {study?.completedMinutes ?? 0} min
      </p>
    </div>
  </div>

  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EFE7DF]">
    <div
      className="h-full rounded-full bg-coral transition-all"
      style={{
        width: `${
          study?.plannedMinutes > 0
            ? Math.min(
                100,
                (Number(study.completedMinutes || 0) /
                  Number(study.plannedMinutes)) *
                  100
              )
            : 0
        }%`,
      }}
    />
  </div>

  <p className="mt-2 text-[11px] leading-5 text-muted">
    Recorded time from the active weekly timetable.
    Archived sessions are not included.
    Study time does not directly measure academic improvement.
  </p>
</div>

        <div className="rounded-xl border border-[#F0E1D6] bg-[#FFFAF5] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#AC745F]">
            Main priority factor
          </p>

          <p className="mt-2 text-sm font-semibold text-espresso">
            {reason?.title || "Calculated priority"}
          </p>

          <p className="mt-2 text-xs leading-5 text-muted">
            {priority.mainReason === "learningGap" && isEstimated
              ? "No assessment marks have been recorded yet. AdaptIQ uses a default learning-gap estimate until performance data is available."
              : reason?.description ||
                "Calculated from your saved academic information."}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function SubjectInsights() {
  const [priorities, setPriorities] = useState([]);
  const [subjects, setSubjects] = useState([]); 
  const [studyActivity, setStudyActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [prioritiesResponse, subjectsResponse] =
        await Promise.all([
          fetch("/api/priorities", {
            credentials: "include",
          }),
          fetch("/api/subjects", {
            credentials: "include",
          }),
        ]);

      const [prioritiesData, subjectsData] =
        await Promise.all([
          prioritiesResponse.json().catch(() => ({})),
          subjectsResponse.json().catch(() => ({})),
        ]);

      if (!prioritiesResponse.ok) {
        throw new Error(
          prioritiesData.error || "Could not load subject priorities."
        );
      }

      if (!subjectsResponse.ok) {
        throw new Error(
          subjectsData.error || "Could not load subject performance."
        );
      }

      setPriorities(
        Array.isArray(prioritiesData.priorities)
          ? prioritiesData.priorities
          : []
      );

      setSubjects(
        Array.isArray(subjectsData.subjects)
          ? subjectsData.subjects
          : []
      );

      // Study activity is supplementary.
// Existing subject insights still work if analytics fails.
try {
  const analyticsResponse = await fetch(
    "/api/analytics/overview",
    { credentials: "include" }
  );

  if (analyticsResponse.ok) {
    const analyticsData = await analyticsResponse.json();

    setStudyActivity(
      Array.isArray(analyticsData.subjectBreakdown)
        ? analyticsData.subjectBreakdown
        : []
    );
  } else {
    setStudyActivity([]);
  }
} catch {
  setStudyActivity([]);
}
    } catch (err) {
      setError(err.message || "Could not load subject insights.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const subjectsById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );

  const assessedCount = subjects.filter(
    (subject) => displayNumber(subject.averagePercent) !== null
  ).length;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B47763]">
            LEARNING INTELLIGENCE
          </p>

          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-espresso sm:text-3xl">
            Subject{" "}
            <span className="font-serif italic text-[#C77761]">
              insights.
            </span>
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Understand your subject priorities using recorded
            performance, importance, and upcoming exams.
          </p>
        </div>

        <button
          type="button"
          onClick={loadInsights}
          disabled={loading}
          className="rounded-xl border border-[#D8CABF] bg-white px-5 py-3 text-xs font-semibold text-espresso transition hover:bg-sand disabled:opacity-50"
        >
          {loading ? "Loading..." : "↻ Refresh insights"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={loadInsights}
            className="mt-3 font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div role="status" className="mt-8 rounded-2xl bg-white p-8">
          <p className="text-sm text-muted">
            Calculating your subject priorities...
          </p>
        </div>
      ) : priorities.length === 0 ? (
        !error && (
          <div className="mt-8 rounded-2xl border border-[#E8DED5] bg-white p-8">
            <p className="text-sm font-semibold text-espresso">
              No subjects available yet
            </p>
            <p className="mt-2 text-sm text-muted">
              Add subjects to start viewing learning insights.
            </p>
          </div>
        )
      ) : (
        <>
          <div className="mt-7 flex flex-wrap gap-3">
            <div className="rounded-xl border border-[#E9DFD5] bg-white px-5 py-3">
              <p className="text-xs text-muted">Subjects ranked</p>
              <p className="mt-1 text-xl font-semibold text-espresso">
                {priorities.length}
              </p>
            </div>

            <div className="rounded-xl border border-[#E9DFD5] bg-white px-5 py-3">
              <p className="text-xs text-muted">With assessment data</p>
              <p className="mt-1 text-xl font-semibold text-espresso">
                {assessedCount} / {subjects.length}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {priorities.map((priority, index) => (
              <SubjectCard
                key={priority.subjectId}
                priority={priority}
                subject={subjectsById.get(priority.subjectId)}
                study={studyActivity.find(
                    (item) => item.subjectId === priority.subjectId
                )}
                rank={index + 1}
            />
            ))}
          </div>

          <p className="mt-5 text-xs leading-5 text-muted">
            Priority scores are relative ranking values, not
            academic grades. Missing assessment data is estimated
            for ranking purposes. Backlog and revision-due factors
            are not yet included in the calculation.
          </p>
        </>
      )}
    </section>
  );
}
