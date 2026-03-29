package id

import (
	"crypto/rand"
	"strings"
	"sync"
	"time"

	"github.com/oklog/ulid"
)

var (
	mu      sync.Mutex
	entropy = ulid.Monotonic(rand.Reader, 0)
)

// NewPersistentID returns a lexicographically sortable opaque identifier for
// persisted content and asset records that may appear in Git paths, frontmatter,
// and URLs.
func NewPersistentID() string {
	mu.Lock()
	defer mu.Unlock()
	return ulid.MustNew(ulid.Timestamp(time.Now().UTC()), entropy).String()
}

// CanonicalizeSecondaryPersistentID keeps an existing ULID for persisted nested
// records and rewrites client-side temporary ids to a canonical ULID.
func CanonicalizeSecondaryPersistentID(current string) string {
	current = strings.TrimSpace(current)
	if current != "" {
		if _, err := ulid.ParseStrict(current); err == nil {
			return current
		}
	}
	return NewPersistentID()
}
