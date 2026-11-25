
import { useState } from "react";

export default function QuizReviewAction({
  subjectId,
  subjectName,
  topic,
  accuracyPercent,
}) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function addToReviewSchedule() {
    if (saving || status === "added" || status === "exists") {
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const accuracy = Math.round(
        Number(accuracyPercent) || 0
      );

      const response = await fetch("/api/reviews/cards", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subjectId,
          topic,
          notes:
            `Suggested from Adaptive Quiz Insights.\n` +
            `Subject: ${subjectName}\n` +
            `Quiz accuracy when added: ${accuracy}%.\n` +
            `Review this topic and practice recalling the key concepts.`,
        }),
      });

      const data = await response
        .json()
        .catch(() => ({}));

      if (response.status === 409) {
        setStatus("exists");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error || "Could not add review topic."
        );
      }

      setStatus("added");
    } catch (error) {
      setStatus("error");
      console.error("Quiz review integration:", error);
    } finally {
      setSaving(false);
    }
  }

  const complete =
    status === "added" || status === "exists";

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={addToReviewSchedule}
        disabled={saving || complete}
        className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed ${
          complete
            ? "bg-[#E5F0E7] text-[#467551]"
            : "bg-espresso text-white hover:opacity-90 disabled:opacity-50"
        }`}
      >
        {saving
          ? "Adding..."
          : status === "added"
            ? "Added to review schedule"
            : status === "exists"
              ? "Already in review schedule"
              : "Add to Review Schedule"}
      </button>

      {status === "added" && (
        <p role="status" className="mt-2 text-xs text-[#467551]">
          Topic saved! Open Spaced Repetition from your
          dashboard to begin reviewing it.
        </p>
      )}

      {status === "exists" && (
        <p role="status" className="mt-2 text-xs text-[#467551]">
          This topic is already in your review schedule.
          Your existing review progress was preserved.
        </p>
      )}

      {status === "error" && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          Unable to add this topic. Please try again.
        </p>
      )}
    </div>
  );
}
