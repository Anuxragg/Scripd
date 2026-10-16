"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { useCurrentUser } from "@/features/auth/hooks";

interface PosterItem {
  id: string;
  title: string;
  author: string;
  year: number;
  coverURL: string;
  reviewer: {
    username: string;
    avatar: string;
    avatarBg: string;
    rating: string; // e.g. "★★★★½"
    hasReview: boolean;
    liked?: boolean;
  };
}

const NEW_ON_SCRIPD: PosterItem[] = [
  {
    id: "secret-history",
    title: "The Secret History",
    author: "Donna Tartt",
    year: 1992,
    coverURL: "https://covers.openlibrary.org/b/id/8231856-L.jpg",
    reviewer: {
      username: "_rodriigo07_",
      avatar: "R",
      avatarBg: "bg-[#795548]",
      rating: "★★★½",
      hasReview: true,
      liked: true,
    },
  },
  {
    id: "norwegian-wood",
    title: "Norwegian Wood",
    author: "Haruki Murakami",
    year: 1987,
    coverURL: "https://covers.openlibrary.org/b/id/8235113-L.jpg",
    reviewer: {
      username: "Shannon",
      avatar: "S",
      avatarBg: "bg-[#3f51b5]",
      rating: "★★★★★",
      hasReview: true,
      liked: true,
    },
  },
  {
    id: "tomorrow-tomorrow",
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    author: "Gabrielle Zevin",
    year: 2022,
    coverURL: "https://covers.openlibrary.org/b/id/12847926-L.jpg",
    reviewer: {
      username: "isabellawijsman",
      avatar: "I",
      avatarBg: "bg-[#009688]",
      rating: "★★★★",
      hasReview: true,
    },
  },
  {
    id: "dune",
    title: "Dune",
    author: "Frank Herbert",
    year: 1965,
    coverURL: "https://covers.openlibrary.org/b/id/12836262-L.jpg",
    reviewer: {
      username: "majaromanoff",
      avatar: "M",
      avatarBg: "bg-[#e91e63]",
      rating: "★★★½",
      hasReview: true,
    },
  },
  {
    id: "klara-and-the-sun",
    title: "Klara and the Sun",
    author: "Kazuo Ishiguro",
    year: 2021,
    coverURL: "https://covers.openlibrary.org/b/id/10522964-L.jpg",
    reviewer: {
      username: "TheRacynHyden",
      avatar: "T",
      avatarBg: "bg-[#ff5722]",
      rating: "★★★★",
      hasReview: true,
      liked: true,
    },
  },
  {
    id: "pachinko",
    title: "Pachinko",
    author: "Min Jin Lee",
    year: 2017,
    coverURL: "https://covers.openlibrary.org/b/id/8315147-L.jpg",
    reviewer: {
      username: "Lili",
      avatar: "L",
      avatarBg: "bg-[#673ab7]",
      rating: "★★★★½",
      hasReview: true,
      liked: true,
    },
  },
];

const POPULAR_REVIEWS = [
  {
    id: "rev-1",
    bookTitle: "The Secret History",
    author: "Donna Tartt",
    year: 1992,
    coverURL: "https://covers.openlibrary.org/b/id/8231856-L.jpg",
    reviewer: {
      name: "Elena Rostova",
      username: "elena_reads",
      avatar: "ER",
      avatarBg: "bg-[#ff8000]",
    },
    rating: "★★★★★",
    liked: true,
    rereadCount: "3rd read",
    date: "2 days ago",
    excerpt:
      "There is something intoxicating about revisiting this in late autumn. It feels less like reading a novel and more like drowning in a classical tragedy with cigarettes, rainy Vermont hills, and wool overcoats. Donna Tartt's sentence construction remains undefeated.",
    likes: 384,
    comments: 26,
  },
  {
    id: "rev-2",
    bookTitle: "Tomorrow, and Tomorrow, and Tomorrow",
    author: "Gabrielle Zevin",
    year: 2022,
    coverURL: "https://covers.openlibrary.org/b/id/12847926-L.jpg",
    reviewer: {
      name: "Marcus Vance",
      username: "marcus_books",
      avatar: "MV",
      avatarBg: "bg-[#00e054]",
    },
    rating: "★★★★½",
    liked: true,
    rereadCount: "1st read",
    date: "Yesterday",
    excerpt:
      "Sam and Sadie will live in my mind forever. This isn't just about video game development; it's about the rare, sacred creative alchemy between two friends who can never quite express their love except through the virtual worlds they build together.",
    likes: 512,
    comments: 42,
  },
  {
    id: "rev-3",
    bookTitle: "Klara and the Sun",
    author: "Kazuo Ishiguro",
    year: 2021,
    coverURL: "https://covers.openlibrary.org/b/id/10522964-L.jpg",
    reviewer: {
      name: "Clara Shen",
      username: "clara_archive",
      avatar: "CS",
      avatarBg: "bg-[#40bcf4]",
    },
    rating: "★★★★",
    liked: false,
    rereadCount: "1st read",
    date: "3 days ago",
    excerpt:
      "Klara's observational innocence makes every single heartbreak hit twice as hard. The way Ishiguro uses an Artificial Friend to gently interrogate what human love and loneliness actually mean is pure mastery.",
    likes: 219,
    comments: 15,
  },
];

