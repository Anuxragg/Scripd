package middleware

import (
	"context"
	"errors"
	"net/http"
	"time"

	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	"github.com/scripd-app/scripd/internal/auth/service"
	"github.com/scripd-app/scripd/internal/platform/response"
)

const AccessCookieName = "scripd_access"

const authenticationTimeout = 5 * time.Second

type authenticator interface {
	CurrentUser(context.Context, string) (service.Profile, error)
}

type Middleware struct {
	authenticator authenticator
	allowedOrigin map[string]struct{}
	log           zerolog.Logger
}

func New(auth authenticator, allowedOrigins []string, log zerolog.Logger) *Middleware {
	origins := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		origins[origin] = struct{}{}
	}
	return &Middleware{authenticator: auth, allowedOrigin: origins, log: log}
}

func (m *Middleware) RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if !safeMethod(r.Method) && !m.originAllowed(r) {
			response.WriteError(w, r, http.StatusForbidden, "origin_not_allowed", "request origin is not allowed")
			return
		}
		cookie, err := r.Cookie(AccessCookieName)
		if err != nil || cookie.Value == "" {
			response.WriteError(w, r, http.StatusUnauthorized, "unauthenticated", "authentication is required")
			return
		}
		authCtx, cancel := context.WithTimeout(r.Context(), authenticationTimeout)
		defer cancel()
		profile, err := m.authenticator.CurrentUser(authCtx, cookie.Value)
		if errors.Is(err, service.ErrInvalidSession) {
			response.WriteError(w, r, http.StatusUnauthorized, "unauthenticated", "authentication is required")
			return
		}
		if errors.Is(err, context.DeadlineExceeded) {
			w.Header().Set("Retry-After", "1")
			response.WriteError(w, r, http.StatusServiceUnavailable, "authentication_unavailable", "session verification is temporarily unavailable")
			return
		}
		if err != nil {
			m.log.Error().Err(err).Str("request_id", chimiddleware.GetReqID(r.Context())).Msg("authenticated request failed")
			response.WriteError(w, r, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
			return
		}
		ctx := context.WithValue(r.Context(), userIDContextKey{}, profile.ID)
		ctx = context.WithValue(ctx, emailVerifiedContextKey{}, profile.EmailVerified)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (m *Middleware) RequireVerifiedUser(next http.Handler) http.Handler {
	return m.RequireUser(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		verified, _ := r.Context().Value(emailVerifiedContextKey{}).(bool)
		if !verified {
			response.WriteError(w, r, http.StatusForbidden, "email_verification_required", "verify your email address before using this feature")
			return
		}
		next.ServeHTTP(w, r)
	}))
}

func UserID(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(userIDContextKey{}).(string)
	return userID, ok && userID != ""
}

func (m *Middleware) originAllowed(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	_, allowed := m.allowedOrigin[origin]
	return allowed
}

func safeMethod(method string) bool {
	return method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions
}

type userIDContextKey struct{}
type emailVerifiedContextKey struct{}
