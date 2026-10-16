import { z } from "zod";

const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    request_id: z.string().optional(),
  }),
});

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    credentials: "include",
    headers,
  });

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(body);
    throw new ApiError(
      parsedError.success ? parsedError.data.error.message : "Request failed",
      response.status,
      parsedError.success ? parsedError.data.error.code : "request_failed",
      parsedError.success ? parsedError.data.error.request_id : undefined,
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      "The server returned an unexpected response",
      response.status,
      "invalid_response",
    );
  }
  return parsed.data;
}
