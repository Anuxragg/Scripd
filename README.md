# Scripd

Scripd is a social reading log for books. Account registration, cookie sessions, book discovery, and the canonical catalog are in place. The reading diary, reviews, and social feed are the next product milestones.

## Local setup

Requirements: Go 1.26+, Node.js 20.9+, Docker Compose, and `migrate`.

1. Copy `.env.example` to `.env` and replace the local passwords and token placeholders.
2. Start PostgreSQL with `docker compose up -d postgres`. PostgreSQL data persists in a named volume.
3. Apply the schema from the host after installing `golang-migrate`:

   ```sh
   export DATABASE_URL='postgres://scripd:YOUR_PASSWORD@localhost:5432/scripd?sslmode=disable'
   make migrate-up
   ```

4. Start the API and web app with `docker compose up --build` (or `make docker-up`). The API listens at `http://localhost:8080`; the web app is at `http://localhost:3000`.
5. For local non-container development, load the backend values from `.env` into your shell environment, then run `make run` and `make web-dev` in separate terminals. Copy `frontend/.env.example` to `frontend/.env.local` if the API URL differs.

`GET /healthz` checks that the API process responds. `GET /readyz` checks PostgreSQL using the request context and a bounded timeout. API routes are versioned below `/api/v1`.

## Architecture

The Go API follows handler → service → repository. Handlers translate HTTP input/output, services own business rules and context propagation, and repositories own PostgreSQL access through pgx. Open Library search stays behind a book provider adapter; imported works and search fallback live in PostgreSQL. SQL query definitions are kept under `sqlc/queries` for code generation as the data layer grows. Feature packages depend inward through interfaces; platform packages own configuration, database connections, logging, shared middleware, health checks, and HTTP response helpers.

The Next.js App Router owns route composition. Feature folders own domain UI and query behavior. Shared UI primitives, API transport, cross-feature hooks, and shared API types live in `components/ui`, `lib/api`, `hooks`, and `types` respectively.

## Repository map

```text
.
├── .github/                         — CI and dependency update automation
│   └── workflows/                   — Lint, test, and container build workflows
├── cmd/                             — Executable entry points
│   └── api/                         — API startup, dependency wiring, and graceful shutdown
├── internal/                        — Private application modules
│   ├── auth/                        — Registration, cookie sessions, and current account
│   │   ├── handler/                 — Auth HTTP transport and handler tests
│   │   ├── service/                 — Auth rules and service tests
│   │   └── repository/              — Auth persistence adapters and integration tests
│   ├── user/                        — User and profile feature boundary
│   │   ├── handler/                 — User HTTP transport and handler tests
│   │   ├── service/                 — User/profile rules and service tests
│   │   └── repository/              — User persistence adapters and integration tests
│   ├── book/                        — Catalog and Open Library feature boundary
│   │   ├── handler/                 — Book HTTP transport and handler tests
│   │   ├── service/                 — Search, normalization, caching, and service tests
│   │   └── repository/              — Book persistence adapters and integration tests
│   ├── read/                        — Reading log feature boundary
│   │   ├── handler/                 — Read HTTP transport and handler tests
│   │   ├── service/                 — Read rules and pagination tests
│   │   └── repository/              — Read persistence adapters and integration tests
│   ├── review/                      — Review feature boundary
│   │   ├── handler/                 — Review HTTP transport and handler tests
│   │   ├── service/                 — Review rules and service tests
│   │   └── repository/              — Review persistence adapters and integration tests
│   ├── comment/                     — Comment feature boundary
│   │   ├── handler/                 — Comment HTTP transport and handler tests
│   │   ├── service/                 — Comment rules and service tests
│   │   └── repository/              — Comment persistence adapters and integration tests
│   ├── follow/                      — Follow relationship feature boundary
│   │   ├── handler/                 — Follow HTTP transport and handler tests
│   │   ├── service/                 — Follow rules and service tests
│   │   └── repository/              — Follow persistence adapters and integration tests
│   ├── feed/                        — Activity feed feature boundary
│   │   ├── handler/                 — Feed HTTP transport and handler tests
│   │   ├── service/                 — Feed assembly and service tests
│   │   └── repository/              — Feed persistence adapters and integration tests
│   └── platform/                    — Shared infrastructure adapters
│       ├── config/                  — Validated environment configuration
│       ├── db/                      — PostgreSQL pool setup
│       ├── dbgen/                   — SQLC generation output
│       ├── health/                  — Liveness/readiness handlers and tests
│       ├── httpserver/              — Router construction and HTTP server wiring
│       ├── logger/                  — Structured zerolog setup
│       ├── middleware/              — Request logging, recovery, CORS, and rate limiting
│       └── response/                — Central JSON response and error envelopes
├── migrations/                      — Ordered PostgreSQL up/down migrations
├── sqlc/                            — SQL query sources for code generation
│   └── queries/                     — User, book, and read query definitions
├── frontend/
│   ├── app/                         — Next.js routes, global layout, styles, and providers
│   ├── components/                  — Shared React components
│   │   └── ui/                      — Accessible reusable UI primitives
│   ├── features/                    — Feature-local screens and query logic
│   │   ├── auth/                    — Authentication UI boundary
│   │   ├── books/                   — Catalog UI boundary
│   │   ├── feed/                    — Feed UI boundary
│   │   ├── profile/                 — Profile UI boundary
│   │   ├── reads/                   — Reading log UI boundary
│   │   └── reviews/                 — Review/comment UI boundary
│   ├── hooks/                       — Cross-feature React hooks
│   ├── lib/                         — Shared client utilities
│   │   └── api/                     — API transport and error parsing
│   ├── public/                      — Static frontend assets
│   └── types/                       — Shared frontend API contracts
```

