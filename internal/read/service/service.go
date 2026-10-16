package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/scripd-app/scripd/internal/read"
)

var (
	ErrInvalidInput = read.ErrInvalidInput
	userIDPattern   = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
)

const (
	DefaultPageSize = 12
	MaximumPageSize = 50
	MaximumNotes    = 2000
)

type Store interface {
	Create(context.Context, string, read.EntryInput) (read.Entry, error)
	GetByID(context.Context, string, string) (read.Entry, error)
	List(context.Context, string, read.ListFilter, *read.Cursor, int) ([]read.Entry, error)
	Update(context.Context, string, string, time.Time, read.EntryInput) (read.Entry, error)
	Delete(context.Context, string, string) error
}

type Service struct {
	store Store
	now   func() time.Time
}

type ListPage struct {
	Entries    []read.Entry
	NextCursor *string
	HasMore    bool
}

func New(store Store) *Service {
	return &Service{store: store, now: time.Now}
}

func (s *Service) Create(ctx context.Context, userID string, input read.EntryInput) (read.Entry, error) {
	if !validUUID(userID) || !validUUID(input.BookID) {
		return read.Entry{}, ErrInvalidInput
	}
	normalized, err := normalizeInput(input, s.now().UTC())
	if err != nil {
		return read.Entry{}, err
	}
	return s.store.Create(ctx, userID, normalized)
}

func (s *Service) GetByID(ctx context.Context, userID, entryID string) (read.Entry, error) {
	if !validUUID(userID) || !validUUID(entryID) {
		return read.Entry{}, read.ErrNotFound
	}
	entry, err := s.store.GetByID(ctx, userID, entryID)
	if errors.Is(err, read.ErrNotFound) {
		return read.Entry{}, read.ErrNotFound
	}
	if err != nil {
		return read.Entry{}, fmt.Errorf("get reading entry: %w", err)
	}
	return entry, nil
}

func (s *Service) List(ctx context.Context, userID string, filter read.ListFilter, cursorToken string) (ListPage, error) {
	if !validUUID(userID) {
		return ListPage{}, ErrInvalidInput
	}
	if filter.Limit == 0 {
		filter.Limit = DefaultPageSize
	}
	if filter.Limit < 1 || filter.Limit > MaximumPageSize {
		return ListPage{}, ErrInvalidInput
	}
	if filter.Status != "" && !validStatus(filter.Status) {
		return ListPage{}, ErrInvalidInput
	}
	if filter.BookID != "" && !validUUID(filter.BookID) {
		return ListPage{}, ErrInvalidInput
	}

	cursor, err := decodeCursor(cursorToken)
	if err != nil {
		return ListPage{}, ErrInvalidInput
	}
	entries, err := s.store.List(ctx, userID, filter, cursor, filter.Limit+1)
	if err != nil {
		return ListPage{}, fmt.Errorf("list reading entries: %w", err)
	}
	page := ListPage{Entries: entries, HasMore: len(entries) > filter.Limit}
	if page.HasMore {
		page.Entries = entries[:filter.Limit]
		last := page.Entries[len(page.Entries)-1]
		token, err := encodeCursor(read.Cursor{ID: last.ID, CreatedAt: last.CreatedAt})
		if err != nil {
			return ListPage{}, fmt.Errorf("encode reading list cursor: %w", err)
		}
		page.NextCursor = &token
	}
	if page.Entries == nil {
		page.Entries = []read.Entry{}
	}
	return page, nil
}

func (s *Service) Update(ctx context.Context, userID, entryID string, input read.EntryInput) (read.Entry, error) {
	if !validUUID(userID) || !validUUID(entryID) {
		return read.Entry{}, read.ErrNotFound
	}
	existing, err := s.store.GetByID(ctx, userID, entryID)
	if errors.Is(err, read.ErrNotFound) {
		return read.Entry{}, read.ErrNotFound
	}
	if err != nil {
		return read.Entry{}, fmt.Errorf("get reading entry before update: %w", err)
	}
	input.BookID = existing.BookID
	normalized, err := normalizeInput(input, s.now().UTC())
	if err != nil {
		return read.Entry{}, err
	}
	updated, err := s.store.Update(ctx, userID, entryID, existing.UpdatedAt, normalized)
	if errors.Is(err, read.ErrNotFound) || errors.Is(err, read.ErrAlreadyActive) || errors.Is(err, read.ErrUpdateConflict) {
		return read.Entry{}, err
	}
	if err != nil {
		return read.Entry{}, fmt.Errorf("update reading entry: %w", err)
	}
	return updated, nil
}

