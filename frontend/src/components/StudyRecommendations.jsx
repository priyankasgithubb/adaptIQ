
import { useCallback, useEffect, useState } from "react";

const urgencyStyles = {
  high: {
    label: "High priority",
    badge: "bg-[#F9E3E0] text-[#A2584F]",
    border: "border-[#EBCAC5]",
  },
  medium: {
    label: "Medium priority",
    badge: "bg-[#FFF0D8] text-[#966A2E]",
    border: "border-[#E9DFD5]",
  },
  low: {
    label: "Low priority",
    badge: "bg-[#E5F0E7] text-[#467551]",
    border: "border-[#E9DFD5]",
  },
};

const secondaryButton =
  "rounded-xl border border-[#DED5CD] bg-white px-5 py-3 text-sm font-semibold text-espresso transition hover:bg-sand disabled:cursor-not-allowed disabled:opacity-50";

function clamp(value) {
  return Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );
}

function SummaryCard({ label, value, description }) {
  return (
    <div className="rounded-[20px] border border-[#E9DFD5] bg-white p-5">
      <p className="text-xs font-medium text-muted">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-espresso">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-muted">
        {description}
      </p>
    </div>
  );
}

function RecommendationCard({ item, rank }) {
  const style =
    urgencyStyles[item.urgency] || urgencyStyles.low;

  const score = clamp(item.recommendationScore);

  return (
    <article
      className={`rounded-[22px] border bg-white p-6 sm:p-7 ${style.border}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F5EAE2] text-sm font-bold text-[#A36752]">
            {rank}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#B47763]">
              STUDY PRIORITY
            </p>

            <h3 className="mt-2 text-xl font-semibold tracking-tight text-espresso">
              {item.subjectName}
            </h3>
          </div>
        </div>

        <span
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${style.badge}`}
        >
          {style.label}
        </span>
      </div>

      <div className="mt-7 rounded-xl bg-[#FCF8F4] p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-[#785B50]">
            Recommendation priority score
          </p>

          <span className="text-lg font-semibold text-espresso">
            {Math.round(score)}/100
          </span>
        </div>

        <div
          role="progressbar"
          aria-label={`Priority score for ${item.subjectName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#EADFD7]"
        >
          <div
            className="h-full rounded-full bg-coral transition-all"
            style={{ width: `${score}%` }}
          />
        </div>

        <p className="mt-3 text-xs leading-5 text-muted">
          This is a relative study-priority score,
          not a measure of your ability or mastery.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#E9DFD5] p-4">
          <p className="text-xs text-muted">
            Quiz accuracy
          </p>

          <p className="mt-2 text-xl font-semibold">
            {item.quizAccuracy == null
              ? "No data"
              : `${Math.round(clamp(item.quizAccuracy))}%`}
          </p>
        </div>

        <div className="rounded-xl border border-[#E9DFD5] p-4">
          <p className="text-xs text-muted">
            Reviews due
          </p>

          <p className="mt-2 text-xl font-semibold">
            {item.dueReviews ?? 0}
          </p>
        </div>
      </div>

      <div className="mt-7">
        <h4 className="text-sm font-semibold">
          Why AdaptIQ recommends this
        </h4>

        <ul className="mt-4 space-y-3">
          {(item.reasons || []).map((reason, index) => (
            <li
              key={index}
              className="flex items-start gap-3 text-sm leading-6 text-muted"
            >
              <span
                aria-hidden="true"
                className="mt-2 h-2 w-2 shrink-0 rounded-full bg-coral"
              />

              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {Array.isArray(item.weakTopics) &&
        item.weakTopics.length > 0 && (
          <div className="mt-7 border-t border-[#F0E7DF] pt-6">
            <p className="text-sm font-semibold">
              Topics to focus on
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {item.weakTopics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full bg-[#FFF0E8] px-3 py-2 text-xs font-medium text-[#A36752]"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
    </article>
  );
}

export default function StudyRecommendations({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  const loadRecommendations = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/recommendations",
          {
            credentials: "include",
            signal,
          }
        );

        const payload = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload.error ||
              "Unable to load study recommendations."
          );
        }

        if (
          !payload.summary ||
          !Array.isArray(payload.recommendations)
        ) {
          throw new Error(
            "The server returned incomplete recommendation data."
          );
        }

        if (!signal.aborted) {
          setData(payload);
        }
      } catch (err) {
        if (!signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    loadRecommendations(controller.signal);

    return () => controller.abort();
  }, [loadRecommendations, refreshKey]);

  const summary = data?.summary || {};

  const recommendations = data?.recommendations || [];

  const generatedDate = data?.generatedAt
    ? new Date(data.generatedAt)
    : null;

  const validDate =
    generatedDate &&
    !Number.isNaN(generatedDate.getTime());

  return (
    <div className="min-h-screen bg-cream px-5 py-8 text-espresso sm:px-10">
      <main className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-2xl font-bold tracking-[-0.06em]">
            adapt<span className="text-coral">IQ</span>
          </div>

          <button
            type="button"
            onClick={onBack}
            className={secondaryButton}
          >
            Back to overview
          </button>
        </header>

        <section className="mt-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47763]">
            YOUR PERSONALIZED STUDY GUIDE
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Know what to study{" "}
            <span className="font-serif italic text-[#C77761]">
              next.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">
            AdaptIQ combines your quiz performance,
            revision schedule, and study priorities to
            suggest where you could focus your effort.
          </p>
        </section>

        {error && (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p>{error}</p>

            <button
              type="button"
              onClick={() =>
                setRefreshKey((value) => value + 1)
              }
              className="mt-3 text-xs font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        <div className="mt-9 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-muted">
            {validDate
              ? `Generated ${generatedDate.toLocaleString()}`
              : "Recommendations update with your study data."}
          </p>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              setRefreshKey((value) => value + 1)
            }
            className={secondaryButton}
          >
            {loading
              ? "Refreshing..."
              : "Refresh recommendations"}
          </button>
        </div>

        {loading && !data && (
          <p role="status" className="mt-10 text-sm text-muted">
            Analyzing your study activity...
          </p>
        )}

        {data && (
          <>
            <section
              aria-label="Recommendations summary"
              className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <SummaryCard
                label="Study recommendations"
                value={summary.totalRecommendations ?? 0}
                description="Subjects with suggested next steps"
              />

              <SummaryCard
                label="High-priority subjects"
                value={summary.highPriority ?? 0}
                description="Subjects ranked as most urgent"
              />

              <SummaryCard
                label="Reviews due"
                value={summary.totalDueReviews ?? 0}
                description="Topics ready for spaced repetition"
              />

              <SummaryCard
                label="Subjects with quiz results"
                value={summary.subjectsWithQuizData ?? 0}
                description="Subjects with completed practice quizzes"
              />
            </section>

            <section className="mt-10">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Your recommended priorities
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-muted">
                    Ranked by learning gaps, reviews due,
                    existing planner priorities, and weak topics.
                  </p>
                </div>

                <span className="rounded-full bg-[#F2E4D9] px-4 py-2 text-xs font-semibold text-[#A36752]">
                  {recommendations.length} recommendations
                </span>
              </div>

              {recommendations.length === 0 ? (
                <div className="mt-6 rounded-[22px] border border-[#E8DED5] bg-white p-8">
                  <h3 className="text-lg font-semibold">
                    No study recommendations yet
                  </h3>

                  <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
                    AdaptIQ hasn't identified any actionable
                    priorities from your current data. Add
                    subjects, record assessments, complete
                    quizzes, or create revision topics to
                    generate more personalized suggestions.
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  {recommendations.map((item, index) => (
                    <RecommendationCard
                      key={item.subjectId}
                      item={item}
                      rank={index + 1}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10 rounded-[22px] border border-[#E8DED5] bg-[#FCF8F4] p-6 sm:p-7">
              <h2 className="text-base font-semibold">
                How recommendations are calculated
              </h2>

              <p className="mt-3 text-sm leading-7 text-muted">
                The system uses a rule-based score
                combining quiz performance (up to 40
                points), due spaced repetition reviews
                (up to 30), planner priorities (up to 20),
                and weak topics (up to 10).
              </p>

              <p className="mt-3 text-sm leading-7 text-muted">
                These are suggestions based on recorded
                study activity, not machine-learning
                predictions or verified assessments of
                knowledge. You remain in control of
                your study schedule.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
