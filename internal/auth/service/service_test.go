package service

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"testing"
	"time"

	authdomain "github.com/scripd-app/scripd/internal/auth"
)

func TestRegisterNormalizesAccountAndStoresOnlyRefreshHash(t *testing.T) {
	store := newMemoryStore()
	svc := New(store, "test-access-secret-with-at-least-32-bytes")

	result, err := svc.Register(t.Context(), "Reader_One", "Reader@Example.com", " Reader One ", "correct horse battery")
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	if result.User.Username != "reader_one" || result.User.Email != "reader@example.com" || result.User.DisplayName != "Reader One" {
		t.Fatalf("unexpected profile: %#v", result.User)
	}
	if !strings.HasPrefix(store.user.PasswordHash, "$argon2id$v=19$m=65536,t=3,p=2$") {
		t.Fatalf("password was not stored as the configured Argon2id hash: %q", store.user.PasswordHash)
	}
	if strings.Contains(store.user.PasswordHash, "correct horse battery") {
		t.Fatal("stored password hash contains the plaintext password")
	}

	parts := strings.Split(result.RefreshToken, ".")
	if len(parts) != 2 {
		t.Fatalf("refresh token must contain a session ID and secret: %q", result.RefreshToken)
	}
	expectedHash := sha256.Sum256([]byte(parts[1]))
	if got := store.sessions[parts[0]].tokenHash; string(got) != string(expectedHash[:]) {
		t.Fatal("store did not retain the hash of the refresh secret")
	}
	if _, err := svc.CurrentUser(t.Context(), result.AccessToken); err != nil {
		t.Fatalf("CurrentUser() after registration error = %v", err)
	}
}

func TestRegisterRejectsInvalidInputsBeforePersistence(t *testing.T) {
	store := newMemoryStore()
	svc := New(store, "test-access-secret-with-at-least-32-bytes")

	_, err := svc.Register(t.Context(), "ab", "reader@example.com", "", "short")
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("Register() error = %v, want ErrInvalidInput", err)
	}
	if store.user.ID != "" {
		t.Fatal("invalid registration reached persistence")
	}
}

func TestLoginAndRefreshRotationRevokeSessionOnReplay(t *testing.T) {
	store := newMemoryStore()
	svc := New(store, "test-access-secret-with-at-least-32-bytes")
	if _, err := svc.Register(t.Context(), "reader_one", "reader@example.com", "", "correct horse battery"); err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	login, err := svc.Login(t.Context(), "READER@EXAMPLE.COM", "correct horse battery")
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	rotated, err := svc.Refresh(t.Context(), login.RefreshToken)
	if err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}
	if rotated.RefreshToken == login.RefreshToken {
		t.Fatal("Refresh() did not rotate the refresh token")
	}

	_, err = svc.Refresh(t.Context(), login.RefreshToken)
	if !errors.Is(err, ErrInvalidSession) {
		t.Fatalf("replayed Refresh() error = %v, want ErrInvalidSession", err)
	}
	if _, err := svc.CurrentUser(t.Context(), rotated.AccessToken); !errors.Is(err, ErrInvalidSession) {
		t.Fatalf("CurrentUser() after refresh-token replay error = %v, want ErrInvalidSession", err)
	}
}

func TestLogoutRevokesActiveAccessSession(t *testing.T) {
	store := newMemoryStore()
	svc := New(store, "test-access-secret-with-at-least-32-bytes")
	result, err := svc.Register(t.Context(), "reader_one", "reader@example.com", "", "correct horse battery")
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	if err := svc.Logout(t.Context(), result.RefreshToken); err != nil {
		t.Fatalf("Logout() error = %v", err)
	}
	if _, err := svc.CurrentUser(t.Context(), result.AccessToken); !errors.Is(err, ErrInvalidSession) {
		t.Fatalf("CurrentUser() after logout error = %v, want ErrInvalidSession", err)
	}
}

