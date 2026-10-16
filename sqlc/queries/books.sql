-- name: GetBookByID :one
SELECT id, open_library_key, isbn13, title, subtitle, authors, cover_url, published_year,
       description, raw_metadata, metadata_synced_at, created_at, updated_at
FROM books
WHERE id = $1;

-- name: GetBookByOpenLibraryKey :one
SELECT id, open_library_key, isbn13, title, subtitle, authors, cover_url, published_year,
       description, raw_metadata, metadata_synced_at, created_at, updated_at
FROM books
WHERE open_library_key = $1;

-- name: SearchBooksLocally :many
SELECT id, open_library_key, isbn13, title, subtitle, authors, cover_url, published_year,
       description, raw_metadata, metadata_synced_at, created_at, updated_at
FROM books
WHERE to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(books_authors_search_text(authors), ''))
      @@ plainto_tsquery('simple', $1)
ORDER BY ts_rank(
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(books_authors_search_text(authors), '')),
    plainto_tsquery('simple', $1)
) DESC, lower(title), id
LIMIT $2 OFFSET $3;
