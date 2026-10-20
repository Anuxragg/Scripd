package handler

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	authmiddleware "github.com/scripd-app/scripd/internal/auth/middleware"
	"github.com/scripd-app/scripd/internal/feed"
	"github.com/scripd-app/scripd/internal/platform/response"
)

const requestTimeout = 10 * time.Second

type feedService interface {
	GetTimeline(ctx context.Context, userID string, limit int, cursor string) (feed.FeedPage, error)
}

type Handler struct {
	service     feedService
	requireUser func(http.Handler) http.Handler
	log         zerolog.Logger
}

func New(svc feedService, requireUser func(http.Handler) http.Handler, log zerolog.Logger) *Handler {
	return &Handler{
		service:     svc,
		requireUser: requireUser,
		log:         log,
	}
}

func (h *Handler) RegisterRoutes(router chi.Router) {
	router.With(h.requireUser).Get("/feed", h.GetTimeline)
}

func (h *Handler) GetTimeline(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmiddleware.UserID(r.Context())
	if !ok || strings.TrimSpace(userID) == "" {
		response.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	cursor := r.URL.Query().Get("cursor")

	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	page, err := h.service.GetTimeline(ctx, userID, limit, cursor)
	if err != nil {
		if strings.Contains(err.Error(), "invalid cursor") {
			response.WriteError(w, r, http.StatusBadRequest, "invalid_cursor", "the provided cursor is invalid")
			return
		}
		h.log.Error().Err(err).Str("user_id", userID).Msg("failed to load timeline feed")
		response.WriteError(w, r, http.StatusInternalServerError, "internal_error", "unable to load activity feed")
		return
	}

	response.WriteJSONWithMeta(w, http.StatusOK, page.Items, map[string]any{
		"next_cursor": page.NextCursor,
		"has_more":    page.HasMore,
	})
}
