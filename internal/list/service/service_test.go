package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/scripd-app/scripd/internal/list"
)

type mockRepo struct {
	lists       map[string]list.List
	items       map[string][]list.Item
	users       map[string]string // username -> userID
	failWithErr error
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		lists: make(map[string]list.List),
		items: make(map[string][]list.Item),
		users: make(map[string]string),
	}
}

func (m *mockRepo) GetUserIDByUsername(_ context.Context, username string) (string, error) {
	if m.failWithErr != nil {
		return "", m.failWithErr
	}
	id, ok := m.users[strings.ToLower(username)]
	if !ok {
		return "", list.ErrNotFound
	}
	return id, nil
}

func (m *mockRepo) CreateList(_ context.Context, userID string, input list.CreateListInput) (list.List, error) {
	if m.failWithErr != nil {
		return list.List{}, m.failWithErr
	}
	id := "00000000-0000-0000-0000-000000000001"
	l := list.List{
		ID:           id,
		UserID:       userID,
		Title:        input.Title,
		Description:  input.Description,
		IsPrivate:    input.IsPrivate,
		ItemCount:    0,
		SampleCovers: []string{},
		Items:        []list.Item{},
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	m.lists[id] = l
	return l, nil
}

func (m *mockRepo) GetListByID(_ context.Context, listID string, viewerID string) (list.List, error) {
	if m.failWithErr != nil {
		return list.List{}, m.failWithErr
	}
	l, ok := m.lists[listID]
	if !ok {
		return list.List{}, list.ErrNotFound
	}
	if l.IsPrivate && l.UserID != viewerID {
		return list.List{}, list.ErrNotFound
	}
	l.Items = m.items[listID]
	l.ItemCount = len(l.Items)
	return l, nil
}

func (m *mockRepo) ListUserLists(_ context.Context, targetUserID string, viewerID string) ([]list.List, error) {
	if m.failWithErr != nil {
		return nil, m.failWithErr
	}
	var res []list.List
	for _, l := range m.lists {
		if l.UserID == targetUserID {
			if l.IsPrivate && viewerID != targetUserID {
				continue
			}
			res = append(res, l)
		}
	}
	return res, nil
}

func (m *mockRepo) UpdateList(_ context.Context, listID string, userID string, input list.UpdateListInput) (list.List, error) {
	if m.failWithErr != nil {
		return list.List{}, m.failWithErr
	}
	l, ok := m.lists[listID]
	if !ok {
		return list.List{}, list.ErrNotFound
	}
	if l.UserID != userID {
		return list.List{}, list.ErrForbidden
	}
	if input.Title != nil {
		l.Title = *input.Title
	}
	if input.Description != nil {
		l.Description = input.Description
	}
	if input.IsPrivate != nil {
		l.IsPrivate = *input.IsPrivate
	}
	m.lists[listID] = l
	return l, nil
}

func (m *mockRepo) DeleteList(_ context.Context, listID string, userID string) error {
	if m.failWithErr != nil {
		return m.failWithErr
	}
	l, ok := m.lists[listID]
	if !ok {
		return list.ErrNotFound
	}
	if l.UserID != userID {
		return list.ErrForbidden
	}
	delete(m.lists, listID)
	delete(m.items, listID)
	return nil
}

func (m *mockRepo) AddBookToList(_ context.Context, listID string, userID string, input list.AddBookInput) (list.Item, error) {
	if m.failWithErr != nil {
		return list.Item{}, m.failWithErr
	}
	l, ok := m.lists[listID]
	if !ok {
		return list.Item{}, list.ErrNotFound
	}
	if l.UserID != userID {
		return list.Item{}, list.ErrForbidden
	}
	for _, it := range m.items[listID] {
		if it.BookID == input.BookID {
			return list.Item{}, list.ErrConflict
		}
	}
	item := list.Item{
		ListID:    listID,
		BookID:    input.BookID,
		Notes:     input.Notes,
		Position:  len(m.items[listID]),
		CreatedAt: time.Now(),
	}
	m.items[listID] = append(m.items[listID], item)
	return item, nil
}

func (m *mockRepo) RemoveBookFromList(_ context.Context, listID string, userID string, bookID string) error {
	if m.failWithErr != nil {
		return m.failWithErr
	}
	l, ok := m.lists[listID]
	if !ok {
		return list.ErrNotFound
	}
	if l.UserID != userID {
		return list.ErrForbidden
	}
	items := m.items[listID]
	found := false
	var updated []list.Item
	for _, it := range items {
		if it.BookID == bookID {
			found = true
		} else {
			updated = append(updated, it)
		}
	}
	if !found {
		return list.ErrNotFound
	}
	m.items[listID] = updated
	return nil
}

func (m *mockRepo) UpdateListItem(_ context.Context, listID string, userID string, bookID string, input list.UpdateItemInput) error {
	if m.failWithErr != nil {
		return m.failWithErr
	}
	l, ok := m.lists[listID]
	if !ok {
		return list.ErrNotFound
	}
	if l.UserID != userID {
		return list.ErrForbidden
	}
	for i, it := range m.items[listID] {
		if it.BookID == bookID {
			if input.Notes != nil {
				m.items[listID][i].Notes = input.Notes
			}
			return nil
		}
	}
	return list.ErrNotFound
}

func (m *mockRepo) GetBookListsForUser(_ context.Context, userID string, bookID string) ([]string, error) {
	if m.failWithErr != nil {
		return nil, m.failWithErr
	}
	var res []string
	for listID, l := range m.lists {
		if l.UserID == userID {
			for _, it := range m.items[listID] {
				if it.BookID == bookID {
					res = append(res, listID)
					break
				}
			}
		}
	}
	return res, nil
}

func TestListService(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := New(repo)
	userID := "11111111-1111-1111-1111-111111111111"
	otherUserID := "22222222-2222-2222-2222-222222222222"
	bookID := "33333333-3333-3333-3333-333333333333"

	// 1. Validation failure on invalid title
	_, err := svc.CreateList(ctx, userID, list.CreateListInput{Title: ""})
	if !errors.Is(err, list.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for empty title, got: %v", err)
	}

	// 2. Successful creation
	l, err := svc.CreateList(ctx, userID, list.CreateListInput{
		Title:     "Summer 2026 Reads",
		IsPrivate: false,
	})
	if err != nil {
		t.Fatalf("unexpected error creating list: %v", err)
	}
	if l.Title != "Summer 2026 Reads" {
		t.Fatalf("expected title 'Summer 2026 Reads', got %s", l.Title)
	}

	// 3. Add book to list
	item, err := svc.AddBookToList(ctx, l.ID, userID, list.AddBookInput{
		BookID: bookID,
	})
	if err != nil {
		t.Fatalf("unexpected error adding book to list: %v", err)
	}
	if item.BookID != bookID {
		t.Fatalf("expected item book ID %s, got %s", bookID, item.BookID)
	}

	// 4. Duplicate book rejection
	_, err = svc.AddBookToList(ctx, l.ID, userID, list.AddBookInput{
		BookID: bookID,
	})
	if !errors.Is(err, list.ErrConflict) {
		t.Fatalf("expected ErrConflict for duplicate book, got: %v", err)
	}

	// 5. Check book presence
	presentLists, err := svc.GetBookListsForUser(ctx, userID, bookID)
	if err != nil {
		t.Fatalf("unexpected error getting book lists: %v", err)
	}
	if len(presentLists) != 1 || presentLists[0] != l.ID {
		t.Fatalf("expected list ID in present lists, got: %v", presentLists)
	}

	// 6. Unauthorized book addition from another user
	_, err = svc.AddBookToList(ctx, l.ID, otherUserID, list.AddBookInput{
		BookID: "44444444-4444-4444-4444-444444444444",
	})
	if !errors.Is(err, list.ErrForbidden) {
		t.Fatalf("expected ErrForbidden when non-owner adds book, got: %v", err)
	}

	// 7. Remove book
	err = svc.RemoveBookFromList(ctx, l.ID, userID, bookID)
	if err != nil {
		t.Fatalf("unexpected error removing book: %v", err)
	}

	// 8. Delete list
	err = svc.DeleteList(ctx, l.ID, userID)
	if err != nil {
		t.Fatalf("unexpected error deleting list: %v", err)
	}

	// 9. Get deleted list
	_, err = svc.GetListByID(ctx, l.ID, userID)
	if !errors.Is(err, list.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for deleted list, got: %v", err)
	}
}
