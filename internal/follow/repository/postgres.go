package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scripd-app/scripd/internal/follow"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

func (p *Postgres) Follow(ctx context.Context, followerID, followingID string) error {
	_, err := p.pool.Exec(ctx, `
		INSERT INTO follows (follower_id, following_id)
		VALUES ($1, $2)`,
		followerID, followingID,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			switch pgErr.Code {
			case "23505": // unique_violation
				return follow.ErrAlreadyFollowing
			case "23514": // check_violation
				return follow.ErrCannotFollowSelf
			case "23503": // foreign_key_violation
				return follow.ErrUserNotFound
			}
		}
		return fmt.Errorf("create follow: %w", err)
	}
	return nil
}

func (p *Postgres) Unfollow(ctx context.Context, followerID, followingID string) error {
	tag, err := p.pool.Exec(ctx, `
		DELETE FROM follows
		WHERE follower_id = $1 AND following_id = $2`,
		followerID, followingID,
	)
	if err != nil {
		return fmt.Errorf("delete follow: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return follow.ErrNotFollowing
	}
	return nil
}

func (p *Postgres) IsFollowing(ctx context.Context, followerID, followingID string) (bool, error) {
	var exists bool
	err := p.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM follows
			WHERE follower_id = $1 AND following_id = $2
		)`,
		followerID, followingID,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check is following: %w", err)
	}
	return exists, nil
}

func (p *Postgres) GetCounts(ctx context.Context, userID string) (int, int, error) {
	var followers, following int
	err := p.pool.QueryRow(ctx, `
		SELECT
			(SELECT coalesce(count(*), 0) FROM follows WHERE following_id = $1),
			(SELECT coalesce(count(*), 0) FROM follows WHERE follower_id = $1)`,
		userID,
	).Scan(&followers, &following)
	if err != nil {
		return 0, 0, fmt.Errorf("get follow counts: %w", err)
	}
	return followers, following, nil
}

func (p *Postgres) ListFollowers(ctx context.Context, userID string, limit int) ([]follow.FollowUser, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	rows, err := p.pool.Query(ctx, `
		SELECT u.id, u.username, coalesce(u.display_name, u.username), coalesce(u.avatar_url, ''), f.created_at
		FROM follows AS f
		JOIN users AS u ON u.id = f.follower_id
		WHERE f.following_id = $1
		ORDER BY f.created_at DESC
		LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("list followers: %w", err)
	}
	defer rows.Close()

	return scanFollowUsers(rows)
}

func (p *Postgres) ListFollowing(ctx context.Context, userID string, limit int) ([]follow.FollowUser, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	rows, err := p.pool.Query(ctx, `
		SELECT u.id, u.username, coalesce(u.display_name, u.username), coalesce(u.avatar_url, ''), f.created_at
		FROM follows AS f
		JOIN users AS u ON u.id = f.following_id
		WHERE f.follower_id = $1
		ORDER BY f.created_at DESC
		LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("list following: %w", err)
	}
	defer rows.Close()

	return scanFollowUsers(rows)
}

func scanFollowUsers(rows pgx.Rows) ([]follow.FollowUser, error) {
	var users []follow.FollowUser
	for rows.Next() {
		var u follow.FollowUser
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.AvatarURL, &u.FollowedAt); err != nil {
			return nil, fmt.Errorf("scan follow user: %w", err)
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("follow users rows: %w", err)
	}
	return users, nil
}
