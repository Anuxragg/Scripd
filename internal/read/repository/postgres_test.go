package repository

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scripd-app/scripd/internal/read"
	"github.com/stretchr/testify/require"
)

func TestPostgresDiaryMigrationsOwnershipRereadsAndPagination(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, databaseURL)
	require.NoError(t, err)
	t.Cleanup(admin.Close)
	require.NoError(t, admin.Ping(ctx))

	schema := fmt.Sprintf("read_test_%d", time.Now().UnixNano())
	_, err = admin.Exec(ctx, "CREATE SCHEMA "+schema)
	require.NoError(t, err)
	t.Cleanup(func() {
		cleanupContext, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cleanupCancel()
		_, _ = admin.Exec(cleanupContext, "DROP SCHEMA IF EXISTS "+schema+" CASCADE")
	})

	poolConfig, err := pgxpool.ParseConfig(databaseURL)
	require.NoError(t, err)
	poolConfig.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	for _, migrationName := range []string{
		"000001_create_users.up.sql",
		"000002_create_books.up.sql",
		"000003_create_reads.up.sql",
	} {
		applyMigration(ctx, t, pool, migrationName)
	}
	userID := insertDiaryUser(ctx, t, pool, "reader_one", "reader-one@example.test")
	otherUserID := insertDiaryUser(ctx, t, pool, "reader_two", "reader-two@example.test")
	bookID := insertDiaryBook(ctx, t, pool, "A Diary of Rereads")
	uncompletedBookID := insertDiaryBook(ctx, t, pool, "An Unfinished Tale")
	_, err = pool.Exec(ctx, `
		INSERT INTO reads (user_id, book_id, status, rating, started_at, finished_at)
		VALUES ($1, $2, 'completed', 4.5, now() - interval '3 days', now() - interval '1 day')`, userID, bookID)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `
		INSERT INTO reads (user_id, book_id, status, started_at)
		VALUES ($1, $2, 'on_hold', now() - interval '2 days')`, userID, uncompletedBookID)
	require.NoError(t, err)
	applyMigration(ctx, t, pool, "000006_evolve_reads_for_diary.up.sql")

	repository := NewPostgres(pool)
	legacyEntries, err := repository.List(ctx, userID, read.ListFilter{Status: read.StatusRead}, nil, 10)
	require.NoError(t, err)
	require.Len(t, legacyEntries, 1)
	require.Equal(t, read.StatusRead, legacyEntries[0].Status)
	require.NotNil(t, legacyEntries[0].FinishedAt)
	require.Equal(t, "A Diary of Rereads", legacyEntries[0].Book.Title)
	legacyActiveEntries, err := repository.List(ctx, userID, read.ListFilter{Status: read.StatusReading}, nil, 10)
	require.NoError(t, err)
	require.Len(t, legacyActiveEntries, 1)
	require.NotNil(t, legacyActiveEntries[0].StartedAt)
	require.Nil(t, legacyActiveEntries[0].FinishedAt)

	active, err := repository.Create(ctx, userID, read.EntryInput{BookID: bookID, Status: read.StatusWantToRead})
	require.NoError(t, err)
	require.Equal(t, read.StatusWantToRead, active.Status)
	_, err = repository.Create(ctx, userID, read.EntryInput{BookID: bookID, Status: read.StatusWantToRead})
	require.ErrorIs(t, err, read.ErrAlreadyActive)

	startedAt := time.Now().UTC().Add(-24 * time.Hour).Truncate(time.Microsecond)
	reading, err := repository.Update(ctx, userID, active.ID, active.UpdatedAt, read.EntryInput{
		BookID: bookID, Status: read.StatusReading, StartedAt: &startedAt,
	})
	require.NoError(t, err)
	require.Equal(t, read.StatusReading, reading.Status)
	require.True(t, reading.UpdatedAt.After(active.UpdatedAt))
	_, err = repository.Update(ctx, userID, active.ID, active.UpdatedAt, read.EntryInput{
		BookID: bookID, Status: read.StatusReading, StartedAt: &startedAt,
	})
	require.ErrorIs(t, err, read.ErrUpdateConflict)

	finishedAt := time.Now().UTC().Truncate(time.Microsecond)
	rated := 4.0
	finished, err := repository.Update(ctx, userID, reading.ID, reading.UpdatedAt, read.EntryInput{
		BookID: bookID, Status: read.StatusRead, Rating: &rated, StartedAt: &startedAt, FinishedAt: &finishedAt,
	})
	require.NoError(t, err)
	require.Equal(t, read.StatusRead, finished.Status)
	require.Equal(t, rated, *finished.Rating)

	reread, err := repository.Create(ctx, userID, read.EntryInput{
		BookID: bookID, Status: read.StatusRead, Rating: &rated, StartedAt: &startedAt, FinishedAt: &finishedAt,
	})
	require.NoError(t, err)
	require.NotEqual(t, finished.ID, reread.ID)

	otherEntry, err := repository.Create(ctx, otherUserID, read.EntryInput{BookID: bookID, Status: read.StatusWantToRead})
	require.NoError(t, err)
	_, err = repository.GetByID(ctx, userID, otherEntry.ID)
	require.ErrorIs(t, err, read.ErrNotFound)
	require.ErrorIs(t, repository.Delete(ctx, userID, otherEntry.ID), read.ErrNotFound)
	_, err = repository.GetByID(ctx, otherUserID, otherEntry.ID)
	require.NoError(t, err)

	firstPage, err := repository.List(ctx, userID, read.ListFilter{BookID: bookID}, nil, 2)
	require.NoError(t, err)
	require.Len(t, firstPage, 2)
	cursor := &read.Cursor{ID: firstPage[1].ID, CreatedAt: firstPage[1].CreatedAt}
	secondPage, err := repository.List(ctx, userID, read.ListFilter{BookID: bookID}, cursor, 2)
	require.NoError(t, err)
	require.Len(t, secondPage, 1)
	require.NotEqual(t, firstPage[0].ID, secondPage[0].ID)

	readEntries, err := repository.List(ctx, userID, read.ListFilter{Status: read.StatusRead}, nil, 10)
	require.NoError(t, err)
	require.Len(t, readEntries, 3)
	require.NoError(t, repository.Delete(ctx, userID, reread.ID))
	_, err = repository.GetByID(ctx, userID, reread.ID)
	require.ErrorIs(t, err, read.ErrNotFound)
}

func applyMigration(ctx context.Context, t *testing.T, pool *pgxpool.Pool, name string) {
	t.Helper()
	contents, err := os.ReadFile(filepath.Join("..", "..", "..", "migrations", name))
	require.NoError(t, err)
	_, err = pool.Exec(ctx, string(contents), pgx.QueryExecModeSimpleProtocol)
	require.NoError(t, err)
}

func insertDiaryUser(ctx context.Context, t *testing.T, pool *pgxpool.Pool, username, email string) string {
	t.Helper()
	var userID string
	err := pool.QueryRow(ctx, `
		INSERT INTO users (username, email, password_hash)
		VALUES ($1, $2, 'test-hash') RETURNING id`, username, email).Scan(&userID)
	require.NoError(t, err)
	return userID
}

func insertDiaryBook(ctx context.Context, t *testing.T, pool *pgxpool.Pool, title string) string {
	t.Helper()
	var bookID string
	err := pool.QueryRow(ctx, `
		INSERT INTO books (title, authors)
		VALUES ($1, ARRAY['A. Reader']) RETURNING id`, title).Scan(&bookID)
	require.NoError(t, err)
	return bookID
}
