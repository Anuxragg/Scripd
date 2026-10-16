GO ?= go
NPM ?= npm
MIGRATE ?= migrate
SQLC ?= sqlc
DATABASE_URL ?=

.PHONY: run test test-race lint migrate-up migrate-down sqlc-generate docker-up docker-down web-dev

run:
	$(GO) run ./cmd/api

web-dev:
	$(NPM) --prefix frontend run dev

test:
	$(GO) test ./cmd/... ./internal/...

test-race:
	$(GO) test -race ./cmd/... ./internal/...

lint:
	golangci-lint run
	$(NPM) --prefix frontend run lint
	$(NPM) --prefix frontend exec -- prettier --check .

migrate-up:
	@test -n "$(DATABASE_URL)" || (echo "Set DATABASE_URL to the PostgreSQL migration URL" && exit 1)
	$(MIGRATE) -path migrations -database "$(DATABASE_URL)" up

migrate-down:
	@test -n "$(DATABASE_URL)" || (echo "Set DATABASE_URL to the PostgreSQL migration URL" && exit 1)
	$(MIGRATE) -path migrations -database "$(DATABASE_URL)" down 1

sqlc-generate:
	$(SQLC) generate -f sqlc.yaml

docker-up:
	docker compose up --build

docker-down:
	docker compose down
