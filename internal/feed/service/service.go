package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"

	"github.com/scripd-app/scripd/internal/feed"
)

const (
	DefaultPageSize = 20
	MaximumPageSize = 50
)

type Store interface {
	GetTimeline(ctx context.Context, userID string, opts feed.FeedOptions) ([]feed.FeedItem, error)
}

type Service struct {
	store Store
}

func New(store Store) *Service {
	return &Service{store: store}
}

type cursorPayload struct {
	CreatedAt time.Time `json:"c"`
	ID        string    `json:"i"`
}

func (s *Service) GetTimeline(ctx context.Context, userID string, limit int, cursor string) (feed.FeedPage, error) {
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaximumPageSize {
		limit = MaximumPageSize
	}

	opts := feed.FeedOptions{Limit: limit}
	if cursor != "" {
		c, err := decodeCursor(cursor)
		if err != nil {
			return feed.FeedPage{}, errors.New("invalid cursor")
		}
		opts.CursorCreatedAt = &c.CreatedAt
		opts.CursorID = &c.ID
	}

	items, err := s.store.GetTimeline(ctx, userID, opts)
	if err != nil {
		return feed.FeedPage{}, err
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

	if items == nil {
		items = []feed.FeedItem{}
	}

	return feed.FeedPage{
		Items:      items,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}, nil
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
