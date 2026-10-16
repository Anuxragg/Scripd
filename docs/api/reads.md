# Reading diary API

Reading entries are private to the signed-in member. All routes use the `/api/v1` prefix, the standard response envelope, and the `scripd_access` cookie. Write routes reject browser `Origin` headers outside `CORS_ALLOWED_ORIGINS` and enforce a process-local rate limit.

## Statuses and entry rules

- `want_to_read`: no dates or rating.
- `reading`: has a start date and no finish date or rating. If a start date is omitted, the server records the current time.
- `read`: has a finish date. Start date and a half-star rating from 0.5 through 5 are optional. If a finish date is omitted, the server records the current time.
- `did_not_finish`: has a finish date, with an optional start date and rating. If a finish date is omitted, the server records the current time.

Dates are ISO 8601 timestamps and cannot be more than 24 hours in the future. Notes are private, trimmed, and limited to 2,000 Unicode characters. A member can keep one active `want_to_read` or `reading` entry for a given book and can create multiple finished entries to record rereads.

## `GET /api/v1/reads`

Lists only the signed-in member's entries. Optional query parameters are `status`, `book_id`, `limit` (default 12, maximum 50), and the opaque `cursor` returned by the previous page. Results are ordered by creation time and ID descending. The envelope's `meta` contains `next_cursor` and `has_more`.

## `POST /api/v1/reads`

Creates an entry and returns `201`.

```json
{
  "book_id": "7f5d77f1-452a-4f78-b69f-a9c32a7a5d32",
  "status": "read",
  "rating": 4.5,
  "started_at": "2026-09-01T12:00:00Z",
  "finished_at": "2026-09-14T12:00:00Z",
  "notes": "Private note for my next reread."
}
```

## `GET /api/v1/reads/{entryID}`

Returns one entry owned by the signed-in member. Entries owned by another member return the same `404 not_found` response as missing entries.

## `PUT /api/v1/reads/{entryID}`

Replaces an entry's status, dates, rating, and notes. A missing note clears it. The API uses the entry's current `updated_at` as an optimistic concurrency version and returns `409 read_conflict` if another request changed it first.

## `DELETE /api/v1/reads/{entryID}`

Deletes an entry owned by the signed-in member and returns `{ "deleted": true }`. An entry owned by someone else returns `404 not_found`.

Invalid input returns `400 invalid_request`; a nonexistent catalog book returns `404 book_not_found`; duplicate active shelf entries return `409 book_already_active`. Unexpected failures return a generic `500 internal_error` with a request ID.
