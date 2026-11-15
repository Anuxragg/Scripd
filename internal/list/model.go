package list

import (
	"errors"
	"time"
)

var (
	ErrNotFound     = errors.New("list not found")
	ErrForbidden    = errors.New("not authorized to access or modify this list")
	ErrInvalidInput = errors.New("invalid list input")
	ErrConflict     = errors.New("book is already in this list")
)

type AuthorSummary struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name,omitempty"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
}

type BookSummary struct {
	ID            string   `json:"id"`
	Title         string   `json:"title"`
	Authors       []string `json:"authors"`
	CoverURL      *string  `json:"cover_url,omitempty"`
	PublishedYear *int     `json:"published_year,omitempty"`
}

type Item struct {
	ListID    string      `json:"list_id"`
	BookID    string      `json:"book_id"`
	Position  int         `json:"position"`
	Notes     *string     `json:"notes,omitempty"`
	Book      BookSummary `json:"book"`
	CreatedAt time.Time   `json:"created_at"`
}

type List struct {
	ID           string        `json:"id"`
	UserID       string        `json:"user_id"`
	Title        string        `json:"title"`
	Description  *string       `json:"description,omitempty"`
	IsPrivate    bool          `json:"is_private"`
	ItemCount    int           `json:"item_count"`
	SampleCovers []string      `json:"sample_covers"`
	Author       AuthorSummary `json:"author"`
	Items        []Item        `json:"items,omitempty"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

type CreateListInput struct {
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	IsPrivate   bool    `json:"is_private"`
}

type UpdateListInput struct {
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
	IsPrivate   *bool   `json:"is_private,omitempty"`
}

type AddBookInput struct {
	BookID   string  `json:"book_id"`
	Title    *string `json:"title,omitempty"`
	Notes    *string `json:"notes,omitempty"`
	Position *int    `json:"position,omitempty"`
}

type UpdateItemInput struct {
	Notes    *string `json:"notes,omitempty"`
	Position *int    `json:"position,omitempty"`
}
