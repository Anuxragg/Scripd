HTTP transport for catalog/search endpoints. Validate request shape here and delegate external data behavior to services.
# Book HTTP handler

Public routes:

- `GET /api/v1/books/search?q=...&page=1&limit=12` searches the provider and imports returned works.
- `GET /api/v1/books/{bookID}` reads an imported catalog record from PostgreSQL.

Search inputs are bounded and rate-limited. API errors use the shared error envelope; local-catalog fallback is reported through `meta.source`.
