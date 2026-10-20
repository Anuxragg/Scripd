package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/scripd-app/scripd/internal/follow"
	"github.com/scripd-app/scripd/internal/user"
	"github.com/stretchr/testify/require"
)

type mockUserResolver struct {
	profiles map[string]user.PublicProfile
	err      error
}

func (m *mockUserResolver) GetProfile(ctx context.Context, username string) (user.PublicProfile, error) {
	if m.err != nil {
		return user.PublicProfile{}, m.err
	}
	p, ok := m.profiles[username]
	if !ok {
		return user.PublicProfile{}, user.ErrNotFound
	}
	return p, nil
}

type mockStore struct {
	followingMap   map[string]map[string]bool
	followersCount map[string]int
	followingCount map[string]int
	followersList  map[string][]follow.FollowUser
	followingList  map[string][]follow.FollowUser
	err            error
}

func newMockStore() *mockStore {
	return &mockStore{
		followingMap:   make(map[string]map[string]bool),
		followersCount: make(map[string]int),
		followingCount: make(map[string]int),
		followersList:  make(map[string][]follow.FollowUser),
		followingList:  make(map[string][]follow.FollowUser),
	}
}

func (m *mockStore) Follow(ctx context.Context, followerID, followingID string) error {
	if m.err != nil {
		return m.err
	}
	if m.followingMap[followerID] == nil {
		m.followingMap[followerID] = make(map[string]bool)
	}
	if m.followingMap[followerID][followingID] {
		return follow.ErrAlreadyFollowing
	}
	m.followingMap[followerID][followingID] = true
	m.followersCount[followingID]++
	m.followingCount[followerID]++
	return nil
}

func (m *mockStore) Unfollow(ctx context.Context, followerID, followingID string) error {
	if m.err != nil {
		return m.err
	}
	if m.followingMap[followerID] == nil || !m.followingMap[followerID][followingID] {
		return follow.ErrNotFollowing
	}
	delete(m.followingMap[followerID], followingID)
	m.followersCount[followingID]--
	m.followingCount[followerID]--
	return nil
}

func (m *mockStore) IsFollowing(ctx context.Context, followerID, followingID string) (bool, error) {
	if m.err != nil {
		return false, m.err
	}
	return m.followingMap[followerID] != nil && m.followingMap[followerID][followingID], nil
}

func (m *mockStore) GetCounts(ctx context.Context, userID string) (int, int, error) {
	if m.err != nil {
		return 0, 0, m.err
	}
	return m.followersCount[userID], m.followingCount[userID], nil
}

func (m *mockStore) ListFollowers(ctx context.Context, userID string, limit int) ([]follow.FollowUser, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.followersList[userID], nil
}

func (m *mockStore) ListFollowing(ctx context.Context, userID string, limit int) ([]follow.FollowUser, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.followingList[userID], nil
}

func TestFollowService(t *testing.T) {
	ctx := context.Background()

	alice := user.PublicProfile{
		ID:          "11111111-1111-1111-1111-111111111111",
		Username:    "alice",
		DisplayName: "Alice",
	}
	bob := user.PublicProfile{
		ID:          "22222222-2222-2222-2222-222222222222",
		Username:    "bob",
		DisplayName: "Bob",
	}

	userResolver := &mockUserResolver{
		profiles: map[string]user.PublicProfile{
			"alice": alice,
			"bob":   bob,
		},
	}

	t.Run("Follow prevents following self", func(t *testing.T) {
		store := newMockStore()
		svc := New(store, userResolver)

		err := svc.Follow(ctx, alice.ID, "alice")
		require.ErrorIs(t, err, follow.ErrCannotFollowSelf)
	})

	t.Run("Follow fails when target user not found", func(t *testing.T) {
		store := newMockStore()
		svc := New(store, userResolver)

		err := svc.Follow(ctx, alice.ID, "nonexistent")
		require.ErrorIs(t, err, follow.ErrUserNotFound)
	})

	t.Run("Follow succeeds and updates status", func(t *testing.T) {
		store := newMockStore()
		svc := New(store, userResolver)

		err := svc.Follow(ctx, alice.ID, "bob")
		require.NoError(t, err)

		// Follow duplicate returns already following
		err = svc.Follow(ctx, alice.ID, "bob")
		require.ErrorIs(t, err, follow.ErrAlreadyFollowing)

		// Check status from alice's perspective
		status, err := svc.GetStatus(ctx, alice.ID, "bob")
		require.NoError(t, err)
		require.True(t, status.IsFollowing)
		require.Equal(t, 1, status.FollowersCount)
		require.Equal(t, 0, status.FollowingCount)

		// Check status unauthenticated
		anonStatus, err := svc.GetStatus(ctx, "", "bob")
		require.NoError(t, err)
		require.False(t, anonStatus.IsFollowing)
		require.Equal(t, 1, anonStatus.FollowersCount)

		// Check status for self (bob viewing bob)
		selfStatus, err := svc.GetStatus(ctx, bob.ID, "bob")
		require.NoError(t, err)
		require.False(t, selfStatus.IsFollowing)
		require.Equal(t, 1, selfStatus.FollowersCount)
	})

	t.Run("Unfollow succeeds and checks", func(t *testing.T) {
		store := newMockStore()
		svc := New(store, userResolver)

		// Not following initially
		err := svc.Unfollow(ctx, alice.ID, "bob")
		require.ErrorIs(t, err, follow.ErrNotFollowing)

		// Follow first
		require.NoError(t, svc.Follow(ctx, alice.ID, "bob"))

		// Unfollow
		require.NoError(t, svc.Unfollow(ctx, alice.ID, "bob"))

		status, err := svc.GetStatus(ctx, alice.ID, "bob")
		require.NoError(t, err)
		require.False(t, status.IsFollowing)
		require.Equal(t, 0, status.FollowersCount)
	})

	t.Run("List followers and following", func(t *testing.T) {
		store := newMockStore()
		store.followersList[bob.ID] = []follow.FollowUser{
			{
				ID:          alice.ID,
				Username:    alice.Username,
				DisplayName: alice.DisplayName,
				FollowedAt:  time.Now().UTC(),
			},
		}
		svc := New(store, userResolver)

		followers, err := svc.ListFollowers(ctx, "bob", 20)
		require.NoError(t, err)
		require.Len(t, followers, 1)
		require.Equal(t, alice.Username, followers[0].Username)

		// Invalid user
		_, err = svc.ListFollowers(ctx, "nonexistent", 20)
		require.ErrorIs(t, err, follow.ErrUserNotFound)

		following, err := svc.ListFollowing(ctx, "bob", 20)
		require.NoError(t, err)
		require.Empty(t, following)
	})

	t.Run("GetStatus returns error if store fails", func(t *testing.T) {
		brokenStore := newMockStore()
		brokenStore.err = errors.New("database connection failed")
		svc := New(brokenStore, userResolver)

		_, err := svc.GetStatus(ctx, alice.ID, "bob")
		require.Error(t, err)
	})
}
