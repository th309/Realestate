# MCP OAuth-Only Remote Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the MCP server down to a single transport (Streamable HTTP) and single auth path (OAuth 2.1), removing all stdio, device flow, and API key code.

**Architecture:** All clients connect to `https://mcp.propertyiq.app` over Streamable HTTP. Auth is exclusively OAuth 2.1 with DCR. Every request is entitlement-gated. No local install, no API keys, no credential files.

**Tech Stack:** Express 5, MCP SDK (StreamableHTTPServerTransport), jose (JWT), Supabase (token storage), OAuth 2.1 with PKCE.

**Spec:** `docs/superpowers/specs/2026-04-04-mcp-oauth-only-design.md`

---

## File Map

### Files to Delete

- `packages/mcp-server/src/index.ts` — stdio entry point
- `packages/mcp-server/src/lib/auth.ts` — device flow, credential storage

### Files to Modify

- `packages/mcp-server/src/lib/session-context.ts` — simplify SessionAuth to OAuth-only
- `packages/mcp-server/src/lib/auth-http.ts` — remove API key branch and deprecated extractApiKey
- `packages/mcp-server/src/lib/api-client.ts` — remove API key auth, always use x-user-id
- `packages/mcp-server/src/lib/config.ts` — remove apiKey and resolveApiKey
- `packages/mcp-server/src/http.ts` — remove piq_live references from logging, update discovery response
- `packages/mcp-server/package.json` — remove bin, stdio scripts, unused deps

### Files Unchanged

- `packages/mcp-server/src/server.ts` — tool registration (no auth awareness)
- `packages/mcp-server/src/tools/*` — all 60+ tools (read getSessionAuth, unaffected)
- `packages/mcp-server/src/routes/oauth-routes.ts` — already complete
- `packages/mcp-server/src/lib/oauth/*` — already complete
- `packages/mcp-server/Dockerfile`, `railway.json` — already point to http.ts

---

## Task 1: Simplify SessionAuth Type

**Files:**

- Modify: `packages/mcp-server/src/lib/session-context.ts`

This is the foundational type change — everything else depends on it.

- [ ] **Step 1: Replace session-context.ts with OAuth-only version**

Replace the entire file content with:

```typescript
import { AsyncLocalStorage } from "node:async_hooks";

export interface SessionAuth {
  userId: string;
}

export const authStore = new AsyncLocalStorage<SessionAuth>();

/** Get the current request's auth context */
export function getSessionAuth(): SessionAuth | null {
  return authStore.getStore() ?? null;
}
```

- [ ] **Step 2: Verify no compile errors in this file**

Run: `cd packages/mcp-server && npx tsc --noEmit src/lib/session-context.ts`

Expected: May show errors from downstream files that reference the old type — that's fine, we fix those in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/src/lib/session-context.ts
git commit -m "refactor(mcp): simplify SessionAuth to OAuth-only interface"
```

---

## Task 2: Simplify auth-http.ts to OAuth-Only

**Files:**

- Modify: `packages/mcp-server/src/lib/auth-http.ts`

Remove the API key branch and the deprecated `extractApiKey` function.

- [ ] **Step 1: Replace auth-http.ts with OAuth-only version**

Replace the entire file content with:

```typescript
import type { Request, Response } from "express";
import { lookupAccessToken } from "./oauth/tokens";
import { checkEntitlement } from "./oauth/entitlements-cache";
import type { SessionAuth } from "./session-context";

/**
 * Extract and validate OAuth auth from request.
 * Returns a SessionAuth on success, or null (after sending error response).
 */
export async function extractAuth(
  req: Request,
  res: Response,
): Promise<SessionAuth | null> {
  const auth = req.headers.authorization;
  const headerSnippet = auth ? `Bearer ${auth.slice(7, 15)}...` : "none";
  console.log(`[Auth] extractAuth called | auth_header=${headerSnippet}`);

  if (!auth?.startsWith("Bearer ")) {
    console.log("[Auth] No Bearer token — returning 401");
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Authorization required" },
      id: null,
    });
    return null;
  }

  const token = auth.slice(7);

  try {
    const result = await lookupAccessToken(token);
    if (!result) {
      console.log("[Auth] OAuth token lookup: not_found");
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Invalid or expired access token" },
        id: null,
      });
      return null;
    }
    console.log(`[Auth] OAuth token lookup: found | userId=${result.userId}`);

    const allowed = await checkEntitlement(result.userId);
    if (!allowed) {
      console.log(`[Auth] Entitlement check: denied | userId=${result.userId}`);
      res.status(403).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message:
            "Pro or Enterprise subscription required for MCP access. Visit propertyiq.app/pricing to subscribe.",
        },
        id: null,
      });
      return null;
    }

    console.log(`[Auth] Entitlement check: allowed | userId=${result.userId}`);
    return { userId: result.userId };
  } catch (err) {
    console.log(
      `[Auth] Auth failed with error: ${err instanceof Error ? err.message : String(err)}`,
    );
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Authentication failed" },
      id: null,
    });
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp-server/src/lib/auth-http.ts
git commit -m "refactor(mcp): remove API key auth path from extractAuth"
```

---

## Task 3: Simplify api-client.ts to OAuth-Only

**Files:**

- Modify: `packages/mcp-server/src/lib/api-client.ts`

Remove the API key branch — always use `x-user-id` for backend calls.

- [ ] **Step 1: Replace the auth header logic in api-client.ts**

In `packages/mcp-server/src/lib/api-client.ts`, replace the headers + auth block (lines 31-44):

```typescript
const headers: Record<string, string> = {
  "Content-Type": "application/json",
};

