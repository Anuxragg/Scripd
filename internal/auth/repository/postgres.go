package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	authdomain "github.com/scripd-app/scripd/internal/auth"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

type queryRower interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func (r *Postgres) CreateUserWithSession(
	ctx context.Context,
	user authdomain.User,
	sessionTokenHash []byte,
	sessionExpiresAt time.Time,
	verificationTokenHash []byte,
	verificationExpiresAt time.Time,
) (authdomain.User, string, error) {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return authdomain.User{}, "", fmt.Errorf("begin account registration: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	query := `
		INSERT INTO users (username, email, password_hash, display_name)
		VALUES ($1, $2, $3, NULLIF($4, ''))
		RETURNING id::text, username, email, COALESCE(display_name, ''), email_verified_at IS NOT NULL, created_at, updated_at`
	created, err := scanProfileUser(tx.QueryRow(ctx, query, user.Username, user.Email, user.PasswordHash, user.DisplayName))
	if err != nil {
		return authdomain.User{}, "", translateError(err)
	}
	var sessionID string
	err = tx.QueryRow(ctx, `
		INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at)
		VALUES ($1::uuid, $2, $3)
		RETURNING id::text`, created.ID, sessionTokenHash, sessionExpiresAt).Scan(&sessionID)
	if err != nil {
		return authdomain.User{}, "", fmt.Errorf("create registration session: %w", err)
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO auth_action_tokens (user_id, purpose, token_hash, expires_at)
		VALUES ($1::uuid, 'email_verification', $2, $3)`, created.ID, verificationTokenHash, verificationExpiresAt)
	if err != nil {
		return authdomain.User{}, "", fmt.Errorf("create registration verification token: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return authdomain.User{}, "", fmt.Errorf("commit account registration: %w", err)
	}
	return created, sessionID, nil
}

func (r *Postgres) GetUserByIdentifier(ctx context.Context, identifier string) (authdomain.User, error) {
	query := `
		SELECT id::text, username, email, COALESCE(display_name, ''), password_hash,
		       email_verified_at IS NOT NULL, created_at, updated_at
		FROM users
		WHERE lower(username) = lower($1) OR lower(email) = lower($1)
		LIMIT 1`
	user, err := scanUser(r.pool.QueryRow(ctx, query, identifier))
	if errors.Is(err, pgx.ErrNoRows) {
		return authdomain.User{}, authdomain.ErrNotFound
	}
	if err != nil {
		return authdomain.User{}, err
	}
	return user, nil
}

func (r *Postgres) GetUserForSession(ctx context.Context, userID, sessionID string) (authdomain.User, error) {
	query := `
		SELECT u.id::text, u.username, u.email, COALESCE(u.display_name, ''),
		       u.email_verified_at IS NOT NULL, u.created_at, u.updated_at
		FROM users u
		JOIN auth_sessions s ON s.user_id = u.id
		WHERE u.id = $1::uuid AND s.id = $2::uuid
		  AND s.revoked_at IS NULL AND s.expires_at > now()`
	user, err := scanProfileUser(r.pool.QueryRow(ctx, query, userID, sessionID))
	if errors.Is(err, pgx.ErrNoRows) {
		return authdomain.User{}, authdomain.ErrNotFound
	}
	if err != nil {
		return authdomain.User{}, err
	}
	return user, nil
}

func (r *Postgres) CreateSession(ctx context.Context, userID string, tokenHash []byte, expiresAt time.Time) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at)
		VALUES ($1::uuid, $2, $3)
		RETURNING id::text`, userID, tokenHash, expiresAt).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create auth session: %w", err)
	}
	return id, nil
}

func (r *Postgres) RotateSession(ctx context.Context, refreshSessionID string, oldHash, newHash []byte, expiresAt time.Time) (authdomain.User, string, error) {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return authdomain.User{}, "", fmt.Errorf("begin auth session rotation: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var sessionID, userID string
	err = tx.QueryRow(ctx, `
		UPDATE auth_sessions
		SET refresh_token_hash = $3, expires_at = $4, last_used_at = now()
		WHERE id = $1::uuid AND refresh_token_hash = $2 AND revoked_at IS NULL AND expires_at > now()
		RETURNING id::text, user_id::text`, refreshSessionID, oldHash, newHash, expiresAt).Scan(&sessionID, &userID)
	if errors.Is(err, pgx.ErrNoRows) {
		_, revokeErr := tx.Exec(ctx, `
			UPDATE auth_sessions SET revoked_at = now()
			WHERE id = $1::uuid AND revoked_at IS NULL AND expires_at > now()`, refreshSessionID)
		if revokeErr != nil {
			return authdomain.User{}, "", fmt.Errorf("revoke reused auth session: %w", revokeErr)
		}
		if commitErr := tx.Commit(ctx); commitErr != nil {
			return authdomain.User{}, "", fmt.Errorf("commit failed auth session rotation: %w", commitErr)
		}
		return authdomain.User{}, "", authdomain.ErrNotFound
	}
	if err != nil {
		return authdomain.User{}, "", fmt.Errorf("rotate auth session: %w", err)
	}
	user, err := getUserByID(ctx, tx, userID)
	if err != nil {
		return authdomain.User{}, "", fmt.Errorf("load auth user after session rotation: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return authdomain.User{}, "", fmt.Errorf("commit auth session rotation: %w", err)
	}
	return user, sessionID, nil
}

func (r *Postgres) RevokeSession(ctx context.Context, sessionID string, tokenHash []byte) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE auth_sessions SET revoked_at = now()
		WHERE id = $1::uuid AND refresh_token_hash = $2 AND revoked_at IS NULL`, sessionID, tokenHash)
	if err != nil {
		return fmt.Errorf("revoke auth session: %w", err)
	}
	return nil
}

