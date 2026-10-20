package follow

import (
	"errors"
	"time"
)

var (
	ErrCannotFollowSelf = errors.New("cannot follow yourself")
	ErrAlreadyFollowing = errors.New("already following this user")
	ErrNotFollowing     = errors.New("not following this user")
	ErrUserNotFound     = errors.New("user not found")
	ErrInvalidInput     = errors.New("invalid follow input")
)

type FollowStatus struct {
	IsFollowing    bool `json:"is_following"`
	FollowersCount int  `json:"followers_count"`
	FollowingCount int  `json:"following_count"`
}

type FollowUser struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	AvatarURL   string    `json:"avatar_url"`
	FollowedAt  time.Time `json:"followed_at"`
}
