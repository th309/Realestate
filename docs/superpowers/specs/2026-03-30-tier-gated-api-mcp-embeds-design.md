# Tier-Gated API, MCP, and Embeds Design

**Date:** 2026-03-30
**Status:** Approved
**Scope:** Backend (NestJS), MCP Server, Frontend (activation page + key management)

---

## 1. Overview

Gate platform API access, MCP server usage, and embeddable widgets by subscription tier. Pro users get personal API keys and MCP access. Enterprise users (org members) get org-scoped API keys, MCP access, and embeddable widgets.

### Tier Model

| Feature                                          | Free | Pro          | Enterprise         |
| ------------------------------------------------ | ---- | ------------ | ------------------ |
| Personal API keys (`user_api_keys`)              | No   | Yes          | N/A (use org keys) |
| Org API keys (`organization_api_keys`)           | No   | N/A (no org) | Yes                |
| MCP server access                                | No   | Yes          | Yes                |
| Embeddable widgets (`organization_embed_tokens`) | No   | No           | Yes                |

**Key rules:**

- Organizations only exist at the Enterprise tier. If you're in an org, you're Enterprise.
- Pro users are individual — no org membership.
- If an org owner downgrades, ALL org keys and embed tokens stop working for every member.
- Keys are soft-disabled on downgrade: they remain in the DB but validation rejects them. Re-subscribing restores access without regenerating keys.

---

## 2. Data Model

### New Table: `user_api_keys`

Personal API keys for Pro users. Mirrors `organization_api_keys` but keyed on `user_id`.

```sql
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  rate_limit_rpm INT DEFAULT 60,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_user_api_keys_hash
  ON user_api_keys(key_hash) WHERE is_active = true;

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- Users can manage their own keys
CREATE POLICY "Users can manage own api keys" ON user_api_keys
  FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON user_api_keys TO service_role;
GRANT ALL ON user_api_keys TO authenticated;
```

**Key format:** Same `piq_live_` prefix + 64 hex chars as org keys. SHA-256 hash stored, full key shown once at creation.

### No Changes To

- `organization_api_keys` — untouched
- `organization_embed_tokens` — untouched (tier gating added at validator level only)

---

## 3. Validation Flow

### API Key Validation (`ApiKeyValidatorService.validateKey()`)

Two-table lookup with tier check:

```
piq_live_* key received →
  1. SHA-256 hash the raw key
  2. Look up in organization_api_keys (existing path)
     → Found + is_active + not expired?
       → Query org owner's subscription_tier (cached in Redis, 5-min TTL)
       → tier = 'enterprise'? Return ValidatedApiKey { orgId, scopes, rateLimitRpm, keyId, source: 'org' }
       → tier != 'enterprise'? 403 "Organization owner's subscription does not include API access"
  3. Not found → look up in user_api_keys
     → Found + is_active + not expired?
       → Query user's subscription_tier (cached in Redis, 5-min TTL)
       → tier in ('pro', 'enterprise')? Return ValidatedApiKey { userId, scopes, rateLimitRpm, keyId, source: 'user' }
       → tier = 'free'? 403 "Upgrade to Pro to restore API access"
  4. Not found in either table? 401 "Invalid or revoked API key"
```

### Embed Token Validation (`EmbedTokenValidatorService`)

Add tier check after existing validation (origin, widget type, expiry):

```
emb_* token received →
  Existing validation (origin, widget type, active, expiry) →
  NEW: Look up org owner's subscription_tier
    → tier = 'enterprise'? Allow
    → tier != 'enterprise'? 403 "Embeds require an Enterprise subscription"
```

### Tier Cache

- Redis key: `tier:user:{userId}` or `tier:org-owner:{orgId}`
- TTL: 5 minutes
- Busted when `subscription_tier` changes (Supabase Realtime broadcast already exists for this)

### Soft-Disable Behavior

- On downgrade: tier check fails at validation time. Keys remain in DB with `is_active = true`.
- On re-subscribe: tier check passes immediately (after Redis cache expires, max 5 min).
- No background job needed to revoke/restore keys.

---

## 4. MCP Server Authentication

### Auth Priority Chain

Checked in order on MCP server startup:

1. **Stored credentials** — `~/.propertyiq/credentials.json`
2. **Environment variable** — `PROPERTYIQ_API_KEY` (silent fallback, undocumented)
3. **No credentials** — trigger interactive device flow

### Device Flow

```
MCP server starts with no credentials →
  1. POST https://backend-production-ee4d.up.railway.app/api/auth/device-code
     → Backend generates device_code + user_code (format: ABCD-1234)
     → Stores in Redis with 10-min TTL, status: 'pending'
     → Returns { device_code, user_code, verification_url, expires_in }

  2. MCP server prints:
     "Visit https://propertyiq.up.railway.app/activate and enter code: ABCD-1234"
     Opens browser automatically (best-effort, not required)

  3. User visits /activate, logs in via existing Supabase auth, enters code
     → POST /api/auth/device-code/:code/verify with user's JWT
     → Backend validates user_code, checks subscription_tier >= 'pro'
     → Generates piq_live_* personal API key via UserApiKeysService
     → Marks device_code as 'complete' with the key ID
     → Returns success to frontend

  4. MCP server polls GET /api/auth/device-code/:code every 3 seconds
     → status: 'pending' → keep polling
     → status: 'complete' → receives API key
     → status: 'expired' → print error, exit
     → Writes credentials to ~/.propertyiq/credentials.json

  5. All subsequent MCP requests include: Authorization: Bearer piq_live_*
```

