package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"net/mail"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/golang-jwt/jwt/v5"
	authdomain "github.com/scripd-app/scripd/internal/auth"
	"golang.org/x/crypto/argon2"
)

var (
	ErrInvalidInput             = errors.New("invalid input")
	ErrInvalidCredentials       = errors.New("invalid credentials")
	ErrInvalidSession           = errors.New("invalid session")
	ErrInvalidVerificationToken = errors.New("invalid email verification token")
	usernamePattern             = regexp.MustCompile(`^[a-z0-9_]{3,30}$`)
	sessionIDPattern            = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
)

const (
	accessTokenLifetime       = 15 * time.Minute
	refreshTokenLifetime      = 30 * 24 * time.Hour
	emailVerificationLifetime = 24 * time.Hour
	accessTokenIssuer         = "scripd"
	accessTokenAudience       = "scripd-web" //nolint:gosec // JWT audience identifier, not a credential
	passwordMemory            = 64 * 1024
	passwordIterations        = 3
	passwordThreads           = 2
	passwordKeyLength         = 32
	passwordSaltLength        = 16
	minimumPasswordRunes      = 12
	maximumPasswordBytes      = 128
)

type Store interface {
	CreateUserWithSession(context.Context, authdomain.User, []byte, time.Time, []byte, time.Time) (authdomain.User, string, error)
	GetUserByIdentifier(context.Context, string) (authdomain.User, error)
	GetUserForSession(context.Context, string, string) (authdomain.User, error)
	CreateSession(context.Context, string, []byte, time.Time) (string, error)
	RotateSession(context.Context, string, []byte, []byte, time.Time) (authdomain.User, string, error)
	RevokeSession(context.Context, string, []byte) error
	IssueEmailVerification(context.Context, string, []byte, time.Time) (string, bool, error)
	VerifyEmail(context.Context, []byte) error
	GetUserByID(context.Context, string) (authdomain.User, error)
	UpdatePassword(context.Context, string, string) error
	RevokeAllUserSessions(context.Context, string) error
	DeleteUser(context.Context, string) error
}

type VerificationMailer interface {
	SendVerification(context.Context, string, string) error
}

type Option func(*Service)

type Service struct {
	store              Store
	accessKey          []byte
	dummyHash          string
	now                func() time.Time
	verificationMailer VerificationMailer
	webBaseURL         string
}

type Profile struct {
	ID            string    `json:"id"`
	Username      string    `json:"username"`
	Email         string    `json:"email"`
	DisplayName   string    `json:"display_name"`
	EmailVerified bool      `json:"email_verified"`
	CreatedAt     time.Time `json:"created_at"`
}

type SessionResult struct {
	User              Profile
	AccessToken       string
	RefreshToken      string
	AccessExpiresAt   time.Time
	RefreshExpiresAt  time.Time
	NotificationError error
}

type accessClaims struct {
	SessionID string `json:"sid"`
	TokenType string `json:"typ"`
	jwt.RegisteredClaims
}

func New(store Store, accessSecret string, options ...Option) *Service {
	service := &Service{
		store:     store,
		accessKey: []byte(accessSecret),
		dummyHash: hashPasswordWithSalt("not-a-real-user-password", []byte("scripd-dummy-salt")),
		now:       time.Now,
	}
	for _, option := range options {
		option(service)
	}
	return service
}

func WithEmailVerification(mailer VerificationMailer, webBaseURL string) Option {
	return func(s *Service) {
		s.verificationMailer = mailer
		s.webBaseURL = strings.TrimRight(webBaseURL, "/")
	}
}

