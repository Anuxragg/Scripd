"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useCurrentUser } from "@/features/auth/hooks";
import { BookCover } from "@/features/books/BookCover";
import {
  readStatuses,
  type ReadEntry,
  type ReadInput,
  type ReadStatus,
} from "@/features/reads/api";
import { useDeleteRead, useReadEntries, useUpdateRead } from "@/features/reads/hooks";

const shelves: { value: ReadStatus | ""; label: string }[] = [
  { value: "", label: "Everything" },
  { value: "want_to_read", label: "Want to read" },
  { value: "reading", label: "Currently reading" },
  { value: "read", label: "Read" },
  { value: "did_not_finish", label: "Did not finish" },
];

export function LibraryPage() {
  const userQuery = useCurrentUser();
  const [status, setStatus] = useState<ReadStatus | "">("");
  const entriesQuery = useReadEntries({ status, limit: 12 }, Boolean(userQuery.data));
  const updateMutation = useUpdateRead();
  const deleteMutation = useDeleteRead();
  const entries = entriesQuery.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24">
        <p className="eyebrow">Your shelves, your story</p>
        <h1 className="display-title mt-4 text-5xl sm:text-6xl">My library</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
          A personal record of what you’re reading, what you’ve finished, and what you want to pick
          up next.
        </p>

        {userQuery.isPending ? (
          <p className="mt-10 text-[var(--muted)]">Loading your library…</p>
        ) : userQuery.isError ? (
          <p
            className="mt-10 rounded-2xl border border-[var(--line)] bg-white p-6 text-[var(--muted)]"
            role="alert"
          >
            We couldn’t check your account. Refresh the page to try again.
          </p>
        ) : !userQuery.data ? (
          <div className="mt-10 max-w-2xl rounded-3xl border border-[var(--line)] bg-white p-8">
            <h2 className="font-serif text-2xl text-[var(--ink)]">Sign in to see your library</h2>
            <p className="mt-3 leading-7 text-[var(--muted)]">
              Your reading diary belongs to your account. Sign in to add books and keep your reading
              history.
            </p>
            <Link
              className="mt-6 inline-flex rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--forest-dark)]"
              href="/login"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <div
              aria-label="Filter library by shelf"
              className="mt-8 flex gap-2 overflow-x-auto pb-2"
              role="group"
            >
              {shelves.map((shelf) => (
                <button
                  aria-pressed={status === shelf.value}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${status === shelf.value ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"}`}
                  key={shelf.value || "all"}
                  onClick={() => setStatus(shelf.value)}
                  type="button"
                >
                  {shelf.label}
                </button>
              ))}
            </div>

            {entriesQuery.isPending ? (
              <p className="mt-8 text-[var(--muted)]">Loading your reading entries…</p>
            ) : entriesQuery.isError ? (
              <p
                className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 text-[var(--muted)]"
                role="alert"
              >
                We couldn’t load these entries. Refresh the page to try again.
              </p>
            ) : entries.length === 0 ? (
              <div className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-8 sm:p-10">
                <h2 className="font-serif text-2xl text-[var(--ink)]">
                  {status ? `No books on this shelf yet` : "Your reading story starts here"}
                </h2>
                <p className="mt-3 max-w-xl leading-7 text-[var(--muted)]">
                  Find a book and add it to a shelf, or record a finished read. Each finished entry
                  stays in your history, including rereads.
                </p>
                <Link
                  className="mt-6 inline-flex rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--forest-dark)]"
                  href="/books"
                >
                  Discover books
                </Link>
              </div>
            ) : (
              <div className="mt-8 space-y-4">
                {entries.map((entry) => (
                  <LibraryEntry
                    entry={entry}
                    key={entry.id}
                    onDelete={() => {
                      if (window.confirm(`Remove “${entry.book.title}” from your library?`)) {
                        deleteMutation.mutate(entry.id);
                      }
                    }}
                    onUpdate={(input) => updateMutation.mutate({ entryID: entry.id, input })}
                    updatePending={
                      updateMutation.isPending && updateMutation.variables?.entryID === entry.id
                    }
                    deletePending={
                      deleteMutation.isPending && deleteMutation.variables === entry.id
                    }
                    updateError={
                      updateMutation.isError && updateMutation.variables?.entryID === entry.id
                        ? updateMutation.error
                        : null
                    }
                    deleteError={
                      deleteMutation.isError && deleteMutation.variables === entry.id
                        ? deleteMutation.error
                        : null
                    }
                  />
                ))}
              </div>
            )}

            {entriesQuery.hasNextPage ? (
              <div className="mt-8 text-center">
                <button
                  className="rounded-full border border-[var(--line)] bg-white px-6 py-3 text-sm font-semibold text-[var(--ink)] hover:border-[var(--forest)] disabled:opacity-60"
                  disabled={entriesQuery.isFetchingNextPage}
                  onClick={() => void entriesQuery.fetchNextPage()}
                  type="button"
                >
                  {entriesQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
            {entriesQuery.isFetchNextPageError ? (
              <p className="mt-4 text-center text-sm text-red-700" role="alert">
                The next page could not be loaded. Try again.
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function LibraryEntry({
  entry,
  onUpdate,
  onDelete,
  updatePending,
  deletePending,
  updateError,
  deleteError,
}: {
  entry: ReadEntry;
  onUpdate: (input: ReadInput) => void;
  onDelete: () => void;
  updatePending: boolean;
  deletePending: boolean;
  updateError: Error | null;
  deleteError: Error | null;
}) {
  const [editing, setEditing] = useState(false);
  const date = entry.finished_at ?? entry.started_at;

  return (
    <article className="grid gap-5 rounded-3xl border border-[var(--line)] bg-white p-5 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-6 sm:p-6">
      <Link
        className="block"
        href={`/books/${entry.book_id}`}
        aria-label={`View ${entry.book.title}`}
      >
        <BookCover
          className="aspect-[2/3] w-24 rounded-xl"
          coverURL={entry.book.cover_url}
          title={entry.book.title}
        />
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              className="font-serif text-2xl text-[var(--ink)] hover:text-[var(--forest)]"
              href={`/books/${entry.book_id}`}
            >
              {entry.book.title}
            </Link>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {entry.book.authors.length ? entry.book.authors.join(", ") : "Author unknown"}
            </p>
          </div>
          <span className="rounded-full bg-[#eef1eb] px-3 py-1.5 text-xs font-bold text-[var(--forest)]">
            {statusLabel(entry.status)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
          {date ? (
            <span>
              {entry.finished_at ? "Finished" : "Started"} {formatDate(date)}
            </span>
          ) : null}
          {entry.rating ? (
            <span aria-label={`${entry.rating} out of 5 stars`}>★ {entry.rating.toFixed(1)}</span>
          ) : null}
          {entry.status === "read" ? <span>Read entry</span> : null}
        </div>
        {entry.notes ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">
            {entry.notes}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="text-sm font-semibold text-[var(--forest)] hover:underline"
            onClick={() => setEditing((value) => !value)}
            type="button"
          >
            {editing ? "Close editor" : "Edit entry"}
          </button>
          <button
            className="text-sm font-semibold text-[var(--muted)] hover:text-red-700 disabled:opacity-60"
            disabled={deletePending}
            onClick={onDelete}
            type="button"
          >
            {deletePending ? "Removing…" : "Remove"}
          </button>
        </div>
        {updateError || deleteError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {updateError?.message ??
              deleteError?.message ??
              "This entry could not be changed. Try again."}
          </p>
        ) : null}
        {editing ? (
          <EditEntryForm
            entry={entry}
            key={entry.updated_at}
            onCancel={() => setEditing(false)}
            onSubmit={onUpdate}
            pending={updatePending}
          />
        ) : null}
      </div>
    </article>
  );
}

function EditEntryForm({
  entry,
  onSubmit,
  onCancel,
  pending,
}: {
  entry: ReadEntry;
  onSubmit: (input: ReadInput) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [status, setStatus] = useState<ReadStatus>(entry.status);
  const [startedDate, setStartedDate] = useState(toDateInput(entry.started_at));
  const [finishedDate, setFinishedDate] = useState(toDateInput(entry.finished_at));
  const [rating, setRating] = useState(entry.rating ? String(entry.rating) : "");
  const [notes, setNotes] = useState(entry.notes ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ratingValue = rating === "" ? undefined : Number(rating);
    onSubmit({
      status,
      ...(status === "want_to_read" || status === "reading" || ratingValue === undefined
        ? {}
        : { rating: ratingValue }),
      ...(status === "want_to_read" || !startedDate
        ? {}
        : { started_at: dateToTimestamp(startedDate) }),
      ...((status !== "read" && status !== "did_not_finish") || !finishedDate
        ? {}
        : { finished_at: dateToTimestamp(finishedDate) }),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  }

  return (
    <form className="mt-5 grid gap-4 rounded-2xl bg-[#f8f7f4] p-4 sm:grid-cols-2" onSubmit={submit}>
      <label className="grid gap-1.5 text-sm font-semibold text-[var(--ink)]">
        Shelf
        <select
          className={fieldClass}
          onChange={(event) => setStatus(event.target.value as ReadStatus)}
          value={status}
        >
          {readStatuses.map((value) => (
            <option key={value} value={value}>
              {statusLabel(value)}
            </option>
          ))}
        </select>
      </label>
      {status === "read" || status === "did_not_finish" ? (
        <label className="grid gap-1.5 text-sm font-semibold text-[var(--ink)]">
          Rating
          <input
            className={fieldClass}
            max="5"
            min="0.5"
            onChange={(event) => setRating(event.target.value)}
            placeholder="No rating"
            step="0.5"
            type="number"
            value={rating}
          />
        </label>
      ) : (
        <div />
      )}
      <label className="grid gap-1.5 text-sm font-semibold text-[var(--ink)]">
        Started
        <input
          className={fieldClass}
          onChange={(event) => setStartedDate(event.target.value)}
          type="date"
          value={startedDate}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-[var(--ink)]">
        Finished
        <input
          className={fieldClass}
          onChange={(event) => setFinishedDate(event.target.value)}
          type="date"
          value={finishedDate}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-[var(--ink)] sm:col-span-2">
        Private note
        <textarea
          className={`${fieldClass} min-h-24 resize-y`}
          maxLength={2000}
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </label>
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <button
          className="rounded-full bg-[var(--forest)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--forest-dark)] disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          className="rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const fieldClass =
  "w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal outline-none focus:border-[var(--forest)]";

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

function toDateInput(value?: string): string {
  return value ? value.slice(0, 10) : "";
}

function dateToTimestamp(value: string): string {
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(value),
  );
}
