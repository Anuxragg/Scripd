package logger

import (
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

func New(environment string) zerolog.Logger {
	zerolog.TimeFieldFormat = time.RFC3339Nano
	if strings.EqualFold(environment, "development") || strings.EqualFold(environment, "test") {
		return zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}).With().Timestamp().Logger()
	}
	return zerolog.New(os.Stdout).With().Timestamp().Logger()
}