func (s *Service) Register(ctx context.Context, username, email, displayName, password string) (SessionResult, error) {
	username, email, displayName, err := normalizeRegistration(username, email, displayName, password)
	if err != nil {
		return SessionResult{}, err
	}
	passwordHash, err := hashPassword(password)
	if err != nil {
		return SessionResult{}, fmt.Errorf("hash password: %w", err)
	}
	userInput := authdomain.User{
		Username: username, Email: email, DisplayName: displayName, PasswordHash: passwordHash,
	}
	refreshSecret, err := randomToken(32)
	if err != nil {
		return SessionResult{}, fmt.Errorf("create refresh token: %w", err)
	}
	verificationToken, err := randomToken(32)
	if err != nil {
		return SessionResult{}, fmt.Errorf("create email verification token: %w", err)
	}
	now := s.now().UTC()
	refreshExpiresAt := now.Add(refreshTokenLifetime)
	refreshHash := sha256.Sum256([]byte(refreshSecret))
	verificationHash := sha256.Sum256([]byte(verificationToken))
	user, sessionID, err := s.store.CreateUserWithSession(
		ctx, userInput, refreshHash[:], refreshExpiresAt,
		verificationHash[:], now.Add(emailVerificationLifetime),
	)
	if err != nil {
		return SessionResult{}, err
	}
	result, err := s.issueSessionResult(user, sessionID, sessionID+"."+refreshSecret, now)
	if err != nil {
		_ = s.store.RevokeSession(ctx, sessionID, refreshHash[:])
		return SessionResult{}, err
	}
	result.NotificationError = s.sendVerification(ctx, user.Email, verificationToken)
	return result, nil
}

func (s *Service) VerifyEmail(ctx context.Context, token string) error {
	_, tokenHash, err := parseActionToken(token)
	if err != nil {
		return ErrInvalidVerificationToken
	}
	if err := s.store.VerifyEmail(ctx, tokenHash); err != nil {
		if errors.Is(err, authdomain.ErrNotFound) {
			return ErrInvalidVerificationToken
		}
		return fmt.Errorf("verify email address: %w", err)
	}
	return nil
}

func (s *Service) ResendEmailVerification(ctx context.Context, userID string) error {
	token, err := randomToken(32)
	if err != nil {
		return fmt.Errorf("create email verification token: %w", err)
	}
	tokenHash := sha256.Sum256([]byte(token))
	email, skipSend, err := s.store.IssueEmailVerification(ctx, userID, tokenHash[:], s.now().UTC().Add(emailVerificationLifetime))
	if err != nil {
		return fmt.Errorf("issue email verification token: %w", err)
	}
	if skipSend {
		return nil
	}
	if err := s.sendVerification(ctx, email, token); err != nil {
		return fmt.Errorf("send email verification message: %w", err)
	}
	return nil
}

func (s *Service) sendVerification(ctx context.Context, email, token string) error {
	if s.verificationMailer == nil {
		return nil
	}
	link := s.webBaseURL + "/verify-email?token=" + url.QueryEscape(token)
	return s.verificationMailer.SendVerification(ctx, email, link)
}

func (s *Service) Login(ctx context.Context, identifier, password string) (SessionResult, error) {
	identifier = strings.ToLower(strings.TrimSpace(identifier))
	if identifier == "" || len(identifier) > 254 || password == "" || len(password) > maximumPasswordBytes {
		return SessionResult{}, ErrInvalidInput
	}
	user, err := s.store.GetUserByIdentifier(ctx, identifier)
	if errors.Is(err, authdomain.ErrNotFound) {
		verifyPassword(password, s.dummyHash)
		return SessionResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return SessionResult{}, err
	}
	if !verifyPassword(password, user.PasswordHash) {
		return SessionResult{}, ErrInvalidCredentials
	}
	return s.startSession(ctx, user)
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (SessionResult, error) {
	sessionID, oldHash, err := hashRefreshToken(refreshToken)
	if err != nil {
		return SessionResult{}, ErrInvalidSession
	}
	newSecret, err := randomToken(32)
	if err != nil {
		return SessionResult{}, fmt.Errorf("create refresh token: %w", err)
	}
	now := s.now().UTC()
	newRefreshHash := sha256.Sum256([]byte(newSecret))
	user, sessionID, err := s.store.RotateSession(ctx, sessionID, oldHash, newRefreshHash[:], now.Add(refreshTokenLifetime))
	if err != nil {
		if errors.Is(err, authdomain.ErrNotFound) {
			return SessionResult{}, ErrInvalidSession
		}
		return SessionResult{}, err
	}
	result, err := s.issueSessionResult(user, sessionID, sessionID+"."+newSecret, now)
	if err != nil {
		_ = s.store.RevokeSession(ctx, sessionID, newRefreshHash[:])
		return SessionResult{}, err
	}
	return result, nil
}

func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}
	sessionID, hash, _ := hashRefreshToken(refreshToken)
	if sessionID == "" {
		return nil
	}
	return s.store.RevokeSession(ctx, sessionID, hash)
}

