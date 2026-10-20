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
	"github.com/scripd-app/scripd/internal/platform/middleware"
	"github.com/scripd-app/scripd/internal/platform/response"
	"github.com/scripd-app/scripd/internal/user"
)

const (
	maximumBodyBytes   = 16 * 1024
	userRequestTimeout = 10 * time.Second
)

type userService interface {
	GetProfile(ctx context.Context, username string) (user.PublicProfile, error)
	GetStats(ctx context.Context, username string) (user.ProfileStats, error)
	UpdateProfile(ctx context.Context, userID string, input user.UpdateProfileInput) (user.PublicProfile, error)
}

type Handler struct {
	service     userService
	requireUser func(http.Handler) http.Handler
	log         zerolog.Logger
}

type updateProfileRequest struct {
	DisplayName *string `json:"display_name"`
	Bio         *string `json:"bio"`
	AvatarURL   *string `json:"avatar_url"`
}

func New(service userService, requireUser func(http.Handler) http.Handler, log zerolog.Logger) *Handler {
	return &Handler{
		service:     service,
		requireUser: requireUser,
		log:         log,
	}
}

func (h *Handler) RegisterRoutes(router chi.Router) {
	mutationLimit := middleware.RateLimit(60, time.Minute)

	// Public routes
	router.Get("/users/{username}", h.GetProfile)
	router.Get("/users/{username}/stats", h.GetStats)

	// Protected routes
	router.With(h.requireUser, mutationLimit).Patch("/users/me", h.UpdateProfile)
}

func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	username := strings.TrimSpace(chi.URLParam(r, "username"))

	ctx, cancel := context.WithTimeout(r.Context(), userRequestTimeout)
	defer cancel()

	profile, err := h.service.GetProfile(ctx, username)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, profile)
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	username := strings.TrimSpace(chi.URLParam(r, "username"))

	ctx, cancel := context.WithTimeout(r.Context(), userRequestTimeout)
	defer cancel()

	stats, err := h.service.GetStats(ctx, username)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, stats)
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok {
		writeUnauthenticated(w, r)
		return
	}

	var req updateProfileRequest
	if !decodeJSON(w, r, &req) {
		writeInvalidRequest(w, r)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), userRequestTimeout)
	defer cancel()

	profile, err := h.service.UpdateProfile(ctx, userID, user.UpdateProfileInput{
		DisplayName: req.DisplayName,
		Bio:         req.Bio,
		AvatarURL:   req.AvatarURL,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, profile)
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, user.ErrInvalidInput):
		response.WriteError(w, r, http.StatusBadRequest, "invalid_request", "profile data is invalid")
	case errors.Is(err, user.ErrNotFound):
		response.WriteError(w, r, http.StatusNotFound, "not_found", "user not found")
	default:
		h.log.Error().Err(err).Str("request_id", chimiddleware.GetReqID(r.Context())).Msg("user profile request failed")
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
	response.WriteError(w, r, http.StatusBadRequest, "invalid_request", "invalid profile payload")
}

func writeUnauthenticated(w http.ResponseWriter, r *http.Request) {
	response.WriteError(w, r, http.StatusUnauthorized, "unauthenticated", "authentication is required")
}
