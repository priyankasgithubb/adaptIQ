
import { useEffect, useState } from "react";

const inputClass =
  "w-full rounded-xl border border-[#DED5CD] bg-white px-4 py-3 text-sm text-espresso outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:opacity-60";

const initialProfile = {
  educationLevel: "university",
  yearOrClass: "",
  semester: "",
  timezone:
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  studyGoal: "",
  desiredGrade: "A",
  preferredSessionMin: 45,
  dailyStudyLimitMin: 240,
};

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-espresso">
        {label}
      </span>

      {children}

      {hint && (
        <span className="mt-2 block text-xs leading-5 text-muted">
          {hint}
        </span>
      )}
    </label>
  );
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed (${response.status})`
    );
  }

  return data;
}

export default function ManageProfile({
  user,
  onBack,
  onLogout,
  logoutLoading,
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [originalProfile, setOriginalProfile] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const data = await request("/api/profile");

        if (!active) return;

        if (data.profile) {
          const loaded = {
            ...initialProfile,
            ...data.profile,
            yearOrClass: data.profile.yearOrClass ?? "",
            semester: data.profile.semester ?? "",
            studyGoal: data.profile.studyGoal ?? "",
            desiredGrade: data.profile.desiredGrade ?? "",
          };

          setProfile(loaded);
          setOriginalProfile(loaded);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  function update(field, value) {
    setProfile((previous) => ({
      ...previous,
      [field]: value,
    }));

    setMessage("");
  }

  function resetChanges() {
    if (!originalProfile || saving) return;

    setProfile({ ...originalProfile });
    setError("");
    setMessage("");
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        educationLevel: profile.educationLevel,
        yearOrClass: profile.yearOrClass.trim(),
        semester: profile.semester.trim(),
        timezone: profile.timezone.trim(),
        studyGoal: profile.studyGoal.trim(),
        desiredGrade: profile.desiredGrade.trim(),
        preferredSessionMin: Number(
          profile.preferredSessionMin
        ),
        dailyStudyLimitMin: Number(
          profile.dailyStudyLimitMin
        ),
      };

      // Preserve optional preferences already saved
      // by the backend, even though this form doesn't
      // expose them yet.
      if (profile.sleepStart) {
        payload.sleepStart = profile.sleepStart;
      }

      if (profile.sleepEnd) {
        payload.sleepEnd = profile.sleepEnd;
      }

      if (profile.breakPreferences) {
        payload.breakPreferences =
          profile.breakPreferences;
      }

      const data = await request("/api/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      const saved = {
        ...initialProfile,
        ...data.profile,
        yearOrClass: data.profile.yearOrClass ?? "",
        semester: data.profile.semester ?? "",
        studyGoal: data.profile.studyGoal ?? "",
        desiredGrade: data.profile.desiredGrade ?? "",
      };

      setProfile(saved);
      setOriginalProfile(saved);
      setMessage("Your academic profile has been updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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

      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-10">
        <nav
          aria-label="Workspace navigation"
          className="mb-9 flex flex-wrap gap-2"
        >
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-[#E5DAD0] bg-white px-5 py-3 text-sm font-semibold text-muted transition hover:bg-sand"
          >
            Overview
          </button>

          <span
            aria-current="page"
            className="rounded-xl bg-espresso px-5 py-3 text-sm font-semibold text-white"
          >
            Study Settings
          </span>
        </nav>

        <div className="mb-9">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47763]">
            PERSONALIZE YOUR LEARNING
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Study{" "}
            <span className="font-serif italic text-[#C77761]">
              settings.
            </span>
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
            Your goals and routine can change. Keep your
            academic profile up to date so AdaptIQ can
            plan around your needs.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-[#D0E7D6] bg-[#EFF8F0] p-4 text-sm text-[#3F7654]"
          >
            {message}
          </div>
        )}

        {loading ? (
          <div
            role="status"
            className="rounded-2xl bg-white p-8 text-sm text-muted"
          >
            Loading your academic profile...
          </div>
        ) : (
          <form onSubmit={saveProfile} className="space-y-6">
            <section className="rounded-[22px] border border-[#E8DED5] bg-white p-6 sm:p-8">
              <div className="mb-7">
                <h2 className="text-xl font-semibold">
                  Academic information
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Tell AdaptIQ where you are in your studies.
                </p>
              </div>

              <div className="space-y-5">
                <Field label="Education level">
                  <select
                    className={inputClass}
                    value={profile.educationLevel}
                    onChange={(e) =>
                      update("educationLevel", e.target.value)
                    }
                    disabled={saving}
                  >
                    <option value="school">School</option>
                    <option value="college">College</option>
                    <option value="university">University</option>
                  </select>
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Year or class">
                    <input
                      className={inputClass}
                      value={profile.yearOrClass}
                      onChange={(e) =>
                        update("yearOrClass", e.target.value)
                      }
                      placeholder="e.g. 4"
                      maxLength={50}
                      disabled={saving}
                    />
                  </Field>

                  <Field label="Semester">
                    <input
                      className={inputClass}
                      value={profile.semester}
                      onChange={(e) =>
                        update("semester", e.target.value)
                      }
                      placeholder="e.g. 7"
                      maxLength={50}
                      disabled={saving}
                    />
                  </Field>
                </div>

                <Field label="Primary study goal">
                  <select
                    className={inputClass}
                    value={profile.studyGoal}
                    onChange={(e) =>
                      update("studyGoal", e.target.value)
                    }
                    disabled={saving}
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
                    {profile.studyGoal &&
                      ![
                        "Improve academic performance",
                        "Prepare for exams",
                        "Build consistent study habits",
                        "Manage study time better",
                      ].includes(profile.studyGoal) && (
                        <option value={profile.studyGoal}>
                          {profile.studyGoal}
                        </option>
                      )}
                  </select>
                </Field>

                <Field label="Desired grade">
                  <select
                    className={inputClass}
                    value={profile.desiredGrade}
                    onChange={(e) =>
                      update("desiredGrade", e.target.value)
                    }
                    disabled={saving}
                  >
                    <option value="">Not specified</option>
                    <option value="A+">A+</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="Pass">Pass</option>
                    {profile.desiredGrade &&
                      !["A+", "A", "B", "C", "Pass"].includes(
                        profile.desiredGrade
                      ) && (
                        <option value={profile.desiredGrade}>
                          {profile.desiredGrade}
                        </option>
                      )}
                  </select>
                </Field>
              </div>
            </section>

            <section className="rounded-[22px] border border-[#E8DED5] bg-white p-6 sm:p-8">
              <div className="mb-7">
                <h2 className="text-xl font-semibold">
                  Study preferences
                </h2>

                <p className="mt-2 text-sm text-muted">
                  Choose a sustainable pace for your weekly
                  study plan.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Preferred study session"
                  hint="Your ideal focus-session duration."
                >
                  <select
                    className={inputClass}
                    value={profile.preferredSessionMin}
                    onChange={(e) =>
                      update(
                        "preferredSessionMin",
                        Number(e.target.value)
                      )
                    }
                    disabled={saving}
                  >
                    {[15, 30, 45, 60, 90, 120, 180].map(
                      (minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes} minutes
                        </option>
                      )
                    )}
                    {![15, 30, 45, 60, 90, 120, 180].includes(
                      Number(profile.preferredSessionMin)
                    ) && (
                      <option value={profile.preferredSessionMin}>
                        {profile.preferredSessionMin} minutes
                      </option>
                    )}
                  </select>
                </Field>

                <Field
                  label="Daily study limit"
                  hint="The maximum time AdaptIQ should schedule per day."
                >
                  <select
                    className={inputClass}
                    value={profile.dailyStudyLimitMin}
                    onChange={(e) =>
                      update(
                        "dailyStudyLimitMin",
                        Number(e.target.value)
                      )
                    }
                    disabled={saving}
                  >
                    {[60, 120, 180, 240, 300, 360, 480, 600, 720].map(
                      (minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes / 60}{" "}
                          {minutes === 60 ? "hour" : "hours"}
                        </option>
                      )
                    )}
                    {![60, 120, 180, 240, 300, 360, 480, 600, 720].includes(
                      Number(profile.dailyStudyLimitMin)
                    ) && (
                      <option value={profile.dailyStudyLimitMin}>
                        {profile.dailyStudyLimitMin} minutes
                      </option>
                    )}
                  </select>
                </Field>
              </div>

              <div className="mt-6">
                <Field
                  label="Timezone"
                  hint="Use an IANA timezone, such as Asia/Kolkata or Asia/Dubai."
                >
                  <input
                    className={inputClass}
                    value={profile.timezone}
                    onChange={(e) =>
                      update("timezone", e.target.value)
                    }
                    placeholder="Asia/Kolkata"
                    required
                    disabled={saving}
                  />
                </Field>
              </div>
            </section>

            <div className="rounded-2xl border border-[#E9D5C2] bg-[#FFF5E9] p-5">
              <p className="text-sm font-semibold text-espresso">
                Your timetable won't change automatically
              </p>

              <p className="mt-2 text-sm leading-6 text-muted">
                Updating your preferences saves them to
                PostgreSQL. Your existing timetable remains
                unchanged until you choose to regenerate it.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pb-8">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-espresso px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#48362F] disabled:opacity-50"
              >
                {saving ? "Saving changes..." : "Save settings"}
              </button>

              <button
                type="button"
                onClick={resetChanges}
                disabled={saving || !originalProfile}
                className="rounded-xl border border-[#DDD1C7] bg-white px-7 py-3.5 text-sm font-semibold text-espresso transition hover:bg-sand disabled:opacity-50"
              >
                Discard changes
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
