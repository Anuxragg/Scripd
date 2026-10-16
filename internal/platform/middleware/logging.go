package middleware

import (
	"net/http"
	"time"

	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
)

func Logging(log zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			wrapped := chiMiddleware.NewWrapResponseWriter(w, r.ProtoMajor)
			started := time.Now()
			next.ServeHTTP(wrapped, r)
			log.Info().
				Str("request_id", chiMiddleware.GetReqID(r.Context())).
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Int("status", wrapped.Status()).
				Int("bytes", wrapped.BytesWritten()).
				Dur("duration", time.Since(started)).
				Msg("http request")
		})
	}
}
