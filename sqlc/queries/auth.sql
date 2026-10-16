-- name: CreateAuthUser :one
INSERT INTO users (username, email, password_hash, display_name)
VALUES ($1, $2, $3, NULLIF($4, ''))
RETURNING id, username, email, display_name, password_hash, created_at, updated_at;

-- name: GetAuthUserByIdentifier :one
SELECT id, username, email, display_name, password_hash, created_at, updated_at
FROM users
WHERE lower(username) = lower($1) OR lower(email) = lower($1)
LIMIT 1;

-- name: GetAuthUserByID :one
SELECT id, username, email, display_name, password_hash, created_at, updated_at
FROM users
WHERE id = $1;

-- name: GetAuthUserForSession :one
SELECT u.id, u.username, u.email, u.display_name, u.created_at, u.updated_at
FROM users u
JOIN auth_sessions s ON s.user_id = u.id
WHERE u.id = $1 AND s.id = $2 AND s.revoked_at IS NULL AND s.expires_at > now();

-- name: CreateAuthSession :one
INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING id;

-- name: RotateAuthSession :one
UPDATE auth_sessions
SET refresh_token_hash = $3, expires_at = $4, last_used_at = now()
WHERE id = $1 AND refresh_token_hash = $2
  AND revoked_at IS NULL
  AND expires_at > now()
RETURNING id, user_id;

-- name: RevokeAuthSession :exec
UPDATE auth_sessions
SET revoked_at = now()
WHERE id = $1 AND refresh_token_hash = $2 AND revoked_at IS NULL;
