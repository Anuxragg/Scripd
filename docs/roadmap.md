# Delivery roadmap

Build Scripd in complete, reviewable slices. Each milestone includes its API, persistence, web flow, and acceptance checks before the next feature depends on it.

## 0. Product and runtime foundation

- Define the product loop, MVP boundary, domain vocabulary, and acceptance gates.
- Run locally with PostgreSQL as the only backing service.
- Keep secrets in environment configuration, health endpoints bounded, and request IDs in logs and errors.
- Keep rate limiting process-local for the single-process development stack; require an edge/shared limiter before horizontal public deployment. Revisit Redis only after measured cache, queue, or shared-limiter needs.

## 1. Identity and sessions

- Register with normalized email and username and Argon2id password hashes.
- Log in and out, rotate refresh sessions, and expose the current account.
- Store only a hash of each refresh token in PostgreSQL; send access and refresh credentials in HttpOnly cookies.
- Validate request origins on cookie-mutating routes and use secure cookie settings in production.
- Verify email addresses through hashed, 24-hour, single-use tokens and rate-limited resend requests.
- Allow unverified members to use their private diary; expose a verified-user middleware for future public social actions.
- Acceptance: a member can create an account, verify their email, sign in, refresh, sign out, and receive stable generic credential errors without secrets in responses.
- Password recovery and account deletion remain launch gates before public social actions are enabled.
- Status: email verification API and UI are implemented with SMTP delivery, a local Mailpit inbox, token hashing/expiry/replay protection, generic registration conflicts, and database-backed resend limits. Apply `RequireVerifiedUser` to future public social routes.

## 2. Book catalog

- Search Open Library through a server-side adapter and normalize provider metadata into Scripd's catalog.
- Persist works and external identifiers in PostgreSQL; deduplicate by stable provider IDs and ISBNs.
- Add book detail and search UI with loading, empty, error, and retry states.
- Acceptance: a reader can find a book and open a stable Scripd book detail even if the provider is temporarily unavailable after import.
- Status: implemented with bounded server-side Open Library search, PostgreSQL upserts, local full-text fallback, catalog detail reads, and responsive search/detail routes.

## 3. Reading diary

- Add a book to want-to-read, currently-reading, read, or did-not-finish.
- Support multiple reading entries for rereads, dates, and member-owned notes.
- Add/edit/delete flows and a personal library view.
- Acceptance: all state transitions are validated, persisted, and visible in the member's private library.
- Status: API, migrations, personal shelves, book detail actions, and a private paginated library are implemented. The repository integration test exercises legacy status migration, ownership, rereads, active shelf uniqueness, optimistic updates, and cursor pagination in CI.

## 4. Reviews and profiles

- Add ratings and written reviews to individual reading entries.
- Build public profile pages with reading history, reviews, and privacy controls.
- Acceptance: edit/delete permissions and profile visibility rules are enforced by the API.

## 5. Social discovery

- Follow/unfollow readers and assemble a cursor-paginated activity feed from durable source records.
- Add likes/comments only after the feed and privacy boundaries are stable.
- Acceptance: feed ordering is deterministic, pagination has no duplicates, and private activity stays hidden.

## 6. Launch readiness

- Review accessibility, security controls, database restore/migration practice, monitoring, backups, and deployment configuration.
- Add load and failure-mode checks for catalog provider calls, feed pagination, and session rotation.
- Add shared caching, background jobs, or Redis only when measured requirements justify them.
