package handlers

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"lastsaas/internal/models"
	"lastsaas/internal/testutil"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestIntegration_AdminDashboard(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	env := setupTestServer(t)
	defer env.Cleanup()
	admin, tenant := createAdminEnv(t, env)

	req := env.adminRequest(t, "GET", "/api/admin/dashboard", nil, admin, tenant.ID.Hex())
	resp, err := env.Client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", resp.StatusCode, testutil.ReadResponseBody(t, resp))
	}
}

func TestIntegration_AdminListTenants(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	env := setupTestServer(t)
	defer env.Cleanup()
	admin, tenant := createAdminEnv(t, env)

	for i := 0; i < 3; i++ {
		otherUser := testutil.CreateTestUser(t, env.DB, "tenant"+string(rune('a'+i))+"@test.com", "StrongP@ss1!", "Tenant User")
		testutil.CreateTestTenant(t, env.DB, "Tenant "+string(rune('A'+i)), otherUser.ID, false)
	}

	req := env.adminRequest(t, "GET", "/api/admin/tenants", nil, admin, tenant.ID.Hex())
	resp, err := env.Client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", resp.StatusCode, testutil.ReadResponseBody(t, resp))
	}
}

func TestIntegration_AdminGetTenant(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	env := setupTestServer(t)
	defer env.Cleanup()
	admin, rootTenant := createAdminEnv(t, env)

	req := env.adminRequest(t, "GET", "/api/admin/tenants/"+rootTenant.ID.Hex(), nil, admin, rootTenant.ID.Hex())
	resp, err := env.Client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", resp.StatusCode, testutil.ReadResponseBody(t, resp))
	}
}

func TestIntegration_AdminGetTenantNotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	env := setupTestServer(t)
	defer env.Cleanup()
	admin, tenant := createAdminEnv(t, env)

	fakeID := primitive.NewObjectID().Hex()
	req := env.adminRequest(t, "GET", "/api/admin/tenants/"+fakeID, nil, admin, tenant.ID.Hex())
	resp, err := env.Client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestIntegration_AdminListUsers(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	env := setupTestServer(t)
	defer env.Cleanup()
	admin, tenant := createAdminEnv(t, env)

	testutil.CreateTestUser(t, env.DB, "user1@test.com", "StrongP@ss1!", "User One")
	testutil.CreateTestUser(t, env.DB, "user2@test.com", "StrongP@ss1!", "User Two")

	req := env.adminRequest(t, "GET", "/api/admin/users", nil, admin, tenant.ID.Hex())
	resp, err := env.Client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", resp.StatusCode, testutil.ReadResponseBody(t, resp))
	}
}

func TestIntegration_AdminGetUser(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	env := setupTestServer(t)
	defer env.Cleanup()
	admin, tenant := createAdminEnv(t, env)

	user := testutil.CreateTestUser(t, env.DB, "getuser@test.com", "StrongP@ss1!", "Get User")

	req := env.adminRequest(t, "GET", "/api/admin/users/"+user.ID.Hex(), nil, admin, tenant.ID.Hex())
	resp, err := env.Client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", resp.StatusCode, testutil.ReadResponseBody(t, resp))
	}
}

func TestIntegration_AdminGetUserNotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	env := setupTestServer(t)
	defer env.Cleanup()
	admin, tenant := createAdminEnv(t, env)

	fakeID := primitive.NewObjectID().Hex()
	req := env.adminRequest(t, "GET", "/api/admin/users/"+fakeID, nil, admin, tenant.ID.Hex())
	resp, err := env.Client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestIntegration_AdminUpdateTenantStatus(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	env := setupTestServer(t)
	defer env.Cleanup()
	admin, rootTenant := createAdminEnv(t, env)

	otherUser := testutil.CreateTestUser(t, env.DB, "other@test.com", "StrongP@ss1!", "Other User")
	otherTenant := testutil.CreateTestTenant(t, env.DB, "Other Tenant", otherUser.ID, false)

	body := strings.NewReader(`{"isActive":false}`)
	req := env.adminRequest(t, "PATCH", "/api/admin/tenants/"+otherTenant.ID.Hex()+"/status", body, admin, rootTenant.ID.Hex())
	resp, err := env.Client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", resp.StatusCode, testutil.ReadResponseBody(t, resp))
	}

	var updated models.Tenant
	env.DB.Tenants().FindOne(context.Background(), bson.M{"_id": otherTenant.ID}).Decode(&updated)
	if updated.IsActive {
		t.Error("expected tenant to be deactivated")
	}
}