type memorySession struct {
	userID    string
	tokenHash []byte
	expiresAt time.Time
	revoked   bool
}

type memoryStore struct {
	user             authdomain.User
	sessions         map[string]memorySession
	verificationHash []byte
	resetTokenHash   []byte
	nextSession      int
}

func newMemoryStore() *memoryStore {
	return &memoryStore{sessions: make(map[string]memorySession)}
}

func (s *memoryStore) CreateUserWithSession(_ context.Context, user authdomain.User, tokenHash []byte, expiresAt time.Time, verificationHash []byte, _ time.Time) (authdomain.User, string, error) {
	if s.user.ID != "" {
		if s.user.Username == user.Username {
			return authdomain.User{}, "", authdomain.ErrUsernameInUse
		}
		if s.user.Email == user.Email {
			return authdomain.User{}, "", authdomain.ErrEmailInUse
		}
	}
	user.ID = "7f5e4d3c-2b1a-4f09-8e7d-6c5b4a392817"
	user.CreatedAt = time.Now().UTC()
	user.UpdatedAt = user.CreatedAt
	s.user = user
	s.verificationHash = append([]byte(nil), verificationHash...)
	sessionID := s.nextID()
	s.sessions[sessionID] = memorySession{userID: user.ID, tokenHash: append([]byte(nil), tokenHash...), expiresAt: expiresAt}
	return user, sessionID, nil
}

func (s *memoryStore) GetUserByIdentifier(_ context.Context, identifier string) (authdomain.User, error) {
	if s.user.ID == "" || (!strings.EqualFold(s.user.Username, identifier) && !strings.EqualFold(s.user.Email, identifier)) {
		return authdomain.User{}, authdomain.ErrNotFound
	}
	return s.user, nil
}

func (s *memoryStore) GetUserForSession(_ context.Context, userID, sessionID string) (authdomain.User, error) {
	session, ok := s.sessions[sessionID]
	if !ok || session.userID != userID || session.revoked || !session.expiresAt.After(time.Now()) || s.user.ID != userID {
		return authdomain.User{}, authdomain.ErrNotFound
	}
	return s.user, nil
}

func (s *memoryStore) CreateSession(_ context.Context, userID string, tokenHash []byte, expiresAt time.Time) (string, error) {
	if s.user.ID != userID {
		return "", authdomain.ErrNotFound
	}
	sessionID := s.nextID()
	s.sessions[sessionID] = memorySession{userID: userID, tokenHash: append([]byte(nil), tokenHash...), expiresAt: expiresAt}
	return sessionID, nil
}

func (s *memoryStore) RotateSession(_ context.Context, sessionID string, oldHash, newHash []byte, expiresAt time.Time) (authdomain.User, string, error) {
	session, ok := s.sessions[sessionID]
	if !ok || session.revoked || !session.expiresAt.After(time.Now()) {
		return authdomain.User{}, "", authdomain.ErrNotFound
	}
	if string(session.tokenHash) != string(oldHash) {
		session.revoked = true
		s.sessions[sessionID] = session
		return authdomain.User{}, "", authdomain.ErrNotFound
	}
	session.tokenHash = append([]byte(nil), newHash...)
	session.expiresAt = expiresAt
	s.sessions[sessionID] = session
	return s.user, sessionID, nil
}

func (s *memoryStore) RevokeSession(_ context.Context, sessionID string, tokenHash []byte) error {
	session, ok := s.sessions[sessionID]
	if ok && string(session.tokenHash) == string(tokenHash) {
		session.revoked = true
		s.sessions[sessionID] = session
	}
	return nil
}

func (s *memoryStore) IssueEmailVerification(_ context.Context, userID string, tokenHash []byte, _ time.Time) (string, bool, error) {
	if s.user.ID != userID {
		return "", false, authdomain.ErrNotFound
	}
	if s.user.EmailVerified {
		return s.user.Email, true, nil
	}
	s.verificationHash = append([]byte(nil), tokenHash...)
	return s.user.Email, false, nil
}

