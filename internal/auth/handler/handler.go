package handler

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	authdomain "github.com/scripd-app/scripd/internal/auth"
	authmiddleware "github.com/scripd-app/scripd/internal/auth/middleware"
	"github.com/scripd-app/scripd/internal/auth/service"
	platformmiddleware "github.com/scripd-app/scripd/internal/platform/middleware"
	"github.com/scripd-app/scripd/internal/platform/response"
)

const (
	accessCookieName  = authmiddleware.AccessCookieName
	refreshCookieName = "scripd_refresh"
	refreshCookiePath = "/api/v1/auth"
	maximumBodyBytes  = 32 * 1024
)

type authService interface {
	Register(context.Context, string, string, string, string) (service.SessionResult, error)
	Login(context.Context, string, string) (service.SessionResult, error)
	Refresh(context.Context, string) (service.SessionResult, error)
	Logout(context.Context, string) error
	CurrentUser(context.Context, string) (service.Profile, error)
	ChangePassword(context.Context, string, string, string) error
	DeleteAccount(context.Context, string, string) error
}

type emailVerificationService interface {
	VerifyEmail(context.Context, string) error
	ResendEmailVerification(context.Context, string) error
}

type Handler struct {
	service       authService
	secureCookies bool
	allowedOrigin map[string]struct{}
	log           zerolog.Logger
}

