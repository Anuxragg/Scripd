"use client";

import Image from "next/image";
import { useState } from "react";
import type { Review, ReviewComment } from "@/features/reviews/api";
import {
  useReviewSocial,
  useLikeReview,
  useUnlikeReview,
  useReviewComments,
  useCreateComment,
  useDeleteComment,
} from "@/features/reviews/hooks";

type ReviewCardProps = {
  review: Review;
  currentUserID?: string;
  onDelete?: (reviewID: string) => void;
};

export function ReviewCard({ review, currentUserID, onDelete }: ReviewCardProps) {
  const [revealed, setRevealed] = useState(!review.contains_spoilers);
  const [showComments, setShowComments] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const isAuthor = Boolean(currentUserID && review.user_id === currentUserID);

  const socialQuery = useReviewSocial(review.id);
  const likeMutation = useLikeReview(review.id);
  const unlikeMutation = useUnlikeReview(review.id);
  const commentsQuery = useReviewComments(review.id, showComments);
  const createCommentMutation = useCreateComment(review.id);
  const deleteCommentMutation = useDeleteComment(review.id);

  const isLiked = socialQuery.data?.is_liked ?? false;
  const likesCount = socialQuery.data?.likes_count ?? 0;
  const commentsCount = socialQuery.data?.comments_count ?? 0;
  const isLikePending = likeMutation.isPending || unlikeMutation.isPending;

  async function handleToggleLike() {
    if (!currentUserID) {
      window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (isLiked) {
      await unlikeMutation.mutateAsync();
    } else {
      await likeMutation.mutateAsync();
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await createCommentMutation.mutateAsync(commentBody.trim());
    setCommentBody("");
  }

  const formattedDate = new Date(review.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const authorName = review.author.display_name || review.author.username;
  const initial = authorName.charAt(0).toUpperCase();

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6 transition hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {review.author.avatar_url ? (
            <Image
              src={review.author.avatar_url}
              alt={authorName}
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 rounded-full object-cover border border-[var(--line)]"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--forest-tint)] font-semibold text-[var(--forest)] text-sm">
              {initial}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--ink)] text-sm">{authorName}</span>
              <span className="text-xs text-[var(--muted)]">@{review.author.username}</span>
            </div>
            <time className="text-xs text-[var(--muted)]" dateTime={review.created_at}>
              {formattedDate}
            </time>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {typeof review.rating === "number" && (
            <div className="flex items-center gap-1 rounded-full bg-[var(--gold-tint,#fef9c3)] px-2.5 py-1 text-xs font-bold text-[var(--gold,#ca8a04)]">
              <span>★</span>
              <span>{review.rating.toFixed(1)}</span>
            </div>
          )}
          {isAuthor && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(review.id)}
              className="text-xs text-[var(--muted)] hover:text-red-600 transition p-1"
              title="Delete review"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        {review.contains_spoilers && !revealed ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-center">
            <p className="text-sm font-medium text-amber-800">⚠️ Contains spoilers</p>
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-2 inline-block rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              Click to reveal review
            </button>
          </div>
        ) : (
          <div>
            {review.contains_spoilers && (
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                  Spoiler
                </span>
                <button
                  type="button"
                  onClick={() => setRevealed(false)}
                  className="text-xs text-[var(--muted)] hover:underline"
                >
                  Hide spoilers
                </button>
              </div>
            )}
            <p className="whitespace-pre-line text-sm leading-6 text-[var(--ink)] font-normal">
              {review.body}
            </p>
          </div>
        )}
      </div>

      {/* Social Actions (Like & Comments) */}
      <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3 text-xs">
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={isLikePending}
            onClick={handleToggleLike}
            className={`flex items-center gap-1.5 font-semibold transition ${
              isLiked
                ? "text-rose-600 hover:text-rose-700"
                : "text-[var(--muted)] hover:text-rose-600"
            }`}
          >
            <span>{isLiked ? "♥" : "♡"}</span>
            <span>
              {likesCount} {likesCount === 1 ? "Like" : "Likes"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition"
          >
            <span>💬</span>
            <span>
              {commentsCount} {commentsCount === 1 ? "Comment" : "Comments"}
            </span>
          </button>
        </div>
      </div>

      {/* Expanded Comments Section */}
      {showComments && (
        <div className="mt-4 space-y-3 rounded-2xl bg-[var(--background)] p-4 border border-[var(--line)]">
          {commentsQuery.isLoading ? (
            <p className="text-xs text-[var(--muted)] animate-pulse">Loading comments...</p>
          ) : (commentsQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-[var(--muted)] italic">
              No comments yet. Be the first to share your thoughts!
            </p>
          ) : (
            <div className="space-y-3">
              {(commentsQuery.data ?? []).map((c: ReviewComment) => {
                const canDelete = currentUserID === c.user_id || currentUserID === review.user_id;
                return (
                  <div key={c.id} className="flex items-start justify-between gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-[var(--ink)]">
                        {c.author.display_name || c.author.username}
                      </span>{" "}
                      <span className="text-[var(--muted)]">@{c.author.username}</span>
                      <p className="mt-0.5 text-sm text-[var(--ink)] leading-relaxed whitespace-pre-line">
                        {c.body}
                      </p>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => deleteCommentMutation.mutate(c.id)}
                        className="text-[11px] text-[var(--muted)] hover:text-red-600 transition"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Post Comment Input */}
          {currentUserID ? (
            <form
              onSubmit={handleAddComment}
              className="mt-3 flex gap-2 pt-2 border-t border-[var(--line)]"
            >
              <input
                type="text"
                placeholder="Write a comment..."
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                maxLength={2000}
                className="flex-1 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--forest)]"
              />
              <button
                type="submit"
                disabled={!commentBody.trim() || createCommentMutation.isPending}
                className="rounded-full bg-[var(--forest)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 transition"
              >
                Post
              </button>
            </form>
          ) : (
            <p className="pt-2 text-[11px] text-[var(--muted)] border-t border-[var(--line)]">
              <a href="/login" className="underline hover:text-[var(--forest)]">
                Sign in
              </a>{" "}
              to leave a comment.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
