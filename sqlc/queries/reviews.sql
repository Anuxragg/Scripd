-- name: GetReviewByID :one
SELECT r.id, r.read_id, r.user_id, r.book_id, r.body, r.contains_spoilers,
       r.created_at, r.updated_at,
       u.username, u.display_name, u.avatar_url,
       rd.rating,
       b.title, b.authors, b.cover_url
FROM reviews AS r
JOIN users AS u ON u.id = r.user_id
JOIN reads AS rd ON rd.id = r.read_id
JOIN books AS b ON b.id = r.book_id
WHERE r.id = sqlc.arg(id);

-- name: GetReviewByReadID :one
SELECT r.id, r.read_id, r.user_id, r.book_id, r.body, r.contains_spoilers,
       r.created_at, r.updated_at,
       u.username, u.display_name, u.avatar_url,
       rd.rating,
       b.title, b.authors, b.cover_url
FROM reviews AS r
JOIN users AS u ON u.id = r.user_id
JOIN reads AS rd ON rd.id = r.read_id
JOIN books AS b ON b.id = r.book_id
WHERE r.read_id = sqlc.arg(read_id);

-- name: ListReviewsByBook :many
SELECT r.id, r.read_id, r.user_id, r.book_id, r.body, r.contains_spoilers,
       r.created_at, r.updated_at,
       u.username, u.display_name, u.avatar_url,
       rd.rating
FROM reviews AS r
JOIN users AS u ON u.id = r.user_id
JOIN reads AS rd ON rd.id = r.read_id
WHERE r.book_id = sqlc.arg(book_id)
  AND (
    sqlc.narg(cursor_created_at)::timestamptz IS NULL
    OR (r.created_at, r.id) < (sqlc.narg(cursor_created_at)::timestamptz, sqlc.narg(cursor_id)::uuid)
  )
ORDER BY r.created_at DESC, r.id DESC
LIMIT sqlc.arg(page_size);

-- name: ListReviewsByUser :many
SELECT r.id, r.read_id, r.user_id, r.book_id, r.body, r.contains_spoilers,
       r.created_at, r.updated_at,
       rd.rating,
       b.title, b.authors, b.cover_url
FROM reviews AS r
JOIN reads AS rd ON rd.id = r.read_id
JOIN books AS b ON b.id = r.book_id
WHERE r.user_id = sqlc.arg(user_id)
  AND (
    sqlc.narg(cursor_created_at)::timestamptz IS NULL
    OR (r.created_at, r.id) < (sqlc.narg(cursor_created_at)::timestamptz, sqlc.narg(cursor_id)::uuid)
  )
ORDER BY r.created_at DESC, r.id DESC
LIMIT sqlc.arg(page_size);

-- name: CreateReview :one
INSERT INTO reviews (read_id, user_id, book_id, body, contains_spoilers)
VALUES (sqlc.arg(read_id), sqlc.arg(user_id), sqlc.arg(book_id), sqlc.arg(body), sqlc.arg(contains_spoilers))
RETURNING id, created_at, updated_at;

-- name: UpdateReview :one
UPDATE reviews
SET body = sqlc.arg(body),
    contains_spoilers = sqlc.arg(contains_spoilers),
    updated_at = now()
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id)
RETURNING updated_at;

-- name: DeleteReview :exec
DELETE FROM reviews
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);
