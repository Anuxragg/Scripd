package comment

import (
	"errors"
	"time"
)

var (
	ErrCommentNotFound = errors.New("comment not found")
	ErrReviewNotFound  = errors.New("review not found")
	ErrUnauthorized    = errors.New("unauthorized action on comment")
	ErrInvalidInput    = errors.New("invalid comment input")
)

type AuthorSummary struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
}

type Comment struct {
	ID        string        `json:"id"`
	ReviewID  string        `json:"review_id"`
	UserID    string        `json:"user_id"`
	Body      string        `json:"body"`
	Author    AuthorSummary `json:"author"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

type CreateCommentInput struct {
	Body string `json:"body"`
}

type ReviewSocialStats struct {
	ReviewID      string `json:"review_id"`
	LikesCount    int    `json:"likes_count"`
	CommentsCount int    `json:"comments_count"`
	IsLiked       bool   `json:"is_liked"`
}
