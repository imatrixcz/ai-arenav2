package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"lastsaas/internal/auth"
	"lastsaas/internal/db"
	"lastsaas/internal/email"
	"lastsaas/internal/events"
	"lastsaas/internal/middleware"
	"lastsaas/internal/models"
	"lastsaas/internal/syslog"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AuthHandler struct {
	db              *db.MongoDB
	jwtService      *auth.JWTService
	passwordService *auth.PasswordService
	googleOAuth     *auth.GoogleOAuthService
	emailService    *email.ResendService
	events          events.Emitter
	frontendURL     string
	syslog          *syslog.Logger
}

func NewAuthHandler(
	database *db.MongoDB,
	jwtService *auth.JWTService,
	passwordService *auth.PasswordService,
	googleOAuth *auth.GoogleOAuthService,
	emailService *email.ResendService,
	emitter events.Emitter,
	frontendURL string,
	sysLogger *syslog.Logger,
) *AuthHandler {
	return &AuthHandler{
		db:              database,
		jwtService:      jwtService,
		passwordService: passwordService,
		googleOAuth:     googleOAuth,
		emailService:    emailService,
		events:          emitter,
		syslog:          sysLogger,
		frontendURL:     frontendURL,
	}
}

// --- Request/Response types ---

type RegisterRequest struct {
	Email           string `json:"email"`
	Password        string `json:"password"`
	DisplayName     string `json:"displayName"`
	InvitationToken string `json:"invitationToken,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type AuthResponse struct {
	AccessToken  string           `json:"accessToken"`
	RefreshToken string           `json:"refreshToken"`
	User         *models.User     `json:"user"`
	Memberships  []MembershipInfo `json:"memberships"`
}

type MembershipInfo struct {
	TenantID   string            `json:"tenantId"`
	TenantName string            `json:"tenantName"`
	TenantSlug string            `json:"tenantSlug"`
	Role       models.MemberRole `json:"role"`
	IsRoot     bool              `json:"isRoot"`
}

type VerifyEmailRequest struct {
	Token string `json:"token"`
}

type ResendVerificationRequest struct {
	Email string `json:"email"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type AcceptInvitationRequest struct {
	Token string `json:"token"`
}

// --- Handlers ---

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	if req.Email == "" || req.Password == "" || req.DisplayName == "" {
		respondWithError(w, http.StatusBadRequest, "Email, password, and display name are required")
		return
	}

	if err := h.passwordService.ValidatePasswordStrength(req.Password); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Check email uniqueness
	var existing models.User
	if err := h.db.Users().FindOne(r.Context(), bson.M{"email": req.Email}).Decode(&existing); err == nil {
		respondWithError(w, http.StatusConflict, "Unable to create account with these details")
		return
	}

	passwordHash, err := h.passwordService.HashPassword(req.Password)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to process password")
		return
	}

	now := time.Now()
	user := models.User{
		ID:            primitive.NewObjectID(),
		Email:         req.Email,
		DisplayName:   req.DisplayName,
		PasswordHash:  passwordHash,
		AuthMethods:   []models.AuthMethod{models.AuthMethodPassword},
		EmailVerified: false,
		IsActive:      true,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if _, err := h.db.Users().InsertOne(r.Context(), user); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	h.syslog.High(r.Context(), fmt.Sprintf("User created: %s (%s) via registration", user.Email, user.ID.Hex()))

	// Handle invitation or auto-create tenant
	if req.InvitationToken != "" {
		if err := h.acceptInvitationForUser(r.Context(), user.ID, req.InvitationToken); err != nil {
			log.Printf("Failed to accept invitation during registration: %v", err)
			// User is created but invitation failed — they can accept later
		}
	} else {
		// Auto-create a personal tenant
		h.createPersonalTenant(r.Context(), user.ID, user.DisplayName, now)
	}

	// Send verification email
	h.sendVerificationEmail(r.Context(), user.ID, user.Email, user.DisplayName)

	// Generate tokens
	accessToken, err := h.jwtService.GenerateAccessToken(user.ID.Hex(), user.Email, user.DisplayName)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}
	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID.Hex())
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}
	storeRefreshToken(r.Context(), h.db, user.ID, refreshToken, h.jwtService.GetRefreshTTL())

	memberships := h.getUserMemberships(r.Context(), user.ID)

	h.events.Emit(events.Event{
		Type:      events.EventUserRegistered,
		Timestamp: now,
		Data:      map[string]interface{}{"userId": user.ID.Hex()},
	})

	respondWithJSON(w, http.StatusCreated, AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         &user,
		Memberships:  memberships,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Email == "" || req.Password == "" {
		respondWithError(w, http.StatusBadRequest, "Email and password are required")
		return
	}

	var user models.User
	if err := h.db.Users().FindOne(r.Context(), bson.M{"email": req.Email}).Decode(&user); err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	// Check account lockout
	if user.IsLocked() {
		respondWithError(w, http.StatusTooManyRequests, "Account is temporarily locked. Please try again later.")
		return
	}

	if !user.HasAuthMethod(models.AuthMethodPassword) {
		respondWithError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	if err := h.passwordService.ComparePassword(user.PasswordHash, req.Password); err != nil {
		// Increment failed attempts
		update := bson.M{"$inc": bson.M{"failedLoginAttempts": 1}}
		if user.FailedLoginAttempts+1 >= 5 {
			lockUntil := time.Now().Add(15 * time.Minute)
			update["$set"] = bson.M{"accountLockedUntil": lockUntil}
		}
		h.db.Users().UpdateOne(r.Context(), bson.M{"_id": user.ID}, update)
		respondWithError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	if !user.IsActive {
		respondWithError(w, http.StatusUnauthorized, "Account is inactive")
		return
	}

	// Successful login: reset failed attempts
	now := time.Now()
	h.db.Users().UpdateOne(r.Context(), bson.M{"_id": user.ID}, bson.M{
		"$set": bson.M{
			"failedLoginAttempts": 0,
			"accountLockedUntil":  nil,
			"lastLoginAt":         now,
			"updatedAt":           now,
		},
	})

	accessToken, err := h.jwtService.GenerateAccessToken(user.ID.Hex(), user.Email, user.DisplayName)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}
	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID.Hex())
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}
	storeRefreshToken(r.Context(), h.db, user.ID, refreshToken, h.jwtService.GetRefreshTTL())

	memberships := h.getUserMemberships(r.Context(), user.ID)

	h.events.Emit(events.Event{
		Type:      events.EventUserLoggedIn,
		Timestamp: now,
		Data:      map[string]interface{}{"userId": user.ID.Hex()},
	})

	respondWithJSON(w, http.StatusOK, AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         &user,
		Memberships:  memberships,
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	// Revoke the access token
	authHeader := r.Header.Get("Authorization")
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) == 2 {
		tokenHash := hashToken(parts[1])
		h.db.RevokedTokens().InsertOne(r.Context(), models.RevokedToken{
			ID:        primitive.NewObjectID(),
			TokenHash: tokenHash,
			ExpiresAt: time.Now().Add(h.jwtService.GetAccessTTL()),
			CreatedAt: time.Now(),
		})
	}

	// Revoke refresh token if provided
	var req struct {
		RefreshToken string `json:"refreshToken"`
	}
	if json.NewDecoder(r.Body).Decode(&req) == nil && req.RefreshToken != "" {
		tokenHash := hashToken(req.RefreshToken)
		h.db.RefreshTokens().UpdateMany(r.Context(),
			bson.M{"tokenHash": tokenHash},
			bson.M{"$set": bson.M{"isRevoked": true}},
		)
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		respondWithError(w, http.StatusBadRequest, "Refresh token is required")
		return
	}

	claims, err := h.jwtService.ValidateRefreshToken(req.RefreshToken)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid refresh token")
		return
	}

	// Check if refresh token is stored and not revoked
	tokenHash := hashToken(req.RefreshToken)
	var storedToken models.RefreshToken
	err = h.db.RefreshTokens().FindOne(r.Context(), bson.M{
		"tokenHash": tokenHash,
		"isRevoked": false,
	}).Decode(&storedToken)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Refresh token has been revoked")
		return
	}

	// Revoke old refresh token
	h.db.RefreshTokens().UpdateOne(r.Context(),
		bson.M{"_id": storedToken.ID},
		bson.M{"$set": bson.M{"isRevoked": true}},
	)

	userID, err := primitive.ObjectIDFromHex(claims.UserID)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid user ID")
		return
	}

	var user models.User
	if err := h.db.Users().FindOne(r.Context(), bson.M{"_id": userID, "isActive": true}).Decode(&user); err != nil {
		respondWithError(w, http.StatusUnauthorized, "User not found")
		return
	}

	accessToken, err := h.jwtService.GenerateAccessToken(user.ID.Hex(), user.Email, user.DisplayName)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}
	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID.Hex())
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}
	storeRefreshToken(r.Context(), h.db, user.ID, refreshToken, h.jwtService.GetRefreshTTL())

	memberships := h.getUserMemberships(r.Context(), user.ID)

	respondWithJSON(w, http.StatusOK, AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         &user,
		Memberships:  memberships,
	})
}