### Credentials File

Location: `~/.propertyiq/credentials.json`

```json
{
  "api_key": "piq_live_abc123...",
  "created_at": "2026-03-30T08:30:00Z",
  "user_email": "user@example.com"
}
```

### Enterprise Users and the Device Flow

When an Enterprise user (org member) authenticates via the device flow, the backend creates a **personal** `user_api_keys` entry — not an org key. This is intentional: the MCP server is a personal tool, and org admins should not need to provision org keys for every member who wants MCP access. The personal key is tier-checked against the user's own tier (which is Enterprise by virtue of org membership). If the org owner downgrades, the user's tier drops and their personal key stops working too.

### Error Handling

| Error                     | MCP Server Behavior                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 401 (invalid/revoked key) | Clear stored credentials, re-trigger device flow                                                                       |
| 403 (tier insufficient)   | Print "Your PropertyIQ subscription does not include API access. Upgrade at https://propertyiq.up.railway.app/pricing" |
| Network error             | Fail with clear message, do not wipe credentials                                                                       |
| Device code expired       | Print error, prompt user to restart                                                                                    |

---

## 5. Backend Services & Endpoints

### New Module: `user-api-keys/`

| File                          | Purpose                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `user-api-keys.service.ts`    | CRUD: list (prefix only), create (return full key once), revoke (soft delete) |
| `user-api-keys.controller.ts` | REST endpoints, JWT auth guard                                                |
| `create-user-api-key.dto.ts`  | Validation: name, scopes, rate_limit_rpm                                      |

**Endpoints:**

| Method | Path                     | Auth | Description                       |
| ------ | ------------------------ | ---- | --------------------------------- |
| GET    | `/api/user/api-keys`     | JWT  | List user's keys (prefix only)    |
| POST   | `/api/user/api-keys`     | JWT  | Create key (tier >= Pro required) |
| DELETE | `/api/user/api-keys/:id` | JWT  | Revoke key (soft delete)          |

### New Module: `device-auth/`

| File                        | Purpose                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `device-auth.service.ts`    | Generate device codes, poll status, provision key on verification |
| `device-auth.controller.ts` | REST endpoints                                                    |

**Endpoints:**

| Method | Path                                 | Auth | Description                            |
| ------ | ------------------------------------ | ---- | -------------------------------------- |
| POST   | `/api/auth/device-code`              | None | Generate device_code + user_code       |
| GET    | `/api/auth/device-code/:code`        | None | Poll status (pending/complete/expired) |
| POST   | `/api/auth/device-code/:code/verify` | JWT  | User verifies code, provisions key     |

**Device code storage:** Redis with 10-minute TTL. Key: `device-auth:{device_code}`. Value: `{ user_code, status, api_key_id? }`.

### Modified Files

| File                               | Change                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `api-key-validator.service.ts`     | Two-table lookup, tier check with Redis cache, return `source: 'org' \| 'user'` |
| `embed-token-validator.service.ts` | Add org owner tier check after existing validation                              |

### No Changes To

| File                        | Reason                                                               |
| --------------------------- | -------------------------------------------------------------------- |
| `org-api-keys/`             | Untouched — Enterprise org key infrastructure stays as-is            |
| `org-embeds/`               | Untouched — embed gating added at validator level only               |
| Platform API v1 controllers | They call `validateKey()` which handles both key types transparently |

---

## 6. Frontend Changes

### New Page: `/activate`

Simple device code activation page:

1. User arrives (from MCP terminal link or manually)
2. If not logged in, redirect to login, then back to `/activate`
3. Enter 8-character code (format: ABCD-1234)
4. On submit: `POST /api/auth/device-code/:code/verify` with JWT
5. Success: "Your MCP server is now connected! You can close this page."
6. Error states: invalid code, expired code, tier insufficient

### Existing Pages: Personal API Key Management

Add to user settings/account page:

- List personal API keys (prefix, name, created date, last used)
- Create new key (name, scopes selection, rate limit)
- Revoke key (confirmation dialog)
- Same UX patterns as existing org API key management

### Data Fetchers

New fetcher: `lib/data/fetchers/user-api-keys.ts`

- `fetchUserApiKeys()` — list keys
- `createUserApiKey(dto)` — create, returns full key once
- `revokeUserApiKey(keyId)` — soft delete

---

## 7. MCP Server Changes

### Modified Files in `packages/mcp-server/`

| File                    | Change                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| `src/lib/config.ts`     | Add `apiKey` resolution: stored credentials → env var → null            |
| `src/lib/api-client.ts` | Add `Authorization: Bearer piq_live_*` header to all requests           |
| `src/lib/auth.ts`       | **New** — device flow: initiate, poll, store/read credentials           |
| `src/index.ts`          | On startup: if no credentials, run device flow before registering tools |

### Auth Module (`src/lib/auth.ts`)

- `getCredentials()` — read `~/.propertyiq/credentials.json`, fall back to env var
- `authenticate()` — run device flow: POST device-code, print instructions, open browser, poll until complete, write credentials
- `clearCredentials()` — delete credentials file (on 401)

---

## 8. Migration

Single migration file: `scripts/migrations/133-user-api-keys-and-device-auth.sql`

Contents:

- `CREATE TABLE user_api_keys` with index and RLS
- GRANTs for `service_role` and `authenticated`

No changes to existing tables. Device auth codes are stored in Redis only (no migration needed).