func (s *memoryStore) VerifyEmail(_ context.Context, tokenHash []byte) error {
	if s.user.ID == "" || string(s.verificationHash) != string(tokenHash) {
		return authdomain.ErrNotFound
	}
	s.user.EmailVerified = true
	s.verificationHash = nil
	return nil
}

func (s *memoryStore) IssuePasswordReset(_ context.Context, email string, tokenHash []byte, _ time.Time) (string, bool, error) {
	if s.user.ID == "" || !strings.EqualFold(s.user.Email, email) {
		return "", true, nil
	}
	s.resetTokenHash = append([]byte(nil), tokenHash...)
	return s.user.Email, false, nil
}

func (s *memoryStore) ResetPassword(_ context.Context, tokenHash []byte, newPasswordHash string) error {
	if s.user.ID == "" || string(s.resetTokenHash) != string(tokenHash) {
		return authdomain.ErrNotFound
	}
	s.user.PasswordHash = newPasswordHash
	s.resetTokenHash = nil
	for k, v := range s.sessions {
		if v.userID == s.user.ID {
			v.revoked = true
			s.sessions[k] = v
		}
	}
	return nil
}

func (s *memoryStore) GetUserByID(_ context.Context, id string) (authdomain.User, error) {
	if s.user.ID != id {
		return authdomain.User{}, authdomain.ErrNotFound
	}
	return s.user, nil
}

func (s *memoryStore) UpdatePassword(_ context.Context, userID, passwordHash string) error {
	if s.user.ID != userID {
		return authdomain.ErrNotFound
	}
	s.user.PasswordHash = passwordHash
	return nil
}

func (s *memoryStore) RevokeAllUserSessions(_ context.Context, userID string) error {
	for k, v := range s.sessions {
		if v.userID == userID {
			v.revoked = true
			s.sessions[k] = v
		}
	}
	return nil
}

func (s *memoryStore) DeleteUser(_ context.Context, userID string) error {
	if s.user.ID != userID {
		return authdomain.ErrNotFound
	}
	s.user = authdomain.User{}
	for k, v := range s.sessions {
		if v.userID == userID {
			delete(s.sessions, k)
		}
	}
	return nil
}

func (s *memoryStore) nextID() string {
	s.nextSession++
	return fmt.Sprintf("00000000-0000-4000-8000-%012x", s.nextSession)
}

func TestChangePasswordSuccessAndRevokesSessions(t *testing.T) {
	store := newMemoryStore()
	svc := New(store, "test-access-secret-with-at-least-32-bytes")
	result, err := svc.Register(t.Context(), "reader_one", "reader@example.com", "", "initial password 123")
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	err = svc.ChangePassword(t.Context(), result.User.ID, "initial password 123", "brand new password 456")
	if err != nil {
		t.Fatalf("ChangePassword() error = %v", err)
	}

	// Verify old session access token is revoked
	if _, err := svc.CurrentUser(t.Context(), result.AccessToken); !errors.Is(err, ErrInvalidSession) {
		t.Fatalf("CurrentUser() after password change error = %v, want ErrInvalidSession", err)
	}

	// Verify old password fails
	if _, err := svc.Login(t.Context(), "reader@example.com", "initial password 123"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("Login() with old password error = %v, want ErrInvalidCredentials", err)
	}

	// Verify new password succeeds
	newLogin, err := svc.Login(t.Context(), "reader@example.com", "brand new password 456")
	if err != nil {
		t.Fatalf("Login() with new password error = %v", err)
	}
	if newLogin.User.ID != result.User.ID {
		t.Fatalf("newLogin user ID = %s, want %s", newLogin.User.ID, result.User.ID)
	}
}

