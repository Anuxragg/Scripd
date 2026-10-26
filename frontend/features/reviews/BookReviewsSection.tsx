"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Flame, Heart, Laugh, PartyPopper, Sparkles, ThumbsUp } from "lucide-react";
import { Reactions, type Reaction, type ReactionOption } from "@/components/ui/reactions";
import { useCurrentUser } from "@/features/auth/hooks";
import {
  useFollowStatus,
  useFollowUser,
  useProfile,
  useUnfollowUser,
} from "@/features/profile/hooks";
import {
  useBookReviews,
  useCreateReview,
  useDeleteReview,
  useUpdateReview,
} from "@/features/reviews/hooks";
import { useCreateRead, useReadEntries } from "@/features/reads/hooks";
import { ReviewCommentsThread } from "@/features/reviews/ReviewCommentsThread";
import { useClientStorage, subscribeStorage, notifyStorageChange } from "@/lib/useClientStorage";

let countsCacheRaw = "";
let countsCacheSnapshot: Record<string, number> = {};
const emptyCountsSnapshot: Record<string, number> = {};

function getRepliesCountSnapshot(): Record<string, number> {
  if (typeof window === "undefined") return emptyCountsSnapshot;
  try {
    let rawSig = "";
    const counts: Record<string, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("scripd_replies_store_")) {
        const val = localStorage.getItem(key) || "";
        rawSig += `${key}:${val}|`;
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            counts[key.replace("scripd_replies_store_", "")] = parsed.length;
          }
        } catch {
          // Safe ignore
        }
      }
    }
    if (rawSig !== countsCacheRaw) {
      countsCacheRaw = rawSig;
      countsCacheSnapshot = counts;
    }
    return countsCacheSnapshot;
  } catch {
    return countsCacheSnapshot;
  }
}

export type ReviewRatingCategory = "Skip" | "Timepass" | "Go for it" | "Perfection";

export interface DisplayReview {
  id: string;
  author: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  ratingCategory?: ReviewRatingCategory;
  body: string;
  createdAt: string;
  likes: number;
  isLiked?: boolean;
  containsSpoilers?: boolean;
  isFollowing?: boolean;
  reactions?: Reaction[];
}

export const REVIEW_REACTION_OPTIONS: ReactionOption[] = [
  { id: "love", label: "Love", icon: Heart },
  { id: "fire", label: "Fire", icon: Flame },
  { id: "celebrate", label: "Celebrate", icon: PartyPopper },
  { id: "laugh", label: "Laugh", icon: Laugh },
  { id: "insightful", label: "Insightful", icon: Sparkles },
];