func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	memberships := h.getUserMemberships(r.Context(), user.ID)

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"user":        user,
		"memberships": memberships,
	})
}

func (h *AuthHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req VerifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Token == "" {
		respondWithError(w, http.StatusBadRequest, "Token is required")
		return
	}

	now := time.Now()

	// Atomically find and mark token as used
	var token models.VerificationToken
	err := h.db.VerificationTokens().FindOneAndUpdate(
		r.Context(),
		bson.M{
			"token":  req.Token,
			"type":   models.TokenTypeEmailVerification,
			"usedAt": nil,
			"expiresAt": bson.M{"$gt": now},
		},
		bson.M{"$set": bson.M{"usedAt": now}},
	).Decode(&token)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid or expired verification token")
		return
	}

	h.db.Users().UpdateOne(r.Context(), bson.M{"_id": token.UserID}, bson.M{
		"$set": bson.M{"emailVerified": true, "updatedAt": now},
	})

	h.events.Emit(events.Event{
		Type:      events.EventUserVerified,
		Timestamp: now,
		Data:      map[string]interface{}{"userId": token.UserID.Hex()},
	})

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Email verified successfully"})
}

func (h *AuthHandler) ResendVerification(w http.ResponseWriter, r *http.Request) {
	var req ResendVerificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" {
		respondWithError(w, http.StatusBadRequest, "Email is required")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	var user models.User
	if err := h.db.Users().FindOne(r.Context(), bson.M{"email": req.Email}).Decode(&user); err != nil {
		// Don't reveal whether email exists
		respondWithJSON(w, http.StatusOK, map[string]string{"message": "If the email exists, a verification link has been sent"})
		return
	}

	if user.EmailVerified {
		respondWithJSON(w, http.StatusOK, map[string]string{"message": "Email is already verified"})
		return
	}

	// Rate limit: check last verification sent
	if user.LastVerificationSent != nil && time.Since(*user.LastVerificationSent) < 60*time.Second {
		respondWithError(w, http.StatusTooManyRequests, "Please wait before requesting another verification email")
		return
	}

	h.sendVerificationEmail(r.Context(), user.ID, user.Email, user.DisplayName)

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "If the email exists, a verification link has been sent"})
}