Within each backend feature, `handler` owns HTTP, `service` owns rules and orchestration, and `repository` owns storage interfaces and PostgreSQL adapters. Add table-driven unit tests for handlers/services and PostgreSQL integration tests for repositories. Repository integration tests use an isolated schema in the database supplied by `TEST_DATABASE_URL`; CI provisions PostgreSQL for them. Shared reusable code belongs under `pkg/` only when it is genuinely useful outside this service; this scaffold intentionally has no `pkg/` package.

## Conventions

- **Errors:** services return typed/domain errors; handlers map them centrally to HTTP statuses and stable error codes. Do not expose SQL, credentials, or internal error details to clients. Log unexpected failures with the request ID.
- **API responses:** success uses `{"data": ..., "meta": {}}`; errors use `{"error":{"code":"...","message":"...","request_id":"..."}}`. Cursor-paginated endpoints should put `next_cursor` and `has_more` in `meta`.
- **Naming:** Go packages are short lowercase nouns, exported Go identifiers use `MixedCaps`, SQL tables/columns use snake_case, and TypeScript components use PascalCase while hooks use `useThing`.
- **Context:** pass `context.Context` from HTTP boundaries through services to all database, cache, and external API operations. Do not store request contexts in structs.
- **Commits:** use Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`), with a concise imperative subject.
- **Secrets:** configuration comes from environment variables. Never commit `.env` files, tokens, passwords, or production secrets.

## Common commands

```sh
make run             # Start the API
make web-dev         # Start Next.js
make test            # Go tests
make test-race       # Go tests with race detection (requires a C toolchain)
make lint            # Go and frontend lint/format checks
make migrate-up      # Apply migrations (requires DATABASE_URL)
make migrate-down    # Roll back one migration
make sqlc-generate   # Generate typed query code
make docker-up       # Build and start the Compose stack
```

`sqlc` is only needed when regenerating query code. Install the local hooks with `pre-commit install`. Run `pre-commit run --all-files` before opening a pull request.

## Next implementation steps

1. Book search: Open Library search and normalized metadata persisted in PostgreSQL.
2. Reading diary: want-to-read, currently-reading, read, did-not-finish, dates, and rereads.
3. Reviews and public profiles: ratings, reviews, profile history, and privacy controls.
4. Social layer: follows and a cursor-paginated activity feed.
5. Launch readiness: accessibility, security, backups, observability, and deployment checks.

The identity and book-catalog slices are implemented. Email verification, password recovery, and account deletion remain launch work; keep public posting and social actions gated until those account controls are in place.

## Product direction

Scripd is a social reading log for books: members discover books, keep a dated reading diary, rate and review titles, and follow other readers. See [the product brief](docs/product-brief.md) and [the delivery roadmap](docs/roadmap.md) for scope and acceptance milestones.
