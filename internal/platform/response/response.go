package response

import (
	"encoding/json"
	"net/http"

	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

type envelope struct {
	Data any `json:"data"`
	Meta any `json:"meta"`
}

type errorEnvelope struct {
	Error apiError `json:"error"`
}

type apiError struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id,omitempty"`
}

func WriteJSON(w http.ResponseWriter, status int, data any) {
	WriteJSONWithMeta(w, status, data, map[string]any{})
}

func WriteJSONWithMeta(w http.ResponseWriter, status int, data, meta any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{Data: data, Meta: meta})
}

func WriteError(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(errorEnvelope{Error: apiError{
		Code: code, Message: message, RequestID: chimiddleware.GetReqID(r.Context()),
	}})
}
