package handler

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	authmiddleware "github.com/scripd-app/scripd/internal/auth/middleware"
	"github.com/scripd-app/scripd/internal/list"
	platformmiddleware "github.com/scripd-app/scripd/internal/platform/middleware"
	"github.com/scripd-app/scripd/internal/platform/response"
)

const (
	maximumBodyBytes   = 32 * 1024
	listRequestTimeout = 10 * time.Second
)

type listService interface {
	CreateList(ctx context.Context, userID string, input list.CreateListInput) (list.List, error)
	GetListByID(ctx context.Context, listID, viewerID string) (list.List, error)
	GetUserLists(ctx context.Context, username, viewerID string) ([]list.List, error)
	GetMyLists(ctx context.Context, userID string) ([]list.List, error)
	UpdateList(ctx context.Context, listID, userID string, input list.UpdateListInput) (list.List, error)
	DeleteList(ctx context.Context, listID, userID string) error
	AddBookToList(ctx context.Context, listID, userID string, input list.AddBookInput) (list.Item, error)
	RemoveBookFromList(ctx context.Context, listID, userID, bookID string) error
	UpdateListItem(ctx context.Context, listID, userID, bookID string, input list.UpdateItemInput) error
	GetBookListsForUser(ctx context.Context, userID, bookID string) ([]string, error)
}

type Handler struct {
	service      listService
	requireUser  func(http.Handler) http.Handler
	optionalUser func(http.Handler) http.Handler
	log          zerolog.Logger
}

func New(svc listService, requireUser, optionalUser func(http.Handler) http.Handler, log zerolog.Logger) *Handler {
	return &Handler{
		service:      svc,
		requireUser:  requireUser,
		optionalUser: optionalUser,
		log:          log,
	}
}

type createListRequest struct {
	Title       string  `json:"title"`
	Description *string `json:"description"`
	IsPrivate   bool    `json:"is_private"`
}

type updateListRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	IsPrivate   *bool   `json:"is_private"`
}

type addBookRequest struct {
	BookID   string  `json:"book_id"`
	Title    *string `json:"title"`
	Notes    *string `json:"notes"`
	Position *int    `json:"position"`
}

type updateItemRequest struct {
	Notes    *string `json:"notes"`
	Position *int    `json:"position"`
}

func (h *Handler) RegisterRoutes(router chi.Router) {
	mutationLimit := platformmiddleware.RateLimit(60, time.Minute)

	// Public routes (viewer may be authenticated optionally via context)
	router.With(h.optionalUser).Get("/lists/{listID}", h.GetList)
	router.With(h.optionalUser).Get("/users/{username}/lists", h.GetUserLists)

	// Protected routes
	router.With(h.requireUser).Get("/lists/my", h.GetMyLists)
	router.With(h.requireUser).Get("/lists/book/{bookID}", h.GetBookLists)
	router.With(h.requireUser, mutationLimit).Post("/lists", h.CreateList)
	router.With(h.requireUser, mutationLimit).Put("/lists/{listID}", h.UpdateList)
	router.With(h.requireUser, mutationLimit).Delete("/lists/{listID}", h.DeleteList)
	router.With(h.requireUser, mutationLimit).Post("/lists/{listID}/books", h.AddBook)
	router.With(h.requireUser, mutationLimit).Delete("/lists/{listID}/books/{bookID}", h.RemoveBook)
	router.With(h.requireUser, mutationLimit).Put("/lists/{listID}/books/{bookID}", h.UpdateItem)
}

func (h *Handler) CreateList(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}

	var req createListRequest
	if !decodeJSON(w, r, &req) {
		writeInvalidRequest(w, r)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), listRequestTimeout)
	defer cancel()

	l, err := h.service.CreateList(ctx, userID, list.CreateListInput{
		Title:       req.Title,
		Description: req.Description,
		IsPrivate:   req.IsPrivate,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusCreated, l)
}

func (h *Handler) GetList(w http.ResponseWriter, r *http.Request) {
	listID := strings.TrimSpace(chi.URLParam(r, "listID"))
	viewerID, _ := authmiddleware.UserID(r.Context())

	ctx, cancel := context.WithTimeout(r.Context(), listRequestTimeout)
	defer cancel()

	l, err := h.service.GetListByID(ctx, listID, viewerID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, l)
}

