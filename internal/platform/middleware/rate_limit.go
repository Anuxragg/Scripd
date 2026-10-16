package middleware

import (
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/scripd-app/scripd/internal/platform/response"
)

type rateLimitBucket struct {
	count int
	reset time.Time
}

const maximumRateLimitBuckets = 10_000

type localRateLimiter struct {
	mu          sync.Mutex
	buckets     map[string]rateLimitBucket
	lastCleanup time.Time
	window      time.Duration
}

func RateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	limiter := &localRateLimiter{
		buckets: make(map[string]rateLimitBucket),
		window:  window,
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/healthz" || r.URL.Path == "/readyz" {
				next.ServeHTTP(w, r)
				return
			}
			count, reset := limiter.increment(remoteIP(r.RemoteAddr))
			remaining := limit - count
			if remaining < 0 {
				remaining = 0
			}
			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(limit))
			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(reset.Unix(), 10))
			if count > limit {
				w.Header().Set("Retry-After", strconv.Itoa(max(1, int(time.Until(reset).Seconds()))))
				response.WriteError(w, r, http.StatusTooManyRequests, "rate_limit_exceeded", "too many requests")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func (l *localRateLimiter) increment(key string) (int, time.Time) {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.buckets == nil {
		l.buckets = make(map[string]rateLimitBucket)
	}
	if now.Sub(l.lastCleanup) >= l.window {
		for ip, bucket := range l.buckets {
			if !now.Before(bucket.reset) {
				delete(l.buckets, ip)
			}
		}
		l.lastCleanup = now
	}
	if _, exists := l.buckets[key]; !exists && len(l.buckets) >= maximumRateLimitBuckets {
		var oldestKey string
		var oldestReset time.Time
		foundOldest := false
		for candidate, bucket := range l.buckets {
			if !foundOldest || bucket.reset.Before(oldestReset) {
				oldestKey, oldestReset = candidate, bucket.reset
				foundOldest = true
			}
		}
		if foundOldest {
			delete(l.buckets, oldestKey)
		}
	}
	bucket := l.buckets[key]
	if !now.Before(bucket.reset) {
		bucket = rateLimitBucket{reset: now.Add(l.window)}
	}
	bucket.count++
	l.buckets[key] = bucket
	return bucket.count, bucket.reset
}

func remoteIP(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err == nil {
		return host
	}
	return remoteAddr
}