func TestChangePasswordValidations(t *testing.T) {
	store := newMemoryStore()
	svc := New(store, "test-access-secret-with-at-least-32-bytes")
	result, err := svc.Register(t.Context(), "reader_one", "reader@example.com", "", "initial password 123")
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	// Wrong current password
	if err := svc.ChangePassword(t.Context(), result.User.ID, "wrong password", "brand new password 456"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("ChangePassword() error = %v, want ErrInvalidCredentials", err)
	}

	// Short new password
	if err := svc.ChangePassword(t.Context(), result.User.ID, "initial password 123", "short"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("ChangePassword() error = %v, want ErrInvalidInput", err)
	}
}

func TestDeleteAccountSuccessAndRejectsWrongPassword(t *testing.T) {
	store := newMemoryStore()
	svc := New(store, "test-access-secret-with-at-least-32-bytes")
	result, err := svc.Register(t.Context(), "reader_one", "reader@example.com", "", "initial password 123")
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	// Wrong password
	if err := svc.DeleteAccount(t.Context(), result.User.ID, "wrong password"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("DeleteAccount() wrong password error = %v, want ErrInvalidCredentials", err)
	}

	// Correct password
	if err := svc.DeleteAccount(t.Context(), result.User.ID, "initial password 123"); err != nil {
		t.Fatalf("DeleteAccount() error = %v", err)
	}

	// Verify user is gone
	if _, err := svc.Login(t.Context(), "reader@example.com", "initial password 123"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("Login() after deletion error = %v, want ErrInvalidCredentials", err)
	}
}

type stubResetMailer struct {
	sentRecipient string
	sentLink      string
}

func (m *stubResetMailer) SendPasswordReset(_ context.Context, recipient, link string) error {
	m.sentRecipient = recipient
	m.sentLink = link
	return nil
}

func TestPasswordResetFlow(t *testing.T) {
	store := newMemoryStore()
	mailer := &stubResetMailer{}
	svc := New(store, "test-access-secret-with-at-least-32-bytes", WithPasswordReset(mailer, "https://scripd.com"))

	_, err := svc.Register(t.Context(), "reader_one", "reader@example.com", "", "initial password 123")
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	// Request password reset
	if err := svc.RequestPasswordReset(t.Context(), "reader@example.com"); err != nil {
		t.Fatalf("RequestPasswordReset() error = %v", err)
	}
	if mailer.sentRecipient != "reader@example.com" {
		t.Fatalf("sentRecipient = %q, want reader@example.com", mailer.sentRecipient)
	}
	if !strings.HasPrefix(mailer.sentLink, "https://scripd.com/reset-password?token=") {
		t.Fatalf("sentLink = %q, want prefix https://scripd.com/reset-password?token=", mailer.sentLink)
	}

	u, err := url.Parse(mailer.sentLink)
	if err != nil {
		t.Fatalf("url.Parse(sentLink) error = %v", err)
	}
	token := u.Query().Get("token")
	if token == "" {
		t.Fatal("token in reset link is empty")
	}

	// Reset with invalid short password
	if err := svc.ResetPassword(t.Context(), token, "short"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("ResetPassword() short error = %v, want ErrInvalidInput", err)
	}

	// Reset with valid new password
	if err := svc.ResetPassword(t.Context(), token, "new brand password 789"); err != nil {
		t.Fatalf("ResetPassword() error = %v", err)
	}

	// Cannot reuse token
	if err := svc.ResetPassword(t.Context(), token, "another brand password 101"); !errors.Is(err, ErrInvalidResetToken) {
		t.Fatalf("ResetPassword() reuse error = %v, want ErrInvalidResetToken", err)
	}

	// Login with old password should fail
	if _, err := svc.Login(t.Context(), "reader@example.com", "initial password 123"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("Login() old password error = %v, want ErrInvalidCredentials", err)
	}

	// Login with new password should succeed
	loginResult, err := svc.Login(t.Context(), "reader@example.com", "new brand password 789")
	if err != nil {
		t.Fatalf("Login() new password error = %v", err)
	}
	if loginResult.User.Email != "reader@example.com" {
		t.Fatalf("Login() email = %s, want reader@example.com", loginResult.User.Email)
	}
}
