"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api/client";
import { useCurrentUser } from "@/features/auth/hooks";
import { BookCover } from "@/features/books/BookCover";
import { useBookSearch } from "@/features/books/hooks";
import type { Book } from "@/features/books/api";
import {
  useAddFavoriteBook,
  useRemoveFavoriteBook,
  useProfile,
  useProfileStats,
  useFollowStatus,
  useFollowUser,
  useUnfollowUser,
} from "@/features/profile/hooks";
import { useReadEntries } from "@/features/reads/hooks";
import type { ReadEntry } from "@/features/reads/api";
import { notifyStorageChange, subscribeStorage } from "@/lib/useClientStorage";
import { useMyLists, useUserLists } from "@/features/lists/hooks";
import { ListCard } from "@/features/lists/ListCard";
import { CreateListModal } from "@/features/lists/CreateListModal";
import { useDeleteReview, useUserReviews } from "@/features/reviews/hooks";
import type { Review } from "@/features/reviews/api";
import { findKnownBook } from "@/features/books/catalog";

type TabKey = "profile" | "activity" | "books" | "diary" | "reviews" | "want_to_read" | "lists";

function renderLetterboxdStars(rating?: number | null): string {
  if (!rating || rating <= 0) return "";
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5 ? "½" : "";
  return "★".repeat(fullStars) + halfStar;
}

function formatLetterboxdDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleDateString("en-GB", { month: "short" });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateString;
  }
}

