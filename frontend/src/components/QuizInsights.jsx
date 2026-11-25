import { useCallback, useEffect, useState } from "react";
import QuizReviewAction from "./QuizReviewAction";

function percentage(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0%";

  return `${Math.round(number)}%`;
}

function ProgressBar({ value }) {
  const amount = Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );

  return (
    <div
      role="progressbar"
      aria-valuenow={amount}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 overflow-hidden rounded-full bg-[#F0E7DF]"
    >
      <div
        className="h-full rounded-full bg-coral transition-all"
        style={{ width: `${amount}%` }}
      />
    </div>
  );
}

function SummaryCard({ label, value, detail }) {
  return (
    <div className="rounded-[20px] border border-[#E9DFD5] bg-white p-5">
      <p className="text-xs font-medium text-muted">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-espresso">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-muted">
        {detail}
      </p>
    </div>
  );
}

const levelStyles = {
  needs_practice: {
    label: "Needs practice",
    className: "bg-[#F9E3E0] text-[#A2584F]",
  },
  developing: {
    label: "Developing",
    className: "bg-[#FFF0D8] text-[#966A2E]",
  },
  strong: {
    label: "Strong",
    className: "bg-[#E5F0E7] text-[#467551]",
  },
  insufficient_data: {
    label: "More practice needed",
    className: "bg-[#F1E9E2] text-[#78665D]",
  },
};

