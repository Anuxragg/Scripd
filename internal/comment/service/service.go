package service

import (
	"context"
	"strings"
	"unicode/utf8"

	"github.com/scripd-app/scripd/internal/comment"
)

const (
	MaximumCommentBody = 2000
	DefaultPageLimit   = 50
	MaximumPageLimit   = 100
)

type Store interface {
	LikeReview(ctx context.Context, reviewID, userID string) error
	UnlikeReview(ctx context.Context, reviewID, userID string) error
	GetSocialStats(ctx context.Context, reviewID, viewerID string) (comment.ReviewSocialStats, error)
	CreateComment(ctx context.Context, reviewID, userID, body string) (comment.Comment, error)
	ListComments(ctx context.Context, reviewID string, limit, offset int) ([]comment.Comment, error)
	GetCommentWithReviewOwner(ctx context.Context, commentID string) (comment.Comment, string, error)
	DeleteComment(ctx context.Context, commentID string) error
}

type Service struct {
	store Store
}

func New(store Store) *Service {
	return &Service{store: store}
}

func (s *Service) LikeReview(ctx context.Context, reviewID, userID string) error {
	reviewID = strings.TrimSpace(reviewID)
	userID = strings.TrimSpace(userID)
	if reviewID == "" || userID == "" {
		return comment.ErrInvalidInput
	}
	return s.store.LikeReview(ctx, reviewID, userID)
}

func (s *Service) UnlikeReview(ctx context.Context, reviewID, userID string) error {
	reviewID = strings.TrimSpace(reviewID)
	userID = strings.TrimSpace(userID)
	if reviewID == "" || userID == "" {
		return comment.ErrInvalidInput
	}
	return s.store.UnlikeReview(ctx, reviewID, userID)
}

func (s *Service) GetSocialStats(ctx context.Context, reviewID, viewerID string) (comment.ReviewSocialStats, error) {
	reviewID = strings.TrimSpace(reviewID)
	if reviewID == "" {
		return comment.ReviewSocialStats{}, comment.ErrInvalidInput
	}
	return s.store.GetSocialStats(ctx, reviewID, strings.TrimSpace(viewerID))
}

func (s *Service) CreateComment(ctx context.Context, reviewID, userID string, input comment.CreateCommentInput) (comment.Comment, error) {
	reviewID = strings.TrimSpace(reviewID)
	userID = strings.TrimSpace(userID)
	body := strings.TrimSpace(input.Body)

	if reviewID == "" || userID == "" || body == "" {
		return comment.Comment{}, comment.ErrInvalidInput
	}
	if utf8.RuneCountInString(body) > MaximumCommentBody {
		return comment.Comment{}, comment.ErrInvalidInput
	}

	return s.store.CreateComment(ctx, reviewID, userID, body)
}

func (s *Service) ListComments(ctx context.Context, reviewID string, limit, offset int) ([]comment.Comment, error) {
	reviewID = strings.TrimSpace(reviewID)
	if reviewID == "" {
		return nil, comment.ErrInvalidInput
	}
	if limit <= 0 {
		limit = DefaultPageLimit
	}
	if limit > MaximumPageLimit {
		limit = MaximumPageLimit
	}
	if offset < 0 {
		offset = 0
	}
	return s.store.ListComments(ctx, reviewID, limit, offset)
}

func (s *Service) DeleteComment(ctx context.Context, commentID, requestingUserID string) error {
	commentID = strings.TrimSpace(commentID)
	requestingUserID = strings.TrimSpace(requestingUserID)
	if commentID == "" || requestingUserID == "" {
		return comment.ErrInvalidInput
	}

	c, reviewOwnerID, err := s.store.GetCommentWithReviewOwner(ctx, commentID)
	if err != nil {
		return err
	}

	// Authorized if requester is the comment author OR the review owner
	if requestingUserID != c.UserID && requestingUserID != reviewOwnerID {
		return comment.ErrUnauthorized
	}

	return s.store.DeleteComment(ctx, commentID)
}
