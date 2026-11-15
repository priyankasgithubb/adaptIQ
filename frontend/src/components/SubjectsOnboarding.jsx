
import { useEffect, useState } from "react";

const inputClass =
  "w-full rounded-xl border border-[#DED5CD] bg-white px-4 py-3 text-sm text-espresso outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20";

const initialSubject = {
  name: "",
  weight: 1,
  targetScore: 90,
  status: "unknown",
};

export default function SubjectsOnboarding({ children }) {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(initialSubject);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSubjects() {
      try {
        const response = await fetch("/api/subjects", {
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load subjects");
        }

        if (active) {
          const existing = data.subjects || [];
          setSubjects(existing);

          if (existing.length > 0) {
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

    loadSubjects();

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

  async function addSubject(event) {
    event.preventDefault();

    if (saving) return;

    setError("");

    const name = form.name.trim();

    if (!name) {
      setError("Please enter a subject name.");
      return;
    }

    if (
      subjects.some(
        (subject) =>
          subject.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      setError("You've already added this subject.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/subjects", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          weight: Number(form.weight),
          targetScore: Number(form.targetScore),
          status: form.status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not add subject");
      }

      setSubjects((previous) => [
        ...previous,
        data.subject,
      ]);

      setForm(initialSubject);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeSubject(id) {
    if (saving) return;

    setError("");
    setSaving(true);

    try {
      const response = await fetch(`/api/subjects/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not remove subject");
      }

      setSubjects((previous) =>
        previous.filter((subject) => subject.id !== id)
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
          Loading your subjects...
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
            Getting started · 2 of 4
          </span>
        </header>

        <div className="mt-10 h-1.5 overflow-hidden rounded-full bg-sand">
          <div className="h-full w-1/2 rounded-full bg-coral" />
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="lg:pt-8">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47763]">
              YOUR SUBJECTS
            </span>

            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.06em] text-espresso sm:text-5xl">
              Every subject,
              <br />
              its own
              <br />
              <span className="font-serif italic text-[#C77761]">
                priority.
              </span>
            </h1>

            <p className="mt-6 max-w-sm text-sm leading-7 text-muted">
              Add the subjects you're studying. AdaptIQ
              will use your goals, current strengths,
              and learning priorities when planning
              your week.
            </p>

            <div className="mt-10 rounded-2xl border border-[#E7D9CF] bg-[#F1E7DE] p-5">
              <p className="text-sm font-semibold text-espresso">
                Start with what matters.
              </p>

              <p className="mt-2 text-sm leading-6 text-muted">
                You can add more subjects later.
                For now, include at least one subject
                to continue.
              </p>
            </div>
          </section>

          <section className="rounded-[24px] border border-[#E8DED5] bg-white p-6 shadow-[0_12px_40px_rgba(48,35,31,0.04)] sm:p-9">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-espresso">
                Add your subjects
              </h2>

              <p className="mt-2 text-sm text-muted">
                Build your personalized subject list.
              </p>
            </div>

            <form onSubmit={addSubject} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-espresso">
                  Subject name
                </span>

                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Mathematics"
                  maxLength={80}
                  required
                />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-espresso">
                    Current confidence
                  </span>

                  <select
                    className={inputClass}
                    value={form.status}
                    onChange={(e) => update("status", e.target.value)}
                  >
                    <option value="unknown">Not sure yet</option>
                    <option value="weak">Needs improvement</option>
                    <option value="strong">Confident</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-espresso">
                    Target score (%)
                  </span>

                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={form.targetScore}
                    onChange={(e) =>
                      update("targetScore", e.target.value)
                    }
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-espresso">
                  Subject importance
                </span>

                <select
                  className={inputClass}
                  value={form.weight}
                  onChange={(e) =>
                    update("weight", Number(e.target.value))
                  }
                >
                  <option value={1}>Normal priority</option>
                  <option value={3}>Moderately important</option>
                  <option value={5}>High importance</option>
                  <option value={10}>Very high importance</option>
                </select>
              </label>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl border border-espresso bg-white px-5 py-3.5 text-sm font-semibold text-espresso transition hover:bg-cream disabled:opacity-50"
              >
                {saving ? "Saving..." : "+ Add subject"}
              </button>
            </form>

            <div className="mt-9 border-t border-[#EEE5DE] pt-7">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-espresso">
                  Your subjects
                </h3>

                <span className="rounded-full bg-[#F4E9E1] px-3 py-1 text-xs font-semibold text-[#947265]">
                  {subjects.length} added
                </span>
              </div>

              {subjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#DED5CD] bg-[#FCFAF8] p-6 text-center">
                  <p className="text-sm font-medium text-espresso">
                    No subjects added yet
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    Add your first subject above.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {subjects.map((subject) => (
                    <div
                      key={subject.id}
                      className="flex items-center gap-3 rounded-xl border border-[#EAE1D9] bg-[#FCFAF8] p-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1DDD2] text-sm font-bold text-espresso">
                        {subject.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-espresso">
                          {subject.name}
                        </p>

                        <p className="mt-1 text-xs text-muted">
                          Target: {subject.targetScore ?? "—"}%
                          {" · "}
                          {subject.status === "weak"
                            ? "Needs improvement"
                            : subject.status === "strong"
                              ? "Confident"
                              : "Not assessed"}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => removeSubject(subject.id)}
                        className="rounded-lg px-2.5 py-2 text-xs font-semibold text-[#A45D50] transition hover:bg-[#F6E5DE] disabled:opacity-50"
                        aria-label={`Remove ${subject.name}`}
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
              disabled={subjects.length === 0 || saving}
              onClick={() => setCompleted(true)}
              className="mt-8 w-full rounded-xl bg-espresso px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#48362F] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue to availability
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
