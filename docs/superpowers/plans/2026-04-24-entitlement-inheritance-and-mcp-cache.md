# Entitlement Inheritance + MCP Cache Invalidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Enterprise org members inherit `feature:mcp_access` from their org, and make the mcp-server's in-memory entitlement cache reflect upgrades/downgrades within 30 s (best-effort instantly via an invalidation endpoint wired to backend mutation sites).

**Architecture:** Read-through entitlements resolver — no write-through to member profiles. Backend entitlements service computes effective tier on each uncached call by reading `user_profiles` + `organization_members` + new `organizations.tier` column. mcp-server keeps its per-user cache but with split TTLs (5 min positive / 30 s negative) and a shared-secret `/internal/entitlements/invalidate` endpoint that backend webhooks and service methods call on every tier-affecting mutation.

**Tech Stack:** NestJS 11 (backend), Express 5 + `@modelcontextprotocol/sdk` (mcp-server), Supabase PostgreSQL, Jest (backend), vitest (mcp-server — added in Task 2.1), Redis (existing backend entitlements cache, unchanged).

**Source of truth for design decisions:** `docs/superpowers/specs/2026-04-24-entitlement-inheritance-and-mcp-cache-design.md`

---

## File Structure

**Migration (new):**

- `scripts/migrations/<next>-add-organizations-tier.sql` — adds `tier` column to `organizations`.

**mcp-server (modified or new):**

- `packages/mcp-server/package.json` — add `vitest` devDep + `test` script.
- `packages/mcp-server/src/lib/oauth/entitlements-cache.ts` — split TTL; add `invalidateMany`.
- `packages/mcp-server/src/lib/oauth/entitlements-cache.test.ts` — NEW, unit tests.
- `packages/mcp-server/src/routes/internal-routes.ts` — NEW, mounts the `/internal/entitlements/invalidate` route.
- `packages/mcp-server/src/http.ts` — call the new `mountInternalRoutes(app)` helper.

**Backend (modified or new):**

- `packages/backend/src/entitlements/entitlements.service.ts` — resolver change (add org-tier lookup + precedence).
- `packages/backend/src/entitlements/entitlements.service.spec.ts` — NEW (or extend if exists), P2-Y tier precedence tests.
- `packages/backend/src/entitlements/mcp-entitlements-invalidator.service.ts` — NEW.
- `packages/backend/src/entitlements/mcp-entitlements-invalidator.service.spec.ts` — NEW.
- `packages/backend/src/entitlements/entitlements.module.ts` — register invalidator + export.
- `packages/backend/src/organizations/organizations.service.ts` — set `tier: 'enterprise'` on create.
- `packages/backend/src/organizations/invites.service.ts` — invalidate on accept.
- `packages/backend/src/organizations/members.service.ts` — invalidate on remove.
- `packages/backend/src/organizations/organizations.module.ts` — import `EntitlementsModule` so invalidator is injectable.
- `packages/backend/src/billing/billing-webhook.service.ts` — 4 call-site edits (no `handleInvoicePaid` on this class).
- `packages/backend/src/billing/billing.module.ts` — import `EntitlementsModule`.
- `packages/backend/src/org-billing/org-billing-webhook.service.ts` — 5 call-site edits.
- `packages/backend/src/org-billing/org-billing.module.ts` — import `EntitlementsModule`.
- `packages/backend/src/org-billing/org-downgrade-handler.service.ts` — remove `subscription_tier` writes for members and owner.

**Env vars (Railway, both prod and dev):**

- `MCP_INTERNAL_SECRET` on `mcp-server` and `backend` services — same value per environment.
- `MCP_SERVER_URL` on `backend` (optional; defaults to `https://mcp.propertyiq.app`).

---

## Phase 1 — Database Migration

### Task 1.1: Add `organizations.tier` column

**Files:**

- Create: `scripts/migrations/<next>-add-organizations-tier.sql` (see Step 1 for picking the number)

- [ ] **Step 1: Find the next migration number**

Run:

```bash
ls scripts/migrations/ | grep -oE '^[0-9]+' | sort -n | tail -1
```

Expected: a number like `119`. The new file gets the next integer (e.g., `120`).

- [ ] **Step 2: Write the migration**

Create `scripts/migrations/<next>-add-organizations-tier.sql` (substitute the number from Step 1):

```sql
-- Migration: Add tier column to organizations
-- Backs the read-through entitlement resolver (see design doc
-- 2026-04-24-entitlement-inheritance-and-mcp-cache-design.md, section 3.2).
--
-- Today the only paid org plan is Enterprise, so the default is 'enterprise'
-- and the CHECK constraint is tight. When a second paid org plan lands,
-- relax the CHECK and update writers (organizations.service.ts, any future
-- Stripe-price-to-tier mapper).
--
-- Idempotent: safe to re-run. Uses IF NOT EXISTS and a DO-block with a
-- duplicate_object guard on the CHECK constraint.

BEGIN;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'enterprise';

DO $$
BEGIN
  ALTER TABLE organizations
    ADD CONSTRAINT organizations_tier_check CHECK (tier IN ('enterprise'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Migration complete: organizations.tier column added with default enterprise';
END $$;
```

- [ ] **Step 3: Apply to the dev Supabase database and verify**

Run (via whichever method the repo uses to push migrations — if using the Supabase MCP tool, call `apply_migration`; if using the CLI, run the script against the dev DB):

```bash
# Example (adapt to actual project tooling):
psql "$DEV_SUPABASE_DB_URL" -f scripts/migrations/<next>-add-organizations-tier.sql
```

Then verify:

```bash
psql "$DEV_SUPABASE_DB_URL" -c "\d organizations" | grep tier
```

Expected output includes: `tier | text | ... not null default 'enterprise'::text`.

Also verify the constraint:

```bash
psql "$DEV_SUPABASE_DB_URL" -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'organizations_tier_check';"
```

Expected: `organizations_tier_check | CHECK ((tier = 'enterprise'::text))`.

- [ ] **Step 4: Verify idempotency**

Run the migration again:

```bash
psql "$DEV_SUPABASE_DB_URL" -f scripts/migrations/<next>-add-organizations-tier.sql
```

Expected: no errors; the `NOTICE` fires again. No schema changes.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrations/<next>-add-organizations-tier.sql
git commit -m "feat(db): add organizations.tier column with enterprise default

