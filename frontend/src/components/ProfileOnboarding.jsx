
import { useEffect, useState } from "react";

const initialProfile = {
  educationLevel: "university",
  yearOrClass: "",
  semester: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  studyGoal: "",
  desiredGrade: "A",
  preferredSessionMin: 45,
  dailyStudyLimitMin: 240,
};

const inputStyle =
  "w-full rounded-xl border border-[#DED5CD] bg-white px-4 py-3 text-sm text-espresso outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20";

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-espresso">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs text-muted">
          {hint}
        </span>
      )}
    </label>
  );
}

export default function ProfileOnboarding({ children }) {
  const [profile, setProfile] = useState(initialProfile);
  const [checking, setChecking] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkProfile() {
      try {
        const response = await fetch("/api/profile", {
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load profile");
        }

        if (active && data.profile) {
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

    checkProfile();

    return () => {
      active = false;
    };
  }, []);

  function update(field, value) {
    setProfile((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    setError("");
    setSaving(true);

    try {
      const payload = {
        ...profile,
        yearOrClass: profile.yearOrClass.trim(),
        semester: profile.semester.trim(),
        studyGoal: profile.studyGoal.trim(),
        preferredSessionMin: Number(profile.preferredSessionMin),
        dailyStudyLimitMin: Number(profile.dailyStudyLimitMin),
      };

      const response = await fetch("/api/profile", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save profile");
      }

      setCompleted(true);
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
          Preparing your learning space...
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
            Getting started · 1 of 4
          </span>
        </header>

        <div className="mt-10 h-1.5 overflow-hidden rounded-full bg-sand">
          <div className="h-full w-1/4 rounded-full bg-coral" />
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="lg:pt-8">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47763]">
              YOUR LEARNING PROFILE
            </span>

            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.06em] text-espresso sm:text-5xl">
              A study plan
              <br />
              built around
              <br />
              <span className="font-serif italic text-[#C77761]">
                you.
              </span>
            </h1>

            <p className="mt-6 max-w-sm text-sm leading-7 text-muted">
              Tell us a little about your academic life.
              We'll use your goals and preferences to
              personalize your study schedule.
            </p>

            <div className="mt-10 rounded-2xl border border-[#E7D9CF] bg-[#F1E7DE] p-5">
              <p className="text-sm font-semibold text-espresso">
                Your pace matters.
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                You can change these preferences later
                as your goals and schedule evolve.
              </p>
            </div>
          </section>

          <section className="rounded-[24px] border border-[#E8DED5] bg-white p-6 shadow-[0_12px_40px_rgba(48,35,31,0.04)] sm:p-9">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-espresso">
                Academic details
              </h2>
              <p className="mt-2 text-sm text-muted">
                Let's start with the basics.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Field label="Education level">
                <select
                  className={inputStyle}
                  value={profile.educationLevel}
                  onChange={(e) => update("educationLevel", e.target.value)}
                >
                  <option value="school">School</option>
                  <option value="college">College</option>
                  <option value="university">University</option>
                </select>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Year or class">
                  <input
                    className={inputStyle}
                    value={profile.yearOrClass}
                    onChange={(e) => update("yearOrClass", e.target.value)}
                    placeholder="e.g. 4"
                    maxLength={50}
                  />
                </Field>

                <Field label="Semester">
                  <input
                    className={inputStyle}
                    value={profile.semester}
                    onChange={(e) => update("semester", e.target.value)}
                    placeholder="e.g. 7"
                    maxLength={50}
                  />
                </Field>
              </div>

              <Field label="Primary study goal">
                <select
                  className={inputStyle}
                  value={profile.studyGoal}
                  onChange={(e) => update("studyGoal", e.target.value)}
                >
                  <option value="">Select a goal</option>
                  <option value="Improve academic performance">
                    Improve academic performance
                  </option>
                  <option value="Prepare for exams">
                    Prepare for exams
                  </option>
                  <option value="Build consistent study habits">
                    Build consistent study habits
                  </option>
                  <option value="Manage study time better">
                    Manage study time better
                  </option>
                </select>
              </Field>

              <Field label="Desired grade">
                <select
                  className={inputStyle}
                  value={profile.desiredGrade}
                  onChange={(e) => update("desiredGrade", e.target.value)}
                >
                  <option value="A+">A+</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="Pass">Pass</option>
                </select>
              </Field>

              <div className="border-t border-[#EEE5DE] pt-7">
                <h3 className="text-lg font-semibold text-espresso">
                  Study preferences
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Choose a realistic pace for your routine.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Preferred session"
                  hint="How long you'd like to focus at once."
                >
                  <select
                    className={inputStyle}
                    value={profile.preferredSessionMin}
                    onChange={(e) =>
                      update("preferredSessionMin", Number(e.target.value))
                    }
                  >
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                  </select>
                </Field>

                <Field
                  label="Daily study limit"
                  hint="Maximum study time per day."
                >
                  <select
                    className={inputStyle}
                    value={profile.dailyStudyLimitMin}
                    onChange={(e) =>
                      update("dailyStudyLimitMin", Number(e.target.value))
                    }
                  >
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                    <option value={180}>3 hours</option>
                    <option value={240}>4 hours</option>
                    <option value={300}>5 hours</option>
                    <option value={360}>6 hours</option>
                  </select>
                </Field>
              </div>

              <Field
                label="Timezone"
                hint="Automatically detected. You can change it later."
              >
                <input
                  className={inputStyle}
                  value={profile.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                  required
                />
              </Field>

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
                className="w-full rounded-xl bg-espresso px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#48362F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving your profile..." : "Save and continue →"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
