package health

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestLivenessReturnsStandardSuccessEnvelope(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	response := httptest.NewRecorder()
	Handler{}.Liveness(response, request)

	require.Equal(t, http.StatusOK, response.Code)
	require.Equal(t, "application/json; charset=utf-8", response.Header().Get("Content-Type"))
	var body struct {
		Data struct {
			Status string `json:"status"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
	require.Equal(t, "ok", body.Data.Status)
}

func TestReadinessReturnsReadyWhenDependenciesRespond(t *testing.T) {
	handler := NewHandler(func(context.Context) error { return nil }, time.Second)
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	response := httptest.NewRecorder()
	handler.Readiness(response, request)

	require.Equal(t, http.StatusOK, response.Code)
}

func TestReadinessReturnsUnavailableWhenDependencyFails(t *testing.T) {
	handler := NewHandler(func(context.Context) error { return errors.New("database offline") }, time.Second)
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	response := httptest.NewRecorder()
	handler.Readiness(response, request)

	require.Equal(t, http.StatusServiceUnavailable, response.Code)
	require.NotContains(t, response.Body.String(), "database offline")
}
