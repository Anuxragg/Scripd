import { z } from "zod";
import { apiRequest } from "@/lib/api/client";

export const readStatuses = ["want_to_read", "reading", "read", "did_not_finish"] as const;
export type ReadStatus = (typeof readStatuses)[number];

const bookSummarySchema = z.object({
  id: z.string().uuid(),
  open_library_key: z.string().optional(),
  title: z.string(),
  authors: z.array(z.string()),
  cover_url: z.url().optional(),
  published_year: z.number().int().optional(),
  open_library_url: z.url().optional(),
});

const readEntrySchema = z.object({
  id: z.string().uuid(),
  book_id: z.string().uuid(),
  status: z.enum(readStatuses),
  rating: z.number().min(0.5).max(5).optional(),
  started_at: z.iso.datetime().optional(),
  finished_at: z.iso.datetime().optional(),
  notes: z.string().optional(),
  book: bookSummarySchema,
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

const listResponseSchema = z.object({
  data: z.array(readEntrySchema),
  meta: z.object({
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

const entryResponseSchema = z.object({ data: readEntrySchema });
const deleteResponseSchema = z.object({ data: z.object({ deleted: z.boolean() }) });

export type ReadEntry = z.infer<typeof readEntrySchema>;
export type ReadPage = z.infer<typeof listResponseSchema>;

export type ReadInput = {
  status: ReadStatus;
  rating?: number;
  started_at?: string;
  finished_at?: string;
  notes?: string;
};

export type CreateReadInput = ReadInput & { book_id: string };

export type ReadFilter = {
  status?: ReadStatus | "";
  bookID?: string;
  limit?: number;
};

export async function listReads(filter: ReadFilter, cursor?: string): Promise<ReadPage> {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.bookID) params.set("book_id", filter.bookID);
  params.set("limit", String(filter.limit ?? 12));
  if (cursor) params.set("cursor", cursor);
  return apiRequest(`/api/v1/reads?${params}`, listResponseSchema);
}

export async function createRead(input: CreateReadInput): Promise<ReadEntry> {
  const response = await apiRequest(
    "/api/v1/reads",
    entryResponseSchema,
    jsonRequest("POST", input),
  );
  return response.data;
}

export async function updateRead(entryID: string, input: ReadInput): Promise<ReadEntry> {
  const response = await apiRequest(
    `/api/v1/reads/${entryID}`,
    entryResponseSchema,
    jsonRequest("PUT", input),
  );
  return response.data;
}

export async function deleteRead(entryID: string): Promise<void> {
  await apiRequest(`/api/v1/reads/${entryID}`, deleteResponseSchema, { method: "DELETE" });
}

function jsonRequest(method: "POST" | "PUT", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
