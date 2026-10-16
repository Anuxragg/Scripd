package health

import (
	"context"
	"net/http"
	"time"

	"github.com/scripd-app/scripd/internal/platform/response"
)

type Handler struct {
	dbPing           func(context.Context) error
	readinessTimeout time.Duration
}

func NewHandler(dbPing func(context.Context) error, readinessTimeout time.Duration) Handler {
	return Handler{dbPing: dbPing, readinessTimeout: readinessTimeout}
}

func (h Handler) Liveness(w http.ResponseWriter, _ *http.Request) {
	response.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h Handler) Readiness(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), h.readinessTimeout)
	defer cancel()
	if err := h.dbPing(ctx); err != nil {
		response.WriteError(w, r, http.StatusServiceUnavailable, "not_ready", "service unavailable")
		return
	}
	response.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}
