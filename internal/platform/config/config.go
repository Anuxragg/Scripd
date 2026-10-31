package config

import (
	"fmt"
	"net/mail"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
)

type Config struct {
	Environment        string
	HTTPAddress        string
	DatabaseURL        string
	DBHost             string
	DBPort             int
	DBName             string
	DBUser             string
	DBPassword         string
	DBSSLMode          string
	JWTAccessSecret    string
	WebBaseURL         string
	SMTPHost           string
	SMTPPort           int
	SMTPUsername       string
	SMTPPassword       string
	SMTPFrom           string
	SMTPRequireTLS     bool
	CORSAllowedOrigins []string
	RateLimitRequests  int
	RateLimitWindow    time.Duration
	ShutdownTimeout    time.Duration
	ReadinessTimeout   time.Duration
}

func Load() (Config, error) {
	loadDotEnv(".env")

	port, err := intFromEnv("DB_PORT", 5432)
	if err != nil {
		return Config{}, err
	}
	smtpPort, err := intFromEnv("SMTP_PORT", 1025)
	if err != nil {
		return Config{}, err
	}
	smtpRequireTLS, err := boolFromEnv("SMTP_REQUIRE_TLS", false)
	if err != nil {
		return Config{}, err
	}
	rateLimitRequests, err := intFromEnv("RATE_LIMIT_REQUESTS", 120)
	if err != nil {
		return Config{}, err
	}
	rateLimitWindow, err := durationFromEnv("RATE_LIMIT_WINDOW", time.Minute)
	if err != nil {
		return Config{}, err
	}
	shutdownTimeout, err := durationFromEnv("SHUTDOWN_TIMEOUT", 10*time.Second)
	if err != nil {
		return Config{}, err
	}
	readinessTimeout, err := durationFromEnv("READINESS_TIMEOUT", 2*time.Second)
	if err != nil {
		return Config{}, err
	}

	databaseURL := env("DATABASE_URL", "")
	dbHost := env("DB_HOST", "localhost")
	dbPort := port
	dbName := env("DB_NAME", "scripd")
	dbUser := env("DB_USER", "scripd")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbSSLMode := env("DB_SSLMODE", "disable")

	if databaseURL != "" {
		if parsed, err := url.Parse(databaseURL); err == nil && parsed.Host != "" {
			dbHost = parsed.Hostname()
			if p := parsed.Port(); p != "" {
				if intPort, err := strconv.Atoi(p); err == nil {
					dbPort = intPort
				}
			}
			if parsed.User != nil {
				dbUser = parsed.User.Username()
				if pass, ok := parsed.User.Password(); ok {
					dbPassword = pass
				}
			}
			if path := strings.TrimPrefix(parsed.Path, "/"); path != "" {
				dbName = path
			}
			if ssl := parsed.Query().Get("sslmode"); ssl != "" {
				dbSSLMode = ssl
			} else if dbHost != "localhost" && dbHost != "127.0.0.1" {
				dbSSLMode = "require"
				q := parsed.Query()
				q.Set("sslmode", "require")
				parsed.RawQuery = q.Encode()
				databaseURL = parsed.String()
			}
		}
	}

	httpAddr := env("HTTP_ADDR", "")
	if httpAddr == "" {
		if port := os.Getenv("PORT"); port != "" {
			httpAddr = ":" + port
		} else {
			httpAddr = ":8080"
		}
	} else if !strings.Contains(httpAddr, ":") {
		httpAddr = ":" + httpAddr
	}

	cfg := Config{
		Environment:        env("APP_ENV", "development"),
		HTTPAddress:        httpAddr,
		DatabaseURL:        databaseURL,
		DBHost:             dbHost,
		DBPort:             dbPort,
		DBName:             dbName,
		DBUser:             dbUser,
		DBPassword:         dbPassword,
		DBSSLMode:          dbSSLMode,
		JWTAccessSecret:    os.Getenv("JWT_ACCESS_SECRET"),
		WebBaseURL:         env("WEB_BASE_URL", "http://localhost:3000"),
		SMTPHost:           env("SMTP_HOST", "localhost"),
		SMTPPort:           smtpPort,
		SMTPUsername:       os.Getenv("SMTP_USERNAME"),
		SMTPPassword:       os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:           env("SMTP_FROM", "Scripd <noreply@scripd.local>"),
		SMTPRequireTLS:     smtpRequireTLS,
		CORSAllowedOrigins: splitCSV(env("CORS_ALLOWED_ORIGINS", "http://localhost:3000")),
		RateLimitRequests:  rateLimitRequests,
		RateLimitWindow:    rateLimitWindow,
		ShutdownTimeout:    shutdownTimeout,
		ReadinessTimeout:   readinessTimeout,
	}
	if err := validate(cfg); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func validate(cfg Config) error {
	if cfg.RateLimitWindow < time.Millisecond {
		return fmt.Errorf("invalid configuration: RATE_LIMIT_WINDOW must be at least 1ms")
	}
	for _, origin := range cfg.CORSAllowedOrigins {
		if origin == "*" {
			return fmt.Errorf("invalid configuration: wildcard CORS origin '*' is not allowed when credentials are enabled")
		}
	}
	webURL, err := url.Parse(cfg.WebBaseURL)
	if err != nil || (webURL.Scheme != "http" && webURL.Scheme != "https") || webURL.Host == "" || webURL.User != nil || webURL.RawQuery != "" || webURL.Fragment != "" {
		return fmt.Errorf("invalid configuration: WEB_BASE_URL must be an absolute HTTP(S) URL without credentials, query, or fragment")
	}
	if cfg.SMTPPort < 1 || cfg.SMTPPort > 65535 {
		return fmt.Errorf("invalid configuration: SMTP_PORT must be between 1 and 65535")
	}
	if cfg.SMTPHost == "" {
		return fmt.Errorf("invalid configuration: SMTP_HOST is required")
	}
	if _, err := mail.ParseAddress(cfg.SMTPFrom); err != nil {
		return fmt.Errorf("invalid configuration: SMTP_FROM must be a valid email address: %w", err)
	}
	if (cfg.SMTPUsername == "") != (cfg.SMTPPassword == "") {
		return fmt.Errorf("invalid configuration: SMTP_USERNAME and SMTP_PASSWORD must be provided together")
	}
	if cfg.SMTPUsername != "" && !cfg.SMTPRequireTLS {
		return fmt.Errorf("invalid configuration: SMTP_REQUIRE_TLS must be true when SMTP authentication is enabled")
	}
	v := validator.New()
	if err := v.Struct(struct {
		Environment        string        `validate:"required,oneof=development test production"`
		HTTPAddress        string        `validate:"required"`
		DBHost             string        `validate:"required"`
		DBPort             int           `validate:"required,min=1,max=65535"`
		DBName             string        `validate:"required"`
		DBUser             string        `validate:"required"`
		DBSSLMode          string        `validate:"required,oneof=disable require verify-ca verify-full"`
		CORSAllowedOrigins []string      `validate:"min=1,dive,required"`
		RateLimitRequests  int           `validate:"min=1"`
		RateLimitWindow    time.Duration `validate:"gt=0"`
		ShutdownTimeout    time.Duration `validate:"gt=0"`
		ReadinessTimeout   time.Duration `validate:"gt=0"`
	}{cfg.Environment, cfg.HTTPAddress, cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBUser, cfg.DBSSLMode, cfg.CORSAllowedOrigins, cfg.RateLimitRequests, cfg.RateLimitWindow, cfg.ShutdownTimeout, cfg.ReadinessTimeout}); err != nil {
		return fmt.Errorf("invalid configuration: %w", err)
	}
	if len(cfg.JWTAccessSecret) < 32 {
		return fmt.Errorf("invalid configuration: JWT_ACCESS_SECRET must contain at least 32 bytes")
	}
	if cfg.Environment == "production" {
		if len(cfg.DBPassword) == 0 {
			return fmt.Errorf("invalid production configuration: DB_PASSWORD is required")
		}
		if cfg.WebBaseURL == "http://localhost:3000" || webURL.Scheme != "https" {
			return fmt.Errorf("invalid production configuration: WEB_BASE_URL must use HTTPS and point to the deployed web application")
		}
		if cfg.SMTPHost == "localhost" || cfg.SMTPUsername == "" || cfg.SMTPPassword == "" || !cfg.SMTPRequireTLS {
			return fmt.Errorf("invalid production configuration: authenticated SMTP with TLS is required")
		}
	}
	return nil
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		if origin := strings.TrimSpace(part); origin != "" {
			origins = append(origins, origin)
		}
	}
	return origins
}

func intFromEnv(key string, fallback int) (int, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", key, err)
	}
	return parsed, nil
}

func durationFromEnv(key string, fallback time.Duration) (time.Duration, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be a duration: %w", key, err)
	}
	return parsed, nil
}

func boolFromEnv(key string, fallback bool) (bool, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s must be a boolean: %w", key, err)
	}
	return parsed, nil
}

func loadDotEnv(path string) {
	content, err := os.ReadFile(path)
	if err != nil {
		return
	}
	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		k := strings.TrimSpace(parts[0])
		v := strings.TrimSpace(parts[1])
		if len(v) >= 2 && ((v[0] == '"' && v[len(v)-1] == '"') || (v[0] == '\'' && v[len(v)-1] == '\'')) {
			v = v[1 : len(v)-1]
		}
		if os.Getenv(k) == "" {
			_ = os.Setenv(k, v)
		}
	}
}