const POPULAR_LISTS = [
  {
    title: "Novels that feel like a cold rainy Sunday with black tea",
    curator: "elena_reads",
    itemCount: 28,
    likes: 842,
    covers: [
      "https://covers.openlibrary.org/b/id/8231856-M.jpg",
      "https://covers.openlibrary.org/b/id/8235113-M.jpg",
      "https://covers.openlibrary.org/b/id/10522964-M.jpg",
      "https://covers.openlibrary.org/b/id/12847926-M.jpg",
      "https://covers.openlibrary.org/b/id/8315147-M.jpg",
    ],
  },
  {
    title: "Essential 20th Century Fiction Everyone Should Read Once",
    curator: "marcus_books",
    itemCount: 50,
    likes: 1420,
    covers: [
      "https://covers.openlibrary.org/b/id/12836262-M.jpg",
      "https://covers.openlibrary.org/b/id/8231856-M.jpg",
      "https://covers.openlibrary.org/b/id/8235113-M.jpg",
      "https://covers.openlibrary.org/b/id/7222246-M.jpg",
      "https://covers.openlibrary.org/b/id/10522964-M.jpg",
    ],
  },
  {
    title: "Short Masterpieces You Can Devour In One Sitting",
    curator: "clara_archive",
    itemCount: 24,
    likes: 910,
    covers: [
      "https://covers.openlibrary.org/b/id/10522964-M.jpg",
      "https://covers.openlibrary.org/b/id/8235113-M.jpg",
      "https://covers.openlibrary.org/b/id/8231856-M.jpg",
      "https://covers.openlibrary.org/b/id/12847926-M.jpg",
      "https://covers.openlibrary.org/b/id/12836262-M.jpg",
    ],
  },
];

const RECENT_DIARY = [
  {
    date: "16 Oct",
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    year: 2022,
    rating: "★★★★½",
    hasReview: true,
    liked: true,
    reread: false,
    coverURL: "https://covers.openlibrary.org/b/id/12847926-M.jpg",
  },
  {
    date: "14 Oct",
    title: "The Secret History",
    year: 1992,
    rating: "★★★★★",
    hasReview: true,
    liked: true,
    reread: true,
    coverURL: "https://covers.openlibrary.org/b/id/8231856-M.jpg",
  },
  {
    date: "11 Oct",
    title: "Klara and the Sun",
    year: 2021,
    rating: "★★★★",
    hasReview: true,
    liked: false,
    reread: false,
    coverURL: "https://covers.openlibrary.org/b/id/10522964-M.jpg",
  },
  {
    date: "08 Oct",
    title: "Pachinko",
    year: 2017,
    rating: "★★★★½",
    hasReview: true,
    liked: true,
    reread: false,
    coverURL: "https://covers.openlibrary.org/b/id/8315147-M.jpg",
  },
  {
    date: "03 Oct",
    title: "Dune",
    year: 1965,
    rating: "★★★★",
    hasReview: false,
    liked: true,
    reread: false,
    coverURL: "https://covers.openlibrary.org/b/id/12836262-M.jpg",
  },
];