func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" {
		respondWithError(w, http.StatusBadRequest, "Email is required")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	// Always return success to prevent enumeration
	defer respondWithJSON(w, http.StatusOK, map[string]string{"message": "If the email exists, a password reset link has been sent"})

	var user models.User
	if err := h.db.Users().FindOne(r.Context(), bson.M{"email": req.Email}).Decode(&user); err != nil {
		return
	}

	if !user.HasAuthMethod(models.AuthMethodPassword) {
		return
	}

	resetToken := generateRandomToken()
	verification := models.VerificationToken{
		ID:        primitive.NewObjectID(),
		UserID:    user.ID,
		Token:     resetToken,
		Type:      models.TokenTypePasswordReset,
		ExpiresAt: time.Now().Add(1 * time.Hour),
		CreatedAt: time.Now(),
	}
	h.db.VerificationTokens().InsertOne(r.Context(), verification)

	go func() {
		if h.emailService != nil {
			if err := h.emailService.SendPasswordResetEmail(user.Email, user.DisplayName, resetToken); err != nil {
				log.Printf("Failed to send password reset email: %v", err)
			}
		}
	}()
}

func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Token == "" || req.NewPassword == "" {
		respondWithError(w, http.StatusBadRequest, "Token and new password are required")
		return
	}

	if err := h.passwordService.ValidatePasswordStrength(req.NewPassword); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	now := time.Now()

	// Atomically find and mark token as used
	var token models.VerificationToken
	err := h.db.VerificationTokens().FindOneAndUpdate(
		r.Context(),
		bson.M{
			"token":     req.Token,
			"type":      models.TokenTypePasswordReset,
			"usedAt":    nil,
			"expiresAt": bson.M{"$gt": now},
		},
		bson.M{"$set": bson.M{"usedAt": now}},
	).Decode(&token)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid or expired reset token")
		return
	}

	passwordHash, err := h.passwordService.HashPassword(req.NewPassword)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to process password")
		return
	}

	// Update password
	h.db.Users().UpdateOne(r.Context(), bson.M{"_id": token.UserID}, bson.M{
		"$set": bson.M{
			"passwordHash": passwordHash,
			"updatedAt":    now,
		},
	})

	// Revoke all refresh tokens (log out everywhere)
	h.db.RefreshTokens().UpdateMany(r.Context(),
		bson.M{"userId": token.UserID, "isRevoked": false},
		bson.M{"$set": bson.M{"isRevoked": true}},
	)

	h.syslog.High(r.Context(), fmt.Sprintf("Password reset via token for user %s", token.UserID.Hex()))

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Password reset successfully"})
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.NewPassword == "" {
		respondWithError(w, http.StatusBadRequest, "New password is required")
		return
	}

	if err := h.passwordService.ValidatePasswordStrength(req.NewPassword); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	// If user already has a password, require current password
	if user.HasAuthMethod(models.AuthMethodPassword) {
		if req.CurrentPassword == "" {
			respondWithError(w, http.StatusBadRequest, "Current password is required")
			return
		}
		if err := h.passwordService.ComparePassword(user.PasswordHash, req.CurrentPassword); err != nil {
			respondWithError(w, http.StatusUnauthorized, "Current password is incorrect")
			return
		}
	}

	passwordHash, err := h.passwordService.HashPassword(req.NewPassword)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to process password")
		return
	}

	update := bson.M{
		"$set": bson.M{
			"passwordHash": passwordHash,
			"updatedAt":    time.Now(),
		},
	}
	// Add password auth method if not present
	if !user.HasAuthMethod(models.AuthMethodPassword) {
		update["$addToSet"] = bson.M{"authMethods": models.AuthMethodPassword}
	}

	h.db.Users().UpdateOne(r.Context(), bson.M{"_id": user.ID}, update)

	h.syslog.High(r.Context(), fmt.Sprintf("Password changed by user %s (%s)", user.Email, user.ID.Hex()))

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Password changed successfully"})
}

