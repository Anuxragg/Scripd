package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/scripd-app/scripd/internal/read"
	"github.com/scripd-app/scripd/internal/review"
)

var uuidPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

const (
	DefaultPageSize = 20
	MaximumPageSize = 50
	MaximumBody     = 10000
)

type ReviewStore interface {
	Create(ctx context.Context, userID, bookID string, input review.CreateInput) (review.Review, error)
	GetByID(ctx context.Context, id string) (review.Review, error)
	GetByReadID(ctx context.Context, readID string) (review.Review, error)
	Update(ctx context.Context, userID, id string, input review.UpdateInput) (review.Review, error)
	Delete(ctx context.Context, userID, id string) error
	ListByBook(ctx context.Context, bookID string, opts review.ListOptions) ([]review.Review, error)
}

type ReadStore interface {
	GetByID(ctx context.Context, userID, entryID string) (read.Entry, error)
}

type Service struct {
	reviews ReviewStore
	reads   ReadStore
}

type ListPage struct {
	Reviews    []review.Review
	NextCursor *string
	HasMore    bool
}

type cursorPayload struct {
	CreatedAt time.Time `json:"c"`
	ID        string    `json:"i"`
}

func New(reviews ReviewStore, reads ReadStore) *Service {
	return &Service{
		reviews: reviews,
		reads:   reads,
	}
}

func (s *Service) Create(ctx context.Context, userID string, input review.CreateInput) (review.Review, error) {
	if !isValidUUID(userID) || !isValidUUID(input.ReadID) {
		return review.Review{}, review.ErrInvalidInput
	}

	body := strings.TrimSpace(input.Body)
	if body == "" || utf8.RuneCountInString(body) > MaximumBody {
		return review.Review{}, review.ErrInvalidInput
	}
	input.Body = body

	// Ensure the user owns this reading entry and get its associated book_id
	readEntry, err := s.reads.GetByID(ctx, userID, input.ReadID)
	if err != nil {
		if errors.Is(err, read.ErrNotFound) {
			return review.Review{}, review.ErrNotFound
		}
		return review.Review{}, fmt.Errorf("lookup read entry for review: %w", err)
	}

	return s.reviews.Create(ctx, userID, readEntry.BookID, input)
}

func (s *Service) GetByID(ctx context.Context, id string) (review.Review, error) {
	if !isValidUUID(id) {
		return review.Review{}, review.ErrNotFound
	}
	return s.reviews.GetByID(ctx, id)
}

func (s *Service) GetByReadID(ctx context.Context, readID string) (review.Review, error) {
	if !isValidUUID(readID) {
		return review.Review{}, review.ErrNotFound
	}
	return s.reviews.GetByReadID(ctx, readID)
}

func (s *Service) Update(ctx context.Context, userID, id string, input review.UpdateInput) (review.Review, error) {
	if !isValidUUID(userID) || !isValidUUID(id) {
		return review.Review{}, review.ErrInvalidInput
	}

	body := strings.TrimSpace(input.Body)
	if body == "" || utf8.RuneCountInString(body) > MaximumBody {
		return review.Review{}, review.ErrInvalidInput
	}
	input.Body = body

	return s.reviews.Update(ctx, userID, id, input)
}

func (s *Service) Delete(ctx context.Context, userID, id string) error {
	if !isValidUUID(userID) || !isValidUUID(id) {
		return review.ErrNotFound
	}
	return s.reviews.Delete(ctx, userID, id)
}

func (s *Service) ListByBook(ctx context.Context, bookID string, cursor string, limit int) (ListPage, error) {
	if !isValidUUID(bookID) {
		return ListPage{}, review.ErrInvalidInput
	}

	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaximumPageSize {
		limit = MaximumPageSize
	}

	opts := review.ListOptions{
		Limit: limit + 1, // fetch 1 extra to check for hasMore
	}

	if cursor != "" {
		c, err := decodeCursor(cursor)
		if err != nil {
			return ListPage{}, review.ErrInvalidInput
		}
		opts.CursorCreatedAt = &c.CreatedAt
		opts.CursorID = c.ID
	}

	items, err := s.reviews.ListByBook(ctx, bookID, opts)
	if err != nil {
		return ListPage{}, err
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	var nextCursor *string
	if hasMore && len(items) > 0 {
		last := items[len(items)-1]
		encoded := encodeCursor(cursorPayload{
			CreatedAt: last.CreatedAt,
			ID:        last.ID,
		})
		nextCursor = &encoded
	}

	return ListPage{
		Reviews:    items,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}, nil
}

func isValidUUID(value string) bool {
	return uuidPattern.MatchString(strings.TrimSpace(value))
}

func encodeCursor(c cursorPayload) string {
	var buf bytes.Buffer
	_ = json.NewEncoder(&buf).Encode(c)
	return base64.RawURLEncoding.EncodeToString(bytes.TrimSpace(buf.Bytes()))
}

func decodeCursor(raw string) (cursorPayload, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return cursorPayload{}, err
	}
	var c cursorPayload
	if err := json.Unmarshal(decoded, &c); err != nil {
		return cursorPayload{}, err
	}
	if c.ID == "" || c.CreatedAt.IsZero() {
		return cursorPayload{}, errors.New("incomplete cursor")
	}
	return c, nil
}
