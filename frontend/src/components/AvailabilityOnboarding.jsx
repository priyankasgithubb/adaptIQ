
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

const TYPES = {
  free: "Available to study",
  class: "Class / lecture",
  fixed: "Other commitment",
  blocked: "Unavailable",
};

const initialForm = {
  kind: "free",
  title: "Study time",
  weekday: 0,
  startTime: "16:00",
  endTime: "18:00",
};

const inputClass =
  "w-full rounded-xl border border-[#DED5CD] bg-white px-4 py-3 text-sm text-espresso outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-espresso">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function AvailabilityOnboarding({ children }) {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  const freeCount = entries.filter(
    (entry) => entry.kind === "free"
  ).length;

  useEffect(() => {
    let active = true;

    async function loadCommitments() {
      try {
        const response = await fetch("/api/commitments", {
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Could not load your schedule"
          );
        }

        if (active) {
          const existing = data.commitments || [];
          setEntries(existing);

          // Returning users with free time already saved
          // can continue without repeating onboarding.
          if (existing.some((entry) => entry.kind === "free")) {
            setCompleted(true);
          }
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

    loadCommitments();

    return () => {
      active = false;
    };
  }, []);

  function update(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function changeKind(value) {
    setForm((previous) => ({
      ...previous,
      kind: value,
      title:
        value === "free"
          ? "Study time"
          : value === "class"
            ? "Class"
            : value === "fixed"
              ? "Other commitment"
              : "Unavailable",
    }));
  }

  async function addEntry(event) {
    event.preventDefault();

    if (saving) return;

    setError("");

    if (form.endTime <= form.startTime) {
      setError("End time must be later than start time.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/commitments", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: form.kind,
          title: form.title.trim(),
          weekday: Number(form.weekday),
          startTime: form.startTime,
          endTime: form.endTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not save this time slot"
        );
      }

      setEntries((previous) =>
        [...previous, data.commitment].sort(
          (a, b) =>
            a.weekday - b.weekday ||
            a.startTime.localeCompare(b.startTime)
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id) {
    if (saving) return;

    setError("");
    setSaving(true);

    try {
      const response = await fetch(
        `/api/commitments/${id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not remove time slot"
        );
      }

      setEntries((previous) =>
        previous.filter((entry) => entry.id !== id)
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-sm text-muted">
          Preparing your weekly schedule...
        </p>
      </div>
    );
  }

  if (completed) {
    return children;
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-8 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <div className="text-2xl font-bold tracking-[-0.06em] text-espresso">
            adapt<span className="text-coral">IQ</span>
          </div>

          <span className="rounded-full border border-[#E0D4C9] px-4 py-2 text-xs font-semibold text-muted">
            Getting started · 3 of 4
          </span>
        </header>

        <div className="mt-10 h-1.5 overflow-hidden rounded-full bg-sand">
          <div className="h-full w-3/4 rounded-full bg-coral" />
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="lg:pt-8">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47763]">
              YOUR WEEKLY ROUTINE
            </span>

            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.06em] text-espresso sm:text-5xl">
              Your time,
              <br />
              your
              <br />
              <span className="font-serif italic text-[#C77761]">
                rhythm.
              </span>
            </h1>

            <p className="mt-6 max-w-sm text-sm leading-7 text-muted">
              Tell AdaptIQ when you're available to study.
              Add your classes and other commitments so your
              timetable fits around your existing routine.
            </p>

            <div className="mt-10 rounded-2xl border border-[#E7D9CF] bg-[#F1E7DE] p-5">
              <p className="text-sm font-semibold text-espresso">
                Leave room to recharge.
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                You don't have to fill every hour.
                Add realistic study windows and AdaptIQ
                will plan within them.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-[#E7D9CF] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Saved availability
              </p>

              <p className="mt-2 text-3xl font-semibold text-espresso">
                {freeCount}
                <span className="ml-2 text-sm font-normal text-muted">
                  study windows
                </span>
              </p>
            </div>
          </section>

          <section className="rounded-[24px] border border-[#E8DED5] bg-white p-6 shadow-[0_12px_40px_rgba(48,35,31,0.04)] sm:p-9">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-espresso">
                Build your weekly schedule
              </h2>

              <p className="mt-2 text-sm text-muted">
                Add recurring study time, classes, and commitments.
              </p>
            </div>

            <form onSubmit={addEntry} className="space-y-5">
              <Field label="What kind of time is this?">
                <select
                  className={inputClass}
                  value={form.kind}
                  onChange={(e) => changeKind(e.target.value)}
                >
                  {Object.entries(TYPES).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="Title">
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(e) =>
                    update("title", e.target.value)
                  }
                  placeholder="e.g. Study time"
                  maxLength={80}
                  required
                />
              </Field>

              <Field label="Day">
                <select
                  className={inputClass}
                  value={form.weekday}
                  onChange={(e) =>
                    update("weekday", Number(e.target.value))
                  }
                >
                  {DAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Start time">
                  <input
                    type="time"
                    className={inputClass}
                    value={form.startTime}
                    onChange={(e) =>
                      update("startTime", e.target.value)
                    }
                    required
                  />
                </Field>

                <Field label="End time">
                  <input
                    type="time"
                    className={inputClass}
                    value={form.endTime}
                    onChange={(e) =>
                      update("endTime", e.target.value)
                    }
                    required
                  />
                </Field>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl border border-espresso bg-white px-5 py-3.5 text-sm font-semibold text-espresso transition hover:bg-cream disabled:opacity-50"
              >
                {saving ? "Saving..." : "+ Add time slot"}
              </button>
            </form>

            <div className="mt-9 border-t border-[#EEE5DE] pt-7">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-espresso">
                  Your weekly routine
                </h3>

                <span className="rounded-full bg-[#F4E9E1] px-3 py-1 text-xs font-semibold text-[#947265]">
                  {entries.length} saved
                </span>
              </div>

              {entries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#DED5CD] bg-[#FCFAF8] p-6 text-center">
                  <p className="text-sm font-medium text-espresso">
                    No time slots yet
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    Add your first study window above.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 rounded-xl border border-[#EAE1D9] bg-[#FCFAF8] p-4"
                    >
                      <div
                        className={`h-11 w-1 shrink-0 rounded-full ${
                          entry.kind === "free"
                            ? "bg-[#73A38B]"
                            : entry.kind === "class"
                              ? "bg-coral"
                              : "bg-[#B5A79D]"
                        }`}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-espresso">
                          {entry.title}
                        </p>

                        <p className="mt-1 text-xs text-muted">
                          {DAYS[entry.weekday]} ·{" "}
                          {entry.startTime}–{entry.endTime}
                        </p>

                        <p className="mt-1 text-xs text-[#A17A6D]">
                          {TYPES[entry.kind]}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => removeEntry(entry.id)}
                        className="rounded-lg px-2.5 py-2 text-xs font-semibold text-[#A45D50] transition hover:bg-[#F6E5DE] disabled:opacity-50"
                        aria-label={`Remove ${entry.title}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={freeCount === 0 || saving}
              onClick={() => setCompleted(true)}
              className="mt-8 w-full rounded-xl bg-espresso px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#48362F] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue to study plan
            </button>

            {freeCount === 0 && (
              <p className="mt-3 text-center text-xs text-muted">
                Add at least one available study window to continue.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
