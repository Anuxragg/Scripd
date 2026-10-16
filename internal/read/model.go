package read

import (
	"errors"
	"time"
)

var (
	ErrInvalidInput   = errors.New("invalid reading entry input")
	ErrNotFound       = errors.New("reading entry not found")
	ErrBookNotFound   = errors.New("book not found")
	ErrAlreadyActive  = errors.New("book already has an active reading entry")
	ErrUpdateConflict = errors.New("reading entry was changed by another request")
)

type Status string

const (
	StatusWantToRead   Status = "want_to_read"
	StatusReading      Status = "reading"
	StatusRead         Status = "read"
	StatusDidNotFinish Status = "did_not_finish"
)

type BookSummary struct {
	ID             string   `json:"id"`
	OpenLibraryKey string   `json:"open_library_key,omitempty"`
	Title          string   `json:"title"`
	Authors        []string `json:"authors"`
	CoverURL       *string  `json:"cover_url,omitempty"`
	PublishedYear  *int     `json:"published_year,omitempty"`
	OpenLibraryURL string   `json:"open_library_url,omitempty"`
}

type Entry struct {
	ID         string      `json:"id"`
	BookID     string      `json:"book_id"`
	Status     Status      `json:"status"`
	Rating     *float64    `json:"rating,omitempty"`
	StartedAt  *time.Time  `json:"started_at,omitempty"`
	FinishedAt *time.Time  `json:"finished_at,omitempty"`
	Notes      *string     `json:"notes,omitempty"`
	Book       BookSummary `json:"book"`
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
}

type EntryInput struct {
	BookID     string
	Status     Status
	Rating     *float64
	StartedAt  *time.Time
	FinishedAt *time.Time
	Notes      *string
}

type ListFilter struct {
	Status Status
	BookID string
	Limit  int
}

type Cursor struct {
	ID        string
	CreatedAt time.Time
}
