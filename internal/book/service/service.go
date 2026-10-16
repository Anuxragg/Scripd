package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/scripd-app/scripd/internal/book"
)

var (
	ErrInvalidInput       = errors.New("invalid book search input")
	ErrCatalogUnavailable = errors.New("book catalog is unavailable")
	ErrNotFound           = book.ErrNotFound
	bookIDPattern         = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
)

const (
	DefaultLimit = 12
	MaximumLimit = 20
	MaximumPage  = 1000
)

type provider interface {
	Search(context.Context, string, int, int) (book.ProviderSearch, error)
}

type repository interface {
	Upsert(context.Context, book.ImportedBook) (book.Book, error)
	SearchLocal(context.Context, string, int, int) ([]book.Book, int, error)
	GetByID(context.Context, string) (book.Book, error)
}

type Service struct {
	provider   provider
	repository repository
}

type SearchPage struct {
	Books   []book.Book
	Page    int
	Limit   int
	Total   int
	HasMore bool
	Source  string
}

func New(provider provider, repository repository) *Service {
	return &Service{provider: provider, repository: repository}
}

func (s *Service) Search(ctx context.Context, query string, page, limit int) (SearchPage, error) {
	query = strings.Join(strings.Fields(query), " ")
	if utf8.RuneCountInString(query) < 2 || utf8.RuneCountInString(query) > 120 || page < 1 || page > MaximumPage || limit < 1 || limit > MaximumLimit {
		return SearchPage{}, ErrInvalidInput
	}

	providerResult, providerErr := s.provider.Search(ctx, query, page, limit)
	if providerErr != nil {
		localBooks, localTotal, localErr := s.repository.SearchLocal(ctx, query, page, limit)
		if localErr != nil {
			return SearchPage{}, fmt.Errorf("search local catalog after provider failure: %w", localErr)
		}
		if localTotal == 0 {
			return SearchPage{}, ErrCatalogUnavailable
		}
		return SearchPage{
			Books: localBooks, Page: page, Limit: limit, Total: localTotal,
			HasMore: page*limit < localTotal, Source: "local_catalog",
		}, nil
	}

	books := make([]book.Book, 0, len(providerResult.Books))
	seen := make(map[string]struct{}, len(providerResult.Books))
	for _, imported := range providerResult.Books {
		if _, exists := seen[imported.OpenLibraryKey]; exists {
			continue
		}
		seen[imported.OpenLibraryKey] = struct{}{}
		persisted, err := s.repository.Upsert(ctx, imported)
		if err != nil {
			return SearchPage{}, fmt.Errorf("persist Open Library book: %w", err)
		}
		books = append(books, persisted)
	}
	total := providerResult.Total
	if total < 0 {
		total = 0
	}
	return SearchPage{
		Books: books, Page: page, Limit: limit, Total: total,
		HasMore: page*limit < total, Source: "open_library",
	}, nil
}

func (s *Service) GetByID(ctx context.Context, id string) (book.Book, error) {
	if !bookIDPattern.MatchString(id) {
		return book.Book{}, ErrNotFound
	}
	result, err := s.repository.GetByID(ctx, id)
	if errors.Is(err, ErrNotFound) {
		return book.Book{}, ErrNotFound
	}
	if err != nil {
		return book.Book{}, fmt.Errorf("get book from catalog: %w", err)
	}
	return result, nil
}