export default function QuizInsights({ refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  const loadInsights = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/quizzes/insights",
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
              "Unable to load quiz insights."
          );
        }

        if (!payload.overview) {
          throw new Error(
            "The server returned incomplete quiz insights."
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

    loadInsights(controller.signal);

    return () => controller.abort();
  }, [loadInsights, refreshKey, reloadCount]);

  const overview = data?.overview || {};
  const subjects = data?.subjectBreakdown || [];
  const topics = data?.topicBreakdown || [];
  const focusTopics = data?.focusTopics || [];
  const recentAttempts = data?.recentAttempts || [];

  const hasQuizzes = Number(overview.totalQuizzes) > 0;

  const strongTopics = topics.filter(
    (topic) => topic.performanceLevel === "strong"
  );

  const developingTopics = topics.filter(
    (topic) => topic.performanceLevel === "developing"
  );

  const insufficientTopics = topics.filter(
    (topic) =>
      topic.performanceLevel === "insufficient_data"
  );

  return (
    <section
      aria-labelledby="quiz-insights-title"
      className="mt-10 space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B47763]">
            PERSONALIZED LEARNING
          </p>

          <h2
            id="quiz-insights-title"
            className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Your quiz insights
          </h2>

          <p className="mt-2 text-sm leading-6 text-muted">
            Discover your strengths, track your practice,
            and identify topics worth revisiting.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() =>
            setReloadCount((count) => count + 1)
          }
          className="rounded-xl border border-[#DED5CD] bg-white px-4 py-2.5 text-xs font-semibold text-espresso transition hover:bg-sand disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh insights"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {loading && !data && (
        <p role="status" className="text-sm text-muted">
          Loading your quiz performance...
        </p>
      )}

      {!loading && !data && !error && (
        <p className="text-sm text-muted">
          No quiz insights are available yet.
        </p>
      )}

      {data && (
        <>
          {!hasQuizzes ? (
            <div className="rounded-[22px] border border-[#E9DFD5] bg-white p-7">
              <h3 className="text-lg font-semibold">
                Your learning journey starts here.
              </h3>

              <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
                Complete your first practice quiz to unlock
                performance insights, topic recommendations,
                and subject-level progress.
              </p>
            </div>
          ) : (
            <>
              {/* Overall statistics */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  label="Overall accuracy"
                  value={percentage(
                    overview.overallAccuracy
                  )}
                  detail="Correct answers across completed quizzes"
                />

                <SummaryCard
                  label="Quizzes completed"
                  value={overview.totalQuizzes}
                  detail="Finished practice assessments"
                />

                <SummaryCard
                  label="Questions answered"
                  value={overview.answeredQuestions}
                  detail={`${overview.correctAnswers} answered correctly`}
                />

                <SummaryCard
                  label="Subjects practiced"
                  value={overview.subjectsPracticed}
                  detail="Subjects with completed quizzes"
                />
              </div>

              {/* Recommended focus areas */}
              <div className="rounded-[24px] border border-[#E8DED5] bg-white p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B47763]">
                      RECOMMENDED REVISION
                    </p>

                    <h3 className="mt-2 text-xl font-semibold">
                      Your focus areas
                    </h3>
                  </div>

                  <span className="rounded-full bg-[#F9E3E0] px-3 py-1.5 text-xs font-semibold text-[#A2584F]">
                    {focusTopics.length} priority topics
                  </span>
                </div>

                {focusTopics.length === 0 ? (
                  <p className="mt-6 text-sm leading-6 text-muted">
                    No topics currently meet the
                    needs-practice threshold. Keep practicing
                    to build a more reliable picture of
                    your progress.
                  </p>
                ) : (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {focusTopics.map((topic) => (
                      <div
                        key={`${topic.subjectId}-${topic.topic}`}
                        className="rounded-xl border border-[#F0DDD8] bg-[#FFFAF7] p-5"
                      >
                        <p className="text-xs font-semibold text-[#A36752]">
                          {topic.subjectName}
                        </p>

                        <h4 className="mt-2 text-base font-semibold text-espresso">
                          {topic.topic}
                        </h4>

                        <div className="mt-4 flex items-center justify-between text-xs">
                          <span className="text-muted">
                            Quiz accuracy
                          </span>

                          <span className="font-semibold text-[#A2584F]">
                            {percentage(
                              topic.accuracyPercent
                            )}
                          </span>
                        </div>

                        <div className="mt-2">
                          <ProgressBar
                            value={topic.accuracyPercent}
                          />
                        </div>

                        <p className="mt-3 text-xs text-muted">
                          {topic.correctAnswers} correct out of{" "}
                          {topic.answeredQuestions} answers
                        </p>

                        <p className="mt-4 text-sm leading-6 text-[#785B50]">
                          {topic.recommendation}
                        </p>

                        <QuizReviewAction
                            subjectId={topic.subjectId}
                            subjectName={topic.subjectName}
                            topic={topic.topic}
                            accuracyPercent={topic.accuracyPercent}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject performance */}
              <div className="rounded-[24px] border border-[#E8DED5] bg-white p-6 sm:p-8">
                <h3 className="text-xl font-semibold">
                  Performance by subject
                </h3>

                <p className="mt-2 text-sm leading-6 text-muted">
                  Compare your recorded practice accuracy
                  across subjects.
                </p>

                <div className="mt-7 space-y-6">
                  {subjects.map((subject) => (
                    <div key={subject.subjectId}>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {subject.subjectName}
                        </p>

                        <span className="text-sm font-semibold text-[#A36752]">
                          {percentage(
                            subject.accuracyPercent
                          )}
                        </span>
                      </div>

                      <ProgressBar
                        value={subject.accuracyPercent}
                      />

                      <p className="mt-2 text-xs text-muted">
                        {subject.quizCount} quizzes ·{" "}
                        {subject.correctAnswers}/
                        {subject.answeredQuestions} correct
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Topic breakdown */}
              <div className="rounded-[24px] border border-[#E8DED5] bg-white p-6 sm:p-8">
                <h3 className="text-xl font-semibold">
                  Topic-level insights
                </h3>

                <p className="mt-2 text-sm leading-6 text-muted">
                  Topics are classified after at least three
                  answered practice questions.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#E5F0E7] px-3 py-1.5 text-xs font-semibold text-[#467551]">
                    {strongTopics.length} strong
                  </span>

                  <span className="rounded-full bg-[#FFF0D8] px-3 py-1.5 text-xs font-semibold text-[#966A2E]">
                    {developingTopics.length} developing
                  </span>

                  <span className="rounded-full bg-[#F9E3E0] px-3 py-1.5 text-xs font-semibold text-[#A2584F]">
                    {focusTopics.length} priority
                  </span>

                  <span className="rounded-full bg-[#F1E9E2] px-3 py-1.5 text-xs font-semibold text-[#78665D]">
                    {insufficientTopics.length} awaiting data
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  {topics.map((topic) => {
                    const style =
                      levelStyles[topic.performanceLevel] ||
                      levelStyles.insufficient_data;

                    return (
                      <div
                        key={`${topic.subjectId}-${topic.topic}`}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E9DFD5] bg-[#FCFAF8] p-4"
                      >
                        <div>
                          <p className="text-sm font-semibold">
                            {topic.topic}
                          </p>

                          <p className="mt-1 text-xs text-muted">
                            {topic.subjectName} ·{" "}
                            {topic.answeredQuestions} answers
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">
                            {percentage(
                              topic.accuracyPercent
                            )}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${style.className}`}
                          >
                            {style.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent quizzes */}
              <div className="rounded-[24px] border border-[#E8DED5] bg-white p-6 sm:p-8">
                <h3 className="text-xl font-semibold">
                  Recent quiz scores
                </h3>

                <p className="mt-2 text-sm text-muted">
                  Your latest completed practice quizzes.
                </p>

                <div className="mt-6 space-y-3">
                  {recentAttempts.map((attempt) => (
                    <div
                      key={attempt.attemptId}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E9DFD5] bg-[#FCFAF8] p-4"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {attempt.subjectName}
                        </p>

                        <p className="mt-1 text-xs text-muted">
                          {attempt.correctAnswers}/
                          {attempt.totalQuestions} correct
                          {" · "}
                          {attempt.completedAt
                            ? new Date(
                                attempt.completedAt
                              ).toLocaleDateString()
                            : "Date unavailable"}
                        </p>
                      </div>

                      <span className="text-xl font-semibold text-[#A36752]">
                        {percentage(
                          attempt.scorePercent
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs leading-6 text-muted">
                Insights are based on completed practice
                quizzes. Repeated questions and small sample
                sizes can affect accuracy. These results
                indicate practice performance, not verified
                subject mastery.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
