// Package provider provides external book catalog integration adapters.
package provider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/scripd-app/scripd/internal/book"
)

const (
	defaultOpenLibraryURL = "https://openlibrary.org/search.json"
	openLibraryUserAgent  = "Scripd/0.1 (https://github.com/scripd-app/scripd)"
	maximumResponseBytes  = 2 << 20
	maximumConcurrent     = 8
)

var workKeyPattern = regexp.MustCompile(`^(?:/works/)?(OL[0-9]+W)$`)

// OpenLibrary searches the public Open Library work catalog.
type OpenLibrary struct {
	client   *http.Client
	endpoint string
	requests chan struct{}
}

// NewOpenLibrary creates an OpenLibrary provider instance.
func NewOpenLibrary(client *http.Client, endpoint string) *OpenLibrary {
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	} else {
		clientCopy := *client
		client = &clientCopy
	}
	client.CheckRedirect = func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }
	if endpoint == "" {
		endpoint = defaultOpenLibraryURL
	}
	return &OpenLibrary{client: client, endpoint: endpoint, requests: make(chan struct{}, maximumConcurrent)}
}

// Search queries Open Library for works matching query.
func (p *OpenLibrary) Search(ctx context.Context, query string, page, limit int) (book.ProviderSearch, error) {
	select {
	case p.requests <- struct{}{}:
		defer func() { <-p.requests }()
	case <-ctx.Done():
		return book.ProviderSearch{}, ctx.Err()
	}

	requestContext, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	parsedURL, err := url.Parse(p.endpoint)
	if err != nil {
		return book.ProviderSearch{}, fmt.Errorf("parse Open Library endpoint: %w", err)
	}
	parameters := parsedURL.Query()
	parameters.Set("q", escapeSolrQuery(query))
	parameters.Set("page", strconv.Itoa(page))
	parameters.Set("limit", strconv.Itoa(limit))
	parameters.Set("fields", "key,title,subtitle,author_name,first_publish_year,cover_i,isbn")
	parsedURL.RawQuery = parameters.Encode()

	request, err := http.NewRequestWithContext(requestContext, http.MethodGet, parsedURL.String(), nil)
	if err != nil {
		return book.ProviderSearch{}, fmt.Errorf("create Open Library request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", openLibraryUserAgent)

	response, err := p.client.Do(request)
	if err != nil {
		return book.ProviderSearch{}, fmt.Errorf("request Open Library search: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return book.ProviderSearch{}, fmt.Errorf("open library search returned status %d", response.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(response.Body, maximumResponseBytes+1))
	if err != nil {
		return book.ProviderSearch{}, fmt.Errorf("read Open Library response: %w", err)
	}
	if len(body) > maximumResponseBytes {
		return book.ProviderSearch{}, errors.New("open library response exceeded the size limit")
	}

	var payload searchResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return book.ProviderSearch{}, fmt.Errorf("decode Open Library response: %w", err)
	}
	total := payload.NumFoundCamel
	if total == 0 {
		total = payload.NumFound
	}
	result := book.ProviderSearch{Books: make([]book.ImportedBook, 0, len(payload.Docs)), Total: total}
	for _, rawDocument := range payload.Docs {
		var document searchDocument
		if err := json.Unmarshal(rawDocument, &document); err != nil {
			continue
		}
		if normalized, ok := normalizeDocument(document, rawDocument); ok {
			result.Books = append(result.Books, normalized)
		}
	}
	return result, nil
}

type searchResponse struct {
	NumFound      int               `json:"num_found"`
	NumFoundCamel int               `json:"numFound"`
	Docs          []json.RawMessage `json:"docs"`
}

type searchDocument struct {
	Key              string   `json:"key"`
	Title            string   `json:"title"`
	Subtitle         string   `json:"subtitle"`
	AuthorNames      []string `json:"author_name"`
	FirstPublishYear *int     `json:"first_publish_year"`
	CoverID          *int     `json:"cover_i"`
	ISBNs            []string `json:"isbn"`
}

func normalizeDocument(document searchDocument, raw json.RawMessage) (book.ImportedBook, bool) {
	keyMatches := workKeyPattern.FindStringSubmatch(strings.TrimSpace(document.Key))
	title := cleanText(document.Title)
	if len(keyMatches) != 2 || title == "" {
		return book.ImportedBook{}, false
	}

	authors := make([]string, 0, len(document.AuthorNames))
	seenAuthors := make(map[string]struct{}, len(document.AuthorNames))
	for _, author := range document.AuthorNames {
		cleaned := cleanText(author)
		folded := strings.ToLower(cleaned)
		if cleaned == "" {
			continue
		}
		if _, exists := seenAuthors[folded]; exists {
			continue
		}
		seenAuthors[folded] = struct{}{}
		authors = append(authors, cleaned)
	}

	var subtitle *string
	if value := cleanText(document.Subtitle); value != "" {
		subtitle = &value
	}
	var publishedYear *int
	if document.FirstPublishYear != nil && *document.FirstPublishYear >= 0 && *document.FirstPublishYear <= 9999 {
		value := *document.FirstPublishYear
		publishedYear = &value
	}
	var isbn13 *string
	for _, isbn := range document.ISBNs {
		if normalized := normalizeISBN13(isbn); normalized != "" {
			isbn13 = &normalized
			break
		}
	}

	var coverURL *string
	if document.CoverID != nil && *document.CoverID > 0 {
		value := fmt.Sprintf("https://covers.openlibrary.org/b/id/%d-M.jpg?default=false", *document.CoverID)
		coverURL = &value
	} else if isbn13 != nil && *isbn13 != "" {
		value := fmt.Sprintf("https://covers.openlibrary.org/b/isbn/%s-M.jpg?default=false", *isbn13)
		coverURL = &value
	}

	return book.ImportedBook{
		OpenLibraryKey: keyMatches[1],
		ISBN13:         isbn13,
		Title:          title,
		Subtitle:       subtitle,
		Authors:        authors,
		CoverURL:       coverURL,
		PublishedYear:  publishedYear,
		RawMetadata:    append(json.RawMessage(nil), raw...),
	}, true
}

func cleanText(value string) string {
	return strings.Join(strings.FieldsFunc(value, unicode.IsSpace), " ")
}

func escapeSolrQuery(value string) string {
	const reserved = `+-&|!(){}[]^"~*?:\/`
	var escaped strings.Builder
	escaped.Grow(len(value))
	for _, character := range value {
		if strings.ContainsRune(reserved, character) {
			escaped.WriteRune('\\')
		}
		escaped.WriteRune(character)
	}
	return escaped.String()
}

func normalizeISBN13(value string) string {
	var digits strings.Builder
	for _, r := range value {
		if unicode.IsDigit(r) && r <= '9' {
			digits.WriteRune(r)
			continue
		}
		if r != '-' && !unicode.IsSpace(r) {
			return ""
		}
	}
	isbn := digits.String()
	if len(isbn) != 13 {
		return ""
	}
	sum := 0
	for i := 0; i < 12; i++ {
		value := int(isbn[i] - '0')
		if i%2 == 1 {
			value *= 3
		}
		sum += value
	}
	checkDigit := (10 - sum%10) % 10
	if checkDigit != int(isbn[12]-'0') {
		return ""
	}
	return isbn
}
