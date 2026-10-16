package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scripd-app/scripd/internal/book"
	"github.com/stretchr/testify/require"
)

func TestPostgresCatalogUpsertSearchFallbackAndDetail(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, databaseURL)
	require.NoError(t, err)
	t.Cleanup(admin.Close)
	require.NoError(t, admin.Ping(ctx))

	schema := fmt.Sprintf("book_test_%d", time.Now().UnixNano())
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

	booksMigration, err := os.ReadFile(filepath.Join("..", "..", "..", "migrations", "000002_create_books.up.sql"))
	require.NoError(t, err)
	_, err = pool.Exec(ctx, string(booksMigration), pgx.QueryExecModeSimpleProtocol)
	require.NoError(t, err)
	searchIndexMigration, err := os.ReadFile(filepath.Join("..", "..", "..", "migrations", "000005_create_books_search_index.up.sql"))
	require.NoError(t, err)
	_, err = pool.Exec(ctx, string(searchIndexMigration))
	require.NoError(t, err)

	repository := NewPostgres(pool)
	isbn := "9780385472579"
	year := 1937
	metadata, err := json.Marshal(map[string]string{"key": "OL123W", "title": "The Hobbit"})
	require.NoError(t, err)
	first, err := repository.Upsert(ctx, book.ImportedBook{
		OpenLibraryKey: "OL123W", ISBN13: &isbn, Title: "The Hobbit", Authors: []string{"J. R. R. Tolkien"},
		PublishedYear: &year, RawMetadata: metadata,
	})
	require.NoError(t, err)
	require.NotEmpty(t, first.ID)

	updatedTitle := "The Hobbit: There and Back Again"
	updated, err := repository.Upsert(ctx, book.ImportedBook{
		OpenLibraryKey: "OL123W", Title: updatedTitle, Authors: []string{"J. R. R. Tolkien"},
		RawMetadata: json.RawMessage(`{"key":"OL123W","title":"The Hobbit: There and Back Again"}`),
	})
	require.NoError(t, err)
	require.Equal(t, first.ID, updated.ID)
	require.Equal(t, updatedTitle, updated.Title)
	require.NotNil(t, updated.ISBN13)
	require.Equal(t, isbn, *updated.ISBN13)
	require.Equal(t, "https://openlibrary.org/works/OL123W", updated.OpenLibraryURL)

	localBooks, total, err := repository.SearchLocal(ctx, "There and Back Again", 1, 12)
	require.NoError(t, err)
	require.Equal(t, 1, total)
	require.Len(t, localBooks, 1)
	require.Equal(t, updated.ID, localBooks[0].ID)

	byID, err := repository.GetByID(ctx, updated.ID)
	require.NoError(t, err)
	require.Equal(t, updated.Title, byID.Title)

	conflictingISBNBook, err := repository.Upsert(ctx, book.ImportedBook{
		OpenLibraryKey: "OL124W", ISBN13: &isbn, Title: "A separate Open Library work", RawMetadata: json.RawMessage(`{"key":"OL124W"}`),
	})
	require.NoError(t, err)
	require.NotEqual(t, updated.ID, conflictingISBNBook.ID)
	require.Nil(t, conflictingISBNBook.ISBN13)
}
