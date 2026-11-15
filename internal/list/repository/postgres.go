package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scripd-app/scripd/internal/list"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

func (p *Postgres) GetUserIDByUsername(ctx context.Context, username string) (string, error) {
	var userID string
	err := p.pool.QueryRow(ctx, "SELECT id FROM users WHERE lower(username) = lower($1)", username).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", list.ErrNotFound
		}
		return "", fmt.Errorf("get user id by username: %w", err)
	}
	return userID, nil
}

func (p *Postgres) CreateList(ctx context.Context, userID string, input list.CreateListInput) (list.List, error) {
	var l list.List
	l.SampleCovers = []string{}
	l.Items = []list.Item{}

	err := p.pool.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO book_lists (user_id, title, description, is_private)
			VALUES ($1, $2, $3, $4)
			RETURNING id, user_id, title, description, is_private, created_at, updated_at
		)
		SELECT 
			i.id, i.user_id, i.title, i.description, i.is_private, i.created_at, i.updated_at,
			u.id, u.username, u.display_name, u.avatar_url
		FROM inserted i
		JOIN users u ON u.id = i.user_id`,
		userID, input.Title, input.Description, input.IsPrivate,
	).Scan(
		&l.ID, &l.UserID, &l.Title, &l.Description, &l.IsPrivate, &l.CreatedAt, &l.UpdatedAt,
		&l.Author.ID, &l.Author.Username, &l.Author.DisplayName, &l.Author.AvatarURL,
	)
	if err != nil {
		return list.List{}, fmt.Errorf("create list: %w", err)
	}

	return l, nil
}

func (p *Postgres) GetListByID(ctx context.Context, listID string, viewerID string) (list.List, error) {
	var l list.List
	l.SampleCovers = []string{}
	l.Items = []list.Item{}

	err := p.pool.QueryRow(ctx, `
		SELECT 
			bl.id, bl.user_id, bl.title, bl.description, bl.is_private, bl.created_at, bl.updated_at,
			u.id, u.username, u.display_name, u.avatar_url,
			COALESCE((SELECT COUNT(*) FROM book_list_items WHERE list_id = bl.id), 0) AS item_count
		FROM book_lists bl
		JOIN users u ON u.id = bl.user_id
		WHERE bl.id = $1`,
		listID,
	).Scan(
		&l.ID, &l.UserID, &l.Title, &l.Description, &l.IsPrivate, &l.CreatedAt, &l.UpdatedAt,
		&l.Author.ID, &l.Author.Username, &l.Author.DisplayName, &l.Author.AvatarURL,
		&l.ItemCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return list.List{}, list.ErrNotFound
		}
		return list.List{}, fmt.Errorf("query list by id: %w", err)
	}

	// Privacy check
	if l.IsPrivate && l.UserID != viewerID {
		return list.List{}, list.ErrNotFound
	}

	// Fetch items
	rows, err := p.pool.Query(ctx, `
		SELECT 
			bli.list_id, bli.book_id, bli.position, bli.notes, bli.created_at,
			b.id, b.title, b.authors, b.cover_url, b.published_year
		FROM book_list_items bli
		JOIN books b ON b.id = bli.book_id
		WHERE bli.list_id = $1
		ORDER BY bli.position ASC, bli.created_at ASC`,
		listID,
	)
	if err != nil {
		return list.List{}, fmt.Errorf("query list items: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var item list.Item
		var publishedYear *int16
		err := rows.Scan(
			&item.ListID, &item.BookID, &item.Position, &item.Notes, &item.CreatedAt,
			&item.Book.ID, &item.Book.Title, &item.Book.Authors, &item.Book.CoverURL, &publishedYear,
		)
		if err != nil {
			return list.List{}, fmt.Errorf("scan list item: %w", err)
		}
		if publishedYear != nil {
			py := int(*publishedYear)
			item.Book.PublishedYear = &py
		}
		l.Items = append(l.Items, item)
		if len(l.SampleCovers) < 4 && item.Book.CoverURL != nil && *item.Book.CoverURL != "" {
			l.SampleCovers = append(l.SampleCovers, *item.Book.CoverURL)
		}
	}
	if err := rows.Err(); err != nil {
		return list.List{}, fmt.Errorf("iterate list items: %w", err)
	}

	return l, nil
}

func (p *Postgres) ListUserLists(ctx context.Context, targetUserID string, viewerID string) ([]list.List, error) {
	isOwner := targetUserID == viewerID

	query := `
		SELECT 
			bl.id, bl.user_id, bl.title, bl.description, bl.is_private, bl.created_at, bl.updated_at,
			u.id, u.username, u.display_name, u.avatar_url,
			COALESCE((SELECT COUNT(*) FROM book_list_items WHERE list_id = bl.id), 0) AS item_count,
			COALESCE(ARRAY(
				SELECT b.cover_url 
				FROM book_list_items bli 
				JOIN books b ON b.id = bli.book_id 
				WHERE bli.list_id = bl.id AND b.cover_url IS NOT NULL 
				ORDER BY bli.position ASC, bli.created_at ASC 
				LIMIT 4
			), '{}'::text[]) AS sample_covers
		FROM book_lists bl
		JOIN users u ON u.id = bl.user_id
		WHERE bl.user_id = $1 `

	if !isOwner {
		query += `AND bl.is_private = false `
	}

	query += `ORDER BY bl.created_at DESC`

	rows, err := p.pool.Query(ctx, query, targetUserID)
	if err != nil {
		return nil, fmt.Errorf("query user lists: %w", err)
	}
	defer rows.Close()

	var lists []list.List
	for rows.Next() {
		var l list.List
		err := rows.Scan(
			&l.ID, &l.UserID, &l.Title, &l.Description, &l.IsPrivate, &l.CreatedAt, &l.UpdatedAt,
			&l.Author.ID, &l.Author.Username, &l.Author.DisplayName, &l.Author.AvatarURL,
			&l.ItemCount, &l.SampleCovers,
		)
		if err != nil {
			return nil, fmt.Errorf("scan user list: %w", err)
		}
		if l.SampleCovers == nil {
			l.SampleCovers = []string{}
		}
		lists = append(lists, l)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate user lists: %w", err)
	}

	if lists == nil {
		lists = []list.List{}
	}
	return lists, nil
}

func (p *Postgres) UpdateList(ctx context.Context, listID string, userID string, input list.UpdateListInput) (list.List, error) {
	// First check list exists and verify owner
	var ownerID string
	err := p.pool.QueryRow(ctx, "SELECT user_id FROM book_lists WHERE id = $1", listID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return list.List{}, list.ErrNotFound
		}
		return list.List{}, fmt.Errorf("check list ownership: %w", err)
	}
	if ownerID != userID {
		return list.List{}, list.ErrForbidden
	}

	var l list.List
	l.SampleCovers = []string{}

	err = p.pool.QueryRow(ctx, `
		UPDATE book_lists
		SET 
			title = COALESCE($1, title),
			description = CASE WHEN $2::boolean THEN $3 ELSE description END,
			is_private = COALESCE($4, is_private),
			updated_at = now()
		WHERE id = $5 AND user_id = $6
		RETURNING 
			id, user_id, title, description, is_private, created_at, updated_at`,
		input.Title, input.Description != nil, input.Description, input.IsPrivate, listID, userID,
	).Scan(
		&l.ID, &l.UserID, &l.Title, &l.Description, &l.IsPrivate, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		return list.List{}, fmt.Errorf("update list: %w", err)
	}

	return p.GetListByID(ctx, listID, userID)
}

func (p *Postgres) DeleteList(ctx context.Context, listID string, userID string) error {
	var ownerID string
	err := p.pool.QueryRow(ctx, "SELECT user_id FROM book_lists WHERE id = $1", listID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return list.ErrNotFound
		}
		return fmt.Errorf("check list ownership: %w", err)
	}
	if ownerID != userID {
		return list.ErrForbidden
	}

	_, err = p.pool.Exec(ctx, "DELETE FROM book_lists WHERE id = $1 AND user_id = $2", listID, userID)
	if err != nil {
		return fmt.Errorf("delete list: %w", err)
	}
	return nil
}

func (p *Postgres) resolveBookUUID(ctx context.Context, bookID string, title *string) (string, error) {
	cleanID := strings.TrimSpace(bookID)
	if cleanID == "" {
		return "", errors.New("empty book id")
	}

	var exists bool
	err := p.pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM books WHERE id::text = $1)", cleanID).Scan(&exists)
	if err == nil && exists {
		return cleanID, nil
	}

	var resolvedID string
	cleanKey := strings.TrimPrefix(strings.TrimPrefix(cleanID, "/works/"), "/books/")
	slugAsTitle := strings.ReplaceAll(cleanKey, "-", " ")
	explicitTitle := ""
	if title != nil {
		explicitTitle = strings.TrimSpace(*title)
	}

	findErr := p.pool.QueryRow(ctx, `
		SELECT id FROM books 
		WHERE open_library_key = $1 
		   OR open_library_key = $2
		   OR lower(open_library_key) = lower($1)
		   OR lower(title) = lower($3)
		   OR lower(title) = lower($4)
		   OR (length($5) > 0 AND lower(title) = lower($5))
		LIMIT 1`,
		cleanKey, "/works/"+cleanKey, cleanID, slugAsTitle, explicitTitle,
	).Scan(&resolvedID)
	if findErr == nil {
		return resolvedID, nil
	}

	bookTitle := cleanID
	if explicitTitle != "" {
		bookTitle = explicitTitle
	} else if slugAsTitle != "" {
		bookTitle = slugAsTitle
	}

	stubErr := p.pool.QueryRow(ctx, `
		INSERT INTO books (title, open_library_key)
		VALUES ($1, $2)
		ON CONFLICT (open_library_key) DO UPDATE
		SET title = EXCLUDED.title
		RETURNING id`,
		bookTitle, "/works/"+cleanKey,
	).Scan(&resolvedID)
	if stubErr != nil {
		return "", fmt.Errorf("resolve book: %w", stubErr)
	}
	return resolvedID, nil
}

func (p *Postgres) AddBookToList(ctx context.Context, listID string, userID string, input list.AddBookInput) (list.Item, error) {
	var ownerID string
	err := p.pool.QueryRow(ctx, "SELECT user_id FROM book_lists WHERE id = $1", listID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return list.Item{}, list.ErrNotFound
		}
		return list.Item{}, fmt.Errorf("check list ownership: %w", err)
	}
	if ownerID != userID {
		return list.Item{}, list.ErrForbidden
	}

	bookUUID, err := p.resolveBookUUID(ctx, input.BookID, input.Title)
	if err != nil {
		return list.Item{}, fmt.Errorf("resolve book uuid: %w", err)
	}

	// Calculate position if not provided
	position := 0
	if input.Position != nil {
		position = *input.Position
	} else {
		err := p.pool.QueryRow(ctx, `
			SELECT COALESCE(MAX(position) + 1, 0)
			FROM book_list_items
			WHERE list_id = $1`,
			listID,
		).Scan(&position)
		if err != nil {
			return list.Item{}, fmt.Errorf("determine position: %w", err)
		}
	}

	var item list.Item
	var publishedYear *int16
	err = p.pool.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO book_list_items (list_id, book_id, position, notes)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (list_id, book_id) DO UPDATE
			SET notes = COALESCE(EXCLUDED.notes, book_list_items.notes)
			RETURNING list_id, book_id, position, notes, created_at
		)
		SELECT 
			i.list_id, i.book_id, i.position, i.notes, i.created_at,
			b.id, b.title, b.authors, b.cover_url, b.published_year
		FROM inserted i
		JOIN books b ON b.id = i.book_id`,
		listID, bookUUID, position, input.Notes,
	).Scan(
		&item.ListID, &item.BookID, &item.Position, &item.Notes, &item.CreatedAt,
		&item.Book.ID, &item.Book.Title, &item.Book.Authors, &item.Book.CoverURL, &publishedYear,
	)
	if err != nil {
		return list.Item{}, fmt.Errorf("insert book into list: %w", err)
	}

	if publishedYear != nil {
		py := int(*publishedYear)
		item.Book.PublishedYear = &py
	}

	// Touch updated_at on the parent list
	_, _ = p.pool.Exec(ctx, "UPDATE book_lists SET updated_at = now() WHERE id = $1", listID)

	return item, nil
}

