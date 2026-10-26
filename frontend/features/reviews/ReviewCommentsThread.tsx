"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Flame,
  Heart,
  Laugh,
  PartyPopper,
  Sparkles,
  ThumbsUp,
  Trash2,
  Send,
  MoreHorizontal,
  X,
} from "lucide-react";
import {
  Reactions,
  type Reaction,
  type ReactionOption,
} from "@/components/ui/reactions";
import {
  useCreateComment,
  useDeleteComment,
  useReviewComments,
} from "@/features/reviews/hooks";
import type { ReviewComment } from "@/features/reviews/api";

const COMMENT_REACTION_OPTIONS: ReactionOption[] = [
  { id: "love", label: "Love", icon: Heart },
  { id: "fire", label: "Fire", icon: Flame },
  { id: "celebrate", label: "Celebrate", icon: PartyPopper },
  { id: "laugh", label: "Laugh", icon: Laugh },
  { id: "insightful", label: "Insightful", icon: Sparkles },
];

function formatCommentDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

function formatFullDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return (
      date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }) +
      " at " +
      date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    );
  } catch {
    return dateString;
  }
}

export interface ReviewCommentsThreadProps {
  reviewID: string;
  isBackendUUID: boolean;
  likesCount: number;
  reviewCreatedAt: string;
  currentUser?: {
    id?: string;
    username: string;
    display_name?: string;
  } | null;
  userAvatar?: string;
  onCommentsCountChange?: (count: number) => void;
}

