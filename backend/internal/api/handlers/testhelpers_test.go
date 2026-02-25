package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"lastsaas/internal/auth"
	"lastsaas/internal/config"
	"lastsaas/internal/configstore"
	"lastsaas/internal/db"
	"lastsaas/internal/events"
	"lastsaas/internal/middleware"
	"lastsaas/internal/models"
	"lastsaas/internal/syslog"
	"lastsaas/internal/testutil"

	"github.com/gorilla/mux"
)

// testEnv holds all services needed for handler integration tests.
type testEnv struct {
	DB              *db.MongoDB
	Config          *config.Config
	JWTService      *auth.JWTService
	PasswordService *auth.PasswordService
	Emitter         events.Emitter
	SysLogger       *syslog.Logger
	ConfigStore     *configstore.Store
	Server          *httptest.Server
	Client          *http.Client
	Cleanup         func()
}

// setupTestServer creates a full test HTTP server with all routes wired up.
func setupTestServer(t *testing.T) *testEnv {
	t.Helper()

	database, dbCleanup := testutil.MustConnectTestDB(t)
	testutil.CleanupCollections(t, database)

	cfg := testutil.TestConfig(t)

	jwtService := auth.NewJWTService(
		cfg.JWT.AccessSecret,
		cfg.JWT.RefreshSecret,
		cfg.JWT.AccessTTLMin,
		cfg.JWT.RefreshTTLDay,
	)
	passwordService := auth.NewTestPasswordService()
	emitter := events.NewNoopEmitter()
	sysLogger := syslog.New(database, nil)
	cfgStore := configstore.New(database)
	cfgStore.Load(context.Background())

	// Handlers
	bootstrapHandler := NewBootstrapHandler(database)
	authHandler := NewAuthHandler(database, jwtService, passwordService, nil, nil, emitter, cfg.Frontend.URL, sysLogger)
	adminHandler := NewAdminHandler(database, emitter, sysLogger)
	adminHandler.SetJWTService(jwtService)
	logHandler := NewLogHandler(database)
	tenantHandler := NewTenantHandler(database, nil, emitter, sysLogger)
	plansHandler := NewPlansHandler(database, sysLogger, cfgStore, nil)
	billingHandler := NewBillingHandler(nil, database, emitter, sysLogger, cfgStore)
	apiKeysHandler := NewAPIKeysHandler(database, emitter, sysLogger)
	webhooksHandler := NewWebhooksHandler(database, sysLogger, nil)

	// Middleware
	authMiddleware := middleware.NewAuthMiddleware(jwtService, database)
	tenantMiddleware := middleware.NewTenantMiddleware(database)

	// Router
	router := mux.NewRouter()
	api := router.PathPrefix("/api").Subrouter()

	api.HandleFunc("/bootstrap/status", bootstrapHandler.Status).Methods("GET")

	guarded := api.PathPrefix("").Subrouter()
	guarded.Use(bootstrapHandler.BootstrapGuard)

	// Public auth routes (no rate limiting in tests)
	guarded.HandleFunc("/auth/register", authHandler.Register).Methods("POST")
	guarded.HandleFunc("/auth/login", authHandler.Login).Methods("POST")
	guarded.HandleFunc("/auth/refresh", authHandler.Refresh).Methods("POST")

	// Protected auth routes
	protectedAuth := guarded.PathPrefix("/auth").Subrouter()
	protectedAuth.Use(authMiddleware.RequireAuth)
	protectedAuth.HandleFunc("/me", authHandler.GetMe).Methods("GET")
	protectedAuth.HandleFunc("/logout", authHandler.Logout).Methods("POST")
	protectedAuth.HandleFunc("/change-password", authHandler.ChangePassword).Methods("POST")
	protectedAuth.HandleFunc("/mfa/setup", authHandler.MFASetup).Methods("POST")
	protectedAuth.HandleFunc("/mfa/verify-setup", authHandler.MFAVerifySetup).Methods("POST")
	protectedAuth.HandleFunc("/mfa/disable", authHandler.MFADisable).Methods("POST")

	// Tenant routes
	tenantAPI := guarded.PathPrefix("/tenant").Subrouter()
	tenantAPI.Use(authMiddleware.RequireAuth)
	tenantAPI.Use(tenantMiddleware.RequireTenant)

	tenantAPI.HandleFunc("/members", tenantHandler.ListMembers).Methods("GET")
	tenantAPI.HandleFunc("/activity", tenantHandler.GetActivity).Methods("GET")

	tenantSettingsRouter := tenantAPI.PathPrefix("/settings").Subrouter()
	tenantSettingsRouter.Use(middleware.RequireRole(models.RoleAdmin))
	tenantSettingsRouter.HandleFunc("", tenantHandler.UpdateTenantSettings).Methods("PATCH")

	inviteRouter := tenantAPI.PathPrefix("/members/invite").Subrouter()
	inviteRouter.Use(middleware.RequireRole(models.RoleAdmin))
	inviteRouter.HandleFunc("", tenantHandler.InviteMember).Methods("POST")

	removeRouter := tenantAPI.PathPrefix("/members/{userId}").Subrouter()
	removeRouter.Use(middleware.RequireRole(models.RoleAdmin))
	removeRouter.HandleFunc("", tenantHandler.RemoveMember).Methods("DELETE")

	ownerRouter := tenantAPI.PathPrefix("/members/{userId}").Subrouter()
	ownerRouter.Use(middleware.RequireRole(models.RoleOwner))
	ownerRouter.HandleFunc("/role", tenantHandler.ChangeRole).Methods("PATCH")
	ownerRouter.HandleFunc("/transfer-ownership", tenantHandler.TransferOwnership).Methods("POST")

	// Billing routes
	billingAPI := guarded.PathPrefix("/billing").Subrouter()
	billingAPI.Use(authMiddleware.RequireAuth)
	billingAPI.Use(tenantMiddleware.RequireTenant)
	billingAPI.HandleFunc("/checkout", billingHandler.Checkout).Methods("POST")
	billingAPI.HandleFunc("/portal", billingHandler.Portal).Methods("POST")
	billingAPI.HandleFunc("/transactions", billingHandler.ListTransactions).Methods("GET")
	billingAPI.HandleFunc("/cancel", billingHandler.CancelSubscription).Methods("POST")
	billingAPI.HandleFunc("/config", billingHandler.GetConfig).Methods("GET")

	// Admin routes
	adminAPI := guarded.PathPrefix("/admin").Subrouter()
	adminAPI.Use(authMiddleware.RequireAuth)
	adminAPI.Use(tenantMiddleware.RequireTenant)
	adminAPI.Use(middleware.RequireRootTenant())
	adminAPI.Use(middleware.RequireRole(models.RoleAdmin))

	adminAPI.HandleFunc("/dashboard", adminHandler.GetDashboard).Methods("GET")
	adminAPI.HandleFunc("/logs", logHandler.ListLogs).Methods("GET")
	adminAPI.HandleFunc("/logs/severity-counts", logHandler.SeverityCounts).Methods("GET")
	adminAPI.HandleFunc("/plans", plansHandler.ListPlans).Methods("GET")
	adminAPI.HandleFunc("/plans/{planId}", plansHandler.GetPlan).Methods("GET")
	adminAPI.HandleFunc("/entitlement-keys", plansHandler.ListEntitlementKeys).Methods("GET")
	adminAPI.HandleFunc("/api-keys", apiKeysHandler.ListAPIKeys).Methods("GET")
	adminAPI.HandleFunc("/api-keys", apiKeysHandler.CreateAPIKey).Methods("POST")
	adminAPI.HandleFunc("/api-keys/{keyId}", apiKeysHandler.DeleteAPIKey).Methods("DELETE")
	adminAPI.HandleFunc("/webhooks", webhooksHandler.ListWebhooks).Methods("GET")
	adminAPI.HandleFunc("/webhooks/event-types", webhooksHandler.ListEventTypes).Methods("GET")
	adminAPI.HandleFunc("/webhooks", webhooksHandler.CreateWebhook).Methods("POST")
	adminAPI.HandleFunc("/webhooks/{webhookId}", webhooksHandler.GetWebhook).Methods("GET")
	adminAPI.HandleFunc("/webhooks/{webhookId}", webhooksHandler.UpdateWebhook).Methods("PUT")
	adminAPI.HandleFunc("/webhooks/{webhookId}", webhooksHandler.DeleteWebhook).Methods("DELETE")
	adminAPI.HandleFunc("/webhooks/{webhookId}/regenerate-secret", webhooksHandler.RegenerateSecret).Methods("POST")
	adminAPI.HandleFunc("/financial/transactions", billingHandler.AdminListTransactions).Methods("GET")
	adminAPI.HandleFunc("/financial/metrics", billingHandler.AdminGetMetrics).Methods("GET")
	adminAPI.HandleFunc("/members", adminHandler.ListRootMembers).Methods("GET")
	adminAPI.HandleFunc("/members/invite", adminHandler.InviteRootMember).Methods("POST")
	adminAPI.HandleFunc("/members/invitations/{invitationId}", adminHandler.CancelRootInvitation).Methods("DELETE")
	adminAPI.HandleFunc("/members/{userId}", adminHandler.RemoveRootMember).Methods("DELETE")

	// Owner-only admin actions
	adminOwner := adminAPI.PathPrefix("").Subrouter()
	adminOwner.Use(middleware.RequireRole(models.RoleOwner))
	adminOwner.HandleFunc("/tenants", adminHandler.ListTenants).Methods("GET")
	adminOwner.HandleFunc("/tenants/{tenantId}", adminHandler.GetTenant).Methods("GET")
	adminOwner.HandleFunc("/tenants/{tenantId}/status", adminHandler.UpdateTenantStatus).Methods("PATCH")
	adminOwner.HandleFunc("/users", adminHandler.ListUsers).Methods("GET")
	adminOwner.HandleFunc("/users/{userId}", adminHandler.GetUser).Methods("GET")
	adminOwner.HandleFunc("/users/{userId}/status", adminHandler.UpdateUserStatus).Methods("PATCH")
	adminOwner.HandleFunc("/plans", plansHandler.CreatePlan).Methods("POST")
	adminOwner.HandleFunc("/plans/{planId}", plansHandler.UpdatePlan).Methods("PUT")
	adminOwner.HandleFunc("/plans/{planId}", plansHandler.DeletePlan).Methods("DELETE")
	adminOwner.HandleFunc("/plans/{planId}/archive", plansHandler.ArchivePlan).Methods("POST")
	adminOwner.HandleFunc("/plans/{planId}/unarchive", plansHandler.UnarchivePlan).Methods("POST")
	adminOwner.HandleFunc("/tenants/{tenantId}/plan", plansHandler.AssignPlan).Methods("PATCH")
	adminOwner.HandleFunc("/members/{userId}/role", adminHandler.ChangeRootMemberRole).Methods("PATCH")

	server := httptest.NewServer(router)

	return &testEnv{
		DB:              database,
		Config:          cfg,
		JWTService:      jwtService,
		PasswordService: passwordService,
		Emitter:         emitter,
		SysLogger:       sysLogger,
		ConfigStore:     cfgStore,
		Server:          server,
		Client:          server.Client(),
		Cleanup: func() {
			server.Close()
			dbCleanup()
		},
	}
}

