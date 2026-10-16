package service

import (
	"context"
	"math"
	"strings"
	"testing"
	"time"

	"github.com/scripd-app/scripd/internal/read"
	"github.com/stretchr/testify/require"
)

const testUserID = "0c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d"
const testBookID = "1c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d"
const testEntryID = "2c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d"

func TestCreateNormalizesWishListNotesAndReadingDates(t *testing.T) {
	now := time.Date(2026, time.March, 2, 12, 30, 0, 0, time.UTC)
	store := &stubStore{}
	service := New(store)
	service.now = func() time.Time { return now }
	notes := "  A note for later.  "

	_, err := service.Create(context.Background(), testUserID, read.EntryInput{
		BookID: testBookID, Status: read.StatusWantToRead, Notes: &notes,
	})
	require.NoError(t, err)
	require.Nil(t, store.createInput.StartedAt)
	require.Nil(t, store.createInput.FinishedAt)
	require.Equal(t, "A note for later.", *store.createInput.Notes)

	_, err = service.Create(context.Background(), testUserID, read.EntryInput{BookID: testBookID, Status: read.StatusReading})
	require.NoError(t, err)
	require.Equal(t, now, *store.createInput.StartedAt)
	require.Nil(t, store.createInput.FinishedAt)

	_, err = service.Create(context.Background(), testUserID, read.EntryInput{BookID: testBookID, Status: read.StatusRead})
	require.NoError(t, err)
	require.Equal(t, now, *store.createInput.FinishedAt)
}

func TestCreateValidatesRatingStatusAndDateRules(t *testing.T) {
	now := time.Date(2026, time.March, 2, 12, 30, 0, 0, time.UTC)
	store := &stubStore{}
	service := New(store)
	service.now = func() time.Time { return now }
	started := now.Add(-time.Hour)
	finished := now

	tests := []struct {
		name  string
		input read.EntryInput
	}{
		{name: "invalid status", input: read.EntryInput{BookID: testBookID, Status: "completed"}},
		{name: "rating below half star", input: read.EntryInput{BookID: testBookID, Status: read.StatusRead, Rating: floatPointer(0.4)}},
		{name: "rating quarter star", input: read.EntryInput{BookID: testBookID, Status: read.StatusRead, Rating: floatPointer(3.25)}},
		{name: "non-finite rating", input: read.EntryInput{BookID: testBookID, Status: read.StatusRead, Rating: floatPointer(math.NaN())}},
		{name: "rating while reading", input: read.EntryInput{BookID: testBookID, Status: read.StatusReading, Rating: floatPointer(4)}},
		{name: "finish before start", input: read.EntryInput{BookID: testBookID, Status: read.StatusRead, StartedAt: timePointer(now), FinishedAt: timePointer(now.Add(-time.Minute))}},
		{name: "wishlist with dates", input: read.EntryInput{BookID: testBookID, Status: read.StatusWantToRead, StartedAt: timePointer(now)}},
		{name: "future date", input: read.EntryInput{BookID: testBookID, Status: read.StatusReading, StartedAt: timePointer(now.Add(48 * time.Hour))}},
		{name: "notes too long", input: read.EntryInput{BookID: testBookID, Status: read.StatusWantToRead, Notes: stringPointer(stringsOfRunes('x', MaximumNotes+1))}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := service.Create(context.Background(), testUserID, test.input)
			require.ErrorIs(t, err, ErrInvalidInput)
		})
	}

	_, err := service.Create(context.Background(), testUserID, read.EntryInput{
		BookID: testBookID, Status: read.StatusDidNotFinish, StartedAt: &started, FinishedAt: &finished,
		Rating: floatPointer(3.5),
	})
	require.NoError(t, err)
	require.Equal(t, 3.5, *store.createInput.Rating)
}

func TestListBuildsBoundedCursorPage(t *testing.T) {
	createdAt := time.Date(2026, time.March, 1, 0, 0, 0, 0, time.UTC)
	entries := []read.Entry{
		{ID: testEntryID, CreatedAt: createdAt},
		{ID: "3c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d", CreatedAt: createdAt.Add(-time.Minute)},
		{ID: "4c8c2ac1-e60f-4c79-a9c2-5c23a4407d3d", CreatedAt: createdAt.Add(-2 * time.Minute)},
	}
	store := &stubStore{listEntries: entries}
	service := New(store)
	token, err := encodeCursor(read.Cursor{ID: testEntryID, CreatedAt: createdAt})
	require.NoError(t, err)

	page, err := service.List(context.Background(), testUserID, read.ListFilter{Limit: 2, Status: read.StatusRead, BookID: testBookID}, token)
	require.NoError(t, err)
	require.Len(t, page.Entries, 2)
	require.True(t, page.HasMore)
	require.NotNil(t, page.NextCursor)
	require.Equal(t, 3, store.listLimit)
	require.Equal(t, read.StatusRead, store.listFilter.Status)
	require.Equal(t, testBookID, store.listFilter.BookID)
	require.Equal(t, &read.Cursor{ID: testEntryID, CreatedAt: createdAt}, store.listCursor)
}