Backs the read-through entitlement resolver planned in
2026-04-24-entitlement-inheritance-and-mcp-cache-design.md. Column
defaults to 'enterprise' because that's currently the only paid org
plan; CHECK constraint enforces that today and relaxes when a second
tier is added."
```

---

## Phase 2 — mcp-server

### Task 2.1: Set up vitest for mcp-server

**Files:**

- Modify: `packages/mcp-server/package.json`

- [ ] **Step 1: Install vitest**

Run from the repo root:

```bash
npm install --workspace packages/mcp-server --save-dev vitest @types/node
```

Expected: `packages/mcp-server/package.json` gains `"vitest": "^<version>"` under `devDependencies`. Root `package-lock.json` updates.

- [ ] **Step 2: Add test scripts**

Edit `packages/mcp-server/package.json` — change the `scripts` block from:

```json
"scripts": {
  "build": "tsc",
  "dev": "tsx src/http.ts",
  "start": "node dist/http.js"
},
```

to:

```json
"scripts": {
  "build": "tsc",
  "dev": "tsx src/http.ts",
  "start": "node dist/http.js",
  "test": "vitest run",
  "test:watch": "vitest"
},
```

- [ ] **Step 3: Sanity-check vitest can run**

```bash
npm --workspace packages/mcp-server test
```

Expected: `No test files found, exiting with code 0` or similar "zero tests" message. Not an error.

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-server/package.json package-lock.json
git commit -m "chore(mcp-server): add vitest + test scripts"
```

### Task 2.2: Split TTL in entitlements-cache

**Files:**

- Modify: `packages/mcp-server/src/lib/oauth/entitlements-cache.ts`
- Create: `packages/mcp-server/src/lib/oauth/entitlements-cache.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/mcp-server/src/lib/oauth/entitlements-cache.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkEntitlement,
  invalidateMany,
  __resetCacheForTests,
  POSITIVE_TTL_MS,
  NEGATIVE_TTL_MS,
} from "./entitlements-cache";

describe("entitlements-cache TTL split", () => {
  beforeEach(() => {
    __resetCacheForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports POSITIVE_TTL_MS = 5 minutes", () => {
    expect(POSITIVE_TTL_MS).toBe(5 * 60 * 1000);
  });

  it("exports NEGATIVE_TTL_MS = 30 seconds", () => {
    expect(NEGATIVE_TTL_MS).toBe(30 * 1000);
  });

  it("a positive result is cached for up to 5 minutes", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access: { "feature:mcp_access": { level: "full" } },
        }),
        { status: 200 },
      ),
    );

    await checkEntitlement("user-pro");
    await checkEntitlement("user-pro"); // should hit cache
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(POSITIVE_TTL_MS - 1);
    await checkEntitlement("user-pro");
    expect(fetchSpy).toHaveBeenCalledTimes(1); // still cached

    vi.advanceTimersByTime(2);
    await checkEntitlement("user-pro");
    expect(fetchSpy).toHaveBeenCalledTimes(2); // re-fetched
    fetchSpy.mockRestore();
  });

  it("a negative result is cached for only 30 seconds", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access: { "feature:mcp_access": { level: "none" } },
        }),
        { status: 200 },
      ),
    );

    await checkEntitlement("user-free");
    await checkEntitlement("user-free");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(NEGATIVE_TTL_MS - 1);
    await checkEntitlement("user-free");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2);
    await checkEntitlement("user-free");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm --workspace packages/mcp-server test
```