func (p *Postgres) RemoveBookFromList(ctx context.Context, listID string, userID string, bookID string) error {
	var ownerID string
	err := p.pool.QueryRow(ctx, "SELECT user_id FROM book_lists WHERE id = $1", listID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return list.ErrNotFound
		}
		return fmt.Errorf("check list ownership: %w", err)
	}
	if ownerID != userID {
		return list.ErrForbidden
	}

	bookUUID, _ := p.resolveBookUUID(ctx, bookID, nil)

	_, err = p.pool.Exec(ctx, `
		DELETE FROM book_list_items 
		WHERE list_id = $1 
		  AND (book_id::text = $2 OR book_id::text = $3)`,
		listID, bookID, bookUUID,
	)
	if err != nil {
		return fmt.Errorf("remove book from list: %w", err)
	}

	// Touch updated_at on parent list
	_, _ = p.pool.Exec(ctx, "UPDATE book_lists SET updated_at = now() WHERE id = $1", listID)

	return nil
}

func (p *Postgres) UpdateListItem(ctx context.Context, listID string, userID string, bookID string, input list.UpdateItemInput) error {
	var ownerID string
	err := p.pool.QueryRow(ctx, "SELECT user_id FROM book_lists WHERE id = $1", listID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return list.ErrNotFound
		}
		return fmt.Errorf("check list ownership: %w", err)
	}
	if ownerID != userID {
		return list.ErrForbidden
	}

	_, err = p.pool.Exec(ctx, `
		UPDATE book_list_items
		SET 
			notes = CASE WHEN $1::boolean THEN $2 ELSE notes END,
			position = COALESCE($3, position)
		WHERE list_id = $4 AND book_id = $5`,
		input.Notes != nil, input.Notes, input.Position, listID, bookID,
	)
	if err != nil {
		return fmt.Errorf("update list item: %w", err)
	}

	_, _ = p.pool.Exec(ctx, "UPDATE book_lists SET updated_at = now() WHERE id = $1", listID)
	return nil
}

func (p *Postgres) GetBookListsForUser(ctx context.Context, userID string, bookID string) ([]string, error) {
	bookUUID, _ := p.resolveBookUUID(ctx, bookID, nil)

	rows, err := p.pool.Query(ctx, `
		SELECT bli.list_id
		FROM book_list_items bli
		JOIN book_lists bl ON bl.id = bli.list_id
		WHERE bl.user_id = $1 AND (bli.book_id::text = $2 OR bli.book_id::text = $3)`,
		userID, bookID, bookUUID,
	)
	if err != nil {
		return nil, fmt.Errorf("query book lists for user: %w", err)
	}
	defer rows.Close()

	var listIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan book list id: %w", err)
		}
		listIDs = append(listIDs, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate book list ids: %w", err)
	}

	if listIDs == nil {
		listIDs = []string{}
	}
	return listIDs, nil
}