export function ProfilePage({ username }: { username: string }) {
  const userQuery = useCurrentUser();
  const profileQuery = useProfile(username);
  const statsQuery = useProfileStats(username);
  const followStatusQuery = useFollowStatus(username);
  const followMutation = useFollowUser(username);
  const unfollowMutation = useUnfollowUser(username);
  const addFavoriteBookMutation = useAddFavoriteBook(username);
  const removeFavoriteBookMutation = useRemoveFavoriteBook(username);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isFavoriteBookModalOpen, setIsFavoriteBookModalOpen] = useState(false);
  const [favoriteBookName, setFavoriteBookName] = useState("");
  const [favoriteBookError, setFavoriteBookError] = useState("");
  const [favoriteBookActionError, setFavoriteBookActionError] = useState("");
  const [debouncedFavoriteBookName, setDebouncedFavoriteBookName] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [filterRating, setFilterRating] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [reviewsSortBy, setReviewsSortBy] = useState<"recent" | "rating" | "popular">("recent");
  const favoriteBookSearch = useBookSearch(
    debouncedFavoriteBookName,
    1,
    isFavoriteBookModalOpen && debouncedFavoriteBookName.length > 0,
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedFavoriteBookName(favoriteBookName.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [favoriteBookName]);

  useEffect(() => {
    if (!isFavoriteBookModalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFavoriteBookModalOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isFavoriteBookModalOpen]);

  const normalizedUsername = username.toLowerCase();

  const userLocation = useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        const savedMeta = localStorage.getItem(`scripd_user_meta_${username}`);
        if (savedMeta) {
          return (JSON.parse(savedMeta) as { location?: string }).location || "";
        }
      } catch {
        // ignore
      }
      return "";
    },
    () => "",
  );

  const userWebsite = useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        const savedMeta = localStorage.getItem(`scripd_user_meta_${username}`);
        if (savedMeta) {
          return (JSON.parse(savedMeta) as { website?: string }).website || "";
        }
      } catch {
        // ignore
      }
      return "";
    },
    () => "",
  );

  const currentUserID = userQuery.data?.id;
  const profile = profileQuery.data;
  const isOwner = Boolean(currentUserID && profile && currentUserID === profile.id);

  const myListsQuery = useMyLists(isOwner);
  const userListsQuery = useUserLists(username, !isOwner);
  const displayLists = isOwner ? (myListsQuery.data ?? []) : (userListsQuery.data ?? []);
  const listsLoading = isOwner ? myListsQuery.isLoading : userListsQuery.isLoading;

  const userReviewsQuery = useUserReviews(username);
  const deleteReviewMutation = useDeleteReview();
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});

  // Client-side local reviews fallback (from localStorage)
  const localUserReviews = useSyncExternalStore(
    subscribeStorage,
    () => {
      if (typeof window === "undefined") return "[]";
      try {
        const found: Review[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("scripd_production_reviews_")) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (
                  item.author?.username?.toLowerCase() === normalizedUsername ||
                  (isOwner && item.author?.username === "guest")
                ) {
                  const bookID = key.replace("scripd_production_reviews_", "");
                  const known =
                    findKnownBook(bookID) ||
                    (item.bookTitle ? findKnownBook(item.bookTitle) : null);
                  const cleanBookTitle =
                    item.bookTitle &&
                    item.bookTitle !== "Book" &&
                    item.bookTitle !== "Untitled Book"
                      ? item.bookTitle
                      : known?.title ||
                        bookID
                          .replace(/^(works\/|books\/)/i, "")
                          .replace(/[-_]/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase());
                  const cleanCover =
                    item.bookCover ||
                    known?.coverURL ||
                    (bookID.startsWith("OL")
                      ? `https://covers.openlibrary.org/b/id/${bookID}-L.jpg`
                      : null);
                  const cleanAuthors =
                    item.bookAuthors && item.bookAuthors.length > 0
                      ? item.bookAuthors
                      : known?.authors || [];
                  const cleanYear = item.bookYear
                    ? parseInt(item.bookYear, 10) || undefined
                    : known?.year || undefined;

                  found.push({
                    id: item.id,
                    read_id: item.read_id || item.id,
                    user_id: profile?.id || "",
                    book_id: bookID,
                    body: item.body,
                    contains_spoilers: Boolean(item.containsSpoilers),
                    rating: item.rating ?? null,
                    author: {
                      id: profile?.id || "",
                      username: item.author.username,
                      display_name: item.author.display_name || item.author.username,
                      avatar_url: item.author.avatar_url || null,
                    },
                    book: {
                      id: bookID,
                      title: cleanBookTitle,
                      authors: cleanAuthors,
                      cover_url: cleanCover,
                      published_year: cleanYear,
                    },
                    created_at: item.createdAt || new Date().toISOString(),
                    updated_at: item.createdAt || new Date().toISOString(),
                  });
                }
              }
            }
          }
        }
        return JSON.stringify(found);
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );

  let parsedLocalReviews: Review[] = [];
  try {
    parsedLocalReviews = JSON.parse(localUserReviews);
  } catch {
    parsedLocalReviews = [];
  }

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

  const favoriteBooks = profile?.favorite_books ?? [];

  // Recent activity (latest 4 entries)
  const recentActivity = allReads.slice(0, 4);

  // Combined Reviews: API reviews + local storage reviews + diary notes (fallback)
  const apiReviewItems = userReviewsQuery.data?.pages.flatMap((p) => p.data) ?? [];
  const reviewMap = new Map<string, Review>();

  for (const r of apiReviewItems) {
    reviewMap.set(r.id, r);
  }
  for (const r of parsedLocalReviews) {
    if (!reviewMap.has(r.id)) {
      reviewMap.set(r.id, r);
    }
  }

  // Also include reading diary entries with notes if they do not already have a review
  for (const r of readBooks) {
    if (r.notes && r.notes.trim()) {
      const hasExisting = Array.from(reviewMap.values()).some((item) => item.book_id === r.book.id);
      if (!hasExisting) {
        reviewMap.set(`read-note-${r.id}`, {
          id: `read-note-${r.id}`,
          read_id: r.id,
          user_id: profile?.id || "",
          book_id: r.book.id,
          body: r.notes.trim(),
          contains_spoilers: false,
          rating: r.rating ?? null,
          author: {
            id: profile?.id || "",
            username: username,
            display_name: profile?.display_name || username,
            avatar_url: profile?.avatar_url || null,
          },
          book: {
            id: r.book.id,
            title: r.book.title,
            authors: r.book.authors,
            cover_url: r.book.cover_url || null,
          },
          created_at: r.updated_at || r.created_at,
          updated_at: r.updated_at || r.created_at,
        });
      }
    }
  }

  const displayReviews = Array.from(reviewMap.values())
    .map((r) => {
      const bID = r.book_id || r.book?.id || "";
      const known = findKnownBook(bID) || (r.book?.title ? findKnownBook(r.book.title) : null);
      const matchedRead = allReads.find(
        (entry) =>
          entry.book.id === bID ||
          (r.book?.title && entry.book.title.toLowerCase() === r.book.title.toLowerCase()),
      );
      const resolvedTitle =
        r.book?.title && r.book.title !== "Book" && r.book.title !== "Untitled Book"
          ? r.book.title
          : known?.title ||
            matchedRead?.book.title ||
            bID
              .replace(/^(works\/|books\/)/i, "")
              .replace(/[-_]/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());
      const resolvedCover =
        r.book?.cover_url ||
        known?.coverURL ||
        matchedRead?.book.cover_url ||
        (bID.startsWith("OL") ? `https://covers.openlibrary.org/b/id/${bID}-L.jpg` : null);
      const resolvedAuthors =
        r.book?.authors && r.book.authors.length > 0
          ? r.book.authors
          : known?.authors || matchedRead?.book.authors || [];
      const resolvedYear =
        r.book?.published_year || known?.year || matchedRead?.book.published_year || undefined;

      return {
        ...r,
        book: {
          id: bID,
          title: resolvedTitle,
          cover_url: resolvedCover,
          authors: resolvedAuthors,
          published_year: resolvedYear,
        },
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  async function handleDeleteReview(reviewID: string) {
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    try {
      if (!reviewID.startsWith("read-note-") && !reviewID.startsWith("review-")) {
        await deleteReviewMutation.mutateAsync(reviewID);
      }
      // Clean up from localStorage if exists
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("scripd_production_reviews_")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const nextList = list.filter((item: { id?: string }) => item.id !== reviewID);
                if (nextList.length !== list.length) {
                  localStorage.setItem(key, JSON.stringify(nextList));
                }
              }
            } catch {
              // ignore
            }
          }
        }
      }
      notifyStorageChange();
    } catch {
      // ignore
    }
  }

  const availableYears = Array.from(
    new Set(
      displayReviews
        .map((r) => {
          const d = new Date(r.created_at);
          return isNaN(d.getTime()) ? null : d.getFullYear().toString();
        })
        .filter(Boolean) as string[],
    ),
  )
    .sort()
    .reverse();

  let filteredReviews = displayReviews;
  if (filterRating !== "all") {
    const minRating = parseFloat(filterRating);
    filteredReviews = filteredReviews.filter(
      (r) => typeof r.rating === "number" && r.rating >= minRating,
    );
  }
  if (filterYear !== "all") {
    filteredReviews = filteredReviews.filter((r) => {
      const d = new Date(r.created_at);
      return d.getFullYear().toString() === filterYear;
    });
  }
  const sortedReviews = [...filteredReviews].sort((a, b) => {
    if (reviewsSortBy === "rating") {
      return (b.rating ?? 0) - (a.rating ?? 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const localFollowed = useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        const stored = localStorage.getItem(`scripd_following_${normalizedUsername}`);
        return stored !== null ? stored === "true" : null;
      } catch {
        return null;
      }
    },
    () => null,
  );

  const isFollowing =
    localFollowed !== null ? localFollowed : (followStatusQuery.data?.is_following ?? false);

  const hasLocalFollower = useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        return (
          localStorage.getItem(`scripd_following_${normalizedUsername}`) === "true" ||
          localStorage.getItem(`scripd_has_follower_${normalizedUsername}`) === "true"
        );
      } catch {
        return false;
      }
    },
    () => false,
  );

  const localFollowingCount = useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        const raw = localStorage.getItem(`scripd_user_${normalizedUsername}_following`);
        return raw ? (JSON.parse(raw) as unknown[]).length : 0;
      } catch {
        return 0;
      }
    },
    () => 0,
  );

  const baseFollowers = followStatusQuery.data?.followers_count ?? 0;
  const followersCount = useMemo(() => {
    if (baseFollowers > 0) return baseFollowers;
    if (isFollowing || hasLocalFollower) return 1;
    return 0;
  }, [baseFollowers, isFollowing, hasLocalFollower]);

  const baseFollowing = followStatusQuery.data?.following_count ?? 0;
  const followingCount = Math.max(baseFollowing, localFollowingCount);

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

  async function handleToggleFollow() {
    const nextState = !isFollowing;
    const viewer = userQuery.data?.username;

    try {
      localStorage.setItem(`scripd_following_${normalizedUsername}`, String(nextState));
      if (nextState) {
        localStorage.setItem(`scripd_has_follower_${normalizedUsername}`, "true");
        if (viewer) {
          const listKey = `scripd_user_${viewer.toLowerCase()}_following`;
          const existing: string[] = JSON.parse(localStorage.getItem(listKey) || "[]");
          if (!existing.includes(normalizedUsername)) {
            localStorage.setItem(listKey, JSON.stringify([...existing, normalizedUsername]));
          }
        }
      } else {
        localStorage.removeItem(`scripd_has_follower_${normalizedUsername}`);
        if (viewer) {
          const listKey = `scripd_user_${viewer.toLowerCase()}_following`;
          const existing: string[] = JSON.parse(localStorage.getItem(listKey) || "[]");
          localStorage.setItem(
            listKey,
            JSON.stringify(existing.filter((u) => u !== normalizedUsername)),
          );
        }
      }
      notifyStorageChange();
    } catch {
      // Safe ignore
    }

    try {
      if (isFollowing) {
        await unfollowMutation.mutateAsync();
      } else {
        await followMutation.mutateAsync();
      }
    } catch {
      // Local optimistic state kept
    }
  }

  async function handleSelectFavoriteBook(book: Book) {
    setFavoriteBookError("");
    try {
      await addFavoriteBookMutation.mutateAsync({
        open_library_key: book.open_library_key.startsWith("/works/")
          ? book.open_library_key
          : `/works/${book.open_library_key}`,
        title: book.title,
        authors: book.authors,
        cover_url: book.cover_url,
        published_year: book.published_year,
      });
      setFavoriteBookName("");
      setDebouncedFavoriteBookName("");
      setIsFavoriteBookModalOpen(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === "favorite_limit_reached") {
        setFavoriteBookError("You can add up to four favorite books.");
      } else if (error instanceof ApiError && error.status === 401) {
        setFavoriteBookError("Your sign-in session expired. Sign in again to add favorite books.");
      } else if (error instanceof ApiError && error.status === 404) {
        setFavoriteBookError("The local API needs a restart before favorite books can be saved.");
      } else if (error instanceof ApiError) {
        setFavoriteBookError(error.message);
      } else {
        setFavoriteBookError("Couldn't connect to Scripd to save this book. Please try again.");
      }
    }
  }

  async function handleRemoveFavoriteBook(openLibraryKey: string) {
    setFavoriteBookActionError("");
    try {
      await removeFavoriteBookMutation.mutateAsync(openLibraryKey);
    } catch (error) {
      setFavoriteBookActionError(
        error instanceof ApiError && error.status === 401
          ? "Your sign-in session expired. Sign in again to remove favorite books."
          : error instanceof Error
            ? error.message
            : "Couldn't remove this favorite book. Please try again.",
      );
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

  const avatarUrl =
    profile.avatar_url ||
    (typeof window !== "undefined" && username
      ? localStorage.getItem(`scripd_user_avatar_${username}`)
      : "") ||
    "";

  const initial = (profile.display_name || profile.username).charAt(0).toUpperCase();
  const totalBooksCount = statsQuery.data?.books_read ?? readBooks.length;

  const joinedDate = (() => {
    if (!profile.created_at) return null;
    try {
      const d = new Date(profile.created_at);
      if (isNaN(d.getTime())) return null;
      return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d);
    } catch {
      return null;
    }
  })();

  return (
    <main className="min-h-screen bg-[#121417] text-[#e0e6ed] pb-24 pt-6">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* User Identity Header Card */}
        <section className="relative">
          <div className="flex items-start justify-between gap-6">
            {/* Left Column: Name, Handle, Bio, Metadata, Stats, Action Buttons */}
            <div className="flex-1 min-w-0">
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

              {/* Handle */}
              <p className="mt-0.5 text-sm text-[#89a]">@{profile.username}</p>

              {/* Bio */}
              {profile.bio && (
                <p className="mt-2.5 text-sm text-[#ccd5df] leading-relaxed max-w-xl whitespace-pre-line">
                  {profile.bio}
                </p>
              )}

              {/* Metadata Row Below Bio: Location, Website, Joined Date */}
              {(userLocation || userWebsite || joinedDate) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-[#89a]">
                  {userLocation && (
                    <span className="flex items-center gap-1.5">
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-[#89a]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>{userLocation}</span>
                    </span>
                  )}
                  {userWebsite && (
                    <a
                      href={userWebsite.startsWith("http") ? userWebsite : `https://${userWebsite}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[#40bcf4] hover:underline"
                    >
                      <svg
                        className="h-3.5 w-3.5 shrink-0"
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
                      <span>{userWebsite.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}
                  {joinedDate && (
                    <span className="flex items-center gap-1.5">
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-[#89a]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect width="18" height="18" x="3" y="4" rx="2" />
                        <path d="M3 10h18" />
                        <path d="M8 2v4" />
                        <path d="M16 2v4" />
                      </svg>
                      <span>Joined {joinedDate}</span>
                    </span>
                  )}
                </div>
              )}

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

              {/* Action Buttons Row */}
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

                      {/* Dropdown Menu */}
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

            {/* Right Column: Large Round Avatar */}
            <div className="flex-shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
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
              { key: "lists", label: "Lists" },
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

                {favoriteBookActionError && (
                  <p role="alert" className="mb-3 text-xs font-medium text-red-300">
                    {favoriteBookActionError}
                  </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  {favoriteBooks.map((book) => (
                    <div
                      key={book.open_library_key}
                      className="group relative aspect-[2/3] overflow-hidden rounded-xl border border-[#2c3440] bg-[#1a1f26] shadow-md transition hover:-translate-y-1 hover:border-[#00e054] hover:shadow-xl"
                    >
                      <Link
                        href={`/books/${book.open_library_key.replace(/^\/works\//, "")}`}
                        className="absolute inset-0 block"
                        aria-label={`${book.title} by ${book.authors.join(", ")}`}
                      >
                        <BookCover
                          coverURL={book.cover_url || undefined}
                          title={book.title}
                          authors={book.authors}
                          className="h-full w-full rounded-none shadow-none"
                        />
                      </Link>
                      {isOwner && (
                        <button
                          type="button"
                          aria-label={`Remove ${book.title} from favorite books`}
                          title="Remove favorite"
                          disabled={removeFavoriteBookMutation.isPending}
                          onClick={() => void handleRemoveFavoriteBook(book.open_library_key)}
                          className="pointer-events-none absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[#b8c8d6] bg-[#c9d7e4] text-[#40576b] opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 hover:bg-white disabled:cursor-wait disabled:opacity-60"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                          >
                            <path d="m6 6 12 12M18 6 6 18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 4 - favoriteBooks.length) }, (_, slot) =>
                    isOwner ? (
                      <button
                        key={`add-${slot}`}
                        type="button"
                        onClick={() => {
                          setFavoriteBookName("");
                          setFavoriteBookError("");
                          setDebouncedFavoriteBookName("");
                          setIsFavoriteBookModalOpen(true);
                        }}
                        className="flex aspect-[2/3] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#00e054] bg-[#14181c]/60 p-4 text-center transition hover:bg-[#181c22]"
                      >
                        <span className="text-2xl text-[#455]">+</span>
                        <span className="mt-2 text-xs font-medium text-[#789]">Add favorite</span>
                      </button>
                    ) : (
                      <div
                        key={`empty-${slot}`}
                        aria-hidden="true"
                        className="aspect-[2/3] rounded-xl border-2 border-dashed border-[#242c34] bg-[#14181c]/40"
                      />
                    ),
                  )}
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
                          <BookCover
                            coverURL={read.book.cover_url || undefined}
                            title={read.book.title}
                            authors={read.book.authors}
                            className="h-full w-full rounded-none shadow-none"
                          />
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
                            <BookCover
                              coverURL={read.book.cover_url || undefined}
                              title={read.book.title}
                              authors={read.book.authors}
                              className="h-full w-full rounded-none shadow-none"
                            />
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
                        <BookCover
                          coverURL={read.book.cover_url || undefined}
                          title={read.book.title}
                          authors={read.book.authors}
                          className="h-full w-full rounded-none shadow-none"
                        />
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
                      <BookCover
                        coverURL={read.book.cover_url || undefined}
                        title={read.book.title}
                        authors={read.book.authors}
                        className="h-full w-full rounded-none shadow-none"
                      />
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
                          <BookCover
                            coverURL={read.book.cover_url || undefined}
                            title={read.book.title}
                            authors={read.book.authors}
                            className="h-full w-full rounded-none shadow-none"
                          />
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
              {/* Header with Filters & Sort */}
              <div className="flex flex-wrap items-center justify-between border-b border-[#242c34] pb-2 text-xs gap-3">
                <h2 className="font-bold tracking-widest uppercase text-[#89a]">REVIEWS</h2>

                <div className="flex items-center gap-4 text-[#89a] text-[11px] font-semibold tracking-wider uppercase">
                  {/* Rating filter */}
                  <div className="relative">
                    <select
                      value={filterRating}
                      onChange={(e) => setFilterRating(e.target.value)}
                      className="bg-transparent text-[#89a] hover:text-white cursor-pointer uppercase appearance-none pr-3 outline-none"
                    >
                      <option value="all" className="bg-[#161a20] text-white">
                        RATING ▾
                      </option>
                      <option value="5" className="bg-[#161a20] text-white">
                        ★★★★★ (5)
                      </option>
                      <option value="4" className="bg-[#161a20] text-white">
                        ★★★★ (4+)
                      </option>
                      <option value="3" className="bg-[#161a20] text-white">
                        ★★★ (3+)
                      </option>
                      <option value="2" className="bg-[#161a20] text-white">
                        ★★ (2+)
                      </option>
                      <option value="1" className="bg-[#161a20] text-white">
                        ★ (1+)
                      </option>
                    </select>
                  </div>

                  {/* Diary year filter */}
                  {availableYears.length > 0 && (
                    <div className="relative">
                      <select
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="bg-transparent text-[#89a] hover:text-white cursor-pointer uppercase appearance-none pr-3 outline-none"
                      >
                        <option value="all" className="bg-[#161a20] text-white">
                          DIARY YEAR ▾
                        </option>
                        {availableYears.map((yr) => (
                          <option key={yr} value={yr} className="bg-[#161a20] text-white">
                            {yr}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Sort dropdown */}
                  <div className="relative">
                    <select
                      value={reviewsSortBy}
                      onChange={(e) =>
                        setReviewsSortBy(e.target.value as "recent" | "rating" | "popular")
                      }
                      className="bg-transparent text-[#89a] hover:text-white cursor-pointer uppercase appearance-none pr-3 outline-none"
                    >
                      <option value="recent" className="bg-[#161a20] text-white">
                        Sort by WHEN REVIEWED ▾
                      </option>
                      <option value="rating" className="bg-[#161a20] text-white">
                        Sort by HIGHEST RATING ▾
                      </option>
                      <option value="popular" className="bg-[#161a20] text-white">
                        Sort by POPULAR ▾
                      </option>
                    </select>
                  </div>

                  {/* Eye toggle icon */}
                  <span
                    className="text-[#89a] hover:text-white transition cursor-pointer select-none"
                    title="Filter visibility"
                  >
                    👁 ▾
                  </span>
                </div>
              </div>

              {userReviewsQuery.isLoading ? (
                <div className="space-y-6 py-4">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="flex gap-4 sm:gap-5 pb-6 border-b border-[#242c34] animate-pulse"
                    >
                      <div className="h-[106px] w-[70px] sm:h-[120px] sm:w-[80px] rounded-[3px] bg-white/5 shrink-0" />
                      <div className="flex-1 space-y-2.5 py-1">
                        <div className="h-6 w-1/3 bg-white/5 rounded" />
                        <div className="h-4 w-1/4 bg-white/5 rounded" />
                        <div className="h-4 w-2/3 bg-white/5 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : sortedReviews.length > 0 ? (
                <div className="divide-y divide-[#242c34]">
                  {sortedReviews.map((rev) => {
                    const starsText = renderLetterboxdStars(rev.rating);
                    const readDateText = formatLetterboxdDate(rev.created_at);
                    const publishedYear = rev.book?.published_year;

                    return (
                      <article key={rev.id} className="flex gap-4 sm:gap-5 py-6 group">
                        {/* Poster / Book Cover */}
                        <Link
                          href={`/books/${rev.book?.id || rev.book_id}`}
                          className="relative h-[106px] w-[70px] sm:h-[120px] sm:w-[80px] shrink-0 overflow-hidden rounded-[3px] border border-[#2c3440] bg-[#1a1f26] transition hover:border-[#00e054] hover:shadow-lg hover:shadow-green-950/20"
                        >
                          <BookCover
                            coverURL={rev.book?.cover_url || undefined}
                            title={rev.book?.title || "Book Cover"}
                            authors={rev.book?.authors || []}
                            className="h-full w-full rounded-none shadow-none"
                          />
                        </Link>

                        {/* Review Content */}
                        <div className="min-w-0 flex-1 flex flex-col justify-between">
                          <div>
                            {/* Title & Published Year */}
                            <div className="flex items-baseline flex-wrap gap-2">
                              <Link
                                href={`/books/${rev.book?.id || rev.book_id}`}
                                className="font-serif text-xl sm:text-2xl font-bold text-white hover:text-[#00e054] transition leading-tight"
                              >
                                {rev.book?.title || "Untitled Book"}
                              </Link>
                              {publishedYear && (
                                <span className="font-serif text-base sm:text-lg text-[#89a] font-normal">
                                  {publishedYear}
                                </span>
                              )}
                            </div>

                            {/* Rating Stars + Read Date */}
                            <div className="mt-1 flex items-center gap-2 text-xs sm:text-[13px]">
                              {starsText && (
                                <span className="text-[#00e054] tracking-widest font-bold">
                                  {starsText}
                                </span>
                              )}
                              <span className="text-[#89a]">Read {readDateText}</span>
                            </div>

                            {/* Review Body */}
                            <div className="mt-2.5">
                              {rev.contains_spoilers && !revealedSpoilers[rev.id] ? (
                                <div className="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs flex items-center justify-between">
                                  <span className="text-amber-300 font-sans">
                                    ⚠️ This review contains spoilers.
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRevealedSpoilers((prev) => ({ ...prev, [rev.id]: true }))
                                    }
                                    className="text-amber-400 hover:text-amber-200 font-bold underline cursor-pointer ml-3 font-sans"
                                  >
                                    Reveal
                                  </button>
                                </div>
                              ) : (
                                <p className="font-serif text-[15px] sm:text-base text-[#c5d0db] leading-relaxed whitespace-pre-line">
                                  {rev.body}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Likes & Actions */}
                          <div className="mt-3.5 flex items-center justify-between text-xs text-[#678]">
                            <div className="flex items-center gap-1.5 hover:text-[#89a] transition">
                              <svg
                                className="w-3.5 h-3.5 fill-current text-white/40"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                              </svg>
                              <span>No likes yet</span>
                            </div>

                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => handleDeleteReview(rev.id)}
                                className="text-zinc-600 hover:text-rose-400 transition cursor-pointer text-xs"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                /* Empty state */
                <div className="rounded-2xl border border-[#242c34] bg-[#161a20] p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1e242c] text-xl text-[#89a]">
                    ✎
                  </div>
                  <h3 className="mt-4 text-base font-bold text-white">
                    {isOwner
                      ? "You haven’t published any reviews yet."
                      : `${profile?.display_name || username} hasn’t written any reviews yet.`}
                  </h3>
                  <p className="mt-1 text-xs text-[#89a]">
                    {isOwner
                      ? "Share your thoughts, ratings, and comments on the books you've read."
                      : "When they review books, their thoughts and ratings will appear here."}
                  </p>
                  {isOwner && (
                    <Link
                      href="/books"
                      className="mt-5 inline-flex rounded-xl bg-[#00e054] px-5 py-2 text-xs font-bold text-black hover:bg-[#00c549] transition"
                    >
                      Browse books to review
                    </Link>
                  )}
                </div>
              )}
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
                      <BookCover
                        coverURL={read.book.cover_url || undefined}
                        title={read.book.title}
                        authors={read.book.authors}
                        className="h-full w-full rounded-none shadow-none"
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#89a]">No books on your Want to Read shelf yet.</p>
              )}
            </div>
          )}

          {/* TAB: LISTS */}
          {activeTab === "lists" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#242c34] pb-2">
                <h2 className="text-xs font-bold tracking-widest uppercase text-[#89a]">
                  CURATED LISTS ({displayLists.length})
                </h2>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setCreateListOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium px-3 py-1.5 text-xs transition"
                  >
                    <span>+ New List</span>
                  </button>
                )}
              </div>

              {listsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-56 rounded-2xl bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : displayLists.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <p className="text-sm text-[#89a]">
                    {isOwner
                      ? "You haven’t created any custom lists yet."
                      : `${profile?.display_name || username} hasn’t created any public lists yet.`}
                  </p>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setCreateListOpen(true)}
                      className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition underline"
                    >
                      Create your first list
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {displayLists.map((l) => (
                    <ListCard key={l.id} list={l} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create List Modal */}
        <CreateListModal open={createListOpen} onClose={() => setCreateListOpen(false)} />

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

        {isFavoriteBookModalOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-start justify-center bg-black/80 p-4 pt-4 backdrop-blur-[1px]"
            onClick={() => setIsFavoriteBookModalOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="favorite-book-dialog-title"
              className="relative w-full max-w-[460px] rounded-[3px] bg-[#45596a] px-6 pb-6 pt-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsFavoriteBookModalOpen(false)}
                className="absolute right-5 top-4 text-[34px] font-extralight leading-none text-[#91a2b2] transition hover:text-white"
                aria-label="Close favorite book dialog"
              >
                ×
              </button>
              <h2
                id="favorite-book-dialog-title"
                className="pr-12 text-lg font-medium uppercase tracking-[0.14em] text-[#b1c1ce]"
              >
                Pick a Favorite Book
              </h2>
              <label
                htmlFor="favorite-book-name"
                className="mt-5 block text-sm font-semibold text-white"
              >
                Name of Book
              </label>
              <div className="relative mt-1.5">
                <input
                  id="favorite-book-name"
                  autoFocus
                  type="text"
                  value={favoriteBookName}
                  onChange={(event) => {
                    setFavoriteBookName(event.target.value);
                    setFavoriteBookError("");
                  }}
                  className="h-12 w-full rounded-[4px] border border-[#dfe3e8] bg-white px-3 text-base text-[#15191e] shadow-[0_2px_8px_rgba(0,0,0,0.35)] outline-none focus:border-[#cbd5df]"
                />
                {favoriteBookName.trim() && (
                  <div
                    role="listbox"
                    aria-label="Book search results"
                    className="absolute left-0 right-0 top-[calc(100%-1px)] z-10 max-h-[268px] overflow-y-auto border border-[#c7d0d8] bg-[#65798b] text-white shadow-xl"
                  >
                    {addFavoriteBookMutation.isPending ? (
                      <div className="px-3 py-2.5 text-sm text-[#d5dee6]">
                        Adding to your favorites…
                      </div>
                    ) : favoriteBookSearch.isPending || favoriteBookSearch.isFetching ? (
                      <div className="px-3 py-2.5 text-sm text-[#d5dee6]">Searching books…</div>
                    ) : favoriteBookSearch.data?.data.length ? (
                      favoriteBookSearch.data.data.slice(0, 7).map((book) => (
                        <button
                          key={book.id}
                          type="button"
                          role="option"
                          aria-selected={false}
                          disabled={addFavoriteBookMutation.isPending}
                          onClick={() => void handleSelectFavoriteBook(book)}
                          className="flex w-full items-baseline gap-1.5 overflow-hidden px-3 py-2 text-left transition hover:bg-[#00b32e] focus:bg-[#00b32e] focus:outline-none disabled:opacity-60"
                        >
                          <span className="shrink-0 truncate text-[15px] leading-5 text-white">
                            {book.title}
                            {book.published_year ? ` (${book.published_year})` : ""}
                          </span>
                          <span className="truncate text-sm leading-5 text-[#d4dde5]">
                            {book.authors.join(", ") || "Unknown author"}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2.5 text-sm text-[#e0e7ed]">
                        No matching books found.
                      </div>
                    )}
                    {favoriteBookError && (
                      <div
                        role="alert"
                        className="border-t border-red-200/30 bg-red-950/50 px-3 py-2.5 text-xs font-medium text-red-100"
                      >
                        {favoriteBookError}
                      </div>
                    )}
                    <Link
                      href={`/books?q=${encodeURIComponent(favoriteBookName.trim())}`}
                      onClick={() => setIsFavoriteBookModalOpen(false)}
                      className="block border-t border-[#8292a0] bg-[#45596a] px-3 py-2.5 text-xs text-[#d4dde5] hover:text-white"
                    >
                      Book not here?{" "}
                      <span className="font-semibold underline">Browse the catalog.</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
