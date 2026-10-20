package feed

import (
	"time"

	"github.com/scripd-app/scripd/internal/read"
)

type FeedUser struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
}

type FeedBook struct {
	ID            string   `json:"id"`
	Title         string   `json:"title"`
	Authors       []string `json:"authors"`
	CoverURL      string   `json:"cover_url"`
	PublishedYear *int     `json:"published_year,omitempty"`
}

type FeedReview struct {
	ID               string `json:"id"`
	Body             string `json:"body"`
	ContainsSpoilers bool   `json:"contains_spoilers"`
}

type FeedItem struct {
	ID         string      `json:"id"`
	User       FeedUser    `json:"user"`
	Book       FeedBook    `json:"book"`
	Status     read.Status `json:"status"`
	Rating     *float64    `json:"rating,omitempty"`
	Notes      *string     `json:"notes,omitempty"`
	StartedAt  *time.Time  `json:"started_at,omitempty"`
	FinishedAt *time.Time  `json:"finished_at,omitempty"`
	Review     *FeedReview `json:"review,omitempty"`
	CreatedAt  time.Time   `json:"created_at"`
}

type FeedOptions struct {
	CursorCreatedAt *time.Time
	CursorID        *string
	Limit           int
}

type FeedPage struct {
	Items      []FeedItem `json:"items"`
	NextCursor *string    `json:"next_cursor"`
	HasMore    bool       `json:"has_more"`
}