func (h *Handler) GetUserLists(w http.ResponseWriter, r *http.Request) {
	username := strings.TrimSpace(chi.URLParam(r, "username"))
	viewerID, _ := authmiddleware.UserID(r.Context())

	ctx, cancel := context.WithTimeout(r.Context(), listRequestTimeout)
	defer cancel()

	lists, err := h.service.GetUserLists(ctx, username, viewerID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, lists)
}

func (h *Handler) GetMyLists(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), listRequestTimeout)
	defer cancel()

	lists, err := h.service.GetMyLists(ctx, userID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, lists)
}

func (h *Handler) GetBookLists(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}
	bookID := strings.TrimSpace(chi.URLParam(r, "bookID"))

	ctx, cancel := context.WithTimeout(r.Context(), listRequestTimeout)
	defer cancel()

	listIDs, err := h.service.GetBookListsForUser(ctx, userID, bookID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, listIDs)
}

func (h *Handler) UpdateList(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}
	listID := strings.TrimSpace(chi.URLParam(r, "listID"))

	var req updateListRequest
	if !decodeJSON(w, r, &req) {
		writeInvalidRequest(w, r)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), listRequestTimeout)
	defer cancel()

	l, err := h.service.UpdateList(ctx, listID, userID, list.UpdateListInput{
		Title:       req.Title,
		Description: req.Description,
		IsPrivate:   req.IsPrivate,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, l)
}

func (h *Handler) DeleteList(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}
	listID := strings.TrimSpace(chi.URLParam(r, "listID"))

	ctx, cancel := context.WithTimeout(r.Context(), listRequestTimeout)
	defer cancel()

	if err := h.service.DeleteList(ctx, listID, userID); err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *Handler) AddBook(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}
	listID := strings.TrimSpace(chi.URLParam(r, "listID"))

	var req addBookRequest
	if !decodeJSON(w, r, &req) {
		writeInvalidRequest(w, r)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), listRequestTimeout)
	defer cancel()

	item, err := h.service.AddBookToList(ctx, listID, userID, list.AddBookInput{
		BookID:   req.BookID,
		Title:    req.Title,
		Notes:    req.Notes,
		Position: req.Position,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusCreated, item)
}

func (h *Handler) RemoveBook(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}
	listID := strings.TrimSpace(chi.URLParam(r, "listID"))
	bookID := strings.TrimSpace(chi.URLParam(r, "bookID"))

	ctx, cancel := context.WithTimeout(r.Context(), listRequestTimeout)
	defer cancel()

	if err := h.service.RemoveBookFromList(ctx, listID, userID, bookID); err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]bool{"removed": true})
}

func (h *Handler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}
	listID := strings.TrimSpace(chi.URLParam(r, "listID"))
	bookID := strings.TrimSpace(chi.URLParam(r, "bookID"))

	var req updateItemRequest
	if !decodeJSON(w, r, &req) {
		writeInvalidRequest(w, r)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), listRequestTimeout)
	defer cancel()

	if err := h.service.UpdateListItem(ctx, listID, userID, bookID, list.UpdateItemInput{
		Notes:    req.Notes,
		Position: req.Position,
	}); err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]bool{"updated": true})
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, list.ErrInvalidInput):
		response.WriteError(w, r, http.StatusBadRequest, "invalid_request", err.Error())
	case errors.Is(err, list.ErrNotFound):
		response.WriteError(w, r, http.StatusNotFound, "not_found", "list or item not found")
	case errors.Is(err, list.ErrConflict):
		response.WriteError(w, r, http.StatusConflict, "already_exists", "book is already in this list")
	case errors.Is(err, list.ErrForbidden):
		response.WriteError(w, r, http.StatusForbidden, "forbidden", "not authorized to access or modify this list")
	default:
		h.log.Error().Err(err).Str("request_id", chimiddleware.GetReqID(r.Context())).Msg("list request failed")
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

func writeInvalidRequest(w http.ResponseWriter, r *http.Request) {
	response.WriteError(w, r, http.StatusBadRequest, "invalid_request", "invalid list payload")
}

func writeUnauthenticated(w http.ResponseWriter, r *http.Request) {
	response.WriteError(w, r, http.StatusUnauthorized, "unauthenticated", "authentication is required")
}
