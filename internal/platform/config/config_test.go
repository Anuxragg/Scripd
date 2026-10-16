package config

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestSplitCSVTrimsAndDropsEmptyValues(t *testing.T) {
	require.Equal(t, []string{"https://app.example", "http://localhost:3000"}, splitCSV(" https://app.example, ,http://localhost:3000 "))
}

func TestValidateRejectsWildcardOriginInProduction(t *testing.T) {
	cfg := Config{
		Environment: "production", HTTPAddress: ":8080", DBHost: "postgres", DBPort: 5432,
		DBName: "scripd", DBUser: "scripd", DBPassword: "strong", DBSSLMode: "require",
		JWTAccessSecret:    "12345678901234567890123456789012",
		CORSAllowedOrigins: []string{"*"},
		RateLimitRequests:  10, RateLimitWindow: time.Millisecond, ShutdownTimeout: 1, ReadinessTimeout: 1,
	}
	require.ErrorContains(t, validate(cfg), "wildcard CORS")
}
