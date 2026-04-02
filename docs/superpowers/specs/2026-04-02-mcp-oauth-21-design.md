# MCP OAuth 2.1 Implementation Design

**Date:** 2026-04-02
**Status:** Approved
**Scope:** Add OAuth 2.1 to the PropertyIQ MCP server so claude.ai web connectors can authenticate

## Problem

claude.ai web connectors only support OAuth 2.1 for MCP server authentication. There is no field for static Bearer tokens. When claude.ai tries to connect, it POSTs to `/mcp` without a token, gets a 401, and shows "Couldn't reach the MCP server." OAuth 2.1 is required per the MCP spec for browser-based clients.

## Approach

Self-contained OAuth 2.1 server built into the existing MCP Express app (`packages/mcp-server/src/http.ts`). No separate microservice. Login UI redirects to the PropertyIQ frontend. Dual auth supports both OAuth (claude.ai web) and Bearer API keys (Claude Code, Cursor, Windsurf, Cline, VS Code Copilot).

## Design Decisions

| Decision              | Choice                                | Rationale                                                    |
| --------------------- | ------------------------------------- | ------------------------------------------------------------ |
| OAuth server location | Built into MCP Express app            | Simpler deployment, shared session store                     |
| Login UI              | Redirect to PropertyIQ frontend       | Reuses existing Supabase Auth (password, magic link, Google) |
| Subscription gating   | Check entitlements on every tool call | Catches downgrades within 5 minutes                          |
| State storage         | Supabase tables                       | Consistent with platform, durable, queryable                 |
| Domain                | `mcp.propertyiq.app`                  | Professional, stable URL decoupled from Railway              |
| Dual auth             | OAuth + Bearer API keys coexist       | Non-breaking for existing integrations                       |

---

## 1. OAuth Endpoints

All endpoints added to `packages/mcp-server/src/http.ts`.

| Endpoint                                  | Method | Purpose                                          | Auth       |
| ----------------------------------------- | ------ | ------------------------------------------------ | ---------- |
| `/.well-known/oauth-protected-resource`   | GET    | RFC 9728 — points to auth server                 | None       |
| `/.well-known/oauth-authorization-server` | GET    | RFC 8414 — OAuth capabilities                    | None       |
| `/register`                               | POST   | RFC 7591 — dynamic client registration           | None       |
| `/authorize`                              | GET    | Starts authorization flow                        | None       |
| `/token`                                  | POST   | Code exchange + refresh token                    | None       |
| `/oauth/callback`                         | GET    | Internal — frontend redirects here after consent | Signed JWT |

### Discovery: Protected Resource Metadata

```json
{
  "resource": "https://mcp.propertyiq.app",
  "authorization_servers": ["https://mcp.propertyiq.app"],
  "bearer_methods_supported": ["header"]
}
```

### Discovery: Authorization Server Metadata

```json
{
  "issuer": "https://mcp.propertyiq.app",
  "authorization_endpoint": "https://mcp.propertyiq.app/authorize",
  "token_endpoint": "https://mcp.propertyiq.app/token",
  "registration_endpoint": "https://mcp.propertyiq.app/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"]
}
```

`token_endpoint_auth_methods_supported: ["none"]` because claude.ai is a public client (no client secret). PKCE replaces secret-based auth.

### Known claude.ai Bug

claude.ai hardcodes `/authorize`, `/token`, `/register` at the domain root regardless of metadata URLs. Our endpoints already use these paths, so no workaround needed.

---

## 2. Database Schema

Three new Supabase tables. Server-only access via `sb_secret_*` key. RLS enabled with no `authenticated` policies.

### `mcp_oauth_clients`

| Column           | Type          | Notes                                     |
| ---------------- | ------------- | ----------------------------------------- |
| `id`             | uuid (PK)     | Auto-generated                            |
| `client_id`      | text (unique) | Returned at registration                  |
| `client_name`    | text          | e.g. "Claude"                             |
| `redirect_uris`  | text[]        | Validated during authorize                |
| `grant_types`    | text[]        | `["authorization_code", "refresh_token"]` |
| `response_types` | text[]        | `["code"]`                                |
| `created_at`     | timestamptz   | Default `now()`                           |

No `client_secret` column — public clients only.

### `mcp_oauth_codes`

| Column           | Type                   | Notes                  |
| ---------------- | ---------------------- | ---------------------- |
| `id`             | uuid (PK)              | Auto-generated         |
| `code`           | text (unique, indexed) | Random 48-byte hex     |
| `client_id`      | text (FK)              |                        |
| `user_id`        | uuid                   | Supabase Auth user ID  |
| `redirect_uri`   | text                   | Must match on exchange |
| `code_challenge` | text                   | PKCE S256              |
| `scope`          | text                   | `"mcp"`                |
| `expires_at`     | timestamptz            | `now() + 10 min`       |
| `used`           | boolean                | Prevents replay        |

