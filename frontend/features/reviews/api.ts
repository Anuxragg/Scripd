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
  data: z.array(reviewSchema),
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

export async function listReviewsByBook(bookID: string, cursor?: string, limit = 20): Promise<ReviewPage> {
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
