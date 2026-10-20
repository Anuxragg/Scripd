package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	authmiddleware "github.com/scripd-app/scripd/internal/auth/middleware"
	"github.com/scripd-app/scripd/internal/comment"
	"github.com/scripd-app/scripd/internal/platform/middleware"
	"github.com/scripd-app/scripd/internal/platform/response"
)

const requestTimeout = 10 * time.Second

type commentService interface {
	LikeReview(ctx context.Context, reviewID, userID string) error
	UnlikeReview(ctx context.Context, reviewID, userID string) error
	GetSocialStats(ctx context.Context, reviewID, viewerID string) (comment.ReviewSocialStats, error)
	CreateComment(ctx context.Context, reviewID, userID string, input comment.CreateCommentInput) (comment.Comment, error)
	ListComments(ctx context.Context, reviewID string, limit, offset int) ([]comment.Comment, error)
	DeleteComment(ctx context.Context, commentID, requestingUserID string) error
}

type Handler struct {
	service         commentService
	requireUser     func(http.Handler) http.Handler
	requireVerified func(http.Handler) http.Handler
	log             zerolog.Logger
}

func New(svc commentService, requireUser, requireVerified func(http.Handler) http.Handler, log zerolog.Logger) *Handler {
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
	router.Get("/reviews/{reviewID}/social", h.GetSocialStats)
	router.Get("/reviews/{reviewID}/comments", h.ListComments)

	// Protected routes
	router.With(h.requireVerified, mutationLimit).Post("/reviews/{reviewID}/like", h.LikeReview)
	router.With(h.requireUser, mutationLimit).Delete("/reviews/{reviewID}/like", h.UnlikeReview)
	router.With(h.requireVerified, mutationLimit).Post("/reviews/{reviewID}/comments", h.CreateComment)
	router.With(h.requireUser, mutationLimit).Delete("/reviews/{reviewID}/comments/{commentID}", h.DeleteComment)
}

func (h *Handler) GetSocialStats(w http.ResponseWriter, r *http.Request) {
	reviewID := strings.TrimSpace(chi.URLParam(r, "reviewID"))
	viewerID, _ := authmiddleware.UserID(r.Context())

	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	stats, err := h.service.GetSocialStats(ctx, reviewID, viewerID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, stats)
}

func (h *Handler) LikeReview(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		response.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	reviewID := strings.TrimSpace(chi.URLParam(r, "reviewID"))

	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	if err := h.service.LikeReview(ctx, reviewID, userID); err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]bool{"liked": true})
}

func (h *Handler) UnlikeReview(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		response.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	reviewID := strings.TrimSpace(chi.URLParam(r, "reviewID"))

	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	if err := h.service.UnlikeReview(ctx, reviewID, userID); err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]bool{"liked": false})
}

func (h *Handler) CreateComment(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		response.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	reviewID := strings.TrimSpace(chi.URLParam(r, "reviewID"))

	var input comment.CreateCommentInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.WriteError(w, r, http.StatusBadRequest, "invalid_json", "malformed request payload")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	created, err := h.service.CreateComment(ctx, reviewID, userID, input)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusCreated, created)
}

func (h *Handler) ListComments(w http.ResponseWriter, r *http.Request) {
	reviewID := strings.TrimSpace(chi.URLParam(r, "reviewID"))

	limit := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	offset := 0
	if raw := r.URL.Query().Get("offset"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	comments, err := h.service.ListComments(ctx, reviewID, limit, offset)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, comments)
}

func (h *Handler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		response.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	commentID := strings.TrimSpace(chi.URLParam(r, "commentID"))

	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	if err := h.service.DeleteComment(ctx, commentID, userID); err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, comment.ErrInvalidInput):
		response.WriteError(w, r, http.StatusBadRequest, "invalid_input", "the provided input is invalid")
	case errors.Is(err, comment.ErrCommentNotFound):
		response.WriteError(w, r, http.StatusNotFound, "comment_not_found", "comment not found")
	case errors.Is(err, comment.ErrReviewNotFound):
		response.WriteError(w, r, http.StatusNotFound, "review_not_found", "review not found")
	case errors.Is(err, comment.ErrUnauthorized):
		response.WriteError(w, r, http.StatusForbidden, "forbidden", "not authorized to perform this action")
	default:
		h.log.Error().Err(err).Msg("unhandled comment/like error")
		response.WriteError(w, r, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
	}
}
