"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { BookCover } from "@/features/books/BookCover";
import { useBookSearch } from "@/features/books/hooks";

export function BookSearchPage({
  initialQuery,
  initialPage,
}: {
  initialQuery: string;
  initialPage: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(initialPage);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const search = useBookSearch(debouncedQuery, page, debouncedQuery.length >= 2);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    setPage(1);
    const params = new URLSearchParams();
    if (normalized) params.set("q", normalized);
    const queryString = params.toString();
    router.replace(queryString ? `/books?${queryString}` : "/books", { scroll: false });
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    const params = new URLSearchParams({ q: debouncedQuery, page: String(nextPage) });
    router.push(`/books?${params}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const result = search.data;
  const hasSearch = debouncedQuery.length >= 2;

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="border-b border-[var(--line)] bg-[#f1efe8]">
        <div className="mx-auto max-w-7xl px-5 pb-14 pt-3 sm:px-8 sm:pb-16">
          <p className="eyebrow mt-8">The catalog</p>
          <h1 className="display-title mt-4 text-5xl sm:text-6xl">Find your next read.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Search books by title or author, then keep the ones you love in your reading life.
          </p>
          <form className="mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="book-search">
              Search by title or author
            </label>
            <input
              autoComplete="off"
              className="min-h-14 min-w-0 flex-1 rounded-2xl border border-[var(--line)] bg-white px-5 text-base text-[var(--ink)] shadow-sm outline-none transition placeholder:text-[#8b8e87] focus:border-[var(--forest)] focus:ring-2 focus:ring-[var(--forest)]/15"
              id="book-search"
              maxLength={120}
              minLength={2}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Try a title or author"
              type="search"
              value={query}
            />
            <button
              className="min-h-14 rounded-2xl bg-[var(--forest)] px-7 font-semibold text-white transition hover:bg-[var(--forest-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)]"
              type="submit"
            >
              Search books
            </button>
          </form>
        </div>
      </div>

      <section
        aria-label="Book search results"
        className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">A growing library</p>
            <h2 className="mt-2 font-serif text-2xl text-[var(--ink)]">
              {result ? `${result.meta.total.toLocaleString()} books found` : "Books to remember"}
            </h2>
          </div>
          {result?.meta.source === "local_catalog" ? (
            <p className="max-w-md rounded-full border border-[#d9cba7] bg-[#f8f0dc] px-4 py-2 text-sm text-[#665630]">
              Showing books already in Scripd while the live catalog reconnects.
            </p>
          ) : null}
        </div>

        {!hasSearch ? (
          <div className="mt-8 rounded-3xl border border-dashed border-[var(--line)] bg-white/60 px-6 py-14 text-center">
            <p className="font-serif text-2xl text-[var(--ink)]">Every shelf starts somewhere.</p>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[var(--muted)]">
              {query.trim().length === 1
                ? "Enter at least two characters to search the catalog."
                : "Search for a book or an author to find your next read."}
            </p>
          </div>
        ) : search.isPending ? (
          <div
            aria-label="Searching books"
            aria-live="polite"
            className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div className="animate-pulse" key={index}>
                <div className="aspect-[2/3] rounded-xl bg-[#e9e6df]" />
                <div className="mt-4 h-4 w-4/5 rounded bg-[#e9e6df]" />
                <div className="mt-2 h-3 w-2/3 rounded bg-[#e9e6df]" />
              </div>
            ))}
          </div>
        ) : search.isError ? (
          <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 px-6 py-8" role="alert">
            <h3 className="font-semibold text-red-900">We couldn’t find books right now.</h3>
            <p className="mt-2 text-sm leading-6 text-red-800">
              {search.error instanceof ApiError && search.error.code === "catalog_unavailable"
                ? "The catalog is temporarily unavailable. Please try again shortly."
                : "Something interrupted the search. Try again in a moment."}
            </p>
            <button
              className="mt-5 rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-100"
              onClick={() => search.refetch()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : result && result.data.length > 0 ? (
          <>
            <div
              aria-busy={search.isFetching}
              className="mt-8 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:grid-cols-6"
            >
              {result.data.map((book) => (
                <Link className="group min-w-0" href={`/books/${book.id}`} key={book.id}>
                  <BookCover
                    className="aspect-[2/3] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl"
                    coverURL={book.cover_url}
                    title={book.title}
                  />
                  <h3 className="mt-4 line-clamp-2 font-serif text-lg leading-6 text-[var(--ink)] group-hover:text-[var(--forest)]">
                    {book.title}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">
                    {book.authors.length ? book.authors.join(", ") : "Author unknown"}
                  </p>
                  {book.published_year ? (
                    <p className="mt-1 text-xs text-[#858980]">{book.published_year}</p>
                  ) : null}
                </Link>
              ))}
            </div>
            <nav
              aria-label="Search result pages"
              className="mt-12 flex items-center justify-center gap-5"
            >
              <button
                className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page <= 1 || search.isFetching}
                onClick={() => changePage(page - 1)}
                type="button"
              >
                Previous
              </button>
              <span className="text-sm text-[var(--muted)]">Page {page}</span>
              <button
                className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!result.meta.has_more || search.isFetching}
                onClick={() => changePage(page + 1)}
                type="button"
              >
                Next
              </button>
            </nav>
          </>
        ) : (
          <div className="mt-8 rounded-3xl border border-[var(--line)] bg-white/70 px-6 py-14 text-center">
            <p className="font-serif text-2xl text-[var(--ink)]">
              No books found for “{debouncedQuery}”
            </p>
            <p className="mt-3 text-[var(--muted)]">Try a shorter title or another author name.</p>
          </div>
        )}
      </section>
    </main>
  );
}
