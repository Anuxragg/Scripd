package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/scripd-app/scripd/internal/comment"
	"github.com/stretchr/testify/require"
)

type mockCommentStore struct {
	likes         map[string]map[string]bool
	comments      map[string]comment.Comment
	reviewOwners  map[string]string // commentID -> reviewOwnerID
	reviewComment map[string][]comment.Comment
	err           error
}

func newMockCommentStore() *mockCommentStore {
	return &mockCommentStore{
		likes:         make(map[string]map[string]bool),
		comments:      make(map[string]comment.Comment),
		reviewOwners:  make(map[string]string),
		reviewComment: make(map[string][]comment.Comment),
	}
}

func (m *mockCommentStore) LikeReview(ctx context.Context, reviewID, userID string) error {
	if m.err != nil {
		return m.err
	}
	if m.likes[reviewID] == nil {
		m.likes[reviewID] = make(map[string]bool)
	}
	m.likes[reviewID][userID] = true
	return nil
}

func (m *mockCommentStore) UnlikeReview(ctx context.Context, reviewID, userID string) error {
	if m.err != nil {
		return m.err
	}
	if m.likes[reviewID] != nil {
		delete(m.likes[reviewID], userID)
	}
	return nil
}

func (m *mockCommentStore) GetSocialStats(ctx context.Context, reviewID, viewerID string) (comment.ReviewSocialStats, error) {
	if m.err != nil {
		return comment.ReviewSocialStats{}, m.err
	}
	likesCount := len(m.likes[reviewID])
	commentsCount := len(m.reviewComment[reviewID])
	isLiked := viewerID != "" && m.likes[reviewID] != nil && m.likes[reviewID][viewerID]
	return comment.ReviewSocialStats{
		ReviewID:      reviewID,
		LikesCount:    likesCount,
		CommentsCount: commentsCount,
		IsLiked:       isLiked,
	}, nil
}

func (m *mockCommentStore) CreateComment(ctx context.Context, reviewID, userID, body string) (comment.Comment, error) {
	if m.err != nil {
		return comment.Comment{}, m.err
	}
	c := comment.Comment{
		ID:        "comment-123",
		ReviewID:  reviewID,
		UserID:    userID,
		Body:      body,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		Author: comment.AuthorSummary{
			ID:       userID,
			Username: "tester",
		},
	}
	m.comments[c.ID] = c
	m.reviewComment[reviewID] = append(m.reviewComment[reviewID], c)
	return c, nil
}

func (m *mockCommentStore) ListComments(ctx context.Context, reviewID string, limit, offset int) ([]comment.Comment, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.reviewComment[reviewID], nil
}

func (m *mockCommentStore) GetCommentWithReviewOwner(ctx context.Context, commentID string) (comment.Comment, string, error) {
	if m.err != nil {
		return comment.Comment{}, "", m.err
	}
	c, ok := m.comments[commentID]
	if !ok {
		return comment.Comment{}, "", comment.ErrCommentNotFound
	}
	return c, m.reviewOwners[commentID], nil
}

func (m *mockCommentStore) DeleteComment(ctx context.Context, commentID string) error {
	if m.err != nil {
		return m.err
	}
	delete(m.comments, commentID)
	return nil
}

func TestCommentService(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateComment validates inputs", func(t *testing.T) {
		svc := New(newMockCommentStore())

		// Empty body
		_, err := svc.CreateComment(ctx, "rev-1", "user-1", comment.CreateCommentInput{Body: "   "})
		require.ErrorIs(t, err, comment.ErrInvalidInput)

		// Too long body
		tooLong := strings.Repeat("a", 2001)
		_, err = svc.CreateComment(ctx, "rev-1", "user-1", comment.CreateCommentInput{Body: tooLong})
		require.ErrorIs(t, err, comment.ErrInvalidInput)

		// Valid body
		c, err := svc.CreateComment(ctx, "rev-1", "user-1", comment.CreateCommentInput{Body: "Great review!"})
		require.NoError(t, err)
		require.Equal(t, "Great review!", c.Body)
	})

	t.Run("Like and Unlike review", func(t *testing.T) {
		store := newMockCommentStore()
		svc := New(store)

		// Invalid IDs
		require.ErrorIs(t, svc.LikeReview(ctx, "", "user-1"), comment.ErrInvalidInput)
		require.ErrorIs(t, svc.UnlikeReview(ctx, "rev-1", ""), comment.ErrInvalidInput)

		// Like
		require.NoError(t, svc.LikeReview(ctx, "rev-1", "user-1"))
		stats, err := svc.GetSocialStats(ctx, "rev-1", "user-1")
		require.NoError(t, err)
		require.Equal(t, 1, stats.LikesCount)
		require.True(t, stats.IsLiked)

		// Unlike
		require.NoError(t, svc.UnlikeReview(ctx, "rev-1", "user-1"))
		stats, err = svc.GetSocialStats(ctx, "rev-1", "user-1")
		require.NoError(t, err)
		require.Equal(t, 0, stats.LikesCount)
		require.False(t, stats.IsLiked)
	})

	t.Run("DeleteComment enforces ownership and moderator rules", func(t *testing.T) {
		store := newMockCommentStore()
		store.comments["c-1"] = comment.Comment{
			ID:       "c-1",
			ReviewID: "rev-1",
			UserID:   "author-id",
		}
		store.reviewOwners["c-1"] = "review-owner-id"
		svc := New(store)

		// Stranger cannot delete
		err := svc.DeleteComment(ctx, "c-1", "stranger-id")
		require.ErrorIs(t, err, comment.ErrUnauthorized)

		// Comment author CAN delete
		err = svc.DeleteComment(ctx, "c-1", "author-id")
		require.NoError(t, err)

		// Re-add comment
		store.comments["c-2"] = comment.Comment{
			ID:       "c-2",
			ReviewID: "rev-1",
			UserID:   "author-id",
		}
		store.reviewOwners["c-2"] = "review-owner-id"

		// Review owner CAN also delete (moderation of own review comments)
		err = svc.DeleteComment(ctx, "c-2", "review-owner-id")
		require.NoError(t, err)

		// Nonexistent comment
		err = svc.DeleteComment(ctx, "nonexistent", "author-id")
		require.ErrorIs(t, err, comment.ErrCommentNotFound)
	})
}