func (s *Service) CurrentUser(ctx context.Context, accessToken string) (Profile, error) {
	claims := accessClaims{}
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(accessTokenIssuer),
		jwt.WithAudience(accessTokenAudience),
		jwt.WithExpirationRequired(),
	)
	token, err := parser.ParseWithClaims(accessToken, &claims, func(_ *jwt.Token) (any, error) {
		return s.accessKey, nil
	})
	if err != nil || token == nil || !token.Valid || claims.TokenType != "access" || claims.SessionID == "" || claims.Subject == "" {
		return Profile{}, ErrInvalidSession
	}
	user, err := s.store.GetUserForSession(ctx, claims.Subject, claims.SessionID)
	if errors.Is(err, authdomain.ErrNotFound) {
		return Profile{}, ErrInvalidSession
	}
	if err != nil {
		return Profile{}, err
	}
	return profileFromUser(user), nil
}

func (s *Service) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	if strings.TrimSpace(userID) == "" || currentPassword == "" || len(currentPassword) > maximumPasswordBytes {
		return ErrInvalidInput
	}
	if utf8.RuneCountInString(newPassword) < minimumPasswordRunes || len(newPassword) > maximumPasswordBytes {
		return ErrInvalidInput
	}
	user, err := s.store.GetUserByID(ctx, userID)
	if errors.Is(err, authdomain.ErrNotFound) {
		return ErrInvalidSession
	}
	if err != nil {
		return fmt.Errorf("load user for password update: %w", err)
	}
	if !verifyPassword(currentPassword, user.PasswordHash) {
		return ErrInvalidCredentials
	}
	newHash, err := hashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("hash new password: %w", err)
	}
	if err := s.store.UpdatePassword(ctx, userID, newHash); err != nil {
		return fmt.Errorf("persist new password: %w", err)
	}
	if err := s.store.RevokeAllUserSessions(ctx, userID); err != nil {
		return fmt.Errorf("revoke sessions after password update: %w", err)
	}
	return nil
}

func (s *Service) DeleteAccount(ctx context.Context, userID, currentPassword string) error {
	if strings.TrimSpace(userID) == "" || currentPassword == "" || len(currentPassword) > maximumPasswordBytes {
		return ErrInvalidInput
	}
	user, err := s.store.GetUserByID(ctx, userID)
	if errors.Is(err, authdomain.ErrNotFound) {
		return ErrInvalidSession
	}
	if err != nil {
		return fmt.Errorf("load user for account deletion: %w", err)
	}
	if !verifyPassword(currentPassword, user.PasswordHash) {
		return ErrInvalidCredentials
	}
	if err := s.store.DeleteUser(ctx, userID); err != nil {
		return fmt.Errorf("delete user account: %w", err)
	}
	return nil
}

func (s *Service) startSession(ctx context.Context, user authdomain.User) (SessionResult, error) {
	refreshSecret, err := randomToken(32)
	if err != nil {
		return SessionResult{}, fmt.Errorf("create refresh token: %w", err)
	}
	now := s.now().UTC()
	refreshExpiresAt := now.Add(refreshTokenLifetime)
	refreshHash := sha256.Sum256([]byte(refreshSecret))
	sessionID, err := s.store.CreateSession(ctx, user.ID, refreshHash[:], refreshExpiresAt)
	if err != nil {
		return SessionResult{}, err
	}
	refreshToken := sessionID + "." + refreshSecret
	result, err := s.issueSessionResult(user, sessionID, refreshToken, now)
	if err != nil {
		_ = s.store.RevokeSession(ctx, sessionID, refreshHash[:])
		return SessionResult{}, err
	}
	return result, nil
}