function formatTimeAgo(dateString: string): string {
  try {
    const diff = Math.max(0, Date.now() - new Date(dateString).getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch {
    return "just now";
  }
}

function ratingToCategory(rating?: number | null): ReviewRatingCategory {
  if (typeof rating !== "number") return "Go for it";
  if (rating >= 4.5) return "Perfection";
  if (rating >= 3.5) return "Go for it";
  if (rating >= 2.5) return "Timepass";
  return "Skip";
}

function ReviewFollowButton({
  username,
  initialFollowing = false,
  onFollowChange,
}: {
  username: string;
  initialFollowing?: boolean;
  onFollowChange?: (following: boolean) => void;
}) {
  const followStatusQuery = useFollowStatus(username);
  const followMutation = useFollowUser(username);
  const unfollowMutation = useUnfollowUser(username);

  const [localFollowed, setLocalFollowed] = useClientStorage<boolean | null>(
    `scripd_following_${username.toLowerCase()}`,
    null,
  );

  const isFollowing =
    localFollowed !== null
      ? localFollowed
      : (followStatusQuery.data?.is_following ?? initialFollowing);

  const isPending = followMutation.isPending || unfollowMutation.isPending;

  async function handleToggleFollow(e: React.MouseEvent) {
    e.stopPropagation();
    const nextState = !isFollowing;
    setLocalFollowed(nextState);
    onFollowChange?.(nextState);

    try {
      if (nextState) {
        localStorage.setItem(`scripd_has_follower_${username.toLowerCase()}`, "true");
      } else {
        localStorage.removeItem(`scripd_has_follower_${username.toLowerCase()}`);
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

  return (
    <button
      type="button"
      onClick={handleToggleFollow}
      disabled={isPending}
      className={`rounded-full px-3.5 py-1 text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
        isFollowing
          ? "border border-white/20 bg-white/10 text-zinc-300 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
          : "border border-white/20 bg-[#161a22] text-white hover:bg-white/10 hover:border-white/30 active:scale-95"
      }`}
      title={isFollowing ? `Unfollow @${username}` : `Follow @${username}`}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}

export function BookReviewsSection({ bookID }: { bookID: string; bookTitle?: string }) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookID);

  const userQuery = useCurrentUser();
  const user = userQuery.data;
  const userProfileQuery = useProfile(user?.username ?? "");
  const localAvatar = useSyncExternalStore(
    subscribeStorage,
    () =>
      typeof window !== "undefined" && user?.username
        ? localStorage.getItem(`scripd_user_avatar_${user.username}`) || ""
        : "",
    () => "",
  );

  const avatarUrl = userProfileQuery.data?.avatar_url || localAvatar || "";
  const currentUsername = user?.username ? `@${user.username}` : "@Anuxragg";
  const userDisplayName = user?.display_name || user?.username || "Anuxragg";
  const initials =
    (userDisplayName || "AP")
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AP";

  // Backend queries for real reviews & read entries when bookID is a UUID
  const apiReviewsQuery = useBookReviews(bookID, isUUID);
  const entriesQuery = useReadEntries({ bookID, limit: 10 }, Boolean(user && isUUID));
  const userEntry = entriesQuery.data?.pages.flatMap((page) => page.data)[0];
  const createReadMutation = useCreateRead();
  const createReviewMutation = useCreateReview(bookID);
  const updateReviewMutation = useUpdateReview(bookID);
  const deleteReviewMutation = useDeleteReview(bookID);

  // Review Form State
  const [reviewBody, setReviewBody] = useState("");
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Review State
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editSpoilers, setEditSpoilers] = useState(false);

  // 3-Dot Menu State & Dynamic Viewport Positioning
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPlacement, setMenuPlacement] = useState<"up" | "down">("up");
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  function updateMenuPlacement(buttonEl: HTMLElement) {
    const rect = buttonEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedMenuHeight = 220;
    // If not enough space below, or if the comment is scrolled down towards the bottom, move upside!
    if (spaceBelow < estimatedMenuHeight) {
      setMenuPlacement("up");
    } else {
      setMenuPlacement("down");
    }
  }

  function handleToggleMenu(reviewId: string, buttonEl: HTMLButtonElement) {
    if (activeMenuId === reviewId) {
      setActiveMenuId(null);
      activeButtonRef.current = null;
      return;
    }
    updateMenuPlacement(buttonEl);
    activeButtonRef.current = buttonEl;
    setActiveMenuId(reviewId);
  }

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function triggerToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  // Listen to scroll & resize while menu is open to dynamically flip upside when scrolled down
  useEffect(() => {
    if (!activeMenuId) return;

    function handleScrollOrResize() {
      if (activeButtonRef.current) {
        updateMenuPlacement(activeButtonRef.current);
      }
    }

    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [activeMenuId]);

  // Close 3-dot menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
        activeButtonRef.current = null;
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Real local user reviews storage for persistence across reloads / non-UUID books
  const storageKey = `scripd_production_reviews_${bookID}`;
  const [localReviews, setLocalReviews] = useClientStorage<DisplayReview[]>(storageKey, []);
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Combine real backend reviews with local user reviews (NO hardcoded seed data!)
  const allReviews = useMemo(() => {
    const backendItems = apiReviewsQuery.data?.pages.flatMap((page) => page.data) ?? [];

    const mappedBackend: DisplayReview[] = backendItems.map((r) => ({
      id: r.id,
      author: {
        username: r.author.username,
        display_name: r.author.display_name || r.author.username,
        avatar_url: r.author.avatar_url || undefined,
      },
      ratingCategory: ratingToCategory(r.rating),
      body: r.body,
      createdAt: formatTimeAgo(r.created_at),
      likes: 0,
      isLiked: false,
      containsSpoilers: r.contains_spoilers,
      isFollowing: false,
      reactions: [],
    }));

    // Merge backend reviews and local user reviews, deduplicating by ID
    // Also strip any legacy "like" inside reactions so it stays strictly on the dedicated thumbs-up button
    const sanitizedLocal: DisplayReview[] = localReviews.map((r) => ({
      ...r,
      reactions: r.reactions?.filter((rx) => rx.id !== "like"),
    }));
    const combined: DisplayReview[] = [...sanitizedLocal];
    for (const bReview of mappedBackend) {
      if (!combined.some((item) => item.id === bReview.id)) {
        combined.push(bReview);
      }
    }

    return combined;
  }, [apiReviewsQuery.data, localReviews]);

  // Filters State
  const [sortBy, setSortBy] = useState<"liked" | "recent">("liked");
  const [showSpoilers, setShowSpoilers] = useState(false);
  const [followingOnly, setFollowingOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  // Replies Thread & Comments State
  const [openRepliesIds, setOpenRepliesIds] = useState<string[]>([]);
  const persistentCommentCounts = useSyncExternalStore(
    subscribeStorage,
    getRepliesCountSnapshot,
    () => emptyCountsSnapshot,
  );
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const commentCounts = useMemo(
    () => ({ ...persistentCommentCounts, ...liveCounts }),
    [persistentCommentCounts, liveCounts],
  );

  function toggleReplies(id: string) {
    setOpenRepliesIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  const handleCommentsCountChange = useCallback((reviewId: string, count: number) => {
    setLiveCounts((prev) => {
      if (prev[reviewId] === count) return prev;
      return { ...prev, [reviewId]: count };
    });
  }, []);

  function toggleExpand(id: string) {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function handleReactionsChange(id: string, nextReactions: Reaction[]) {
    const sanitized = nextReactions.filter((rx) => rx.id !== "like");
    setLocalReviews((prev) => {
      const exists = prev.some((r) => r.id === id);
      if (exists) {
        return prev.map((r) => (r.id === id ? { ...r, reactions: sanitized } : r));
      }
      const backendTarget = allReviews.find((r) => r.id === id);
      if (backendTarget) {
        return [
          ...prev,
          {
            ...backendTarget,
            reactions: sanitized,
          },
        ];
      }
      return prev;
    });
  }

  function handleToggleLike(id: string) {
    setLocalReviews((prev) => {
      const exists = prev.some((r) => r.id === id);
      if (exists) {
        return prev.map((r) => {
          if (r.id === id) {
            const nextLiked = !r.isLiked;
            const nextCount = nextLiked ? r.likes + 1 : Math.max(0, r.likes - 1);
            return {
              ...r,
              isLiked: nextLiked,
              likes: nextCount,
            };
          }
          return r;
        });
      }
      const backendTarget = allReviews.find((r) => r.id === id);
      if (backendTarget) {
        const nextLiked = !backendTarget.isLiked;
        const nextCount = nextLiked
          ? backendTarget.likes + 1
          : Math.max(0, backendTarget.likes - 1);
        return [
          ...prev,
          {
            ...backendTarget,
            isLiked: nextLiked,
            likes: nextCount,
          },
        ];
      }
      return prev;
    });
  }

  async function handlePostReview(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmed = reviewBody.trim();
    if (!trimmed) {
      setFormError("Please enter review text before submitting.");
      return;
    }

    setIsPosting(true);

    try {
      // If user is authenticated and this is a backend UUID book, persist to PostgreSQL
      if (user && isUUID) {
        let readID = userEntry?.id;
        if (!readID) {
          const newRead = await createReadMutation.mutateAsync({
            book_id: bookID,
            status: "read",
          });
          readID = newRead.id;
        }

        if (readID) {
          try {
            await createReviewMutation.mutateAsync({
              read_id: readID,
              body: trimmed,
              contains_spoilers: containsSpoilers,
            });
          } catch {
            // Fallback to client persistence
          }
        }
      }

      // Add to real local reviews store for instant display & offline resilience
      const newReview: DisplayReview = {
        id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        author: {
          username: user?.username || "Anuxragg",
          display_name: userDisplayName,
          avatar_url: avatarUrl || undefined,
        },
        body: trimmed,
        createdAt: "just now",
        likes: 0,
        isLiked: false,
        containsSpoilers: containsSpoilers,
        isFollowing: true,
      };

      setLocalReviews((prev) => [newReview, ...prev]);
      setReviewBody("");
      setContainsSpoilers(false);
      triggerToast("Review posted successfully!");
    } catch {
      setFormError("Could not submit review. Please try again.");
    } finally {
      setIsPosting(false);
    }
  }

  // Start Editing a review
  function startEditing(review: DisplayReview) {
    setEditingReviewId(review.id);
    setEditBody(review.body);
    setEditSpoilers(Boolean(review.containsSpoilers));
    setActiveMenuId(null);
  }

  // Cancel Editing
  function cancelEditing() {
    setEditingReviewId(null);
    setEditBody("");
  }

  // Save Edited Review
  async function saveEditedReview(reviewId: string) {
    const trimmed = editBody.trim();
    if (!trimmed) return;

    // Update in localReviews
    setLocalReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? {
              ...r,
              body: trimmed,
              containsSpoilers: editSpoilers,
            }
          : r,
      ),
    );

    // If UUID review, attempt backend update
    if (isUUID && !reviewId.startsWith("review-")) {
      try {
        await updateReviewMutation.mutateAsync({
          reviewID: reviewId,
          input: {
            body: trimmed,
            contains_spoilers: editSpoilers,
          },
        });
      } catch {
        // Safe ignore
      }
    }

    setEditingReviewId(null);
    triggerToast("Review updated!");
  }

  // Delete a review
  async function handleDeleteReview(reviewId: string) {
    setLocalReviews((prev) => prev.filter((r) => r.id !== reviewId));
    setActiveMenuId(null);

    if (isUUID && !reviewId.startsWith("review-")) {
      try {
        await deleteReviewMutation.mutateAsync(reviewId);
      } catch {
        // Safe ignore
      }
    }

    triggerToast("Review deleted");
  }

  // Share Actions
  function handleShareStory(review: DisplayReview) {
    setActiveMenuId(null);
    const text = `"${review.body}" — ${review.author.display_name} on Scripd`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      triggerToast("Review text copied to clipboard!");
    }
  }

  function handleShareCard() {
    setActiveMenuId(null);
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      triggerToast("Link copied to clipboard!");
    }
  }

  // Filter and sort reviews
  const displayedReviews = useMemo(() => {
    let list = [...allReviews];

    if (followingOnly) {
      list = list.filter((r) => {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem(
            `scripd_following_${r.author.username.toLowerCase()}`,
          );
          if (stored !== null) return stored === "true";
        }
        return r.isFollowing;
      });
    }

    if (sortBy === "liked") {
      list.sort((a, b) => b.likes - a.likes);
    }

    return list;
  }, [allReviews, followingOnly, sortBy]);

  return (
    <div className="space-y-12 relative" ref={menuContainerRef}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-white/10 bg-[#161a22]/95 px-4 py-3 text-xs font-semibold text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <span className="flex h-2 w-2 rounded-full bg-[#00e054]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Write a Review Section */}
      <section>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-4">
          Write a Review
        </h2>

        <form
          onSubmit={handlePostReview}
          className="rounded-2xl border border-white/10 bg-[#0f1218] p-5 sm:p-6 shadow-xl"
        >
          {/* Top Bar: User info on left */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#374151] border border-white/10 text-white font-bold text-xs items-center justify-center">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={userDisplayName}
                  width={40}
                  height={40}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div>
              <span className="font-semibold text-white text-sm tracking-tight block">
                {currentUsername}
              </span>
              {!user && (
                <Link href="/login" className="text-[11px] text-[#40bcf4] hover:underline block">
                  Sign in to sync with your profile
                </Link>
              )}
            </div>
          </div>

          {formError && (
            <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
              {formError}
            </div>
          )}

          {/* Text Area */}
          <div className="relative mt-2">
            <textarea
              rows={3}
              maxLength={1000}
              value={reviewBody}
              onChange={(e) => setReviewBody(e.target.value)}
              placeholder="Write your review here..."
              className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none resize-none pt-2 pb-6 min-h-[90px] leading-relaxed"
            />
            {/* Character Counter */}
            <div className="absolute right-0 bottom-1 text-[11px] text-zinc-500 font-mono select-none">
              {reviewBody.length}/1000
            </div>
          </div>

          {/* Divider line & Post button */}
          <div className="border-t border-white/10 pt-4 mt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-400 hover:text-zinc-200 transition">
              <input
                type="checkbox"
                checked={containsSpoilers}
                onChange={(e) => setContainsSpoilers(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/20 bg-[#161a22] text-[#9333ea] focus:ring-0 cursor-pointer"
              />
              <span>Contains spoilers</span>
            </label>

            <button
              type="submit"
              disabled={isPosting || !reviewBody.trim()}
              className="rounded-full bg-white px-6 py-2 text-sm font-bold text-black transition hover:bg-zinc-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPosting ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      </section>

      {/* 2. User Reviews Section */}
      <section>
        {/* Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              User Reviews
            </h2>
            {isHydrated && displayedReviews.length > 0 && (
              <span
                suppressHydrationWarning
                className="rounded-full border border-white/10 bg-[#161a22] px-2.5 py-0.5 text-xs text-zinc-400"
              >
                {displayedReviews.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "liked" | "recent")}
                className="appearance-none rounded-xl border border-white/10 bg-[#161a22] pl-3.5 pr-8 py-1.5 text-xs font-semibold text-white outline-none cursor-pointer hover:border-white/20 transition"
              >
                <option value="liked" className="bg-[#161a22] text-white">
                  ↓↑ Most Liked
                </option>
                <option value="recent" className="bg-[#161a22] text-white">
                  ↓↑ Recent
                </option>
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px]">
                ▼
              </span>
            </div>

            {/* Show Spoilers Toggle */}
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#161a22] px-3.5 py-1.5 text-xs text-zinc-300 cursor-pointer hover:border-white/20 transition select-none">
              <input
                type="checkbox"
                checked={showSpoilers}
                onChange={(e) => setShowSpoilers(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-purple-500/50 bg-transparent text-[#9333ea] focus:ring-0 cursor-pointer"
              />
              <span>Show Spoilers</span>
            </label>

            {/* Following Only Toggle */}
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#161a22] px-3.5 py-1.5 text-xs text-zinc-300 cursor-pointer hover:border-white/20 transition select-none">
              <input
                type="checkbox"
                checked={followingOnly}
                onChange={(e) => setFollowingOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-purple-500/50 bg-transparent text-[#9333ea] focus:ring-0 cursor-pointer"
              />
              <span>Following Only</span>
            </label>
          </div>
        </div>

        {/* Review Cards List */}
        <div className="space-y-6">
          {displayedReviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0f1218]/50 p-10 text-center text-zinc-400">
              <p className="font-semibold text-white text-base">No reviews yet</p>
              <p className="mt-1 text-xs text-zinc-400">
                Be the first reader to share your thoughts on this book above!
              </p>
            </div>
          ) : (
            displayedReviews.map((review) => {
              const isExpanded = expandedIds.includes(review.id);
              const isLongText = review.body.length > 220;
              const displayText =
                isLongText && !isExpanded ? `${review.body.slice(0, 220)}...` : review.body;

              const isSpoilerMasked = review.containsSpoilers && !showSpoilers;

              const isAuthor = Boolean(
                (user && review.author.username.toLowerCase() === user.username.toLowerCase()) ||
                  review.author.username === "You" ||
                  review.author.username.toLowerCase() ===
                    currentUsername.replace("@", "").toLowerCase(),
              );

              const isEditingThis = editingReviewId === review.id;

              return (
                <article
                  key={review.id}
                  className="rounded-2xl border border-white/5 bg-[#0f1218] p-5 sm:p-6 transition hover:border-white/10 relative"
                >
                  {/* Review Header: User info left, Follow button on right for other viewers */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#374151] border border-white/10 text-white font-bold text-xs flex items-center justify-center">
                        {review.author.avatar_url ? (
                          <Image
                            src={review.author.avatar_url}
                            alt={review.author.display_name}
                            width={40}
                            height={40}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{review.author.display_name.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white tracking-tight">
                          {review.author.display_name}
                        </h4>
                        <span
                          suppressHydrationWarning
                          className="text-xs text-zinc-400 mt-0.5 block"
                        >
                          {review.createdAt}
                        </span>
                      </div>
                    </div>

                    {/* Follow Button for other viewers */}
                    {!isAuthor && (
                      <ReviewFollowButton
                        username={review.author.username}
                        initialFollowing={review.isFollowing}
                        onFollowChange={(following) => {
                          setLocalReviews((prev) =>
                            prev.map((r) =>
                              r.author.username.toLowerCase() ===
                              review.author.username.toLowerCase()
                                ? { ...r, isFollowing: following }
                                : r,
                            ),
                          );
                        }}
                      />
                    )}
                  </div>

                  {/* Edit Mode Form vs Normal Display */}
                  {isEditingThis ? (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                      {/* Text area in edit mode */}
                      <textarea
                        rows={3}
                        maxLength={1000}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#161a22] p-3 text-sm text-white outline-none focus:border-[#9333ea] resize-y"
                      />

                      {/* Spoilers & Action Buttons */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400">
                          <input
                            type="checkbox"
                            checked={editSpoilers}
                            onChange={(e) => setEditSpoilers(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-white/20 bg-[#161a22] text-[#9333ea] focus:ring-0 cursor-pointer"
                          />
                          <span>Contains spoilers</span>
                        </label>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditedReview(review.id)}
                            disabled={!editBody.trim()}
                            className="rounded-full bg-white px-5 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition disabled:opacity-40 cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Review Body */}
                      <div className="mt-3.5">
                        {isSpoilerMasked ? (
                          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300">
                            <span>
                              ⚠️ This review contains spoilers. Toggle &ldquo;Show Spoilers&rdquo;
                              above to read.
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-300 leading-relaxed font-normal whitespace-pre-line">
                            {displayText}
                            {isLongText && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(review.id)}
                                className="ml-1 text-xs text-zinc-400 hover:text-white transition font-semibold cursor-pointer inline-block"
                              >
                                {isExpanded ? " less" : " ... more"}
                              </button>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Footer Actions: Like Heart, Speech Bubble, 3-Dots Menu */}
                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                        {/* Left icons: Dedicated Thumbs Up Button, Animated Reactions Bar & Speech bubble */}
                        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                          {/* Dedicated Thumbs Up Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleLike(review.id)}
                            className={`inline-flex items-center gap-2 h-8 px-3 rounded-xl border text-xs font-medium transition cursor-pointer select-none ${
                              review.isLiked
                                ? "bg-[#181d26] border-white/25 text-white font-semibold shadow-md shadow-black/30"
                                : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20"
                            }`}
                            title={review.isLiked ? "Unlike" : "Like"}
                          >
                            <ThumbsUp
                              className={`h-4 w-4 transition-transform ${
                                review.isLiked ? "fill-white text-white scale-105" : "text-zinc-400"
                              }`}
                              strokeWidth={review.isLiked ? 2 : 1.8}
                            />
                            {review.likes > 0 && (
                              <span
                                className={`tabular-nums text-xs ${
                                  review.isLiked
                                    ? "font-bold text-white"
                                    : "font-medium text-zinc-400"
                                }`}
                              >
                                {review.likes}
                              </span>
                            )}
                          </button>

                          {/* Reaction Adding Button & Other Reaction Pills (Heart, Fire, Celebrate, Laugh, Sparkles) */}
                          <Reactions
                            options={REVIEW_REACTION_OPTIONS}
                            value={review.reactions ?? []}
                            onValueChange={(next) => handleReactionsChange(review.id, next)}
                          />

                          {/* Speech Bubble / Comment Button */}
                          <button
                            type="button"
                            onClick={() => toggleReplies(review.id)}
                            className={`flex items-center gap-1.5 h-8 transition rounded-full border cursor-pointer ${
                              (commentCounts[review.id] ?? 0) > 0 ? "px-2.5" : "w-8 justify-center"
                            } ${
                              openRepliesIds.includes(review.id)
                                ? "bg-[#181d26] border-white/25 text-white"
                                : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20"
                            }`}
                            title={
                              openRepliesIds.includes(review.id) ? "Hide replies" : "Leave a reply"
                            }
                          >
                            <svg
                              className="h-4 w-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.8}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.636 1.07.514 1.68l-.48 2.398 2.622-1.311a2.25 2.25 0 011.006-.237c1.02.16 2.036.24 3.065.24z"
                              />
                            </svg>
                            {(commentCounts[review.id] ?? 0) > 0 && (
                              <span className="text-xs font-semibold tabular-nums text-zinc-300">
                                {commentCounts[review.id]}
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Right: 3-Dot Options Button */}
                        <div
                          className="relative"
                          ref={activeMenuId === review.id ? menuContainerRef : undefined}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleToggleMenu(review.id, e.currentTarget)}
                            className="flex items-center justify-center p-1.5 text-zinc-400 hover:text-white transition rounded-lg hover:bg-white/5 cursor-pointer"
                            title="More options"
                          >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="5" cy="12" r="1.5" />
                              <circle cx="12" cy="12" r="1.5" />
                              <circle cx="19" cy="12" r="1.5" />
                            </svg>
                          </button>

                          {/* 3-Dot Floating Dropdown Menu */}
                          {activeMenuId === review.id && (
                            <div
                              className={`absolute right-0 w-44 rounded-2xl border border-white/10 bg-[#0f1218] p-1.5 shadow-2xl z-40 transition-all duration-150 ${
                                menuPlacement === "up"
                                  ? "bottom-full mb-2 origin-bottom-right"
                                  : "top-full mt-2 origin-top-right"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleShareStory(review)}
                                className="flex w-full items-center gap-3 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer text-left"
                              >
                                <svg
                                  className="h-4 w-4 shrink-0 text-zinc-400"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={1.8}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
                                  />
                                </svg>
                                <span>Share Story</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleShareCard()}
                                className="flex w-full items-center gap-3 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer text-left"
                              >
                                <svg
                                  className="h-4 w-4 shrink-0 text-zinc-400"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={1.8}
                                >
                                  <rect
                                    x="3"
                                    y="3"
                                    width="18"
                                    height="18"
                                    rx="2"
                                    strokeWidth={1.8}
                                  />
                                  <circle cx="8.5" cy="8.5" r="1.5" />
                                  <path d="M21 15l-5-5L5 21" strokeWidth={1.8} />
                                </svg>
                                <span>Share Card</span>
                              </button>

                              {isAuthor && (
                                <button
                                  type="button"
                                  onClick={() => startEditing(review)}
                                  className="flex w-full items-center gap-3 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer text-left"
                                >
                                  <svg
                                    className="h-4 w-4 shrink-0 text-zinc-400"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={1.8}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                                    />
                                  </svg>
                                  <span>Edit Review</span>
                                </button>
                              )}

                              {isAuthor && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteReview(review.id)}
                                  className="flex w-full items-center gap-3 px-3 py-2 text-xs font-semibold text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer text-left"
                                >
                                  <svg
                                    className="h-4 w-4 shrink-0 text-rose-500"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={1.8}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                    />
                                  </svg>
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Threaded Replies Section */}
                      {openRepliesIds.includes(review.id) && (
                        <ReviewCommentsThread
                          reviewID={review.id}
                          isBackendUUID={/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                            review.id,
                          )}
                          likesCount={review.likes}
                          reviewCreatedAt={review.createdAt}
                          currentUser={user}
                          userAvatar={avatarUrl}
                          onCommentsCountChange={(count) =>
                            handleCommentsCountChange(review.id, count)
                          }
                        />
                      )}
                    </>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
