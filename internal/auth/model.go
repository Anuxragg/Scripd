package auth

import (
	"errors"
	"time"
)

var (
	ErrNotFound      = errors.New("auth record not found")
	ErrEmailInUse    = errors.New("email is already in use")
	ErrUsernameInUse = errors.New("username is already in use")
)

type User struct {
	ID            string
	Username      string
	Email         string
	EmailVerified bool
	DisplayName   string
	PasswordHash  string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}
