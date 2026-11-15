package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/scripd-app/scripd/internal/list"
)

var uuidPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func isValidUUID(id string) bool {
	return uuidPattern.MatchString(strings.TrimSpace(id))
}

type repository interface {
	GetUserIDByUsername(ctx context.Context, username string) (string, error)
	CreateList(ctx context.Context, userID string, input list.CreateListInput) (list.List, error)
	GetListByID(ctx context.Context, listID string, viewerID string) (list.List, error)
	ListUserLists(ctx context.Context, targetUserID string, viewerID string) ([]list.List, error)
	UpdateList(ctx context.Context, listID string, userID string, input list.UpdateListInput) (list.List, error)
	DeleteList(ctx context.Context, listID string, userID string) error
	AddBookToList(ctx context.Context, listID string, userID string, input list.AddBookInput) (list.Item, error)
	RemoveBookFromList(ctx context.Context, listID string, userID string, bookID string) error
	UpdateListItem(ctx context.Context, listID string, userID string, bookID string, input list.UpdateItemInput) error
	GetBookListsForUser(ctx context.Context, userID string, bookID string) ([]string, error)
}

type Service struct {
	repo repository
}

func New(repo repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateList(ctx context.Context, userID string, input list.CreateListInput) (list.List, error) {
	if !isValidUUID(userID) {
		return list.List{}, list.ErrInvalidInput
	}
	title := strings.TrimSpace(input.Title)
	if title == "" || utf8.RuneCountInString(title) > 100 {
		return list.List{}, fmt.Errorf("%w: title must be between 1 and 100 characters", list.ErrInvalidInput)
	}
	input.Title = title

	if input.Description != nil {
		desc := strings.TrimSpace(*input.Description)
		if utf8.RuneCountInString(desc) > 1000 {
			return list.List{}, fmt.Errorf("%w: description must not exceed 1000 characters", list.ErrInvalidInput)
		}
		if desc == "" {
			input.Description = nil
		} else {
			input.Description = &desc
		}
	}

	return s.repo.CreateList(ctx, userID, input)
}

func (s *Service) GetListByID(ctx context.Context, listID, viewerID string) (list.List, error) {
	if !isValidUUID(listID) {
		return list.List{}, list.ErrNotFound
	}
	return s.repo.GetListByID(ctx, listID, viewerID)
}

func (s *Service) GetUserLists(ctx context.Context, username, viewerID string) ([]list.List, error) {
	targetUserID, err := s.repo.GetUserIDByUsername(ctx, username)
	if err != nil {
		return nil, err
	}
	return s.repo.ListUserLists(ctx, targetUserID, viewerID)
}

func (s *Service) GetMyLists(ctx context.Context, userID string) ([]list.List, error) {
	if !isValidUUID(userID) {
		return nil, list.ErrInvalidInput
	}
	return s.repo.ListUserLists(ctx, userID, userID)
}

func (s *Service) UpdateList(ctx context.Context, listID, userID string, input list.UpdateListInput) (list.List, error) {
	if !isValidUUID(listID) || !isValidUUID(userID) {
		return list.List{}, list.ErrInvalidInput
	}

	if input.Title != nil {
		title := strings.TrimSpace(*input.Title)
		if title == "" || utf8.RuneCountInString(title) > 100 {
			return list.List{}, fmt.Errorf("%w: title must be between 1 and 100 characters", list.ErrInvalidInput)
		}
		input.Title = &title
	}

	if input.Description != nil {
		desc := strings.TrimSpace(*input.Description)
		if utf8.RuneCountInString(desc) > 1000 {
			return list.List{}, fmt.Errorf("%w: description must not exceed 1000 characters", list.ErrInvalidInput)
		}
		if desc == "" {
			input.Description = nil
		} else {
			input.Description = &desc
		}
	}

	return s.repo.UpdateList(ctx, listID, userID, input)
}

func (s *Service) DeleteList(ctx context.Context, listID, userID string) error {
	if !isValidUUID(listID) || !isValidUUID(userID) {
		return list.ErrNotFound
	}
	return s.repo.DeleteList(ctx, listID, userID)
}

func (s *Service) AddBookToList(ctx context.Context, listID, userID string, input list.AddBookInput) (list.Item, error) {
	if !isValidUUID(listID) || !isValidUUID(userID) || strings.TrimSpace(input.BookID) == "" {
		return list.Item{}, list.ErrInvalidInput
	}

	if input.Notes != nil {
		notes := strings.TrimSpace(*input.Notes)
		if utf8.RuneCountInString(notes) > 1000 {
			return list.Item{}, fmt.Errorf("%w: notes must not exceed 1000 characters", list.ErrInvalidInput)
		}
		if notes == "" {
			input.Notes = nil
		} else {
			input.Notes = &notes
		}
	}

	return s.repo.AddBookToList(ctx, listID, userID, input)
}

func (s *Service) RemoveBookFromList(ctx context.Context, listID, userID, bookID string) error {
	if !isValidUUID(listID) || !isValidUUID(userID) || strings.TrimSpace(bookID) == "" {
		return list.ErrNotFound
	}
	return s.repo.RemoveBookFromList(ctx, listID, userID, strings.TrimSpace(bookID))
}

func (s *Service) UpdateListItem(ctx context.Context, listID, userID, bookID string, input list.UpdateItemInput) error {
	if !isValidUUID(listID) || !isValidUUID(userID) || strings.TrimSpace(bookID) == "" {
		return list.ErrInvalidInput
	}

	if input.Notes != nil {
		notes := strings.TrimSpace(*input.Notes)
		if utf8.RuneCountInString(notes) > 1000 {
			return fmt.Errorf("%w: notes must not exceed 1000 characters", list.ErrInvalidInput)
		}
		if notes == "" {
			input.Notes = nil
		} else {
			input.Notes = &notes
		}
	}

	return s.repo.UpdateListItem(ctx, listID, userID, strings.TrimSpace(bookID), input)
}

func (s *Service) GetBookListsForUser(ctx context.Context, userID, bookID string) ([]string, error) {
	if !isValidUUID(userID) || strings.TrimSpace(bookID) == "" {
		return []string{}, nil
	}
	return s.repo.GetBookListsForUser(ctx, userID, strings.TrimSpace(bookID))
}