// --- Google OAuth ---

func (h *AuthHandler) GoogleOAuth(w http.ResponseWriter, r *http.Request) {
	if h.googleOAuth == nil {
		respondWithError(w, http.StatusNotImplemented, "Google OAuth is not configured")
		return
	}

	state := generateRandomToken()
	oauthState := models.OAuthState{
		ID:        primitive.NewObjectID(),
		State:     state,
		ExpiresAt: time.Now().Add(10 * time.Minute),
		CreatedAt: time.Now(),
	}
	h.db.OAuthStates().InsertOne(r.Context(), oauthState)

	authURL := h.googleOAuth.GetAuthURL(state)
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func (h *AuthHandler) GoogleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if h.googleOAuth == nil {
		respondWithError(w, http.StatusNotImplemented, "Google OAuth is not configured")
		return
	}

	state := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")

	if state == "" || code == "" {
		http.Redirect(w, r, h.frontendURL+"/login?error=oauth_failed", http.StatusTemporaryRedirect)
		return
	}

	// Atomically find and delete state to prevent replay
	result := h.db.OAuthStates().FindOneAndDelete(r.Context(), bson.M{
		"state":     state,
		"expiresAt": bson.M{"$gt": time.Now()},
	})
	if result.Err() != nil {
		http.Redirect(w, r, h.frontendURL+"/login?error=invalid_state", http.StatusTemporaryRedirect)
		return
	}

	token, err := h.googleOAuth.ExchangeCode(r.Context(), code)
	if err != nil {
		http.Redirect(w, r, h.frontendURL+"/login?error=oauth_exchange_failed", http.StatusTemporaryRedirect)
		return
	}

	googleUser, err := h.googleOAuth.GetUserInfo(r.Context(), token)
	if err != nil || !googleUser.VerifiedEmail {
		http.Redirect(w, r, h.frontendURL+"/login?error=oauth_user_info_failed", http.StatusTemporaryRedirect)
		return
	}

	now := time.Now()
	var user models.User
	var isNewUser bool

	// Check if user exists by Google ID
	err = h.db.Users().FindOne(r.Context(), bson.M{"googleId": googleUser.ID}).Decode(&user)
	if err != nil {
		// Check by email (account linking)
		err = h.db.Users().FindOne(r.Context(), bson.M{"email": strings.ToLower(googleUser.Email)}).Decode(&user)
		if err != nil {
			// New user
			isNewUser = true
			user = models.User{
				ID:            primitive.NewObjectID(),
				Email:         strings.ToLower(googleUser.Email),
				DisplayName:   googleUser.GivenName,
				GoogleID:      googleUser.ID,
				AuthMethods:   []models.AuthMethod{models.AuthMethodGoogle},
				EmailVerified: true,
				IsActive:      true,
				CreatedAt:     now,
				UpdatedAt:     now,
				LastLoginAt:   &now,
			}
			h.db.Users().InsertOne(r.Context(), user)
			h.createPersonalTenant(r.Context(), user.ID, user.DisplayName, now)
			h.syslog.High(r.Context(), fmt.Sprintf("User created: %s (%s) via Google OAuth", user.Email, user.ID.Hex()))
		} else {
			// Link Google to existing account
			h.db.Users().UpdateOne(r.Context(), bson.M{"_id": user.ID}, bson.M{
				"$set":      bson.M{"googleId": googleUser.ID, "lastLoginAt": now, "updatedAt": now},
				"$addToSet": bson.M{"authMethods": models.AuthMethodGoogle},
			})
		}
	} else {
		// Existing Google user — update login time
		h.db.Users().UpdateOne(r.Context(), bson.M{"_id": user.ID}, bson.M{
			"$set": bson.M{"lastLoginAt": now, "updatedAt": now},
		})
	}

	accessToken, err := h.jwtService.GenerateAccessToken(user.ID.Hex(), user.Email, user.DisplayName)
	if err != nil {
		http.Redirect(w, r, h.frontendURL+"/login?error=token_generation_failed", http.StatusTemporaryRedirect)
		return
	}
	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID.Hex())
	if err != nil {
		http.Redirect(w, r, h.frontendURL+"/login?error=token_generation_failed", http.StatusTemporaryRedirect)
		return
	}
	storeRefreshToken(r.Context(), h.db, user.ID, refreshToken, h.jwtService.GetRefreshTTL())

	if isNewUser {
		h.events.Emit(events.Event{
			Type:      events.EventUserRegistered,
			Timestamp: now,
			Data:      map[string]interface{}{"userId": user.ID.Hex(), "method": "google"},
		})
	}

	// Redirect to frontend with tokens in URL fragment
	redirectURL := fmt.Sprintf("%s/auth/callback#access_token=%s&refresh_token=%s",
		h.frontendURL, accessToken, refreshToken)
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

