package review

import (
	"errors"
	"time"
)

var (
	ErrInvalidInput = errors.New("invalid review input")
	ErrNotFound     = errors.New("review not found")
	ErrConflict     = errors.New("review already exists for this reading entry")
	ErrForbidden    = errors.New("not authorized to modify this review")
)

type AuthorSummary struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name,omitempty"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
}

type BookSummary struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Authors  []string `json:"authors"`
	CoverURL *string  `json:"cover_url,omitempty"`
}

type Review struct {
	ID               string        `json:"id"`
	ReadID           string        `json:"read_id"`
	UserID           string        `json:"user_id"`
	BookID           string        `json:"book_id"`
	Body             string        `json:"body"`
	ContainsSpoilers bool          `json:"contains_spoilers"`
	Rating           *float64      `json:"rating,omitempty"`
	Author           AuthorSummary `json:"author"`
	Book             BookSummary   `json:"book"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
}

type CreateInput struct {
	ReadID           string `json:"read_id"`
	Body             string `json:"body"`
	ContainsSpoilers bool   `json:"contains_spoilers"`
}

type UpdateInput struct {
	Body             string `json:"body"`
	ContainsSpoilers bool   `json:"contains_spoilers"`
}

type ListOptions struct {
	CursorCreatedAt *time.Time
	CursorID        string
	Limit           int
}
