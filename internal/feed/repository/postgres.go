package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scripd-app/scripd/internal/feed"
	"github.com/scripd-app/scripd/internal/read"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

func (p *Postgres) GetTimeline(ctx context.Context, userID string, opts feed.FeedOptions) ([]feed.FeedItem, error) {
	limit := opts.Limit
	if limit <= 0 {
		limit = 20
	}
	// Fetch limit + 1 to detect hasMore
	fetchLimit := limit + 1

	query := `
		SELECT
			r.id,
			r.status,
			r.rating::double precision,
			r.notes,
			r.started_at,
			r.finished_at,
			r.created_at,
			u.id,
			u.username,
			COALESCE(u.display_name, ''),
			COALESCE(u.avatar_url, ''),
			b.id,
			b.title,
			b.authors,
			COALESCE(b.cover_url, ''),
			b.published_year,
			rev.id,
			rev.body,
			rev.contains_spoilers
		FROM reads r
		JOIN users u ON u.id = r.user_id
		JOIN books b ON b.id = r.book_id
		LEFT JOIN reviews rev ON rev.read_id = r.id
		WHERE (
			r.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
			OR r.user_id = $1
		)
		AND ($2::timestamptz IS NULL OR (r.created_at, r.id) < ($2, $3::uuid))
		ORDER BY r.created_at DESC, r.id DESC
		LIMIT $4`

	var cursorTime *time.Time
	var cursorID *string
	if opts.CursorCreatedAt != nil && opts.CursorID != nil {
		cursorTime = opts.CursorCreatedAt
		cursorID = opts.CursorID
	}

	rows, err := p.pool.Query(ctx, query, userID, cursorTime, cursorID, fetchLimit)
	if err != nil {
		return nil, fmt.Errorf("query timeline: %w", err)
	}
	defer rows.Close()

	var items []feed.FeedItem
	for rows.Next() {
		var (
			item           feed.FeedItem
			statusStr      string
			rating         sql.NullFloat64
			notes          sql.NullString
			startedAt      sql.NullTime
			finishedAt     sql.NullTime
			publishedYear  sql.NullInt16
			reviewID       sql.NullString
			reviewBody     sql.NullString
			reviewSpoilers sql.NullBool
		)

		err := rows.Scan(
			&item.ID,
			&statusStr,
			&rating,
			&notes,
			&startedAt,
			&finishedAt,
			&item.CreatedAt,
			&item.User.ID,
			&item.User.Username,
			&item.User.DisplayName,
			&item.User.AvatarURL,
			&item.Book.ID,
			&item.Book.Title,
			&item.Book.Authors,
			&item.Book.CoverURL,
			&publishedYear,
			&reviewID,
			&reviewBody,
			&reviewSpoilers,
		)
		if err != nil {
			return nil, fmt.Errorf("scan timeline row: %w", err)
		}

		item.Status = read.Status(statusStr)
		if rating.Valid {
			r := rating.Float64
			item.Rating = &r
		}
		if notes.Valid {
			n := notes.String
			item.Notes = &n
		}
		if startedAt.Valid {
			t := startedAt.Time
			item.StartedAt = &t
		}
		if finishedAt.Valid {
			t := finishedAt.Time
			item.FinishedAt = &t
		}
		if publishedYear.Valid {
			y := int(publishedYear.Int16)
			item.Book.PublishedYear = &y
		}
		if item.Book.Authors == nil {
			item.Book.Authors = []string{}
		}
		if reviewID.Valid && reviewBody.Valid {
			item.Review = &feed.FeedReview{
				ID:               reviewID.String,
				Body:             reviewBody.String,
				ContainsSpoilers: reviewSpoilers.Bool,
			}
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate timeline rows: %w", err)
	}

	return items, nil
}