func (s *Service) Delete(ctx context.Context, userID, entryID string) error {
	if !validUUID(userID) || !validUUID(entryID) {
		return read.ErrNotFound
	}
	if err := s.store.Delete(ctx, userID, entryID); errors.Is(err, read.ErrNotFound) {
		return read.ErrNotFound
	} else if err != nil {
		return fmt.Errorf("delete reading entry: %w", err)
	}
	return nil
}

func normalizeInput(input read.EntryInput, now time.Time) (read.EntryInput, error) {
	if !validStatus(input.Status) {
		return read.EntryInput{}, ErrInvalidInput
	}
	input.Status = read.Status(strings.TrimSpace(string(input.Status)))
	if input.Notes != nil {
		trimmed := strings.TrimSpace(*input.Notes)
		if utf8.RuneCountInString(trimmed) > MaximumNotes {
			return read.EntryInput{}, ErrInvalidInput
		}
		if trimmed == "" {
			input.Notes = nil
		} else {
			input.Notes = &trimmed
		}
	}
	if input.StartedAt != nil {
		startedAt := input.StartedAt.UTC()
		input.StartedAt = &startedAt
	}
	if input.FinishedAt != nil {
		finishedAt := input.FinishedAt.UTC()
		input.FinishedAt = &finishedAt
	}
	if input.Rating != nil && !validRating(*input.Rating) {
		return read.EntryInput{}, ErrInvalidInput
	}
	if input.StartedAt != nil && input.StartedAt.After(now.Add(24*time.Hour)) {
		return read.EntryInput{}, ErrInvalidInput
	}
	if input.FinishedAt != nil && input.FinishedAt.After(now.Add(24*time.Hour)) {
		return read.EntryInput{}, ErrInvalidInput
	}

	switch input.Status {
	case read.StatusWantToRead:
		if input.StartedAt != nil || input.FinishedAt != nil || input.Rating != nil {
			return read.EntryInput{}, ErrInvalidInput
		}
	case read.StatusReading:
		if input.FinishedAt != nil || input.Rating != nil {
			return read.EntryInput{}, ErrInvalidInput
		}
		if input.StartedAt == nil {
			startedAt := now
			input.StartedAt = &startedAt
		}
	case read.StatusRead, read.StatusDidNotFinish:
		if input.FinishedAt == nil {
			finishedAt := now
			input.FinishedAt = &finishedAt
		}
	default:
		return read.EntryInput{}, ErrInvalidInput
	}
	if input.StartedAt != nil && input.FinishedAt != nil && input.FinishedAt.Before(*input.StartedAt) {
		return read.EntryInput{}, ErrInvalidInput
	}
	return input, nil
}

func validStatus(status read.Status) bool {
	switch status {
	case read.StatusWantToRead, read.StatusReading, read.StatusRead, read.StatusDidNotFinish:
		return true
	default:
		return false
	}
}

func validRating(rating float64) bool {
	return !math.IsNaN(rating) && !math.IsInf(rating, 0) && rating >= 0.5 && rating <= 5 && math.Mod(rating*2, 1) == 0
}

func validUUID(value string) bool {
	return userIDPattern.MatchString(value)
}

type cursorPayload struct {
	CreatedAt time.Time `json:"created_at"`
	ID        string    `json:"id"`
}

func encodeCursor(cursor read.Cursor) (string, error) {
	data, err := json.Marshal(cursorPayload{CreatedAt: cursor.CreatedAt.UTC(), ID: cursor.ID})
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func decodeCursor(value string) (*read.Cursor, error) {
	if value == "" {
		return nil, nil
	}
	if len(value) > 512 {
		return nil, ErrInvalidInput
	}
	data, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil, ErrInvalidInput
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var payload cursorPayload
	if err := decoder.Decode(&payload); err != nil {
		return nil, ErrInvalidInput
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return nil, ErrInvalidInput
	}
	if !validUUID(payload.ID) || payload.CreatedAt.IsZero() {
		return nil, ErrInvalidInput
	}
	return &read.Cursor{ID: payload.ID, CreatedAt: payload.CreatedAt.UTC()}, nil
}
