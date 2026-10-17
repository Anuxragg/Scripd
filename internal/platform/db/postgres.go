package db

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strconv"

	"github.com/scripd-app/scripd/internal/platform/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, cfg config.Config) (*pgxpool.Pool, error) {
	poolConfig, err := pgxpool.ParseConfig(databaseURL(cfg))
	if err != nil {
		return nil, fmt.Errorf("parse PostgreSQL configuration: %w", err)
	}
	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("create PostgreSQL pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping PostgreSQL: %w", err)
	}
	return pool, nil
}

func databaseURL(cfg config.Config) string {
	if cfg.DatabaseURL != "" {
		return cfg.DatabaseURL
	}
	return (&url.URL{
		Scheme: "postgres",
		Host:   net.JoinHostPort(cfg.DBHost, strconv.Itoa(cfg.DBPort)),
		User:   url.UserPassword(cfg.DBUser, cfg.DBPassword),
		Path:   cfg.DBName,
		RawQuery: url.Values{
			"sslmode": []string{cfg.DBSSLMode},
		}.Encode(),
	}).String()
}
