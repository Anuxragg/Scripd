"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCurrentUser } from "@/features/auth/hooks";
import {
  useCreateRead,
  useDeleteRead,
  useReadEntries,
  useUpdateRead,
} from "@/features/reads/hooks";
import type { ReadStatus } from "@/features/reads/api";

const buttonClass =
  "rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--forest)] hover:text-[var(--forest)] disabled:cursor-wait disabled:opacity-60";

export function ReadingActions({ bookID }: { bookID: string }) {
  const userQuery = useCurrentUser();
  const entriesQuery = useReadEntries({ bookID, limit: 50 }, Boolean(userQuery.data));
  const createMutation = useCreateRead();
  const updateMutation = useUpdateRead();
  const deleteMutation = useDeleteRead();
  const entries = useMemo(
    () => entriesQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [entriesQuery.data],
  );
  const activeEntry = entries.find(
    (entry) => entry.status === "want_to_read" || entry.status === "reading",
  );
  const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const error = createMutation.error ?? updateMutation.error ?? deleteMutation.error;

  function add(status: ReadStatus) {
    createMutation.mutate({ book_id: bookID, status });
  }

  function changeActive(status: ReadStatus) {
    if (!activeEntry) return;
    updateMutation.mutate({
      entryID: activeEntry.id,
      input: {
        status,
        started_at: activeEntry.started_at,
        notes: activeEntry.notes,
      },
    });
  }

  return (
    <section className="mt-10 rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-7">
      <p className="eyebrow">Your reading diary</p>
      <h2 className="mt-2 font-serif text-2xl text-[var(--ink)]">Keep this book in your story</h2>
      {userQuery.isPending ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Checking your library…</p>
      ) : userQuery.isError ? (
        <p className="mt-4 text-sm text-[var(--muted)]" role="alert">
          We couldn’t check your account. Refresh the page to try again.
        </p>
      ) : !userQuery.data ? (
        <p className="mt-4 leading-7 text-[var(--muted)]">
          <Link className="font-semibold text-[var(--forest)] hover:underline" href="/login">
            Sign in
          </Link>{" "}
          to add this book to your reading diary.
        </p>
      ) : entriesQuery.isPending ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Loading your reading history…</p>
      ) : entriesQuery.isError ? (
        <p className="mt-4 text-sm text-[var(--muted)]" role="alert">
          Your library could not be loaded. Refresh the page to try again.
        </p>
      ) : (
        <>
          {activeEntry ? (
            <div className="mt-4">
              <p className="text-sm text-[var(--muted)]">
                This book is on your{" "}
                <strong className="text-[var(--ink)]">{statusLabel(activeEntry.status)}</strong>{" "}
                shelf.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {activeEntry.status === "want_to_read" ? (
                  <button
                    className={buttonClass}
                    disabled={busy}
                    onClick={() => changeActive("reading")}
                    type="button"
                  >
                    Start reading
                  </button>
                ) : null}
                <button
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => changeActive("read")}
                  type="button"
                >
                  Mark as read
                </button>
                <button
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => changeActive("did_not_finish")}
                  type="button"
                >
                  Didn’t finish
                </button>
                <button
                  className="px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:text-red-700 disabled:opacity-60"
                  disabled={busy}
                  onClick={() => deleteMutation.mutate(activeEntry.id)}
                  type="button"
                  aria-label="Remove this book from your active shelf"
                >
                  Remove from shelf
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={buttonClass}
                disabled={busy}
                onClick={() => add("want_to_read")}
                type="button"
              >
                Want to read
              </button>
              <button
                className={buttonClass}
                disabled={busy}
                onClick={() => add("reading")}
                type="button"
              >
                Start reading
              </button>
              <button
                className={buttonClass}
                disabled={busy}
                onClick={() => add("read")}
                type="button"
              >
                Log a read
              </button>
            </div>
          )}
          {entries.length > 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Your reading history is in your{" "}
              <Link className="font-semibold text-[var(--forest)] hover:underline" href="/library">
                library
              </Link>
              .
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {error.message || "We couldn’t update your reading diary. Try again."}
            </p>
          ) : null}
          {createMutation.isSuccess || updateMutation.isSuccess ? (
            <p className="mt-4 text-sm font-medium text-[var(--forest)]" role="status">
              Your reading diary has been updated.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function statusLabel(status: ReadStatus): string {
  switch (status) {
    case "want_to_read":
      return "Want to read";
    case "reading":
      return "Currently reading";
    case "read":
      return "Read";
    case "did_not_finish":
      return "Did not finish";
  }
}
