Book catalog persistence adapters and SQLC calls. Repository integration tests should use PostgreSQL testcontainers.
# Book repository

The PostgreSQL adapter stores normalized Open Library works in the canonical catalog. Work IDs are the primary provider key; imports use an upsert so repeated searches refresh metadata without creating duplicate books. An edition ISBN-13 is retained when unique, and a collision does not discard the catalog work.

The full-text GIN index supports local search during an Open Library outage. Book detail reads are served only from PostgreSQL after import, so an upstream outage does not invalidate catalog URLs.
