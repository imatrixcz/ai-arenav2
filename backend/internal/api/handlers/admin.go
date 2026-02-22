package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"lastsaas/internal/db"
	"lastsaas/internal/events"
	"lastsaas/internal/middleware"
	"lastsaas/internal/models"
	"lastsaas/internal/syslog"
	"lastsaas/internal/version"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/gorilla/mux"
)

type AdminHandler struct {
	db     *db.MongoDB
	events events.Emitter
	syslog *syslog.Logger
}

func NewAdminHandler(database *db.MongoDB, emitter events.Emitter, sysLogger *syslog.Logger) *AdminHandler {
	return &AdminHandler{
		db:     database,
		events: emitter,
		syslog: sysLogger,
	}
}

type TenantListItem struct {
	ID                  string    `json:"id"`
	Name                string    `json:"name"`
	Slug                string    `json:"slug"`
	IsRoot              bool      `json:"isRoot"`
	IsActive            bool      `json:"isActive"`
	MemberCount         int       `json:"memberCount"`
	PlanName            string    `json:"planName"`
	BillingWaived       bool      `json:"billingWaived"`
	SubscriptionCredits int64     `json:"subscriptionCredits"`
	PurchasedCredits    int64     `json:"purchasedCredits"`
	CreatedAt           time.Time `json:"createdAt"`
}

type UserListItem struct {
	ID            string    `json:"id"`
	Email         string    `json:"email"`
	DisplayName   string    `json:"displayName"`
	EmailVerified bool      `json:"emailVerified"`
	IsActive      bool      `json:"isActive"`
	TenantCount   int       `json:"tenantCount"`
	CreatedAt     time.Time `json:"createdAt"`
	LastLoginAt   *time.Time `json:"lastLoginAt,omitempty"`
}

func (h *AdminHandler) ListTenants(w http.ResponseWriter, r *http.Request) {
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
	cursor, err := h.db.Tenants().Find(r.Context(), bson.M{}, opts)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch tenants")
		return
	}
	defer cursor.Close(r.Context())

	var tenants []models.Tenant
	if err := cursor.All(r.Context(), &tenants); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to decode tenants")
		return
	}

	// Build plan name lookup
	planCursor, _ := h.db.Plans().Find(r.Context(), bson.M{})
	planNames := map[string]string{}
	var systemPlanName string
	if planCursor != nil {
		var plans []models.Plan
		planCursor.All(r.Context(), &plans)
		for _, p := range plans {
			planNames[p.ID.Hex()] = p.Name
			if p.IsSystem {
				systemPlanName = p.Name
			}
		}
	}
	if systemPlanName == "" {
		systemPlanName = "Free"
	}

	var items []TenantListItem
	for _, t := range tenants {
		memberCount, _ := h.db.TenantMemberships().CountDocuments(r.Context(), bson.M{"tenantId": t.ID})
		pName := systemPlanName
		if t.PlanID != nil {
			if n, ok := planNames[t.PlanID.Hex()]; ok {
				pName = n
			}
		}
		items = append(items, TenantListItem{
			ID:                  t.ID.Hex(),
			Name:                t.Name,
			Slug:                t.Slug,
			IsRoot:              t.IsRoot,
			IsActive:            t.IsActive,
			MemberCount:         int(memberCount),
			PlanName:            pName,
			BillingWaived:       t.BillingWaived,
			SubscriptionCredits: t.SubscriptionCredits,
			PurchasedCredits:    t.PurchasedCredits,
			CreatedAt:           t.CreatedAt,
		})
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{"tenants": items})
}