export default function HomePage() {
  const userQuery = useCurrentUser();
  const profile = userQuery.data;

  // Use profile display_name, username, or default to "Anurag" exactly as in screenshot
  const displayName = profile?.display_name || profile?.username || "Anurag";

  return (
    <div className="min-h-screen bg-[#14181c] text-[#9ab] font-sans antialiased selection:bg-[#00e054] selection:text-[#14181c]">
      {/* Letterboxd Dark Navigation Header */}
      <SiteHeader theme="dark" />

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        {/* Welcome Section - Identical to screenshot */}
        <section className="py-12 sm:py-16 text-center">
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-[#89a]">
            Welcome back,{" "}
            <span className="font-semibold text-white underline decoration-[#456] underline-offset-4">
              {displayName}
            </span>
            . Here’s what we’ve been reading…
          </h1>
          <p className="mt-3 text-xs sm:text-sm text-[#678]">
            This homepage will become customized as you{" "}
            <Link href="/books" className="font-bold text-[#bcd] hover:text-white transition">
              follow active members
            </Link>{" "}
            on Scripd.
          </p>
        </section>

        {/* SECTION 1: NEW ON SCRIPD (Poster Row) */}
        <section aria-labelledby="section-new-on-scripd" className="mt-2">
          {/* Section Subhead Bar */}
          <div className="flex items-center justify-between border-b border-[#2c3440] pb-2 text-[0.7rem] font-bold uppercase tracking-widest text-[#9ab]">
            <h2 id="section-new-on-scripd" className="text-[#9ab]">
              NEW ON SCRIPD
            </h2>
            <Link
              href="/library"
              className="flex items-center gap-1.5 text-[#678] hover:text-[#00e054] transition"
            >
              <span className="text-[#00e054]">⚡</span>
              <span>YOUR ACTIVITY</span>
            </Link>
          </div>

          {/* 6 Poster Cards Row */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6 sm:gap-4">
            {NEW_ON_SCRIPD.map((item) => (
              <article key={item.id} className="group relative flex flex-col">
                {/* Poster Cover */}
                <Link
                  href={`/books?q=${encodeURIComponent(item.title)}`}
                  className="relative aspect-[2/3] w-full overflow-hidden rounded-[4px] border border-[#2c3440] bg-[#1e242c] shadow-[0_2px_8px_rgba(0,0,0,0.6)] transition duration-200 group-hover:border-white group-hover:brightness-105"
                  title={`${item.title} by ${item.author}`}
                >
                  <PosterImage title={item.title} coverURL={item.coverURL} />

                  {/* Overlapping reviewer avatar on bottom-left of the poster */}
                  <div
                    className={`absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#14181c] ${item.reviewer.avatarBg} text-[10px] font-bold text-white shadow-md`}
                    title={`Logged by @${item.reviewer.username}`}
                  >
                    {item.reviewer.avatar}
                  </div>
                </Link>

                {/* Reviewer Name and Rating below poster */}
                <div className="mt-2.5">
                  <Link
                    href={`/books?q=${encodeURIComponent(item.title)}`}
                    className="block truncate text-xs font-semibold text-[#9ab] transition hover:text-white"
                  >
                    {item.reviewer.username}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1 text-xs">
                    <span className="font-bold text-[#00e054] tracking-tighter">
                      {item.reviewer.rating}
                    </span>
                    {item.reviewer.hasReview && (
                      <span className="text-[11px] text-[#678]" title="Contains review">
                        ≡
                      </span>
                    )}
                    {item.reviewer.liked && (
                      <span className="text-[10px] text-[#ff8000]" title="Liked">
                        ♥
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* SECTION 2: POPULAR REVIEWS THIS WEEK */}
        <section aria-labelledby="section-popular-reviews" className="mt-14">
          <div className="flex items-center justify-between border-b border-[#2c3440] pb-2 text-[0.7rem] font-bold uppercase tracking-widest text-[#9ab]">
            <h2 id="section-popular-reviews" className="text-[#9ab]">
              POPULAR REVIEWS THIS WEEK
            </h2>
            <Link
              href="/books"
              className="text-[#678] hover:text-[#00e054] transition text-xs font-semibold tracking-normal"
            >
              MORE &rarr;
            </Link>
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-3">
            {POPULAR_REVIEWS.map((rev) => (
              <article
                key={rev.id}
                className="flex flex-col justify-between rounded border border-[#232b34] bg-[#181e24] p-4 transition hover:border-[#354352]"
              >
                <div>
                  {/* Top: Poster + Title Info */}
                  <div className="flex gap-3.5">
                    <Link
                      href={`/books?q=${encodeURIComponent(rev.bookTitle)}`}
                      className="relative h-28 w-20 shrink-0 overflow-hidden rounded-[3px] border border-[#2c3440] bg-[#1a2027] shadow transition hover:border-white"
                    >
                      <PosterImage title={rev.bookTitle} coverURL={rev.coverURL} />
                    </Link>

                    <div className="flex flex-col justify-between">
                      <div>
                        <Link
                          href={`/books?q=${encodeURIComponent(rev.bookTitle)}`}
                          className="font-bold text-sm text-white hover:text-[#40bcf4] transition leading-snug line-clamp-2"
                        >
                          {rev.bookTitle}
                        </Link>
                        <p className="text-xs text-[#678]">
                          {rev.author} <span className="text-[#456]">· {rev.year}</span>
                        </p>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${rev.reviewer.avatarBg}`}
                        >
                          {rev.reviewer.avatar}
                        </div>
                        <span className="text-xs text-[#9ab] font-medium truncate">
                          @{rev.reviewer.username}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 text-xs">
                        <span className="font-bold text-[#00e054] tracking-tighter">
                          {rev.rating}
                        </span>
                        {rev.liked && <span className="text-[#ff8000] text-xs">♥</span>}
                        <span className="text-[10px] text-[#678] rounded bg-[#202730] px-1.5 py-0.2">
                          {rev.rereadCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Review Excerpt */}
                  <p className="mt-4 text-xs leading-relaxed text-[#cde] line-clamp-4">
                    &ldquo;{rev.excerpt}&rdquo;
                  </p>
                </div>

                {/* Bottom Bar: Likes and Date */}
                <div className="mt-4 flex items-center justify-between border-t border-[#232b34] pt-3 text-[11px] text-[#678]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 hover:text-[#ff8000] transition">
                      <span className="text-[#ff8000]">♥</span> {rev.likes}
                    </span>
                    <span className="flex items-center gap-1 hover:text-white transition">
                      <span>💬</span> {rev.comments}
                    </span>
                  </div>
                  <span>{rev.date}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* SECTION 3: POPULAR LISTS THIS WEEK (Letterboxd Style) */}
        <section aria-labelledby="section-popular-lists" className="mt-14">
          <div className="flex items-center justify-between border-b border-[#2c3440] pb-2 text-[0.7rem] font-bold uppercase tracking-widest text-[#9ab]">
            <h2 id="section-popular-lists" className="text-[#9ab]">
              POPULAR LISTS THIS WEEK
            </h2>
            <Link
              href="/library"
              className="text-[#678] hover:text-[#00e054] transition text-xs font-semibold tracking-normal"
            >
              MORE &rarr;
            </Link>
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-3">
            {POPULAR_LISTS.map((list, index) => (
              <article
                key={index}
                className="group rounded border border-[#232b34] bg-[#181e24] p-4 transition hover:border-[#354352]"
              >
                {/* 5 Overlapping Mini Covers (Letterboxd iconic list deck) */}
                <Link
                  href="/books"
                  className="relative flex h-28 items-center justify-center overflow-hidden rounded bg-[#101418] px-3"
                >
                  <div className="relative flex -space-x-8 items-center">
                    {list.covers.map((url, i) => (
                      <div
                        key={i}
                        className="relative h-24 w-16 overflow-hidden rounded-[2px] border border-[#2c3440] shadow-md transition duration-200 group-hover:scale-105"
                        style={{ zIndex: i + 1 }}
                      >
                        <Image
                          src={url}
                          alt="Book cover"
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                </Link>

                {/* List Details */}
                <div className="mt-3.5">
                  <Link
                    href="/books"
                    className="font-bold text-sm text-white group-hover:text-[#40bcf4] transition line-clamp-2"
                  >
                    {list.title}
                  </Link>

                  <div className="mt-2 flex items-center justify-between text-xs text-[#678]">
                    <span>
                      by <strong className="text-[#9ab]">@{list.curator}</strong>
                    </span>
                    <span>{list.itemCount} books</span>
                  </div>

                  <div className="mt-1 flex items-center gap-1 text-[11px] text-[#ff8000]">
                    <span>♥</span>
                    <span className="text-[#678]">{list.likes} likes</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* SECTION 4: RECENT DIARY ENTRIES (Compact Table) */}
        <section aria-labelledby="section-recent-diary" className="mt-14">
          <div className="flex items-center justify-between border-b border-[#2c3440] pb-2 text-[0.7rem] font-bold uppercase tracking-widest text-[#9ab]">
            <h2 id="section-recent-diary" className="text-[#9ab]">
              JUST LOGGED BY READERS
            </h2>
            <Link
              href="/library"
              className="text-[#678] hover:text-[#00e054] transition text-xs font-semibold tracking-normal"
            >
              VIEW FULL DIARY &rarr;
            </Link>
          </div>

          <div className="mt-4 overflow-hidden rounded border border-[#232b34] bg-[#181e24]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#232b34] bg-[#14181c] text-[10px] font-bold uppercase tracking-wider text-[#678]">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-2">Book</th>
                  <th className="py-2.5 px-4 hidden sm:table-cell">Released</th>
                  <th className="py-2.5 px-4">Rating</th>
                  <th className="py-2.5 px-4 text-right">Reread</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232b34]">
                {RECENT_DIARY.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-[#1d252d] transition">
                    <td className="py-2.5 px-4 font-mono text-[#678]">{entry.date}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-7 shrink-0 overflow-hidden rounded-[2px] border border-[#2c3440]">
                          <Image
                            src={entry.coverURL}
                            alt={entry.title}
                            fill
                            sizes="40px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <Link
                          href={`/books?q=${encodeURIComponent(entry.title)}`}
                          className="font-bold text-white hover:text-[#40bcf4] transition"
                        >
                          {entry.title}
                        </Link>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-[#678] hidden sm:table-cell">{entry.year}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#00e054] tracking-tighter">
                          {entry.rating}
                        </span>
                        {entry.liked && <span className="text-[#ff8000] text-xs">♥</span>}
                        {entry.hasReview && <span className="text-[#678] text-xs">≡</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {entry.reread ? (
                        <span className="rounded bg-[#202830] px-1.5 py-0.5 text-[10px] font-bold text-[#ff8000]">
                          ↺ Reread
                        </span>
                      ) : (
                        <span className="text-[#456] text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 5: SIGN UP / FEATURE STRIP (for guest or promotion) */}
        <section className="mt-16 rounded-lg border border-[#2c3440] bg-[#1b2228] p-8 text-center sm:p-12">
          <div className="mx-auto max-w-xl">
            <div className="flex justify-center -space-x-2 items-center mb-4">
              <span className="h-6 w-6 rounded-full bg-[#ff8000] ring-2 ring-[#1b2228]" />
              <span className="h-6 w-6 rounded-full bg-[#00e054] ring-2 ring-[#1b2228]" />
              <span className="h-6 w-6 rounded-full bg-[#40bcf4] ring-2 ring-[#1b2228]" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Write and share reviews. Compile your own lists. Share your life in books.
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-[#89a]">
              Scripd lets you log what you read, keep track of rereads, rate and review titles, and
              follow people whose literary taste you trust. 100% ad-free and powered by Open
              Library.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="rounded bg-[#00c030] hover:bg-[#00e054] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition shadow"
              >
                Get started — it’s free!
              </Link>
              <Link
                href="/books"
                className="rounded border border-[#3b4754] bg-[#232b34] hover:bg-[#2b3540] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition"
              >
                Explore 30M+ books
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Letterboxd Signature Dark Footer */}
      <footer className="border-t border-[#232b34] bg-[#101418] py-12 text-xs text-[#678]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Top Link Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1c2229] pb-6 text-[11px] font-bold uppercase tracking-wider">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <Link href="/books" className="hover:text-white transition">
                About
              </Link>
              <Link href="/books" className="hover:text-white transition">
                News
              </Link>
              <Link href="/library" className="hover:text-white transition">
                Pro
              </Link>
              <Link href="/books" className="hover:text-white transition">
                Apps
              </Link>
              <Link href="/library" className="hover:text-white transition">
                Year in Review
              </Link>
              <Link href="/books" className="hover:text-white transition">
                Help
              </Link>
              <Link href="/books" className="hover:text-white transition">
                Terms
              </Link>
              <Link href="/books" className="hover:text-white transition">
                API
              </Link>
              <Link href="/books" className="hover:text-white transition">
                Contact
              </Link>
            </div>

            <div className="flex items-center gap-3 text-sm text-[#89a]">
              <span className="hover:text-white cursor-pointer" title="Twitter / X">
                𝕏
              </span>
              <span className="hover:text-white cursor-pointer" title="Instagram">
                📷
              </span>
              <span className="hover:text-white cursor-pointer" title="Mastodon">
                🐘
              </span>
            </div>
          </div>

          {/* Bottom Attribution */}
          <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row text-[11px]">
            <p>&copy; {new Date().getFullYear()} Scripd Limited. Made by book lovers worldwide.</p>
            <p>
              Book data from{" "}
              <a
                href="https://openlibrary.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white transition"
              >
                Open Library
              </a>
              .
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Helper image component with graceful fallback
function PosterImage({ title, coverURL }: { title: string; coverURL: string }) {
  const [error, setError] = useState(false);

  if (error || !coverURL) {
    return (
      <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-[#232b35] to-[#12161b] p-3 text-[#9ab]">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00e054]">
          Scripd
        </span>
        <span className="font-serif text-3xl font-bold text-white opacity-80">
          {title.slice(0, 1)}
        </span>
        <span className="text-[10px] font-semibold line-clamp-2 leading-tight text-white">
          {title}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={coverURL}
      alt={title}
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 180px"
      className="object-cover"
      onError={() => setError(true)}
      unoptimized
    />
  );
}
