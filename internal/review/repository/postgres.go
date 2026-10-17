package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scripd-app/scripd/internal/review"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

const reviewSelectFields = `
	r.id, r.read_id, r.user_id, r.book_id, r.body, r.contains_spoilers,
	r.created_at, r.updated_at,
	u.id, u.username, u.display_name, u.avatar_url,
	rd.rating::double precision,
	b.id, b.title, b.authors, b.cover_url
`

const reviewJoinTables = `
	FROM reviews AS r
	JOIN users AS u ON u.id = r.user_id
	JOIN reads AS rd ON rd.id = r.read_id
	JOIN books AS b ON b.id = r.book_id
`

func scanReview(row pgx.Row) (review.Review, error) {
	var rev review.Review
	err := row.Scan(
		&rev.ID, &rev.ReadID, &rev.UserID, &rev.BookID, &rev.Body, &rev.ContainsSpoilers,
		&rev.CreatedAt, &rev.UpdatedAt,
		&rev.Author.ID, &rev.Author.Username, &rev.Author.DisplayName, &rev.Author.AvatarURL,
		&rev.Rating,
		&rev.Book.ID, &rev.Book.Title, &rev.Book.Authors, &rev.Book.CoverURL,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return review.Review{}, review.ErrNotFound
		}
		return review.Review{}, err
	}
	return rev, nil
}

func (p *Postgres) Create(ctx context.Context, userID, bookID string, input review.CreateInput) (review.Review, error) {
	var revID string
	err := p.pool.QueryRow(ctx, `
		INSERT INTO reviews (read_id, user_id, book_id, body, contains_spoilers)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`,
		input.ReadID, userID, bookID, input.Body, input.ContainsSpoilers,
	).Scan(&revID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique violation
			return review.Review{}, review.ErrConflict
		}
		return review.Review{}, fmt.Errorf("create review: %w", err)
	}

	return p.GetByID(ctx, revID)
}

func (p *Postgres) GetByID(ctx context.Context, id string) (review.Review, error) {
	row := p.pool.QueryRow(ctx, `SELECT `+reviewSelectFields+reviewJoinTables+` WHERE r.id = $1`, id)
	return scanReview(row)
}

func (p *Postgres) GetByReadID(ctx context.Context, readID string) (review.Review, error) {
	row := p.pool.QueryRow(ctx, `SELECT `+reviewSelectFields+reviewJoinTables+` WHERE r.read_id = $1`, readID)
	return scanReview(row)
}

func (p *Postgres) Update(ctx context.Context, userID, id string, input review.UpdateInput) (review.Review, error) {
	tag, err := p.pool.Exec(ctx, `
		UPDATE reviews
		SET body = $1, contains_spoilers = $2, updated_at = now()
		WHERE id = $3 AND user_id = $4`,
		input.Body, input.ContainsSpoilers, id, userID,
	)
	if err != nil {
		return review.Review{}, fmt.Errorf("update review: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return review.Review{}, review.ErrNotFound
	}
	return p.GetByID(ctx, id)
}

func (p *Postgres) Delete(ctx context.Context, userID, id string) error {
	tag, err := p.pool.Exec(ctx, `DELETE FROM reviews WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return fmt.Errorf("delete review: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return review.ErrNotFound
	}
	return nil
}

func (p *Postgres) ListByBook(ctx context.Context, bookID string, opts review.ListOptions) ([]review.Review, error) {
	limit := opts.Limit
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	query := `SELECT ` + reviewSelectFields + reviewJoinTables + `
		WHERE r.book_id = $1`
	args := []any{bookID}

	if opts.CursorCreatedAt != nil && opts.CursorID != "" {
		query += ` AND (r.created_at, r.id) < ($2, $3)`
		args = append(args, *opts.CursorCreatedAt, opts.CursorID)
	}
	query += fmt.Sprintf(` ORDER BY r.created_at DESC, r.id DESC LIMIT %d`, limit)

	rows, err := p.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list reviews by book: %w", err)
	}
	defer rows.Close()

	var reviews []review.Review
	for rows.Next() {
		rev, err := scanReview(rows)
		if err != nil {
			return nil, fmt.Errorf("scan review: %w", err)
		}
		reviews = append(reviews, rev)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reviews rows: %w", err)
	}
	return reviews, nil
}
