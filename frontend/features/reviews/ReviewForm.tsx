"use client";

import { useState } from "react";
import { useCreateReview } from "@/features/reviews/hooks";
import { ApiError } from "@/lib/api/client";

type ReviewFormProps = {
  readID: string;
  bookID: string;
  onSuccess?: () => void;
};

export function ReviewForm({ readID, bookID, onSuccess }: ReviewFormProps) {
  const [body, setBody] = useState("");
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createMutation = useCreateReview(bookID);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = body.trim();
    if (!trimmed) {
      setErrorMessage("Please write some thoughts before submitting your review.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        read_id: readID,
        body: trimmed,
        contains_spoilers: containsSpoilers,
      });
      setBody("");
      setContainsSpoilers(false);
      onSuccess?.();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "email_verification_required") {
          setErrorMessage("You must verify your email address before publishing public reviews.");
        } else if (err.code === "review_already_exists") {
          setErrorMessage("You have already written a review for this reading entry.");
        } else {
          setErrorMessage(err.message || "Unable to save review. Please try again.");
        }
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[var(--line)] bg-[var(--surface,#fafaf9)] p-5 sm:p-6"
    >
      <h3 className="font-serif text-lg font-semibold text-[var(--ink)]">Write a Review</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Share your thoughts with other readers on Scripd.
      </p>

      {errorMessage && (
        <div
          className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      <div className="mt-4">
        <textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={10000}
          placeholder="What did you think of the characters, pacing, and overall themes?"
          className="w-full rounded-xl border border-[var(--line)] bg-white p-3 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--forest)] focus:outline-none focus:ring-1 focus:ring-[var(--forest)] resize-y"
          disabled={createMutation.isPending}
        />
        <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
          <span>Be respectful and thoughtful.</span>
          <span>{body.length} / 10,000</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[var(--ink)]">
          <input
            type="checkbox"
            checked={containsSpoilers}
            onChange={(e) => setContainsSpoilers(e.target.checked)}
            className="rounded border-[var(--line)] text-[var(--forest)] focus:ring-[var(--forest)]"
            disabled={createMutation.isPending}
          />
          <span>Contains spoilers</span>
        </label>

        <button
          type="submit"
          disabled={createMutation.isPending || !body.trim()}
          className="rounded-full bg-[var(--forest)] px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createMutation.isPending ? "Posting…" : "Post Review"}
        </button>
      </div>
    </form>
  );
}
