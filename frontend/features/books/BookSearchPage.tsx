"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { BookCover } from "@/features/books/BookCover";
import { useBookSearch } from "@/features/books/hooks";

const FAMOUS_SUGGESTIONS = [
  "1984",
  "The Great Gatsby",
  "Dune",
  "Harry Potter",
  "Pride and Prejudice",
  "To Kill a Mockingbird",
  "The Hobbit",
  "Crime and Punishment",
];

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
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
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

  function handleSuggestionClick(suggestion: string) {
    setQuery(suggestion);
    setPage(1);
    router.replace(`/books?q=${encodeURIComponent(suggestion)}`, { scroll: false });
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
    <main className="min-h-screen bg-[#0a0c10] text-white selection:bg-[#9333ea]/30 selection:text-white pb-24">
      {/* Search Header Banner */}
      <div className="border-b border-white/5 bg-gradient-to-b from-[#121620] via-[#0d1017] to-[#0a0c10]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12 pt-6 sm:pb-16 sm:pt-8">
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 block">
            Open Library Catalog
          </span>
          <h1 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Find your next read.
          </h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-zinc-400 font-normal leading-relaxed">
            Search millions of titles and authors from the worldwide catalog.
          </p>

          {/* Search Form */}
          <form className="mt-7 flex max-w-3xl flex-col gap-3 sm:flex-row" onSubmit={submitSearch}>
            <div className="relative flex-1">
              <input
                autoComplete="off"
                className="h-13 w-full rounded-2xl border border-white/10 bg-[#151922] px-5 text-sm sm:text-base text-white shadow-xl outline-none transition placeholder:text-zinc-500 focus:border-[#9333ea] focus:ring-2 focus:ring-[#9333ea]/20"
                id="book-search"
                maxLength={120}
                minLength={2}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by title, author, or keyword (e.g. 1984, Dune, Gatsby)..."
                type="search"
                value={query}
              />
            </div>
            <button
              className="h-13 rounded-2xl bg-[#9333ea] px-8 font-semibold text-sm text-white transition hover:bg-[#822cd6] active:scale-95 shadow-lg shadow-purple-600/30 cursor-pointer"
              type="submit"
            >
              Search
            </button>
          </form>

          {/* Famous Books Quick Search Pills */}
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-500 font-medium mr-1">Popular:</span>
            {FAMOUS_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="rounded-full border border-white/10 bg-[#161a24] px-3.5 py-1 text-xs text-zinc-400 hover:text-white hover:border-[#9333ea]/50 hover:bg-[#1d2230] transition cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Section */}
      <section
        aria-label="Book search results"
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12"
      >
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {result && result.meta.total > 0
                ? `${result.meta.total.toLocaleString()} books found`
                : hasSearch
                  ? `Results for "${debouncedQuery}"`
                  : "Explore Books"}
            </h2>
          </div>
          {result?.meta.source === "local_catalog" && (
            <p className="rounded-full border border-white/10 bg-[#151922] px-3 py-1 text-xs text-zinc-400">
              Cached catalog results
            </p>
          )}
        </div>

        {/* Empty Query Prompt */}
        {!hasSearch ? (
          <div className="mt-12 rounded-3xl border border-dashed border-white/10 bg-[#12151c]/60 p-12 text-center max-w-xl mx-auto">
            <span className="text-3xl block mb-3">📖</span>
            <h3 className="text-lg font-bold text-white">Search any book in the world</h3>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              Type any title, author, or keyword above to instantly search through millions of
              editions.
            </p>
          </div>
        ) : search.isPending ? (
          /* Loading Pulse Grid */
          <div
            aria-label="Searching books"
            className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-6"
          >
            {Array.from({ length: 12 }, (_, index) => (
              <div className="animate-pulse flex flex-col" key={index}>
                <div className="aspect-[2/3] w-full rounded-xl bg-[#161a22] border border-white/5" />
                <div className="mt-3 h-4 w-4/5 rounded bg-[#161a22]" />
                <div className="mt-1.5 h-3 w-1/2 rounded bg-[#161a22]" />
              </div>
            ))}
          </div>
        ) : result && result.data.length > 0 ? (
          /* Search Results Grid */
          <>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-6">
              {result.data.map((book) => (
                <Link
                  className="group flex flex-col min-w-0"
                  href={`/books/${book.id}`}
                  key={book.id}
                  title={`${book.title} by ${book.authors.join(", ")}`}
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/10 bg-[#151922] shadow-xl transition duration-200 group-hover:border-white/40 group-hover:scale-[1.02]">
                    <BookCover
                      className="h-full w-full object-cover"
                      coverURL={book.cover_url}
                      title={book.title}
                    />
                  </div>

                  <h3 className="mt-3 line-clamp-2 text-sm font-bold text-white group-hover:text-[#c084fc] transition leading-snug">
                    {book.title}
                  </h3>

                  <p className="mt-1 line-clamp-1 text-xs text-zinc-400">
                    {book.authors.length ? book.authors.join(", ") : "Unknown Author"}
                  </p>

                  {book.published_year && (
                    <span className="mt-1 text-[11px] text-zinc-500 font-mono">
                      {book.published_year}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="mt-14 flex items-center justify-center gap-4">
              <button
                type="button"
                className="rounded-full border border-white/10 bg-[#161a22] px-5 py-2 text-xs font-semibold text-white hover:bg-[#202533] disabled:opacity-40 disabled:cursor-not-allowed transition"
                disabled={page <= 1 || search.isFetching}
                onClick={() => changePage(page - 1)}
              >
                ← Previous
              </button>
              <span className="text-xs text-zinc-400 font-medium">Page {page}</span>
              <button
                type="button"
                className="rounded-full border border-white/10 bg-[#161a22] px-5 py-2 text-xs font-semibold text-white hover:bg-[#202533] disabled:opacity-40 disabled:cursor-not-allowed transition"
                disabled={!result.meta.has_more || search.isFetching}
                onClick={() => changePage(page + 1)}
              >
                Next →
              </button>
            </div>
          </>
        ) : (
          /* No Results Found State */
          <div className="mt-12 rounded-3xl border border-white/10 bg-[#12151c] p-10 text-center max-w-lg mx-auto shadow-2xl">
            <h3 className="text-lg font-bold text-white">No exact match found</h3>
            <p className="mt-2 text-xs sm:text-sm text-zinc-400">
              Try searching with a shorter title, author last name, or try one of the popular titles
              below:
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {FAMOUS_SUGGESTIONS.slice(0, 5).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="rounded-full border border-[#9333ea]/30 bg-[#9333ea]/10 px-3.5 py-1 text-xs text-[#c084fc] hover:bg-[#9333ea]/20 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
