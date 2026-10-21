package service

import (
	"context"
	"net/url"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/scripd-app/scripd/internal/user"
)

var usernamePattern = regexp.MustCompile(`^[A-Za-z0-9_]{3,30}$`)

const (
	MaximumDisplayName = 80
	MaximumBio         = 500
)

type Store interface {
	GetByUsername(ctx context.Context, username string) (user.PublicProfile, error)
	GetByID(ctx context.Context, id string) (user.PublicProfile, error)
	Update(ctx context.Context, id string, input user.UpdateProfileInput) (user.PublicProfile, error)
	GetStats(ctx context.Context, userID string) (user.ProfileStats, error)
}

type Service struct {
	store Store
}

func New(store Store) *Service {
	return &Service{store: store}
}

func (s *Service) GetProfile(ctx context.Context, username string) (user.PublicProfile, error) {
	username = strings.TrimSpace(username)
	if !usernamePattern.MatchString(username) {
		return user.PublicProfile{}, user.ErrNotFound
	}
	return s.store.GetByUsername(ctx, username)
}

func (s *Service) GetStats(ctx context.Context, username string) (user.ProfileStats, error) {
	profile, err := s.GetProfile(ctx, username)
	if err != nil {
		return user.ProfileStats{}, err
	}
	return s.store.GetStats(ctx, profile.ID)
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, input user.UpdateProfileInput) (user.PublicProfile, error) {
	if strings.TrimSpace(userID) == "" {
		return user.PublicProfile{}, user.ErrInvalidInput
	}

	if input.DisplayName != nil {
		trimmed := strings.TrimSpace(*input.DisplayName)
		if utf8.RuneCountInString(trimmed) > MaximumDisplayName {
			return user.PublicProfile{}, user.ErrInvalidInput
		}
		input.DisplayName = &trimmed
	}

	if input.Bio != nil {
		trimmed := strings.TrimSpace(*input.Bio)
		if utf8.RuneCountInString(trimmed) > MaximumBio {
			return user.PublicProfile{}, user.ErrInvalidInput
		}
		input.Bio = &trimmed
	}

	if input.AvatarURL != nil {
		trimmed := strings.TrimSpace(*input.AvatarURL)
		if trimmed != "" {
			u, err := url.Parse(trimmed)
			if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
				return user.PublicProfile{}, user.ErrInvalidInput
			}
		}
		input.AvatarURL = &trimmed
	}

	return s.store.Update(ctx, userID, input)
} 
