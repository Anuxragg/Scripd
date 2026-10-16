-- name: GetUserByID :one
SELECT id, username, email, display_name, bio, avatar_url, password_hash, created_at, updated_at
FROM users
WHERE id = $1;

-- name: GetUserByUsername :one
SELECT id, username, email, display_name, bio, avatar_url, password_hash, created_at, updated_at
FROM users
WHERE username = $1;
