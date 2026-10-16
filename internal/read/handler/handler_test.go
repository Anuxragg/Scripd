package handler

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	authmiddleware "github.com/scripd-app/scripd/internal/auth/middleware"
	"github.com/scripd-app/scripd/internal/auth/service"
	"github.com/scripd-app/scripd/internal/read"
	readservice "github.com/scripd-app/scripd/internal/read/service"
	"github.com/stretchr/testify/require"
)

const (
	handlerTestUserID  = "0c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d"
	handlerTestBookID  = "1c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d"
	handlerTestEntryID = "2c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d"
)

func TestRoutesAuthenticateAndCreateReadingEntry(t *testing.T) {
	store := &stubReadService{}
	auth := authmiddleware.New(stubHandlerAuthenticator{}, []string{"https://app.example"}, zerolog.Nop())
	router := chi.NewRouter()
	New(store, auth.RequireUser, zerolog.Nop()).RegisterRoutes(router)

	request := httptest.NewRequest(http.MethodPost, "/reads", bytes.NewBufferString(`{"book_id":"`+handlerTestBookID+`","status":"read","notes":"A note"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://app.example")
	request.AddCookie(&http.Cookie{Name: authmiddleware.AccessCookieName, Value: "valid-token"})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	require.Equal(t, http.StatusCreated, response.Code)
	require.Contains(t, response.Body.String(), `"status":"read"`)
	require.Equal(t, handlerTestUserID, store.userID)
	require.Equal(t, handlerTestBookID, store.input.BookID)
	require.Equal(t, read.StatusRead, store.input.Status)
	require.Nil(t, store.input.FinishedAt)
	require.Equal(t, "A note", *store.input.Notes)
}

func TestRoutesRejectUnauthenticatedAndUntrustedWrites(t *testing.T) {
	for _, test := range []struct {
		name       string
		method     string
		path       string
		withCookie bool
		origin     string
		status     int
	}{
		{name: "private list", method: http.MethodGet, path: "/reads", status: http.StatusUnauthorized},
		{name: "untrusted write origin", method: http.MethodPost, path: "/reads", withCookie: true, origin: "https://attacker.example", status: http.StatusForbidden},
	} {
		t.Run(test.name, func(t *testing.T) {
			store := &stubReadService{}
			auth := authmiddleware.New(stubHandlerAuthenticator{}, []string{"https://app.example"}, zerolog.Nop())
			router := chi.NewRouter()
			New(store, auth.RequireUser, zerolog.Nop()).RegisterRoutes(router)
			request := httptest.NewRequest(test.method, test.path, bytes.NewBufferString(`{}`))
			if test.withCookie {
				request.AddCookie(&http.Cookie{Name: authmiddleware.AccessCookieName, Value: "valid-token"})
			}
			if test.origin != "" {
				request.Header.Set("Origin", test.origin)
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			require.Equal(t, test.status, response.Code)
			require.Zero(t, store.createCalls)
		})
	}
}

func TestCreateRejectsUnknownJSONFields(t *testing.T) {
	store := &stubReadService{}
	auth := authmiddleware.New(stubHandlerAuthenticator{}, nil, zerolog.Nop())
	router := chi.NewRouter()
	New(store, auth.RequireUser, zerolog.Nop()).RegisterRoutes(router)
	request := httptest.NewRequest(http.MethodPost, "/reads", bytes.NewBufferString(`{"book_id":"`+handlerTestBookID+`","status":"read","user_id":"other"}`))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(&http.Cookie{Name: authmiddleware.AccessCookieName, Value: "valid-token"})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	require.Equal(t, http.StatusBadRequest, response.Code)
	require.Zero(t, store.createCalls)
}

func TestReadFailureDoesNotExposeStorageDetails(t *testing.T) {
	store := &stubReadService{getErr: errors.New("private postgres error")}
	auth := authmiddleware.New(stubHandlerAuthenticator{}, nil, zerolog.Nop())
	router := chi.NewRouter()
	New(store, auth.RequireUser, zerolog.Nop()).RegisterRoutes(router)
	request := httptest.NewRequest(http.MethodGet, "/reads/"+handlerTestEntryID, nil)
	request.AddCookie(&http.Cookie{Name: authmiddleware.AccessCookieName, Value: "valid-token"})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	require.Equal(t, http.StatusInternalServerError, response.Code)
	require.NotContains(t, response.Body.String(), "private postgres error")
}

type stubReadService struct {
	userID      string
	input       read.EntryInput
	createCalls int
	getErr      error
}

func (s *stubReadService) Create(_ context.Context, userID string, input read.EntryInput) (read.Entry, error) {
	s.userID, s.input = userID, input
	s.createCalls++
	finishedAt := time.Now().UTC()
	return read.Entry{ID: handlerTestEntryID, BookID: input.BookID, Status: input.Status, FinishedAt: &finishedAt}, nil
}

func (s *stubReadService) GetByID(_ context.Context, userID, _ string) (read.Entry, error) {
	s.userID = userID
	return read.Entry{}, s.getErr
}

func (s *stubReadService) List(_ context.Context, userID string, _ read.ListFilter, _ string) (readservice.ListPage, error) {
	s.userID = userID
	return readservice.ListPage{Entries: []read.Entry{}}, nil
}

func (s *stubReadService) Update(_ context.Context, userID, _ string, input read.EntryInput) (read.Entry, error) {
	s.userID, s.input = userID, input
	return read.Entry{}, nil
}

func (s *stubReadService) Delete(_ context.Context, userID, _ string) error {
	s.userID = userID
	return nil
}

type stubHandlerAuthenticator struct{}

func (stubHandlerAuthenticator) CurrentUser(context.Context, string) (service.Profile, error) {
	return service.Profile{ID: handlerTestUserID, Username: "reader_one", CreatedAt: time.Now().UTC()}, nil
}
