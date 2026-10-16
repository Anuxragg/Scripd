package provider

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSearchRequestsBoundedFieldsAndNormalizesWorks(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "the hobbit", r.URL.Query().Get("q"))
		require.Equal(t, "2", r.URL.Query().Get("page"))
		require.Equal(t, "12", r.URL.Query().Get("limit"))
		require.Equal(t, "key,title,subtitle,author_name,first_publish_year,cover_i,isbn", r.URL.Query().Get("fields"))
		require.Equal(t, openLibraryUserAgent, r.Header.Get("User-Agent"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"numFound": 25,
			"docs": [
				{"key":"/works/OL123W","title":"  The   Hobbit ","subtitle":"  An   unexpected journey ","author_name":[" J. R. R. Tolkien ","J. R. R. Tolkien"],"first_publish_year":1937,"cover_i":42,"isbn":["978-0-385-47257-9"]},
				{"key":"OL124W","title":"Other work","author_name":[]},
				{"key":"/books/OL123M","title":"Invalid edition key"},
				{"key":"OL125W","title":"   "}
			]
		}`))
	}))
	defer server.Close()

	client := NewOpenLibrary(server.Client(), server.URL)
	result, err := client.Search(context.Background(), "the hobbit", 2, 12)
	require.NoError(t, err)
	require.Equal(t, 25, result.Total)
	require.Len(t, result.Books, 2)
	require.Equal(t, "OL123W", result.Books[0].OpenLibraryKey)
	require.Equal(t, "The Hobbit", result.Books[0].Title)
	require.Equal(t, "An unexpected journey", *result.Books[0].Subtitle)
	require.Equal(t, []string{"J. R. R. Tolkien"}, result.Books[0].Authors)
	require.Equal(t, "9780385472579", *result.Books[0].ISBN13)
	require.Equal(t, 1937, *result.Books[0].PublishedYear)
	require.Equal(t, "https://covers.openlibrary.org/b/id/42-M.jpg?default=false", *result.Books[0].CoverURL)
	require.Contains(t, string(result.Books[0].RawMetadata), `"key":"/works/OL123W"`)
	require.Equal(t, "OL124W", result.Books[1].OpenLibraryKey)
}

func TestSearchSupportsLegacyResultCount(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"num_found":3,"docs":[]}`))
	}))
	defer server.Close()

	result, err := NewOpenLibrary(server.Client(), server.URL).Search(context.Background(), "title", 1, 12)
	require.NoError(t, err)
	require.Equal(t, 3, result.Total)
}

func TestSearchRejectsUpstreamFailuresAndOversizedBodies(t *testing.T) {
	tests := []struct {
		name    string
		handler http.HandlerFunc
	}{
		{
			name: "upstream status",
			handler: func(w http.ResponseWriter, _ *http.Request) {
				http.Error(w, "unavailable", http.StatusServiceUnavailable)
			},
		},
		{
			name: "oversized body",
			handler: func(w http.ResponseWriter, _ *http.Request) {
				_, _ = fmt.Fprint(w, `{"docs":[]}`+strings.Repeat(" ", maximumResponseBytes))
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(test.handler)
			defer server.Close()
			_, err := NewOpenLibrary(server.Client(), server.URL).Search(context.Background(), "title", 1, 12)
			require.Error(t, err)
		})
	}
}

func TestNormalizeISBN13ValidatesCheckDigit(t *testing.T) {
	require.Equal(t, "9780385472579", normalizeISBN13("978-0-385-47257-9"))
	require.Empty(t, normalizeISBN13("9780385472570"))
	require.Empty(t, normalizeISBN13("978-0-385-47257-X"))
}

func TestEscapeSolrQueryPreventsUserOperatorsFromBecomingQuerySyntax(t *testing.T) {
	require.Equal(t, `C\+\+ \(film\)`, escapeSolrQuery("C++ (film)"))
}
