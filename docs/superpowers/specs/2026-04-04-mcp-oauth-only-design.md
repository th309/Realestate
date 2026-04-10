# MCP Server: OAuth-Only Remote Architecture

**Date:** 2026-04-04
**Status:** Approved
**Goal:** Simplify MCP auth to a single OAuth 2.1 flow for all clients — no API keys, no stdio, no device flow.

## Context

The MCP server currently has two transports (stdio + Streamable HTTP) and two auth paths (API keys + OAuth). This creates divergent behavior: API keys skip entitlement checks, the device flow requires terminal interaction, and two code paths must be maintained. There are no existing users to migrate.

Target audience is non-technical users. The UX bar: "browser opens, log in, click Allow, done."

## Target Clients

| Client          | Transport   | OAuth Support                            |
| --------------- | ----------- | ---------------------------------------- |
| Claude.ai       | Remote HTTP | Full OAuth 2.1 + DCR (working today)     |
| Claude Code     | Remote HTTP | Built-in OAuth 2.1, browser-based flow   |
| Claude Desktop  | Remote HTTP | Emerging support, primarily stdio today  |
| Cursor          | Remote HTTP | OAuth since v1.0, known bugs being fixed |
| ChatGPT MCP     | Remote HTTP | OAuth 2.1 + DCR required                 |
| ChatGPT Actions | OAuth 2.0   | Standard OAuth config in GPT builder     |

Claude Desktop and Cursor have partial remote support — client-side issues being actively resolved. Building remote-only is forward-compatible.

## Architecture

### Single Transport: Streamable HTTP

`src/http.ts` is the only entry point. All clients connect to `https://mcp.propertyiq.app` over HTTPS.

### Single Auth Path: OAuth 2.1

Every client follows the same flow:

```
Client → /.well-known/oauth-authorization-server (discover)
       → /register (DCR, get client_id)
       → /authorize (browser redirect, user logs in + consents)
       → callback with auth code
       → /token (exchange code for access + refresh tokens)
       → Bearer access_token on all subsequent requests
       → Server validates token → checks entitlements → serves tools
```

### Token Lifecycle

- Access tokens: 1 hour, short-lived
- Refresh tokens: 30 days, rotated on use
- Clients auto-refresh — no user intervention after initial auth

### Entitlement Enforcement

- Every request calls `checkEntitlement(userId)` against the backend
- Resource format: `feature:mcp_access` (matching frontend convention)
- Backend returns tier-based access level (`full` / `preview` / `none`)
- 5-minute per-user cache (already implemented)
- No bypass path — denied users get 403 with upgrade link

## ChatGPT Compatibility

### Protected Resource Metadata (new endpoint)

`GET /.well-known/oauth-protected-resource`

```json
{
  "resource": "https://mcp.propertyiq.app/",
  "authorization_servers": ["https://mcp.propertyiq.app"],
  "scopes_supported": ["mcp"]
}
```

ChatGPT fetches this before auth server metadata. One route, ~10 lines.

### ChatGPT Actions

No code changes needed. Users paste existing OAuth URLs into GPT builder:

- Authorization URL: `https://mcp.propertyiq.app/authorize`
- Token URL: `https://mcp.propertyiq.app/token`

### DCR Compatibility

The `/register` endpoint should be permissive about optional fields — store what's provided, don't reject unknown fields. ChatGPT may send different client metadata than Claude.

## Files to Delete

| File              | Reason                                                   |
| ----------------- | -------------------------------------------------------- |
| `src/index.ts`    | Stdio entry point                                        |
| `src/lib/auth.ts` | Device flow, credential file storage, API key resolution |

## Files to Simplify

| File                         | Changes                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `src/lib/session-context.ts` | Remove `api_key` from `SessionAuth` union, drop `getRequestApiKey()` and `apiKeyStore` shims |
| `src/lib/auth-http.ts`       | Remove `piq_live_*` branch, remove deprecated `extractApiKey()`                              |
| `src/lib/api-client.ts`      | Remove API key auth path, always use `x-user-id`                                             |
| `src/lib/config.ts`          | Remove `apiKey` from config                                                                  |
| `package.json`               | Remove `"bin"` entry, remove `open` package dep                                              |

## Files to Add

| File                       | Purpose                                          |
| -------------------------- | ------------------------------------------------ |
| Route in `oauth-routes.ts` | `/.well-known/oauth-protected-resource` endpoint |

## Unchanged

- All MCP tools (`src/tools/*`) — tool layer reads `getSessionAuth()`, doesn't care how auth happened
- OAuth routes and libs (`src/routes/oauth-routes.ts`, `src/lib/oauth/*`)
- HTTP transport (`src/http.ts`)
- Dockerfile, railway.json

## Simplified Types

```typescript
// Before
export type SessionAuth =
  | { type: "api_key"; apiKey: string }
  | { type: "oauth"; userId: string };

// After
export interface SessionAuth {
  userId: string;
}
```

## Auth Flow (auth-http.ts after cleanup)

```typescript
export async function extractAuth(req, res): Promise<SessionAuth | null> {
  // 1. Validate Bearer token
  // 2. Look up OAuth access token → get userId
  // 3. Check entitlement (feature:mcp_access)
  // 4. Return { userId } or send 401/403
}
```