type registerRequest struct {
	Username    string `json:"username"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Password    string `json:"password"`
}

type loginRequest struct {
	Identifier string `json:"identifier"`
	Password   string `json:"password"`
}

type verifyEmailRequest struct {
	Token string `json:"token"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type deleteAccountRequest struct {
	CurrentPassword string `json:"current_password"`
}

func New(service authService, secureCookies bool, origins []string, log zerolog.Logger) *Handler {
	allowedOrigins := make(map[string]struct{}, len(origins))
	for _, origin := range origins {
		allowedOrigins[origin] = struct{}{}
	}
	return &Handler{service: service, secureCookies: secureCookies, allowedOrigin: allowedOrigins, log: log}
}

func (h *Handler) RegisterRoutes(router chi.Router) {
	router.Route("/auth", func(authRouter chi.Router) {
		authRouter.Use(noStore)
		authRouter.With(platformmiddleware.RateLimit(5, time.Hour)).Post("/register", h.Register)
		authRouter.With(platformmiddleware.RateLimit(10, 15*time.Minute)).Post("/login", h.Login)
		authRouter.With(platformmiddleware.RateLimit(30, 15*time.Minute)).Post("/refresh", h.Refresh)
		authRouter.With(platformmiddleware.RateLimit(30, 15*time.Minute)).Post("/logout", h.Logout)
		authRouter.With(platformmiddleware.RateLimit(10, 15*time.Minute)).Post("/email/verify", h.VerifyEmail)
		authRouter.With(platformmiddleware.RateLimit(3, time.Hour)).Post("/email/verification/resend", h.ResendEmailVerification)
		authRouter.With(platformmiddleware.RateLimit(5, 15*time.Minute)).Post("/change-password", h.ChangePassword)
		authRouter.With(platformmiddleware.RateLimit(5, 15*time.Minute)).Post("/delete-account", h.DeleteAccount)
		authRouter.Get("/me", h.Me)
	})
}

func noStore(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	if !h.checkOrigin(w, r) {
		return
	}
	var request registerRequest
	if !decodeJSON(w, r, &request) {
		response.WriteError(w, r, http.StatusBadRequest, "invalid_request", "request body is invalid")
		return
	}
	result, err := h.service.Register(r.Context(), request.Username, request.Email, request.DisplayName, request.Password)
	if err != nil {
		h.writeFailure(w, r, err)
		return
	}
	if result.NotificationError != nil {
		h.log.Error().Err(result.NotificationError).Str("request_id", requestID(r)).Msg("verification email delivery failed after registration")
	}
	h.setSessionCookies(w, result)
	response.WriteJSON(w, http.StatusCreated, result.User)
}

func (h *Handler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	if !h.checkOrigin(w, r) {
		return
	}
	var request verifyEmailRequest
	if !decodeJSON(w, r, &request) || request.Token == "" {
		response.WriteError(w, r, http.StatusBadRequest, "invalid_request", "request body is invalid")
		return
	}
	verification, ok := h.service.(emailVerificationService)
	if !ok {
		h.log.Error().Str("request_id", requestID(r)).Msg("email verification service is unavailable")
		response.WriteError(w, r, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
		return
	}
	if err := verification.VerifyEmail(r.Context(), request.Token); err != nil {
		if errors.Is(err, service.ErrInvalidVerificationToken) {
			response.WriteError(w, r, http.StatusBadRequest, "invalid_verification_token", "verification link is invalid or expired")
			return
		}
		h.writeFailure(w, r, err)
		return
	}
	response.WriteJSON(w, http.StatusOK, map[string]bool{"email_verified": true})
}

func (h *Handler) ResendEmailVerification(w http.ResponseWriter, r *http.Request) {
	if !h.checkOrigin(w, r) {
		return
	}
	cookie, err := r.Cookie(accessCookieName)
	if err != nil || cookie.Value == "" {
		response.WriteError(w, r, http.StatusUnauthorized, "unauthenticated", "authentication is required")
		return
	}
	profile, err := h.service.CurrentUser(r.Context(), cookie.Value)
	if err != nil {
		h.writeFailure(w, r, err)
		return
	}
	verification, ok := h.service.(emailVerificationService)
	if !ok {
		h.log.Error().Str("request_id", requestID(r)).Msg("email verification service is unavailable")
		response.WriteError(w, r, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
		return
	}
	if err := verification.ResendEmailVerification(r.Context(), profile.ID); err != nil {
		h.writeFailure(w, r, err)
		return
	}
	response.WriteJSON(w, http.StatusAccepted, map[string]bool{"accepted": true})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	if !h.checkOrigin(w, r) {
		return
	}
	var request loginRequest
	if !decodeJSON(w, r, &request) {
		response.WriteError(w, r, http.StatusBadRequest, "invalid_request", "request body is invalid")
		return
	}
	result, err := h.service.Login(r.Context(), request.Identifier, request.Password)
	if err != nil {
		h.writeFailure(w, r, err)
		return
	}
	h.setSessionCookies(w, result)
	response.WriteJSON(w, http.StatusOK, result.User)
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	if !h.checkOrigin(w, r) {
		return
	}
	cookie, err := r.Cookie(refreshCookieName)
	if err != nil || cookie.Value == "" {
		h.clearSessionCookies(w)
		response.WriteError(w, r, http.StatusUnauthorized, "invalid_session", "session is invalid or expired")
		return
	}
	result, err := h.service.Refresh(r.Context(), cookie.Value)
	if err != nil {
		if errors.Is(err, service.ErrInvalidSession) {
			h.clearSessionCookies(w)
		}
		h.writeFailure(w, r, err)
		return
	}
	h.setSessionCookies(w, result)
	response.WriteJSON(w, http.StatusOK, result.User)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if !h.checkOrigin(w, r) {
		return
	}
	cookie, _ := r.Cookie(refreshCookieName)
	refreshToken := ""
	if cookie != nil {
		refreshToken = cookie.Value
	}
	err := h.service.Logout(r.Context(), refreshToken)
	h.clearSessionCookies(w)
	if err != nil {
		h.writeFailure(w, r, err)
		return
	}
	response.WriteJSON(w, http.StatusOK, map[string]bool{"logged_out": true})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(accessCookieName)
	if err != nil || cookie.Value == "" {
		response.WriteError(w, r, http.StatusUnauthorized, "unauthenticated", "authentication is required")
		return
	}
	profile, err := h.service.CurrentUser(r.Context(), cookie.Value)
	if err != nil {
		h.writeFailure(w, r, err)
		return
	}
	response.WriteJSON(w, http.StatusOK, profile)
}

func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	if !h.checkOrigin(w, r) {
		return
	}
	cookie, err := r.Cookie(accessCookieName)
	if err != nil || cookie.Value == "" {
		response.WriteError(w, r, http.StatusUnauthorized, "unauthenticated", "authentication is required")
		return
	}
	profile, err := h.service.CurrentUser(r.Context(), cookie.Value)
	if err != nil {
		h.writeFailure(w, r, err)
		return
	}
	var request changePasswordRequest
	if !decodeJSON(w, r, &request) || request.CurrentPassword == "" || request.NewPassword == "" {
		response.WriteError(w, r, http.StatusBadRequest, "invalid_request", "request body is invalid")
		return
	}
	if err := h.service.ChangePassword(r.Context(), profile.ID, request.CurrentPassword, request.NewPassword); err != nil {
		h.writeFailure(w, r, err)
		return
	}
	h.clearSessionCookies(w)
	response.WriteJSON(w, http.StatusOK, map[string]string{"status": "password_updated"})
}

func (h *Handler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	if !h.checkOrigin(w, r) {
		return
	}
	cookie, err := r.Cookie(accessCookieName)
	if err != nil || cookie.Value == "" {
		response.WriteError(w, r, http.StatusUnauthorized, "unauthenticated", "authentication is required")
		return
	}
	profile, err := h.service.CurrentUser(r.Context(), cookie.Value)
	if err != nil {
		h.writeFailure(w, r, err)
		return
	}
	var request deleteAccountRequest
	if !decodeJSON(w, r, &request) || request.CurrentPassword == "" {
		response.WriteError(w, r, http.StatusBadRequest, "invalid_request", "request body is invalid")
		return
	}
	if err := h.service.DeleteAccount(r.Context(), profile.ID, request.CurrentPassword); err != nil {
		h.writeFailure(w, r, err)
		return
	}
	h.clearSessionCookies(w)
	response.WriteJSON(w, http.StatusOK, map[string]string{"status": "account_deleted"})
}

func (h *Handler) checkOrigin(w http.ResponseWriter, r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	if _, allowed := h.allowedOrigin[origin]; allowed {
		return true
	}
	response.WriteError(w, r, http.StatusForbidden, "origin_not_allowed", "request origin is not allowed")
	return false
}

func (h *Handler) setSessionCookies(w http.ResponseWriter, result service.SessionResult) {
	http.SetCookie(w, &http.Cookie{
		Name: accessCookieName, Value: result.AccessToken, Path: "/", Expires: result.AccessExpiresAt,
		MaxAge: cookieMaxAge(result.AccessExpiresAt), HttpOnly: true, Secure: h.secureCookies,
		SameSite: http.SameSiteStrictMode,
	})
	http.SetCookie(w, &http.Cookie{
		Name: refreshCookieName, Value: result.RefreshToken, Path: refreshCookiePath, Expires: result.RefreshExpiresAt,
		MaxAge: cookieMaxAge(result.RefreshExpiresAt), HttpOnly: true, Secure: h.secureCookies,
		SameSite: http.SameSiteStrictMode,
	})
}

func (h *Handler) clearSessionCookies(w http.ResponseWriter) {
	expires := time.Unix(0, 0)
	for _, cookie := range []*http.Cookie{
		{Name: accessCookieName, Path: "/"},
		{Name: refreshCookieName, Path: refreshCookiePath},
	} {
		cookie.Value = ""
		cookie.Expires = expires
		cookie.MaxAge = -1
		cookie.HttpOnly = true
		cookie.Secure = h.secureCookies
		cookie.SameSite = http.SameSiteStrictMode
		http.SetCookie(w, cookie)
	}
}

func (h *Handler) writeFailure(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, service.ErrInvalidInput):
		response.WriteError(w, r, http.StatusBadRequest, "invalid_request", "request values are invalid")
	case errors.Is(err, authdomain.ErrEmailInUse), errors.Is(err, authdomain.ErrUsernameInUse):
		response.WriteError(w, r, http.StatusConflict, "registration_unavailable", "account could not be created with those details")
	case errors.Is(err, service.ErrInvalidCredentials):
		response.WriteError(w, r, http.StatusUnauthorized, "invalid_credentials", "username or password is incorrect")
	case errors.Is(err, service.ErrInvalidSession):
		response.WriteError(w, r, http.StatusUnauthorized, "invalid_session", "session is invalid or expired")
	case errors.Is(err, service.ErrInvalidVerificationToken):
		response.WriteError(w, r, http.StatusBadRequest, "invalid_verification_token", "verification link is invalid or expired")
	default:
		h.log.Error().Err(err).Str("request_id", requestID(r)).Msg("authentication request failed")
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
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return false
	}
	return true
}

func cookieMaxAge(expiration time.Time) int {
	seconds := int(time.Until(expiration).Seconds())
	if seconds < 1 {
		return 1
	}
	return seconds
}

func requestID(r *http.Request) string {
	return chimiddleware.GetReqID(r.Context())
}
