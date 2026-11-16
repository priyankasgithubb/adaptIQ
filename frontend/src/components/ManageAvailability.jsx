
import { useCallback, useEffect, useMemo, useState } from "react";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const TYPE_DETAILS = {
  free: {
    label: "Available to study",
    color: "bg-[#76A48C]",
    badge: "bg-[#E6F1E9] text-[#46725A]",
    title: "Study time",
  },
  class: {
    label: "Class / lecture",
    color: "bg-coral",
    badge: "bg-[#F9E9E2] text-[#A76756]",
    title: "Class",
  },
  fixed: {
    label: "Other commitment",
    color: "bg-[#9E8BC0]",
    badge: "bg-[#F0EAF7] text-[#76618F]",
    title: "Other commitment",
  },
  blocked: {
    label: "Unavailable",
    color: "bg-[#A99C92]",
    badge: "bg-[#F0EBE7] text-[#786B61]",
    title: "Unavailable",
  },
};

const createEmptyForm = () => ({
  kind: "free",
  title: "Study time",
  weekday: 0,
  startTime: "16:00",
  endTime: "18:00",
});

const inputClass =
  "w-full rounded-xl border border-[#DED5CD] bg-white px-4 py-3 text-sm text-espresso outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:opacity-60";

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

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(time) {
  const [hours, minutes] = time.split(":").map(Number);

  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${
    hours >= 12 ? "PM" : "AM"
  }`;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (!hours) return `${remaining}m`;
  if (!remaining) return `${hours}h`;

  return `${hours}h ${remaining}m`;
}

function ScheduleForm({
  form,
  setForm,
  saving,
  onSubmit,
  onCancel,
  submitLabel,
}) {
  function update(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function changeKind(kind) {
    setForm((previous) => ({
      ...previous,
      kind,
      title:
        previous.title === TYPE_DETAILS[previous.kind].title
          ? TYPE_DETAILS[kind].title
          : previous.title,
    }));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-espresso">
          Type of time slot
        </span>

        <select
          className={inputClass}
          value={form.kind}
          onChange={(e) => changeKind(e.target.value)}
          disabled={saving}
        >
          {Object.entries(TYPE_DETAILS).map(([kind, details]) => (
            <option key={kind} value={kind}>
              {details.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-espresso">
          Title
        </span>

        <input
          className={inputClass}
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g. Evening study"
          maxLength={80}
          required
          disabled={saving}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-espresso">
          Day of the week
        </span>

        <select
          className={inputClass}
          value={form.weekday}
          onChange={(e) =>
            update("weekday", Number(e.target.value))
          }
          disabled={saving}
        >
          {DAYS.map((day, index) => (
            <option key={day} value={index}>
              {day}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-espresso">
            Start time
          </span>

          <input
            type="time"
            className={inputClass}
            value={form.startTime}
            onChange={(e) =>
              update("startTime", e.target.value)
            }
            required
            disabled={saving}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-espresso">
            End time
          </span>

          <input
            type="time"
            className={inputClass}
            value={form.endTime}
            onChange={(e) =>
              update("endTime", e.target.value)
            }
            required
            disabled={saving}
          />
        </label>
      </div>

      <p className="text-xs leading-5 text-muted">
        Time slots repeat every week. They cannot overlap with
        another saved time slot on the same day.
      </p>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-espresso px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#48362F] disabled:opacity-50"
        >
          {saving ? "Saving..." : submitLabel}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-[#DDD1C7] px-6 py-3 text-sm font-semibold text-espresso transition hover:bg-sand disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ManageAvailability({
  user,
  onBack,
  onLogout,
  logoutLoading,
}) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [addForm, setAddForm] = useState(createEmptyForm);
  const [editForm, setEditForm] = useState(createEmptyForm);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [scheduleNeedsUpdate, setScheduleNeedsUpdate] =
    useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await request("/api/commitments");

      setEntries(
        (data.commitments || []).sort(
          (a, b) =>
            a.weekday - b.weekday ||
            a.startTime.localeCompare(b.startTime)
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const stats = useMemo(() => {
    const freeEntries = entries.filter(
      (entry) => entry.kind === "free"
    );

    const availableMinutes = freeEntries.reduce(
      (total, entry) =>
        total +
        Math.max(
          0,
          timeToMinutes(entry.endTime) -
            timeToMinutes(entry.startTime)
        ),
      0
    );

    return {
      total: entries.length,
      freeCount: freeEntries.length,
      availableMinutes,
      busyCount: entries.length - freeEntries.length,
    };
  }, [entries]);

  function getPayload(form) {
    const title = form.title.trim();

    if (!title) {
      throw new Error("Please enter a title.");
    }

    if (form.endTime <= form.startTime) {
      throw new Error(
        "End time must be later than start time."
      );
    }

    return {
      kind: form.kind,
      title,
      weekday: Number(form.weekday),
      startTime: form.startTime,
      endTime: form.endTime,
    };
  }

  function recordChange(text) {
    setMessage(text);
    setScheduleNeedsUpdate(true);
  }

  async function addEntry(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await request("/api/commitments", {
        method: "POST",
        body: JSON.stringify(getPayload(addForm)),
      });

      setEntries((previous) =>
        [...previous, data.commitment].sort(
          (a, b) =>
            a.weekday - b.weekday ||
            a.startTime.localeCompare(b.startTime)
        )
      );

      setAddForm(createEmptyForm());
      setShowAddForm(false);

      recordChange("Time slot added successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEditing(entry) {
    setEditingId(entry.id);
    setShowAddForm(false);
    setError("");
    setMessage("");

    setEditForm({
      kind: entry.kind,
      title: entry.title,
      weekday: entry.weekday,
      startTime: entry.startTime,
      endTime: entry.endTime,
    });
  }

  async function saveEdit(event) {
    event.preventDefault();

    if (saving || !editingId) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await request(
        `/api/commitments/${editingId}`,
        {
          method: "PUT",
          body: JSON.stringify(getPayload(editForm)),
        }
      );

      setEntries((previous) =>
        previous
          .map((entry) =>
            entry.id === editingId
              ? data.commitment
              : entry
          )
          .sort(
            (a, b) =>
              a.weekday - b.weekday ||
              a.startTime.localeCompare(b.startTime)
          )
      );

      setEditingId(null);

      recordChange("Time slot updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entry) {
    if (saving) return;

    const confirmed = window.confirm(
      `Delete "${entry.title}" on ${DAYS[entry.weekday]}?\n\nYour existing timetable will not be automatically regenerated.`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await request(`/api/commitments/${entry.id}`, {
        method: "DELETE",
      });

      setEntries((previous) =>
        previous.filter((item) => item.id !== entry.id)
      );

      if (editingId === entry.id) {
        setEditingId(null);
      }

      recordChange("Time slot deleted successfully.");
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
            My Schedule
          </span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47763]">
              YOUR WEEKLY ROUTINE
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
              My{" "}
              <span className="font-serif italic text-[#C77761]">
                schedule.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
              Manage your study windows, classes, and
              commitments so AdaptIQ can plan around your life.
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setShowAddForm((previous) => !previous);
              setEditingId(null);
              setError("");
              setMessage("");
            }}
            className="rounded-xl bg-espresso px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#48362F] disabled:opacity-50"
          >
            {showAddForm ? "Close form" : "+ Add time slot"}
          </button>
        </div>

        <section className="mt-9 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#E8DED5] bg-white p-5">
            <p className="text-xs text-muted">
              Available study time
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {formatDuration(stats.availableMinutes)}
            </p>
            <p className="mt-2 text-xs text-muted">
              Total per week
            </p>
          </div>

          <div className="rounded-2xl border border-[#E8DED5] bg-white p-5">
            <p className="text-xs text-muted">
              Study windows
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {stats.freeCount}
            </p>
            <p className="mt-2 text-xs text-muted">
              Available periods
            </p>
          </div>

          <div className="rounded-2xl border border-[#E8DED5] bg-white p-5">
            <p className="text-xs text-muted">
              Other commitments
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {stats.busyCount}
            </p>
            <p className="mt-2 text-xs text-muted">
              Classes and blocked periods
            </p>
          </div>
        </section>

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
              Your availability changes are saved, but your
              current timetable hasn't been regenerated.
              We'll add that option in the next development steps.
            </p>
          </div>
        )}

        {showAddForm && (
          <section className="mt-8 max-w-2xl rounded-[22px] border border-[#E8DED5] bg-white p-6 sm:p-8">
            <h2 className="mb-6 text-xl font-semibold">
              Add a time slot
            </h2>

            <ScheduleForm
              form={addForm}
              setForm={setAddForm}
              saving={saving}
              onSubmit={addEntry}
              onCancel={() => setShowAddForm(false)}
              submitLabel="Save time slot"
            />
          </section>
        )}

        <section className="mt-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">
              Weekly routine
            </h2>

            <button
              type="button"
              onClick={loadEntries}
              disabled={loading || saving}
              className="rounded-xl border border-[#D8CABF] bg-white px-4 py-2.5 text-xs font-semibold transition hover:bg-sand disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>

          {loading ? (
            <div
              role="status"
              className="rounded-xl bg-white p-6 text-sm text-muted"
            >
              Loading your weekly schedule...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {DAYS.map((day, dayIndex) => {
                const dayEntries = entries.filter(
                  (entry) => entry.weekday === dayIndex
                );

                return (
                  <div
                    key={day}
                    className="min-h-48 rounded-[20px] border border-[#E9DFD5] bg-[#FCFAF8] p-4"
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        {day}
                      </h3>

                      <span className="text-xs text-muted">
                        {dayEntries.length}
                      </span>
                    </div>

                    {dayEntries.length === 0 ? (
                      <p className="py-8 text-center text-xs text-[#A99A90]">
                        Nothing scheduled
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {dayEntries.map((entry) => {
                          const details =
                            TYPE_DETAILS[entry.kind];

                          return (
                            <article
                              key={entry.id}
                              className="rounded-xl border border-[#EDE1D8] bg-white p-3.5"
                            >
                              {editingId === entry.id ? (
                                <>
                                  <h4 className="mb-4 text-sm font-semibold">
                                    Edit time slot
                                  </h4>

                                  <ScheduleForm
                                    form={editForm}
                                    setForm={setEditForm}
                                    saving={saving}
                                    onSubmit={saveEdit}
                                    onCancel={() =>
                                      setEditingId(null)
                                    }
                                    submitLabel="Save changes"
                                  />
                                </>
                              ) : (
                                <>
                                  <div
                                    className={`mb-3 h-1 w-8 rounded-full ${details.color}`}
                                  />

                                  <p className="break-words text-sm font-semibold">
                                    {entry.title}
                                  </p>

                                  <p className="mt-2 text-xs text-muted">
                                    {formatTime(entry.startTime)}
                                    {" – "}
                                    {formatTime(entry.endTime)}
                                  </p>

                                  <span
                                    className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold ${details.badge}`}
                                  >
                                    {details.label}
                                  </span>

                                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#F0E7E0] pt-4">
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() =>
                                        startEditing(entry)
                                      }
                                      className="rounded-lg bg-espresso px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#48362F] disabled:opacity-50"
                                    >
                                      Edit
                                    </button>

                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() =>
                                        deleteEntry(entry)
                                      }
                                      className="rounded-lg border border-[#E8CFCB] px-3 py-2 text-xs font-semibold text-[#A45850] transition hover:bg-[#FFF0ED] disabled:opacity-50"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
