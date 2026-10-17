"use client";

import Image from "next/image";
import { useState } from "react";
import type { Review } from "@/features/reviews/api";

type ReviewCardProps = {
  review: Review;
  currentUserID?: string;
  onDelete?: (reviewID: string) => void;
};

export function ReviewCard({ review, currentUserID, onDelete }: ReviewCardProps) {
  const [revealed, setRevealed] = useState(!review.contains_spoilers);
  const isAuthor = Boolean(currentUserID && review.user_id === currentUserID);

  const formattedDate = new Date(review.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const authorName = review.author.display_name || review.author.username;
  const initial = authorName.charAt(0).toUpperCase();

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6 transition hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {review.author.avatar_url ? (
            <Image
              src={review.author.avatar_url}
              alt={authorName}
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 rounded-full object-cover border border-[var(--line)]"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--forest-tint)] font-semibold text-[var(--forest)] text-sm">
              {initial}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--ink)] text-sm">{authorName}</span>
              <span className="text-xs text-[var(--muted)]">@{review.author.username}</span>
            </div>
            <time className="text-xs text-[var(--muted)]" dateTime={review.created_at}>
              {formattedDate}
            </time>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {typeof review.rating === "number" && (
            <div className="flex items-center gap-1 rounded-full bg-[var(--gold-tint,#fef9c3)] px-2.5 py-1 text-xs font-bold text-[var(--gold,#ca8a04)]">
              <span>★</span>
              <span>{review.rating.toFixed(1)}</span>
            </div>
          )}
          {isAuthor && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(review.id)}
              className="text-xs text-[var(--muted)] hover:text-red-600 transition p-1"
              title="Delete review"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        {review.contains_spoilers && !revealed ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-center">
            <p className="text-sm font-medium text-amber-800">⚠️ Contains spoilers</p>
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-2 inline-block rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              Click to reveal review
            </button>
          </div>
        ) : (
          <div>
            {review.contains_spoilers && (
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                  Spoiler
                </span>
                <button
                  type="button"
                  onClick={() => setRevealed(false)}
                  className="text-xs text-[var(--muted)] hover:underline"
                >
                  Hide spoilers
                </button>
              </div>
            )}
            <p className="whitespace-pre-line text-sm leading-6 text-[var(--ink)] font-normal">
              {review.body}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
