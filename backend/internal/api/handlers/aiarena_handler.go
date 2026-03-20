package handlers

import (
	"strconv"

	"lastsaas/internal/db"
)

// AIArenaHandler handles AI Arena related requests
type AIArenaHandler struct {
	DB *db.MongoDB
}

// NewAIArenaHandler creates a new AI Arena handler
func NewAIArenaHandler(database *db.MongoDB) *AIArenaHandler {
	return &AIArenaHandler{
		DB: database,
	}
}

// atoi parses string to int with default value
func atoi(s string, defaultValue int) int {
	if s == "" {
		return defaultValue
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return defaultValue
	}
	return n
}
