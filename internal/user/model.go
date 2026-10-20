package user

import (
	"errors"
	"time"
)

var (
	ErrNotFound     = errors.New("user not found")
	ErrInvalidInput = errors.New("invalid user input")
)

type PublicProfile struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	Bio         string    `json:"bio"`
	AvatarURL   string    `json:"avatar_url"`
	CreatedAt   time.Time `json:"created_at"`
}

type ProfileStats struct {
	BooksRead        int `json:"books_read"`
	CurrentlyReading int `json:"currently_reading"`
	WantToRead       int `json:"want_to_read"`
	ReviewsCount     int `json:"reviews_count"`
}

type UpdateProfileInput struct {
	DisplayName *string `json:"display_name"`
	Bio         *string `json:"bio"`
	AvatarURL   *string `json:"avatar_url"`
}
