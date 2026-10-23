import { z } from "zod";
import { apiRequest } from "@/lib/api/client";

const authorSummarySchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
});

export const reviewSchema = z.object({
  id: z.string().uuid(),
  read_id: z.string().uuid(),
  user_id: z.string().uuid(),
  book_id: z.string().uuid(),
  body: z.string(),
  contains_spoilers: z.boolean(),
  rating: z.number().nullable().optional(),
  author: authorSummarySchema,
  created_at: z.string(),
  updated_at: z.string(),
});

const reviewResponseSchema = z.object({
  data: reviewSchema,
});

const reviewListResponseSchema = z.object({
  data: z
    .array(reviewSchema)
    .nullish()
    .transform((val) => val ?? []),
  meta: z.object({
    next_cursor: z.string().nullable().optional(),
    has_more: z.boolean(),
  }),
});

const deleteResponseSchema = z.object({
  data: z.object({ deleted: z.boolean() }),
});

export type Review = z.infer<typeof reviewSchema>;
export type ReviewPage = z.infer<typeof reviewListResponseSchema>;

export type CreateReviewInput = {
  read_id: string;
  body: string;
  contains_spoilers?: boolean;
};

export type UpdateReviewInput = {
  body: string;
  contains_spoilers?: boolean;
};

export async function createReview(input: CreateReviewInput): Promise<Review> {
  const response = await apiRequest("/api/v1/reviews", reviewResponseSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function getReview(reviewID: string): Promise<Review> {
  const response = await apiRequest(`/api/v1/reviews/${reviewID}`, reviewResponseSchema);
  return response.data;
}

export async function getReviewForRead(readID: string): Promise<Review | null> {
  try {
    const response = await apiRequest(`/api/v1/reads/${readID}/review`, reviewResponseSchema);
    return response.data;
  } catch {
    return null;
  }
}

export async function listReviewsByBook(
  bookID: string,
  cursor?: string,
  limit = 20,
): Promise<ReviewPage> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/api/v1/books/${bookID}/reviews${query}`, reviewListResponseSchema);
}

export async function updateReview(reviewID: string, input: UpdateReviewInput): Promise<Review> {
  const response = await apiRequest(`/api/v1/reviews/${reviewID}`, reviewResponseSchema, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function deleteReview(reviewID: string): Promise<boolean> {
  const response = await apiRequest(`/api/v1/reviews/${reviewID}`, deleteResponseSchema, {
    method: "DELETE",
  });
  return response.data.deleted;
}

export const commentAuthorSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string().default(""),
  avatar_url: z.string().default(""),
});

export const commentSchema = z.object({
  id: z.string().uuid(),
  review_id: z.string().uuid(),
  user_id: z.string().uuid(),
  body: z.string(),
  author: commentAuthorSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const reviewSocialStatsSchema = z.object({
  review_id: z.string().uuid(),
  likes_count: z.number().int(),
  comments_count: z.number().int(),
  is_liked: z.boolean(),
});

const commentsListResponseSchema = z.object({
  data: z.array(commentSchema),
});

const singleCommentResponseSchema = z.object({
  data: commentSchema,
});

const socialStatsResponseSchema = z.object({
  data: reviewSocialStatsSchema,
});

const likeResponseSchema = z.object({
  data: z.object({ liked: z.boolean() }),
});

export type ReviewComment = z.infer<typeof commentSchema>;
export type ReviewSocialStats = z.infer<typeof reviewSocialStatsSchema>;

export async function getReviewSocialStats(reviewID: string): Promise<ReviewSocialStats> {
  const response = await apiRequest(
    `/api/v1/reviews/${reviewID}/social`,
    socialStatsResponseSchema,
  );
  return response.data;
}

export async function likeReview(reviewID: string): Promise<boolean> {
  const response = await apiRequest(`/api/v1/reviews/${reviewID}/like`, likeResponseSchema, {
    method: "POST",
  });
  return response.data.liked;
}

export async function unlikeReview(reviewID: string): Promise<boolean> {
  const response = await apiRequest(`/api/v1/reviews/${reviewID}/like`, likeResponseSchema, {
    method: "DELETE",
  });
  return response.data.liked;
}

export async function listComments(reviewID: string): Promise<ReviewComment[]> {
  const response = await apiRequest(
    `/api/v1/reviews/${reviewID}/comments`,
    commentsListResponseSchema,
  );
  return response.data;
}

export async function createComment(reviewID: string, body: string): Promise<ReviewComment> {
  const response = await apiRequest(
    `/api/v1/reviews/${reviewID}/comments`,
    singleCommentResponseSchema,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  return response.data;
}

export async function deleteComment(reviewID: string, commentID: string): Promise<boolean> {
  const response = await apiRequest(
    `/api/v1/reviews/${reviewID}/comments/${commentID}`,
    deleteResponseSchema,
    {
      method: "DELETE",
    },
  );
  return response.data.deleted;
}
