package handler

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	authmiddleware "github.com/scripd-app/scripd/internal/auth/middleware"
	"github.com/scripd-app/scripd/internal/platform/middleware"
	"github.com/scripd-app/scripd/internal/platform/response"
	"github.com/scripd-app/scripd/internal/read"
	"github.com/scripd-app/scripd/internal/read/service"
)

const (
	maximumBodyBytes   = 32 * 1024
	readRequestTimeout = 10 * time.Second
)

type readService interface {
	Create(context.Context, string, read.EntryInput) (read.Entry, error)
	GetByID(context.Context, string, string) (read.Entry, error)
	List(context.Context, string, read.ListFilter, string) (service.ListPage, error)
	Update(context.Context, string, string, read.EntryInput) (read.Entry, error)
	Delete(context.Context, string, string) error
}

type Handler struct {
	service     readService
	requireUser func(http.Handler) http.Handler
	log         zerolog.Logger
}

type createEntryRequest struct {
	BookID     string      `json:"book_id"`
	Status     read.Status `json:"status"`
	Rating     *float64    `json:"rating"`
	StartedAt  *time.Time  `json:"started_at"`
	FinishedAt *time.Time  `json:"finished_at"`
	Notes      *string     `json:"notes"`
}

type updateEntryRequest struct {
	Status     read.Status `json:"status"`
	Rating     *float64    `json:"rating"`
	StartedAt  *time.Time  `json:"started_at"`
	FinishedAt *time.Time  `json:"finished_at"`
	Notes      *string     `json:"notes"`
}

func New(service readService, requireUser func(http.Handler) http.Handler, log zerolog.Logger) *Handler {
	return &Handler{service: service, requireUser: requireUser, log: log}
}

func (h *Handler) RegisterRoutes(router chi.Router) {
	mutationRateLimit := middleware.RateLimit(60, time.Minute)
	router.With(h.requireUser).Get("/reads", h.List)
	router.With(h.requireUser, mutationRateLimit).Post("/reads", h.Create)
	router.With(h.requireUser).Get("/reads/{entryID}", h.Get)
	router.With(h.requireUser, mutationRateLimit).Put("/reads/{entryID}", h.Update)
	router.With(h.requireUser, mutationRateLimit).Delete("/reads/{entryID}", h.Delete)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}
	status, ok := optionalQueryValue(r, "status")
	if !ok {
		writeInvalidRequest(w, r)
		return
	}
	bookID, ok := optionalQueryValue(r, "book_id")
	if !ok {
		writeInvalidRequest(w, r)
		return
	}
	cursor, ok := optionalQueryValue(r, "cursor")
	if !ok {
		writeInvalidRequest(w, r)
		return
	}
	limit, ok := optionalInt(r, "limit")
	if !ok {
		writeInvalidRequest(w, r)
		return
	}
	filter := read.ListFilter{Status: read.Status(status), BookID: bookID, Limit: limit}
	ctx, cancel := context.WithTimeout(r.Context(), readRequestTimeout)
	defer cancel()
	page, err := h.service.List(ctx, userID, filter, cursor)
	if err != nil {
		h.writeFailure(w, r, err)
		return
	}
	entries := page.Entries
	if entries == nil {
		entries = []read.Entry{}
	}
	response.WriteJSONWithMeta(w, http.StatusOK, entries, map[string]any{
		"next_cursor": page.NextCursor, "has_more": page.HasMore,
	})
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}
	var request createEntryRequest
	if !decodeJSON(w, r, &request) {
		writeInvalidRequest(w, r)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), readRequestTimeout)
	defer cancel()
	entry, err := h.service.Create(ctx, userID, read.EntryInput{
		BookID: request.BookID, Status: request.Status, Rating: request.Rating,
		StartedAt: request.StartedAt, FinishedAt: request.FinishedAt, Notes: request.Notes,
	})
	if err != nil {
		h.writeFailure(w, r, err)
		return
	}
	response.WriteJSON(w, http.StatusCreated, entry)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), readRequestTimeout)
	defer cancel()
	entry, err := h.service.GetByID(ctx, userID, chi.URLParam(r, "entryID"))
	if err != nil {
		h.writeFailure(w, r, err)
		return
	}
	response.WriteJSON(w, http.StatusOK, entry)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}
	var request updateEntryRequest
	if !decodeJSON(w, r, &request) {
		writeInvalidRequest(w, r)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), readRequestTimeout)
	defer cancel()
	entry, err := h.service.Update(ctx, userID, chi.URLParam(r, "entryID"), read.EntryInput{
		Status: request.Status, Rating: request.Rating,
		StartedAt: request.StartedAt, FinishedAt: request.FinishedAt, Notes: request.Notes,
	})
	if err != nil {
		h.writeFailure(w, r, err)
		return
	}
	response.WriteJSON(w, http.StatusOK, entry)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), readRequestTimeout)
	defer cancel()
	if err := h.service.Delete(ctx, userID, chi.URLParam(r, "entryID")); err != nil {
		h.writeFailure(w, r, err)
		return
	}
	response.WriteJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *Handler) writeFailure(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		response.WriteError(w, r, http.StatusGatewayTimeout, "request_timeout", "reading list request timed out")
	case errors.Is(err, read.ErrInvalidInput):
		writeInvalidRequest(w, r)
	case errors.Is(err, read.ErrNotFound):
		response.WriteError(w, r, http.StatusNotFound, "not_found", "reading entry not found")
	case errors.Is(err, read.ErrBookNotFound):
		response.WriteError(w, r, http.StatusNotFound, "book_not_found", "book not found")
	case errors.Is(err, read.ErrAlreadyActive):
		response.WriteError(w, r, http.StatusConflict, "book_already_active", "this book already has an active shelf entry")
	case errors.Is(err, read.ErrUpdateConflict):
		response.WriteError(w, r, http.StatusConflict, "read_conflict", "this entry changed; reload it before saving again")
	default:
		h.log.Error().Err(err).Str("request_id", chimiddleware.GetReqID(r.Context())).Msg("reading list request failed")
		response.WriteError(w, r, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
	}
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	contentType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || contentType != "application/json" {
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, maximumBodyBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return false
	}
	return errors.Is(decoder.Decode(&struct{}{}), io.EOF)
}

func optionalQueryValue(r *http.Request, key string) (string, bool) {
	values, exists := r.URL.Query()[key]
	if !exists {
		return "", true
	}
	if len(values) != 1 {
		return "", false
	}
	return strings.TrimSpace(values[0]), true
}

func optionalInt(r *http.Request, key string) (int, bool) {
	value, ok := optionalQueryValue(r, key)
	if !ok || value == "" {
		return 0, ok
	}
	parsed, err := strconv.Atoi(value)
	return parsed, err == nil
}

func writeInvalidRequest(w http.ResponseWriter, r *http.Request) {
	response.WriteError(w, r, http.StatusBadRequest, "invalid_request", "reading entry values are invalid")
}

func writeUnauthenticated(w http.ResponseWriter, r *http.Request) {
	response.WriteError(w, r, http.StatusUnauthorized, "unauthenticated", "authentication is required")
}
