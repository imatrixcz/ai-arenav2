package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"lastsaas/internal/db"
	"lastsaas/internal/middleware"
	"lastsaas/internal/models"
	"lastsaas/internal/syslog"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/gorilla/mux"
)

type PlansHandler struct {
	db     *db.MongoDB
	syslog *syslog.Logger
}

func NewPlansHandler(database *db.MongoDB, sysLogger *syslog.Logger) *PlansHandler {
	return &PlansHandler{
		db:     database,
		syslog: sysLogger,
	}
}

// ListPlans returns all plans sorted by createdAt.
func (h *PlansHandler) ListPlans(w http.ResponseWriter, r *http.Request) {
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}})
	cursor, err := h.db.Plans().Find(r.Context(), bson.M{}, opts)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to list plans")
		return
	}
	defer cursor.Close(r.Context())

	var plans []models.Plan
	if err := cursor.All(r.Context(), &plans); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to decode plans")
		return
	}
	if plans == nil {
		plans = []models.Plan{}
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"plans": plans})
}

// GetPlan returns a single plan by ID.
func (h *PlansHandler) GetPlan(w http.ResponseWriter, r *http.Request) {
	planID, err := primitive.ObjectIDFromHex(mux.Vars(r)["planId"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid plan ID")
		return
	}

	var plan models.Plan
	if err := h.db.Plans().FindOne(r.Context(), bson.M{"_id": planID}).Decode(&plan); err != nil {
		if err == mongo.ErrNoDocuments {
			respondWithError(w, http.StatusNotFound, "Plan not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to get plan")
		return
	}
	respondWithJSON(w, http.StatusOK, plan)
}

// ListEntitlementKeys returns unique entitlement keys, types, and descriptions across all plans.
func (h *PlansHandler) ListEntitlementKeys(w http.ResponseWriter, r *http.Request) {
	cursor, err := h.db.Plans().Find(r.Context(), bson.M{})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to list plans")
		return
	}
	defer cursor.Close(r.Context())

	type KeyInfo struct {
		Key         string `json:"key"`
		Type        string `json:"type"`
		Description string `json:"description"`
	}

	type keyData struct {
		typ         string
		description string
	}
	keyMap := make(map[string]keyData)
	for cursor.Next(r.Context()) {
		var plan models.Plan
		if err := cursor.Decode(&plan); err != nil {
			continue
		}
		for k, v := range plan.Entitlements {
			existing, ok := keyMap[k]
			if !ok {
				keyMap[k] = keyData{typ: string(v.Type), description: v.Description}
			} else if existing.description == "" && v.Description != "" {
				existing.description = v.Description
				keyMap[k] = existing
			}
		}
	}

	keys := make([]KeyInfo, 0, len(keyMap))
	for k, d := range keyMap {
		keys = append(keys, KeyInfo{Key: k, Type: d.typ, Description: d.description})
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"keys": keys})
}

type planRequest struct {
	Name                 string                              `json:"name"`
	Description          string                              `json:"description"`
	MonthlyPriceCents    int64                               `json:"monthlyPriceCents"`
	AnnualDiscountPct    int                                 `json:"annualDiscountPct"`
	UsageCreditsPerMonth int64                               `json:"usageCreditsPerMonth"`
	CreditResetPolicy    string                              `json:"creditResetPolicy"`
	BonusCredits         int64                               `json:"bonusCredits"`
	UserLimit            int                                 `json:"userLimit"`
	Entitlements         map[string]models.EntitlementValue   `json:"entitlements"`
}

func validatePlanRequest(req *planRequest) error {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return fmt.Errorf("name is required")
	}
	if req.MonthlyPriceCents < 0 {
		return fmt.Errorf("monthly price must be >= 0")
	}
	if req.AnnualDiscountPct < 0 || req.AnnualDiscountPct > 100 {
		return fmt.Errorf("annual discount must be 0-100")
	}
	if req.UsageCreditsPerMonth < 0 {
		return fmt.Errorf("usage credits must be >= 0")
	}
	if req.CreditResetPolicy == "" {
		req.CreditResetPolicy = "reset"
	}
	if req.CreditResetPolicy != "reset" && req.CreditResetPolicy != "accrue" {
		return fmt.Errorf("credit reset policy must be 'reset' or 'accrue'")
	}
	if req.BonusCredits < 0 {
		return fmt.Errorf("bonus credits must be >= 0")
	}
	if req.UserLimit < 0 {
		return fmt.Errorf("user limit must be >= 0")
	}
	for k, v := range req.Entitlements {
		if v.Type != models.EntitlementTypeBool && v.Type != models.EntitlementTypeNumeric {
			return fmt.Errorf("entitlement %q has invalid type %q", k, v.Type)
		}
	}
	return nil
}

