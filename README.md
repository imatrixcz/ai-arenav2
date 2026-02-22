# LastSaaS

A reusable SaaS shell — account management, multi-tenancy, and admin, controllable via both web UI and MCP tools.

## Quick Start

```bash
# 1. Run setup script to generate config
./scripts/setup.sh

# 2. Source environment variables
set -a && source .env && set +a

# 3. Start the backend
cd backend
go run ./cmd/server
```

The server starts on `http://localhost:8080`. On first run with an empty database, the system enters bootstrap mode — only `/api/bootstrap/*` endpoints are accessible until the root tenant is created.

## Configuration

Config files live in `backend/config/`:
- `dev.example.yaml` / `prod.example.yaml` — committed templates
- `dev.yaml` / `prod.yaml` — actual configs (gitignored)

Set `LASTSAAS_ENV=dev` or `LASTSAAS_ENV=prod` to select config. Defaults to `dev`.

Secrets are referenced as `${ENV_VAR}` in YAML and expanded from environment variables at load time.

The `database.name` field is the project identity — two projects sharing the same database name intentionally share the same user base. The `database.uri` points to the MongoDB cluster.

## Architecture

### Tenant Model
- **Root tenant** (`isRoot: true`): exactly one, owns the admin interface
- **Regular tenants**: customers, scoped to their own interfaces
- Users belong to tenants via memberships with roles: `owner`, `admin`, `user`

### Auth
- Email/password (bcrypt, email verification via Resend)
- Google OAuth (account linking)
- JWT access tokens (30min) + refresh tokens (7 days)
- Account lockout after 5 failed login attempts

### API
- Tenant context via `X-Tenant-ID` header
- Role-based middleware gates admin vs customer routes
- Bootstrap guard blocks all routes until system is initialized

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/bootstrap/status | No | Check if system is initialized |
| POST | /api/bootstrap/init | No | First-run setup |
| POST | /api/auth/register | No | Create account |
| POST | /api/auth/login | No | Login |
| POST | /api/auth/refresh | No | Refresh tokens |
| POST | /api/auth/logout | Yes | Logout |
| GET | /api/auth/me | Yes | Get current user + memberships |
| GET | /api/auth/google | No | Start Google OAuth |
| POST | /api/auth/forgot-password | No | Request password reset |
| POST | /api/auth/reset-password | No | Reset password with token |
| GET | /api/tenant/members | Yes+Tenant | List team members |
| POST | /api/tenant/members/invite | Yes+Tenant | Invite member (admin+) |
| DELETE | /api/tenant/members/{id} | Yes+Tenant | Remove member (admin+) |
| PATCH | /api/tenant/members/{id}/role | Yes+Tenant | Change role (owner) |
| GET | /api/admin/tenants | Yes+Root | List all tenants |
| GET | /api/admin/users | Yes+Root | List all users |

## Project Structure

```
backend/
  cmd/server/main.go          — entry point
  internal/
    api/handlers/              — HTTP handlers (auth, bootstrap, admin, tenant)
    auth/                      — JWT, password, Google OAuth
    config/                    — YAML config loader
    db/                        — MongoDB connection + indexes
    email/                     — Resend email service
    events/                    — Event emitter interface (no-op for now)
    middleware/                 — Auth, tenant, RBAC, rate limiting, security
    models/                    — User, Tenant, Membership, Invitation, tokens
```
