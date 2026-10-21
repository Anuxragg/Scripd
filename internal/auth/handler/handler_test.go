package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	"github.com/scripd-app/scripd/internal/auth/service"
)

func TestRegisterSetsSecureHttpOnlySessionCookies(t *testing.T) {
	now := time.Now().UTC()
	stub := &stubAuthService{result: service.SessionResult{
		User:             service.Profile{ID: "7f5e4d3c-2b1a-4f09-8e7d-6c5b4a392817", Username: "reader_one", Email: "reader@example.com", DisplayName: "Reader", CreatedAt: now},
		AccessToken:      "access-token-value",
		RefreshToken:     "refresh-token-value",
		AccessExpiresAt:  now.Add(15 * time.Minute),
		RefreshExpiresAt: now.Add(30 * 24 * time.Hour),
	}}
	router := chi.NewRouter()
	New(stub, true, []string{"https://app.example"}, zerolog.Nop()).RegisterRoutes(router)

	request := httptest.NewRequest(http.MethodPost, "/auth/register", strings.NewReader(`{"username":"reader_one","email":"reader@example.com","password":"correct horse battery"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://app.example")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d: %s", response.Code, http.StatusCreated, response.Body.String())
	}
	if got := response.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("Cache-Control = %q, want no-store", got)
	}
	cookies := response.Result().Cookies()
	if len(cookies) != 2 {
		t.Fatalf("cookie count = %d, want 2", len(cookies))
	}
	byName := make(map[string]*http.Cookie, len(cookies))
	for _, cookie := range cookies {
		byName[cookie.Name] = cookie
		if !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteStrictMode {
			t.Errorf("cookie %q missing secure attributes: %#v", cookie.Name, cookie)
		}
	}
	if cookie := byName[accessCookieName]; cookie == nil || cookie.Path != "/" {
		t.Errorf("access cookie = %#v", cookie)
	}
	if cookie := byName[refreshCookieName]; cookie == nil || cookie.Path != refreshCookiePath {
		t.Errorf("refresh cookie = %#v", cookie)
	}
	if strings.Contains(response.Body.String(), stub.result.AccessToken) || strings.Contains(response.Body.String(), stub.result.RefreshToken) {
		t.Fatal("response body exposed a session token")
	}
}

func TestLoginRejectsUnapprovedOriginBeforeCallingService(t *testing.T) {
	stub := &stubAuthService{}
	router := chi.NewRouter()
	New(stub, false, []string{"https://app.example"}, zerolog.Nop()).RegisterRoutes(router)

	request := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(`{"identifier":"reader_one","password":"password"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://attacker.example")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusForbidden)
	}
	if stub.loginCalls != 0 {
		t.Fatalf("login calls = %d, want 0", stub.loginCalls)
	}
}

type stubAuthService struct {
	result     service.SessionResult
	loginCalls int
}

func (s *stubAuthService) Register(context.Context, string, string, string, string) (service.SessionResult, error) {
	return s.result, nil
}

func (s *stubAuthService) Login(context.Context, string, string) (service.SessionResult, error) {
	s.loginCalls++
	return s.result, nil
}

func (s *stubAuthService) Refresh(context.Context, string) (service.SessionResult, error) {
	return s.result, nil
}

func (s *stubAuthService) Logout(context.Context, string) error {
	return nil
}

func (s *stubAuthService) CurrentUser(context.Context, string) (service.Profile, error) {
	return s.result.User, nil
}

func (s *stubAuthService) ChangePassword(context.Context, string, string, string) error {
	return nil
}

func (s *stubAuthService) DeleteAccount(context.Context, string, string) error {
	return nil
}

func TestChangePasswordClearsCookiesAndReturnsStatus(t *testing.T) {
	stub := &stubAuthService{result: service.SessionResult{
		User: service.Profile{ID: "7f5e4d3c-2b1a-4f09-8e7d-6c5b4a392817", Username: "reader_one"},
	}}
	router := chi.NewRouter()
	New(stub, true, []string{"https://app.example"}, zerolog.Nop()).RegisterRoutes(router)

	request := httptest.NewRequest(http.MethodPost, "/auth/change-password", strings.NewReader(`{"current_password":"oldPassword123","new_password":"newPassword123"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://app.example")
	request.AddCookie(&http.Cookie{Name: accessCookieName, Value: "valid-access-token"})

	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", response.Code, http.StatusOK, response.Body.String())
	}
	if !strings.Contains(response.Body.String(), `"status":"password_updated"`) {
		t.Fatalf("unexpected body: %s", response.Body.String())
	}
	cookies := response.Result().Cookies()
	if len(cookies) != 2 {
		t.Fatalf("cookie count = %d, want 2", len(cookies))
	}
	for _, cookie := range cookies {
		if cookie.MaxAge != -1 || cookie.Value != "" {
			t.Errorf("cookie %q was not cleared: %#v", cookie.Name, cookie)
		}
	}
}

func TestDeleteAccountClearsCookiesAndReturnsStatus(t *testing.T) {
	stub := &stubAuthService{result: service.SessionResult{
		User: service.Profile{ID: "7f5e4d3c-2b1a-4f09-8e7d-6c5b4a392817", Username: "reader_one"},
	}}
	router := chi.NewRouter()
	New(stub, true, []string{"https://app.example"}, zerolog.Nop()).RegisterRoutes(router)

	request := httptest.NewRequest(http.MethodPost, "/auth/delete-account", strings.NewReader(`{"current_password":"oldPassword123"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://app.example")
	request.AddCookie(&http.Cookie{Name: accessCookieName, Value: "valid-access-token"})

	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", response.Code, http.StatusOK, response.Body.String())
	}
	if !strings.Contains(response.Body.String(), `"status":"account_deleted"`) {
		t.Fatalf("unexpected body: %s", response.Body.String())
	}
	cookies := response.Result().Cookies()
	if len(cookies) != 2 {
		t.Fatalf("cookie count = %d, want 2", len(cookies))
	}
	for _, cookie := range cookies {
		if cookie.MaxAge != -1 || cookie.Value != "" {
			t.Errorf("cookie %q was not cleared: %#v", cookie.Name, cookie)
		}
	}
}
