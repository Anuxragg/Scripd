package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	authhandler "github.com/scripd-app/scripd/internal/auth/handler"
	authmiddleware "github.com/scripd-app/scripd/internal/auth/middleware"
	authrepository "github.com/scripd-app/scripd/internal/auth/repository"
	authservice "github.com/scripd-app/scripd/internal/auth/service"
	bookhandler "github.com/scripd-app/scripd/internal/book/handler"
	bookprovider "github.com/scripd-app/scripd/internal/book/provider"
	bookrepository "github.com/scripd-app/scripd/internal/book/repository"
	bookservice "github.com/scripd-app/scripd/internal/book/service"
	"github.com/scripd-app/scripd/internal/platform/config"
	"github.com/scripd-app/scripd/internal/platform/db"
	"github.com/scripd-app/scripd/internal/platform/email"
	"github.com/scripd-app/scripd/internal/platform/httpserver"
	"github.com/scripd-app/scripd/internal/platform/logger"
	readhandler "github.com/scripd-app/scripd/internal/read/handler"
	readrepository "github.com/scripd-app/scripd/internal/read/repository"
	readservice "github.com/scripd-app/scripd/internal/read/service"
	reviewhandler "github.com/scripd-app/scripd/internal/review/handler"
	reviewrepository "github.com/scripd-app/scripd/internal/review/repository"
	reviewservice "github.com/scripd-app/scripd/internal/review/service"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(runHealthcheck())
	}
	if err := run(); err != nil {
		log := logger.New(os.Getenv("APP_ENV"))
		log.Error().Err(err).Msg("API process failed")
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load configuration: %w", err)
	}
	log := logger.New(cfg.Environment)

	startupCtx, startupCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer startupCancel()
	pool, err := db.Connect(startupCtx, cfg)
	if err != nil {
		return err
	}
	defer pool.Close()
	authRepo := authrepository.NewPostgres(pool)
	verificationMailer := email.NewSMTP(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUsername, cfg.SMTPPassword, cfg.SMTPFrom, cfg.SMTPRequireTLS)
	authSvc := authservice.New(authRepo, cfg.JWTAccessSecret,
		authservice.WithEmailVerification(verificationMailer, cfg.WebBaseURL),
	)
	authHTTP := authhandler.New(authSvc, cfg.Environment == "production", cfg.CORSAllowedOrigins, log)
	sessionMiddleware := authmiddleware.New(authSvc, cfg.CORSAllowedOrigins, log)
	bookRepo := bookrepository.NewPostgres(pool)
	bookCatalog := bookprovider.NewOpenLibrary(nil, "")
	bookSvc := bookservice.New(bookCatalog, bookRepo)
	bookHTTP := bookhandler.New(bookSvc, log)
	readRepo := readrepository.NewPostgres(pool)
	readSvc := readservice.New(readRepo)
	readHTTP := readhandler.New(readSvc, sessionMiddleware.RequireUser, log)
	reviewRepo := reviewrepository.NewPostgres(pool)
	reviewSvc := reviewservice.New(reviewRepo, readRepo)
	reviewHTTP := reviewhandler.New(reviewSvc, sessionMiddleware.RequireUser, sessionMiddleware.RequireVerifiedUser, log)
	registerRoutes := func(router chi.Router) {
		authHTTP.RegisterRoutes(router)
		bookHTTP.RegisterRoutes(router)
		readHTTP.RegisterRoutes(router)
		reviewHTTP.RegisterRoutes(router)
	}
	server := &http.Server{
		Addr:              cfg.HTTPAddress,
		Handler:           httpserver.NewRouter(cfg, log, pool, registerRoutes),
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	serverErrors := make(chan error, 1)
	go func() {
		log.Info().Str("address", cfg.HTTPAddress).Msg("HTTP server starting")
		if serveErr := server.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			serverErrors <- serveErr
		}
	}()

	shutdownCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	select {
	case <-shutdownCtx.Done():
	case serveErr := <-serverErrors:
		return fmt.Errorf("HTTP server: %w", serveErr)
	}

	ctx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		_ = server.Close()
		return fmt.Errorf("graceful HTTP shutdown: %w", err)
	}
	log.Info().Msg("HTTP server stopped")
	return nil
}

func runHealthcheck() int {
	client := http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://127.0.0.1:8080/healthz")
	if err != nil {
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}
