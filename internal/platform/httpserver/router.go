package httpserver

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/scripd-app/scripd/internal/platform/config"
	"github.com/scripd-app/scripd/internal/platform/health"
	"github.com/scripd-app/scripd/internal/platform/middleware"
	"github.com/scripd-app/scripd/internal/platform/response"
)

func NewRouter(cfg config.Config, log zerolog.Logger, pool *pgxpool.Pool, registerRoutes func(chi.Router)) http.Handler {
	router := chi.NewRouter()
	router.Use(chimiddleware.RequestID)
	router.Use(middleware.RequestIDHeader)
	router.Use(middleware.Logging(log))
	router.Use(middleware.Recover(log))
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSAllowedOrigins,
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID"},
		ExposedHeaders:   []string{"X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	router.Use(middleware.RateLimit(cfg.RateLimitRequests, cfg.RateLimitWindow))

	healthHandler := health.NewHandler(pool.Ping, cfg.ReadinessTimeout)
	router.NotFound(func(w http.ResponseWriter, r *http.Request) {
		response.WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
	})
	router.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		response.WriteError(w, r, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
	})
	router.Get("/healthz", healthHandler.Liveness)
	router.Get("/readyz", healthHandler.Readiness)
	router.Route("/api/v1", func(api chi.Router) {
		if registerRoutes != nil {
			registerRoutes(api)
		}
	})
	return router
}
