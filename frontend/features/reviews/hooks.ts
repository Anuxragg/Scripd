"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createReview,
  deleteReview,
  getReviewForRead,
  listReviewsByBook,
  updateReview,
  getReviewSocialStats,
  likeReview,
  unlikeReview,
  listComments,
  createComment,
  deleteComment,
  type CreateReviewInput,
  type UpdateReviewInput,
} from "@/features/reviews/api";

export function useBookReviews(bookID: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["reviews", "book", bookID],
    queryFn: ({ pageParam }) => listReviewsByBook(bookID, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.next_cursor ?? undefined,
    enabled: Boolean(bookID) && enabled,
    staleTime: 30_000,
  });
}

export function useReadReview(readID: string, enabled = true) {
  return useQuery({
    queryKey: ["reviews", "read", readID],
    queryFn: () => getReviewForRead(readID),
    enabled: Boolean(readID) && enabled,
    staleTime: 30_000,
  });
}

export function useCreateReview(bookID?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) => createReview(input),
    onSuccess: () => {
      if (bookID) {
        queryClient.invalidateQueries({ queryKey: ["reviews", "book", bookID] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["reviews"] });
      }
    },
  });
}

export function useUpdateReview(bookID?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewID, input }: { reviewID: string; input: UpdateReviewInput }) =>
      updateReview(reviewID, input),
    onSuccess: () => {
      if (bookID) {
        queryClient.invalidateQueries({ queryKey: ["reviews", "book", bookID] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["reviews"] });
      }
    },
  });
}

export function useDeleteReview(bookID?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewID: string) => deleteReview(reviewID),
    onSuccess: () => {
      if (bookID) {
        queryClient.invalidateQueries({ queryKey: ["reviews", "book", bookID] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["reviews"] });
      }
    },
  });
}

export function useReviewSocial(reviewID: string, enabled = true) {
  return useQuery({
    queryKey: ["reviews", "social", reviewID],
    queryFn: () => getReviewSocialStats(reviewID),
    enabled: Boolean(reviewID) && enabled,
    staleTime: 15_000,
  });
}

export function useLikeReview(reviewID: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => likeReview(reviewID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", "social", reviewID] });
    },
  });
}

export function useUnlikeReview(reviewID: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unlikeReview(reviewID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", "social", reviewID] });
    },
  });
}

export function useReviewComments(reviewID: string, enabled = true) {
  return useQuery({
    queryKey: ["reviews", "comments", reviewID],
    queryFn: () => listComments(reviewID),
    enabled: Boolean(reviewID) && enabled,
    staleTime: 15_000,
  });
}

export function useCreateComment(reviewID: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => createComment(reviewID, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", "comments", reviewID] });
      queryClient.invalidateQueries({ queryKey: ["reviews", "social", reviewID] });
    },
  });
}

export function useDeleteComment(reviewID: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentID: string) => deleteComment(reviewID, commentID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", "comments", reviewID] });
      queryClient.invalidateQueries({ queryKey: ["reviews", "social", reviewID] });
    },
  });
}