export function ReviewCommentsThread({
  reviewID,
  isBackendUUID,
  likesCount,
  reviewCreatedAt,
  currentUser,
  userAvatar,
  onCommentsCountChange,
}: ReviewCommentsThreadProps) {
  // Backend comments query and mutations when review is a backend UUID
  const commentsQuery = useReviewComments(reviewID, isBackendUUID);
  const createCommentMutation = useCreateComment(reviewID);
  const deleteCommentMutation = useDeleteComment(reviewID);

  // Local storage cache for persistent client replies
  const storageKey = `scripd_replies_store_${reviewID}`;
  const [localComments, setLocalComments] = useState<ReviewComment[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        setLocalComments(JSON.parse(cached));
      }
    } catch {
      // Safe fallback
    }
    setIsHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(localComments));
      } catch {
        // Safe ignore
      }
    }
  }, [localComments, storageKey, isHydrated]);

  // Combine backend comments with local comments (deduplicated by ID)
  const allComments = useMemo(() => {
    const backendItems = commentsQuery.data ?? [];
    const combined = [...localComments];
    for (const bComment of backendItems) {
      if (!combined.some((item) => item.id === bComment.id)) {
        combined.push(bComment);
      }
    }
    return combined;
  }, [commentsQuery.data, localComments]);

  // Notify parent of comment count safely without re-triggering loops
  const onCommentsCountChangeRef = useRef(onCommentsCountChange);
  useEffect(() => {
    onCommentsCountChangeRef.current = onCommentsCountChange;
  }, [onCommentsCountChange]);

  const lastReportedCount = useRef<number | null>(null);
  useEffect(() => {
    if (lastReportedCount.current !== allComments.length) {
      lastReportedCount.current = allComments.length;
      onCommentsCountChangeRef.current?.(allComments.length);
    }
  }, [allComments.length]);

  // Input draft state
  const [replyDraft, setReplyDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Expanded "See more" text state
  const [expandedCommentIds, setExpandedCommentIds] = useState<string[]>([]);
  function toggleSeeMore(commentId: string) {
    setExpandedCommentIds((prev) =>
      prev.includes(commentId)
        ? prev.filter((id) => id !== commentId)
        : [...prev, commentId],
    );
  }

  // Local like & reactions state per comment
  const [likedCommentIds, setLikedCommentIds] = useState<Record<string, boolean>>({});
  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({});
  const [commentReactions, setCommentReactions] = useState<Record<string, Reaction[]>>({});
  const replyInputRef = useRef<HTMLInputElement>(null);

  // Load cached comment likes and reactions
  useEffect(() => {
    try {
      const cachedLikes = localStorage.getItem(`scripd_replies_likes_${reviewID}`);
      if (cachedLikes) {
        const parsed = JSON.parse(cachedLikes);
        if (parsed.likedIds) setLikedCommentIds(parsed.likedIds);
        if (parsed.counts) setCommentLikes(parsed.counts);
      }
      const cachedReactions = localStorage.getItem(`scripd_replies_reactions_${reviewID}`);
      if (cachedReactions) {
        setCommentReactions(JSON.parse(cachedReactions));
      }
    } catch {
      // Safe fallback
    }
  }, [reviewID]);

  // Persist likes & reactions
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(
          `scripd_replies_likes_${reviewID}`,
          JSON.stringify({ likedIds: likedCommentIds, counts: commentLikes })
        );
      } catch {
        // Safe ignore
      }
    }
  }, [likedCommentIds, commentLikes, reviewID, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(
          `scripd_replies_reactions_${reviewID}`,
          JSON.stringify(commentReactions)
        );
      } catch {
        // Safe ignore
      }
    }
  }, [commentReactions, reviewID, isHydrated]);

  function handleToggleCommentLike(commentId: string) {
    setLikedCommentIds((prev) => {
      const currentlyLiked = Boolean(prev[commentId]);
      const nextLiked = !currentlyLiked;
      setCommentLikes((counts) => ({
        ...counts,
        [commentId]: Math.max(0, (counts[commentId] ?? 0) + (nextLiked ? 1 : -1)),
      }));
      return { ...prev, [commentId]: nextLiked };
    });
  }

  function handleCommentReactionsChange(commentId: string, next: Reaction[]) {
    const sanitized = next.filter((rx) => rx.id !== "like");
    setCommentReactions((prev) => ({
      ...prev,
      [commentId]: sanitized,
    }));
  }

  // Handle submitting a reply
  async function handleSubmitReply(e: React.FormEvent) {
    e.preventDefault();
    const text = replyDraft.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    const authorUsername = currentUser?.username || "Anuxragg";
    const authorDisplayName =
      currentUser?.display_name || currentUser?.username || "Anuxragg";
    const authorId =
      currentUser?.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `user_${Date.now()}`);

    const newLocalComment: ReviewComment = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`,
      review_id: reviewID,
      user_id: authorId,
      body: text,
      author: {
        id: authorId,
        username: authorUsername,
        display_name: authorDisplayName,
        avatar_url: userAvatar || "",
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isBackendUUID) {
      try {
        await createCommentMutation.mutateAsync(text);
        setReplyDraft("");
        setIsSubmitting(false);
        return;
      } catch {
        // Fall back to local state if backend API is offline
      }
    }

    setLocalComments((prev) => [newLocalComment, ...prev]);
    setReplyDraft("");
    setIsSubmitting(false);
  }

  // Handle deleting a reply
  async function handleDeleteComment(commentId: string) {
    if (isBackendUUID && !commentId.startsWith("local_")) {
      try {
        await deleteCommentMutation.mutateAsync(commentId);
      } catch {
        // ignore
      }
    }
    setLocalComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  const currentInitials = (currentUser?.display_name || currentUser?.username || "AP")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="pt-4 border-t border-white/10 space-y-4">
      {/* 1. Header Stats Line: e.g. "1 Like · 1 Reply" and Date */}
      <div className="flex items-center justify-between text-xs text-zinc-400 select-none px-1">
        <div className="flex items-center gap-2">
          <span>
            {likesCount} {likesCount === 1 ? "Like" : "Likes"}
          </span>
          <span>·</span>
          <span>
            {allComments.length} {allComments.length === 1 ? "Reply" : "Replies"}
          </span>
        </div>
        <span suppressHydrationWarning className="text-zinc-500">
          {formatFullDate(reviewCreatedAt)}
        </span>
      </div>

      <div className="border-t border-white/10" />

      {/* 2. "Leave a reply..." Input Box */}
      <form
        onSubmit={handleSubmitReply}
        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#12151c] px-4 py-2.5 transition focus-within:border-white/20 focus-within:bg-[#141822]"
      >
        {/* Current User Avatar */}
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#2a303c] border border-white/10 flex items-center justify-center text-xs font-bold text-white">
          {userAvatar ? (
            <Image
              src={userAvatar}
              alt="You"
              width={36}
              height={36}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{currentInitials}</span>
          )}
        </div>

        {/* Input */}
        <input
          ref={replyInputRef}
          type="text"
          value={replyDraft}
          onChange={(e) => setReplyDraft(e.target.value)}
          placeholder="Leave a reply…"
          className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
        />

        {/* Post Button */}
        {replyDraft.trim().length > 0 && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-bold text-black transition hover:bg-zinc-200 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Send className="h-3 w-3" />
            <span>Reply</span>
          </button>
        )}
      </form>

      {/* 3. Replied Comments List */}
      <div className="space-y-4 pt-1">
        {allComments.length === 0 ? (
          <div className="py-4 text-center text-xs text-zinc-500">
            No replies yet. Be the first to join the conversation.
          </div>
        ) : (
          allComments.map((comment) => {
            const isAuthor =
              currentUser &&
              comment.author.username.toLowerCase() ===
                currentUser.username.toLowerCase();
            const isLong = comment.body.length > 220;
            const isExpanded = expandedCommentIds.includes(comment.id);
            const displayText =
              isLong && !isExpanded
                ? `${comment.body.slice(0, 220)}…`
                : comment.body;

            const isLiked = Boolean(likedCommentIds[comment.id]);
            const likes = commentLikes[comment.id] ?? 0;

            const commentInitials = (comment.author.display_name || comment.author.username || "U")
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={comment.id}
                className="flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-white/[0.02]"
              >
                {/* Author Avatar */}
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#2a303c] border border-white/10 flex items-center justify-center text-xs font-bold text-white mt-0.5">
                  {comment.author.avatar_url ? (
                    <Image
                      src={comment.author.avatar_url}
                      alt={comment.author.display_name}
                      width={36}
                      height={36}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{commentInitials}</span>
                  )}
                </div>

                {/* Content Container */}
                <div className="flex-1 min-w-0">
                  {/* Top info row: Name, Handle, Date, and Options */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold text-white tracking-tight">
                        {comment.author.display_name || comment.author.username}
                      </span>
                      <span className="text-zinc-500 text-[11px]">
                        @{comment.author.username}
                      </span>
                      <span className="text-zinc-600">·</span>
                      <span
                        suppressHydrationWarning
                        className="text-zinc-500 text-[11px]"
                      >
                        {formatCommentDate(comment.created_at)}
                      </span>
                    </div>

                    {/* Actions on Top Right (··· and Delete/✕) */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="text-zinc-500 hover:text-zinc-300 p-1 transition rounded hover:bg-white/5 cursor-pointer"
                        title="More options"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                      {isAuthor ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-zinc-500 hover:text-rose-400 p-1 transition rounded hover:bg-white/5 cursor-pointer"
                          title="Delete reply"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-zinc-500 hover:text-zinc-300 p-1 transition rounded hover:bg-white/5 cursor-pointer"
                          title="Dismiss"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body Text */}
                  <p className="mt-1 text-sm text-zinc-200 leading-relaxed break-words whitespace-pre-wrap">
                    {displayText}
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => toggleSeeMore(comment.id)}
                        className="ml-1 text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
                      >
                        {isExpanded ? "Show less" : "See more"}
                      </button>
                    )}
                  </p>

                  {/* Action row matching the review up above: Thumbs Up pill, Reactions, Speech Bubble */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap select-none">
                    {/* Standalone Thumbs Up Pill Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleCommentLike(comment.id)}
                      className={`flex items-center gap-1.5 h-8 px-3 rounded-full border transition cursor-pointer select-none ${
                        isLiked
                          ? "bg-[#181d26] border-white/25 text-white shadow-sm"
                          : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20"
                      }`}
                      title={isLiked ? "Unlike" : "Like"}
                    >
                      <ThumbsUp
                        className={`h-4 w-4 ${
                          isLiked ? "fill-white text-white" : "text-zinc-400"
                        }`}
                        strokeWidth={isLiked ? 2 : 1.8}
                      />
                      {likes > 0 && (
                        <span
                          className={`tabular-nums text-xs ${
                            isLiked ? "font-bold text-white" : "font-medium text-zinc-400"
                          }`}
                        >
                          {likes}
                        </span>
                      )}
                    </button>

                    {/* Reaction Adding Button & Reaction Pills (Love, Fire, Celebrate, Laugh, Insightful) */}
                    <Reactions
                      options={COMMENT_REACTION_OPTIONS}
                      value={commentReactions[comment.id] ?? []}
                      onValueChange={(next) => handleCommentReactionsChange(comment.id, next)}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
