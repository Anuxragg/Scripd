"use client";

import { useMemo, useState } from "react";
import { BookCover } from "@/features/books/BookCover";
import { useBook, useBookDescription } from "@/features/books/hooks";
import { useCurrentUser } from "@/features/auth/hooks";
import {
  useCreateRead,
  useDeleteRead,
  useReadEntries,
  useUpdateRead,
} from "@/features/reads/hooks";
import { BookReviewsSection } from "@/features/reviews/BookReviewsSection";
import { AuthorAvatar } from "@/features/books/AuthorAvatar";
import { WhereToReadSection } from "@/features/books/WhereToReadSection";
import { useClientStorage } from "@/lib/useClientStorage";
import { AddToListModal } from "@/features/lists/AddToListModal";
import { findKnownBook } from "@/features/books/catalog";

import type { Book } from "@/features/books/api";

export function BookDetailPage({
  bookID,
  initialBook,
}: {
  bookID: string;
  initialBook?: Book | null;
}) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookID);
  const bookQuery = useBook(bookID, initialBook);
  const userQuery = useCurrentUser();
  const [collectionsModalOpen, setCollectionsModalOpen] = useState(false);

  // Read status mutations
  const entriesQuery = useReadEntries({ bookID, limit: 50 }, Boolean(userQuery.data && isUUID));
  const createMutation = useCreateRead();
  const updateMutation = useUpdateRead();
  const deleteMutation = useDeleteRead();

  const entries = useMemo(
    () => entriesQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [entriesQuery.data],
  );
  const activeEntry = entries.find(
    (entry) =>
      entry.status === "want_to_read" || entry.status === "reading" || entry.status === "read",
  );

  const [localStatus, setLocalStatus] = useState<"none" | "read" | "want_to_read">("none");
  const ratingStorageKey = `scripd:book-rating:${userQuery.data?.id ?? "guest"}:${bookID}`;
  const [localRating, setLocalRating] = useClientStorage<number | null>(ratingStorageKey, null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const activeRating = activeEntry?.rating ?? localRating;
  const displayRating = hoverRating !== null ? hoverRating : (activeRating ?? 0);

  const isWantToRead = activeEntry?.status === "want_to_read" || localStatus === "want_to_read";
  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  function handleRate(ratingValue: number) {
    if (!userQuery.data) {
      if (localRating === ratingValue) {
        setLocalRating(null);
        setLocalStatus("none");
      } else {
        setLocalRating(ratingValue);
        setLocalStatus("read");
      }
      return;
    }

    if (isUUID) {
      if (activeEntry) {
        if (activeEntry.rating === ratingValue) {
          updateMutation.mutate({
            entryID: activeEntry.id,
            input: { status: activeEntry.status, rating: undefined },
          });
          setLocalRating(null);
        } else {
          updateMutation.mutate({
            entryID: activeEntry.id,
            input: { status: "read", rating: ratingValue },
          });
          setLocalRating(ratingValue);
          setLocalStatus("read");
        }
      } else {
        createMutation.mutate({
          book_id: bookID,
          status: "read",
          rating: ratingValue,
        });
        setLocalRating(ratingValue);
        setLocalStatus("read");
      }
    } else {
      if (localRating === ratingValue) {
        setLocalRating(null);
        setLocalStatus("none");
      } else {
        setLocalRating(ratingValue);
        setLocalStatus("read");
      }
    }
  }

  function handleClearRating() {
    if (!userQuery.data) {
      setLocalRating(null);
      return;
    }
    if (isUUID && activeEntry) {
      updateMutation.mutate({
        entryID: activeEntry.id,
        input: { status: activeEntry.status, rating: undefined },
      });
    }
    setLocalRating(null);
  }

  function handleWantToRead() {
    if (!userQuery.data) {
      setLocalStatus((prev) => (prev === "want_to_read" ? "none" : "want_to_read"));
      return;
    }
    if (isUUID) {
      if (activeEntry) {
        updateMutation.mutate({
          entryID: activeEntry.id,
          input: { status: isWantToRead ? "reading" : "want_to_read" },
        });
      } else {
        createMutation.mutate({ book_id: bookID, status: "want_to_read" });
      }
    } else {
      setLocalStatus((prev) => (prev === "want_to_read" ? "none" : "want_to_read"));
    }
  }

  // Derive dynamic book details: prioritizes live API data, then canonical catalog books, then formatted fallback
  const knownMatch = findKnownBook(bookID);

  const apiBook = bookQuery.data ?? initialBook;

  // Clean title: never show raw Open Library key like OL19714233W
  const isRawOpenLibraryKey = /^OL\d+[A-Z]$/i.test(bookID);
  const fallbackTitle = isRawOpenLibraryKey
    ? "Loading Book..."
    : decodeURIComponent(bookID)
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

  const title = apiBook?.title || knownMatch?.title || fallbackTitle;

  const subtitle = apiBook?.subtitle || knownMatch?.subtitle;

  const authors = useMemo(() => {
    if (apiBook?.authors && apiBook.authors.length > 0) return apiBook.authors;
    if (knownMatch?.authors && knownMatch.authors.length > 0) return knownMatch.authors;
    return ["Author Unknown"];
  }, [apiBook, knownMatch]);

  const authorNames = authors.join(", ");

  const existingDescription = apiBook?.description?.trim() || knownMatch?.description?.trim();
  const descriptionQuery = useBookDescription(
    {
      title,
      authors: authors.filter((author) => author !== "Author Unknown"),
      isbn13: apiBook?.isbn13 ?? knownMatch?.isbn13,
    },
    !existingDescription && Boolean(apiBook || knownMatch),
  );

  const publishedYear = apiBook?.published_year ?? knownMatch?.year ?? "Classic";

  const pages = apiBook?.isbn13 ? "384 pages" : (knownMatch?.pages ?? "Standard Edition");

  const coverURL = apiBook?.cover_url || knownMatch?.coverURL;

  const description = useMemo(() => {
    return existingDescription || descriptionQuery.data?.trim() || "";
  }, [existingDescription, descriptionQuery.data]);

  // Derive contextual genre and topic tags based on actual book content
  const tags = useMemo(() => {
    const list: string[] = ["Literature", "Book"];
    const text = `${title} ${description} ${authorNames}`.toLowerCase();
    if (text.includes("history") || text.includes("war") || text.includes("century"))
      list.push("History");
    if (
      text.includes("murder") ||
      text.includes("mystery") ||
      text.includes("crime") ||
      text.includes("detective")
    )
      list.push("Mystery");
    if (
      text.includes("sci") ||
      text.includes("space") ||
      text.includes("planet") ||
      text.includes("artificial")
    )
      list.push("Sci-Fi");
    if (text.includes("classic") || text.includes("19") || text.includes("tragedy"))
      list.push("Classics");
    if (
      text.includes("drama") ||
      text.includes("love") ||
      text.includes("friendship") ||
      text.includes("family")
    )
      list.push("Drama");
    if (text.includes("game") || text.includes("creative") || text.includes("college"))
      list.push("Contemporary");
    return Array.from(new Set(list));
  }, [title, description, authorNames]);

  // Loading skeleton while book metadata is fetching
  if (bookQuery.isLoading && !apiBook && !knownMatch) {
    return (
      <main className="min-h-screen bg-[#0a0c10] text-white selection:bg-[#9333ea]/30 selection:text-white pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 md:pt-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 items-start">
            <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
              <div className="shrink-0 w-36 sm:w-44 md:w-48 aspect-[2/3] rounded-2xl overflow-hidden bg-[#161922] border border-white/10 animate-pulse shadow-2xl" />
              <div className="flex-1 min-w-0 w-full space-y-4">
                <div className="h-4 w-32 bg-white/10 rounded-full animate-pulse" />
                <div className="h-10 w-3/4 max-w-md bg-white/10 rounded-xl animate-pulse" />
                <div className="h-4 w-1/2 bg-white/5 rounded-full animate-pulse" />
                <div className="space-y-2 pt-4 max-w-2xl">
                  <div className="h-4 w-full bg-white/5 rounded-full animate-pulse" />
                  <div className="h-4 w-5/6 bg-white/5 rounded-full animate-pulse" />
                  <div className="h-4 w-2/3 bg-white/5 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
            <div className="w-full max-w-[280px]">
              <div className="h-40 w-full bg-white/5 rounded-2xl animate-pulse" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0c10] text-white selection:bg-[#9333ea]/30 selection:text-white pb-36">
      {/* Hero Content: Book Cover + Details & Actions */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 md:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 items-start">
          {/* Left Column: Book Cover Poster + Meta, Title, Overview */}
          <div className="min-w-0 space-y-8">
            <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
              {/* Book Cover Poster */}
              <div className="shrink-0 w-36 sm:w-44 md:w-48 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl shadow-black/90 border border-white/10 ring-1 ring-black/80 bg-[#161922] self-start lg:sticky lg:top-24">
                <BookCover
                  className="h-full w-full object-cover"
                  coverURL={coverURL}
                  isbn13={apiBook?.isbn13 ?? knownMatch?.isbn13}
                  title={title}
                  authors={authors}
                />
              </div>

              {/* Meta, Title, Overview */}
              <div className="flex-1 min-w-0 w-full">
                {/* Type • Year • Pages */}
                <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-400">
                  <span>Book</span>
                  <span className="text-zinc-600">•</span>
                  <span>{publishedYear}</span>
                  <span className="text-zinc-600">•</span>
                  <span>{pages}</span>
                </div>

                {/* Book Title */}
                <h1 className="mt-1.5 book-detail-title text-[28px] font-semibold leading-[28px] text-white">
                  {title}
                </h1>

                {subtitle && (
                  <p className="mt-1 text-sm sm:text-base text-zinc-400 font-medium">{subtitle}</p>
                )}

                {/* Overview Heading, Synopsis Paragraph & Capsules */}
                <div className="mt-5 space-y-3">
                  <h2 className="book-overview-heading text-[20px] font-medium leading-[28px] text-[rgb(226,226,226)] tracking-normal">
                    Overview
                  </h2>
                  <p className="book-overview-para text-[16px] font-normal leading-[26px] text-[rgb(179,179,179)]">
                    {description ||
                      (descriptionQuery.isLoading
                        ? "Looking up the book overview…"
                        : "Overview unavailable for this edition.")}
                  </p>

                  {/* Dynamic Genre / Subject Capsules */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2.5 pt-1.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="site-capsule bg-[#1a1d24] hover:bg-[#222630] border border-white/5 text-[rgb(225,230,240)] hover:text-white text-[15px] font-medium leading-[20px] px-4 py-2 rounded-xl transition cursor-default"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Writer & Contributors Section (Aligned with Overview) */}
                <div className="mt-7 space-y-3">
                  <h2 className="book-overview-heading text-[20px] font-medium leading-[28px] text-[rgb(226,226,226)] tracking-normal">
                    {authors.length > 1 ? "Authors & Contributors" : "Writer"}
                  </h2>
                  <div className="flex items-start gap-4 sm:gap-6 overflow-x-auto pb-2 no-scrollbar">
                    {authors.map((authorName, index) => {
                      const role = index === 0 ? "Author" : "Contributor";

                      return (
                        <div
                          key={`${authorName}-${index}`}
                          className="flex flex-col items-center shrink-0 w-20 sm:w-24 text-center group"
                        >
                          <AuthorAvatar name={authorName} olid={apiBook?.author_keys?.[index]} />
                          <span
                            className="font-semibold text-xs sm:text-sm text-white mt-2 truncate w-full"
                            title={authorName}
                          >
                            {authorName}
                          </span>
                          <span className="text-[11px] text-zinc-400 truncate w-full mt-0.5">
                            {role}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reviews sit directly below the writer/contributors details. */}
                <section className="mt-8 border-t border-white/5 pt-6">
                  <BookReviewsSection
                    bookID={bookID}
                    bookTitle={title}
                    bookCover={coverURL}
                    bookAuthors={authors}
                    bookYear={
                      typeof publishedYear === "number" || /^\d{4}$/.test(String(publishedYear))
                        ? String(publishedYear)
                        : undefined
                    }
                  />
                </section>
              </div>
            </div>
          </div>

          {/* Right Column: Rating Box & Where To Read */}
          <div className="w-full max-w-[280px] space-y-4">
            <div className="w-full rounded-2xl border border-[#4d5c6b] bg-[#5B6C7D] p-5 shadow-xl space-y-3.5">
              {/* 5-Star Letterboxd Rating Panel */}
              <div
                onMouseLeave={() => setHoverRating(null)}
                className="w-full flex flex-col items-center justify-center gap-1.5 pt-0.5 pb-0.5"
              >
                {/* Centered 'Rate' label exactly like Letterboxd (Image 1 & Image 3) */}
                <button
                  type="button"
                  onClick={() => {
                    if (activeRating) handleClearRating();
                  }}
                  className={`text-xs sm:text-sm font-semibold tracking-wide transition select-none ${
                    activeRating
                      ? "text-[#00e054] hover:text-white cursor-pointer"
                      : "text-white/90 cursor-default"
                  }`}
                  title={activeRating ? "Click to clear rating" : undefined}
                >
                  Rate
                </button>

                {/* 5 Solid Stars Row */}
                <div className="flex items-center justify-center -space-x-0.5 sm:-space-x-1 py-1 w-full">
                  {[1, 2, 3, 4, 5].map((starIndex) => {
                    const isFull = displayRating >= starIndex;
                    const isHalf = !isFull && displayRating >= starIndex - 0.5;

                    return (
                      <div
                        key={starIndex}
                        className="relative flex items-center justify-center group cursor-pointer"
                      >
                        {/* Invisible Left Half Click/Hover Target (0.5 star) */}
                        <button
                          type="button"
                          disabled={isBusy || userQuery.isLoading}
                          aria-label={`Rate ${starIndex - 0.5} stars`}
                          onMouseEnter={() => setHoverRating(starIndex - 0.5)}
                          onClick={() => handleRate(starIndex - 0.5)}
                          className="absolute left-0 top-0 w-1/2 h-full z-10 cursor-pointer disabled:cursor-not-allowed"
                        />
                        {/* Invisible Right Half Click/Hover Target (1.0 star) */}
                        <button
                          type="button"
                          disabled={isBusy || userQuery.isLoading}
                          aria-label={`Rate ${starIndex} stars`}
                          onMouseEnter={() => setHoverRating(starIndex)}
                          onClick={() => handleRate(starIndex)}
                          className="absolute right-0 top-0 w-1/2 h-full z-10 cursor-pointer disabled:cursor-not-allowed"
                        />

                        {/* Star SVG: solid dark silhouette base (#334455), clean solid green fill (#00e054), zero border on half-selected */}
                        <svg
                          className="w-9 h-9 sm:w-10 sm:h-10 pointer-events-none transition-colors"
                          viewBox="0 0 24 24"
                        >
                          <defs>
                            <clipPath id={`star-left-half-${starIndex}`}>
                              <rect x="0" y="0" width="12" height="24" />
                            </clipPath>
                          </defs>

                          {/* Base solid dark silhouette star (#334455) */}
                          <path
                            fill="#334455"
                            d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                          />

                          {/* Half-star: left half solid green (#00e054), right half remains #334455 with NO border */}
                          {isHalf && (
                            <path
                              fill="#00e054"
                              clipPath={`url(#star-left-half-${starIndex})`}
                              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                            />
                          )}

                          {/* Full-star: solid green (#00e054) */}
                          {isFull && (
                            <path
                              fill="#00e054"
                              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                            />
                          )}
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sub-Actions: Collections & Want to Read stacked vertically inside the #5B6C7D Box */}
              <div className="pt-2 border-t border-[#4d5c6b]/60 space-y-2">
                {/* Collections Button */}
                <button
                  type="button"
                  onClick={() => setCollectionsModalOpen((prev) => !prev)}
                  className="w-full rounded-xl border border-[#394653] bg-[#3f4d5c] hover:bg-[#34414e] active:scale-95 text-white font-medium text-xs sm:text-sm px-4 py-2.5 flex items-center justify-center gap-2.5 transition cursor-pointer shadow-sm"
                >
                  <svg
                    className="h-4 w-4 text-zinc-300"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                  </svg>
                  <span>Collections</span>
                </button>

                {/* Want to Read Button */}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleWantToRead}
                  className={`w-full rounded-xl border ${
                    isWantToRead
                      ? "bg-amber-500/25 text-amber-200 border-amber-400/50"
                      : "bg-[#3f4d5c] text-white hover:bg-[#34414e] border-[#394653]"
                  } active:scale-95 font-medium text-xs sm:text-sm px-4 py-2.5 flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-60 shadow-sm`}
                >
                  <svg
                    className="h-4 w-4 text-zinc-300"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{isWantToRead ? "On Reading List" : "Want to Read"}</span>
                </button>
              </div>
            </div>

            {/* Where to Read & Listen Section (Matches 280px width) */}
            <WhereToReadSection title={title} authorNames={authorNames} />
          </div>
        </div>
      </div>

      {/* Collections Modal Dialog */}
      <AddToListModal
        bookID={
          apiBook?.id &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apiBook.id)
            ? apiBook.id
            : bookID
        }
        bookTitle={title}
        open={collectionsModalOpen}
        onClose={() => setCollectionsModalOpen(false)}
      />
    </main>
  );
}
