package middleware

import (
	"net/http"

	chiMiddleware "github.com/go-chi/chi/v5/middleware"
)

func RequestIDHeader(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Request-ID", chiMiddleware.GetReqID(r.Context()))
		next.ServeHTTP(w, r)
	})
}
