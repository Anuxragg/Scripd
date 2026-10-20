"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { useCurrentUser } from "@/features/auth/hooks";
import { FeedTimeline } from "@/features/feed/FeedTimeline";

export default function FeedPage() {
  const userQuery = useCurrentUser();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteHeader theme="light" />

      <main className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <header className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-[var(--ink)]">Activity Feed</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Chronological reading updates, ratings, and reviews from members you follow.
          </p>
        </header>

        {userQuery.isLoading ? (
          <div className="h-40 rounded-3xl bg-[#e9e6df] animate-pulse" />
        ) : !userQuery.data ? (
          <div className="rounded-3xl border border-[var(--line)] bg-white p-10 text-center shadow-sm">
            <h2 className="font-serif text-2xl font-bold text-[var(--ink)]">
              Sign In to See Your Feed
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
              Follow other readers and curate a real-time stream of what your friends are reading.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/login?redirect=/feed"
                className="rounded-full bg-[var(--forest)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-full border border-[var(--line)] bg-white px-6 py-2.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--forest)] hover:text-[var(--forest)] transition"
              >
                Create account
              </Link>
            </div>
          </div>
        ) : (
          <FeedTimeline />
        )}
      </main>
    </div>
  );
}
