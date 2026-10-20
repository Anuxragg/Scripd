package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/scripd-app/scripd/internal/feed"
	"github.com/scripd-app/scripd/internal/read"
	"github.com/stretchr/testify/require"
)

type mockFeedStore struct {
	items []feed.FeedItem
	err   error
}

func (m *mockFeedStore) GetTimeline(ctx context.Context, userID string, opts feed.FeedOptions) ([]feed.FeedItem, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.items, nil
}

func TestFeedService(t *testing.T) {
	ctx := context.Background()

	now := time.Now().UTC()
	var testItems []feed.FeedItem
	for i := 1; i <= 25; i++ {
		testItems = append(testItems, feed.FeedItem{
			ID: fmt.Sprintf("read-%02d", i),
			User: feed.FeedUser{
				ID:       "user-1",
				Username: "alice",
			},
			Book: feed.FeedBook{
				ID:      "book-1",
				Title:   "Dune",
				Authors: []string{"Frank Herbert"},
			},
			Status:    read.StatusReading,
			CreatedAt: now.Add(-time.Duration(i) * time.Hour),
		})
	}

	t.Run("GetTimeline handles pagination with hasMore and cursor", func(t *testing.T) {
		store := &mockFeedStore{items: testItems[:11]} // 10 requested + 1 extra returned by repo
		svc := New(store)

		page, err := svc.GetTimeline(ctx, "user-1", 10, "")
		require.NoError(t, err)
		require.Len(t, page.Items, 10)
		require.True(t, page.HasMore)
		require.NotNil(t, page.NextCursor)

		// Decode cursor to verify payload
		cursor, err := decodeCursor(*page.NextCursor)
		require.NoError(t, err)
		require.Equal(t, "read-10", cursor.ID)
	})

	t.Run("GetTimeline handles last page", func(t *testing.T) {
		store := &mockFeedStore{items: testItems[:5]}
		svc := New(store)

		page, err := svc.GetTimeline(ctx, "user-1", 10, "")
		require.NoError(t, err)
		require.Len(t, page.Items, 5)
		require.False(t, page.HasMore)
		require.Nil(t, page.NextCursor)
	})

	t.Run("GetTimeline rejects invalid cursor", func(t *testing.T) {
		svc := New(&mockFeedStore{})
		_, err := svc.GetTimeline(ctx, "user-1", 10, "invalid-base64-not-json")
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid cursor")
	})

	t.Run("GetTimeline clamps maximum limit", func(t *testing.T) {
		store := &mockFeedStore{items: []feed.FeedItem{}}
		svc := New(store)

		page, err := svc.GetTimeline(ctx, "user-1", 100, "")
		require.NoError(t, err)
		require.Empty(t, page.Items)
	})
}
