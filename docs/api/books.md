# Book catalog API

All routes use the `/api/v1` prefix and the standard Scripd response envelope.

## Search

`GET /api/v1/books/search?q={query}&page=1&limit=12`

- `q` is required and must contain 2–120 characters after whitespace normalization.
- `page` defaults to 1 and is bounded to 1–1000.
- `limit` defaults to 12 and is bounded to 1–20.
- Each search and detail request has a 10-second deadline; Open Library calls have a tighter 4-second timeout.
- Search results are imported/upserted into PostgreSQL before being returned.
- `meta` includes `page`, `limit`, `total`, `has_more`, and `source` (`open_library` or `local_catalog`).
- If Open Library is unavailable, Scripd searches previously imported works in PostgreSQL. If neither source can answer, the API returns `503 catalog_unavailable` with `Retry-After`.

## Book detail

`GET /api/v1/books/{bookID}` reads a previously imported book by its Scripd UUID. Detail reads do not depend on Open Library availability.

## Errors

Invalid pagination or query input returns `400 invalid_request`. Missing catalog records return `404 not_found`. Unexpected failures use the standard internal error envelope with a request ID.

## Attribution

Open Library supplies imported work metadata and cover URLs. Book details include a link back to the corresponding Open Library work page; cover images are served by Open Library's Covers API.