Expected: imports of `invalidateMany`, `__resetCacheForTests`, `POSITIVE_TTL_MS`, `NEGATIVE_TTL_MS` fail (module doesn't export them). Tests fail.

- [ ] **Step 3: Implement TTL split + test hooks**

Replace `packages/mcp-server/src/lib/oauth/entitlements-cache.ts` with:

```ts
export const POSITIVE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const NEGATIVE_TTL_MS = 30 * 1000; // 30 seconds

interface CacheEntry {
  allowed: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const BACKEND_URL =
  process.env.PROPERTYIQ_API_URL ||
  "https://backend-production-ee4d.up.railway.app";

// Manual bypass list — comma-separated user IDs that skip the backend
// entitlement check entirely and are always allowed. Used to keep trusted
// agents (e.g. paperclip CMO heartbeat) online independently of the
// backend entitlements service. Revoke by removing the ID from the env var
// and redeploying.
const ALLOWLIST = new Set(
  (process.env.MCP_ENTITLEMENT_ALLOWLIST || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

export async function checkEntitlement(userId: string): Promise<boolean> {
  if (ALLOWLIST.has(userId)) {
    console.log(`[Auth:Entitlements] Allowlist bypass | userId=${userId}`);
    return true;
  }

  const now = Date.now();
  const cached = cache.get(userId);
  const isCached = !!(cached && now < cached.expiresAt);
  console.log(
    `[Auth:Entitlements] Checking userId=${userId} | cached=${isCached}`,
  );
  if (isCached) {
    console.log(`[Auth:Entitlements] Result: allowed=${cached!.allowed}`);
    return cached!.allowed;
  }

  try {
    const resource = "feature:mcp_access";
    const res = await fetch(
      `${BACKEND_URL}/api/entitlements/check?resources=${resource}`,
      { headers: { "x-user-id": userId } },
    );
    const body = (await res.json()) as {
      access?: Record<string, { level?: string }>;
    };
    const allowed = body?.access?.[resource]?.level === "full";
    const ttl = allowed ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
    cache.set(userId, { allowed, expiresAt: now + ttl });
    console.log(
      `[Auth:Entitlements] Result: allowed=${allowed} | ttl_ms=${ttl}`,
    );
    return allowed;
  } catch (err) {
    // On failure, allow access (fail open) but don't cache
    console.log(
      `[Auth:Entitlements] Check failed, failing open | error=${err instanceof Error ? err.message : String(err)}`,
    );
    return true;
  }
}

/** Remove cached entitlement decisions for the given userIds. Returns the number of entries actually removed. */
export function invalidateMany(userIds: string[]): number {
  let count = 0;
  for (const id of userIds) {
    if (cache.delete(id)) count++;
  }
  return count;
}

/** Test-only: clear the whole cache. Do not call outside vitest. */
export function __resetCacheForTests(): void {
  cache.clear();
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm --workspace packages/mcp-server test
```

Expected: all four tests in this file pass.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/lib/oauth/entitlements-cache.ts packages/mcp-server/src/lib/oauth/entitlements-cache.test.ts
git commit -m "feat(mcp-server): split positive/negative entitlement cache TTLs

5 min for allowed results, 30 s for denied. Caps upgrade-to-access
latency at 30 s without invalidation. Adds test hooks and vitest
coverage for the new behavior."
```

### Task 2.3: `invalidateMany` helper coverage

**Files:**

- Modify: `packages/mcp-server/src/lib/oauth/entitlements-cache.test.ts`

- [ ] **Step 1: Write failing tests for invalidateMany**

Append to `entitlements-cache.test.ts`:

```ts
describe("invalidateMany", () => {
  beforeEach(() => {
    __resetCacheForTests();
  });

  it("returns 0 when nothing is cached", () => {
    expect(invalidateMany(["a", "b"])).toBe(0);
  });

  it("deletes cached entries and returns the delete count", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ access: { "feature:mcp_access": { level: "full" } } }),
        { status: 200 },
      ),
    );
    await checkEntitlement("user-1");
    await checkEntitlement("user-2");
    await checkEntitlement("user-3");

    expect(invalidateMany(["user-1", "user-2", "missing"])).toBe(2);

    // Missing users don't throw, just don't count.
    expect(invalidateMany(["missing-again"])).toBe(0);
  });

  it("handles empty input", () => {
    expect(invalidateMany([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm --workspace packages/mcp-server test
```

Expected: the three new tests pass (the function was already implemented in Task 2.2; this just validates its behavior).

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/src/lib/oauth/entitlements-cache.test.ts
git commit -m "test(mcp-server): cover invalidateMany helper"
```

### Task 2.4: Internal invalidation endpoint

**Files:**

- Create: `packages/mcp-server/src/routes/internal-routes.ts`
- Modify: `packages/mcp-server/src/http.ts`

- [ ] **Step 1: Write the route file**

Create `packages/mcp-server/src/routes/internal-routes.ts`:

```ts
import type { Express, Request, Response } from "express";
import { invalidateMany } from "../lib/oauth/entitlements-cache";
import { timingSafeEqual } from "node:crypto";

/**
 * Mounts internal service-to-service routes under /internal/*.
 *
 * These are NOT user-facing: they are called only by the backend
 * (packages/backend) using a shared secret. Not protected by OAuth.
 */
export function mountInternalRoutes(app: Express): void {
  app.post(
    "/internal/entitlements/invalidate",
    (req: Request, res: Response) => {
      const expected = process.env.MCP_INTERNAL_SECRET;
      if (!expected) {
        console.log(
          "[MCP Internal] Rejecting: MCP_INTERNAL_SECRET not configured",
        );
        res.status(401).json({ error: "internal_secret_not_configured" });
        return;
      }

      const header = req.headers.authorization ?? "";
      const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

      // Constant-time comparison to avoid timing attacks on the secret
      const providedBuf = Buffer.from(provided);
      const expectedBuf = Buffer.from(expected);
      const ok =
        providedBuf.length === expectedBuf.length &&
        timingSafeEqual(providedBuf, expectedBuf);

      if (!ok) {
        console.log("[MCP Internal] Rejecting: bad/missing secret");
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const body = req.body as { userIds?: unknown };
      if (!Array.isArray(body.userIds)) {
        res.status(400).json({ error: "userIds must be an array of strings" });
        return;
      }

      const userIds = body.userIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      );
      const invalidated = invalidateMany(userIds);
      console.log(
        `[MCP Internal] Invalidate | requested=${body.userIds.length} | removed=${invalidated}`,
      );
      res.json({ invalidated });
    },
  );
}
```

- [ ] **Step 2: Write the integration test**

Create `packages/mcp-server/src/routes/internal-routes.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { mountInternalRoutes } from "./internal-routes";
import {
  __resetCacheForTests,
  checkEntitlement,
} from "../lib/oauth/entitlements-cache";

const SECRET = "test-secret-abc123";

function buildApp() {
  const app = express();
  app.use(express.json());
  mountInternalRoutes(app);
  return app;
}

describe("POST /internal/entitlements/invalidate", () => {
  beforeEach(() => {
    process.env.MCP_INTERNAL_SECRET = SECRET;
    __resetCacheForTests();
  });

  it("rejects without Authorization header", async () => {
    const res = await request(buildApp())
      .post("/internal/entitlements/invalidate")
      .send({ userIds: ["a"] });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("rejects with wrong secret", async () => {
    const res = await request(buildApp())
      .post("/internal/entitlements/invalidate")
      .set("Authorization", "Bearer wrong")
      .send({ userIds: ["a"] });
    expect(res.status).toBe(401);
  });

  it("rejects when secret is not configured server-side", async () => {
    delete process.env.MCP_INTERNAL_SECRET;
    const res = await request(buildApp())
      .post("/internal/entitlements/invalidate")
      .set("Authorization", "Bearer whatever")
      .send({ userIds: ["a"] });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("internal_secret_not_configured");
  });

  it("rejects non-array body", async () => {
    const res = await request(buildApp())
      .post("/internal/entitlements/invalidate")
      .set("Authorization", `Bearer ${SECRET}`)
      .send({ userIds: "not-an-array" });
    expect(res.status).toBe(400);
  });

  it("invalidates and returns count", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ access: { "feature:mcp_access": { level: "full" } } }),
        { status: 200 },
      ),
    );
    await checkEntitlement("u1");
    await checkEntitlement("u2");

    const res = await request(buildApp())
      .post("/internal/entitlements/invalidate")
      .set("Authorization", `Bearer ${SECRET}`)
      .send({ userIds: ["u1", "u2", "missing"] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ invalidated: 2 });
  });

  it("accepts empty userIds array", async () => {
    const res = await request(buildApp())
      .post("/internal/entitlements/invalidate")
      .set("Authorization", `Bearer ${SECRET}`)
      .send({ userIds: [] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ invalidated: 0 });
  });
});
```

- [ ] **Step 3: Install supertest as a dev dep**

```bash
npm install --workspace packages/mcp-server --save-dev supertest @types/supertest
```

Expected: `packages/mcp-server/package.json` gains both under `devDependencies`.

- [ ] **Step 4: Run tests — expect them to fail**

```bash
npm --workspace packages/mcp-server test
```

Expected: the six tests in `internal-routes.test.ts` pass import-wise but the route isn't mounted in `http.ts` yet — that's fine for unit-level testing because `buildApp()` in the test mounts it directly. Tests should PASS.

If tests fail on a missing import (e.g., `supertest`), re-run Step 3 and retry.

- [ ] **Step 5: Wire the route into http.ts**

Edit `packages/mcp-server/src/http.ts`. Find the block:

```ts
import { mountOAuthRoutes } from "./routes/oauth-routes";
import { mountApiRoutes } from "./routes/api-routes";
```

Add a third import:

```ts
import { mountInternalRoutes } from "./routes/internal-routes";
```

Then find:

```ts
mountOAuthRoutes(app);
mountApiRoutes(app);
```

Add a third line immediately after:

```ts
mountInternalRoutes(app);
```

- [ ] **Step 6: Verify the build still works**

```bash
npm --workspace packages/mcp-server run build
```

Expected: exit 0, no TypeScript errors, `dist/` regenerated.

- [ ] **Step 7: Commit**

```bash
git add packages/mcp-server/src/routes/internal-routes.ts packages/mcp-server/src/routes/internal-routes.test.ts packages/mcp-server/src/http.ts packages/mcp-server/package.json package-lock.json
git commit -m "feat(mcp-server): internal entitlements-invalidate endpoint

POST /internal/entitlements/invalidate — shared-secret bearer, accepts
{userIds: string[]}, drops the matching in-memory cache entries.
Constant-time secret check. Called by backend webhooks + service
methods on every tier-affecting mutation."
```

### Task 2.5: Set `MCP_INTERNAL_SECRET` on Railway mcp-server

**Files:** none (Railway env only)

- [ ] **Step 1: Generate a random secret**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Expected: a 64-char hex string. Save it somewhere safe (1Password, etc.) — you will need the identical value on the backend in Task 3.10.

- [ ] **Step 2: Set it on Railway mcp-server production and dev**

Via the Railway MCP tool (do NOT echo the value back to chat):

```
set-variables service=mcp-server environment=production variables=["MCP_INTERNAL_SECRET=<hex-from-step-1>"]
set-variables service=mcp-server environment=dev        variables=["MCP_INTERNAL_SECRET=<different-hex>"]
```

Use different values per environment. Setting the variable triggers a redeploy.

- [ ] **Step 3: Verify**

Wait for the deploy to finish (`list-deployments service=mcp-server environment=production` → status SUCCESS), then hit the endpoint:

```bash
curl --ssl-no-revoke -sS -o /dev/null -w "%{http_code}\n" \
  -X POST \
  -H "Authorization: Bearer wrong-on-purpose" \
  -H "Content-Type: application/json" \
  -d '{"userIds":[]}' \
  https://mcp.propertyiq.app/internal/entitlements/invalidate
```

Expected: `401`. Confirms the endpoint is live and enforcing the secret.

Now hit it with the real secret (just to confirm the full loop works — no DB side effects):

```bash
curl --ssl-no-revoke -sS -w "\n%{http_code}\n" \
  -X POST \
  -H "Authorization: Bearer <prod-secret>" \
  -H "Content-Type: application/json" \
  -d '{"userIds":[]}' \
  https://mcp.propertyiq.app/internal/entitlements/invalidate
```

Expected: `{"invalidated":0}` and `200`.

---

## Phase 3 — Backend

### Task 3.1: Set `tier: 'enterprise'` on org create

**Files:**

- Modify: `packages/backend/src/organizations/organizations.service.ts` (method `create`, lines ~30–110)
- Modify or Create: `packages/backend/src/organizations/organizations.service.spec.ts`

- [ ] **Step 1: Check whether a spec file exists**

```bash
ls packages/backend/src/organizations/organizations.service.spec.ts
```

If it doesn't exist, you'll create it in Step 2. If it does, you'll add a test to it.

- [ ] **Step 2: Write the failing test**

Add this test case to `organizations.service.spec.ts` (or create the file with full boilerplate — see the existing `*.spec.ts` files in `packages/backend/src/` as templates). The test asserts that the insert payload includes `tier: 'enterprise'`:

```ts
it('sets tier: "enterprise" on the inserted org row', async () => {
  // The test harness should capture the insert payload on organizations
  // (mock the supabase client). Whatever the existing pattern in this
  // repo is for asserting supabase.from('organizations').insert(...).

  // After calling service.create(dto, ownerId):
  expect(capturedOrgInsert).toMatchObject({
    name: dto.name,
    slug: dto.slug,
    owner_id: ownerId,
    tier: "enterprise",
  });
});
```

If there is no existing spec, copy the structure from `packages/backend/src/organizations/members.service.spec.ts` (or similar file) and adapt.

- [ ] **Step 3: Run test to verify it fails**

```bash
npm --workspace packages/backend test -- organizations.service
```

Expected: FAIL — current insert doesn't include `tier`.

- [ ] **Step 4: Implement**

In `packages/backend/src/organizations/organizations.service.ts`, locate the `.insert({...})` call inside `create` (around lines 60–68):

```ts
const { data: org, error: orgError } = await this.supabase
  .from("organizations")
  .insert({
    name: dto.name,
    slug: dto.slug,
    owner_id: ownerId,
    ...(isEnterprise && { api_enabled: true, embed_enabled: true }),
  })
  .select("*")
  .single();
```

Change to:

```ts
const { data: org, error: orgError } = await this.supabase
  .from("organizations")
  .insert({
    name: dto.name,
    slug: dto.slug,
    owner_id: ownerId,
    tier: "enterprise",
    ...(isEnterprise && { api_enabled: true, embed_enabled: true }),
  })
  .select("*")
  .single();
```

- [ ] **Step 5: Run test to verify pass**

```bash
npm --workspace packages/backend test -- organizations.service
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/organizations/organizations.service.ts packages/backend/src/organizations/organizations.service.spec.ts
git commit -m "feat(backend): set tier='enterprise' on org create

Required by the P2-Y read-through resolver so the org's tier column is
populated at creation time. Today's product only has one paid org plan,
so the value is a constant; future multi-plan work will make this
dynamic from Stripe price metadata."
```

### Task 3.2: `McpEntitlementsInvalidator` service

**Files:**

- Create: `packages/backend/src/entitlements/mcp-entitlements-invalidator.service.ts`
- Create: `packages/backend/src/entitlements/mcp-entitlements-invalidator.service.spec.ts`
- Modify: `packages/backend/src/entitlements/entitlements.module.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/backend/src/entitlements/mcp-entitlements-invalidator.service.spec.ts`:

```ts
import { Test, TestingModule } from "@nestjs/testing";
import { McpEntitlementsInvalidator } from "./mcp-entitlements-invalidator.service";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";

describe("McpEntitlementsInvalidator", () => {
  let service: McpEntitlementsInvalidator;
  let fetchMock: ReturnType<typeof jest.spyOn>;
  const supabaseMock = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  } as any;

  beforeEach(async () => {
    process.env.MCP_INTERNAL_SECRET = "test-secret";
    process.env.MCP_SERVER_URL = "https://mcp.test";

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        McpEntitlementsInvalidator,
        { provide: SUPABASE_CLIENT, useValue: supabaseMock },
      ],
    }).compile();
    service = moduleRef.get(McpEntitlementsInvalidator);
    fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response('{"invalidated":0}', { status: 200 }) as any,
      );
  });

  afterEach(() => {
    fetchMock.mockRestore();
    delete process.env.MCP_INTERNAL_SECRET;
    delete process.env.MCP_SERVER_URL;
  });

  it("no-ops when userIds is empty", async () => {
    await service.invalidate([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no-ops when MCP_INTERNAL_SECRET is not set", async () => {
    delete process.env.MCP_INTERNAL_SECRET;
    // Re-create service so it picks up the absent secret
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        McpEntitlementsInvalidator,
        { provide: SUPABASE_CLIENT, useValue: supabaseMock },
      ],
    }).compile();
    const s = moduleRef.get(McpEntitlementsInvalidator);
    await s.invalidate(["a"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs with bearer secret and userIds", async () => {
    await service.invalidate(["u1", "u2"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://mcp.test/internal/entitlements/invalidate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-secret",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ userIds: ["u1", "u2"] }),
      }),
    );
  });

  it("swallows fetch errors (best-effort)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(service.invalidate(["u1"])).resolves.not.toThrow();
  });

  it("invalidateOrgMembers expands orgId to active member userIds", async () => {
    // Stub the private helper so we don't have to fake the supabase
    // query chain — the helper is tested separately in a scenario that
    // does fake the chain (see the next test).
    const getActiveSpy = jest
      .spyOn(service as any, "getActiveMemberIds")
      .mockResolvedValue(["u1", "u2"]);

    await service.invalidateOrgMembers("org-123");

    expect(getActiveSpy).toHaveBeenCalledWith("org-123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://mcp.test/internal/entitlements/invalidate",
      expect.objectContaining({
        body: JSON.stringify({ userIds: ["u1", "u2"] }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm --workspace packages/backend test -- mcp-entitlements-invalidator
```

Expected: FAIL — service doesn't exist.

- [ ] **Step 3: Implement the service**

Create `packages/backend/src/entitlements/mcp-entitlements-invalidator.service.ts`:

```ts
import { Injectable, Inject, Logger } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";

/**
 * Fires best-effort invalidation calls to the mcp-server's in-memory
 * entitlements cache. Called by backend mutation sites (billing webhooks,
 * org-billing webhooks, invite accept, member remove) whenever a user's
 * effective entitlement could have changed.
 *
 * Failure is non-fatal: the mcp-server has a 30 s negative-result TTL
 * that guarantees correctness within that window even if invalidation
 * never lands.
 */
@Injectable()
export class McpEntitlementsInvalidator {
  private readonly logger = new Logger(McpEntitlementsInvalidator.name);
  private readonly url =
    process.env.MCP_SERVER_URL ?? "https://mcp.propertyiq.app";

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async invalidate(userIds: string[]): Promise<void> {
    const secret = process.env.MCP_INTERNAL_SECRET;
    if (!secret || userIds.length === 0) return;

    try {
      await fetch(`${this.url}/internal/entitlements/invalidate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userIds }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (err) {
      this.logger.warn(
        `MCP invalidate failed (best-effort): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async invalidateOrgMembers(orgId: string): Promise<void> {
    const userIds = await this.getActiveMemberIds(orgId);
    await this.invalidate(userIds);
  }

  private async getActiveMemberIds(orgId: string): Promise<string[]> {
    const { data } = await this.supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("status", "active");
    return (data ?? []).map((m: any) => m.user_id);
  }
}
```

- [ ] **Step 4: Register in the module**

Edit `packages/backend/src/entitlements/entitlements.module.ts`. Add the import at the top:

```ts
import { McpEntitlementsInvalidator } from "./mcp-entitlements-invalidator.service";
```

Add `McpEntitlementsInvalidator` to the `providers` array, and add it to the `exports` array so other modules can inject it. Example (adapt to the existing module):

```ts
@Module({
  // ...
  providers: [
    EntitlementsService,
    McpEntitlementsInvalidator /* ...existing */,
  ],
  exports: [EntitlementsService, McpEntitlementsInvalidator],
})
export class EntitlementsModule {}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npm --workspace packages/backend test -- mcp-entitlements-invalidator
```

Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/entitlements/mcp-entitlements-invalidator.service.ts packages/backend/src/entitlements/mcp-entitlements-invalidator.service.spec.ts packages/backend/src/entitlements/entitlements.module.ts
git commit -m "feat(backend): McpEntitlementsInvalidator service

Best-effort HTTP invalidator targeted at the mcp-server's
/internal/entitlements/invalidate endpoint. invalidate(userIds) fires
for single/batch user mutations; invalidateOrgMembers(orgId) expands
an org to its active members. Failures are logged and swallowed —
30 s negative-result TTL on the mcp-server side is the correctness
floor."
```

### Task 3.3: P2-Y — org-tier lookup in entitlements resolver

**Files:**

- Modify: `packages/backend/src/entitlements/entitlements.service.ts`
- Create: `packages/backend/src/entitlements/entitlements.service.spec.ts` (or extend if present)

- [ ] **Step 1: Write failing tests**

Create (or append to) `packages/backend/src/entitlements/entitlements.service.spec.ts`. The spec adds the following scenarios — use existing mock patterns for supabase if present in the repo:

```ts
describe("EntitlementsService — org-tier inheritance (P2-Y)", () => {
  // Harness setup goes here — copy the existing pattern in the repo
  // for building a TestingModule with supabase, redis, userFeatures, and
  // trialUsageEmitter mocks.

  beforeEach(() => {
    // Reset mocks between tests
  });

  it("user with personal free and no org membership resolves to free", async () => {
    mockUserProfile({ subscription_tier: "free" });
    mockOrgMembership(null);
    const res = await service.checkAccess("u1", null, ["feature:mcp_access"]);
    expect(res.tier).toBe("free");
    expect(res.access["feature:mcp_access"].level).toBe("none");
  });

  it("user in active-billing org inherits org tier (enterprise)", async () => {
    mockUserProfile({ subscription_tier: "free" });
    mockOrgMembership({ tier: "enterprise", billing_status: "active" });
    const res = await service.checkAccess("u1", null, ["feature:mcp_access"]);
    expect(res.tier).toBe("enterprise");
    expect(res.access["feature:mcp_access"].level).toBe("full");
  });

  it("past_due org billing does NOT inherit", async () => {
    mockUserProfile({ subscription_tier: "free" });
    mockOrgMembership({ tier: "enterprise", billing_status: "past_due" });
    const res = await service.checkAccess("u1", null, ["feature:mcp_access"]);
    expect(res.tier).toBe("free");
  });

  it("pending membership does NOT inherit", async () => {
    mockUserProfile({ subscription_tier: "free" });
    mockOrgMembership(
      { tier: "enterprise", billing_status: "active" },
      "pending",
    );
    const res = await service.checkAccess("u1", null, ["feature:mcp_access"]);
    expect(res.tier).toBe("free");
  });

  it("personal pro + active enterprise org → enterprise (max wins)", async () => {
    mockUserProfile({
      subscription_tier: "pro",
      subscription_status: "active",
    });
    mockOrgMembership({ tier: "enterprise", billing_status: "active" });
    const res = await service.checkAccess("u1", null, ["feature:mcp_access"]);
    expect(res.tier).toBe("enterprise");
  });

  it("admin_users fallback does NOT run when effective tier is already pro via org", async () => {
    mockUserProfile({ subscription_tier: "free" });
    mockOrgMembership({ tier: "enterprise", billing_status: "active" });
    mockAdminUsers("u1", "super_admin"); // would bump to admin if consulted
    const res = await service.checkAccess("u1", null, ["feature:mcp_access"]);
    expect(res.tier).toBe("enterprise"); // not 'admin'
  });

  it("admin_users fallback DOES run when everything else is free", async () => {
    mockUserProfile({ subscription_tier: "free" });
    mockOrgMembership(null);
    mockAdminUsers("u1", "admin");
    const res = await service.checkAccess("u1", null, ["feature:mcp_access"]);
    expect(res.tier).toBe("admin");
  });
});
```

(The `mockUserProfile`/`mockOrgMembership`/`mockAdminUsers` helpers are sketches — implement them using the existing supabase mock pattern in the repo. If there is no existing pattern, use `jest.spyOn` on the supabase `.from(...).select(...)` chain.)

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm --workspace packages/backend test -- entitlements.service
```

Expected: scenarios 2, 3, 4, 5 fail (org-tier not consulted today).

- [ ] **Step 3: Implement the resolver change**

In `packages/backend/src/entitlements/entitlements.service.ts`, inside `checkAccess`, AFTER the block that checks personal subscription tier and BEFORE the `if (tier === 'free')` admin_users fallback, insert the org-tier lookup + precedence max.

Around line ~103 (after the personal-tier block ends and before the admin_users fallback starts), insert:

```ts
// ────────────────────────────────────────────────────────────
// Org-tier inheritance (P2-Y, read-through): if the user is an
// active member of an org with active billing, use the higher of
// (personal tier, org tier).
// ────────────────────────────────────────────────────────────
if (userId) {
  const { data: orgMembership } = await this.supabase
    .getClient()
    .from("organization_members")
    .select("organizations!inner(tier, billing_status)")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("organizations.billing_status", "active")
    .maybeSingle();

  const orgTier = (orgMembership?.organizations as any)?.tier ?? null;

  if (
    orgTier &&
    EntitlementsService.tierRank(orgTier) > EntitlementsService.tierRank(tier)
  ) {
    tier = orgTier;
  }
}
```

Also add a static helper at the bottom of the `EntitlementsService` class (before the closing `}` of the class body):

```ts
private static readonly TIER_ORDER: Record<string, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
  admin: 3,
};

private static tierRank(t: string | null | undefined): number {
  return t ? (EntitlementsService.TIER_ORDER[t] ?? 0) : 0;
}
```

**Leave the existing `if (tier === 'free') { ... admin_users ... }` fallback unchanged** — it should still run only when everything else resolved to free.

- [ ] **Step 4: Run tests to verify pass**

```bash
npm --workspace packages/backend test -- entitlements.service
```

Expected: all 7 scenarios pass. Existing tests in the file also still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/entitlements/entitlements.service.ts packages/backend/src/entitlements/entitlements.service.spec.ts
git commit -m "feat(backend): entitlements resolver inherits tier from active org

Read-through: if user is an active member of an org with
billing_status='active', effective tier = max(personal, org). The
admin_users fallback is unchanged — still only promotes when every
other source resolved to free."
```

### Task 3.4: Wire invalidation into billing-webhook.service (4 sites)

**Files:**

- Modify: `packages/backend/src/billing/billing-webhook.service.ts`
- Modify: `packages/backend/src/billing/billing.module.ts`
- Modify or Create: `packages/backend/src/billing/billing-webhook.service.spec.ts`

- [ ] **Step 1: Write failing tests — one per handler method**

In the spec file, add four test cases that construct the service with a mocked `McpEntitlementsInvalidator` and assert that each of the four handlers calls `invalidate([userId])` with the correct userId:

```ts
describe("BillingWebhookService — MCP cache invalidation", () => {
  let service: BillingWebhookService;
  const invalidator = {
    invalidate: jest.fn(),
    invalidateOrgMembers: jest.fn(),
  };

  beforeEach(async () => {
    // Build TestingModule with McpEntitlementsInvalidator replaced by `invalidator`.
    invalidator.invalidate.mockClear();
  });

  it("handleCheckoutComplete invalidates the user", async () => {
    await service.handleWebhookEvent(fakeCheckoutComplete({ userId: "u1" }));
    expect(invalidator.invalidate).toHaveBeenCalledWith(["u1"]);
  });

  it("handleSubscriptionUpdated invalidates the user", async () => {
    await service.handleWebhookEvent(fakeSubUpdated({ userId: "u1" }));
    expect(invalidator.invalidate).toHaveBeenCalledWith(["u1"]);
  });

  it("handleSubscriptionDeleted invalidates the user", async () => {
    await service.handleWebhookEvent(fakeSubDeleted({ userId: "u1" }));
    expect(invalidator.invalidate).toHaveBeenCalledWith(["u1"]);
  });

  it("handlePaymentFailed invalidates the user", async () => {
    await service.handleWebhookEvent(fakePaymentFailed({ userId: "u1" }));
    expect(invalidator.invalidate).toHaveBeenCalledWith(["u1"]);
  });
});
```

(`fakeCheckoutComplete` etc. build Stripe.Event objects with the `userId` threaded into wherever the existing handler extracts it from. Copy the shapes from the existing test harness / helper file if one exists.)

- [ ] **Step 2: Inject the invalidator**

Edit `packages/backend/src/billing/billing-webhook.service.ts` constructor — add the invalidator:

```ts
import { McpEntitlementsInvalidator } from '../entitlements/mcp-entitlements-invalidator.service';

// Inside the class constructor:
constructor(
  // ...existing injected deps,
  private readonly mcpInvalidator: McpEntitlementsInvalidator,
) {}
```

Edit `packages/backend/src/billing/billing.module.ts` to import `EntitlementsModule`:

```ts
import { EntitlementsModule } from "../entitlements/entitlements.module";

@Module({
  imports: [, /* existing */ EntitlementsModule],
  // ...
})
export class BillingModule {}
```

- [ ] **Step 3: Add the four `invalidate` calls**

In each of `handleCheckoutComplete`, `handleSubscriptionUpdated`, `handleSubscriptionDeleted`, `handlePaymentFailed`, add as the FINAL statement of the method (after all state mutations succeed):

```ts
await this.mcpInvalidator.invalidate([userId]);
```

The `userId` variable already exists in each handler — reference it by its existing name (check the file; it's typically the resolved `user_profiles.id` extracted from `session.metadata?.user_id` or similar).

- [ ] **Step 4: Run tests to verify pass**

```bash
npm --workspace packages/backend test -- billing-webhook
```

Expected: the four new tests pass. Existing tests in the file continue to pass.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/billing/billing-webhook.service.ts packages/backend/src/billing/billing-webhook.service.spec.ts packages/backend/src/billing/billing.module.ts
git commit -m "feat(backend): invalidate MCP entitlement cache on personal billing events

handleCheckoutComplete, handleSubscriptionUpdated,
handleSubscriptionDeleted, handlePaymentFailed — all now fire
mcpInvalidator.invalidate([userId]) as their final step. Best-effort:
failures are swallowed by the invalidator, webhook response to
Stripe is unchanged."
```

### Task 3.5: Wire invalidation into org-billing-webhook.service (5 sites)

**Files:**

- Modify: `packages/backend/src/org-billing/org-billing-webhook.service.ts`
- Modify: `packages/backend/src/org-billing/org-billing.module.ts`
- Modify or Create: `packages/backend/src/org-billing/org-billing-webhook.service.spec.ts`

- [ ] **Step 1: Write failing tests — one per handler**

Add tests for all 5 event handlers. Each asserts that `invalidator.invalidateOrgMembers(orgId)` is called. Mirror the structure from Task 3.4.

Important nuance for `handleSubscriptionDeleted`: the member expansion MUST happen BEFORE `downgradeHandler.handleDowngrade(...)` deletes the membership rows. Assert the call order in the test.

```ts
it("handleSubscriptionDeleted invalidates members BEFORE the downgrade removes them", async () => {
  const callOrder: string[] = [];
  invalidator.invalidateOrgMembers = jest.fn(() => {
    callOrder.push("invalidate");
    return Promise.resolve();
  });
  downgradeHandler.handleDowngrade = jest.fn(() => {
    callOrder.push("downgrade");
    return Promise.resolve();
  });

  await service.handleWebhookEvent(fakeSubDeleted({ orgId: "org-1" }));

  expect(callOrder).toEqual(["invalidate", "downgrade"]);
});
```

- [ ] **Step 2: Inject the invalidator**

Same pattern as Task 3.4 — add `private readonly mcpInvalidator: McpEntitlementsInvalidator` to the constructor; add `EntitlementsModule` to `org-billing.module.ts` imports.

- [ ] **Step 3: Add the five `invalidateOrgMembers` calls**

In each of:

- `handleCheckoutComplete` — after the org update succeeds
- `handleInvoicePaid` — after the update
- `handlePaymentFailed` — after the update
- `handleSubscriptionUpdated` — after the update (and, if it triggers downgrade, BEFORE calling `downgradeHandler.handleDowngrade`)
- `handleSubscriptionDeleted` — after clearing `stripe_subscription_id` but BEFORE calling `downgradeHandler.handleDowngrade`

Call:

```ts
await this.mcpInvalidator.invalidateOrgMembers(org.id);
```

(The `org` variable already exists in each handler — it's either the direct result of the org lookup or the `org` returned from `findOrgBy*`.)

- [ ] **Step 4: Run tests to verify pass**

```bash
npm --workspace packages/backend test -- org-billing-webhook
```

Expected: all 5 tests pass, including the call-order assertion for `handleSubscriptionDeleted`.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/org-billing/org-billing-webhook.service.ts packages/backend/src/org-billing/org-billing-webhook.service.spec.ts packages/backend/src/org-billing/org-billing.module.ts
git commit -m "feat(backend): invalidate MCP cache on org billing events

All 5 org-billing-webhook handlers now call
invalidateOrgMembers(orgId). For sub-deleted, the invalidation runs
BEFORE the downgrade handler deletes membership rows, preserving the
member list to invalidate."
```

### Task 3.6: Wire invalidation into invites.service (on accept)

**Files:**

- Modify: `packages/backend/src/organizations/invites.service.ts`
- Modify: `packages/backend/src/organizations/organizations.module.ts`
- Modify or Create: `packages/backend/src/organizations/invites.service.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
it("acceptInvite invalidates the new member after successful join", async () => {
  mockValidPendingInvite();
  mockMatchingUserProfile();
  mockNoExistingMembership();
  mockSuccessfulMemberInsert();

  await service.acceptInvite("tok", "user-123");

  expect(invalidator.invalidate).toHaveBeenCalledWith(["user-123"]);
});

it("acceptInvite does NOT invalidate on failure", async () => {
  mockValidPendingInvite();
  mockMatchingUserProfile();
  mockNoExistingMembership();
  mockFailingMemberInsert();

  await expect(service.acceptInvite("tok", "user-123")).rejects.toThrow();
  expect(invalidator.invalidate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Inject invalidator**

In `invites.service.ts`, constructor signature:

```ts
import { McpEntitlementsInvalidator } from '../entitlements/mcp-entitlements-invalidator.service';

constructor(
  @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  private readonly auditService: OrgAuditService,
  private readonly mcpInvalidator: McpEntitlementsInvalidator,
) {}
```

In `organizations.module.ts`, add `EntitlementsModule` to `imports`.

- [ ] **Step 3: Fire invalidation at the end of successful acceptance**

At the end of the `try { ... } catch {}` block in `acceptInvite` (after the `user_profiles.update` succeeds, before the `auditService.log` call), add:

```ts
await this.mcpInvalidator.invalidate([userId]);
```

(Place it inside the try so rollbacks don't fire invalidation on failure. The spec test ensures this.)

- [ ] **Step 4: Run tests**

```bash
npm --workspace packages/backend test -- invites.service
```

Expected: both new tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/organizations/invites.service.ts packages/backend/src/organizations/invites.service.spec.ts packages/backend/src/organizations/organizations.module.ts
git commit -m "feat(backend): invalidate MCP cache when a user accepts an invite

Fires only on successful join (inside the try block, before the audit
log). Rollbacks skip invalidation."
```

### Task 3.7: Wire invalidation into members.service (on remove)

**Files:**

- Modify: `packages/backend/src/organizations/members.service.ts`
- Modify or Create: `packages/backend/src/organizations/members.service.spec.ts`

(`organizations.module.ts` already imports `EntitlementsModule` from Task 3.6.)

- [ ] **Step 1: Write failing test**

```ts
it("removeMember invalidates the user after a successful remove", async () => {
  mockTargetMemberExists({ role: "member" });
  mockSuccessfulDelete();
  mockSuccessfulProfileUpdate();

  await service.removeMember("org-1", "user-42", "actor");

  expect(invalidator.invalidate).toHaveBeenCalledWith(["user-42"]);
});

it("removeMember does NOT invalidate when remove fails", async () => {
  mockTargetMemberExists({ role: "member" });
  mockFailingDelete();

  await expect(
    service.removeMember("org-1", "user-42", "actor"),
  ).rejects.toThrow();
  expect(invalidator.invalidate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Inject + wire invalidation**

Inject `McpEntitlementsInvalidator` in `members.service.ts` (same pattern as Task 3.6).

In `removeMember`, after the `user_profiles.update({ organization_id: null })` call succeeds and before `auditService.log`, add:

```ts
await this.mcpInvalidator.invalidate([userId]);
```

- [ ] **Step 3: Run tests**

```bash
npm --workspace packages/backend test -- members.service
```

Expected: both new tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/organizations/members.service.ts packages/backend/src/organizations/members.service.spec.ts
git commit -m "feat(backend): invalidate MCP cache when a member is removed

Same pattern as invite-accept: fire only on success, before the audit
log."
```

### Task 3.8: Fix org-downgrade-handler — stop clobbering personal subscription_tier

**Files:**

- Modify: `packages/backend/src/org-billing/org-downgrade-handler.service.ts`
- Modify or Create: `packages/backend/src/org-billing/org-downgrade-handler.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
describe("OrgDowngradeHandlerService — preserves personal tier (P2-Y fix)", () => {
  it("does not touch non-owner member subscription_tier", async () => {
    const profileUpdateMock = jest.fn().mockResolvedValue({});
    supabaseMock.from = jest.fn().mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return {
          update: profileUpdateMock,
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null }),
          in: jest.fn().mockReturnThis(),
          single: jest.fn(),
        };
      }
      // ... other tables return mocks as needed
    });

    await service.handleDowngrade("org-1", "free");

    // Assert no update() call included subscription_tier for members
    for (const call of profileUpdateMock.mock.calls) {
      expect(call[0]).not.toHaveProperty("subscription_tier");
    }
  });

  it("does not touch owner subscription_tier", async () => {
    // Same style as above — assert no update() on user_profiles includes
    // subscription_tier, even for the owner_id path.
  });

  it("still clears organization_id and organization_role on members", async () => {
    // Assert that update payload for members DOES include
    // organization_id: null and organization_role: null.
  });

  it("still flips org api_enabled/embed_enabled/billing_status", async () => {
    // Assert the organizations.update payload is unchanged.
  });
});
```

- [ ] **Step 2: Run tests — confirm failure**

```bash
npm --workspace packages/backend test -- org-downgrade-handler
```

Expected: tests 1 and 2 fail because current code DOES write `subscription_tier`.

- [ ] **Step 3: Remove the `subscription_tier` writes**

In `packages/backend/src/org-billing/org-downgrade-handler.service.ts`:

Change the members-update block (lines ~69–78) from:

```ts
if (memberIds.length > 0) {
  await this.supabase
    .from('user_profiles')
    .update({
      subscription_tier: 'free',
      organization_id: null,
      organization_role: null,
      updated_at: new Date().toISOString(),
    })
    .in('id', memberIds);
  // ...
```

to:

```ts
if (memberIds.length > 0) {
  await this.supabase
    .from('user_profiles')
    .update({
      organization_id: null,
      organization_role: null,
      updated_at: new Date().toISOString(),
    })
    .in('id', memberIds);
  // ...
```

Change the owner-update block (lines ~89–95) from:

```ts
// 6. Update owner tier
await this.supabase
  .from("user_profiles")
  .update({
    subscription_tier: newTier,
    updated_at: new Date().toISOString(),
  })
  .eq("id", org.owner_id);
```

to: **delete the entire owner update block**. The owner's personal tier is managed by `billing-webhook.service.ts` through their own Stripe events; the org downgrade should not modify it. Also remove any variables and comments that become dead after this deletion.

Update the log line (around line 112):

```ts
this.logger.log(
  `Downgraded org ${orgId}: revoked features, freed ${memberIds.length} members`,
);
```

(drop the `owner tier -> ...` bit since we no longer touch it.)

Remove the `newTier` parameter from `handleDowngrade` ONLY if no other code depends on it. If callers still pass it (they do — `org-billing-webhook.service.ts` passes `'free'` in two places), keep the parameter but ignore it, and add a short comment:

```ts
/**
 * @param newTier - kept for callsite compatibility; no longer written
 *   to user_profiles since the entitlements resolver computes effective
 *   tier dynamically (design doc section 3.5).
 */
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npm --workspace packages/backend test -- org-downgrade-handler
```

Expected: all four tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/org-billing/org-downgrade-handler.service.ts packages/backend/src/org-billing/org-downgrade-handler.service.spec.ts
git commit -m "fix(backend): stop clobbering personal subscription_tier on org downgrade

Under P2-Y read-through, the entitlements resolver computes effective
tier from (personal, org) dynamically. The downgrade handler no longer
needs to touch user_profiles.subscription_tier — and doing so was a
bug for any member (or owner) who had a personal Pro sub before the
org was downgraded.

Behavior now: downgrade revokes org feature flags, flips billing_status,
clears member organization_id/role, removes membership rows. Personal
subs are untouched."
```

### Task 3.9: Set `MCP_INTERNAL_SECRET` + optional `MCP_SERVER_URL` on Railway backend

**Files:** none (Railway env only)

- [ ] **Step 1: Set MCP_INTERNAL_SECRET**

Use the exact same value per environment that was set on mcp-server in Task 2.5.

Via Railway MCP tool:

```
set-variables service=backend environment=production variables=["MCP_INTERNAL_SECRET=<same-prod-hex>"]
set-variables service=backend environment=dev        variables=["MCP_INTERNAL_SECRET=<same-dev-hex>"]
```

- [ ] **Step 2: Optionally set MCP_SERVER_URL for dev**

If dev mcp-server is not at `https://mcp.propertyiq.app`:

```
set-variables service=backend environment=dev variables=["MCP_SERVER_URL=<dev-mcp-url>"]
```

Skip for production — the default is correct.

- [ ] **Step 3: Wait for deploys, then smoke-test**

After the backend redeploys, trigger one of the wired events end-to-end (e.g., a test Stripe webhook or a local invite accept against dev) and inspect backend logs for:

```
MCP invalidate failed (best-effort): ...
```

If you see this, the secret or URL is mismatched. Fix and re-deploy.

If you see no such warning after exercising the flow, the round-trip is working.

---

## Phase 4 — End-to-end smoke tests (post-deploy)

### Task 4.1: Deploy in rollout order

**Files:** none (git push + Railway deploys)

- [ ] **Step 1: Push migration**

```bash
git push origin main
```

Apply the migration against production Supabase (via the same method used in dev in Task 1.1, but against the prod connection).

Verify with:

```bash
psql "$PROD_SUPABASE_DB_URL" -c "\d organizations" | grep tier
```

Expected: `tier` column exists with default `'enterprise'`.

- [ ] **Step 2: Wait for mcp-server to redeploy**

Railway should auto-deploy from `main`. Confirm with:

```
list-deployments service=mcp-server environment=production limit=1
```

Expected: `status: SUCCESS`, commit = the Phase 2 commit hash.

Smoke:

```bash
curl --ssl-no-revoke -sS -o /dev/null -w "%{http_code}\n" https://mcp.propertyiq.app/health
```

Expected: `200`.

- [ ] **Step 3: Wait for backend to redeploy and smoke-test**

```
list-deployments service=backend environment=production limit=1
```

Expected: `status: SUCCESS`, commit = the Phase 3 commit hash.

### Task 4.2: Manual smoke scenarios

**Files:** none (live test)

- [ ] **Scenario A: Free user upgrades → immediate MCP access**

1. Create or identify a test `free` user.
2. Have them attempt an MCP tool call via Claude Code → expect `403` (cache populated with `allowed=false`).
3. Upgrade them to Pro via Stripe (test-mode or real).
4. Wait ≤ 5 seconds.
5. Re-attempt the MCP tool call → expect success. (If invalidation worked: instant. If it failed: within 30 s.)

- [ ] **Scenario B: Enterprise seat invite → new member gets MCP access**

1. Start with an Enterprise org in `billing_status='active'`.
2. Invite a free user.
3. User accepts the invite.
4. Within 30 s, have the invited user make an MCP tool call → expect success (inherited from org).

- [ ] **Scenario C: Org downgrade → member with personal Pro keeps Pro, not Enterprise**

1. Start with a member who has personal Pro AND is in an active Enterprise org.
2. Owner cancels the org sub.
3. Within 30 s, have the member's entitlement resolve to `pro` (not `free`, not `enterprise`).
4. Their MCP tool calls should still work (Pro grants MCP access).

- [ ] **Scenario D: Free member in downgraded org → loses access**

1. Start with a free member of an active Enterprise org (inherits enterprise).
2. Org is downgraded.
3. Within 30 s, the member's entitlement resolver returns `free`.
4. Their MCP tool calls return 403.

---

## Completion check

All 12 mutation call sites wired, P2-Y resolver in place, organizations.tier column live, mcp-server TTL split + invalidation endpoint live, downgrade handler no longer clobbers personal tiers, Railway env vars set in both environments, all four manual smoke scenarios pass.
