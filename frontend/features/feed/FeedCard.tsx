"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { FeedItem } from "@/features/feed/api";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function renderStars(rating: number): string {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5 ? "½" : "";
  return "★".repeat(fullStars) + halfStar;
}

export function FeedCard({ item }: { item: FeedItem }) {
  const [showSpoilers, setShowSpoilers] = useState(false);
  const [coverError, setCoverError] = useState(false);

  const userInitial = (item.user.display_name || item.user.username || "U").charAt(0).toUpperCase();

  const authorText =
    item.book.authors && item.book.authors.length > 0
      ? item.book.authors.join(", ")
      : "Unknown Author";

  let actionLabel = "logged";
  if (item.review) {
    actionLabel = "reviewed";
  } else if (item.status === "read") {
    actionLabel = "finished reading";
  } else if (item.status === "reading") {
    actionLabel = "started reading";
  } else if (item.status === "want_to_read") {
    actionLabel = "wants to read";
  } else if (item.status === "did_not_finish") {
    actionLabel = "did not finish";
  }

  return (
    <article className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm transition hover:shadow-md">
      {/* Activity Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/u/${encodeURIComponent(item.user.username)}`}
            className="flex-shrink-0 transition hover:opacity-80"
          >
            {item.user.avatar_url ? (
              <Image
                src={item.user.avatar_url}
                alt={item.user.display_name || item.user.username}
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 rounded-full border border-[var(--line)] object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--forest-tint)] font-serif text-sm font-bold text-[var(--forest)]">
                {userInitial}
              </div>
            )}
          </Link>

          <div className="min-w-0 text-sm">
            <p className="truncate text-[var(--ink)]">
              <Link
                href={`/u/${encodeURIComponent(item.user.username)}`}
                className="font-semibold hover:underline"
              >
                {item.user.display_name || item.user.username}
              </Link>{" "}
              <span className="text-[var(--muted)]">{actionLabel}</span>
            </p>
            <p className="text-xs text-[var(--muted)]">{formatRelativeTime(item.created_at)}</p>
          </div>
        </div>

        {/* Rating Pill */}
        {item.rating && (
          <div className="flex-shrink-0 rounded-full bg-[#fdf8ee] px-3 py-1 text-xs font-semibold text-[#b8860b] border border-[#f0e4c8]">
            {renderStars(item.rating)}{" "}
            <span className="ml-1 text-[11px] opacity-75">{item.rating}</span>
          </div>
        )}
      </div>

      {/* Book Snippet */}
      <div className="mt-5 flex gap-4 rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
        <Link
          href={`/books/${item.book.id}`}
          className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[#e9e6df] shadow-sm transition hover:opacity-90"
        >
          {item.book.cover_url && !coverError ? (
            <Image
              src={item.book.cover_url}
              alt={item.book.title}
              fill
              unoptimized
              className="object-cover"
              onError={() => setCoverError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--forest-tint)] p-1 text-center font-serif text-xs font-bold text-[var(--forest)]">
              {item.book.title.slice(0, 1)}
            </div>
          )}
        </Link>

        <div className="flex flex-col justify-center min-w-0">
          <Link
            href={`/books/${item.book.id}`}
            className="font-serif text-base font-bold text-[var(--ink)] hover:text-[var(--forest)] transition truncate"
          >
            {item.book.title}
          </Link>
          <p className="text-xs text-[var(--muted)] truncate">{authorText}</p>
          {item.book.published_year && (
            <p className="mt-1 text-[11px] text-[var(--muted)]">{item.book.published_year}</p>
          )}
        </div>
      </div>

      {/* Review Content */}
      {item.review && (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          {item.review.contains_spoilers && !showSpoilers ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-center justify-between">
              <span>This review contains spoilers.</span>
              <button
                type="button"
                onClick={() => setShowSpoilers(true)}
                className="font-semibold text-amber-800 underline hover:text-amber-950 ml-3"
              >
                Reveal review
              </button>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-[var(--ink)] whitespace-pre-line">
              {item.review.body}
            </p>
          )}
        </div>
      )}

      {/* Diary Notes (if not reviewed) */}
      {!item.review && item.notes && (
        <div className="mt-3 border-t border-[var(--line)] pt-3">
          <p className="text-xs italic text-[var(--muted)] line-clamp-3">
            &ldquo;{item.notes}&rdquo;
          </p>
        </div>
      )}
    </article>
  );
}
