# Authentication API

All routes use the standard JSON response envelope and live under `/api/v1/auth`.

## `POST /register`

Request:

```json
{
  "username": "reader_1",
  "email": "reader@example.com",
  "display_name": "A Reader",
  "password": "at least twelve characters"
}
```

`display_name` is optional. Usernames are normalized to lowercase and must contain 3–30 lowercase letters, digits, or underscores. Email is normalized to lowercase. Passwords must contain at least 12 characters and no more than 128 bytes. Returns `201` and the account profile.

## `POST /login`

Request:

```json
{
  "identifier": "reader_1 or reader@example.com",
  "password": "your password"
}
```

Returns `200` and the account profile. Incorrect identifier/password pairs share one `401 invalid_credentials` response.

## `POST /refresh`

Requires the refresh cookie. Rotates the session's refresh credential and returns the account profile with new cookies. Reuse of a rotated token revokes the session.

## `POST /logout`

Revokes the current refresh session when present, clears both cookies, and returns `200`.

## `GET /me`

Requires a valid access cookie and returns the account profile. It checks that the associated server-side session remains active.

## Cookies and browser requests

- `scripd_access` is HttpOnly and scoped to `/`.
- `scripd_refresh` is HttpOnly and scoped to `/api/v1/auth`.
- Both use `SameSite=Strict`; `Secure` is enabled in production.
- Refresh cookies contain a session ID and a high-entropy opaque secret. PostgreSQL stores a SHA-256 hash of the secret component, never its plaintext value.
- Cookie-mutating routes reject browser `Origin` headers that are not in `CORS_ALLOWED_ORIGINS`.
- Registration is limited to 5 requests per hour per source IP; login to 10 per 15 minutes; refresh and logout to 30 per 15 minutes. A process-local limiter is for the single-instance phase; deployment must also enforce shared limits at the edge before scaling API replicas.
- The web client serializes refresh attempts across tabs when the browser supports the Web Locks API, avoiding accidental reuse of one refresh cookie during parallel requests.

Expected errors include `invalid_request`, `email_in_use`, `username_in_use`, `invalid_credentials`, `invalid_session`, `origin_not_allowed`, and `rate_limit_exceeded`. Unexpected failures return a generic `500 internal_error` response with a request ID.