// CreatePlan creates a new plan.
func (h *PlansHandler) CreatePlan(w http.ResponseWriter, r *http.Request) {
	var req planRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := validatePlanRequest(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Check name uniqueness
	count, _ := h.db.Plans().CountDocuments(r.Context(), bson.M{"name": req.Name})
	if count > 0 {
		respondWithError(w, http.StatusConflict, "A plan with this name already exists")
		return
	}

	entitlements := req.Entitlements
	if entitlements == nil {
		entitlements = map[string]models.EntitlementValue{}
	}

	now := time.Now()
	plan := models.Plan{
		Name:                 req.Name,
		Description:          strings.TrimSpace(req.Description),
		MonthlyPriceCents:    req.MonthlyPriceCents,
		AnnualDiscountPct:    req.AnnualDiscountPct,
		UsageCreditsPerMonth: req.UsageCreditsPerMonth,
		CreditResetPolicy:    models.CreditResetPolicy(req.CreditResetPolicy),
		BonusCredits:         req.BonusCredits,
		UserLimit:            req.UserLimit,
		Entitlements:         entitlements,
		IsSystem:             false,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	result, err := h.db.Plans().InsertOne(r.Context(), plan)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create plan")
		return
	}
	plan.ID = result.InsertedID.(primitive.ObjectID)

	if user, ok := middleware.GetUserFromContext(r.Context()); ok {
		h.syslog.LogWithUser(r.Context(), models.LogMedium, fmt.Sprintf("Plan created: %s", plan.Name), user.ID)
	}

	respondWithJSON(w, http.StatusCreated, plan)
}

// UpdatePlan updates an existing plan.
func (h *PlansHandler) UpdatePlan(w http.ResponseWriter, r *http.Request) {
	planID, err := primitive.ObjectIDFromHex(mux.Vars(r)["planId"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid plan ID")
		return
	}

	var existing models.Plan
	if err := h.db.Plans().FindOne(r.Context(), bson.M{"_id": planID}).Decode(&existing); err != nil {
		if err == mongo.ErrNoDocuments {
			respondWithError(w, http.StatusNotFound, "Plan not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to get plan")
		return
	}

	var req planRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := validatePlanRequest(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	// System plans can't have their name changed
	if existing.IsSystem && req.Name != existing.Name {
		respondWithError(w, http.StatusForbidden, "Cannot rename a system plan")
		return
	}

	// Check name uniqueness if name changed
	if req.Name != existing.Name {
		count, _ := h.db.Plans().CountDocuments(r.Context(), bson.M{"name": req.Name, "_id": bson.M{"$ne": planID}})
		if count > 0 {
			respondWithError(w, http.StatusConflict, "A plan with this name already exists")
			return
		}
	}

	entitlements := req.Entitlements
	if entitlements == nil {
		entitlements = map[string]models.EntitlementValue{}
	}

	update := bson.M{"$set": bson.M{
		"name":                 req.Name,
		"description":          strings.TrimSpace(req.Description),
		"monthlyPriceCents":    req.MonthlyPriceCents,
		"annualDiscountPct":    req.AnnualDiscountPct,
		"usageCreditsPerMonth": req.UsageCreditsPerMonth,
		"creditResetPolicy":    req.CreditResetPolicy,
		"bonusCredits":         req.BonusCredits,
		"userLimit":            req.UserLimit,
		"entitlements":         entitlements,
		"updatedAt":            time.Now(),
	}}

	if _, err := h.db.Plans().UpdateByID(r.Context(), planID, update); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update plan")
		return
	}

	if user, ok := middleware.GetUserFromContext(r.Context()); ok {
		h.syslog.LogWithUser(r.Context(), models.LogMedium, fmt.Sprintf("Plan updated: %s", req.Name), user.ID)
	}

	// Return updated plan
	var updated models.Plan
	h.db.Plans().FindOne(r.Context(), bson.M{"_id": planID}).Decode(&updated)
	respondWithJSON(w, http.StatusOK, updated)
}

// DeletePlan deletes a non-system plan if no tenants use it.
func (h *PlansHandler) DeletePlan(w http.ResponseWriter, r *http.Request) {
	planID, err := primitive.ObjectIDFromHex(mux.Vars(r)["planId"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid plan ID")
		return
	}

	var plan models.Plan
	if err := h.db.Plans().FindOne(r.Context(), bson.M{"_id": planID}).Decode(&plan); err != nil {
		if err == mongo.ErrNoDocuments {
			respondWithError(w, http.StatusNotFound, "Plan not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to get plan")
		return
	}

	if plan.IsSystem {
		respondWithError(w, http.StatusForbidden, "Cannot delete a system plan")
		return
	}

	tenantCount, _ := h.db.Tenants().CountDocuments(r.Context(), bson.M{"planId": planID})
	if tenantCount > 0 {
		respondWithError(w, http.StatusConflict, fmt.Sprintf("Cannot delete plan: %d tenant(s) are using it", tenantCount))
		return
	}

	if _, err := h.db.Plans().DeleteOne(r.Context(), bson.M{"_id": planID}); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete plan")
		return
	}

	if user, ok := middleware.GetUserFromContext(r.Context()); ok {
		h.syslog.LogWithUser(r.Context(), models.LogMedium, fmt.Sprintf("Plan deleted: %s", plan.Name), user.ID)
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// AssignPlan sets a tenant's plan and/or billing waived status.
func (h *PlansHandler) AssignPlan(w http.ResponseWriter, r *http.Request) {
	tenantID, err := primitive.ObjectIDFromHex(mux.Vars(r)["tenantId"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}

	var req struct {
		PlanID        *string `json:"planId"`
		BillingWaived *bool   `json:"billingWaived,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Verify tenant exists
	var tenant models.Tenant
	if err := h.db.Tenants().FindOne(r.Context(), bson.M{"_id": tenantID}).Decode(&tenant); err != nil {
		if err == mongo.ErrNoDocuments {
			respondWithError(w, http.StatusNotFound, "Tenant not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to get tenant")
		return
	}

	setFields := bson.M{"updatedAt": time.Now()}
	unsetFields := bson.M{}
	var planName string

	if req.PlanID != nil {
		if *req.PlanID != "" {
			planOID, err := primitive.ObjectIDFromHex(*req.PlanID)
			if err != nil {
				respondWithError(w, http.StatusBadRequest, "Invalid plan ID")
				return
			}
			// Verify plan exists
			var plan models.Plan
			if err := h.db.Plans().FindOne(r.Context(), bson.M{"_id": planOID}).Decode(&plan); err != nil {
				if err == mongo.ErrNoDocuments {
					respondWithError(w, http.StatusNotFound, "Plan not found")
					return
				}
				respondWithError(w, http.StatusInternalServerError, "Failed to get plan")
				return
			}
			planName = plan.Name
			setFields["planId"] = planOID
		} else {
			planName = "Free"
			unsetFields["planId"] = ""
		}
	}

	if req.BillingWaived != nil {
		setFields["billingWaived"] = *req.BillingWaived
	}

	update := bson.M{"$set": setFields}
	if len(unsetFields) > 0 {
		update["$unset"] = unsetFields
	}

	if _, err := h.db.Tenants().UpdateByID(r.Context(), tenantID, update); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to assign plan")
		return
	}

	if user, ok := middleware.GetUserFromContext(r.Context()); ok {
		if planName != "" {
			h.syslog.LogWithUser(r.Context(), models.LogMedium, fmt.Sprintf("Tenant %s assigned to plan: %s", tenant.Name, planName), user.ID)
		}
		if req.BillingWaived != nil {
			h.syslog.LogWithUser(r.Context(), models.LogMedium, fmt.Sprintf("Tenant %s billing waived: %v", tenant.Name, *req.BillingWaived), user.ID)
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// ListPlansPublic returns all plans for authenticated users along with their tenant's current plan.
func (h *PlansHandler) ListPlansPublic(w http.ResponseWriter, r *http.Request) {
	// Get tenant from X-Tenant-ID header
	tenantIDStr := r.Header.Get("X-Tenant-ID")
	if tenantIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "Tenant ID required")
		return
	}
	tenantID, err := primitive.ObjectIDFromHex(tenantIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}

	var tenant models.Tenant
	if err := h.db.Tenants().FindOne(r.Context(), bson.M{"_id": tenantID}).Decode(&tenant); err != nil {
		respondWithError(w, http.StatusNotFound, "Tenant not found")
		return
	}

	// Get all plans sorted by price then name
	opts := options.Find().SetSort(bson.D{{Key: "monthlyPriceCents", Value: 1}, {Key: "name", Value: 1}})
	cursor, err := h.db.Plans().Find(r.Context(), bson.M{}, opts)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to list plans")
		return
	}
	defer cursor.Close(r.Context())

	var plans []models.Plan
	if err := cursor.All(r.Context(), &plans); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to decode plans")
		return
	}
	if plans == nil {
		plans = []models.Plan{}
	}

	// Resolve current plan ID
	currentPlanID := ""
	if tenant.PlanID != nil {
		currentPlanID = tenant.PlanID.Hex()
	} else {
		// Fall back to system plan
		for _, p := range plans {
			if p.IsSystem {
				currentPlanID = p.ID.Hex()
				break
			}
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"plans":                      plans,
		"currentPlanId":              currentPlanID,
		"billingWaived":              tenant.BillingWaived,
		"tenantSubscriptionCredits":  tenant.SubscriptionCredits,
		"tenantPurchasedCredits":     tenant.PurchasedCredits,
	})
}

// lookupPlanForTenant returns the plan for a tenant, falling back to the system free plan.
func (h *PlansHandler) lookupPlanForTenant(ctx context.Context, tenant *models.Tenant) (*models.Plan, error) {
	var plan models.Plan
	if tenant.PlanID != nil {
		err := h.db.Plans().FindOne(ctx, bson.M{"_id": *tenant.PlanID}).Decode(&plan)
		return &plan, err
	}
	err := h.db.Plans().FindOne(ctx, bson.M{"isSystem": true}).Decode(&plan)
	return &plan, err
}