### `mcp_oauth_tokens`

| Column               | Type                   | Notes                           |
| -------------------- | ---------------------- | ------------------------------- |
| `id`                 | uuid (PK)              | Auto-generated                  |
| `access_token`       | text (unique, indexed) | Random 48-byte hex              |
| `refresh_token`      | text (unique, indexed) | Random 48-byte hex              |
| `client_id`          | text (FK)              |                                 |
| `user_id`            | uuid                   | Supabase Auth user ID           |
| `scope`              | text                   | `"mcp"`                         |
| `access_expires_at`  | timestamptz            | `now() + 1 hour`                |
| `refresh_expires_at` | timestamptz            | `now() + 30 days`               |
| `revoked`            | boolean                | For logout/subscription changes |
| `created_at`         | timestamptz            |                                 |

### Permissions

```sql
GRANT ALL ON mcp_oauth_clients TO service_role;
GRANT ALL ON mcp_oauth_codes TO service_role;
GRANT ALL ON mcp_oauth_tokens TO service_role;
```

### Cleanup (pg_cron)

Daily job deletes expired codes and fully-expired tokens:

```sql
DELETE FROM mcp_oauth_codes WHERE expires_at < now();
DELETE FROM mcp_oauth_tokens WHERE access_expires_at < now() AND refresh_expires_at < now();
```

---

## 3. Authorization Flow

### Sequence

1. **claude.ai → GET `/authorize`** with `client_id`, `redirect_uri`, `code_challenge`, `code_challenge_method=S256`, `state`
2. **MCP server validates** params: client exists, redirect_uri matches registration, method is S256
3. **MCP server packs** all OAuth params into a signed JWT (`mcp_session`, 10-min TTL, signed with `MCP_OAUTH_JWT_SECRET`)
4. **302 redirect** to `https://propertyiq.app/auth/mcp-authorize?mcp_session=<jwt>`
5. **Frontend consent page** checks Supabase Auth session (redirects to sign-in if needed), shows consent screen
6. **User clicks Allow** → frontend redirects to MCP server `GET /oauth/callback?mcp_session=<jwt>&token=<supabase_access_token>`
7. **MCP server verifies** JWT signature, validates Supabase token via `supabase.auth.getUser(token)` to get `user_id`, generates auth code, stores in `mcp_oauth_codes`
8. **302 redirect** to `redirect_uri` (claude.ai callback) with `code` and `state`
9. **claude.ai → POST `/token`** with `grant_type=authorization_code`, `code`, `code_verifier`, `redirect_uri`
10. **MCP server verifies** code exists, not expired, not used, redirect_uri matches, PKCE verifier hashes to stored challenge. Creates tokens in `mcp_oauth_tokens`. Returns `access_token`, `refresh_token`, `expires_in: 3600`

### The `mcp_session` JWT

Internal token carrying OAuth params across the redirect:

```json
{
  "client_id": "abc123",
  "redirect_uri": "https://claude.ai/api/mcp/auth_callback",
  "code_challenge": "...",
  "code_challenge_method": "S256",
  "state": "...",
  "exp": "<10 minutes from now>"
}
```

Signed with `MCP_OAUTH_JWT_SECRET` (env var, random 64-byte hex). Prevents parameter tampering during frontend redirect.

### Frontend Consent Page

New route: `packages/frontend/app/auth/mcp-authorize/page.tsx`

- Checks Supabase Auth session; if not logged in, redirects to `/auth/sign-in?redirect=/auth/mcp-authorize?mcp_session=...`
- Displays: "Claude wants to access your PropertyIQ account. This will allow Claude to use PropertyIQ market analytics tools on your behalf."
- Shows user's name/email
- **Allow** button redirects to MCP server `GET /oauth/callback?mcp_session=<jwt>&token=<supabase_access_token>`
- **Deny** button redirects to MCP server `GET /oauth/callback?mcp_session=<jwt>&error=access_denied`

---

## 4. Dual Auth Middleware

Modified `packages/mcp-server/src/lib/auth-http.ts` to accept both token types.

### Decision Tree

```
Authorization: Bearer <token>
  ├─ starts with "piq_live_" → API key path (existing behavior, return key)
  ├─ other Bearer token → OAuth path
  │   ├─ look up in mcp_oauth_tokens
  │   ├─ check not expired, not revoked
  │   ├─ extract user_id
  │   ├─ check entitlements (cached)
  │   ├─ if not Pro/Enterprise → 403
  │   └─ return { type: "oauth", userId }
  └─ missing/malformed → 401
```

### Session Context

