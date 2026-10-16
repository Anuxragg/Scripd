package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/scripd-app/scripd/internal/book"
	"github.com/stretchr/testify/require"
)

func TestSearchPersistsProviderResultsAndReturnsScripdBooks(t *testing.T) {
	provider := &stubProvider{result: book.ProviderSearch{
		Total: 25,
		Books: []book.ImportedBook{
			{OpenLibraryKey: "OL123W", Title: "The Hobbit"},
			{OpenLibraryKey: "OL123W", Title: "duplicate work"},
		},
	}}
	repository := &stubRepository{upserted: book.Book{
		ID: "0c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d", OpenLibraryKey: "OL123W", Title: "The Hobbit",
		Authors: []string{"J. R. R. Tolkien"}, MetadataSynced: time.Now().UTC(),
	}}
	service := New(provider, repository)

	result, err := service.Search(context.Background(), "  The   Hobbit  ", 2, 12)
	require.NoError(t, err)
	require.Equal(t, "The Hobbit", provider.query)
	require.Equal(t, 2, provider.page)
	require.Equal(t, 12, provider.limit)
	require.Len(t, repository.imports, 1)
	require.Equal(t, "OL123W", repository.imports[0].OpenLibraryKey)
	require.Equal(t, "open_library", result.Source)
	require.Equal(t, 25, result.Total)
	require.True(t, result.HasMore)
	require.Equal(t, repository.upserted.ID, result.Books[0].ID)
}

func TestSearchFallsBackToImportedCatalogOnProviderFailure(t *testing.T) {
	provider := &stubProvider{err: errors.New("Open Library timed out")}
	repository := &stubRepository{
		localBooks: []book.Book{{ID: "0c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d", Title: "The Hobbit"}},
		localTotal: 1,
	}
	result, err := New(provider, repository).Search(context.Background(), "hobbit", 1, 12)
	require.NoError(t, err)
	require.Equal(t, "local_catalog", result.Source)
	require.Equal(t, 1, result.Total)
	require.False(t, result.HasMore)
	require.Len(t, result.Books, 1)
	require.Equal(t, "hobbit", repository.localQuery)
}

func TestSearchReturnsUnavailableWhenNoSourceCanAnswer(t *testing.T) {
	provider := &stubProvider{err: errors.New("upstream unavailable")}
	_, err := New(provider, &stubRepository{}).Search(context.Background(), "hobbit", 1, 12)
	require.ErrorIs(t, err, ErrCatalogUnavailable)
}

func TestSearchRejectsInvalidInputBeforeCallingDependencies(t *testing.T) {
	provider := &stubProvider{}
	repository := &stubRepository{}
	service := New(provider, repository)

	tests := []struct {
		query string
		page  int
		limit int
	}{
		{query: "x", page: 1, limit: 12},
		{query: "valid title", page: 0, limit: 12},
		{query: "valid title", page: MaximumPage + 1, limit: 12},
		{query: "valid title", page: 1, limit: MaximumLimit + 1},
		{query: "valid title", page: 1, limit: 0},
	}
	for _, test := range tests {
		_, err := service.Search(context.Background(), test.query, test.page, test.limit)
		require.ErrorIs(t, err, ErrInvalidInput)
	}
	require.Equal(t, 0, provider.calls)
	require.Empty(t, repository.imports)
	require.Empty(t, repository.localQuery)
}

func TestGetByIDRejectsMalformedIdentifierAndMapsMissingBooks(t *testing.T) {
	repository := &stubRepository{getErr: ErrNotFound}
	service := New(&stubProvider{}, repository)
	_, err := service.GetByID(context.Background(), "not-a-uuid")
	require.ErrorIs(t, err, ErrNotFound)
	require.Equal(t, 0, repository.getCalls)

	_, err = service.GetByID(context.Background(), "0c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d")
	require.ErrorIs(t, err, ErrNotFound)
	require.Equal(t, 1, repository.getCalls)
}

type stubProvider struct {
	result book.ProviderSearch
	err    error
	calls  int
	query  string
	page   int
	limit  int
}

func (s *stubProvider) Search(_ context.Context, query string, page, limit int) (book.ProviderSearch, error) {
	s.calls++
	s.query, s.page, s.limit = query, page, limit
	return s.result, s.err
}

type stubRepository struct {
	upserted   book.Book
	imports    []book.ImportedBook
	localBooks []book.Book
	localTotal int
	localQuery string
	getResult  book.Book
	getErr     error
	getCalls   int
}

func (s *stubRepository) Upsert(_ context.Context, imported book.ImportedBook) (book.Book, error) {
	s.imports = append(s.imports, imported)
	return s.upserted, nil
}

func (s *stubRepository) SearchLocal(_ context.Context, query string, _, _ int) ([]book.Book, int, error) {
	s.localQuery = query
	return s.localBooks, s.localTotal, nil
}

func (s *stubRepository) GetByID(context.Context, string) (book.Book, error) {
	s.getCalls++
	return s.getResult, s.getErr
}