const auth = getSessionAuth();
if (auth) {
  if (auth.type === "api_key") {
    headers["Authorization"] = `Bearer ${auth.apiKey}`;
  } else {
    headers["x-user-id"] = auth.userId;
  }
} else if (config.apiKey) {
  headers["Authorization"] = `Bearer ${config.apiKey}`;
}
```

with:

```typescript
const headers: Record<string, string> = {
  "Content-Type": "application/json",
};

const auth = getSessionAuth();
if (auth) {
  headers["x-user-id"] = auth.userId;
}
```

- [ ] **Step 2: Remove the auth.ts import from api-client.ts**

Remove this line (line 4):

```typescript
import { clearCredentials } from "./auth";
```

- [ ] **Step 3: Remove the 401 handler that calls clearCredentials**

Replace the 401 block (lines 55-60):

```typescript
if (response.status === 401) {
  clearCredentials();
  throw new ApiError(
    401,
    "API key is invalid or revoked. Restart MCP server to re-authenticate.",
  );
}
```

with:

```typescript
if (response.status === 401) {
  throw new ApiError(401, "Access token is invalid or expired.");
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-server/src/lib/api-client.ts
git commit -m "refactor(mcp): remove API key path from api-client"
```

---

## Task 4: Simplify config.ts

**Files:**

- Modify: `packages/mcp-server/src/lib/config.ts`

Remove apiKey and resolveApiKey — no longer needed.

- [ ] **Step 1: Replace config.ts**

Replace the entire file content with:

```typescript
/** PropertyIQ MCP Server Configuration */

export const config = {
  apiUrl:
    process.env.PROPERTYIQ_API_URL ||
    "https://backend-production-ee4d.up.railway.app",
  timeout: 15_000,
  defaultLimit: 25,
  maxLimit: 100,
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp-server/src/lib/config.ts
git commit -m "refactor(mcp): remove apiKey from server config"
```

---

## Task 5: Clean Up http.ts

**Files:**

- Modify: `packages/mcp-server/src/http.ts`

Remove `piq_live` references from logging and update the unauthenticated discovery response.

- [ ] **Step 1: Update the POST /mcp auth type logging**

Replace the auth type detection block (lines 71-76):

```typescript
const authType = authHeader?.startsWith("Bearer piq_live_")
  ? "piq_live"
  : authHeader?.startsWith("Bearer ")
    ? "oauth"
    : "none";
```

with:

```typescript
const authType = authHeader?.startsWith("Bearer ") ? "oauth" : "none";
```

- [ ] **Step 2: Update the GET /mcp discovery probe response**

Replace the discovery response (lines 147-155):

```typescript
res.json({
  jsonrpc: "2.0",
  result: {
    name: "propertyiq",
    version: "0.2.0",
    transport: "streamable-http",
    auth: "Bearer piq_live_*",
  },
  id: null,
});
```

with:

```typescript
res.json({
  jsonrpc: "2.0",
  result: {
    name: "propertyiq",
    version: "0.2.0",
    transport: "streamable-http",
    auth: "oauth2.1",
  },
  id: null,
});
```

- [ ] **Step 3: Update the file header comment**

Replace the header comment (lines 3-10):

```typescript
/**
 * PropertyIQ MCP Server — Remote HTTP Transport
 *
 * Serves the PropertyIQ MCP server over Streamable HTTP so Claude Desktop
 * (and other MCP clients) can connect to it as a remote custom connector.
 *
 * Auth: Dual — piq_live_* API keys (existing) or OAuth 2.1 access tokens (new).
 */
```

with:

```typescript
/**
 * PropertyIQ MCP Server — Remote HTTP Transport
 *
 * Serves the PropertyIQ MCP server over Streamable HTTP.
 * All clients (Claude.ai, Claude Code, Cursor, ChatGPT) connect here.
 *
 * Auth: OAuth 2.1 with PKCE and Dynamic Client Registration.
 */
```

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-server/src/http.ts
git commit -m "refactor(mcp): remove API key references from HTTP transport"
```

---

## Task 6: Delete Stdio Entry Point and Device Flow

**Files:**

- Delete: `packages/mcp-server/src/index.ts`
- Delete: `packages/mcp-server/src/lib/auth.ts`

- [ ] **Step 1: Delete the stdio entry point**

```bash
rm packages/mcp-server/src/index.ts
```

- [ ] **Step 2: Delete the device flow auth module**

```bash
rm packages/mcp-server/src/lib/auth.ts
```

- [ ] **Step 3: Commit**

```bash
git add -A packages/mcp-server/src/index.ts packages/mcp-server/src/lib/auth.ts
git commit -m "refactor(mcp): remove stdio transport and device flow auth"
```

---

## Task 7: Update package.json

**Files:**

- Modify: `packages/mcp-server/package.json`

Remove the `bin` entry, stdio scripts, and update `main` to point to the HTTP entry.

- [ ] **Step 1: Update package.json**

Make these changes:

1. Change `"main"` from `"dist/index.js"` to `"dist/http.js"`

2. Remove the entire `"bin"` block:

```json
  "bin": {
    "propertyiq-mcp": "./dist/index.js"
  },
```

3. Replace `"scripts"` with:

```json
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/http.ts",
    "start": "node dist/http.js"
  },
```

This removes `dev:http` (redundant, `dev` now points to http), `start:stdio` (deleted).

- [ ] **Step 2: Verify build succeeds**

```bash
cd packages/mcp-server && npm run build
```

Expected: Clean compilation, no errors. `dist/http.js` is the entry point. No `dist/index.js` needed.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/package.json
git commit -m "refactor(mcp): update package.json for OAuth-only HTTP server"
```

---

## Task 8: Full Build + Smoke Test

Verify the entire server compiles and starts without errors.

- [ ] **Step 1: Clean build**

```bash
cd packages/mcp-server && rm -rf dist && npm run build
```

Expected: Clean compilation with zero errors. If there are errors, they indicate a missed reference to deleted code — fix before proceeding.

- [ ] **Step 2: Grep for dead references**

```bash
cd packages/mcp-server && grep -rn "piq_live\|getRequestApiKey\|apiKeyStore\|clearCredentials\|resolveApiKey\|getApiKey\|authenticate\|device.flow\|StdioServerTransport" src/
```

Expected: Zero matches. Any match means a reference to deleted code was missed.

- [ ] **Step 3: Verify OAuth discovery endpoints respond**

```bash
curl --ssl-no-revoke https://localhost:8080/.well-known/oauth-authorization-server 2>/dev/null || echo "Server not running locally — this will be tested after deploy"
```

Note: Local test only works if you have the env vars set. Skip if not — the E2E tests in Tasks 9-10 cover this against production.

- [ ] **Step 4: Commit (if any fixes were needed)**

```bash
git add -A packages/mcp-server/
git commit -m "fix(mcp): resolve remaining dead references from auth cleanup"
```

---

## Task 9: Deploy and E2E Test — Claude.ai

**Files:** None (deployment + manual testing)

Deploy to production and verify the full OAuth flow works end-to-end with Claude.ai.

- [ ] **Step 1: Push to main and trigger Railway deploy**

```bash
git checkout main && git merge develop --no-edit && git push origin main && git checkout develop
```

- [ ] **Step 2: Wait for Railway deployment to succeed**

Check deployment status:

```bash
# Use Railway MCP tool: list-deployments for mcp-server service
# Expected: latest deployment status = SUCCESS
```

- [ ] **Step 3: Verify OAuth discovery endpoints**

```bash
curl --ssl-no-revoke -s https://mcp.propertyiq.app/.well-known/oauth-authorization-server | python -m json.tool
```

Expected response:

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

```bash
curl --ssl-no-revoke -s https://mcp.propertyiq.app/.well-known/oauth-protected-resource | python -m json.tool
```

Expected response:

```json
{
  "resource": "https://mcp.propertyiq.app",
  "authorization_servers": ["https://mcp.propertyiq.app"],
  "bearer_methods_supported": ["header"]
}
```

- [ ] **Step 4: Verify API key auth is rejected**

```bash
curl --ssl-no-revoke -s -X POST https://mcp.propertyiq.app/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer piq_live_test123" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

Expected: `401` response with `"Invalid or expired access token"` (API keys are no longer recognized as valid OAuth tokens).

- [ ] **Step 5: E2E test Claude.ai connection with live data**

1. Go to https://claude.ai
2. Open Settings → Connectors (or MCP Servers)
3. If `mcp.propertyiq.app` is already connected, disconnect it first (to clear cached tokens)
4. Add new MCP server: `https://mcp.propertyiq.app`
5. Browser popup opens → log in to PropertyIQ → click Allow
6. Connection should succeed — Claude.ai shows the PropertyIQ tools
7. Test with a live data query: ask Claude "What's the PropertyIQ score for Austin, TX?"
8. Verify Claude calls a PropertyIQ tool and returns real market data

Expected: Full flow completes, live data is returned.

- [ ] **Step 6: Check server logs for clean OAuth flow**

```bash
# Use Railway MCP tool: get-logs for mcp-server service, filter for recent OAuth entries
# Expected log sequence:
# [OAuth] GET /.well-known/oauth-authorization-server
# [OAuth] POST /register
# [OAuth] GET /authorize
# [OAuth] GET /oauth/callback
# [OAuth] POST /token
# [Auth] extractAuth called | auth_header=Bearer ...
# [Auth] OAuth token lookup: found
# [Auth] Entitlement check: allowed
# [MCP] New session created: ...
```

No `[Auth] API key auth: piq_live_***` entries should appear.

- [ ] **Step 7: Commit test results**

Document the test result in todo.md or as a commit message:

```bash
git commit --allow-empty -m "test(mcp): verified Claude.ai OAuth E2E — connection + live data query successful"
```

---

## Task 10: E2E Test — ChatGPT

**Files:** None (manual testing)

Verify the MCP server works with ChatGPT's MCP connector.

- [ ] **Step 1: Test ChatGPT MCP connector**

1. Go to https://chatgpt.com
2. Open Settings → Connected Apps (or MCP Connectors, depending on UI)
3. Add a new MCP server: `https://mcp.propertyiq.app`
4. ChatGPT will:
   - Fetch `/.well-known/oauth-protected-resource`
   - Fetch `/.well-known/oauth-authorization-server`
   - Register via DCR at `/register`
   - Open browser popup for OAuth consent
5. Log in to PropertyIQ → click Allow
6. Connection should succeed — ChatGPT shows PropertyIQ tools

- [ ] **Step 2: Test live data query through ChatGPT**

Ask ChatGPT: "Use PropertyIQ to get the market snapshot for Denver, CO"

Expected: ChatGPT calls a PropertyIQ MCP tool and returns real market data.

- [ ] **Step 3: Check server logs for ChatGPT flow**

```bash
# Use Railway MCP tool: get-logs for mcp-server service
# Look for ChatGPT-specific client registration (client_name will differ from Claude)
# Expected: same OAuth flow as Claude, different client_id
```

- [ ] **Step 4: If ChatGPT MCP connector is not yet available, test via ChatGPT Actions**

If ChatGPT's MCP connector doesn't support your server yet, test via Custom GPT Actions:

1. Go to https://chatgpt.com → Create a GPT
2. Add an Action with:
   - Authentication: OAuth
   - Auth URL: `https://mcp.propertyiq.app/authorize`
   - Token URL: `https://mcp.propertyiq.app/token`
   - Client ID: (register one via curl)
     ```bash
     curl --ssl-no-revoke -s -X POST https://mcp.propertyiq.app/register \
       -H "Content-Type: application/json" \
       -d '{"client_name":"ChatGPT Test","redirect_uris":["https://chat.openai.com/aip/g-<gpt-id>/oauth/callback"],"grant_types":["authorization_code"],"response_types":["code"]}'
     ```
   - Scope: `mcp`
3. Test the GPT with a market data question
4. Verify OAuth popup appears, consent works, data returns

- [ ] **Step 5: Document results**

```bash
git commit --allow-empty -m "test(mcp): verified ChatGPT OAuth E2E — connection + live data query successful"
```

---

## Task 11: Final Cleanup and Squash Commit

- [ ] **Step 1: Verify no dead code remains**

```bash
cd packages/mcp-server && grep -rn "piq_live\|api_key\|apiKey\|getRequestApiKey\|apiKeyStore\|clearCredentials\|resolveApiKey\|getApiKey\|authenticate\|device.flow\|StdioServerTransport\|start:stdio\|dev:http" src/ package.json
```

Expected: Zero matches.

- [ ] **Step 2: Verify build is clean**

```bash
cd packages/mcp-server && rm -rf dist && npm run build
```

Expected: Zero errors, zero warnings.

- [ ] **Step 3: Push final state to develop and main**

```bash
git push origin develop
git checkout main && git merge develop --no-edit && git push origin main && git checkout develop
```
