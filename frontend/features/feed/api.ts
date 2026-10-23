import { z } from "zod";
import { apiRequest } from "@/lib/api/client";

export const feedUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string(),
});

export const feedBookSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  authors: z.array(z.string()).default([]),
  cover_url: z.string().default(""),
  published_year: z.number().int().nullable().optional(),
});

export const feedReviewSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  contains_spoilers: z.boolean(),
});

export const feedItemSchema = z.object({
  id: z.string().uuid(),
  user: feedUserSchema,
  book: feedBookSchema,
  status: z.enum(["want_to_read", "reading", "read", "did_not_finish"]),
  rating: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  review: feedReviewSchema.nullable().optional(),
  created_at: z.string(),
});

export const feedResponseSchema = z.object({
  data: z
    .array(feedItemSchema)
    .nullish()
    .transform((val) => val ?? []),
  meta: z.object({
    next_cursor: z.string().nullable().optional(),
    has_more: z.boolean(),
  }),
});

export type FeedUser = z.infer<typeof feedUserSchema>;
export type FeedBook = z.infer<typeof feedBookSchema>;
export type FeedReview = z.infer<typeof feedReviewSchema>;
export type FeedItem = z.infer<typeof feedItemSchema>;
export type FeedPage = {
  items: FeedItem[];
  nextCursor?: string | null;
  hasMore: boolean;
};

export async function getFeed(cursor?: string, limit = 20): Promise<FeedPage> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);

  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await apiRequest(`/api/v1/feed${query}`, feedResponseSchema);
  return {
    items: response.data,
    nextCursor: response.meta.next_cursor,
    hasMore: response.meta.has_more,
  };
}