func (h *AdminHandler) GetTenant(w http.ResponseWriter, r *http.Request) {
	tenantIDStr := mux.Vars(r)["tenantId"]
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

	// Get members
	cursor, err := h.db.TenantMemberships().Find(r.Context(), bson.M{"tenantId": tenantID})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch members")
		return
	}
	defer cursor.Close(r.Context())

	var memberships []models.TenantMembership
	cursor.All(r.Context(), &memberships)

	var members []MemberResponse
	for _, m := range memberships {
		var user models.User
		if err := h.db.Users().FindOne(r.Context(), bson.M{"_id": m.UserID}).Decode(&user); err != nil {
			continue
		}
		members = append(members, MemberResponse{
			UserID:      user.ID.Hex(),
			Email:       user.Email,
			DisplayName: user.DisplayName,
			Role:        m.Role,
			JoinedAt:    m.JoinedAt,
		})
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"tenant":  tenant,
		"members": members,
	})
}

func (h *AdminHandler) UpdateTenantStatus(w http.ResponseWriter, r *http.Request) {
	tenantIDStr := mux.Vars(r)["tenantId"]
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

	// Cannot deactivate the root tenant
	if tenant.IsRoot {
		respondWithError(w, http.StatusForbidden, "Cannot modify the root tenant status")
		return
	}

	var req struct {
		IsActive bool `json:"isActive"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	h.db.Tenants().UpdateOne(r.Context(),
		bson.M{"_id": tenantID},
		bson.M{"$set": bson.M{"isActive": req.IsActive, "updatedAt": time.Now()}},
	)

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Tenant status updated"})
}

func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
	cursor, err := h.db.Users().Find(r.Context(), bson.M{}, opts)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch users")
		return
	}
	defer cursor.Close(r.Context())

	var users []models.User
	if err := cursor.All(r.Context(), &users); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to decode users")
		return
	}

	var items []UserListItem
	for _, u := range users {
		tenantCount, _ := h.db.TenantMemberships().CountDocuments(r.Context(), bson.M{"userId": u.ID})
		items = append(items, UserListItem{
			ID:            u.ID.Hex(),
			Email:         u.Email,
			DisplayName:   u.DisplayName,
			EmailVerified: u.EmailVerified,
			IsActive:      u.IsActive,
			TenantCount:   int(tenantCount),
			CreatedAt:     u.CreatedAt,
			LastLoginAt:   u.LastLoginAt,
		})
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{"users": items})
}

func (h *AdminHandler) UpdateUserStatus(w http.ResponseWriter, r *http.Request) {
	userIDStr := mux.Vars(r)["userId"]
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req struct {
		IsActive bool `json:"isActive"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result, err := h.db.Users().UpdateOne(r.Context(),
		bson.M{"_id": userID},
		bson.M{"$set": bson.M{"isActive": req.IsActive, "updatedAt": time.Now()}},
	)
	if err != nil || result.MatchedCount == 0 {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	actingUser, _ := middleware.GetUserFromContext(r.Context())
	action := "activated"
	if !req.IsActive {
		action = "deactivated"
	}
	h.syslog.HighWithUser(r.Context(), fmt.Sprintf("User %s: %s (admin action)", action, userID.Hex()), actingUser.ID)

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "User status updated"})
}

func (h *AdminHandler) GetAbout(w http.ResponseWriter, r *http.Request) {
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"version":   version.Current,
		"copyright": "\u00a92026 Metavert LLC, licensed under the MIT License",
	})
}

func decodeJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

// --- User Profile Handlers ---

type UserDetail struct {
	ID            string              `json:"id"`
	Email         string              `json:"email"`
	DisplayName   string              `json:"displayName"`
	EmailVerified bool                `json:"emailVerified"`
	IsActive      bool                `json:"isActive"`
	AuthMethods   []models.AuthMethod `json:"authMethods"`
	CreatedAt     time.Time           `json:"createdAt"`
	UpdatedAt     time.Time           `json:"updatedAt"`
	LastLoginAt   *time.Time          `json:"lastLoginAt,omitempty"`
}

type UserMembershipDetail struct {
	TenantID            string            `json:"tenantId"`
	TenantName          string            `json:"tenantName"`
	TenantSlug          string            `json:"tenantSlug"`
	IsRoot              bool              `json:"isRoot"`
	Role                models.MemberRole `json:"role"`
	JoinedAt            time.Time         `json:"joinedAt"`
	PlanID              string            `json:"planId"`
	PlanName            string            `json:"planName"`
	BillingWaived       bool              `json:"billingWaived"`
	SubscriptionCredits int64             `json:"subscriptionCredits"`
	PurchasedCredits    int64             `json:"purchasedCredits"`
}

