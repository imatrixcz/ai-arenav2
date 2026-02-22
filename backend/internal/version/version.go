package version

import (
	"os"
	"path/filepath"
	"strings"
)

// Current holds the version loaded at startup.
var Current string

// Load reads the VERSION file from the working directory or parent directories.
func Load() string {
	dir, _ := os.Getwd()
	for i := 0; i < 5; i++ {
		data, err := os.ReadFile(filepath.Join(dir, "VERSION"))
		if err == nil {
			Current = strings.TrimSpace(string(data))
			return Current
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	Current = "unknown"
	return Current
}