func TestIntegration_AdminUpdateUserStatus(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	env := setupTestServer(t)
	defer env.Cleanup()
	admin, tenant := createAdminEnv(t, env)

	user := testutil.CreateTestUser(t, env.DB, "deactivate@test.com", "StrongP@ss1!", "Deactivate User")

	body := strings.NewReader(`{"isActive":false}`)
	req := env.adminRequest(t, "PATCH", "/api/admin/users/"+user.ID.Hex()+"/status", body, admin, tenant.ID.Hex())
	resp, err := env.Client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", resp.StatusCode, testutil.ReadResponseBody(t, resp))
	}

	var updated models.User
	env.DB.Users().FindOne(context.Background(), bson.M{"_id": user.ID}).Decode(&updated)
	if updated.IsActive {
		t.Error("expected user to be deactivated")
	}
}

func TestIntegration_AdminRequiresRootTenant(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	env := setupTestServer(t)
	defer env.Cleanup()
	testutil.MarkSystemInitialized(t, env.DB)

	user := testutil.CreateTestUser(t, env.DB, "nonadmin@test.com", "StrongP@ss1!", "Non Admin")
	nonRootTenant := testutil.CreateTestTenant(t, env.DB, "Non Root", user.ID, false)

	req := env.adminRequest(t, "GET", "/api/admin/dashboard", nil, user, nonRootTenant.ID.Hex())
	resp, err := env.Client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403, got %d", resp.StatusCode)
	}
}

func TestIntegration_AdminRequiresAdminRole(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	env := setupTestServer(t)
	defer env.Cleanup()
	testutil.MarkSystemInitialized(t, env.DB)

	owner := testutil.CreateTestUser(t, env.DB, "owner@test.com", "StrongP@ss1!", "Owner")
	rootTenant := testutil.CreateTestTenant(t, env.DB, "Root Tenant", owner.ID, true)

	regularUser := testutil.CreateTestUser(t, env.DB, "regular@test.com", "StrongP@ss1!", "Regular User")
	membership := models.TenantMembership{
		ID:        primitive.NewObjectID(),
		UserID:    regularUser.ID,
		TenantID:  rootTenant.ID,
		Role:      models.RoleUser,
		JoinedAt:  time.Now(),
		UpdatedAt: time.Now(),
	}
	env.DB.TenantMemberships().InsertOne(context.Background(), membership)

	req := env.adminRequest(t, "GET", "/api/admin/dashboard", nil, regularUser, rootTenant.ID.Hex())
	resp, err := env.Client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403, got %d", resp.StatusCode)
	}
}

func TestIntegration_AdminSearchTenants(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	env := setupTestServer(t)
	defer env.Cleanup()
	admin, tenant := createAdminEnv(t, env)

	user := testutil.CreateTestUser(t, env.DB, "search@test.com", "StrongP@ss1!", "Search User")
	testutil.CreateTestTenant(t, env.DB, "Findable Corp", user.ID, false)

	req := env.adminRequest(t, "GET", "/api/admin/tenants?search=Findable", nil, admin, tenant.ID.Hex())
	resp, err := env.Client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", resp.StatusCode, testutil.ReadResponseBody(t, resp))
	}
}

func TestIntegration_AdminSearchUsers(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	env := setupTestServer(t)
	defer env.Cleanup()
	admin, tenant := createAdminEnv(t, env)

	testutil.CreateTestUser(t, env.DB, "findme@test.com", "StrongP@ss1!", "Findme Person")

	req := env.adminRequest(t, "GET", "/api/admin/users?search=findme", nil, admin, tenant.ID.Hex())
	resp, err := env.Client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", resp.StatusCode, testutil.ReadResponseBody(t, resp))
	}
}
