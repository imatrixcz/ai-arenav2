package handlers

import (
	"net/http"
	"strconv"

	"lastsaas/internal/db"
	"lastsaas/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type LogHandler struct {
	db *db.MongoDB
}

func NewLogHandler(database *db.MongoDB) *LogHandler {
	return &LogHandler{db: database}
}

type logListResponse struct {
	Logs  []models.SystemLog `json:"logs"`
	Total int64              `json:"total"`
}

func (h *LogHandler) ListLogs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	// Pagination
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(q.Get("perPage"))
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	skip := int64((page - 1) * perPage)

	filter := bson.M{}

	// Severity filter
	if sev := q.Get("severity"); sev != "" {
		switch models.LogSeverity(sev) {
		case models.LogCritical, models.LogHigh, models.LogMedium, models.LogLow, models.LogDebug:
			filter["severity"] = sev
		}
	}

	// User filter
	if uid := q.Get("userId"); uid != "" {
		if userOID, err := primitive.ObjectIDFromHex(uid); err == nil {
			filter["userId"] = userOID
		}
	}

	// Text search
	if search := q.Get("search"); search != "" {
		filter["$text"] = bson.M{"$search": search}
	}

	ctx := r.Context()

	total, err := h.db.SystemLogs().CountDocuments(ctx, filter)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to count logs")
		return
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "createdAt", Value: -1}}).
		SetSkip(skip).
		SetLimit(int64(perPage))

	cursor, err := h.db.SystemLogs().Find(ctx, filter, opts)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to query logs")
		return
	}
	defer cursor.Close(ctx)

	logs := []models.SystemLog{}
	if err := cursor.All(ctx, &logs); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to read logs")
		return
	}

	respondWithJSON(w, http.StatusOK, logListResponse{Logs: logs, Total: total})
}
