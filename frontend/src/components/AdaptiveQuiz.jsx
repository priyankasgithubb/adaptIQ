import { useEffect, useState } from "react";
import QuizInsights from "./QuizInsights";

const buttonPrimary =
  "rounded-xl bg-espresso px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

const buttonSecondary =
  "rounded-xl border border-[#DED5CD] bg-white px-5 py-3 text-sm font-semibold text-espresso transition hover:bg-sand disabled:cursor-not-allowed disabled:opacity-50";

const difficultyStyles = {
  easy: "bg-[#E5F0E7] text-[#467551]",
  medium: "bg-[#FFF0D8] text-[#966A2E]",
  hard: "bg-[#F9E3E0] text-[#A2584F]",
};

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed (${response.status}).`
    );
  }

  return data;
}

export default function AdaptiveQuiz({ onBack }) {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");

  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [adaptive, setAdaptive] = useState(null);

  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadSubjects() {
      try {
        const response = await fetch("/api/subjects", {
          credentials: "include",
          signal: controller.signal,
        });

        const data = await readResponse(response);

        const availableSubjects = Array.isArray(data)
          ? data
          : Array.isArray(data.subjects)
            ? data.subjects
            : [];

        setSubjects(availableSubjects);

        if (availableSubjects.length > 0) {
          setSubjectId(availableSubjects[0].id);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSubjects(false);
        }
      }
    }

    loadSubjects();

    return () => controller.abort();
  }, []);

  const selectedSubject = subjects.find(
    (subject) => subject.id === subjectId
  );

  const currentQuestion = questions[currentIndex];

  const answeredCount = questions.filter(
    (question) =>
      Number.isInteger(answers[question.id])
  ).length;

  const allAnswered =
    questions.length > 0 &&
    answeredCount === questions.length;

  const progress =
    questions.length > 0
      ? (answeredCount / questions.length) * 100
      : 0;

  async function startQuiz() {
    if (!subjectId || starting) return;

    setStarting(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        "/api/quizzes/attempts",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subjectId }),
        }
      );

      const data = await readResponse(response);

      if (
        !data.attempt?.id ||
        !Array.isArray(data.questions) ||
        data.questions.length === 0
      ) {
        throw new Error(
          "The server returned an invalid quiz."
        );
      }

      setAttempt(data.attempt);
      setQuestions(data.questions);
      setAdaptive(data.adaptive || null);
      setAnswers({});
      setCurrentIndex(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  function selectAnswer(questionId, optionIndex) {
    if (result || submitting) return;

    setAnswers((previous) => ({
      ...previous,
      [questionId]: optionIndex,
    }));
  }

  async function submitQuiz() {
    if (
      !attempt ||
      !allAnswered ||
      submitting ||
      result
    ) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        answers: questions.map((question) => ({
          questionId: question.id,
          selectedOption: answers[question.id],
        })),
      };

      const response = await fetch(
        `/api/quizzes/attempts/${attempt.id}/submit`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await readResponse(response);

      if (!data.attempt || !Array.isArray(data.results)) {
        throw new Error(
          "The server returned an invalid quiz result."
        );
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetQuiz() {
    setAttempt(null);
    setQuestions([]);
    setAdaptive(null);
    setAnswers({});
    setCurrentIndex(0);
    setResult(null);
    setError("");
  }

  const score = Number(
    result?.attempt?.scorePercent ?? 0
  );

  const feedback =
    score >= 80
      ? "Excellent work! You're demonstrating a strong understanding."
      : score >= 50
        ? "Good progress. Review the questions you missed and keep practicing."
        : "Keep practicing. Review the explanations and try again.";

  return (
    <div className="min-h-screen bg-cream px-5 py-8 text-espresso sm:px-10">
      <main className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-2xl font-bold tracking-[-0.06em]">
            adapt<span className="text-coral">IQ</span>
          </div>

          <button
            type="button"
            onClick={onBack}
            className={buttonSecondary}
          >
            Back to overview
          </button>
        </header>

        {/* Page introduction */}
        <div className="mt-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47763]">
            ADAPTIVE LEARNING
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Practice smarter,{" "}
            <span className="font-serif italic text-[#C77761]">
              learn better.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">
            Test your understanding with subject-based quizzes.
            AdaptIQ adjusts the preferred question difficulty
            using your previous quiz performance.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Subject selection */}
        {!attempt && (
          <section className="mt-10 rounded-[24px] border border-[#E8DED5] bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  Start a practice quiz
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted">
                  Choose a subject to begin a quiz with up to
                  five multiple-choice questions.
                </p>
              </div>

              <span className="rounded-full bg-[#F2E4D9] px-4 py-2 text-xs font-semibold text-[#A36752]">
                Personalized practice
              </span>
            </div>

            {loadingSubjects ? (
              <p
                role="status"
                className="mt-8 text-sm text-muted"
              >
                Loading your subjects...
              </p>
            ) : subjects.length === 0 ? (
              <div className="mt-7 rounded-xl bg-[#FCF8F4] p-5">
                <p className="text-sm font-semibold">
                  No subjects available
                </p>

                <p className="mt-2 text-sm text-muted">
                  Add subjects in My Subjects before starting
                  a practice quiz.
                </p>
              </div>
            ) : (
              <>
                <label
                  htmlFor="quiz-subject"
                  className="mt-8 block text-sm font-semibold"
                >
                  Select subject
                </label>

                <select
                  id="quiz-subject"
                  value={subjectId}
                  onChange={(event) => {
                    setSubjectId(event.target.value);
                    setError("");
                  }}
                  className="mt-3 w-full rounded-xl border border-[#DED5CD] bg-[#FCFAF8] px-4 py-3 text-sm text-espresso outline-none focus:border-coral"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>

                <div className="mt-6 rounded-xl bg-[#FCF8F4] p-5">
                  <h3 className="text-sm font-semibold">
                    How your quiz adapts
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-muted">
                    Your latest completed quiz score determines
                    the preferred difficulty for your next quiz.
                    If there aren't enough questions at that
                    difficulty, other levels may be included.
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        level: "Easy",
                        detail: "Previous score below 50%",
                      },
                      {
                        level: "Medium",
                        detail: "Previous score 50–79%",
                      },
                      {
                        level: "Hard",
                        detail: "Previous score 80%+",
                      },
                    ].map((item) => (
                      <div
                        key={item.level}
                        className="rounded-xl border border-[#E9DFD5] bg-white p-4"
                      >
                        <p className="text-sm font-semibold">
                          {item.level}
                        </p>
                        <p className="mt-2 text-xs text-muted">
                          {item.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startQuiz}
                  disabled={!subjectId || starting}
                  className={`mt-7 ${buttonPrimary}`}
                >
                  {starting
                    ? "Preparing quiz..."
                    : "Start quiz"}
                </button>

                <p className="mt-4 text-xs text-muted">
                  Questions come from your subject's existing
                  practice-question bank. The bank must contain
                  at least one question.
                </p>
              </>
            )}
          </section>
        )}


        {/* Learning insights */}
        {!attempt && <QuizInsights />}
        {/* Active quiz */}
        {attempt && !result && currentQuestion && (
          <section className="mt-10 rounded-[24px] border border-[#E8DED5] bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#B47763]">
                  {selectedSubject?.name || "Practice quiz"}
                </p>

                <h2 className="mt-2 text-xl font-semibold">
                  Question {currentIndex + 1} of {questions.length}
                </h2>
              </div>

              {adaptive?.targetDifficulty && (
                <span
                  className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${
                    difficultyStyles[
                      adaptive.targetDifficulty
                    ] || difficultyStyles.easy
                  }`}
                >
                  Target: {adaptive.targetDifficulty}
                </span>
              )}
            </div>

            <div className="mt-7">
              <div className="flex justify-between text-xs text-muted">
                <span>Quiz progress</span>
                <span>
                  {answeredCount} / {questions.length} answered
                </span>
              </div>

              <div
                role="progressbar"
                aria-label="Quiz questions answered"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#F0E7DF]"
              >
                <div
                  className="h-full rounded-full bg-coral transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-10">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[#F2E4D9] px-3 py-1.5 text-xs font-semibold text-[#A36752]">
                  {currentQuestion.topic}
                </span>

                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                    difficultyStyles[
                      currentQuestion.difficulty
                    ] || difficultyStyles.easy
                  }`}
                >
                  {currentQuestion.difficulty}
                </span>
              </div>

              <h3 className="mt-6 text-xl font-semibold leading-relaxed sm:text-2xl">
                {currentQuestion.questionText}
              </h3>

              <div
                role="radiogroup"
                aria-label={`Answers for question ${currentIndex + 1}`}
                className="mt-7 space-y-3"
              >
                {(currentQuestion.options || []).map(
                  (option, index) => {
                    const selected =
                      answers[currentQuestion.id] === index;

                    return (
                      <label
                        key={index}
                        className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition ${
                          selected
                            ? "border-coral bg-[#FFF3EC]"
                            : "border-[#E9DFD5] bg-[#FCFAF8] hover:border-[#D8BBA9]"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          value={index}
                          checked={selected}
                          onChange={() =>
                            selectAnswer(
                              currentQuestion.id,
                              index
                            )
                          }
                          disabled={submitting}
                          className="accent-[#C77761]"
                        />

                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-[#A36752]">
                          {String.fromCharCode(65 + index)}
                        </span>

                        <span className="text-sm leading-6">
                          {option}
                        </span>
                      </label>
                    );
                  }
                )}
              </div>
            </div>

            <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0E7DF] pt-6">
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((index) =>
                    Math.max(0, index - 1)
                  )
                }
                disabled={currentIndex === 0 || submitting}
                className={buttonSecondary}
              >
                Previous
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCurrentIndex((index) =>
                      Math.min(
                        questions.length - 1,
                        index + 1
                      )
                    )
                  }
                  disabled={submitting}
                  className={buttonPrimary}
                >
                  Next question
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitQuiz}
                  disabled={!allAnswered || submitting}
                  className={buttonPrimary}
                >
                  {submitting
                    ? "Submitting..."
                    : "Submit quiz"}
                </button>
              )}
            </div>

            {!allAnswered &&
              currentIndex === questions.length - 1 && (
                <p className="mt-4 text-xs text-muted">
                  Answer all questions before submitting.
                  Use Previous to review unanswered questions.
                </p>
              )}
          </section>
        )}

        {/* Quiz results */}
        {result && (
          <section className="mt-10 space-y-6">
            <div className="rounded-[24px] bg-espresso p-7 text-white sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4A99A]">
                QUIZ COMPLETED
              </p>

              <h2 className="mt-4 text-3xl font-semibold">
                Your practice results
              </h2>

              <div className="mt-7 flex flex-wrap items-end gap-5">
                <p className="text-6xl font-semibold tracking-tight text-[#F4B29D]">
                  {score.toFixed(0)}%
                </p>

                <p className="pb-2 text-sm text-[#E8D4CB]">
                  {result.attempt.correctAnswers} correct out of{" "}
                  {result.attempt.totalQuestions}
                </p>
              </div>

              <p className="mt-5 max-w-xl text-sm leading-6 text-[#E8D4CB]">
                {feedback}
              </p>
            </div>

            <div className="rounded-[24px] border border-[#E8DED5] bg-white p-6 sm:p-8">
              <h3 className="text-xl font-semibold">
                Review your answers
              </h3>

              <p className="mt-2 text-sm text-muted">
                See which questions you answered correctly
                and review the explanations.
              </p>

              <div className="mt-7 space-y-5">
                {questions.map((question, index) => {
                  const answer = result.results.find(
                    (item) =>
                      item.questionId === question.id
                  );

                  const isCorrect =
                    answer?.isCorrect === true;

                  const selectedText =
                    question.options?.[
                      answer?.selectedOption
                    ] ?? "Unavailable";

                  const correctText =
                    question.options?.[
                      answer?.correctOption
                    ] ?? "Unavailable";

                  return (
                    <div
                      key={question.id}
                      className="rounded-xl border border-[#E9DFD5] bg-[#FCFAF8] p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-[#A36752]">
                          Question {index + 1}
                        </p>

                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            isCorrect
                              ? "bg-[#E5F0E7] text-[#467551]"
                              : "bg-[#F9E3E0] text-[#A2584F]"
                          }`}
                        >
                          {isCorrect
                            ? "Correct"
                            : "Needs review"}
                        </span>
                      </div>

                      <p className="mt-4 text-sm font-semibold leading-6">
                        {question.questionText}
                      </p>

                      <p className="mt-4 text-sm text-muted">
                        Your answer:{" "}
                        <span className="font-medium text-espresso">
                          {selectedText}
                        </span>
                      </p>

                      {!isCorrect && (
                        <p className="mt-2 text-sm text-muted">
                          Correct answer:{" "}
                          <span className="font-semibold text-[#467551]">
                            {correctText}
                          </span>
                        </p>
                      )}

                      {answer?.explanation && (
                        <div className="mt-4 rounded-lg bg-white p-4">
                          <p className="text-xs font-semibold text-[#A36752]">
                            Explanation
                          </p>

                          <p className="mt-2 text-sm leading-6 text-muted">
                            {answer.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={resetQuiz}
                className={buttonPrimary}
              >
                Take another quiz
              </button>

              <button
                type="button"
                onClick={onBack}
                className={buttonSecondary}
              >
                Back to overview
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
