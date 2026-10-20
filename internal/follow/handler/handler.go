package handler

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	authmiddleware "github.com/scripd-app/scripd/internal/auth/middleware"
	"github.com/scripd-app/scripd/internal/follow"
	"github.com/scripd-app/scripd/internal/platform/middleware"
	"github.com/scripd-app/scripd/internal/platform/response"
)

const followRequestTimeout = 10 * time.Second

type followService interface {
	Follow(ctx context.Context, followerID, targetUsername string) error
	Unfollow(ctx context.Context, followerID, targetUsername string) error
	GetStatus(ctx context.Context, viewerID, targetUsername string) (follow.FollowStatus, error)
	ListFollowers(ctx context.Context, targetUsername string, limit int) ([]follow.FollowUser, error)
	ListFollowing(ctx context.Context, targetUsername string, limit int) ([]follow.FollowUser, error)
}

type Handler struct {
	service         followService
	requireUser     func(http.Handler) http.Handler
	requireVerified func(http.Handler) http.Handler
	log             zerolog.Logger
}

func New(svc followService, requireUser, requireVerified func(http.Handler) http.Handler, log zerolog.Logger) *Handler {
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
	router.Get("/users/{username}/follow-status", h.GetStatus)
	router.Get("/users/{username}/followers", h.ListFollowers)
	router.Get("/users/{username}/following", h.ListFollowing)

	// Protected routes (gated behind verified user)
	router.With(h.requireVerified, mutationLimit).Post("/users/{username}/follow", h.Follow)
	router.With(h.requireUser, mutationLimit).Delete("/users/{username}/follow", h.Unfollow)
}

func (h *Handler) Follow(w http.ResponseWriter, r *http.Request) {
	followerID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}

	targetUsername := strings.TrimSpace(chi.URLParam(r, "username"))

	ctx, cancel := context.WithTimeout(r.Context(), followRequestTimeout)
	defer cancel()

	if err := h.service.Follow(ctx, followerID, targetUsername); err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]bool{"following": true})
}

func (h *Handler) Unfollow(w http.ResponseWriter, r *http.Request) {
	followerID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}

	targetUsername := strings.TrimSpace(chi.URLParam(r, "username"))

	ctx, cancel := context.WithTimeout(r.Context(), followRequestTimeout)
	defer cancel()

	if err := h.service.Unfollow(ctx, followerID, targetUsername); err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]bool{"following": false})
}

func (h *Handler) GetStatus(w http.ResponseWriter, r *http.Request) {
	viewerID, _ := authmiddleware.UserID(r.Context())
	targetUsername := strings.TrimSpace(chi.URLParam(r, "username"))

	ctx, cancel := context.WithTimeout(r.Context(), followRequestTimeout)
	defer cancel()

	status, err := h.service.GetStatus(ctx, viewerID, targetUsername)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, status)
}

func (h *Handler) ListFollowers(w http.ResponseWriter, r *http.Request) {
	targetUsername := strings.TrimSpace(chi.URLParam(r, "username"))
	limit := 20
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), followRequestTimeout)
	defer cancel()

	users, err := h.service.ListFollowers(ctx, targetUsername, limit)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, users)
}

func (h *Handler) ListFollowing(w http.ResponseWriter, r *http.Request) {
	targetUsername := strings.TrimSpace(chi.URLParam(r, "username"))
	limit := 20
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), followRequestTimeout)
	defer cancel()

	users, err := h.service.ListFollowing(ctx, targetUsername, limit)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, users)
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, follow.ErrUserNotFound):
		response.WriteError(w, r, http.StatusNotFound, "not_found", "user not found")
	case errors.Is(err, follow.ErrCannotFollowSelf):
		response.WriteError(w, r, http.StatusBadRequest, "cannot_follow_self", "you cannot follow yourself")
	case errors.Is(err, follow.ErrAlreadyFollowing):
		response.WriteError(w, r, http.StatusConflict, "already_following", "you are already following this user")
	case errors.Is(err, follow.ErrNotFollowing):
		response.WriteError(w, r, http.StatusConflict, "not_following", "you are not following this user")
	default:
		h.log.Error().Err(err).Str("request_id", chimiddleware.GetReqID(r.Context())).Msg("follow request failed")
		response.WriteError(w, r, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
	}
}

func writeUnauthenticated(w http.ResponseWriter, r *http.Request) {
	response.WriteError(w, r, http.StatusUnauthorized, "unauthenticated", "authentication is required")
}
