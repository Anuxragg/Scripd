package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scripd-app/scripd/internal/comment"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

func (p *Postgres) LikeReview(ctx context.Context, reviewID, userID string) error {
	_, err := p.pool.Exec(ctx, `
		INSERT INTO review_likes (review_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (review_id, user_id) DO NOTHING`,
		reviewID, userID,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return comment.ErrReviewNotFound
		}
		return fmt.Errorf("like review: %w", err)
	}
	return nil
}

func (p *Postgres) UnlikeReview(ctx context.Context, reviewID, userID string) error {
	_, err := p.pool.Exec(ctx, `
		DELETE FROM review_likes
		WHERE review_id = $1 AND user_id = $2`,
		reviewID, userID,
	)
	if err != nil {
		return fmt.Errorf("unlike review: %w", err)
	}
	return nil
}

func (p *Postgres) GetSocialStats(ctx context.Context, reviewID, viewerID string) (comment.ReviewSocialStats, error) {
	query := `
		SELECT
			(SELECT COUNT(*) FROM review_likes WHERE review_id = $1)::int AS likes_count,
			(SELECT COUNT(*) FROM review_comments WHERE review_id = $1)::int AS comments_count,
			COALESCE(
				CASE WHEN $2 = '' THEN false
				ELSE (SELECT EXISTS(SELECT 1 FROM review_likes WHERE review_id = $1 AND user_id = $2::uuid))
				END,
				false
			) AS is_liked`

	var stats comment.ReviewSocialStats
	stats.ReviewID = reviewID
	err := p.pool.QueryRow(ctx, query, reviewID, viewerID).Scan(
		&stats.LikesCount,
		&stats.CommentsCount,
		&stats.IsLiked,
	)
	if err != nil {
		return comment.ReviewSocialStats{}, fmt.Errorf("get social stats: %w", err)
	}
	return stats, nil
}

func (p *Postgres) CreateComment(ctx context.Context, reviewID, userID, body string) (comment.Comment, error) {
	query := `
		WITH inserted AS (
			INSERT INTO review_comments (review_id, user_id, body)
			VALUES ($1, $2, $3)
			RETURNING id, review_id, user_id, body, created_at, updated_at
		)
		SELECT
			i.id, i.review_id, i.user_id, i.body, i.created_at, i.updated_at,
			u.id, u.username, COALESCE(u.display_name, ''), COALESCE(u.avatar_url, '')
		FROM inserted i
		JOIN users u ON u.id = i.user_id`

	var c comment.Comment
	err := p.pool.QueryRow(ctx, query, reviewID, userID, body).Scan(
		&c.ID,
		&c.ReviewID,
		&c.UserID,
		&c.Body,
		&c.CreatedAt,
		&c.UpdatedAt,
		&c.Author.ID,
		&c.Author.Username,
		&c.Author.DisplayName,
		&c.Author.AvatarURL,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return comment.Comment{}, comment.ErrReviewNotFound
		}
		return comment.Comment{}, fmt.Errorf("create comment: %w", err)
	}
	return c, nil
}

func (p *Postgres) ListComments(ctx context.Context, reviewID string, limit, offset int) ([]comment.Comment, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT
			c.id, c.review_id, c.user_id, c.body, c.created_at, c.updated_at,
			u.id, u.username, COALESCE(u.display_name, ''), COALESCE(u.avatar_url, '')
		FROM review_comments c
		JOIN users u ON u.id = c.user_id
		WHERE c.review_id = $1
		ORDER BY c.created_at ASC, c.id ASC
		LIMIT $2 OFFSET $3`

	rows, err := p.pool.Query(ctx, query, reviewID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query review comments: %w", err)
	}
	defer rows.Close()

	var comments []comment.Comment
	for rows.Next() {
		var c comment.Comment
		err := rows.Scan(
			&c.ID,
			&c.ReviewID,
			&c.UserID,
			&c.Body,
			&c.CreatedAt,
			&c.UpdatedAt,
			&c.Author.ID,
			&c.Author.Username,
			&c.Author.DisplayName,
			&c.Author.AvatarURL,
		)
		if err != nil {
			return nil, fmt.Errorf("scan review comment: %w", err)
		}
		comments = append(comments, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate review comments: %w", err)
	}

	if comments == nil {
		comments = []comment.Comment{}
	}
	return comments, nil
}

func (p *Postgres) GetCommentWithReviewOwner(ctx context.Context, commentID string) (comment.Comment, string, error) {
	query := `
		SELECT
			c.id, c.review_id, c.user_id, c.body, c.created_at, c.updated_at,
			u.id, u.username, COALESCE(u.display_name, ''), COALESCE(u.avatar_url, ''),
			r.user_id AS review_owner_id
		FROM review_comments c
		JOIN users u ON u.id = c.user_id
		JOIN reviews r ON r.id = c.review_id
		WHERE c.id = $1`

	var c comment.Comment
	var reviewOwnerID string
	err := p.pool.QueryRow(ctx, query, commentID).Scan(
		&c.ID,
		&c.ReviewID,
		&c.UserID,
		&c.Body,
		&c.CreatedAt,
		&c.UpdatedAt,
		&c.Author.ID,
		&c.Author.Username,
		&c.Author.DisplayName,
		&c.Author.AvatarURL,
		&reviewOwnerID,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return comment.Comment{}, "", comment.ErrCommentNotFound
		}
		return comment.Comment{}, "", fmt.Errorf("get comment with review owner: %w", err)
	}
	return c, reviewOwnerID, nil
}

func (p *Postgres) DeleteComment(ctx context.Context, commentID string) error {
	tag, err := p.pool.Exec(ctx, `
		DELETE FROM review_comments
		WHERE id = $1`,
		commentID,
	)
	if err != nil {
		return fmt.Errorf("delete review comment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return comment.ErrCommentNotFound
	}
	return nil
}
