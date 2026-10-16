package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	"github.com/scripd-app/scripd/internal/book"
	"github.com/scripd-app/scripd/internal/book/service"
	"github.com/stretchr/testify/require"
)

func TestSearchReturnsBooksAndPaginationMetadata(t *testing.T) {
	stub := &stubBookService{searchResult: service.SearchPage{
		Books: []book.Book{{
			ID: "0c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d", OpenLibraryKey: "OL123W", Title: "The Hobbit",
			Authors: []string{"J. R. R. Tolkien"}, OpenLibraryURL: "https://openlibrary.org/works/OL123W",
		}},
		Page: 2, Limit: 12, Total: 25, HasMore: true, Source: "open_library",
	}}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/books/search?q=The+Hobbit&page=2&limit=12", nil)
	newTestRouter(stub).ServeHTTP(response, request)

	require.Equal(t, http.StatusOK, response.Code)
	var payload struct {
		Data []book.Book `json:"data"`
		Meta struct {
			Page    int    `json:"page"`
			Limit   int    `json:"limit"`
			Total   int    `json:"total"`
			HasMore bool   `json:"has_more"`
			Source  string `json:"source"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &payload))
	require.Len(t, payload.Data, 1)
	require.Equal(t, "The Hobbit", payload.Data[0].Title)
	require.Equal(t, 2, payload.Meta.Page)
	require.Equal(t, 12, payload.Meta.Limit)
	require.Equal(t, 25, payload.Meta.Total)
	require.True(t, payload.Meta.HasMore)
	require.Equal(t, "open_library", payload.Meta.Source)
	require.Equal(t, "The Hobbit", stub.query)
	require.True(t, stub.hasDeadline)
}

func TestSearchRejectsMissingAndDuplicateQueryParameters(t *testing.T) {
	for _, path := range []string{"/books/search", "/books/search?q=one&q=two"} {
		t.Run(path, func(t *testing.T) {
			stub := &stubBookService{}
			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, path, nil)
			newTestRouter(stub).ServeHTTP(response, request)
			require.Equal(t, http.StatusBadRequest, response.Code)
			require.Zero(t, stub.searchCalls)
		})
	}
}

func TestSearchReturnsServiceUnavailableWithoutLocalFallback(t *testing.T) {
	stub := &stubBookService{searchErr: service.ErrCatalogUnavailable}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/books/search?q=the+hobbit", nil)
	newTestRouter(stub).ServeHTTP(response, request)

	require.Equal(t, http.StatusServiceUnavailable, response.Code)
	require.Equal(t, "5", response.Header().Get("Retry-After"))
	require.Contains(t, response.Body.String(), "catalog_unavailable")
	require.NotContains(t, response.Body.String(), "Open Library timed out")
}

func TestGetMapsUnknownBooksToNotFound(t *testing.T) {
	stub := &stubBookService{getErr: service.ErrNotFound}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/books/0c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d", nil)
	newTestRouter(stub).ServeHTTP(response, request)
	require.Equal(t, http.StatusNotFound, response.Code)
	require.Contains(t, response.Body.String(), "not_found")
}

func TestUnexpectedErrorsAreNotReturnedToClients(t *testing.T) {
	stub := &stubBookService{getErr: errors.New("database password leaked")}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/books/0c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d", nil)
	newTestRouter(stub).ServeHTTP(response, request)
	require.Equal(t, http.StatusInternalServerError, response.Code)
	require.NotContains(t, response.Body.String(), "database password leaked")
}

func newTestRouter(stub *stubBookService) *chi.Mux {
	router := chi.NewRouter()
	New(stub, zerolog.Nop()).RegisterRoutes(router)
	return router
}

type stubBookService struct {
	searchResult service.SearchPage
	searchErr    error
	searchCalls  int
	query        string
	hasDeadline  bool
	getResult    book.Book
	getErr       error
}

func (s *stubBookService) Search(ctx context.Context, query string, _, _ int) (service.SearchPage, error) {
	_, s.hasDeadline = ctx.Deadline()
	s.searchCalls++
	s.query = query
	return s.searchResult, s.searchErr
}

func (s *stubBookService) GetByID(context.Context, string) (book.Book, error) {
	return s.getResult, s.getErr
}
