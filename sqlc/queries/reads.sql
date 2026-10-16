-- name: GetReadByID :one
SELECT r.id, r.user_id, r.book_id, r.status, r.rating, r.started_at, r.finished_at,
       r.notes, r.created_at, r.updated_at, b.title, b.authors, b.cover_url, b.published_year,
       b.open_library_key
FROM reads AS r
JOIN books AS b ON b.id = r.book_id
WHERE r.id = sqlc.arg(entry_id)
  AND r.user_id = sqlc.arg(user_id);

-- name: ListReadsByUser :many
SELECT r.id, r.user_id, r.book_id, r.status, r.rating, r.started_at, r.finished_at,
       r.notes, r.created_at, r.updated_at, b.title, b.authors, b.cover_url, b.published_year,
       b.open_library_key
FROM reads AS r
JOIN books AS b ON b.id = r.book_id
WHERE r.user_id = sqlc.arg(user_id)
  AND (sqlc.narg(status)::text IS NULL OR r.status = sqlc.narg(status)::text)
  AND (sqlc.narg(book_id)::uuid IS NULL OR r.book_id = sqlc.narg(book_id)::uuid)
  AND (
    sqlc.narg(cursor_created_at)::timestamptz IS NULL
    OR (r.created_at, r.id) < (sqlc.narg(cursor_created_at)::timestamptz, sqlc.narg(cursor_id)::uuid)
  )
ORDER BY r.created_at DESC, r.id DESC
LIMIT sqlc.arg(page_size);

-- name: CreateRead :one
INSERT INTO reads (user_id, book_id, status, rating, started_at, finished_at, notes)
VALUES (
    sqlc.arg(user_id), sqlc.arg(book_id), sqlc.arg(status), sqlc.narg(rating),
    sqlc.narg(started_at), sqlc.narg(finished_at), sqlc.narg(notes)
)
RETURNING id;

-- name: UpdateRead :one
UPDATE reads
SET status = sqlc.arg(status),
    rating = sqlc.narg(rating),
    started_at = sqlc.narg(started_at),
    finished_at = sqlc.narg(finished_at),
    notes = sqlc.narg(notes),
    updated_at = GREATEST(clock_timestamp(), updated_at + interval '1 microsecond')
WHERE id = sqlc.arg(entry_id)
  AND user_id = sqlc.arg(user_id)
  AND updated_at = sqlc.arg(expected_updated_at)
RETURNING id;

-- name: DeleteRead :execrows
DELETE FROM reads
WHERE id = sqlc.arg(entry_id)
  AND user_id = sqlc.arg(user_id);
