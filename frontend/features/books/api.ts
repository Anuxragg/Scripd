import { z } from "zod";
import { apiRequest } from "@/lib/api/client";

const bookSchema = z.object({
  id: z.string().uuid(),
  open_library_key: z.string(),
  isbn13: z.string().optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  authors: z.array(z.string()),
  cover_url: z.url().optional(),
  published_year: z.number().int().optional(),
  description: z.string().optional(),
  open_library_url: z.url(),
  metadata_synced_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const searchResponseSchema = z.object({
  data: z.array(bookSchema).nullish().transform((val) => val ?? []),
  meta: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    has_more: z.boolean(),
    source: z.enum(["open_library", "local_catalog"]),
  }),
});

const bookResponseSchema = z.object({
  data: bookSchema,
  meta: z.record(z.string(), z.unknown()),
});

export type Book = z.infer<typeof bookSchema>;
export type BookSearchResult = z.infer<typeof searchResponseSchema>;

export function searchBooks(query: string, page: number, limit = 12): Promise<BookSearchResult> {
  const params = new URLSearchParams({ q: query, page: String(page), limit: String(limit) });
  return apiRequest(`/api/v1/books/search?${params}`, searchResponseSchema);
}

export async function getBook(bookID: string): Promise<Book> {
  const response = await apiRequest(`/api/v1/books/${bookID}`, bookResponseSchema);
  return response.data;
}
