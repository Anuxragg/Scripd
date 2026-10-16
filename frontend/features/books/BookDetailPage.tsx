"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import { BookCover } from "@/features/books/BookCover";
import { useBook } from "@/features/books/hooks";
import { ReadingActions } from "@/features/reads/ReadingActions";

export function BookDetailPage({ bookID }: { bookID: string }) {
  const bookQuery = useBook(bookID);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24">
        <Link className="text-sm font-semibold text-[var(--forest)] hover:underline" href="/books">
          ← Back to book search
        </Link>

        {bookQuery.isPending ? (
          <div
            aria-label="Loading book details"
            className="mt-10 grid animate-pulse gap-10 md:grid-cols-[minmax(220px,320px)_1fr]"
          >
            <div className="aspect-[2/3] rounded-2xl bg-[#e9e6df]" />
            <div>
              <div className="mt-4 h-4 w-28 rounded bg-[#e9e6df]" />
              <div className="mt-6 h-12 max-w-xl rounded bg-[#e9e6df]" />
              <div className="mt-5 h-5 max-w-sm rounded bg-[#e9e6df]" />
            </div>
          </div>
        ) : bookQuery.isError ? (
          <div className="mx-auto mt-16 max-w-xl rounded-3xl border border-[var(--line)] bg-white p-8 text-center">
            <p className="font-serif text-2xl text-[var(--ink)]">
              {bookQuery.error instanceof ApiError && bookQuery.error.status === 404
                ? "This book isn’t in the catalog yet."
                : "We couldn’t load this book."}
            </p>
            <p className="mt-3 leading-7 text-[var(--muted)]">
              Search the catalog to find another title.
            </p>
            <Link
              className="mt-6 inline-flex rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--forest-dark)]"
              href="/books"
            >
              Search books
            </Link>
          </div>
        ) : bookQuery.data ? (
          <article className="mt-10 grid items-start gap-10 md:grid-cols-[minmax(220px,320px)_1fr] md:gap-16">
            <BookCover
              className="mx-auto aspect-[2/3] w-full max-w-[320px] rounded-2xl md:mx-0"
              coverURL={bookQuery.data.cover_url}
              title={bookQuery.data.title}
            />
            <div className="pt-2">
              <p className="eyebrow">A book in the Scripd catalog</p>
              <h1 className="display-title mt-5 text-5xl sm:text-6xl">{bookQuery.data.title}</h1>
              {bookQuery.data.subtitle ? (
                <p className="mt-3 font-serif text-2xl text-[var(--muted)]">
                  {bookQuery.data.subtitle}
                </p>
              ) : null}
              <p className="mt-6 text-lg text-[var(--forest)]">
                {bookQuery.data.authors.length
                  ? bookQuery.data.authors.join(", ")
                  : "Author unknown"}
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                {bookQuery.data.published_year ? (
                  <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--muted)]">
                    First published {bookQuery.data.published_year}
                  </span>
                ) : null}
                {bookQuery.data.isbn13 ? (
                  <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--muted)]">
                    ISBN-13 {bookQuery.data.isbn13}
                  </span>
                ) : null}
              </div>
              <div className="mt-10 max-w-2xl border-t border-[var(--line)] pt-7">
                <h2 className="font-serif text-xl text-[var(--ink)]">About this book</h2>
                <p className="mt-3 leading-7 text-[var(--muted)]">
                  {bookQuery.data.description ||
                    "No description is available for this book yet. The catalog details and source link are still available below."}
                </p>
              </div>
              <div className="max-w-2xl">
                <ReadingActions bookID={bookQuery.data.id} />
              </div>
              <a
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--forest)] hover:underline"
                href={bookQuery.data.open_library_url}
                rel="noreferrer"
                target="_blank"
              >
                View source on Open Library <span aria-hidden="true">↗</span>
              </a>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Catalog metadata and cover image provided by Open Library.
              </p>
            </div>
          </article>
        ) : null}
      </div>
    </main>
  );
}
