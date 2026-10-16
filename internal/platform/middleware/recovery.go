package middleware

import (
	"net/http"
	"runtime/debug"

	"github.com/scripd-app/scripd/internal/platform/response"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
)

func Recover(log zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if recovered := recover(); recovered != nil {
					log.Error().
						Str("request_id", chiMiddleware.GetReqID(r.Context())).
						Interface("panic", recovered).
						Bytes("stack", debug.Stack()).
						Msg("request panic recovered")
					response.WriteError(w, r, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}
