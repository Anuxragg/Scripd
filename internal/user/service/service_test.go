package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/scripd-app/scripd/internal/user"
	"github.com/stretchr/testify/require"
)

type mockUserStore struct {
	profile user.PublicProfile
	err     error
	stats   user.ProfileStats
}

func (m *mockUserStore) GetByUsername(ctx context.Context, username string) (user.PublicProfile, error) {
	if m.err != nil {
		return user.PublicProfile{}, m.err
	}
	return m.profile, nil
}

func (m *mockUserStore) GetByID(ctx context.Context, id string) (user.PublicProfile, error) {
	if m.err != nil {
		return user.PublicProfile{}, m.err
	}
	return m.profile, nil
}

func (m *mockUserStore) Update(ctx context.Context, id string, input user.UpdateProfileInput) (user.PublicProfile, error) {
	if m.err != nil {
		return user.PublicProfile{}, m.err
	}
	updated := m.profile
	if input.DisplayName != nil {
		updated.DisplayName = *input.DisplayName
	}
	if input.Bio != nil {
		updated.Bio = *input.Bio
	}
	if input.AvatarURL != nil {
		updated.AvatarURL = *input.AvatarURL
	}
	return updated, nil
}

func (m *mockUserStore) GetStats(ctx context.Context, userID string) (user.ProfileStats, error) {
	if m.err != nil {
		return user.ProfileStats{}, m.err
	}
	return m.stats, nil
}

func TestUserService(t *testing.T) {
	ctx := context.Background()

	t.Run("GetProfile rejects invalid username pattern", func(t *testing.T) {
		svc := New(&mockUserStore{})
		_, err := svc.GetProfile(ctx, "a!")
		require.ErrorIs(t, err, user.ErrNotFound)
	})

	t.Run("GetProfile succeeds with valid username", func(t *testing.T) {
		mockProfile := user.PublicProfile{
			ID:          "11111111-1111-1111-1111-111111111111",
			Username:    "alice_reads",
			DisplayName: "Alice",
			CreatedAt:   time.Now().UTC(),
		}
		svc := New(&mockUserStore{profile: mockProfile})
		p, err := svc.GetProfile(ctx, "alice_reads")
		require.NoError(t, err)
		require.Equal(t, "alice_reads", p.Username)
	})

	t.Run("UpdateProfile validates length limits", func(t *testing.T) {
		svc := New(&mockUserStore{})
		tooLongName := strings.Repeat("a", 81)
		_, err := svc.UpdateProfile(ctx, "user-id", user.UpdateProfileInput{DisplayName: &tooLongName})
		require.ErrorIs(t, err, user.ErrInvalidInput)

		tooLongBio := strings.Repeat("b", 501)
		_, err = svc.UpdateProfile(ctx, "user-id", user.UpdateProfileInput{Bio: &tooLongBio})
		require.ErrorIs(t, err, user.ErrInvalidInput)

		invalidURL := "ftp://invalid-avatar"
		_, err = svc.UpdateProfile(ctx, "user-id", user.UpdateProfileInput{AvatarURL: &invalidURL})
		require.ErrorIs(t, err, user.ErrInvalidInput)
	})

	t.Run("UpdateProfile succeeds with valid inputs", func(t *testing.T) {
		mockProfile := user.PublicProfile{
			ID:          "user-id",
			Username:    "bob",
			DisplayName: "Bob",
		}
		svc := New(&mockUserStore{profile: mockProfile})
		newName := "Robert"
		newBio := "Lover of science fiction."
		newURL := "https://example.com/avatar.png"
		updated, err := svc.UpdateProfile(ctx, "user-id", user.UpdateProfileInput{
			DisplayName: &newName,
			Bio:         &newBio,
			AvatarURL:   &newURL,
		})
		require.NoError(t, err)
		require.Equal(t, "Robert", updated.DisplayName)
		require.Equal(t, "Lover of science fiction.", updated.Bio)
		require.Equal(t, "https://example.com/avatar.png", updated.AvatarURL)
	})
}