func (h *AdminHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	userID, err := primitive.ObjectIDFromHex(mux.Vars(r)["userId"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var user models.User
	if err := h.db.Users().FindOne(r.Context(), bson.M{"_id": userID}).Decode(&user); err != nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	cursor, err := h.db.TenantMemberships().Find(r.Context(), bson.M{"userId": userID})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch memberships")
		return
	}
	defer cursor.Close(r.Context())

	var memberships []models.TenantMembership
	cursor.All(r.Context(), &memberships)

	// Build plan name lookup for membership details
	planCursor, _ := h.db.Plans().Find(r.Context(), bson.M{})
	planNameMap := map[string]string{}
	planIDMap := map[string]string{} // planOID hex -> planOID hex (for convenience)
	var systemPlanName string
	var systemPlanID string
	if planCursor != nil {
		var allPlans []models.Plan
		planCursor.All(r.Context(), &allPlans)
		for _, p := range allPlans {
			planNameMap[p.ID.Hex()] = p.Name
			planIDMap[p.ID.Hex()] = p.ID.Hex()
			if p.IsSystem {
				systemPlanName = p.Name
				systemPlanID = p.ID.Hex()
			}
		}
	}
	if systemPlanName == "" {
		systemPlanName = "Free"
	}

	var memberDetails []UserMembershipDetail
	for _, m := range memberships {
		var tenant models.Tenant
		if err := h.db.Tenants().FindOne(r.Context(), bson.M{"_id": m.TenantID}).Decode(&tenant); err != nil {
			continue
		}
		pName := systemPlanName
		pID := systemPlanID
		if tenant.PlanID != nil {
			if n, ok := planNameMap[tenant.PlanID.Hex()]; ok {
				pName = n
				pID = tenant.PlanID.Hex()
			}
		}
		memberDetails = append(memberDetails, UserMembershipDetail{
			TenantID:            tenant.ID.Hex(),
			TenantName:          tenant.Name,
			TenantSlug:          tenant.Slug,
			IsRoot:              tenant.IsRoot,
			Role:                m.Role,
			JoinedAt:            m.JoinedAt,
			PlanID:              pID,
			PlanName:            pName,
			BillingWaived:       tenant.BillingWaived,
			SubscriptionCredits: tenant.SubscriptionCredits,
			PurchasedCredits:    tenant.PurchasedCredits,
		})
	}

	detail := UserDetail{
		ID:            user.ID.Hex(),
		Email:         user.Email,
		DisplayName:   user.DisplayName,
		EmailVerified: user.EmailVerified,
		IsActive:      user.IsActive,
		AuthMethods:   user.AuthMethods,
		CreatedAt:     user.CreatedAt,
		UpdatedAt:     user.UpdatedAt,
		LastLoginAt:   user.LastLoginAt,
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"user":        detail,
		"memberships": memberDetails,
	})
}

