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
	"github.com/scripd-app/scripd/internal/review"
	"github.com/scripd-app/scripd/internal/review/service"
)

const (
	maximumBodyBytes     = 32 * 1024
	reviewRequestTimeout = 10 * time.Second
)

type reviewService interface {
	Create(ctx context.Context, userID string, input review.CreateInput) (review.Review, error)
	GetByID(ctx context.Context, id string) (review.Review, error)
	GetByReadID(ctx context.Context, readID string) (review.Review, error)
	Update(ctx context.Context, userID, id string, input review.UpdateInput) (review.Review, error)
	Delete(ctx context.Context, userID, id string) error
	ListByBook(ctx context.Context, bookID string, cursor string, limit int) (service.ListPage, error)
}

type Handler struct {
	service         reviewService
	requireUser     func(http.Handler) http.Handler
	requireVerified func(http.Handler) http.Handler
	log             zerolog.Logger
}

type createReviewRequest struct {
	ReadID           string `json:"read_id"`
	Body             string `json:"body"`
	ContainsSpoilers bool   `json:"contains_spoilers"`
}

type updateReviewRequest struct {
	Body             string `json:"body"`
	ContainsSpoilers bool   `json:"contains_spoilers"`
}

func New(svc reviewService, requireUser, requireVerified func(http.Handler) http.Handler, log zerolog.Logger) *Handler {
	return &Handler{
		service:         svc,
		requireUser:     requireUser,
		requireVerified: requireVerified,
		log:             log,
	}
}

func (h *Handler) RegisterRoutes(router chi.Router) {
	mutationLimit := middleware.RateLimit(60, time.Minute)

	// Public routes
	router.Get("/reviews/{reviewID}", h.Get)
	router.Get("/books/{bookID}/reviews", h.ListByBook)

	// Protected routes (creation and editing require a verified account)
	router.With(h.requireVerified, mutationLimit).Post("/reviews", h.Create)
	router.With(h.requireUser).Get("/reads/{readID}/review", h.GetByReadID)
	router.With(h.requireVerified, mutationLimit).Patch("/reviews/{reviewID}", h.Update)
	router.With(h.requireUser, mutationLimit).Delete("/reviews/{reviewID}", h.Delete)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}

	var req createReviewRequest
	if !decodeJSON(w, r, &req) {
		writeInvalidRequest(w, r)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), reviewRequestTimeout)
	defer cancel()

	rev, err := h.service.Create(ctx, userID, review.CreateInput{
		ReadID:           req.ReadID,
		Body:             req.Body,
		ContainsSpoilers: req.ContainsSpoilers,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusCreated, rev)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	reviewID := strings.TrimSpace(chi.URLParam(r, "reviewID"))

	ctx, cancel := context.WithTimeout(r.Context(), reviewRequestTimeout)
	defer cancel()

	rev, err := h.service.GetByID(ctx, reviewID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, rev)
}

func (h *Handler) GetByReadID(w http.ResponseWriter, r *http.Request) {
	readID := strings.TrimSpace(chi.URLParam(r, "readID"))

	ctx, cancel := context.WithTimeout(r.Context(), reviewRequestTimeout)
	defer cancel()

	rev, err := h.service.GetByReadID(ctx, readID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, rev)
}

func (h *Handler) ListByBook(w http.ResponseWriter, r *http.Request) {
	bookID := strings.TrimSpace(chi.URLParam(r, "bookID"))
	cursor := strings.TrimSpace(r.URL.Query().Get("cursor"))
	limit := 20
	if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
		if parsed, err := strconv.Atoi(rawLimit); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), reviewRequestTimeout)
	defer cancel()

	page, err := h.service.ListByBook(ctx, bookID, cursor, limit)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	meta := map[string]any{
		"has_more": page.HasMore,
	}
	if page.NextCursor != nil {
		meta["next_cursor"] = *page.NextCursor
	}

	reviews := page.Reviews
	if reviews == nil {
		reviews = []review.Review{}
	}
	response.WriteJSONWithMeta(w, http.StatusOK, reviews, meta)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}

	reviewID := strings.TrimSpace(chi.URLParam(r, "reviewID"))

	var req updateReviewRequest
	if !decodeJSON(w, r, &req) {
		writeInvalidRequest(w, r)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), reviewRequestTimeout)
	defer cancel()

	rev, err := h.service.Update(ctx, userID, reviewID, review.UpdateInput{
		Body:             req.Body,
		ContainsSpoilers: req.ContainsSpoilers,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, rev)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}

	reviewID := strings.TrimSpace(chi.URLParam(r, "reviewID"))

	ctx, cancel := context.WithTimeout(r.Context(), reviewRequestTimeout)
	defer cancel()

	if err := h.service.Delete(ctx, userID, reviewID); err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, review.ErrInvalidInput):
		response.WriteError(w, r, http.StatusBadRequest, "invalid_request", "review parameters are invalid")
	case errors.Is(err, review.ErrNotFound):
		response.WriteError(w, r, http.StatusNotFound, "not_found", "review or reading entry not found")
	case errors.Is(err, review.ErrConflict):
		response.WriteError(w, r, http.StatusConflict, "review_already_exists", "a review already exists for this reading entry")
	case errors.Is(err, review.ErrForbidden):
		response.WriteError(w, r, http.StatusForbidden, "forbidden", "not authorized to modify this review")
	default:
		h.log.Error().Err(err).Str("request_id", chimiddleware.GetReqID(r.Context())).Msg("review request failed")
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
	response.WriteError(w, r, http.StatusBadRequest, "invalid_request", "invalid review payload")
}

func writeUnauthenticated(w http.ResponseWriter, r *http.Request) {
	response.WriteError(w, r, http.StatusUnauthorized, "unauthenticated", "authentication is required")
}