`session-context.ts` changes from `AsyncLocalStorage<string>` to:

```typescript
type SessionAuth =
  | { type: "api_key"; apiKey: string }
  | { type: "oauth"; userId: string };

export const authStore = new AsyncLocalStorage<SessionAuth>();
```

`api-client.ts` adapts outbound requests:

- **API key**: `Authorization: Bearer piq_live_...` (current behavior)
- **OAuth**: `x-user-id: <uuid>` header

### Entitlement Cache

In-memory `Map<userId, { allowed: boolean; checkedAt: number }>` with 5-minute TTL. On miss/expiry, calls backend `GET /api/entitlements/check?resources=mcp_access` with `x-user-id` header.

### HTTP Status Codes

| Scenario                        | Status |
| ------------------------------- | ------ |
| No Authorization header         | 401    |
| Invalid/expired OAuth token     | 401    |
| Valid auth, no Pro subscription | 403    |
| Valid auth, valid subscription  | 200    |

401 tells claude.ai to re-authenticate (triggers OAuth). 403 means auth succeeded but access denied.

### Subscription Lapse Handling

Tokens are NOT revoked on downgrade. Entitlement cache expires within 5 minutes. Next tool call returns 403 with message: "Your PropertyIQ Pro subscription is required for MCP access. Visit propertyiq.app/pricing to resubscribe." If user re-subscribes, tools work again immediately.

---

## 5. Custom Domain & Migration

### DNS

| Record | Name                 | Value                                       |
| ------ | -------------------- | ------------------------------------------- |
| CNAME  | `mcp.propertyiq.app` | `mcp-server-production-2632.up.railway.app` |

Railway handles TLS automatically.

### URL Migration

`MCP_SERVER_URL` in `mcp-docs-data.ts` changes from `https://mcp-server-production-2632.up.railway.app/mcp` to `https://mcp.propertyiq.app/mcp`. All doc examples updated. Railway URL continues to work for existing users.

### New Environment Variables (Railway)

| Variable                    | Purpose                                     |
| --------------------------- | ------------------------------------------- |
| `MCP_OAUTH_JWT_SECRET`      | Signs mcp_session JWTs (random 64-byte hex) |
| `SUPABASE_URL`              | For OAuth table access                      |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_*` key                           |
| `MCP_BASE_URL`              | `https://mcp.propertyiq.app`                |

### New Dependencies

| Package                 | Purpose                          |
| ----------------------- | -------------------------------- |
| `jose`                  | JWT signing/verification         |
| `@supabase/supabase-js` | Database access for OAuth tables |

---

## 6. File Changes Summary

### Modified Files

| File                                                               | Change                                      |
| ------------------------------------------------------------------ | ------------------------------------------- |
| `packages/mcp-server/src/http.ts`                                  | Add 5 OAuth endpoints + 2 well-known routes |
| `packages/mcp-server/src/lib/auth-http.ts`                         | Dual auth (OAuth + API keys)                |
| `packages/mcp-server/src/lib/session-context.ts`                   | `SessionAuth` union type                    |
| `packages/mcp-server/src/lib/api-client.ts`                        | Handle both auth types                      |
| `packages/mcp-server/package.json`                                 | Add `jose`, `@supabase/supabase-js`         |
| `packages/frontend/app/docs/mcp/components/mcp-docs-data.ts`       | Update `MCP_SERVER_URL`                     |
| `packages/frontend/app/docs/mcp/components/ClientSetupDetails.tsx` | Update tool count if needed                 |

### New Files

| File                                                      | Purpose                              |
| --------------------------------------------------------- | ------------------------------------ |
| `packages/mcp-server/src/lib/oauth/clients.ts`            | Dynamic client registration logic    |
| `packages/mcp-server/src/lib/oauth/codes.ts`              | Auth code generation and validation  |
| `packages/mcp-server/src/lib/oauth/tokens.ts`             | Token creation, lookup, refresh      |
| `packages/mcp-server/src/lib/oauth/metadata.ts`           | Discovery endpoint response builders |
| `packages/mcp-server/src/lib/oauth/entitlements-cache.ts` | In-memory entitlement cache          |
| `packages/frontend/app/auth/mcp-authorize/page.tsx`       | Consent screen                       |
| `scripts/migrations/133-mcp-oauth-tables.sql`             | Database migration                   |

### Unchanged

- `packages/mcp-server/src/server.ts` — tool registration untouched
- `packages/mcp-server/src/tools/*` — all 44 tools untouched
- `packages/mcp-server/src/index.ts` — stdio transport unchanged
- All existing `piq_live_*` API key flows — fully preserved
- All existing client configs (Claude Desktop, Cursor, Windsurf, Cline, VS Code) — still work
