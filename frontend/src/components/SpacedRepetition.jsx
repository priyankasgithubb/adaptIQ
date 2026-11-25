
import { useCallback, useEffect, useState } from "react";

const primaryButton =
  "rounded-xl bg-espresso px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButton =
  "rounded-xl border border-[#DED5CD] bg-white px-4 py-2.5 text-sm font-semibold text-espresso transition hover:bg-sand disabled:opacity-50";

const recallOptions = [
  { quality: 0, label: "0 · Forgot completely" },
  { quality: 1, label: "1 · Incorrect" },
  { quality: 2, label: "2 · Difficult recall" },
  { quality: 3, label: "3 · Remembered with difficulty" },
  { quality: 4, label: "4 · Remembered correctly" },
  { quality: 5, label: "5 · Remembered perfectly" },
];

function formatDate(value) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed (${response.status}).`
    );
  }

  return data;
}

function SummaryCard({ label, value, description }) {
  return (
    <div className="rounded-[20px] border border-[#E9DFD5] bg-white p-5">
      <p className="text-xs font-medium text-muted">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold text-espresso">
        {value}
      </p>

      <p className="mt-2 text-xs text-muted">
        {description}
      </p>
    </div>
  );
}

export default function SpacedRepetition({ onBack }) {
  const [subjects, setSubjects] = useState([]);
  const [cards, setCards] = useState([]);
  const [dueCards, setDueCards] = useState([]);

  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const [subjectData, cardData, dueData] =
        await Promise.all([
          apiRequest("/api/subjects"),
          apiRequest("/api/reviews/cards"),
          apiRequest("/api/reviews/due"),
        ]);

      const subjectList = Array.isArray(subjectData)
        ? subjectData
        : Array.isArray(subjectData.subjects)
          ? subjectData.subjects
          : [];

      setSubjects(subjectList);

      setSubjectId((previous) => {
        if (subjectList.some((item) => item.id === previous)) {
          return previous;
        }

        return subjectList[0]?.id || "";
      });

      setCards(
        Array.isArray(cardData.cards)
          ? cardData.cards
          : []
      );

      setDueCards(
        Array.isArray(dueData.dueCards)
          ? dueData.dueCards
          : []
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
    loadData();
  }, [loadData]);

  async function handleCreate(event) {
    event.preventDefault();

    if (creating || reviewingId || !subjectId || !topic.trim()) {
      return;
    }

    setCreating(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest("/api/reviews/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subjectId,
          topic: topic.trim(),
          notes: notes.trim() || null,
        }),
      });

      setTopic("");
      setNotes("");

      const refreshed = await loadData(true);

      if (refreshed) {
        setSuccess("Review topic added successfully.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleReview(card, quality) {
    if (reviewingId || creating) return;

    setReviewingId(card.id);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest(
        `/api/reviews/cards/${card.id}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ quality }),
        }
      );

      // Remove immediately from the due list so the
      // student cannot accidentally rate it twice.
      setDueCards((previous) =>
        previous.filter((item) => item.id !== card.id)
      );

      const refreshed = await loadData(true);

      if (refreshed) {
        setSuccess(
          `${card.topic} reviewed. Next review: ${formatDate(
            data.card.nextReviewAt
          )}.`
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewingId(null);
    }
  }

  const activeCount = cards.filter(
    (card) => card.status === "active"
  ).length;

  const reviewedCount = cards.filter(
    (card) => card.lastReviewedAt
  ).length;

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
            MEMORY & RETENTION
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Remember more,{" "}
            <span className="font-serif italic text-[#C77761]">
              review smarter.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">
            Build lasting knowledge by revisiting topics at
            increasing intervals. Rate your recall after each
            review, and AdaptIQ will calculate when to revisit
            that topic.
          </p>
        </section>

        {error && (
          <div
            role="alert"
            className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {success && !error && (
          <div
            role="status"
            className="mt-7 rounded-xl border border-[#CFE7D6] bg-[#EFF8F0] p-4 text-sm text-[#3F7654]"
          >
            {success}
          </div>
        )}

        {loading ? (
          <p role="status" className="mt-10 text-sm text-muted">
            Loading your review schedule...
          </p>
        ) : (
          <>
            {/* Statistics */}
            <section className="mt-10 grid gap-4 sm:grid-cols-3">
              <SummaryCard
                label="Due for review"
                value={dueCards.length}
                description="Topics ready to revise now"
              />

              <SummaryCard
                label="Active topics"
                value={activeCount}
                description="Topics in your review schedule"
              />

              <SummaryCard
                label="Topics practiced"
                value={reviewedCount}
                description="Cards reviewed at least once"
              />
            </section>

            {/* Due reviews */}
            <section className="mt-10 rounded-[24px] border border-[#E8DED5] bg-white p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B47763]">
                    TODAY'S PRIORITIES
                  </p>

                  <h2 className="mt-3 text-2xl font-semibold">
                    Due for review
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setSuccess("");
                    loadData();
                  }}
                  disabled={creating || Boolean(reviewingId)}
                  className={secondaryButton}
                >
                  Refresh
                </button>
              </div>

              {dueCards.length === 0 ? (
                <div className="mt-7 rounded-xl bg-[#FCF8F4] p-6">
                  <h3 className="text-base font-semibold">
                    You're all caught up!
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-muted">
                    There are no topics due right now.
                    Add a new topic below or return when
                    your next review is scheduled.
                  </p>
                </div>
              ) : (
                <div className="mt-7 space-y-5">
                  {dueCards.map((card) => (
                    <article
                      key={card.id}
                      className="rounded-2xl border border-[#E9DFD5] bg-[#FCFAF8] p-5 sm:p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-[#A36752]">
                            {card.subjectName}
                          </p>

                          <h3 className="mt-2 text-lg font-semibold">
                            {card.topic}
                          </h3>

                          {card.notes && (
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
                              {card.notes}
                            </p>
                          )}
                        </div>

                        <span className="rounded-full bg-[#FFF0D8] px-3 py-1.5 text-xs font-semibold text-[#966A2E]">
                          Due now
                        </span>
                      </div>

                      <div className="mt-5 border-t border-[#E9DFD5] pt-5">
                        <p className="text-sm font-semibold">
                          How well did you remember this topic?
                        </p>

                        <p className="mt-2 text-xs leading-5 text-muted">
                          Review the material first, then choose
                          your recall rating.
                        </p>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {recallOptions.map((option) => (
                            <button
                              key={option.quality}
                              type="button"
                              disabled={
                                Boolean(reviewingId) || creating
                              }
                              onClick={() =>
                                handleReview(
                                  card,
                                  option.quality
                                )
                              }
                              className="rounded-xl border border-[#DED5CD] bg-white px-4 py-3 text-left text-xs font-semibold transition hover:border-coral hover:bg-[#FFF3EC] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {reviewingId === card.id
                                ? "Saving review..."
                                : option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Create review card */}
            <section className="mt-8 rounded-[24px] border border-[#E8DED5] bg-white p-6 sm:p-8">
              <h2 className="text-2xl font-semibold">
                Add a review topic
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted">
                Choose something you've studied and want
                to remember. New topics are due immediately.
              </p>

              {subjects.length === 0 ? (
                <p className="mt-6 text-sm text-muted">
                  Add a subject in My Subjects first.
                </p>
              ) : (
                <form
                  onSubmit={handleCreate}
                  className="mt-7 space-y-5"
                >
                  <div>
                    <label
                      htmlFor="review-subject"
                      className="block text-sm font-semibold"
                    >
                      Subject
                    </label>

                    <select
                      id="review-subject"
                      value={subjectId}
                      onChange={(event) =>
                        setSubjectId(event.target.value)
                      }
                      disabled={creating}
                      className="mt-2 w-full rounded-xl border border-[#DED5CD] bg-[#FCFAF8] px-4 py-3 text-sm outline-none focus:border-coral"
                    >
                      {subjects.map((subject) => (
                        <option
                          key={subject.id}
                          value={subject.id}
                        >
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="review-topic"
                      className="block text-sm font-semibold"
                    >
                      Topic
                    </label>

                    <input
                      id="review-topic"
                      type="text"
                      required
                      maxLength={150}
                      value={topic}
                      onChange={(event) =>
                        setTopic(event.target.value)
                      }
                      disabled={creating}
                      placeholder="e.g. Quadratic equations"
                      className="mt-2 w-full rounded-xl border border-[#DED5CD] bg-[#FCFAF8] px-4 py-3 text-sm outline-none focus:border-coral"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="review-notes"
                      className="block text-sm font-semibold"
                    >
                      Review notes (optional)
                    </label>

                    <textarea
                      id="review-notes"
                      rows={3}
                      value={notes}
                      onChange={(event) =>
                        setNotes(event.target.value)
                      }
                      disabled={creating}
                      placeholder="What should you remember?"
                      className="mt-2 w-full rounded-xl border border-[#DED5CD] bg-[#FCFAF8] px-4 py-3 text-sm outline-none focus:border-coral"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      creating ||
                      Boolean(reviewingId) ||
                      !subjectId ||
                      !topic.trim()
                    }
                    className={primaryButton}
                  >
                    {creating
                      ? "Adding topic..."
                      : "Add review topic"}
                  </button>
                </form>
              )}
            </section>

            {/* All scheduled topics */}
            <section className="mt-8 rounded-[24px] border border-[#E8DED5] bg-white p-6 sm:p-8">
              <h2 className="text-2xl font-semibold">
                Your review schedule
              </h2>

              <p className="mt-2 text-sm text-muted">
                View your saved topics and upcoming
                review dates.
              </p>

              {cards.length === 0 ? (
                <p className="mt-6 text-sm text-muted">
                  No review topics created yet.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {cards.map((card) => {
                    const isDue = dueCards.some(
                      (item) => item.id === card.id
                    );

                    return (
                      <div
                        key={card.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E9DFD5] bg-[#FCFAF8] p-4"
                      >
                        <div>
                          <p className="text-xs font-semibold text-[#A36752]">
                            {card.subjectName}
                          </p>

                          <h3 className="mt-2 text-sm font-semibold">
                            {card.topic}
                          </h3>

                          <p className="mt-2 text-xs text-muted">
                            Next review:{" "}
                            {formatDate(card.nextReviewAt)}
                          </p>

                          <p className="mt-1 text-xs text-muted">
                            Interval: {card.intervalDays} days
                            {" · "}
                            Reviews: {card.repetitions}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            card.status === "paused"
                              ? "bg-[#F1E9E2] text-[#78665D]"
                              : isDue
                                ? "bg-[#FFF0D8] text-[#966A2E]"
                                : "bg-[#E5F0E7] text-[#467551]"
                          }`}
                        >
                          {card.status === "paused"
                            ? "Paused"
                            : isDue
                              ? "Due"
                              : "Scheduled"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <p className="mt-8 text-center text-xs leading-6 text-muted">
              Review intervals use an SM-2-inspired algorithm.
              Ratings and schedules are saved to PostgreSQL.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