// --- Accept Invitation (for existing users) ---

func (h *AuthHandler) AcceptInvitation(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req AcceptInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Token == "" {
		respondWithError(w, http.StatusBadRequest, "Invitation token is required")
		return
	}

	if err := h.acceptInvitationForUser(r.Context(), user.ID, req.Token); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	memberships := h.getUserMemberships(r.Context(), user.ID)
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message":     "Invitation accepted",
		"memberships": memberships,
	})
}

// --- Internal helpers ---

func (h *AuthHandler) createPersonalTenant(ctx context.Context, userID primitive.ObjectID, displayName string, now time.Time) {
	slug := fmt.Sprintf("tenant-%s", primitive.NewObjectID().Hex()[:8])
	tenant := models.Tenant{
		ID:        primitive.NewObjectID(),
		Name:      displayName + "'s Team",
		Slug:      slug,
		IsRoot:    false,
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := h.db.Tenants().InsertOne(ctx, tenant); err != nil {
		log.Printf("Failed to create personal tenant for user %s: %v", userID.Hex(), err)
		return
	}

	membership := models.TenantMembership{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		TenantID:  tenant.ID,
		Role:      models.RoleOwner,
		JoinedAt:  now,
		UpdatedAt: now,
	}
	if _, err := h.db.TenantMemberships().InsertOne(ctx, membership); err != nil {
		log.Printf("Failed to create membership for personal tenant: %v", err)
	}

	h.events.Emit(events.Event{
		Type:      events.EventTenantCreated,
		Timestamp: now,
		Data:      map[string]interface{}{"tenantId": tenant.ID.Hex(), "userId": userID.Hex()},
	})
}

func (h *AuthHandler) sendVerificationEmail(ctx context.Context, userID primitive.ObjectID, userEmail, displayName string) {
	verificationToken := generateRandomToken()
	verification := models.VerificationToken{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		Token:     verificationToken,
		Type:      models.TokenTypeEmailVerification,
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
	}
	h.db.VerificationTokens().InsertOne(ctx, verification)

	now := time.Now()
	h.db.Users().UpdateOne(ctx, bson.M{"_id": userID}, bson.M{
		"$set": bson.M{"lastVerificationSent": now},
	})

	go func() {
		if h.emailService != nil {
			if err := h.emailService.SendVerificationEmail(userEmail, displayName, verificationToken); err != nil {
				log.Printf("Failed to send verification email to %s: %v", userEmail, err)
			}
		} else {
			log.Printf("Email service not configured. Verification token for %s: %s", userEmail, verificationToken)
		}
	}()
}

func (h *AuthHandler) getUserMemberships(ctx context.Context, userID primitive.ObjectID) []MembershipInfo {
	cursor, err := h.db.TenantMemberships().Find(ctx, bson.M{"userId": userID})
	if err != nil {
		return nil
	}
	defer cursor.Close(ctx)

	var memberships []models.TenantMembership
	if err := cursor.All(ctx, &memberships); err != nil {
		return nil
	}

	var result []MembershipInfo
	for _, m := range memberships {
		var tenant models.Tenant
		if err := h.db.Tenants().FindOne(ctx, bson.M{"_id": m.TenantID}).Decode(&tenant); err != nil {
			continue
		}
		result = append(result, MembershipInfo{
			TenantID:   tenant.ID.Hex(),
			TenantName: tenant.Name,
			TenantSlug: tenant.Slug,
			Role:       m.Role,
			IsRoot:     tenant.IsRoot,
		})
	}
	return result
}

func (h *AuthHandler) acceptInvitationForUser(ctx context.Context, userID primitive.ObjectID, token string) error {
	now := time.Now()

	var invitation models.Invitation
	err := h.db.Invitations().FindOneAndUpdate(
		ctx,
		bson.M{
			"token":     token,
			"status":    models.InvitationPending,
			"expiresAt": bson.M{"$gt": now},
		},
		bson.M{"$set": bson.M{"status": models.InvitationAccepted}},
	).Decode(&invitation)
	if err != nil {
		return fmt.Errorf("invalid or expired invitation")
	}

	// Check if already a member
	count, _ := h.db.TenantMemberships().CountDocuments(ctx, bson.M{
		"userId":   userID,
		"tenantId": invitation.TenantID,
	})
	if count > 0 {
		return fmt.Errorf("already a member of this tenant")
	}

	membership := models.TenantMembership{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		TenantID:  invitation.TenantID,
		Role:      invitation.Role,
		JoinedAt:  now,
		UpdatedAt: now,
	}
	if _, err := h.db.TenantMemberships().InsertOne(ctx, membership); err != nil {
		return fmt.Errorf("failed to create membership")
	}

	h.events.Emit(events.Event{
		Type:      events.EventMemberJoined,
		Timestamp: now,
		Data: map[string]interface{}{
			"userId":   userID.Hex(),
			"tenantId": invitation.TenantID.Hex(),
			"role":     string(invitation.Role),
		},
	})

	return nil
}

// --- Token utilities ---

func storeRefreshToken(ctx context.Context, database *db.MongoDB, userID primitive.ObjectID, rawToken string, ttl time.Duration) {
	tokenHash := hashToken(rawToken)
	rt := models.RefreshToken{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(ttl),
		CreatedAt: time.Now(),
		IsRevoked: false,
	}
	database.RefreshTokens().InsertOne(ctx, rt)
}

func hashToken(raw string) string {
	hash := sha256.Sum256([]byte(raw))
	return base64.StdEncoding.EncodeToString(hash[:])
}
