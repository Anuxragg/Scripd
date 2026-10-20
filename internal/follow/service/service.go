package service

import (
	"context"
	"strings"

	"github.com/scripd-app/scripd/internal/follow"
	"github.com/scripd-app/scripd/internal/user"
)

type Store interface {
	Follow(ctx context.Context, followerID, followingID string) error
	Unfollow(ctx context.Context, followerID, followingID string) error
	IsFollowing(ctx context.Context, followerID, followingID string) (bool, error)
	GetCounts(ctx context.Context, userID string) (int, int, error)
	ListFollowers(ctx context.Context, userID string, limit int) ([]follow.FollowUser, error)
	ListFollowing(ctx context.Context, userID string, limit int) ([]follow.FollowUser, error)
}

type UserResolver interface {
	GetProfile(ctx context.Context, username string) (user.PublicProfile, error)
}

type Service struct {
	store Store
	users UserResolver
}

func New(store Store, users UserResolver) *Service {
	return &Service{
		store: store,
		users: users,
	}
}

func (s *Service) Follow(ctx context.Context, followerID, targetUsername string) error {
	target, err := s.users.GetProfile(ctx, strings.TrimSpace(targetUsername))
	if err != nil {
		return follow.ErrUserNotFound
	}
	if followerID == target.ID {
		return follow.ErrCannotFollowSelf
	}
	return s.store.Follow(ctx, followerID, target.ID)
}

func (s *Service) Unfollow(ctx context.Context, followerID, targetUsername string) error {
	target, err := s.users.GetProfile(ctx, strings.TrimSpace(targetUsername))
	if err != nil {
		return follow.ErrUserNotFound
	}
	return s.store.Unfollow(ctx, followerID, target.ID)
}

func (s *Service) GetStatus(ctx context.Context, viewerID, targetUsername string) (follow.FollowStatus, error) {
	target, err := s.users.GetProfile(ctx, strings.TrimSpace(targetUsername))
	if err != nil {
		return follow.FollowStatus{}, follow.ErrUserNotFound
	}

	followers, following, err := s.store.GetCounts(ctx, target.ID)
	if err != nil {
		return follow.FollowStatus{}, err
	}

	isFollowing := false
	if viewerID != "" && viewerID != target.ID {
		isFollowing, err = s.store.IsFollowing(ctx, viewerID, target.ID)
		if err != nil {
			return follow.FollowStatus{}, err
		}
	}

	return follow.FollowStatus{
		IsFollowing:    isFollowing,
		FollowersCount: followers,
		FollowingCount: following,
	}, nil
}

func (s *Service) ListFollowers(ctx context.Context, targetUsername string, limit int) ([]follow.FollowUser, error) {
	target, err := s.users.GetProfile(ctx, strings.TrimSpace(targetUsername))
	if err != nil {
		return nil, follow.ErrUserNotFound
	}
	return s.store.ListFollowers(ctx, target.ID, limit)
}

func (s *Service) ListFollowing(ctx context.Context, targetUsername string, limit int) ([]follow.FollowUser, error) {
	target, err := s.users.GetProfile(ctx, strings.TrimSpace(targetUsername))
	if err != nil {
		return nil, follow.ErrUserNotFound
	}
	return s.store.ListFollowing(ctx, target.ID, limit)
}
