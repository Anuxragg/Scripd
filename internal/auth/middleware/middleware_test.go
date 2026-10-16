package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/scripd-app/scripd/internal/auth/service"
	"github.com/stretchr/testify/require"
)

func TestRequireUserAddsMemberIDAndPreventsCaching(t *testing.T) {
	profile := service.Profile{ID: "0c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d", Username: "reader_one", CreatedAt: time.Now().UTC()}
	stub := &stubAuthenticator{profile: profile}
	var gotUserID string
	handler := New(stub, []string{"https://app.example"}, zerolog.Nop()).RequireUser(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUserID, _ = UserID(r.Context())
		w.WriteHeader(http.StatusNoContent)
	}))
	request := httptest.NewRequest(http.MethodPost, "/api/v1/reads", nil)
	request.AddCookie(&http.Cookie{Name: AccessCookieName, Value: "valid-token"})
	request.Header.Set("Origin", "https://app.example")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	require.Equal(t, http.StatusNoContent, response.Code)
	require.Equal(t, profile.ID, gotUserID)
	require.Equal(t, "no-store", response.Header().Get("Cache-Control"))
	require.Equal(t, 1, stub.calls)
}

func TestRequireUserRejectsMissingCookieAndUntrustedOrigin(t *testing.T) {
	for _, test := range []struct {
		name   string
		origin string
		cookie bool
		status int
	}{
		{name: "missing cookie", status: http.StatusUnauthorized},
		{name: "untrusted origin", origin: "https://attacker.example", cookie: true, status: http.StatusForbidden},
	} {
		t.Run(test.name, func(t *testing.T) {
			stub := &stubAuthenticator{}
			handler := New(stub, []string{"https://app.example"}, zerolog.Nop()).RequireUser(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
			request := httptest.NewRequest(http.MethodPost, "/api/v1/reads", nil)
			if test.cookie {
				request.AddCookie(&http.Cookie{Name: AccessCookieName, Value: "token"})
			}
			if test.origin != "" {
				request.Header.Set("Origin", test.origin)
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			require.Equal(t, test.status, response.Code)
			require.Equal(t, "no-store", response.Header().Get("Cache-Control"))
			require.Zero(t, stub.calls)
		})
	}
}

func TestRequireUserBoundsSessionVerification(t *testing.T) {
	stub := &stubAuthenticator{err: context.DeadlineExceeded}
	handler := New(stub, nil, zerolog.Nop()).RequireUser(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	request := httptest.NewRequest(http.MethodGet, "/api/v1/reads", nil)
	request.AddCookie(&http.Cookie{Name: AccessCookieName, Value: "token"})
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	require.Equal(t, http.StatusServiceUnavailable, response.Code)
	require.Equal(t, "1", response.Header().Get("Retry-After"))
	require.Equal(t, "no-store", response.Header().Get("Cache-Control"))
}

func TestRequireUserDoesNotExposeAuthenticationStoreErrors(t *testing.T) {
	stub := &stubAuthenticator{err: errors.New("private database detail")}
	handler := New(stub, nil, zerolog.Nop()).RequireUser(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	request := httptest.NewRequest(http.MethodGet, "/api/v1/reads", nil)
	request.AddCookie(&http.Cookie{Name: AccessCookieName, Value: "token"})
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	require.Equal(t, http.StatusInternalServerError, response.Code)
	require.NotContains(t, response.Body.String(), "private database detail")
}

type stubAuthenticator struct {
	profile service.Profile
	err     error
	calls   int
}

func (s *stubAuthenticator) CurrentUser(context.Context, string) (service.Profile, error) {
	s.calls++
	return s.profile, s.err
}
