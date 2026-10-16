package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scripd-app/scripd/internal/read"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

const entryColumns = `r.id, r.book_id, r.status, r.rating::double precision,
       r.started_at, r.finished_at, r.notes, r.created_at, r.updated_at,
       b.title, b.authors, b.cover_url, b.published_year, COALESCE(b.open_library_key, '')`

const entryJoin = `FROM reads AS r JOIN books AS b ON b.id = r.book_id`

const getEntrySQL = `SELECT ` + entryColumns + ` ` + entryJoin + ` WHERE r.user_id = $1 AND r.id = $2`

func (p *Postgres) Create(ctx context.Context, userID string, input read.EntryInput) (read.Entry, error) {
	tx, err := p.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return read.Entry{}, fmt.Errorf("begin reading entry create: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var entryID string
	err = tx.QueryRow(ctx, `
        INSERT INTO reads (user_id, book_id, status, rating, started_at, finished_at, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
		userID, input.BookID, input.Status, input.Rating, input.StartedAt, input.FinishedAt, input.Notes,
	).Scan(&entryID)
	if err != nil {
		return read.Entry{}, mapWriteError(err)
	}
	entry, err := getByID(ctx, tx, userID, entryID)
	if err != nil {
		return read.Entry{}, fmt.Errorf("read created reading entry: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return read.Entry{}, fmt.Errorf("commit reading entry create: %w", err)
	}
	return entry, nil
}

func (p *Postgres) GetByID(ctx context.Context, userID, entryID string) (read.Entry, error) {
	entry, err := getByID(ctx, p.pool, userID, entryID)
	if errors.Is(err, pgx.ErrNoRows) {
		return read.Entry{}, read.ErrNotFound
	}
	if err != nil {
		return read.Entry{}, fmt.Errorf("get reading entry: %w", err)
	}
	return entry, nil
}

func (p *Postgres) List(ctx context.Context, userID string, filter read.ListFilter, cursor *read.Cursor, limit int) ([]read.Entry, error) {
	var status, bookID, cursorID any
	var cursorCreatedAt any
	if filter.Status != "" {
		status = string(filter.Status)
	}
	if filter.BookID != "" {
		bookID = filter.BookID
	}
	if cursor != nil {
		cursorID = cursor.ID
		cursorCreatedAt = cursor.CreatedAt
	}
	query := `SELECT ` + entryColumns + ` ` + entryJoin + `
        WHERE r.user_id = $1
          AND ($2::text IS NULL OR r.status = $2)
          AND ($3::uuid IS NULL OR r.book_id = $3)
          AND ($4::timestamptz IS NULL OR (r.created_at, r.id) < ($4, $5::uuid))
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT $6`
	rows, err := p.pool.Query(ctx, query, userID, status, bookID, cursorCreatedAt, cursorID, limit)
	if err != nil {
		return nil, fmt.Errorf("query reading entries: %w", err)
	}
	defer rows.Close()
	entries := make([]read.Entry, 0, limit)
	for rows.Next() {
		var entry read.Entry
		if err := scanEntry(rows, &entry); err != nil {
			return nil, fmt.Errorf("scan reading entry: %w", err)
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read reading entries: %w", err)
	}
	return entries, nil
}

func (p *Postgres) Update(ctx context.Context, userID, entryID string, expectedUpdatedAt time.Time, input read.EntryInput) (read.Entry, error) {
	tx, err := p.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return read.Entry{}, fmt.Errorf("begin reading entry update: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var updatedID string
	err = tx.QueryRow(ctx, `
        UPDATE reads
        SET status = $1, rating = $2, started_at = $3, finished_at = $4, notes = $5,
            updated_at = GREATEST(clock_timestamp(), updated_at + interval '1 microsecond')
        WHERE id = $6 AND user_id = $7 AND updated_at = $8
        RETURNING id`,
		input.Status, input.Rating, input.StartedAt, input.FinishedAt, input.Notes,
		entryID, userID, expectedUpdatedAt,
	).Scan(&updatedID)
	if errors.Is(err, pgx.ErrNoRows) {
		if _, getErr := getByID(ctx, tx, userID, entryID); errors.Is(getErr, pgx.ErrNoRows) {
			return read.Entry{}, read.ErrNotFound
		} else if getErr != nil {
			return read.Entry{}, fmt.Errorf("check reading entry update conflict: %w", getErr)
		}
		return read.Entry{}, read.ErrUpdateConflict
	}
	if err != nil {
		return read.Entry{}, mapWriteError(err)
	}
	entry, err := getByID(ctx, tx, userID, updatedID)
	if err != nil {
		return read.Entry{}, fmt.Errorf("read updated reading entry: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return read.Entry{}, fmt.Errorf("commit reading entry update: %w", err)
	}
	return entry, nil
}

func (p *Postgres) Delete(ctx context.Context, userID, entryID string) error {
	result, err := p.pool.Exec(ctx, `DELETE FROM reads WHERE id = $1 AND user_id = $2`, entryID, userID)
	if err != nil {
		return fmt.Errorf("delete reading entry: %w", err)
	}
	if result.RowsAffected() == 0 {
		return read.ErrNotFound
	}
	return nil
}

type queryRower interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

type rowScanner interface {
	Scan(...any) error
}

func getByID(ctx context.Context, queryer queryRower, userID, entryID string) (read.Entry, error) {
	var entry read.Entry
	err := scanEntry(queryer.QueryRow(ctx, getEntrySQL, userID, entryID), &entry)
	return entry, err
}

func scanEntry(row rowScanner, entry *read.Entry) error {
	var rating pgtype.Float8
	var startedAt, finishedAt pgtype.Timestamptz
	var notes, coverURL, openLibraryKey pgtype.Text
	var publishedYear pgtype.Int2
	var status string
	if err := row.Scan(
		&entry.ID, &entry.BookID, &status, &rating,
		&startedAt, &finishedAt, &notes, &entry.CreatedAt, &entry.UpdatedAt,
		&entry.Book.Title, &entry.Book.Authors, &coverURL, &publishedYear, &openLibraryKey,
	); err != nil {
		return err
	}
	entry.Status = read.Status(status)
	entry.Book.ID = entry.BookID
	if rating.Valid {
		value := rating.Float64
		entry.Rating = &value
	}
	if startedAt.Valid {
		value := startedAt.Time
		entry.StartedAt = &value
	}
	if finishedAt.Valid {
		value := finishedAt.Time
		entry.FinishedAt = &value
	}
	if notes.Valid && notes.String != "" {
		value := notes.String
		entry.Notes = &value
	}
	if coverURL.Valid && coverURL.String != "" {
		value := coverURL.String
		entry.Book.CoverURL = &value
	}
	if publishedYear.Valid {
		value := int(publishedYear.Int16)
		entry.Book.PublishedYear = &value
	}
	if openLibraryKey.Valid && openLibraryKey.String != "" {
		entry.Book.OpenLibraryKey = openLibraryKey.String
		entry.Book.OpenLibraryURL = "https://openlibrary.org/works/" + openLibraryKey.String
	}
	if entry.Book.Authors == nil {
		entry.Book.Authors = []string{}
	}
	return nil
}

func mapWriteError(err error) error {
	var postgresError *pgconn.PgError
	if errors.As(err, &postgresError) {
		switch {
		case postgresError.Code == "23503" && postgresError.ConstraintName == "reads_book_id_fkey":
			return read.ErrBookNotFound
		case postgresError.Code == "23505" && postgresError.ConstraintName == "reads_user_book_active_unique":
			return read.ErrAlreadyActive
		}
	}
	return fmt.Errorf("write reading entry: %w", err)
}
