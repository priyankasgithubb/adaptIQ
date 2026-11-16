
import { useEffect, useState } from "react";

const emptyForm = {
  name: "",
  weight: 1,
  targetScore: "90",
  status: "unknown",
};

const inputClass =
  "w-full rounded-xl border border-[#DED5CD] bg-white px-4 py-3 text-sm text-espresso outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20";

const statusLabels = {
  weak: "Needs improvement",
  strong: "Confident",
  unknown: "Not assessed",
};

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

function SubjectForm({
  form,
  setForm,
  onSubmit,
  saving,
  submitLabel,
  onCancel,
}) {
  function update(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
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
          disabled={saving}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-espresso">
            Target score (%)
          </span>

          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            className={inputClass}
            value={form.targetScore}
            onChange={(e) =>
              update("targetScore", e.target.value)
            }
            placeholder="Optional"
            disabled={saving}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-espresso">
            Importance
          </span>

          <select
            className={inputClass}
            value={form.weight}
            onChange={(e) =>
              update("weight", Number(e.target.value))
            }
            disabled={saving}
          >
            <option value={1}>Normal (1)</option>
            <option value={3}>Moderate (3)</option>
            <option value={5}>High (5)</option>
            <option value={10}>Very high (10)</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-espresso">
          Current confidence
        </span>

        <select
          className={inputClass}
          value={form.status}
          onChange={(e) => update("status", e.target.value)}
          disabled={saving}
        >
          <option value="unknown">Not assessed yet</option>
          <option value="weak">Needs improvement</option>
          <option value="strong">Confident</option>
        </select>
      </label>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-espresso px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#48362F] disabled:opacity-50"
        >
          {saving ? "Saving..." : submitLabel}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-[#DDD1C7] px-6 py-3 text-sm font-semibold text-espresso transition hover:bg-sand disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function ManageSubjects({
  user,
  onBack,
  onLogout,
  logoutLoading,
  onSubjectsChanged,
}) {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [scheduleNeedsUpdate, setScheduleNeedsUpdate] =
    useState(false);

  useEffect(() => {
    let active = true;

    async function loadSubjects() {
      try {
        const data = await request("/api/subjects");

        if (active) {
          setSubjects(data.subjects || []);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSubjects();

    return () => {
      active = false;
    };
  }, []);

  function getPayload(form) {
    const name = form.name.trim();

    if (!name) {
      throw new Error("Subject name is required.");
    }

    const targetScore =
      form.targetScore === ""
        ? null
        : Number(form.targetScore);

    if (
      targetScore !== null &&
      (!Number.isFinite(targetScore) ||
        targetScore < 0 ||
        targetScore > 100)
    ) {
      throw new Error("Target score must be between 0 and 100.");
    }

    return {
      name,
      weight: Number(form.weight),
      targetScore,
      status: form.status,
    };
  }

  function recordChange(messageText) {
    setMessage(messageText);
    setScheduleNeedsUpdate(true);
    onSubjectsChanged?.();
  }

  async function addSubject(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = getPayload(addForm);

      const data = await request("/api/subjects", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSubjects((previous) =>
        [...previous, data.subject].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setAddForm({ ...emptyForm });
      setShowAddForm(false);

      recordChange("Subject added successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEditing(subject) {
    setEditingId(subject.id);
    setShowAddForm(false);
    setError("");
    setMessage("");

    setEditForm({
      name: subject.name,
      weight: subject.weight,
      targetScore:
        subject.targetScore === null
          ? ""
          : String(subject.targetScore),
      status: subject.status,
    });
  }

  async function saveEdit(event) {
    event.preventDefault();

    if (saving || !editingId) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = getPayload(editForm);

      const data = await request(
        `/api/subjects/${editingId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );

      setSubjects((previous) =>
        previous
          .map((subject) =>
            subject.id === editingId
              ? {
                  ...subject,
                  ...data.subject,
                }
              : subject
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      setEditingId(null);

      recordChange("Subject updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubject(subject) {
    if (saving) return;

    const confirmed = window.confirm(
      `Delete "${subject.name}"?\n\nThis can also remove its topics and assessment marks. It may affect saved study sessions. This action cannot be undone.`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await request(`/api/subjects/${subject.id}`, {
        method: "DELETE",
      });

      setSubjects((previous) =>
        previous.filter((item) => item.id !== subject.id)
      );

      if (editingId === subject.id) {
        setEditingId(null);
      }

      recordChange("Subject deleted successfully.");
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

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-10">
        <nav className="mb-9 flex flex-wrap gap-2">
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
            My Subjects
          </span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47763]">
              ACADEMIC WORKSPACE
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
              My{" "}
              <span className="font-serif italic text-[#C77761]">
                subjects.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
              Manage what you're studying, set your goals,
              and adjust subject priorities.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowAddForm((previous) => !previous);
              setEditingId(null);
              setError("");
              setMessage("");
            }}
            className="rounded-xl bg-espresso px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#48362F]"
          >
            {showAddForm ? "Close form" : "+ Add subject"}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mt-7 rounded-xl border border-[#D0E7D6] bg-[#EFF8F0] p-4 text-sm text-[#3F7654]"
          >
            {message}
          </div>
        )}

        {scheduleNeedsUpdate && (
          <div className="mt-6 rounded-2xl border border-[#E9D5C2] bg-[#FFF5E9] p-5">
            <p className="text-sm font-semibold text-espresso">
              Your study timetable may need updating
            </p>

            <p className="mt-2 text-sm leading-6 text-muted">
              Your subject changes have been saved, but your
              existing timetable has not been regenerated.
              We'll add controlled plan regeneration in the
              next development steps.
            </p>
          </div>
        )}

        {showAddForm && (
          <section className="mt-8 max-w-2xl rounded-[22px] border border-[#E8DED5] bg-white p-6 sm:p-8">
            <h2 className="mb-6 text-xl font-semibold">
              Add a new subject
            </h2>

            <SubjectForm
              form={addForm}
              setForm={setAddForm}
              onSubmit={addSubject}
              saving={saving}
              submitLabel="Save subject"
              onCancel={() => setShowAddForm(false)}
            />
          </section>
        )}

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">
              Your subject list
            </h2>

            <span className="rounded-full bg-[#F1E7DE] px-4 py-2 text-xs font-semibold text-[#946C5B]">
              {subjects.length} subjects
            </span>
          </div>

          {loading ? (
            <p className="rounded-xl bg-white p-6 text-sm text-muted">
              Loading your subjects...
            </p>
          ) : subjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DDD1C7] bg-white p-8">
              <h3 className="text-lg font-semibold">
                No subjects yet
              </h3>

              <p className="mt-2 text-sm text-muted">
                Add a subject to start building your study plan.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {subjects.map((subject) => (
                <article
                  key={subject.id}
                  className="rounded-[22px] border border-[#E8DED5] bg-white p-6"
                >
                  {editingId === subject.id ? (
                    <>
                      <h3 className="mb-6 text-lg font-semibold">
                        Edit subject
                      </h3>

                      <SubjectForm
                        form={editForm}
                        setForm={setEditForm}
                        onSubmit={saveEdit}
                        saving={saving}
                        submitLabel="Save changes"
                        onCancel={() => setEditingId(null)}
                      />
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F3E4DA] text-lg font-bold text-[#A66A57]">
                            {subject.name.charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <h3 className="break-words text-lg font-semibold">
                              {subject.name}
                            </h3>

                            <p className="mt-1 text-xs text-muted">
                              {statusLabels[subject.status] ||
                                "Not assessed"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-7 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-[#FCF8F4] p-4">
                          <p className="text-xs text-muted">
                            Target score
                          </p>

                          <p className="mt-2 text-2xl font-semibold">
                            {subject.targetScore === null
                              ? "—"
                              : `${subject.targetScore}%`}
                          </p>
                        </div>

                        <div className="rounded-xl bg-[#FCF8F4] p-4">
                          <p className="text-xs text-muted">
                            Importance
                          </p>

                          <p className="mt-2 text-2xl font-semibold">
                            {subject.weight}
                            <span className="ml-1 text-xs font-normal text-muted">
                              / 10
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-[#EEE5DD] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-muted">
                            Assessment average
                          </span>

                          <span className="text-sm font-semibold">
                            {subject.averagePercent === null
                              ? "Not assessed"
                              : `${subject.averagePercent}%`}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 flex gap-3">
                        <button
                          type="button"
                          onClick={() => startEditing(subject)}
                          disabled={saving}
                          className="flex-1 rounded-xl bg-espresso px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#48362F] disabled:opacity-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteSubject(subject)}
                          disabled={saving}
                          className="rounded-xl border border-[#E8CFCB] px-5 py-3 text-sm font-semibold text-[#A45850] transition hover:bg-[#FFF0ED] disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