func (h *AdminHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	userID, err := primitive.ObjectIDFromHex(mux.Vars(r)["userId"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req struct {
		Email       *string `json:"email"`
		DisplayName *string `json:"displayName"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var user models.User
	if err := h.db.Users().FindOne(r.Context(), bson.M{"_id": userID}).Decode(&user); err != nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	actingUser, _ := middleware.GetUserFromContext(r.Context())
	updates := bson.M{"updatedAt": time.Now()}

	if req.Email != nil {
		newEmail := strings.TrimSpace(strings.ToLower(*req.Email))
		if newEmail == "" {
			respondWithError(w, http.StatusBadRequest, "Email cannot be empty")
			return
		}
		if newEmail != user.Email {
			count, _ := h.db.Users().CountDocuments(r.Context(), bson.M{"email": newEmail, "_id": bson.M{"$ne": userID}})
			if count > 0 {
				respondWithError(w, http.StatusConflict, "Email already in use by another account")
				return
			}
			updates["email"] = newEmail
			h.syslog.HighWithUser(r.Context(),
				fmt.Sprintf("User email changed: %s -> %s (user %s, admin action)", user.Email, newEmail, userID.Hex()),
				actingUser.ID)
		}
	}

	if req.DisplayName != nil {
		name := strings.TrimSpace(*req.DisplayName)
		if name != "" {
			updates["displayName"] = name
		}
	}

	h.db.Users().UpdateOne(r.Context(), bson.M{"_id": userID}, bson.M{"$set": updates})
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "User updated"})
}

func (h *AdminHandler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID, err := primitive.ObjectIDFromHex(vars["userId"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}
	tenantID, err := primitive.ObjectIDFromHex(vars["tenantId"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}

	var req struct {
		Role models.MemberRole `json:"role"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if !models.ValidRole(req.Role) {
		respondWithError(w, http.StatusBadRequest, "Invalid role")
		return
	}

	var tenant models.Tenant
	if err := h.db.Tenants().FindOne(r.Context(), bson.M{"_id": tenantID}).Decode(&tenant); err != nil {
		respondWithError(w, http.StatusNotFound, "Tenant not found")
		return
	}

	// Block root tenant ownership transfer via API
	if tenant.IsRoot && req.Role == models.RoleOwner {
		respondWithError(w, http.StatusForbidden, "Root tenant ownership can only be transferred via the CLI command: lastsaas transfer-root-owner")
		return
	}

	ctx := r.Context()
	now := time.Now()

	// If promoting to owner, demote current owner to admin
	if req.Role == models.RoleOwner {
		var currentOwner models.TenantMembership
		if err := h.db.TenantMemberships().FindOne(ctx, bson.M{
			"tenantId": tenantID,
			"role":     models.RoleOwner,
		}).Decode(&currentOwner); err == nil {
			h.db.TenantMemberships().UpdateOne(ctx,
				bson.M{"_id": currentOwner.ID},
				bson.M{"$set": bson.M{"role": models.RoleAdmin, "updatedAt": now}},
			)
		}
	}

	result, err := h.db.TenantMemberships().UpdateOne(ctx,
		bson.M{"userId": userID, "tenantId": tenantID},
		bson.M{"$set": bson.M{"role": req.Role, "updatedAt": now}},
	)
	if err != nil || result.MatchedCount == 0 {
		respondWithError(w, http.StatusNotFound, "Membership not found")
		return
	}

	actingUser, _ := middleware.GetUserFromContext(ctx)
	h.syslog.HighWithUser(ctx,
		fmt.Sprintf("User role changed: user %s in tenant %s (%s) -> %s (admin action)", userID.Hex(), tenant.Name, tenantID.Hex(), req.Role),
		actingUser.ID)

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Role updated"})
}

type tenantDeletionInfo struct {
	TenantID     string           `json:"tenantId"`
	TenantName   string           `json:"tenantName"`
	IsRoot       bool             `json:"isRoot"`
	OtherMembers []MemberResponse `json:"otherMembers"`
}

func (h *AdminHandler) PreflightDeleteUser(w http.ResponseWriter, r *http.Request) {
	userID, err := primitive.ObjectIDFromHex(mux.Vars(r)["userId"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	ctx := r.Context()
	actingUser, _ := middleware.GetUserFromContext(ctx)

	if actingUser.ID == userID {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{
			"canDelete": false,
			"reason":    "Cannot delete your own account",
		})
		return
	}

	cursor, _ := h.db.TenantMemberships().Find(ctx, bson.M{"userId": userID, "role": models.RoleOwner})
	var ownerships []models.TenantMembership
	cursor.All(ctx, &ownerships)
	cursor.Close(ctx)

	var ownershipInfo []tenantDeletionInfo
	for _, m := range ownerships {
		var tenant models.Tenant
		h.db.Tenants().FindOne(ctx, bson.M{"_id": m.TenantID}).Decode(&tenant)

		memberCursor, _ := h.db.TenantMemberships().Find(ctx, bson.M{
			"tenantId": m.TenantID,
			"userId":   bson.M{"$ne": userID},
		})
		var otherMemberships []models.TenantMembership
		memberCursor.All(ctx, &otherMemberships)
		memberCursor.Close(ctx)

		var otherMembers []MemberResponse
		for _, om := range otherMemberships {
			var u models.User
			if h.db.Users().FindOne(ctx, bson.M{"_id": om.UserID}).Decode(&u) == nil {
				otherMembers = append(otherMembers, MemberResponse{
					UserID:      u.ID.Hex(),
					Email:       u.Email,
					DisplayName: u.DisplayName,
					Role:        om.Role,
					JoinedAt:    om.JoinedAt,
				})
			}
		}

		ownershipInfo = append(ownershipInfo, tenantDeletionInfo{
			TenantID:     tenant.ID.Hex(),
			TenantName:   tenant.Name,
			IsRoot:       tenant.IsRoot,
			OtherMembers: otherMembers,
		})
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"canDelete":  true,
		"ownerships": ownershipInfo,
	})
}

func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	userID, err := primitive.ObjectIDFromHex(mux.Vars(r)["userId"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	actingUser, _ := middleware.GetUserFromContext(r.Context())
	if actingUser.ID == userID {
		respondWithError(w, http.StatusForbidden, "Cannot delete your own account")
		return
	}

	var user models.User
	if err := h.db.Users().FindOne(r.Context(), bson.M{"_id": userID}).Decode(&user); err != nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	var req struct {
		ReplacementOwners      map[string]string `json:"replacementOwners"`
		ConfirmTenantDeletions []string          `json:"confirmTenantDeletions"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.ReplacementOwners == nil {
		req.ReplacementOwners = map[string]string{}
	}

	ctx := r.Context()

	// Find all memberships
	cursor, _ := h.db.TenantMemberships().Find(ctx, bson.M{"userId": userID})
	var memberships []models.TenantMembership
	cursor.All(ctx, &memberships)
	cursor.Close(ctx)

	// Handle owner memberships
	for _, m := range memberships {
		if m.Role != models.RoleOwner {
			continue
		}

		var tenant models.Tenant
		h.db.Tenants().FindOne(ctx, bson.M{"_id": m.TenantID}).Decode(&tenant)

		if tenant.IsRoot {
			respondWithError(w, http.StatusForbidden, "Cannot delete the root tenant owner. Transfer ownership first via CLI.")
			return
		}

		if replacementStr, ok := req.ReplacementOwners[m.TenantID.Hex()]; ok {
			replacementID, err := primitive.ObjectIDFromHex(replacementStr)
			if err != nil {
				respondWithError(w, http.StatusBadRequest, "Invalid replacement owner ID")
				return
			}
			result, _ := h.db.TenantMemberships().UpdateOne(ctx,
				bson.M{"userId": replacementID, "tenantId": m.TenantID},
				bson.M{"$set": bson.M{"role": models.RoleOwner, "updatedAt": time.Now()}},
			)
			if result.MatchedCount == 0 {
				respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Replacement owner is not a member of tenant '%s'", tenant.Name))
				return
			}
			h.syslog.HighWithUser(ctx,
				fmt.Sprintf("Tenant '%s' ownership transferred to %s (prior owner %s being deleted)", tenant.Name, replacementStr, user.Email),
				actingUser.ID)
		} else {
			otherCount, _ := h.db.TenantMemberships().CountDocuments(ctx, bson.M{
				"tenantId": m.TenantID,
				"userId":   bson.M{"$ne": userID},
			})
			if otherCount > 0 {
				respondWithError(w, http.StatusBadRequest, fmt.Sprintf("User is owner of tenant '%s' which has other members. Provide a replacement owner.", tenant.Name))
				return
			}
			// No other members — confirm tenant deletion
			confirmed := false
			for _, tid := range req.ConfirmTenantDeletions {
				if tid == m.TenantID.Hex() {
					confirmed = true
					break
				}
			}
			if !confirmed {
				respondWithError(w, http.StatusBadRequest, fmt.Sprintf("User is the sole member of tenant '%s'. Confirm tenant deletion.", tenant.Name))
				return
			}
			h.db.TenantMemberships().DeleteMany(ctx, bson.M{"tenantId": m.TenantID})
			h.db.Tenants().DeleteOne(ctx, bson.M{"_id": m.TenantID})
			h.db.Invitations().DeleteMany(ctx, bson.M{"tenantId": m.TenantID})
			h.syslog.HighWithUser(ctx,
				fmt.Sprintf("Tenant '%s' deleted (sole member %s was deleted)", tenant.Name, user.Email),
				actingUser.ID)
		}
	}

	// Delete user's data
	h.db.TenantMemberships().DeleteMany(ctx, bson.M{"userId": userID})
	h.db.RefreshTokens().DeleteMany(ctx, bson.M{"userId": userID})
	h.db.Messages().DeleteMany(ctx, bson.M{"userId": userID})
	h.db.Users().DeleteOne(ctx, bson.M{"_id": userID})

	h.syslog.HighWithUser(ctx,
		fmt.Sprintf("User deleted: %s (%s) (admin action)", user.Email, userID.Hex()),
		actingUser.ID)

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "User deleted"})
}

func (h *AdminHandler) UpdateTenant(w http.ResponseWriter, r *http.Request) {
	tenantID, err := primitive.ObjectIDFromHex(mux.Vars(r)["tenantId"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}

	var req struct {
		Name                *string `json:"name"`
		BillingWaived       *bool   `json:"billingWaived"`
		SubscriptionCredits *int64  `json:"subscriptionCredits"`
		PurchasedCredits    *int64  `json:"purchasedCredits"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var tenant models.Tenant
	if err := h.db.Tenants().FindOne(r.Context(), bson.M{"_id": tenantID}).Decode(&tenant); err != nil {
		respondWithError(w, http.StatusNotFound, "Tenant not found")
		return
	}

	actingUser, _ := middleware.GetUserFromContext(r.Context())
	updates := bson.M{"updatedAt": time.Now()}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			respondWithError(w, http.StatusBadRequest, "Tenant name cannot be empty")
			return
		}
		if name != tenant.Name {
			updates["name"] = name
			h.syslog.LogWithUser(r.Context(), models.LogMedium,
				fmt.Sprintf("Tenant name changed: '%s' -> '%s' (%s, admin action)", tenant.Name, name, tenantID.Hex()),
				actingUser.ID)
		}
	}

	if req.BillingWaived != nil && *req.BillingWaived != tenant.BillingWaived {
		updates["billingWaived"] = *req.BillingWaived
	}

	creditChanged := false
	oldSub := tenant.SubscriptionCredits
	oldPurch := tenant.PurchasedCredits

	if req.SubscriptionCredits != nil && *req.SubscriptionCredits != tenant.SubscriptionCredits {
		updates["subscriptionCredits"] = *req.SubscriptionCredits
		creditChanged = true
	}
	if req.PurchasedCredits != nil && *req.PurchasedCredits != tenant.PurchasedCredits {
		updates["purchasedCredits"] = *req.PurchasedCredits
		creditChanged = true
	}

	if creditChanged {
		newSub := oldSub
		if req.SubscriptionCredits != nil {
			newSub = *req.SubscriptionCredits
		}
		newPurch := oldPurch
		if req.PurchasedCredits != nil {
			newPurch = *req.PurchasedCredits
		}
		h.syslog.HighWithUser(r.Context(),
			fmt.Sprintf("Tenant credits adjusted for '%s' (%s): subscription %d -> %d, purchased %d -> %d (admin action)",
				tenant.Name, tenantID.Hex(), oldSub, newSub, oldPurch, newPurch),
			actingUser.ID)
	}

	h.db.Tenants().UpdateOne(r.Context(), bson.M{"_id": tenantID}, bson.M{"$set": updates})
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Tenant updated"})
}