// authenticatedRequest creates a request with a Bearer token.
func (env *testEnv) authenticatedRequest(t *testing.T, method, path string, body *strings.Reader, user *models.User) *http.Request {
	t.Helper()
	var bodyReader *strings.Reader
	if body != nil {
		bodyReader = body
	} else {
		bodyReader = strings.NewReader("")
	}

	req, err := http.NewRequest(method, env.Server.URL+path, bodyReader)
	if err != nil {
		t.Fatalf("testhelper: failed to create request: %v", err)
	}

	token, err := env.JWTService.GenerateAccessToken(user.ID.Hex(), user.Email, user.DisplayName)
	if err != nil {
		t.Fatalf("testhelper: failed to generate token: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return req
}

// adminRequest creates an authenticated request with admin tenant context.
func (env *testEnv) adminRequest(t *testing.T, method, path string, body *strings.Reader, user *models.User, tenantID string) *http.Request {
	t.Helper()
	req := env.authenticatedRequest(t, method, path, body, user)
	req.Header.Set("X-Tenant-ID", tenantID)
	return req
}

// tenantRequest creates an authenticated request with tenant context (alias for adminRequest).
func (env *testEnv) tenantRequest(t *testing.T, method, path string, body *strings.Reader, user *models.User, tenantID string) *http.Request {
	t.Helper()
	return env.adminRequest(t, method, path, body, user, tenantID)
}

// createAdminEnv creates a fully set up admin user with root tenant.
func createAdminEnv(t *testing.T, env *testEnv) (*models.User, *models.Tenant) {
	t.Helper()
	testutil.MarkSystemInitialized(t, env.DB)
	user := testutil.CreateTestUser(t, env.DB, "admin@test.com", "Test1234!@#$", "Test Admin")
	tenant := testutil.CreateTestTenant(t, env.DB, "Root Tenant", user.ID, true)
	return user, tenant
}