func TestListRejectsMalformedCursorAndOutOfRangePageSize(t *testing.T) {
	store := &stubStore{}
	service := New(store)
	_, err := service.List(context.Background(), testUserID, read.ListFilter{}, "not-a-cursor")
	require.ErrorIs(t, err, ErrInvalidInput)
	_, err = service.List(context.Background(), testUserID, read.ListFilter{Limit: MaximumPageSize + 1}, "")
	require.ErrorIs(t, err, ErrInvalidInput)
	require.Equal(t, 0, store.listCalls)
}

func TestUpdateUsesOptimisticStoreVersion(t *testing.T) {
	updatedAt := time.Date(2026, time.March, 2, 12, 30, 0, 0, time.UTC)
	store := &stubStore{existing: read.Entry{ID: testEntryID, BookID: testBookID, Status: read.StatusReading, UpdatedAt: updatedAt}}
	service := New(store)
	service.now = func() time.Time { return updatedAt.Add(time.Hour) }
	_, err := service.Update(context.Background(), testUserID, testEntryID, read.EntryInput{Status: read.StatusRead})
	require.NoError(t, err)
	require.Equal(t, updatedAt, store.expectedUpdatedAt)
	require.Equal(t, testBookID, store.updateInput.BookID)
	require.Equal(t, read.StatusRead, store.updateInput.Status)
	require.NotNil(t, store.updateInput.FinishedAt)

	store.updateErr = read.ErrUpdateConflict
	_, err = service.Update(context.Background(), testUserID, testEntryID, read.EntryInput{Status: read.StatusRead})
	require.ErrorIs(t, err, read.ErrUpdateConflict)
}

func TestGetAndDeleteKeepEntriesScopedToMember(t *testing.T) {
	store := &stubStore{getErr: read.ErrNotFound, deleteErr: read.ErrNotFound}
	service := New(store)
	_, err := service.GetByID(context.Background(), testUserID, testEntryID)
	require.ErrorIs(t, err, read.ErrNotFound)
	require.ErrorIs(t, service.Delete(context.Background(), testUserID, testEntryID), read.ErrNotFound)
	require.Equal(t, testUserID, store.userID)
}

type stubStore struct {
	createInput       read.EntryInput
	createErr         error
	existing          read.Entry
	getErr            error
	userID            string
	listEntries       []read.Entry
	listFilter        read.ListFilter
	listCursor        *read.Cursor
	listLimit         int
	listCalls         int
	updateInput       read.EntryInput
	expectedUpdatedAt time.Time
	updateErr         error
	deleteErr         error
}

func (s *stubStore) Create(_ context.Context, userID string, input read.EntryInput) (read.Entry, error) {
	s.userID, s.createInput = userID, input
	return read.Entry{ID: testEntryID, BookID: input.BookID, Status: input.Status}, s.createErr
}

func (s *stubStore) GetByID(_ context.Context, userID, _ string) (read.Entry, error) {
	s.userID = userID
	return s.existing, s.getErr
}

func (s *stubStore) List(_ context.Context, userID string, filter read.ListFilter, cursor *read.Cursor, limit int) ([]read.Entry, error) {
	s.userID, s.listFilter, s.listCursor, s.listLimit = userID, filter, cursor, limit
	s.listCalls++
	return s.listEntries, nil
}

func (s *stubStore) Update(_ context.Context, userID, _ string, expected time.Time, input read.EntryInput) (read.Entry, error) {
	s.userID, s.expectedUpdatedAt, s.updateInput = userID, expected, input
	return read.Entry{ID: testEntryID, BookID: input.BookID, Status: input.Status}, s.updateErr
}

func (s *stubStore) Delete(_ context.Context, userID, _ string) error {
	s.userID = userID
	return s.deleteErr
}

func floatPointer(value float64) *float64         { return &value }
func timePointer(value time.Time) *time.Time      { return &value }
func stringPointer(value string) *string          { return &value }
func stringsOfRunes(value rune, count int) string { return strings.Repeat(string(value), count) }
