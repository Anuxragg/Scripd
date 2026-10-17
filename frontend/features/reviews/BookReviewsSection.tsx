"use client";

import { useMemo } from "react";
import { useCurrentUser } from "@/features/auth/hooks";
import { useReadEntries } from "@/features/reads/hooks";
import { useBookReviews, useDeleteReview } from "@/features/reviews/hooks";
import { ReviewCard } from "@/features/reviews/ReviewCard";
import { ReviewForm } from "@/features/reviews/ReviewForm";

export function BookReviewsSection({ bookID }: { bookID: string }) {
  const userQuery = useCurrentUser();
  const currentUserID = userQuery.data?.id;

  const reviewsQuery = useBookReviews(bookID);
  const deleteMutation = useDeleteReview(bookID);

  // Check if current user has an entry for this book
  const entriesQuery = useReadEntries({ bookID, limit: 10 }, Boolean(currentUserID));
  const userEntry = useMemo(
    () => entriesQuery.data?.pages.flatMap((page) => page.data)[0],
    [entriesQuery.data],
  );

  const allReviews = useMemo(
    () => reviewsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [reviewsQuery.data],
  );

  const userReview = useMemo(
    () => (currentUserID ? allReviews.find((r) => r.user_id === currentUserID) : undefined),
    [allReviews, currentUserID],
  );

  return (
    <section className="mt-12 max-w-2xl border-t border-[var(--line)] pt-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Community</p>
          <h2 className="mt-1 font-serif text-2xl text-[var(--ink)]">Reader Reviews</h2>
        </div>
        {allReviews.length > 0 && (
          <span className="rounded-full bg-[var(--surface,#f5f5f4)] border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
            {allReviews.length} {allReviews.length === 1 ? "review" : "reviews"}
          </span>
        )}
      </div>

      {/* Review Form: Only show if user is logged in, has a reading entry, and hasn't reviewed yet */}
      {currentUserID && userEntry && !userReview && (
        <div className="mt-6">
          <ReviewForm readID={userEntry.id} bookID={bookID} />
        </div>
      )}

      {/* Reviews List */}
      <div className="mt-6 space-y-4">
        {reviewsQuery.isPending ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-[var(--line)] bg-white p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#e9e6df]" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 rounded bg-[#e9e6df]" />
                    <div className="h-3 w-16 rounded bg-[#e9e6df]" />
                  </div>
                </div>
                <div className="mt-4 h-12 rounded bg-[#e9e6df]" />
              </div>
            ))}
          </div>
        ) : reviewsQuery.isError ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">
            We couldn’t load community reviews. Refresh the page to try again.
          </div>
        ) : allReviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center">
            <p className="font-serif text-lg text-[var(--ink)]">No reviews yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {currentUserID && !userEntry
                ? "Add this book to your reading diary above to leave a review!"
                : "Be the first reader to share your thoughts on this book."}
            </p>
          </div>
        ) : (
          allReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserID={currentUserID}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))
        )}

        {reviewsQuery.hasNextPage && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => reviewsQuery.fetchNextPage()}
              disabled={reviewsQuery.isFetchingNextPage}
              className="rounded-full border border-[var(--line)] bg-white px-5 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--forest)] hover:text-[var(--forest)] disabled:opacity-50"
            >
              {reviewsQuery.isFetchingNextPage ? "Loading more…" : "Load more reviews"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