func (r *Postgres) IssueEmailVerification(ctx context.Context, userID string, tokenHash []byte, expiresAt time.Time) (string, bool, error) {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", false, fmt.Errorf("begin email verification token issue: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var email string
	var verified, dailyLimitReached bool
	err = tx.QueryRow(ctx, `
		SELECT email, email_verified_at IS NOT NULL,
		       (SELECT count(*) >= 5 FROM auth_action_tokens
		        WHERE user_id = users.id AND purpose = 'email_verification'
		          AND created_at > now() - interval '24 hours')
		FROM users WHERE id = $1::uuid FOR UPDATE`, userID).Scan(&email, &verified, &dailyLimitReached)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, authdomain.ErrNotFound
	}
	if err != nil {
		return "", false, fmt.Errorf("load email for verification: %w", err)
	}
	if verified || dailyLimitReached {
		if err := tx.Commit(ctx); err != nil {
			return "", false, fmt.Errorf("commit email verification delivery limit check: %w", err)
		}
		return email, true, nil
	}
	if _, err := tx.Exec(ctx, `
		UPDATE auth_action_tokens SET consumed_at = now()
		WHERE user_id = $1::uuid AND purpose = 'email_verification' AND consumed_at IS NULL`, userID); err != nil {
		return "", false, fmt.Errorf("consume prior email verification token: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO auth_action_tokens (user_id, purpose, token_hash, expires_at)
		VALUES ($1::uuid, 'email_verification', $2, $3)`, userID, tokenHash, expiresAt); err != nil {
		return "", false, fmt.Errorf("store email verification token: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return "", false, fmt.Errorf("commit email verification token issue: %w", err)
	}
	return email, false, nil
}

func (r *Postgres) VerifyEmail(ctx context.Context, tokenHash []byte) error {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin email verification: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID string
	err = tx.QueryRow(ctx, `
		UPDATE auth_action_tokens SET consumed_at = now()
		WHERE token_hash = $1 AND purpose = 'email_verification'
		  AND consumed_at IS NULL AND expires_at > now()
		RETURNING user_id::text`, tokenHash).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return authdomain.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("consume email verification token: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
		WHERE id = $1::uuid`, userID); err != nil {
		return fmt.Errorf("mark email verified: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE auth_action_tokens SET consumed_at = now()
		WHERE user_id = $1::uuid AND purpose = 'email_verification' AND consumed_at IS NULL`, userID); err != nil {
		return fmt.Errorf("consume remaining email verification tokens: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit email verification: %w", err)
	}
	return nil
}

func (r *Postgres) IssuePasswordReset(ctx context.Context, email string, tokenHash []byte, expiresAt time.Time) (string, bool, error) {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", false, fmt.Errorf("begin password reset token issue: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID, userEmail string
	var dailyLimitReached bool
	err = tx.QueryRow(ctx, `
		SELECT id::text, email,
		       (SELECT count(*) >= 5 FROM auth_action_tokens
		        WHERE user_id = users.id AND purpose = 'password_reset'
		          AND created_at > now() - interval '24 hours')
		FROM users WHERE lower(email) = lower($1) FOR UPDATE`, email).Scan(&userID, &userEmail, &dailyLimitReached)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", true, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("load user for password reset: %w", err)
	}
	if dailyLimitReached {
		if err := tx.Commit(ctx); err != nil {
			return "", false, fmt.Errorf("commit password reset delivery limit check: %w", err)
		}
		return userEmail, true, nil
	}
	if _, err := tx.Exec(ctx, `
		UPDATE auth_action_tokens SET consumed_at = now()
		WHERE user_id = $1::uuid AND purpose = 'password_reset' AND consumed_at IS NULL`, userID); err != nil {
		return "", false, fmt.Errorf("consume prior password reset tokens: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO auth_action_tokens (user_id, purpose, token_hash, expires_at)
		VALUES ($1::uuid, 'password_reset', $2, $3)`, userID, tokenHash, expiresAt); err != nil {
		return "", false, fmt.Errorf("store password reset token: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return "", false, fmt.Errorf("commit password reset token issue: %w", err)
	}
	return userEmail, false, nil
}

func (r *Postgres) ResetPassword(ctx context.Context, tokenHash []byte, newPasswordHash string) error {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin password reset: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID string
	err = tx.QueryRow(ctx, `
		UPDATE auth_action_tokens SET consumed_at = now()
		WHERE token_hash = $1 AND purpose = 'password_reset'
		  AND consumed_at IS NULL AND expires_at > now()
		RETURNING user_id::text`, tokenHash).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return authdomain.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("consume password reset token: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE users SET password_hash = $2, updated_at = now()
		WHERE id = $1::uuid`, userID, newPasswordHash); err != nil {
		return fmt.Errorf("update user password: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE auth_sessions SET revoked_at = now()
		WHERE user_id = $1::uuid AND revoked_at IS NULL`, userID); err != nil {
		return fmt.Errorf("revoke all user sessions: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE auth_action_tokens SET consumed_at = now()
		WHERE user_id = $1::uuid AND purpose = 'password_reset' AND consumed_at IS NULL`, userID); err != nil {
		return fmt.Errorf("consume remaining password reset tokens: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit password reset: %w", err)
	}
	return nil
}

func (r *Postgres) GetUserByID(ctx context.Context, id string) (authdomain.User, error) {
	query := `
		SELECT id::text, username, email, COALESCE(display_name, ''), password_hash,
		       email_verified_at IS NOT NULL, created_at, updated_at
		FROM users
		WHERE id = $1::uuid`
	user, err := scanUser(r.pool.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return authdomain.User{}, authdomain.ErrNotFound
	}
	if err != nil {
		return authdomain.User{}, err
	}
	return user, nil
}

func (r *Postgres) UpdatePassword(ctx context.Context, userID, passwordHash string) error {
	cmd, err := r.pool.Exec(ctx, `
		UPDATE users
		SET password_hash = $2, updated_at = now()
		WHERE id = $1::uuid`, userID, passwordHash)
	if err != nil {
		return fmt.Errorf("update user password: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return authdomain.ErrNotFound
	}
	return nil
}

func (r *Postgres) RevokeAllUserSessions(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE auth_sessions
		SET revoked_at = now()
		WHERE user_id = $1::uuid AND revoked_at IS NULL`, userID)
	if err != nil {
		return fmt.Errorf("revoke all user sessions: %w", err)
	}
	return nil
}

func (r *Postgres) DeleteUser(ctx context.Context, userID string) error {
	cmd, err := r.pool.Exec(ctx, `
		DELETE FROM users
		WHERE id = $1::uuid`, userID)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return authdomain.ErrNotFound
	}
	return nil
}

func getUserByID(ctx context.Context, q queryRower, id string) (authdomain.User, error) {
	query := `
		SELECT id::text, username, email, COALESCE(display_name, ''),
		       email_verified_at IS NOT NULL, created_at, updated_at
		FROM users WHERE id = $1::uuid`
	user, err := scanProfileUser(q.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return authdomain.User{}, authdomain.ErrNotFound
	}
	if err != nil {
		return authdomain.User{}, err
	}
	return user, nil
}

func scanUser(row pgx.Row) (authdomain.User, error) {
	var user authdomain.User
	err := row.Scan(
		&user.ID, &user.Username, &user.Email, &user.DisplayName,
		&user.PasswordHash, &user.EmailVerified, &user.CreatedAt, &user.UpdatedAt,
	)
	return user, err
}

func scanProfileUser(row pgx.Row) (authdomain.User, error) {
	var user authdomain.User
	err := row.Scan(&user.ID, &user.Username, &user.Email, &user.DisplayName, &user.EmailVerified, &user.CreatedAt, &user.UpdatedAt)
	return user, err
}

func translateError(err error) error {
	var postgresError *pgconn.PgError
	if !errors.As(err, &postgresError) || postgresError.Code != "23505" {
		return err
	}
	switch postgresError.ConstraintName {
	case "users_email_lower_unique":
		return authdomain.ErrEmailInUse
	case "users_username_key", "users_username_lower_unique":
		return authdomain.ErrUsernameInUse
	default:
		return err
	}
}
