package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	authmiddleware "github.com/scripd-app/scripd/internal/auth/middleware"
	"github.com/scripd-app/scripd/internal/list"
)

type stubService struct {
	lists map[string]list.List
}

func (s *stubService) CreateList(_ context.Context, userID string, input list.CreateListInput) (list.List, error) {
	if input.Title == "" {
		return list.List{}, list.ErrInvalidInput
	}
	l := list.List{
		ID:        "11111111-1111-1111-1111-111111111111",
		UserID:    userID,
		Title:     input.Title,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	s.lists[l.ID] = l
	return l, nil
}

func (s *stubService) GetListByID(_ context.Context, listID, _ string) (list.List, error) {
	l, ok := s.lists[listID]
	if !ok {
		return list.List{}, list.ErrNotFound
	}
	return l, nil
}

func (s *stubService) GetUserLists(_ context.Context, _, _ string) ([]list.List, error) {
	var res []list.List
	for _, l := range s.lists {
		res = append(res, l)
	}
	return res, nil
}

func (s *stubService) GetMyLists(_ context.Context, userID string) ([]list.List, error) {
	var res []list.List
	for _, l := range s.lists {
		if l.UserID == userID {
			res = append(res, l)
		}
	}
	return res, nil
}

func (s *stubService) UpdateList(_ context.Context, listID, userID string, input list.UpdateListInput) (list.List, error) {
	l, ok := s.lists[listID]
	if !ok {
		return list.List{}, list.ErrNotFound
	}
	if l.UserID != userID {
		return list.List{}, list.ErrForbidden
	}
	if input.Title != nil {
		l.Title = *input.Title
	}
	s.lists[listID] = l
	return l, nil
}

func (s *stubService) DeleteList(_ context.Context, listID, userID string) error {
	l, ok := s.lists[listID]
	if !ok {
		return list.ErrNotFound
	}
	if l.UserID != userID {
		return list.ErrForbidden
	}
	delete(s.lists, listID)
	return nil
}

func (s *stubService) AddBookToList(_ context.Context, listID, userID string, input list.AddBookInput) (list.Item, error) {
	l, ok := s.lists[listID]
	if !ok {
		return list.Item{}, list.ErrNotFound
	}
	if l.UserID != userID {
		return list.Item{}, list.ErrForbidden
	}
	return list.Item{
		ListID:    listID,
		BookID:    input.BookID,
		CreatedAt: time.Now(),
	}, nil
}

func (s *stubService) RemoveBookFromList(_ context.Context, listID, userID, _ string) error {
	l, ok := s.lists[listID]
	if !ok {
		return list.ErrNotFound
	}
	if l.UserID != userID {
		return list.ErrForbidden
	}
	return nil
}

func (s *stubService) UpdateListItem(_ context.Context, listID, userID, _ string, _ list.UpdateItemInput) error {
	l, ok := s.lists[listID]
	if !ok {
		return list.ErrNotFound
	}
	if l.UserID != userID {
		return list.ErrForbidden
	}
	return nil
}

func (s *stubService) GetBookListsForUser(_ context.Context, _, _ string) ([]string, error) {
	return []string{"11111111-1111-1111-1111-111111111111"}, nil
}

func dummyRequireUser(userID string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := authmiddleware.WithUserID(r.Context(), userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func TestListHandler(t *testing.T) {
	testUserID := "22222222-2222-2222-2222-222222222222"
	svc := &stubService{lists: make(map[string]list.List)}
	h := New(svc, dummyRequireUser(testUserID), dummyRequireUser(testUserID), zerolog.Nop())

	router := chi.NewRouter()
	h.RegisterRoutes(router)

	// 1. Create list
	body := `{"title":"Must Read Sci-Fi","description":"Top picks","is_private":false}`
	req := httptest.NewRequest(http.MethodPost, "/lists", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", res.Code, res.Body.String())
	}

	// 2. Get list by ID
	req = httptest.NewRequest(http.MethodGet, "/lists/11111111-1111-1111-1111-111111111111", nil)
	res = httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", res.Code, res.Body.String())
	}

	// 3. Add book to list
	addBookBody := `{"book_id":"33333333-3333-3333-3333-333333333333","notes":"Classic"}`
	req = httptest.NewRequest(http.MethodPost, "/lists/11111111-1111-1111-1111-111111111111/books", strings.NewReader(addBookBody))
	req.Header.Set("Content-Type", "application/json")
	res = httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", res.Code, res.Body.String())
	}

	// 4. Get lists for book
	req = httptest.NewRequest(http.MethodGet, "/lists/book/33333333-3333-3333-3333-333333333333", nil)
	res = httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", res.Code, res.Body.String())
	}

	// 5. Delete list
	req = httptest.NewRequest(http.MethodDelete, "/lists/11111111-1111-1111-1111-111111111111", nil)
	res = httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", res.Code, res.Body.String())
	}
}