func (s *Service) issueSessionResult(user authdomain.User, sessionID, refreshToken string, now time.Time) (SessionResult, error) {
	accessExpiresAt := now.Add(accessTokenLifetime)
	claims := accessClaims{
		SessionID: sessionID,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    accessTokenIssuer,
			Subject:   user.ID,
			Audience:  jwt.ClaimStrings{accessTokenAudience},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(accessExpiresAt),
		},
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.accessKey)
	if err != nil {
		return SessionResult{}, fmt.Errorf("sign access token: %w", err)
	}
	return SessionResult{
		User: profileFromUser(user), AccessToken: accessToken, RefreshToken: refreshToken,
		AccessExpiresAt: accessExpiresAt, RefreshExpiresAt: now.Add(refreshTokenLifetime),
	}, nil
}

func normalizeRegistration(username, email, displayName, password string) (string, string, string, error) {
	username = strings.ToLower(strings.TrimSpace(username))
	email = strings.ToLower(strings.TrimSpace(email))
	displayName = strings.TrimSpace(displayName)
	if !usernamePattern.MatchString(username) || len(email) > 254 || len(password) > maximumPasswordBytes || utf8.RuneCountInString(password) < minimumPasswordRunes || utf8.RuneCountInString(displayName) > 80 {
		return "", "", "", ErrInvalidInput
	}
	parsedEmail, err := mail.ParseAddress(email)
	if err != nil || parsedEmail.Address != email {
		return "", "", "", ErrInvalidInput
	}
	return username, email, displayName, nil
}

func profileFromUser(user authdomain.User) Profile {
	displayName := user.DisplayName
	if displayName == "" {
		displayName = user.Username
	}
	return Profile{
		ID: user.ID, Username: user.Username, Email: user.Email, DisplayName: displayName,
		EmailVerified: user.EmailVerified, CreatedAt: user.CreatedAt,
	}
}

func hashPassword(password string) (string, error) {
	salt := make([]byte, passwordSaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	return hashPasswordWithSalt(password, salt), nil
}

func hashPasswordWithSalt(password string, salt []byte) string {
	hash := argon2.IDKey(passwordBytes(password), salt, passwordIterations, passwordMemory, passwordThreads, passwordKeyLength)
	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s", passwordMemory, passwordIterations, passwordThreads,
		base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(hash))
}

func verifyPassword(password, encodedHash string) bool {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 || parts[1] != "argon2id" || parts[2] != "v=19" {
		return false
	}
	parameters := strings.Split(parts[3], ",")
	if len(parameters) != 3 {
		return false
	}
	memory, err := strconv.ParseUint(strings.TrimPrefix(parameters[0], "m="), 10, 32)
	if err != nil || memory < 8*1024 || memory > 256*1024 {
		return false
	}
	iterations, err := strconv.ParseUint(strings.TrimPrefix(parameters[1], "t="), 10, 32)
	if err != nil || iterations < 1 || iterations > 10 {
		return false
	}
	threads, err := strconv.ParseUint(strings.TrimPrefix(parameters[2], "p="), 10, 8)
	if err != nil || threads < 1 || threads > 8 {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(salt) < 8 || len(salt) > 64 {
		return false
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(want) < 16 || len(want) > 64 {
		return false
	}
	got := argon2.IDKey(passwordBytes(password), salt, uint32(iterations), uint32(memory), uint8(threads), uint32(len(want))) //nolint:gosec // len(want) is validated between 16 and 64 above
	return subtle.ConstantTimeCompare(got, want) == 1
}

func hashRefreshToken(token string) (string, []byte, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 || !sessionIDPattern.MatchString(parts[0]) {
		return "", nil, ErrInvalidSession
	}
	decoded, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || len(decoded) != 32 {
		return "", nil, ErrInvalidSession
	}
	hash := sha256.Sum256([]byte(parts[1]))
	return parts[0], hash[:], nil
}

func randomToken(size int) (string, error) {
	value := make([]byte, size)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func parseActionToken(token string) (string, []byte, error) {
	if len(token) > 128 {
		return "", nil, ErrInvalidVerificationToken
	}
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(decoded) != 32 {
		return "", nil, ErrInvalidVerificationToken
	}
	hash := sha256.Sum256([]byte(token))
	return token, hash[:], nil
}

func passwordBytes(password string) []byte {
	return []byte(password)
}
