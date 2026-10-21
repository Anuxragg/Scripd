"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCurrentUser } from "@/features/auth/hooks";
import {
  useProfile,
  useProfileStats,
  useFollowStatus,
  useFollowUser,
  useUnfollowUser,
} from "@/features/profile/hooks";
import { useReadEntries } from "@/features/reads/hooks";
import type { ReadEntry } from "@/features/reads/api";

type TabKey = "profile" | "activity" | "books" | "diary" | "reviews" | "want_to_read";

export function ProfilePage({ username }: { username: string }) {
  const userQuery = useCurrentUser();
  const profileQuery = useProfile(username);
  const statsQuery = useProfileStats(username);
  const followStatusQuery = useFollowStatus(username);
  const followMutation = useFollowUser(username);
  const unfollowMutation = useUnfollowUser(username);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [userLocation] = useState(() => {
    if (typeof window === "undefined") return "Ind";
    try {
      const savedMeta = localStorage.getItem(`scripd_user_meta_${username}`);
      if (savedMeta) {
        const parsed = JSON.parse(savedMeta);
        return parsed.location || "Ind";
      }
    } catch {
      // ignore
    }
    return "Ind";
  });

  const [userWebsite] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const savedMeta = localStorage.getItem(`scripd_user_meta_${username}`);
      if (savedMeta) {
        const parsed = JSON.parse(savedMeta);
        return parsed.website || "";
      }
    } catch {
      // ignore
    }
    return "";
  });

  const currentUserID = userQuery.data?.id;
  const profile = profileQuery.data;
  const isOwner = Boolean(currentUserID && profile && currentUserID === profile.id);

  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  // Load user's reads (for favorite books, recent activity, diary, want to read)
  const readsQuery = useReadEntries({ limit: 24 }, isOwner);
  const allReads: ReadEntry[] = readsQuery.data?.pages.flatMap((page) => page.data) ?? [];

  const readBooks = allReads.filter((r) => r.status === "read");
  const wantToReadBooks = allReads.filter((r) => r.status === "want_to_read");
  const currentYear = new Date().getFullYear();
  const readThisYear = readBooks.filter((r) => {
    if (!r.finished_at) return false;
    return new Date(r.finished_at).getFullYear() === currentYear;
  });

  // Top 4 favorite books (highest rated or first 4 read)
  const favoriteBooks = [...readBooks]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 4);

  // Recent activity (latest 4 entries)
  const recentActivity = allReads.slice(0, 4);

  async function handleCopyLink() {
    try {
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}/u/${encodeURIComponent(username)}`
          : "";
      if (url && navigator?.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setLinkCopied(true);
      setTimeout(() => {
        setLinkCopied(false);
        setIsMenuOpen(false);
      }, 1500);
    } catch {
      // Fallback
    }
  }

  const isFollowPending = followMutation.isPending || unfollowMutation.isPending;
  const isFollowing = followStatusQuery.data?.is_following ?? false;

  async function handleToggleFollow() {
    if (isFollowing) {
      await unfollowMutation.mutateAsync();
    } else {
      await followMutation.mutateAsync();
    }
  }

  if (profileQuery.isPending) {
    return (
      <main className="min-h-screen bg-[#121417] px-4 py-12 text-[#9ab]">
        <div className="mx-auto max-w-4xl animate-pulse space-y-6">
          <div className="h-8 w-32 mx-auto rounded-full bg-[#1e242c]" />
          <div className="h-44 rounded-3xl bg-[#1e242c]" />
          <div className="h-10 w-full rounded-xl bg-[#1e242c]" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-[#1e242c]" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <main className="min-h-screen bg-[#121417] px-4 py-20 text-center">
        <div className="mx-auto max-w-md rounded-3xl border border-[#242c34] bg-[#181c22] p-8 shadow-xl">
          <h1 className="font-serif text-2xl font-bold text-white">Reader Not Found</h1>
          <p className="mt-2 text-sm text-[#89a]">
            We couldn’t find a member with the handle &ldquo;@{username}&rdquo;.
          </p>
          <Link
            href="/books"
            className="mt-6 inline-flex rounded-xl bg-[#ff8000] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e67300] transition"
          >
            Explore books
          </Link>
        </div>
      </main>
    );
  }

  const initial = (profile.display_name || profile.username).charAt(0).toUpperCase();
  const totalBooksCount = statsQuery.data?.books_read ?? readBooks.length;
  const followersCount = followStatusQuery.data?.followers_count ?? 0;
  const followingCount = followStatusQuery.data?.following_count ?? 0;

  return (
    <main className="min-h-screen bg-[#121417] text-[#e0e6ed] pb-24 pt-6">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* User Identity Header Card (Screenshot 1 Layout) */}
        <section className="relative">
          <div className="flex items-start justify-between gap-6">
            {/* Left Column: Name, Handle, Bio, Follow Stats */}
            <div className="flex-1">
              <h1
                style={{
                  fontFamily:
                    'GraphikWeb, -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", Meiryo, sans-serif, ColorEmoji',
                  fontSize: "22px",
                  fontWeight: 700,
                  lineHeight: "24.75px",
                  color: "rgb(255, 255, 255)",
                }}
              >
                {profile.display_name || profile.username}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#89a]">
                <span className="text-[#aab]">@{profile.username}</span>
                <span>·</span>
                <span className="flex items-center gap-1 text-[#89a]">
                  📍 {userLocation || "Ind"}
                </span>
                {userWebsite && (
                  <>
                    <span>·</span>
                    <a
                      href={userWebsite.startsWith("http") ? userWebsite : `https://${userWebsite}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#40bcf4] hover:underline"
                    >
                      {userWebsite.replace(/^https?:\/\//, "")}
                    </a>
                  </>
                )}
              </div>

              {/* Bio */}
              <p className="mt-3 text-sm text-[#ccd5df] leading-relaxed max-w-xl whitespace-pre-line">
                {profile.bio ||
                  "Trying to build something but what to cuz I think those are already made"}
              </p>

              {/* Stats Counters (BOOKS, THIS YEAR, FOLLOWING, FOLLOWERS) */}
              <div className="mt-4 flex flex-wrap items-center gap-6 sm:gap-7">
                <div>
                  <p className="text-xl font-extrabold text-white leading-none">
                    {totalBooksCount}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#89a]">
                    BOOKS
                  </p>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-white leading-none">
                    {readThisYear.length}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#89a]">
                    THIS YEAR
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("activity")}
                    className="text-left group"
                  >
                    <p className="text-xl font-extrabold text-white leading-none group-hover:text-[#00e054] transition">
                      {followingCount}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#89a] group-hover:text-[#ccd5df] transition">
                      FOLLOWING
                    </p>
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("activity")}
                    className="text-left group"
                  >
                    <p className="text-xl font-extrabold text-white leading-none group-hover:text-[#00e054] transition">
                      {followersCount}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#89a] group-hover:text-[#ccd5df] transition">
                      FOLLOWERS
                    </p>
                  </button>
                </div>
              </div>

              {/* Action Buttons Row (Screenshot 1) */}
              <div className="mt-5 flex items-center gap-3">
                {isOwner ? (
                  <Link
                    href="/edit-profile"
                    className="rounded-xl border border-[#2c3440] bg-[#1a1f26] px-5 py-2 text-sm font-semibold text-white hover:bg-[#252c36] hover:border-[#404c5c] transition"
                  >
                    Edit profile
                  </Link>
                ) : currentUserID ? (
                  <button
                    type="button"
                    disabled={isFollowPending}
                    onClick={handleToggleFollow}
                    className={`rounded-xl px-6 py-2 text-sm font-bold transition shadow-sm ${
                      isFollowing
                        ? "border border-[#2c3440] bg-[#1a1f26] text-white hover:border-red-400 hover:text-red-400"
                        : "bg-[#00e054] text-black hover:bg-[#00c549]"
                    }`}
                  >
                    {isFollowPending ? "Saving..." : isFollowing ? "Following" : "Follow"}
                  </button>
                ) : (
                  <Link
                    href={`/login?redirect=/u/${encodeURIComponent(username)}`}
                    className="rounded-xl bg-[#00e054] px-6 py-2 text-sm font-bold text-black hover:bg-[#00c549] transition shadow-sm"
                  >
                    Follow
                  </Link>
                )}

                {/* 3-Dots Button with Dropdown Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#2c3440] bg-[#1a1f26] text-[#89a] hover:bg-[#252c36] hover:text-white transition text-base font-bold tracking-widest cursor-pointer"
                    title="More options"
                    aria-label="More options"
                    aria-expanded={isMenuOpen}
                  >
                    ···
                  </button>

                  {isMenuOpen && (
                    <>
                      {/* Backdrop to close when clicking outside */}
                      <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)} />

                      {/* Dropdown Menu matching user screenshot */}
                      <div className="absolute left-0 mt-2 w-52 rounded-2xl border border-[#384556] bg-[#232c37] p-1.5 shadow-2xl z-40 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#c0ccd9] hover:bg-[#2f3b4a] hover:text-white transition cursor-pointer"
                        >
                          <svg
                            className="h-4 w-4 shrink-0 text-[#8ea0b4]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                          <span>{linkCopied ? "Link copied!" : "Copy profile link"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            setIsQRModalOpen(true);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#c0ccd9] hover:bg-[#2f3b4a] hover:text-white transition cursor-pointer"
                        >
                          <svg
                            className="h-4 w-4 shrink-0 text-[#8ea0b4]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="3" y="3" width="7" height="7" rx="1.5" />
                            <rect x="14" y="3" width="7" height="7" rx="1.5" />
                            <rect x="3" y="14" width="7" height="7" rx="1.5" />
                            <circle cx="16" cy="16" r="1.2" fill="currentColor" />
                            <circle cx="20" cy="16" r="1.2" fill="currentColor" />
                            <circle cx="16" cy="20" r="1.2" fill="currentColor" />
                            <circle cx="20" cy="20" r="1.2" fill="currentColor" />
                          </svg>
                          <span>Show QR code</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Large Round Avatar (Screenshot 1) */}
            <div className="flex-shrink-0">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  width={110}
                  height={110}
                  unoptimized
                  className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-2 border-[#242c34] object-cover shadow-2xl ring-2 ring-black/50"
                />
              ) : (
                <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full bg-[#1e242c] border-2 border-[#2c3440] font-serif text-4xl font-bold text-[#ff8000] shadow-xl">
                  {initial}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Sleek Navigation Tabs (Screenshots 1 & 2) */}
        <nav className="mt-4 flex items-center gap-2 sm:gap-6 border-b border-[#242c34] overflow-x-auto no-scrollbar text-sm font-semibold text-[#89a]">
          {(
            [
              { key: "profile", label: "Profile" },
              { key: "activity", label: "Activity" },
              { key: "books", label: "Books" },
              { key: "diary", label: "Diary" },
              { key: "reviews", label: "Reviews" },
              { key: "want_to_read", label: "Want to Read" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 transition relative whitespace-nowrap ${
                activeTab === tab.key ? "text-white font-bold" : "hover:text-[#ccd5df]"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00e054]" />
              )}
            </button>
          ))}
        </nav>

        {/* TAB CONTENTS */}
        <div className="mt-8 space-y-12">
          {/* TAB: PROFILE (Main Letterboxd Overview) */}
          {activeTab === "profile" && (
            <div className="space-y-10">
              {/* FAVORITE BOOKS (Screenshot 2) */}
              <section>
                <div className="flex items-center justify-between border-b border-[#242c34] pb-2 mb-4">
                  <h2 className="text-xs font-bold tracking-widest uppercase text-[#89a]">
                    FAVORITE BOOKS
                  </h2>
                  {isOwner && (
                    <Link
                      href="/books"
                      className="text-xs text-[#00e054] hover:underline font-medium"
                    >
                      Browse catalog
                    </Link>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  {favoriteBooks.length > 0
                    ? favoriteBooks.map((read) => (
                        <Link
                          key={read.id}
                          href={`/books/${read.book.id}`}
                          className="group relative block aspect-[2/3] overflow-hidden rounded-xl border border-[#2c3440] bg-[#1a1f26] shadow-md transition hover:-translate-y-1 hover:border-[#00e054] hover:shadow-xl"
                        >
                          {read.book.cover_url ? (
                            <Image
                              src={read.book.cover_url}
                              alt={read.book.title}
                              fill
                              sizes="(max-width: 640px) 50vw, 25vw"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full flex-col justify-end p-3 bg-gradient-to-t from-black via-black/40 to-transparent">
                              <span className="font-serif text-sm font-bold text-white line-clamp-2">
                                {read.book.title}
                              </span>
                              <span className="text-[11px] text-[#89a] line-clamp-1">
                                {read.book.authors.join(", ")}
                              </span>
                            </div>
                          )}
                          {read.rating && (
                            <div className="absolute top-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 text-xs font-bold text-[#00e054] backdrop-blur-sm">
                              ★ {read.rating}
                            </div>
                          )}
                        </Link>
                      ))
                    : // Empty placeholder slots (4 slots)
                      [1, 2, 3, 4].map((slot) => (
                        <Link
                          key={slot}
                          href="/books"
                          className="flex aspect-[2/3] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#242c34] bg-[#14181c]/60 p-4 text-center transition hover:border-[#00e054] hover:bg-[#181c22]"
                        >
                          <span className="text-2xl text-[#455]">+</span>
                          <span className="mt-2 text-xs font-medium text-[#789]">Add favorite</span>
                        </Link>
                      ))}
                </div>
              </section>

              {/* RECENT ACTIVITY & SIDEBAR (Screenshot 2 Dual Structure) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left 2 Cols: RECENT ACTIVITY */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#242c34] pb-2">
                    <h2 className="text-xs font-bold tracking-widest uppercase text-[#89a]">
                      RECENT ACTIVITY
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab("activity")}
                      className="text-xs font-bold uppercase tracking-wider text-[#89a] hover:text-white"
                    >
                      ALL →
                    </button>
                  </div>

                  {recentActivity.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {recentActivity.map((read) => (
                        <Link
                          key={read.id}
                          href={`/books/${read.book.id}`}
                          className="group relative aspect-[2/3] overflow-hidden rounded-xl border border-[#2c3440] bg-[#1a1f26] transition hover:-translate-y-1 hover:border-[#40bcf4]"
                        >
                          {read.book.cover_url ? (
                            <Image
                              src={read.book.cover_url}
                              alt={read.book.title}
                              fill
                              sizes="(max-width: 640px) 50vw, 25vw"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full flex-col justify-end p-2 bg-black/60">
                              <span className="text-xs font-bold text-white line-clamp-2">
                                {read.book.title}
                              </span>
                            </div>
                          )}
                          {read.rating && (
                            <div className="absolute bottom-1.5 left-1.5 text-[11px] font-bold text-[#00e054]">
                              {"★".repeat(Math.round(read.rating))}
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#242c34] bg-[#161a20] p-6 text-center">
                      <p className="text-sm text-[#89a]">No recent reading logs found.</p>
                      <Link
                        href="/books"
                        className="mt-3 inline-block text-xs font-bold text-[#00e054] hover:underline"
                      >
                        Find books to log →
                      </Link>
                    </div>
                  )}
                </div>

                {/* Right 1 Col: WANT TO READ & DIARY SIDEBAR (Screenshot 2) */}
                <div className="space-y-6">
                  {/* Want to Read Box */}
                  <div className="rounded-2xl border border-[#242c34] bg-[#161a20] p-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#242c34]">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#89a]">
                        WANT TO READ
                      </span>
                      <span className="text-xs font-bold text-[#00e054]">
                        {wantToReadBooks.length}
                      </span>
                    </div>
                    {wantToReadBooks.length > 0 ? (
                      <div className="mt-3 flex -space-x-3 overflow-hidden py-1">
                        {wantToReadBooks.slice(0, 5).map((read) => (
                          <div
                            key={read.id}
                            className="relative h-16 w-11 flex-shrink-0 overflow-hidden rounded-md border border-[#2c3440] bg-[#1a1f26] shadow"
                          >
                            {read.book.cover_url && (
                              <Image
                                src={read.book.cover_url}
                                alt={read.book.title}
                                fill
                                className="object-cover"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-[#789]">Your queue is currently empty.</p>
                    )}
                  </div>

                  {/* Diary Box */}
                  <div className="rounded-2xl border border-[#242c34] bg-[#161a20] p-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#242c34]">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#89a]">
                        DIARY
                      </span>
                      <span className="text-xs font-bold text-[#00e054]">{readBooks.length}</span>
                    </div>
                    {readBooks.length > 0 ? (
                      <div className="mt-3 space-y-2 text-xs">
                        {readBooks.slice(0, 3).map((read) => (
                          <div
                            key={read.id}
                            className="flex items-center justify-between text-[#ccd5df]"
                          >
                            <span className="font-medium truncate max-w-[140px]">
                              {read.book.title}
                            </span>
                            <span className="text-[#00e054]">
                              {read.rating ? `★ ${read.rating}` : "read"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-[#789]">No diary entries recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ACTIVITY (Screenshot 1 Interactive & Feed Stream) */}
          {activeTab === "activity" && (
            <div className="space-y-6">
              {/* Interactive prompt box from Screenshot 1 */}
              {isOwner && (
                <Link
                  href="/books"
                  className="flex items-center gap-3 rounded-2xl border border-[#242c34] bg-[#161a20] p-4 text-[#89a] hover:border-[#404c5c] hover:bg-[#1a1f26] transition shadow-sm"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e242c] border border-[#2c3440] text-sm font-bold text-white">
                    {initial}
                  </div>
                  <span className="text-sm">What are you reading right now? Log a book...</span>
                </Link>
              )}

              {/* Feed/Activity List */}
              {allReads.length > 0 ? (
                <div className="space-y-4">
                  {allReads.map((read) => (
                    <article
                      key={read.id}
                      className="flex gap-4 rounded-2xl border border-[#242c34] bg-[#161a20] p-4 sm:p-5"
                    >
                      <div className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-[#2c3440] bg-[#1a1f26]">
                        {read.book.cover_url && (
                          <Image
                            src={read.book.cover_url}
                            alt={read.book.title}
                            fill
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-white hover:text-[#00e054] transition">
                            <Link href={`/books/${read.book.id}`}>{read.book.title}</Link>
                          </h3>
                          <span className="text-xs text-[#89a]">
                            {new Date(read.updated_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-[#89a] mt-0.5">{read.book.authors.join(", ")}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <span className="rounded-full bg-[#1e242c] px-2.5 py-0.5 font-semibold text-[#40bcf4]">
                            {read.status.replace(/_/g, " ")}
                          </span>
                          {read.rating && (
                            <span className="font-bold text-[#00e054]">★ {read.rating}</span>
                          )}
                        </div>
                        {read.notes && (
                          <p className="mt-2 text-xs text-[#c5d0db] italic">
                            &ldquo;{read.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                /* Empty state from Screenshot 1 */
                <div className="rounded-2xl border border-[#242c34] bg-[#161a20] p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1e242c] text-xl text-[#89a]">
                    ✎
                  </div>
                  <h3 className="mt-4 text-base font-bold text-white">
                    You haven’t published anything yet.
                  </h3>
                  <p className="mt-1 text-xs text-[#89a]">
                    Get started by logging your first read.
                  </p>
                  <Link
                    href="/books"
                    className="mt-5 inline-flex rounded-xl bg-[#ff8000] px-5 py-2 text-xs font-bold text-white hover:bg-[#e67300] transition"
                  >
                    Log a book
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* TAB: BOOKS */}
          {activeTab === "books" && (
            <div className="space-y-4">
              <div className="border-b border-[#242c34] pb-2">
                <h2 className="text-xs font-bold tracking-widest uppercase text-[#89a]">
                  READ BOOKS ({readBooks.length})
                </h2>
              </div>
              {readBooks.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {readBooks.map((read) => (
                    <Link
                      key={read.id}
                      href={`/books/${read.book.id}`}
                      className="group relative aspect-[2/3] overflow-hidden rounded-xl border border-[#2c3440] bg-[#1a1f26] transition hover:-translate-y-1 hover:border-[#00e054]"
                    >
                      {read.book.cover_url && (
                        <Image
                          src={read.book.cover_url}
                          alt={read.book.title}
                          fill
                          className="object-cover"
                        />
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#89a]">No books recorded as read yet.</p>
              )}
            </div>
          )}

          {/* TAB: DIARY */}
          {activeTab === "diary" && (
            <div className="space-y-4">
              <div className="border-b border-[#242c34] pb-2">
                <h2 className="text-xs font-bold tracking-widest uppercase text-[#89a]">
                  READING DIARY
                </h2>
              </div>
              {readBooks.length > 0 ? (
                <div className="divide-y divide-[#242c34] rounded-2xl border border-[#242c34] bg-[#161a20]">
                  {readBooks.map((read) => (
                    <div key={read.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-8 rounded overflow-hidden bg-[#1e242c]">
                          {read.book.cover_url && (
                            <Image
                              src={read.book.cover_url}
                              alt={read.book.title}
                              fill
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div>
                          <Link
                            href={`/books/${read.book.id}`}
                            className="font-bold text-white hover:text-[#00e054] text-sm"
                          >
                            {read.book.title}
                          </Link>
                          <p className="text-xs text-[#89a]">{read.book.authors.join(", ")}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-[#00e054]">
                          {read.rating ? `★ ${read.rating}` : "read"}
                        </span>
                        <p className="text-[10px] text-[#89a]">
                          {read.finished_at
                            ? new Date(read.finished_at).toLocaleDateString()
                            : "Finished"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#89a]">No diary entries found.</p>
              )}
            </div>
          )}

          {/* TAB: REVIEWS */}
          {activeTab === "reviews" && (
            <div className="space-y-4">
              <div className="border-b border-[#242c34] pb-2">
                <h2 className="text-xs font-bold tracking-widest uppercase text-[#89a]">
                  REVIEWS ({statsQuery.data?.reviews_count ?? 0})
                </h2>
              </div>
              <p className="text-sm text-[#89a]">User reviews appear here.</p>
            </div>
          )}

          {/* TAB: WANT TO READ */}
          {activeTab === "want_to_read" && (
            <div className="space-y-4">
              <div className="border-b border-[#242c34] pb-2">
                <h2 className="text-xs font-bold tracking-widest uppercase text-[#89a]">
                  WANT TO READ QUEUE ({wantToReadBooks.length})
                </h2>
              </div>
              {wantToReadBooks.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {wantToReadBooks.map((read) => (
                    <Link
                      key={read.id}
                      href={`/books/${read.book.id}`}
                      className="group relative aspect-[2/3] overflow-hidden rounded-xl border border-[#2c3440] bg-[#1a1f26] transition hover:-translate-y-1 hover:border-[#40bcf4]"
                    >
                      {read.book.cover_url && (
                        <Image
                          src={read.book.cover_url}
                          alt={read.book.title}
                          fill
                          className="object-cover"
                        />
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#89a]">No books on your Want to Read shelf yet.</p>
              )}
            </div>
          )}
        </div>

        {/* QR Code Modal */}
        {isQRModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setIsQRModalOpen(false)}
          >
            <div
              className="relative w-full max-w-sm rounded-3xl border border-[#2c3746] bg-[#181d24] p-6 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsQRModalOpen(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#232c37] text-[#8fa0b5] hover:bg-[#2e3a48] hover:text-white transition text-sm cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#232c37] text-xl font-bold text-[#00e054] border border-[#364353]">
                {initial}
              </div>
              <h3 className="mt-3 text-lg font-bold text-white">
                {profile.display_name || profile.username}
              </h3>
              <p className="text-xs text-[#8fa0b5]">@{profile.username}</p>

              {/* QR Code Container */}
              <div className="mx-auto mt-5 flex w-fit items-center justify-center rounded-2xl bg-white p-4 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(
                    typeof window !== "undefined"
                      ? `${window.location.origin}/u/${username}`
                      : `https://scripd.com/u/${username}`,
                  )}`}
                  alt={`QR Code for @${profile.username}`}
                  width={180}
                  height={180}
                  className="rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
