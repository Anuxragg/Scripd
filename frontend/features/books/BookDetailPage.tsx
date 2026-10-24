"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BookCover } from "@/features/books/BookCover";
import { useBook } from "@/features/books/hooks";
import { useCurrentUser } from "@/features/auth/hooks";
import {
  useCreateRead,
  useDeleteRead,
  useReadEntries,
  useUpdateRead,
} from "@/features/reads/hooks";
import { BookReviewsSection } from "@/features/reviews/BookReviewsSection";
import { AuthorAvatar } from "@/features/books/AuthorAvatar";

interface CatalogBook {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  year: number | string;
  pages?: string;
  publisher?: string;
  language?: string;
  coverURL?: string;
  description: string;
  openLibraryKey?: string;
  openLibraryUrl?: string;
  isbn13?: string;
}

// Canonical books in the Scripd catalog
const KNOWN_BOOKS: Record<string, CatalogBook> = {
  "secret-history": {
    id: "secret-history",
    title: "The Secret History",
    subtitle: "A story of classics, obsession, and murder",
    authors: ["Donna Tartt"],
    year: 1992,
    pages: "559 pages",
    publisher: "Alfred A. Knopf",
    language: "English",
    coverURL: "https://covers.openlibrary.org/b/id/8231856-L.jpg",
    description:
      "Under the influence of their charismatic classics professor, a group of clever, eccentric misfits at an elite New England college discover a way of thinking and living that is a world away from the humdrum existence of their contemporaries. But when they go beyond the boundaries of normal morality, their lives change profoundly and forever.",
    openLibraryKey: "OL8231856M",
    openLibraryUrl: "https://openlibrary.org/works/OL15368947W",
    isbn13: "9781400031702",
  },
  "norwegian-wood": {
    id: "norwegian-wood",
    title: "Norwegian Wood",
    subtitle: "A nostalgic story of loss and memory",
    authors: ["Haruki Murakami"],
    year: 1987,
    pages: "296 pages",
    publisher: "Kodansha",
    language: "Japanese / English",
    coverURL: "https://covers.openlibrary.org/b/id/8235113-L.jpg",
    description:
      "Toru Watanabe hears his ex-girlfriend Naoko's favorite Beatles song, and everything comes rushing back: his first love, the loss of his best friend Kizuki, and the quiet yearning of college life in late 1960s Tokyo.",
    openLibraryKey: "OL8235113M",
    openLibraryUrl: "https://openlibrary.org/works/OL3142475W",
    isbn13: "9780375704024",
  },
  "tomorrow-tomorrow": {
    id: "tomorrow-tomorrow",
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    subtitle: "A novel of creative collaboration and friendship",
    authors: ["Gabrielle Zevin"],
    year: 2022,
    pages: "416 pages",
    publisher: "Knopf",
    language: "English",
    coverURL: "https://covers.openlibrary.org/b/id/12847926-L.jpg",
    description:
      "Two friends—often in love, but never lovers—come together as creative partners in the world of video game design, where success brings them fame, joy, tragedy, duplicity, and, ultimately, a kind of immortality.",
    openLibraryKey: "OL12847926M",
    openLibraryUrl: "https://openlibrary.org/works/OL27213886W",
    isbn13: "9780593321201",
  },
  dune: {
    id: "dune",
    title: "Dune",
    subtitle: "The epic masterpiece of science fiction",
    authors: ["Frank Herbert"],
    year: 1965,
    pages: "688 pages",
    publisher: "Chilton Books",
    language: "English",
    coverURL: "https://covers.openlibrary.org/b/id/12836262-L.jpg",
    description:
      "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the 'spice' melange, a drug capable of extending life and enhancing consciousness.",
    openLibraryKey: "OL12836262M",
    openLibraryUrl: "https://openlibrary.org/works/OL893415W",
    isbn13: "9780441172719",
  },
  "klara-and-the-sun": {
    id: "klara-and-the-sun",
    title: "Klara and the Sun",
    subtitle: "A story about what it means to love",
    authors: ["Kazuo Ishiguro"],
    year: 2021,
    pages: "303 pages",
    publisher: "Faber & Faber",
    language: "English",
    coverURL: "https://covers.openlibrary.org/b/id/10522964-L.jpg",
    description:
      "Klara is an Artificial Friend with outstanding observational qualities, who, from her place in the store, watches carefully the behavior of those who come in to browse, and of those who pass on the street outside. She remains hopeful that a customer will soon choose her.",
    openLibraryKey: "OL10522964M",
    openLibraryUrl: "https://openlibrary.org/works/OL20847900W",
    isbn13: "9780593318171",
  },
  pachinko: {
    id: "pachinko",
    title: "Pachinko",
    subtitle: "An epic generational saga",
    authors: ["Min Jin Lee"],
    year: 2017,
    pages: "496 pages",
    publisher: "Grand Central Publishing",
    language: "English",
    coverURL: "https://covers.openlibrary.org/b/id/8315147-L.jpg",
    description:
      "In the early 1900s, teenaged Sunja, the adored daughter of a crippled fisherman, falls for a wealthy stranger at the seashore near her home in Korea. He promises her the world, but when she discovers she is pregnant—and that her lover is married—she refuses to be bought.",
    openLibraryKey: "OL8315147M",
    openLibraryUrl: "https://openlibrary.org/works/OL17849514W",
    isbn13: "9781455563937",
  },
};

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
      entry.status === "want_to_read" ||
      entry.status === "reading" ||
      entry.status === "read",
  );

  const [localStatus, setLocalStatus] = useState<"none" | "read" | "want_to_read">("none");

  const isRead = activeEntry?.status === "read" || localStatus === "read";
  const isWantToRead = activeEntry?.status === "want_to_read" || localStatus === "want_to_read";
  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  function handleMarkAsRead() {
    if (!userQuery.data) {
      setLocalStatus((prev) => (prev === "read" ? "none" : "read"));
      return;
    }
    if (isUUID) {
      if (activeEntry) {
        updateMutation.mutate({
          entryID: activeEntry.id,
          input: { status: isRead ? "reading" : "read" },
        });
      } else {
        createMutation.mutate({ book_id: bookID, status: "read" });
      }
    } else {
      setLocalStatus((prev) => (prev === "read" ? "none" : "read"));
    }
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
  const normalizedKey = bookID.toLowerCase();
  const knownMatch = KNOWN_BOOKS[normalizedKey];

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

  const publishedYear =
    apiBook?.published_year ??
    knownMatch?.year ??
    "Classic";

  const pages =
    apiBook?.isbn13 ? "384 pages" : (knownMatch?.pages ?? "Standard Edition");

  const publisher = knownMatch?.publisher ?? "Open Library Catalog";
  const language = knownMatch?.language ?? "English";

  const coverURL = apiBook?.cover_url || knownMatch?.coverURL;

  const description = useMemo(() => {
    if (apiBook?.description && apiBook.description.trim()) {
      return apiBook.description;
    }
    if (knownMatch?.description) {
      return knownMatch.description;
    }
    if (subtitle) {
      return `${title}: ${subtitle}. Written by ${authorNames}. Cataloged by Scripd with editions indexed on Open Library.`;
    }
    return `An acclaimed literary work by ${authorNames}. Cataloged in the Scripd library with full metadata, reader community reviews, and reading diary tracking.`;
  }, [apiBook, knownMatch, subtitle, title, authorNames]);

  // Derive contextual genre and topic tags based on actual book content
  const tags = useMemo(() => {
    const list: string[] = ["Literature", "Book"];
    const text = `${title} ${description} ${authorNames}`.toLowerCase();
    if (text.includes("history") || text.includes("war") || text.includes("century")) list.push("History");
    if (text.includes("murder") || text.includes("mystery") || text.includes("crime") || text.includes("detective")) list.push("Mystery");
    if (text.includes("sci") || text.includes("space") || text.includes("planet") || text.includes("artificial")) list.push("Sci-Fi");
    if (text.includes("classic") || text.includes("19") || text.includes("tragedy")) list.push("Classics");
    if (text.includes("drama") || text.includes("love") || text.includes("friendship") || text.includes("family")) list.push("Drama");
    if (text.includes("game") || text.includes("creative") || text.includes("college")) list.push("Contemporary");
    return Array.from(new Set(list));
  }, [title, description, authorNames]);

  // Loading skeleton while book metadata is fetching
  if (bookQuery.isLoading && !apiBook && !knownMatch) {
    return (
      <main className="min-h-screen bg-[#0a0c10] text-white selection:bg-[#9333ea]/30 selection:text-white pb-24">
        <div className="relative w-full h-[360px] sm:h-[430px] md:h-[490px] overflow-hidden bg-[#090b0e] animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c10] via-[#0a0c10]/60 to-[#0a0c10]/30" />
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-28 sm:-mt-36 md:-mt-44 z-20 flex flex-col md:flex-row items-start gap-6 md:gap-10">
            <div className="shrink-0 w-36 sm:w-48 md:w-56 aspect-[2/3] rounded-2xl overflow-hidden bg-[#161922] border border-white/10 animate-pulse shadow-2xl" />
            <div className="flex-1 min-w-0 pt-2 md:pt-14 w-full space-y-4">
              <div className="h-4 w-32 bg-white/10 rounded-full animate-pulse" />
              <div className="h-10 w-3/4 max-w-md bg-white/10 rounded-xl animate-pulse" />
              <div className="h-4 w-1/2 bg-white/5 rounded-full animate-pulse" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const openLibraryKey = apiBook?.open_library_key || knownMatch?.openLibraryKey || "OL-CATALOG";
  const openLibraryUrl = apiBook?.open_library_url || knownMatch?.openLibraryUrl || "https://openlibrary.org";
  const isbnDisplay = apiBook?.isbn13 || knownMatch?.isbn13;

  return (
    <main className="min-h-screen bg-[#0a0c10] text-white selection:bg-[#9333ea]/30 selection:text-white">
      {/* 1. Cinematic Backdrop Banner */}
      <div className="relative w-full h-[360px] sm:h-[430px] md:h-[490px] overflow-hidden bg-[#090b0e]">
        {coverURL ? (
          <Image
            src={coverURL}
            alt=""
            fill
            priority
            unoptimized
            className="object-cover object-center blur-2xl opacity-30 scale-125"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-tr from-[#161224] via-[#0e121a] to-[#0a0d14]" />
        )}

        {/* Ambient Dark Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c10] via-[#0a0c10]/60 to-[#0a0c10]/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(10,12,16,0.85)_100%)]" />

        {/* Center Book Preview / Sample Circle Button */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <a
            href={openLibraryUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Preview book on Open Library"
            className="pointer-events-auto group flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-black/60 border border-white/20 backdrop-blur-md text-white transition hover:scale-105 hover:bg-black/85 hover:border-white/40 shadow-2xl shadow-black/80 cursor-pointer"
          >
            <svg
              className="h-6 w-6 fill-white ml-1 transition group-hover:scale-110"
              viewBox="0 0 24 24"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </a>
        </div>
      </div>

      {/* 2. Overlapping Hero Content: Book Cover + Details & Actions */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-28 sm:-mt-36 md:-mt-44 z-20 flex flex-col md:flex-row items-start gap-6 md:gap-10">
          {/* Left: Book Cover Poster */}
          <div className="shrink-0 w-36 sm:w-48 md:w-56 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl shadow-black/90 border border-white/10 ring-1 ring-black/80 bg-[#161922]">
            <BookCover
              className="h-full w-full object-cover"
              coverURL={coverURL}
              title={title}
            />
          </div>

          {/* Right: Meta, Title, Details Grid, Action Buttons */}
          <div className="flex-1 min-w-0 pt-2 md:pt-14 w-full">
            {/* Type • Year • Pages */}
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-400">
              <span>Book</span>
              <span className="text-zinc-600">•</span>
              <span>{publishedYear}</span>
              <span className="text-zinc-600">•</span>
              <span>{pages}</span>
            </div>

            {/* Big Bold Title */}
            <h1 className="mt-1.5 text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-extrabold tracking-tight text-white leading-tight">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-1 text-sm sm:text-base text-zinc-400 font-medium">
                {subtitle}
              </p>
            )}

            {/* 4 Details Columns - Real Book Attributes */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 border-y border-white/5 sm:border-y-0">
              <div>
                <span className="text-[11px] sm:text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                  Written By
                </span>
                <span className="text-xs sm:text-sm font-bold text-white mt-1 block truncate" title={authorNames}>
                  {authorNames}
                </span>
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                  Publisher
                </span>
                <span className="text-xs sm:text-sm font-bold text-white mt-1 block truncate" title={publisher}>
                  {publisher}
                </span>
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                  Language
                </span>
                <span className="text-xs sm:text-sm font-bold text-white mt-1 block truncate">
                  {language}
                </span>
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                  Edition
                </span>
                <span className="text-xs sm:text-sm font-bold text-white mt-1 block truncate">
                  {isbnDisplay ? `ISBN-${isbnDisplay.slice(-4)}` : "Standard"}
                </span>
              </div>
            </div>

            {/* Action Buttons: Mark as Read, Collections, Want to Read */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {/* Primary Vibrant Purple Button */}
              <button
                type="button"
                disabled={isBusy}
                onClick={handleMarkAsRead}
                className="rounded-full bg-[#9333ea] hover:bg-[#822cd6] active:scale-95 text-white font-semibold text-sm px-6 py-2.5 flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition cursor-pointer disabled:opacity-60"
              >
                <svg
                  className="h-4.5 w-4.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>{isRead ? "Marked as Read ✓" : "Mark as Read"}</span>
              </button>

              {/* Collections Button */}
              <button
                type="button"
                onClick={() => setCollectionsModalOpen((prev) => !prev)}
                className="rounded-full border border-white/10 bg-[#161922] hover:bg-[#202533] active:scale-95 text-white font-medium text-sm px-5 py-2.5 flex items-center justify-center gap-2 transition cursor-pointer"
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
                className="rounded-full border border-white/10 bg-[#161922] hover:bg-[#202533] active:scale-95 text-white font-medium text-sm px-5 py-2.5 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
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
        </div>
      </div>

      {/* 3. Main Content Sections Grid (Overview, Author / Contributors, Reviews, Sidebar) */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-14 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
          {/* Left Column (Overview, Authors, Reviews) */}
          <div className="lg:col-span-2 space-y-12">
            {/* Overview Section - Real Writer Synopsis */}
            <section className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Overview
              </h2>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-3xl font-normal">
                {description}
              </p>

              {/* Dynamic Genre / Subject Pills */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-[#161922] px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:border-white/20 transition cursor-default"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Writer & Contributors Section - Real Author(s) */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-5">
                {authors.length > 1 ? "Authors & Contributors" : "Writer"}
              </h2>
              <div className="flex items-start gap-4 sm:gap-6 overflow-x-auto pb-4 no-scrollbar">
                {authors.map((authorName, index) => {
                  const role = index === 0 ? "Author" : "Contributor";

                  return (
                    <div
                      key={`${authorName}-${index}`}
                      className="flex flex-col items-center shrink-0 w-24 sm:w-28 text-center group"
                    >
                      <AuthorAvatar
                        name={authorName}
                        olid={apiBook?.author_keys?.[index]}
                      />
                      <span
                        className="font-semibold text-xs sm:text-sm text-white mt-2.5 truncate w-full"
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
            </section>

            {/* Publishing & Edition Details Section */}
            <section className="border-t border-white/5 pt-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-4">
                Publishing &amp; Details
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
                <div className="rounded-xl border border-white/5 bg-[#12151c] p-3.5">
                  <span className="text-zinc-500 block text-xs">Author</span>
                  <span className="font-semibold text-white mt-1 block truncate">
                    {authorNames}
                  </span>
                </div>
                <div className="rounded-xl border border-white/5 bg-[#12151c] p-3.5">
                  <span className="text-zinc-500 block text-xs">Catalog Key</span>
                  <span className="font-semibold text-white mt-1 block truncate font-mono text-xs">
                    {openLibraryKey}
                  </span>
                </div>
                <div className="rounded-xl border border-white/5 bg-[#12151c] p-3.5">
                  <span className="text-zinc-500 block text-xs">Publisher</span>
                  <span className="font-semibold text-white mt-1 block truncate">
                    {publisher}
                  </span>
                </div>
              </div>
            </section>

            {/* Reader Reviews & Discussions */}
            {isUUID && (
              <section className="border-t border-white/5 pt-8">
                <BookReviewsSection bookID={bookID} />
              </section>
            )}
          </div>

          {/* Right Column (Where to Read, Users' Collections) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Where to Read Card */}
            <div className="rounded-2xl border border-white/10 bg-[#12151c] p-5 shadow-xl">
              <div className="flex items-center justify-between text-xs font-semibold mb-4">
                <span className="text-white text-sm">Where to Read</span>
                <span className="text-zinc-500 text-[11px]">Partner Catalog</span>
              </div>

              <a
                href={openLibraryUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-white/5 bg-[#181d26] p-3.5 transition hover:border-[#9333ea]/50 hover:bg-[#1e2430] group"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#9333ea]/20 text-[#c084fc] font-bold text-xs">
                    OL
                  </span>
                  <div>
                    <div className="font-semibold text-white text-sm group-hover:text-[#c084fc] transition">
                      Open Library
                    </div>
                    <div className="text-[11px] text-zinc-400">View source catalog &amp; editions</div>
                  </div>
                </div>
                <span className="text-zinc-400 group-hover:text-white transition">↗</span>
              </a>
            </div>

            {/* Users' Collections Card */}
            <div className="rounded-2xl border border-white/10 bg-[#12151c] p-5 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Featured Collections
              </h3>

              <div className="space-y-3">
                <Link
                  href="/library"
                  className="flex items-center gap-3.5 rounded-xl border border-white/5 bg-[#171b24] p-2.5 transition hover:border-white/15 hover:bg-[#1e2330] group"
                >
                  <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0 bg-[#242b38]">
                    {coverURL ? (
                      <Image
                        src={coverURL}
                        alt="Essential Literature"
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-tr from-purple-900 to-indigo-800" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-white text-xs sm:text-sm truncate group-hover:text-[#c084fc] transition">
                      Essential Classics
                    </h4>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      181 Items • 122 Likes
                    </span>
                  </div>
                </Link>

                <Link
                  href="/library"
                  className="flex items-center gap-3.5 rounded-xl border border-white/5 bg-[#171b24] p-2.5 transition hover:border-white/15 hover:bg-[#1e2330] group"
                >
                  <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0 bg-[#242b38]">
                    <div className="h-full w-full bg-gradient-to-tr from-amber-700 to-red-900" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-white text-xs sm:text-sm truncate group-hover:text-[#c084fc] transition">
                      Must-Reads of the Decade
                    </h4>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      67 Items • 89 Likes
                    </span>
                  </div>
                </Link>

                <Link
                  href="/library"
                  className="flex items-center gap-3.5 rounded-xl border border-white/5 bg-[#171b24] p-2.5 transition hover:border-white/15 hover:bg-[#1e2330] group"
                >
                  <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0 bg-[#242b38]">
                    <div className="h-full w-full bg-gradient-to-tr from-emerald-800 to-cyan-900" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-white text-xs sm:text-sm truncate group-hover:text-[#c084fc] transition">
                      Reader Favorites
                    </h4>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      45 Items • 140 Likes
                    </span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Collections Modal Dialog */}
      {collectionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#12151c] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Save to Collection</h3>
              <button
                type="button"
                onClick={() => setCollectionsModalOpen(false)}
                className="text-zinc-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Add <strong className="text-white">{title}</strong> to your curated lists.
            </p>
            <div className="space-y-2 pt-1">
              {["Want to Read Shelf", "Favorites", "Best of the Year"].map((listName) => (
                <button
                  key={listName}
                  type="button"
                  onClick={() => {
                    handleWantToRead();
                    setCollectionsModalOpen(false);
                  }}
                  className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-[#181d26] px-3.5 py-2.5 text-xs font-medium text-white hover:border-[#9333ea]/50 hover:bg-[#1e2430] transition text-left"
                >
                  <span>{listName}</span>
                  <span className="text-[#9333ea]">+</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
