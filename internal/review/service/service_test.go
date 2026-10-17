package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/scripd-app/scripd/internal/read"
	"github.com/scripd-app/scripd/internal/review"
	"github.com/stretchr/testify/require"
)

type mockReviewStore struct {
	createErr error
	reviews   []review.Review
}

func (m *mockReviewStore) Create(ctx context.Context, userID, bookID string, input review.CreateInput) (review.Review, error) {
	if m.createErr != nil {
		return review.Review{}, m.createErr
	}
	return review.Review{
		ID:               "11111111-1111-1111-1111-111111111111",
		ReadID:           input.ReadID,
		UserID:           userID,
		BookID:           bookID,
		Body:             input.Body,
		ContainsSpoilers: input.ContainsSpoilers,
	}, nil
}

func (m *mockReviewStore) GetByID(ctx context.Context, id string) (review.Review, error) {
	return review.Review{}, nil
}

func (m *mockReviewStore) GetByReadID(ctx context.Context, readID string) (review.Review, error) {
	return review.Review{}, nil
}

func (m *mockReviewStore) Update(ctx context.Context, userID, id string, input review.UpdateInput) (review.Review, error) {
	return review.Review{ID: id, Body: input.Body}, nil
}

func (m *mockReviewStore) Delete(ctx context.Context, userID, id string) error {
	return nil
}

func (m *mockReviewStore) ListByBook(ctx context.Context, bookID string, opts review.ListOptions) ([]review.Review, error) {
	return m.reviews, nil
}

type mockReadStore struct {
	entry read.Entry
	err   error
}

func (m *mockReadStore) GetByID(ctx context.Context, userID, entryID string) (read.Entry, error) {
	if m.err != nil {
		return read.Entry{}, m.err
	}
	return m.entry, nil
}

func TestReviewServiceCreateValidation(t *testing.T) {
	ctx := context.Background()
	validUserID := "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	validReadID := "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
	validBookID := "cccccccc-cccc-cccc-cccc-cccccccccccc"

	t.Run("rejects invalid UUIDs", func(t *testing.T) {
		svc := New(&mockReviewStore{}, &mockReadStore{})
		_, err := svc.Create(ctx, "invalid-uuid", review.CreateInput{ReadID: validReadID, Body: "Great read"})
		require.ErrorIs(t, err, review.ErrInvalidInput)
	})

	t.Run("rejects empty body", func(t *testing.T) {
		svc := New(&mockReviewStore{}, &mockReadStore{})
		_, err := svc.Create(ctx, validUserID, review.CreateInput{ReadID: validReadID, Body: "   "})
		require.ErrorIs(t, err, review.ErrInvalidInput)
	})

	t.Run("rejects body over 10000 chars", func(t *testing.T) {
		svc := New(&mockReviewStore{}, &mockReadStore{})
		tooLong := strings.Repeat("a", 10001)
		_, err := svc.Create(ctx, validUserID, review.CreateInput{ReadID: validReadID, Body: tooLong})
		require.ErrorIs(t, err, review.ErrInvalidInput)
	})

	t.Run("rejects when reading entry not found", func(t *testing.T) {
		svc := New(&mockReviewStore{}, &mockReadStore{err: read.ErrNotFound})
		_, err := svc.Create(ctx, validUserID, review.CreateInput{ReadID: validReadID, Body: "Great book!"})
		require.ErrorIs(t, err, review.ErrNotFound)
	})

	t.Run("succeeds with valid input and trims body", func(t *testing.T) {
		readMock := &mockReadStore{entry: read.Entry{ID: validReadID, BookID: validBookID}}
		svc := New(&mockReviewStore{}, readMock)
		created, err := svc.Create(ctx, validUserID, review.CreateInput{ReadID: validReadID, Body: "  A masterpiece.  "})
		require.NoError(t, err)
		require.Equal(t, "A masterpiece.", created.Body)
		require.Equal(t, validBookID, created.BookID)
	})
}

func TestReviewServiceListPagination(t *testing.T) {
	ctx := context.Background()
	validBookID := "cccccccc-cccc-cccc-cccc-cccccccccccc"

	now := time.Now().UTC()
	reviews := []review.Review{
		{ID: "11111111-1111-1111-1111-111111111111", CreatedAt: now},
		{ID: "22222222-2222-2222-2222-222222222222", CreatedAt: now.Add(-time.Hour)},
	}

	svc := New(&mockReviewStore{reviews: reviews}, &mockReadStore{})
	page, err := svc.ListByBook(ctx, validBookID, "", 1)
	require.NoError(t, err)
	require.Len(t, page.Reviews, 1)
	require.True(t, page.HasMore)
	require.NotNil(t, page.NextCursor)
}
