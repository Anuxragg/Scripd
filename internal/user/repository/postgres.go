package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scripd-app/scripd/internal/user"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

const userProfileFields = `
	id, username, coalesce(display_name, ''), coalesce(bio, ''), coalesce(avatar_url, ''), created_at
`

func scanProfile(row pgx.Row) (user.PublicProfile, error) {
	var p user.PublicProfile
	err := row.Scan(&p.ID, &p.Username, &p.DisplayName, &p.Bio, &p.AvatarURL, &p.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return user.PublicProfile{}, user.ErrNotFound
		}
		return user.PublicProfile{}, err
	}
	if p.DisplayName == "" {
		p.DisplayName = p.Username
	}
	return p, nil
}

func (p *Postgres) GetByUsername(ctx context.Context, username string) (user.PublicProfile, error) {
	row := p.pool.QueryRow(ctx, `
		SELECT `+userProfileFields+`
		FROM users
		WHERE lower(username) = lower($1)`,
		strings.TrimSpace(username),
	)
	return scanProfile(row)
}

func (p *Postgres) GetByID(ctx context.Context, id string) (user.PublicProfile, error) {
	row := p.pool.QueryRow(ctx, `
		SELECT `+userProfileFields+`
		FROM users
		WHERE id = $1`,
		strings.TrimSpace(id),
	)
	return scanProfile(row)
}

func (p *Postgres) Update(ctx context.Context, id string, input user.UpdateProfileInput) (user.PublicProfile, error) {
	tag, err := p.pool.Exec(ctx, `
		UPDATE users
		SET display_name = coalesce($1, display_name),
		    bio = coalesce($2, bio),
		    avatar_url = coalesce($3, avatar_url),
		    updated_at = now()
		WHERE id = $4`,
		input.DisplayName, input.Bio, input.AvatarURL, strings.TrimSpace(id),
	)
	if err != nil {
		return user.PublicProfile{}, fmt.Errorf("update user profile: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return user.PublicProfile{}, user.ErrNotFound
	}
	return p.GetByID(ctx, id)
}

func (p *Postgres) GetStats(ctx context.Context, userID string) (user.ProfileStats, error) {
	var stats user.ProfileStats
	err := p.pool.QueryRow(ctx, `
		SELECT
			coalesce(count(*) FILTER (WHERE r.status = 'read'), 0),
			coalesce(count(*) FILTER (WHERE r.status = 'reading'), 0),
			coalesce(count(*) FILTER (WHERE r.status = 'want_to_read'), 0),
			(SELECT coalesce(count(*), 0) FROM reviews WHERE user_id = $1)
		FROM reads AS r
		WHERE r.user_id = $1`,
		strings.TrimSpace(userID),
	).Scan(&stats.BooksRead, &stats.CurrentlyReading, &stats.WantToRead, &stats.ReviewsCount)
	if err != nil {
		return user.ProfileStats{}, fmt.Errorf("get profile stats: %w", err)
	}
	return stats, nil
}
