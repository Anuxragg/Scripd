"use client";

import Link from "next/link";
import { useFeed } from "@/features/feed/hooks";
import { FeedCard } from "@/features/feed/FeedCard";

export function FeedTimeline() {
  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useFeed(20);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#e9e6df]" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-[#e9e6df]" />
                <div className="h-3 w-16 rounded bg-[#e9e6df]" />
              </div>
            </div>
            <div className="mt-5 h-24 rounded-2xl bg-[#e9e6df]" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
        <h3 className="font-serif text-lg font-bold text-red-900">Unable to load feed</h3>
        <p className="mt-1 text-sm text-red-700">
          {error?.message || "An unexpected error occurred while fetching your activity feed."}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded-full bg-[var(--forest)] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 transition"
        >
          Try again
        </button>
      </div>
    );
  }

  const allItems = data?.pages.flatMap((page) => page.items) ?? [];

  if (allItems.length === 0) {
    return (
      <div className="rounded-3xl border border-[var(--line)] bg-white p-12 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--forest-tint)] font-serif text-2xl font-bold text-[var(--forest)]">
          📚
        </div>
        <h2 className="mt-5 font-serif text-2xl font-bold text-[var(--ink)]">Your Feed is Quiet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
          Follow other readers to discover what they are reading, rating, and reviewing. You will
          also see your own reading log here.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/books"
            className="rounded-full bg-[var(--forest)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
          >
            Explore books
          </Link>
          <Link
            href="/library"
            className="rounded-full border border-[var(--line)] bg-white px-6 py-2.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--forest)] hover:text-[var(--forest)] transition"
          >
            Log a read
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {allItems.map((item) => (
          <FeedCard key={item.id} item={item} />
        ))}
      </div>

      {/* Pagination / Load More */}
      {hasNextPage && (
        <div className="pt-4 text-center">
          <button
            type="button"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
            className="rounded-full border border-[var(--line)] bg-white px-6 py-2.5 text-sm font-semibold text-[var(--ink)] shadow-sm hover:border-[var(--forest)] hover:text-[var(--forest)] transition disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading more stories..." : "Load older activity"}
          </button>
        </div>
      )}
    </div>
  );
}
