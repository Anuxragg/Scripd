Catalog rules, Open Library integration, and metadata caching orchestration. Unit tests should use HTTP/cache/repository interfaces.
# Book service

The service validates and normalizes search input, calls the provider, persists each imported work, and returns Scripd catalog records with stable UUIDs. When Open Library is unavailable it searches previously imported books in PostgreSQL and marks the response source as `local_catalog`. Pagination is bounded to limit upstream and database work.
