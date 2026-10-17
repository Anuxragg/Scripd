package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/scripd-app/scripd/internal/platform/config"
	"github.com/scripd-app/scripd/internal/platform/db"
)

type migrationFile struct {
	version  int64
	filename string
	path     string
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Migration error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	fmt.Printf("Connecting to database at %s:%d (database: %s)...\n", cfg.DBHost, cfg.DBPort, cfg.DBName)
	pool, err := db.Connect(ctx, cfg)
	if err != nil {
		return fmt.Errorf("database connection failed: %w", err)
	}
	defer pool.Close()

	// Ensure schema_migrations table exists (compatible with golang-migrate)
	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version bigint PRIMARY KEY,
			dirty boolean NOT NULL
		);
	`)
	if err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}

	var currentVersion int64
	var dirty bool
	err = pool.QueryRow(ctx, "SELECT version, dirty FROM schema_migrations ORDER BY version DESC LIMIT 1").Scan(&currentVersion, &dirty)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("query current schema version: %w", err)
	}
	if dirty {
		return fmt.Errorf("database is in a dirty state at version %d; resolve manually before proceeding", currentVersion)
	}

	fmt.Printf("Current schema version: %d\n", currentVersion)

	migrationDir := "migrations"
	files, err := os.ReadDir(migrationDir)
	if err != nil {
		return fmt.Errorf("read migrations directory: %w", err)
	}

	var migrations []migrationFile
	for _, f := range files {
		if f.IsDir() || !strings.HasSuffix(f.Name(), ".up.sql") {
			continue
		}
		parts := strings.Split(f.Name(), "_")
		if len(parts) < 2 {
			continue
		}
		ver, err := strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			continue
		}
		migrations = append(migrations, migrationFile{
			version:  ver,
			filename: f.Name(),
			path:     filepath.Join(migrationDir, f.Name()),
		})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].version < migrations[j].version
	})

	appliedCount := 0
	for _, m := range migrations {
		if m.version <= currentVersion {
			continue
		}

		fmt.Printf("Applying migration %06d (%s)...\n", m.version, m.filename)
		sqlContent, err := os.ReadFile(m.path)
		if err != nil {
			return fmt.Errorf("read %s: %w", m.path, err)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("begin transaction: %w", err)
		}

		// Mark dirty
		_, _ = tx.Exec(ctx, "DELETE FROM schema_migrations")
		_, err = tx.Exec(ctx, "INSERT INTO schema_migrations (version, dirty) VALUES ($1, true)", m.version)
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("mark dirty for version %d: %w", m.version, err)
		}

		if _, err := tx.Exec(ctx, string(sqlContent)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("execute %s failed: %w", m.filename, err)
		}

		// Mark clean
		_, err = tx.Exec(ctx, "UPDATE schema_migrations SET dirty = false WHERE version = $1", m.version)
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("mark clean for version %d: %w", m.version, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit migration %d: %w", m.version, err)
		}

		currentVersion = m.version
		appliedCount++
		fmt.Printf("Successfully applied migration %06d\n", m.version)
	}

	if appliedCount == 0 {
		fmt.Println("Database is already up to date!")
	} else {
		fmt.Printf("Finished! Applied %d migration(s). Database is now at version %d.\n", appliedCount, currentVersion)
	}

	return nil
}
