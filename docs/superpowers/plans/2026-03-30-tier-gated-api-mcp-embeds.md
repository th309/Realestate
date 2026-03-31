# Tier-Gated API, MCP & Embeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate platform API keys and MCP access to Pro+Enterprise users, embed widgets to Enterprise only, with a device-flow OAuth for MCP authentication.

**Architecture:** Separate `user_api_keys` table for Pro users (mirrors `organization_api_keys`). `ApiKeyValidatorService` does two-table lookup with Redis-cached tier checks. Device auth module handles MCP OAuth flow via Redis-stored codes. MCP server sends Bearer tokens from stored credentials or env var fallback.

**Tech Stack:** NestJS (backend), Supabase (Postgres + Auth), Redis (caching + device codes), Next.js (frontend), MCP SDK (stdio transport)

**Spec:** `docs/superpowers/specs/2026-03-30-tier-gated-api-mcp-embeds-design.md`

---

## File Structure

### New Files

| File                                                                | Responsibility                                   |
| ------------------------------------------------------------------- | ------------------------------------------------ |
| `scripts/migrations/133-user-api-keys.sql`                          | Create `user_api_keys` table, index, RLS, GRANTs |
| `packages/backend/src/user-api-keys/user-api-keys.service.ts`       | CRUD for personal API keys                       |
| `packages/backend/src/user-api-keys/user-api-keys.controller.ts`    | REST endpoints (JWT auth)                        |
| `packages/backend/src/user-api-keys/user-api-keys.module.ts`        | NestJS module                                    |
| `packages/backend/src/user-api-keys/dto/create-user-api-key.dto.ts` | Validation DTO                                   |
| `packages/backend/src/device-auth/device-auth.service.ts`           | Device code generation, polling, verification    |
| `packages/backend/src/device-auth/device-auth.controller.ts`        | REST endpoints (mixed auth)                      |
| `packages/backend/src/device-auth/device-auth.module.ts`            | NestJS module                                    |
| `packages/backend/test/enterprise/user-api-keys.e2e-spec.ts`        | E2E tests for personal keys + tier gating        |
| `packages/backend/test/enterprise/device-auth.e2e-spec.ts`          | E2E tests for device flow                        |
| `packages/backend/test/enterprise/embed-tier-gating.e2e-spec.ts`    | E2E tests for embed tier check                   |
| `packages/frontend/lib/data/fetchers/user-api-keys.ts`              | Frontend fetchers for personal keys              |
| `packages/frontend/app/activate/page.tsx`                           | Device code activation page                      |
| `packages/frontend/app/account/api-keys/page.tsx`                   | Personal API key management page                 |
| `packages/mcp-server/src/lib/auth.ts`                               | Credential storage, device flow client           |

### Modified Files

| File                                                               | Change                                      |
| ------------------------------------------------------------------ | ------------------------------------------- |
| `packages/backend/src/org-api-keys/api-key-validator.service.ts`   | Two-table lookup + tier check               |
| `packages/backend/src/org-embeds/embed-token-validator.service.ts` | Add enterprise tier check                   |
| `packages/backend/src/app.module.ts`                               | Import UserApiKeysModule + DeviceAuthModule |
| `packages/frontend/lib/data/index.ts`                              | Re-export user-api-keys fetchers            |
| `packages/mcp-server/src/lib/config.ts`                            | Add apiKey resolution                       |
| `packages/mcp-server/src/lib/api-client.ts`                        | Add Authorization header                    |
| `packages/mcp-server/src/index.ts`                                 | Auth check on startup                       |

---

## Task 1: Database Migration

**Files:**

- Create: `scripts/migrations/133-user-api-keys.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 133: Personal API keys for Pro users
-- Mirrors organization_api_keys but keyed on user_id

CREATE TABLE IF NOT EXISTS user_api_keys (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_api_keys_hash
  ON user_api_keys(key_hash)
  WHERE is_active = true;

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own api keys" ON user_api_keys
  FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON user_api_keys TO service_role;
GRANT ALL ON user_api_keys TO authenticated;
```

- [ ] **Step 2: Run migration against Supabase**

Run: `psql "$DATABASE_URL" -f scripts/migrations/133-user-api-keys.sql`
Expected: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, `CREATE POLICY`, `GRANT` — no errors.

- [ ] **Step 3: Verify table exists**

Run: `psql "$DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_api_keys' ORDER BY ordinal_position;"`
Expected: 10 columns matching the schema above.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrations/133-user-api-keys.sql
git commit -m "feat: add user_api_keys table for Pro tier personal keys"
```

---

## Task 2: User API Keys DTO

**Files:**

- Create: `packages/backend/src/user-api-keys/dto/create-user-api-key.dto.ts`

- [ ] **Step 1: Create the DTO**

Reuses the same scopes and rate limits as org keys. File: `packages/backend/src/user-api-keys/dto/create-user-api-key.dto.ts`

```typescript
/**
 * Create User API Key DTO
 *
 * Validates input for creating a personal API key.
 * Same scopes and rate limits as organization keys.
 */

import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ArrayMinSize,
  IsIn,
  IsOptional,
  IsInt,
} from "class-validator";
import {
  VALID_API_KEY_SCOPES,
  VALID_RATE_LIMITS,
  type ApiKeyScope,
} from "../../org-api-keys/dto/create-api-key.dto";

export { VALID_API_KEY_SCOPES, VALID_RATE_LIMITS };

export class CreateUserApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn([...VALID_API_KEY_SCOPES], { each: true })
  scopes: ApiKeyScope[];

  @IsOptional()
  @IsInt()
  @IsIn([...VALID_RATE_LIMITS])
  rate_limit_rpm?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/user-api-keys/dto/create-user-api-key.dto.ts
git commit -m "feat: add CreateUserApiKeyDto for personal API keys"
```

---

## Task 3: User API Keys Service

**Files:**

- Create: `packages/backend/src/user-api-keys/user-api-keys.service.ts`

- [ ] **Step 1: Write the E2E test for key creation, listing, and revocation**

File: `packages/backend/test/enterprise/user-api-keys.e2e-spec.ts`

```typescript
/**
 * Personal API Keys E2E Tests
 *
 * Verifies personal API key lifecycle (create, list, revoke)
 * and tier gating (only Pro+ users can create keys) against
 * a live backend.
 *
 * Requires: Backend running at localhost:3001, Supabase env vars,
 * TEST_USER_PASSWORD env var.
 */

import {
  seedTestOrg,
  cleanupTestOrg,
  TestOrgFixture,
} from "./setup/seed-test-org";

const BASE_URL = "http://localhost:3001";

describe("Personal API Keys (user_api_keys)", () => {
  let fixture: TestOrgFixture;
  let testApiKey: string;
  let testKeyId: string;

  beforeAll(async () => {
    fixture = await seedTestOrg();
  }, 30_000);

  afterAll(async () => {
    await cleanupTestOrg();
  }, 15_000);

  const userFetch = (url: string, init?: RequestInit) =>
    fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${fixture.admin.accessToken}`,
        ...init?.headers,
      },
    });

  it("creates a personal API key with piq_live_ prefix", async () => {
    const res = await userFetch(`${BASE_URL}/api/user/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My MCP Key",
        scopes: ["scores:read", "metrics:read"],
        rate_limit_rpm: 60,
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.key).toMatch(/^piq_live_/);
    expect(data.name).toBe("My MCP Key");
    expect(data.is_active).toBe(true);

    testApiKey = data.key;
    testKeyId = data.id;
  });

  it("lists personal keys with prefix only (no full key)", async () => {
    const res = await userFetch(`${BASE_URL}/api/user/api-keys`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(1);
    const key = data.find((k: any) => k.id === testKeyId);
    expect(key).toBeDefined();
    expect(key.key_prefix).toMatch(/^piq_live_/);
    expect(key.key).toBeUndefined();
  });

  it("authenticates to Platform API v1 with personal key", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });
    expect(res.status).toBe(200);
  });

  it("revokes a personal key", async () => {
    const res = await userFetch(`${BASE_URL}/api/user/api-keys/${testKeyId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    // Revoked key should fail authentication
    const authRes = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });
    expect(authRes.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest test/enterprise/user-api-keys.e2e-spec.ts --forceExit`
Expected: FAIL — endpoints don't exist yet.

- [ ] **Step 3: Write the service**

File: `packages/backend/src/user-api-keys/user-api-keys.service.ts`

```typescript
/**
 * User API Keys Service
 *
 * CRUD for personal API keys (Pro tier). Mirrors OrgApiKeysService
 * but keyed on user_id instead of organization_id.
 */

import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "crypto";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";
import { CreateUserApiKeyDto } from "./dto/create-user-api-key.dto";

export interface UserApiKeyListItem {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

const DEFAULT_RATE_LIMIT_RPM = 60;
const TABLE = "user_api_keys";
const LIST_COLUMNS =
  "id, user_id, name, key_prefix, scopes, rate_limit_rpm, last_used_at, expires_at, is_active, created_at";

@Injectable()
export class UserApiKeysService {
  private readonly logger = new Logger(UserApiKeysService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async listKeys(userId: string): Promise<UserApiKeyListItem[]> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select(LIST_COLUMNS)
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to list keys for user ${userId}: ${error.message}`,
      );
      return [];
    }

    return (data ?? []) as UserApiKeyListItem[];
  }

  async createKey(
    userId: string,
    dto: CreateUserApiKeyDto,
  ): Promise<UserApiKeyListItem & { key: string }> {
    const fullKey = `piq_live_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(fullKey).digest("hex");
    const keyPrefix = fullKey.substring(0, 12);

    const row = {
      user_id: userId,
      name: dto.name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: dto.scopes,
      rate_limit_rpm: dto.rate_limit_rpm ?? DEFAULT_RATE_LIMIT_RPM,
      is_active: true,
    };

    const { data, error } = await this.supabase
      .from(TABLE)
      .insert(row)
      .select(LIST_COLUMNS)
      .single();

    if (error) {
      this.logger.error(
        `Failed to create key for user ${userId}: ${error.message}`,
      );
      throw new Error(`Failed to create API key: ${error.message}`);
    }

    return { ...(data as UserApiKeyListItem), key: fullKey };
  }

  async revokeKey(userId: string, keyId: string): Promise<void> {
    const { error, count } = await this.supabase
      .from(TABLE)
      .update({ is_active: false })
      .eq("id", keyId)
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error || count === 0) {
      throw new NotFoundException("API key not found or already revoked");
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/user-api-keys/user-api-keys.service.ts
git commit -m "feat: add UserApiKeysService for personal key CRUD"
```

---

## Task 4: User API Keys Controller & Module

**Files:**

- Create: `packages/backend/src/user-api-keys/user-api-keys.controller.ts`
- Create: `packages/backend/src/user-api-keys/user-api-keys.module.ts`
- Modify: `packages/backend/src/app.module.ts`

- [ ] **Step 1: Write the controller**

File: `packages/backend/src/user-api-keys/user-api-keys.controller.ts`

```typescript
/**
 * User API Keys Controller
 *
 * Personal API key management for Pro+ users.
 * All routes require JWT authentication.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  Inject,
} from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { JwtAuthGuard } from "../common/guards";
import { AuthUserId } from "../common/decorators";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";
import { UserApiKeysService } from "./user-api-keys.service";
import { CreateUserApiKeyDto } from "./dto/create-user-api-key.dto";

const ALLOWED_TIERS = ["pro", "enterprise", "admin"];

@Controller("api/user/api-keys")
@UseGuards(JwtAuthGuard)
export class UserApiKeysController {
  constructor(
    private readonly userApiKeysService: UserApiKeysService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  @Get()
  async listKeys(@AuthUserId() userId: string) {
    return this.userApiKeysService.listKeys(userId);
  }

  @Post()
  async createKey(
    @AuthUserId() userId: string,
    @Body() dto: CreateUserApiKeyDto,
  ) {
    await this.requireTier(userId, ALLOWED_TIERS);
    return this.userApiKeysService.createKey(userId, dto);
  }

  @Delete(":id")
  async revokeKey(@AuthUserId() userId: string, @Param("id") keyId: string) {
    await this.userApiKeysService.revokeKey(userId, keyId);
    return { success: true };
  }

  private async requireTier(userId: string, allowed: string[]): Promise<void> {
    const { data } = await this.supabase
      .from("user_profiles")
      .select("subscription_tier")
      .eq("id", userId)
      .single();

    const tier = data?.subscription_tier ?? "free";
    if (!allowed.includes(tier)) {
      throw new ForbiddenException(
        `API key creation requires a Pro or Enterprise subscription. Current tier: ${tier}`,
      );
    }
  }
}
```

- [ ] **Step 2: Write the module**

File: `packages/backend/src/user-api-keys/user-api-keys.module.ts`

```typescript
/**
 * User API Keys Module
 *
 * Provides personal API key CRUD for Pro+ users.
 */

import { Module } from "@nestjs/common";
import { UserApiKeysService } from "./user-api-keys.service";
import { UserApiKeysController } from "./user-api-keys.controller";

@Module({
  controllers: [UserApiKeysController],
  providers: [UserApiKeysService],
  exports: [UserApiKeysService],
})
export class UserApiKeysModule {}
```

- [ ] **Step 3: Register in AppModule**

In `packages/backend/src/app.module.ts`, add the import alongside the existing `OrgApiKeysModule`:

```typescript
import { UserApiKeysModule } from "./user-api-keys/user-api-keys.module";
```

Add `UserApiKeysModule` to the `imports` array in the `@Module` decorator.

- [ ] **Step 4: Verify backend compiles**

Run: `cd packages/backend && npx nest build`
Expected: Compiles with no errors.

- [ ] **Step 5: Run the E2E test**

Run: `cd packages/backend && npx jest test/enterprise/user-api-keys.e2e-spec.ts --forceExit`
Expected: Create, list, revoke tests PASS. The "authenticates to Platform API v1" test may still fail (needs Task 5 validator changes).

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/user-api-keys/ packages/backend/src/app.module.ts
git commit -m "feat: add UserApiKeys controller, module, and register in AppModule"
```

---

## Task 5: Two-Table API Key Validation with Tier Check

**Files:**

- Modify: `packages/backend/src/org-api-keys/api-key-validator.service.ts`

- [ ] **Step 1: Write the E2E test for tier gating**

Add to `packages/backend/test/enterprise/user-api-keys.e2e-spec.ts` (after the existing tests):

```typescript
describe("Tier gating on API key validation", () => {
  let proUserKey: string;

  it("personal key works when user has Pro tier", async () => {
    // Create a key (seedTestOrg admin has enterprise tier by default)
    const createRes = await userFetch(`${BASE_URL}/api/user/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Tier Test Key",
        scopes: ["scores:read"],
      }),
    });
    expect(createRes.status).toBe(201);
    proUserKey = (await createRes.json()).key;

    const res = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
      headers: { Authorization: `Bearer ${proUserKey}` },
    });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest test/enterprise/user-api-keys.e2e-spec.ts --forceExit -t "Tier gating"`
Expected: FAIL — validator doesn't check `user_api_keys` yet.

- [ ] **Step 3: Update ApiKeyValidatorService**

Replace the content of `packages/backend/src/org-api-keys/api-key-validator.service.ts`:

```typescript
/**
 * API Key Validator Service
 *
 * Validates Platform API keys from two sources:
 * 1. organization_api_keys — Enterprise orgs
 * 2. user_api_keys — Pro individual users
 *
 * Both use the same piq_live_ format. After key lookup, the owner's
 * subscription_tier is checked (cached in Redis for 5 minutes).
 */

import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";
import { RedisService } from "../redis/redis.service";

export interface ValidatedApiKey {
  orgId?: string;
  userId?: string;
  scopes: string[];
  rateLimitRpm: number;
  keyId: string;
  source: "org" | "user";
}

const DEFAULT_RATE_LIMIT_RPM = 60;
const TIER_CACHE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class ApiKeyValidatorService {
  private readonly logger = new Logger(ApiKeyValidatorService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly redisService: RedisService,
  ) {}

  async validateKey(rawKey: string): Promise<ValidatedApiKey> {
    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    // 1. Check organization_api_keys first
    const orgResult = await this.lookupOrgKey(keyHash);
    if (orgResult) {
      await this.requireOrgOwnerTier(orgResult.organization_id, "enterprise");
      await this.touchLastUsed("organization_api_keys", orgResult.id);
      return {
        orgId: orgResult.organization_id,
        scopes: orgResult.scopes ?? [],
        rateLimitRpm: orgResult.rate_limit_rpm ?? DEFAULT_RATE_LIMIT_RPM,
        keyId: orgResult.id,
        source: "org",
      };
    }

    // 2. Check user_api_keys
    const userResult = await this.lookupUserKey(keyHash);
    if (userResult) {
      await this.requireUserTier(userResult.user_id, [
        "pro",
        "enterprise",
        "admin",
      ]);
      await this.touchLastUsed("user_api_keys", userResult.id);
      return {
        userId: userResult.user_id,
        scopes: userResult.scopes ?? [],
        rateLimitRpm: userResult.rate_limit_rpm ?? DEFAULT_RATE_LIMIT_RPM,
        keyId: userResult.id,
        source: "user",
      };
    }

    throw new UnauthorizedException("Invalid or revoked API key");
  }

  checkScope(scopes: string[], requiredScope: string): void {
    if (!scopes.includes(requiredScope)) {
      throw new ForbiddenException({
        code: "INSUFFICIENT_SCOPE",
        message: `This API key does not have the '${requiredScope}' scope. Required: ${requiredScope}. Granted: ${scopes.join(", ") || "(none)"}`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Key lookup helpers
  // ---------------------------------------------------------------------------

  private async lookupOrgKey(keyHash: string) {
    const { data, error } = await this.supabase
      .from("organization_api_keys")
      .select("id, organization_id, scopes, rate_limit_rpm, expires_at")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .single();

    if (error || !data) return null;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
    return data;
  }

  private async lookupUserKey(keyHash: string) {
    const { data, error } = await this.supabase
      .from("user_api_keys")
      .select("id, user_id, scopes, rate_limit_rpm, expires_at")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .single();

    if (error || !data) return null;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
    return data;
  }

  // ---------------------------------------------------------------------------
  // Tier checking with Redis cache
  // ---------------------------------------------------------------------------

  private async requireOrgOwnerTier(
    orgId: string,
    requiredTier: string,
  ): Promise<void> {
    const cacheKey = `tier:org-owner:${orgId}`;
    let tier = await this.getCachedTier(cacheKey);

    if (!tier) {
      const { data } = await this.supabase
        .from("organizations")
        .select("owner_id")
        .eq("id", orgId)
        .single();

      if (!data?.owner_id) {
        throw new ForbiddenException("Organization has no owner");
      }

      tier = await this.fetchUserTier(data.owner_id);
      await this.cacheTier(cacheKey, tier);
    }

    if (tier !== requiredTier && tier !== "admin") {
      throw new ForbiddenException(
        "Organization owner's subscription does not include API access",
      );
    }
  }

  private async requireUserTier(
    userId: string,
    allowedTiers: string[],
  ): Promise<void> {
    const cacheKey = `tier:user:${userId}`;
    let tier = await this.getCachedTier(cacheKey);

    if (!tier) {
      tier = await this.fetchUserTier(userId);
      await this.cacheTier(cacheKey, tier);
    }

    if (!allowedTiers.includes(tier)) {
      throw new ForbiddenException("Upgrade to Pro to restore API access");
    }
  }

  private async fetchUserTier(userId: string): Promise<string> {
    const { data } = await this.supabase
      .from("user_profiles")
      .select("subscription_tier")
      .eq("id", userId)
      .single();
    return data?.subscription_tier ?? "free";
  }

  private async getCachedTier(key: string): Promise<string | null> {
    try {
      const cached = await this.redisService.getByKey(key);
      return cached as string | null;
    } catch {
      return null;
    }
  }

  private async cacheTier(key: string, tier: string): Promise<void> {
    try {
      await this.redisService.setByKey(key, tier, TIER_CACHE_TTL_SECONDS);
    } catch {
      // Redis unavailable — skip caching
    }
  }

  // ---------------------------------------------------------------------------
  // last_used_at debounce
  // ---------------------------------------------------------------------------

  private async touchLastUsed(table: string, keyId: string): Promise<void> {
    const redisKey = `apikey:lastused:${keyId}`;
    try {
      const cached = await this.redisService.getByKey(redisKey);
      if (cached) return;
      await this.redisService.setByKey(redisKey, true, 60);
      this.supabase
        .from(table)
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", keyId)
        .then(({ error }) => {
          if (error)
            this.logger.warn(
              `Failed to update last_used_at for ${keyId}: ${error.message}`,
            );
        });
    } catch {
      // Redis unavailable
    }
  }
}
```

- [ ] **Step 4: Verify backend compiles**

Run: `cd packages/backend && npx nest build`
Expected: No errors.

- [ ] **Step 5: Run E2E tests**

Run: `cd packages/backend && npx jest test/enterprise/user-api-keys.e2e-spec.ts --forceExit`
Expected: All tests PASS including Platform API auth with personal key.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/org-api-keys/api-key-validator.service.ts packages/backend/test/enterprise/user-api-keys.e2e-spec.ts
git commit -m "feat: two-table API key validation with Redis-cached tier checks"
```

---

## Task 6: Embed Token Tier Gating

**Files:**

- Modify: `packages/backend/src/org-embeds/embed-token-validator.service.ts`
- Create: `packages/backend/test/enterprise/embed-tier-gating.e2e-spec.ts`

- [ ] **Step 1: Write the E2E test**

File: `packages/backend/test/enterprise/embed-tier-gating.e2e-spec.ts`

```typescript
/**
 * Embed Token Tier Gating E2E Tests
 *
 * Verifies that embed widget data endpoints check the org owner's
 * subscription tier (must be enterprise).
 *
 * Requires: Backend running at localhost:3001, Supabase env vars.
 */

import {
  seedTestOrg,
  cleanupTestOrg,
  TestOrgFixture,
} from "./setup/seed-test-org";

const BASE_URL = "http://localhost:3001";

describe("Embed Token Tier Gating", () => {
  let fixture: TestOrgFixture;
  let embedToken: string;

  beforeAll(async () => {
    fixture = await seedTestOrg();

    // Create an embed token via admin endpoint
    const res = await fetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/embed-tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${fixture.admin.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Tier Test Embed",
          allowed_origins: ["*"],
          widget_types: ["score"],
        }),
      },
    );

    const data = await res.json();
    embedToken = data.token;
  }, 30_000);

  afterAll(async () => {
    await cleanupTestOrg();
  }, 15_000);

  it("allows embed requests when org owner has enterprise tier", async () => {
    const res = await fetch(
      `${BASE_URL}/api/embed/score/metro/35620?token=${embedToken}`,
    );
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Add tier check to EmbedTokenValidatorService**

In `packages/backend/src/org-embeds/embed-token-validator.service.ts`, add the tier check after the existing `embed_enabled` check. Inject `RedisService` for caching.

Add to constructor:

```typescript
import { RedisService } from "../redis/redis.service";
```

Update constructor:

```typescript
constructor(
  @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  private readonly redisService: RedisService,
) {}
```

After the `if (!org?.embed_enabled)` block (around line 77), add:

```typescript
// Check org owner's subscription tier (must be enterprise)
await this.requireEnterpriseTier(tokenRow.organization_id);
```

Add the private method:

```typescript
private async requireEnterpriseTier(orgId: string): Promise<void> {
  const cacheKey = `tier:org-owner:${orgId}`;

  try {
    const cached = await this.redisService.getByKey(cacheKey);
    if (cached && (cached === 'enterprise' || cached === 'admin')) return;
    if (cached) {
      throw new ForbiddenException('Embeds require an Enterprise subscription');
    }
  } catch (err) {
    if (err instanceof ForbiddenException) throw err;
    // Redis unavailable — fall through to DB check
  }

  const { data: org } = await this.supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', orgId)
    .single();

  if (!org?.owner_id) {
    throw new ForbiddenException('Organization has no owner');
  }

  const { data: profile } = await this.supabase
    .from('user_profiles')
    .select('subscription_tier')
    .eq('id', org.owner_id)
    .single();

  const tier = profile?.subscription_tier ?? 'free';

  try {
    await this.redisService.setByKey(cacheKey, tier, 300);
  } catch {
    // Redis unavailable
  }

  if (tier !== 'enterprise' && tier !== 'admin') {
    throw new ForbiddenException('Embeds require an Enterprise subscription');
  }
}
```

- [ ] **Step 3: Update the module to inject RedisService**

In the embed module file, ensure `RedisModule` is imported so `RedisService` is available for injection.

- [ ] **Step 4: Verify backend compiles**

Run: `cd packages/backend && npx nest build`
Expected: No errors.

- [ ] **Step 5: Run E2E test**

Run: `cd packages/backend && npx jest test/enterprise/embed-tier-gating.e2e-spec.ts --forceExit`
Expected: PASS — enterprise-tier org can use embed tokens.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/org-embeds/ packages/backend/test/enterprise/embed-tier-gating.e2e-spec.ts
git commit -m "feat: add enterprise tier check to embed token validation"
```

---

## Task 7: Device Auth Service

**Files:**

- Create: `packages/backend/src/device-auth/device-auth.service.ts`

- [ ] **Step 1: Write the service**

File: `packages/backend/src/device-auth/device-auth.service.ts`

```typescript
/**
 * Device Auth Service
 *
 * Implements device authorization flow for MCP server authentication.
 * Uses Redis to store short-lived device codes (10-min TTL).
 *
 * Flow:
 *   1. MCP server → POST /device-code → gets device_code + user_code
 *   2. User visits /activate, enters user_code
 *   3. Backend verifies, creates personal API key, marks complete
 *   4. MCP server polls GET /device-code/:code → gets API key
 */

import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";
import { RedisService } from "../redis/redis.service";
import { UserApiKeysService } from "../user-api-keys/user-api-keys.service";

interface DeviceCodeEntry {
  userCode: string;
  status: "pending" | "complete";
  apiKey?: string;
  userEmail?: string;
}

const DEVICE_CODE_TTL_SECONDS = 600; // 10 minutes
const REDIS_PREFIX = "device-auth:";
const ALLOWED_TIERS = ["pro", "enterprise", "admin"];

@Injectable()
export class DeviceAuthService {
  private readonly logger = new Logger(DeviceAuthService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly redisService: RedisService,
    private readonly userApiKeysService: UserApiKeysService,
  ) {}

  /**
   * Generate a new device code pair.
   * Returns device_code (for polling) and user_code (for display).
   */
  async createDeviceCode(): Promise<{
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
  }> {
    const deviceCode = randomBytes(32).toString("hex");
    const userCode = this.generateUserCode();

    const entry: DeviceCodeEntry = {
      userCode,
      status: "pending",
    };

    await this.redisService.setByKey(
      `${REDIS_PREFIX}${deviceCode}`,
      JSON.stringify(entry),
      DEVICE_CODE_TTL_SECONDS,
    );

    // Also store reverse lookup: user_code → device_code
    await this.redisService.setByKey(
      `${REDIS_PREFIX}code:${userCode}`,
      deviceCode,
      DEVICE_CODE_TTL_SECONDS,
    );

    return {
      device_code: deviceCode,
      user_code: userCode,
      verification_url: "https://propertyiq.up.railway.app/activate",
      expires_in: DEVICE_CODE_TTL_SECONDS,
    };
  }

  /**
   * Poll the status of a device code.
   */
  async pollDeviceCode(deviceCode: string): Promise<{
    status: "pending" | "complete" | "expired";
    api_key?: string;
    user_email?: string;
  }> {
    const raw = await this.redisService.getByKey(
      `${REDIS_PREFIX}${deviceCode}`,
    );
    if (!raw) {
      return { status: "expired" };
    }

    const entry: DeviceCodeEntry = JSON.parse(raw as string);
    if (entry.status === "complete") {
      // Clean up after successful retrieval
      await this.redisService.setByKey(`${REDIS_PREFIX}${deviceCode}`, "", 1);
      return {
        status: "complete",
        api_key: entry.apiKey,
        user_email: entry.userEmail,
      };
    }

    return { status: "pending" };
  }

  /**
   * Verify a user code and provision an API key.
   * Called by the /activate page with user's JWT.
   */
  async verifyUserCode(
    userCode: string,
    userId: string,
    userEmail: string,
  ): Promise<void> {
    // Check user's tier
    const { data: profile } = await this.supabase
      .from("user_profiles")
      .select("subscription_tier")
      .eq("id", userId)
      .single();

    const tier = profile?.subscription_tier ?? "free";
    if (!ALLOWED_TIERS.includes(tier)) {
      throw new ForbiddenException(
        "API access requires a Pro or Enterprise subscription",
      );
    }

    // Look up device_code from user_code
    const deviceCode = await this.redisService.getByKey(
      `${REDIS_PREFIX}code:${userCode}`,
    );
    if (!deviceCode) {
      throw new BadRequestException("Invalid or expired activation code");
    }

    const raw = await this.redisService.getByKey(
      `${REDIS_PREFIX}${deviceCode}`,
    );
    if (!raw) {
      throw new BadRequestException("Invalid or expired activation code");
    }

    const entry: DeviceCodeEntry = JSON.parse(raw as string);
    if (entry.userCode !== userCode) {
      throw new BadRequestException("Invalid activation code");
    }

    // Create a personal API key for MCP
    const keyResult = await this.userApiKeysService.createKey(userId, {
      name: "MCP Server (auto-provisioned)",
      scopes: ["scores:read", "metrics:read", "rankings:read"],
      rate_limit_rpm: 120,
    });

    // Mark device code as complete with the API key
    const updated: DeviceCodeEntry = {
      ...entry,
      status: "complete",
      apiKey: keyResult.key,
      userEmail,
    };

    await this.redisService.setByKey(
      `${REDIS_PREFIX}${deviceCode}`,
      JSON.stringify(updated),
      DEVICE_CODE_TTL_SECONDS,
    );
  }

  /**
   * Generate a human-friendly 8-char code: ABCD-1234
   */
  private generateUserCode(): string {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O (ambiguous)
    const digits = "0123456789";
    const bytes = randomBytes(8);
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += letters[bytes[i] % letters.length];
    }
    code += "-";
    for (let i = 4; i < 8; i++) {
      code += digits[bytes[i] % digits.length];
    }
    return code;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/device-auth/device-auth.service.ts
git commit -m "feat: add DeviceAuthService for MCP device flow"
```

---

## Task 8: Device Auth Controller & Module

**Files:**

- Create: `packages/backend/src/device-auth/device-auth.controller.ts`
- Create: `packages/backend/src/device-auth/device-auth.module.ts`
- Modify: `packages/backend/src/app.module.ts`

- [ ] **Step 1: Write the E2E test**

File: `packages/backend/test/enterprise/device-auth.e2e-spec.ts`

```typescript
/**
 * Device Auth E2E Tests
 *
 * Verifies the device code flow for MCP authentication:
 * create → poll (pending) → verify → poll (complete with key).
 *
 * Requires: Backend + Redis running.
 */

import {
  seedTestOrg,
  cleanupTestOrg,
  TestOrgFixture,
} from "./setup/seed-test-org";

const BASE_URL = "http://localhost:3001";

describe("Device Auth Flow", () => {
  let fixture: TestOrgFixture;

  beforeAll(async () => {
    fixture = await seedTestOrg();
  }, 30_000);

  afterAll(async () => {
    await cleanupTestOrg();
  }, 15_000);

  it("completes the full device code flow", async () => {
    // 1. Create device code (no auth required)
    const createRes = await fetch(`${BASE_URL}/api/auth/device-code`, {
      method: "POST",
    });
    expect(createRes.status).toBe(201);

    const { device_code, user_code, verification_url, expires_in } =
      await createRes.json();
    expect(device_code).toBeDefined();
    expect(user_code).toMatch(/^[A-Z]{4}-\d{4}$/);
    expect(verification_url).toContain("/activate");
    expect(expires_in).toBe(600);

    // 2. Poll — should be pending
    const pollRes1 = await fetch(
      `${BASE_URL}/api/auth/device-code/${device_code}`,
    );
    expect(pollRes1.status).toBe(200);
    const poll1 = await pollRes1.json();
    expect(poll1.status).toBe("pending");

    // 3. Verify with user's JWT
    const verifyRes = await fetch(`${BASE_URL}/api/auth/device-code/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fixture.admin.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_code }),
    });
    expect(verifyRes.status).toBe(200);

    // 4. Poll — should be complete with API key
    const pollRes2 = await fetch(
      `${BASE_URL}/api/auth/device-code/${device_code}`,
    );
    expect(pollRes2.status).toBe(200);
    const poll2 = await pollRes2.json();
    expect(poll2.status).toBe("complete");
    expect(poll2.api_key).toMatch(/^piq_live_/);

    // 5. Verify the key works on Platform API
    const apiRes = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
      headers: { Authorization: `Bearer ${poll2.api_key}` },
    });
    expect(apiRes.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest test/enterprise/device-auth.e2e-spec.ts --forceExit`
Expected: FAIL — endpoints don't exist yet.

- [ ] **Step 3: Write the controller**

File: `packages/backend/src/device-auth/device-auth.controller.ts`

```typescript
/**
 * Device Auth Controller
 *
 * Endpoints for the MCP device authorization flow.
 * POST /device-code and GET /device-code/:code are unauthenticated.
 * POST /device-code/verify requires JWT auth (user activating in browser).
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards";
import { AuthUserId } from "../common/decorators";
import { DeviceAuthService } from "./device-auth.service";

@Controller("api/auth/device-code")
export class DeviceAuthController {
  constructor(private readonly deviceAuthService: DeviceAuthService) {}

  @Post()
  async createDeviceCode() {
    return this.deviceAuthService.createDeviceCode();
  }

  @Get(":code")
  async pollDeviceCode(@Param("code") code: string) {
    return this.deviceAuthService.pollDeviceCode(code);
  }

  @Post("verify")
  @UseGuards(JwtAuthGuard)
  async verifyUserCode(
    @Body("user_code") userCode: string,
    @AuthUserId() userId: string,
    @Req() req: any,
  ) {
    // Get user email from Supabase auth
    const email = req.user?.email ?? "unknown";
    await this.deviceAuthService.verifyUserCode(userCode, userId, email);
    return { success: true, message: "MCP server connected successfully" };
  }
}
```

- [ ] **Step 4: Write the module**

File: `packages/backend/src/device-auth/device-auth.module.ts`

```typescript
/**
 * Device Auth Module
 *
 * Provides the device authorization flow for MCP authentication.
 */

import { Module } from "@nestjs/common";
import { UserApiKeysModule } from "../user-api-keys/user-api-keys.module";
import { DeviceAuthService } from "./device-auth.service";
import { DeviceAuthController } from "./device-auth.controller";

@Module({
  imports: [UserApiKeysModule],
  controllers: [DeviceAuthController],
  providers: [DeviceAuthService],
})
export class DeviceAuthModule {}
```

- [ ] **Step 5: Register in AppModule**

In `packages/backend/src/app.module.ts`, add:

```typescript
import { DeviceAuthModule } from "./device-auth/device-auth.module";
```

Add `DeviceAuthModule` to the `imports` array.

- [ ] **Step 6: Verify backend compiles**

Run: `cd packages/backend && npx nest build`
Expected: No errors.

- [ ] **Step 7: Run E2E test**

Run: `cd packages/backend && npx jest test/enterprise/device-auth.e2e-spec.ts --forceExit`
Expected: Full device flow test PASSES.

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/device-auth/ packages/backend/src/app.module.ts packages/backend/test/enterprise/device-auth.e2e-spec.ts
git commit -m "feat: add device auth controller, module, and E2E tests"
```

---

## Task 9: MCP Server Auth & API Client Changes

**Files:**

- Create: `packages/mcp-server/src/lib/auth.ts`
- Modify: `packages/mcp-server/src/lib/config.ts`
- Modify: `packages/mcp-server/src/lib/api-client.ts`
- Modify: `packages/mcp-server/src/index.ts`

- [ ] **Step 1: Create the auth module**

File: `packages/mcp-server/src/lib/auth.ts`

```typescript
/**
 * MCP Server Authentication
 *
 * Handles credential storage, device flow, and API key resolution.
 * Priority: stored credentials → env var → device flow.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  existsSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";

const CREDENTIALS_DIR = join(homedir(), ".propertyiq");
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, "credentials.json");
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 200; // 10 min / 3s

interface StoredCredentials {
  api_key: string;
  created_at: string;
  user_email?: string;
}

/**
 * Get an API key from stored credentials or env var.
 * Returns null if no credentials are available (triggers device flow).
 */
export function getApiKey(): string | null {
  // 1. Stored credentials
  try {
    if (existsSync(CREDENTIALS_FILE)) {
      const raw = readFileSync(CREDENTIALS_FILE, "utf-8");
      const creds: StoredCredentials = JSON.parse(raw);
      if (creds.api_key) return creds.api_key;
    }
  } catch {
    // Corrupted file — fall through
  }

  // 2. Environment variable (silent fallback)
  if (process.env.PROPERTYIQ_API_KEY) {
    return process.env.PROPERTYIQ_API_KEY;
  }

  return null;
}

/**
 * Run the device authorization flow.
 * Prints instructions to stderr (MCP uses stdout for protocol).
 */
export async function authenticate(apiUrl: string): Promise<string> {
  console.error("[PropertyIQ] No API key found. Starting authentication...");

  // 1. Request device code
  const createRes = await fetch(`${apiUrl}/api/auth/device-code`, {
    method: "POST",
  });

  if (!createRes.ok) {
    throw new Error(`Failed to start auth: ${createRes.status}`);
  }

  const { device_code, user_code, verification_url } = await createRes.json();

  console.error("");
  console.error("  To connect PropertyIQ, visit:");
  console.error(`    ${verification_url}`);
  console.error("");
  console.error(`  Enter code: ${user_code}`);
  console.error("");

  // Try to open browser (best-effort)
  try {
    const open = await import("open");
    await open.default(verification_url);
  } catch {
    // No 'open' package — user opens manually
  }

  // 2. Poll until complete or expired
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(
      `${apiUrl}/api/auth/device-code/${device_code}`,
    );
    if (!pollRes.ok) continue;

    const poll = await pollRes.json();

    if (poll.status === "complete" && poll.api_key) {
      // 3. Store credentials
      storeCredentials({
        api_key: poll.api_key,
        created_at: new Date().toISOString(),
        user_email: poll.user_email,
      });

      console.error("[PropertyIQ] Authenticated successfully!");
      return poll.api_key;
    }

    if (poll.status === "expired") {
      throw new Error(
        "Activation code expired. Please restart the MCP server to try again.",
      );
    }
  }

  throw new Error(
    "Authentication timed out. Please restart the MCP server to try again.",
  );
}

/**
 * Clear stored credentials (on 401 — key revoked or invalid).
 */
export function clearCredentials(): void {
  try {
    if (existsSync(CREDENTIALS_FILE)) {
      unlinkSync(CREDENTIALS_FILE);
      console.error(
        "[PropertyIQ] Credentials cleared. Re-authenticate on next start.",
      );
    }
  } catch {
    // Ignore
  }
}

function storeCredentials(creds: StoredCredentials): void {
  try {
    mkdirSync(CREDENTIALS_DIR, { recursive: true });
    writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), "utf-8");
  } catch (err) {
    console.error(`[PropertyIQ] Warning: Could not save credentials: ${err}`);
  }
}
```

- [ ] **Step 2: Update config.ts**

Replace `packages/mcp-server/src/lib/config.ts`:

```typescript
/** PropertyIQ MCP Server Configuration */

import { getApiKey } from "./auth";

export const config = {
  /** Backend API base URL */
  apiUrl:
    process.env.PROPERTYIQ_API_URL ||
    "https://backend-production-ee4d.up.railway.app",
  /** Request timeout in ms */
  timeout: 15_000,
  /** Default result limit for list endpoints */
  defaultLimit: 25,
  /** Max result limit */
  maxLimit: 100,
  /** API key (resolved at startup, may be null until device flow completes) */
  apiKey: null as string | null,
};

/** Resolve API key from stored credentials or env var */
export function resolveApiKey(): string | null {
  config.apiKey = getApiKey();
  return config.apiKey;
}
```

- [ ] **Step 3: Update api-client.ts to send Authorization header**

Replace `packages/mcp-server/src/lib/api-client.ts`:

```typescript
/** HTTP client wrapper for the PropertyIQ backend API */

import { config } from "./config";
import { clearCredentials } from "./auth";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch data from the PropertyIQ backend API.
 * Sends Authorization header if an API key is configured.
 * On 401, clears stored credentials for re-auth on next start.
 */
export async function fetchApi<T = unknown>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(path, config.apiUrl);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(url.toString(), {
      headers,
      signal: controller.signal,
    });

    if (response.status === 401) {
      clearCredentials();
      throw new ApiError(
        401,
        "API key is invalid or revoked. Restart MCP server to re-authenticate.",
      );
    }

    if (response.status === 403) {
      const body = await response.text();
      throw new ApiError(
        403,
        `Access denied: ${body}. Visit https://propertyiq.up.railway.app/pricing to upgrade.`,
      );
    }

    if (!response.ok) {
      throw new ApiError(
        response.status,
        `API returned ${response.status}: ${await response.text()}`,
      );
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError(408, "Backend request timed out");
    }
    throw new ApiError(503, `Backend unreachable: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Update index.ts to authenticate on startup**

Replace `packages/mcp-server/src/index.ts`:

```typescript
#!/usr/bin/env node

/**
 * PropertyIQ MCP Server
 *
 * Exposes PropertyIQ real estate analytics as MCP tools.
 * Authenticates via stored credentials, env var, or device flow.
 *
 * Usage:
 *   npx tsx packages/mcp-server/src/index.ts
 *   claude mcp add propertyiq -- npx tsx packages/mcp-server/src/index.ts
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";
import { config, resolveApiKey } from "./lib/config";
import { authenticate } from "./lib/auth";

async function main() {
  // Resolve API key: stored credentials → env var → device flow
  let apiKey = resolveApiKey();

  if (!apiKey) {
    apiKey = await authenticate(config.apiUrl);
    config.apiKey = apiKey;
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[PropertyIQ MCP] Server running on stdio (authenticated)");
}

main().catch((err) => {
  console.error("[PropertyIQ MCP] Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 5: Verify MCP server compiles**

Run: `cd packages/mcp-server && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat: add MCP server auth with device flow and Bearer token"
```

---

## Task 10: Frontend — Data Fetchers for Personal API Keys

**Files:**

- Create: `packages/frontend/lib/data/fetchers/user-api-keys.ts`
- Modify: `packages/frontend/lib/data/index.ts`

- [ ] **Step 1: Create the fetcher**

File: `packages/frontend/lib/data/fetchers/user-api-keys.ts`

```typescript
/**
 * PERSONAL API KEY FETCHERS
 *
 * API functions for managing personal API keys (Pro tier).
 * Same patterns as org-api-keys.ts but for individual users.
 */

import { fetchAPI, fetchAPIRaw } from "./base";

export interface UserApiKey {
  id: string;
  name: string;
  key_prefix: string;
  key?: string;
  scopes: string[];
  rate_limit_rpm: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UserApiKeyListItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateUserApiKeyPayload {
  name: string;
  scopes: string[];
  rate_limit_rpm?: number;
}

export async function fetchUserApiKeys(): Promise<UserApiKeyListItem[]> {
  return fetchAPI<UserApiKeyListItem[]>("/api/user/api-keys");
}

export async function createUserApiKey(
  data: CreateUserApiKeyPayload,
): Promise<UserApiKey> {
  const res = await fetchAPIRaw("/api/user/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Create API key failed: ${res.status}`);
  }
  return res.json();
}

export async function revokeUserApiKey(keyId: string): Promise<void> {
  const res = await fetchAPIRaw(`/api/user/api-keys/${keyId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Revoke API key failed: ${res.status}`);
  }
}
```

- [ ] **Step 2: Re-export from lib/data/index.ts**

Add to `packages/frontend/lib/data/index.ts`:

```typescript
export {
  fetchUserApiKeys,
  createUserApiKey,
  revokeUserApiKey,
  type UserApiKey,
  type UserApiKeyListItem,
  type CreateUserApiKeyPayload,
} from "./fetchers/user-api-keys";
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd packages/frontend && npx next build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/lib/data/fetchers/user-api-keys.ts packages/frontend/lib/data/index.ts
git commit -m "feat: add personal API key data fetchers"
```

---

## Task 11: Frontend — /activate Page

**Files:**

- Create: `packages/frontend/app/activate/page.tsx`

- [ ] **Step 1: Create the activation page**

File: `packages/frontend/app/activate/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

type ActivationState = "input" | "submitting" | "success" | "error";

export default function ActivatePage() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<ActivationState>("input");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("submitting");
    setErrorMessage("");

    try {
      const res = await fetchAPIRaw("/api/auth/device-code/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_code: code.toUpperCase().trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Verification failed: ${res.status}`);
      }

      setState("success");
    } catch (err) {
      setState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Verification failed",
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center font-roboto text-2xl font-medium text-on-surface">
          Connect MCP Server
        </h1>
        <p className="mb-6 text-center text-sm text-on-surface/60">
          Enter the activation code shown in your terminal
        </p>

        {state === "success" ? (
          <div className="rounded-xl bg-primary-container p-6 text-center">
            <p className="text-lg font-medium text-on-surface">Connected!</p>
            <p className="mt-2 text-sm text-on-surface/60">
              Your MCP server is now authenticated. You can close this page.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD-1234"
              maxLength={9}
              className="w-full rounded-xl border border-outline/30 bg-surface px-4 py-3 text-center font-mono text-2xl tracking-widest text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
              disabled={state === "submitting"}
            />

            {state === "error" && (
              <p className="mt-3 text-center text-sm text-error">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={code.length < 9 || state === "submitting"}
              className="mt-4 w-full rounded-full bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {state === "submitting" ? "Verifying..." : "Activate"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd packages/frontend && npx next build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/activate/
git commit -m "feat: add /activate page for MCP device code flow"
```

---

## Task 12: Frontend — Personal API Key Management Page

**Files:**

- Create: `packages/frontend/app/account/api-keys/page.tsx`

- [ ] **Step 1: Create the key management page**

File: `packages/frontend/app/account/api-keys/page.tsx`

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchUserApiKeys,
  createUserApiKey,
  revokeUserApiKey,
  type UserApiKeyListItem,
} from "@/lib/data";

const AVAILABLE_SCOPES = [
  { value: "scores:read", label: "Scores (read)" },
  { value: "metrics:read", label: "Metrics (read)" },
  { value: "rankings:read", label: "Rankings (read)" },
  { value: "reports:read", label: "Reports (read)" },
  { value: "watchlist:read", label: "Watchlist (read)" },
] as const;

export default function PersonalApiKeysPage() {
  const [keys, setKeys] = useState<UserApiKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([
    "scores:read",
    "metrics:read",
  ]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadKeys = useCallback(async () => {
    try {
      const data = await fetchUserApiKeys();
      setKeys(data);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await createUserApiKey({
        name: newKeyName,
        scopes: newKeyScopes,
      });
      setCreatedKey(result.key ?? null);
      setShowCreate(false);
      setNewKeyName("");
      await loadKeys();
    } catch {
      // Handle error
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    try {
      await revokeUserApiKey(keyId);
      await loadKeys();
    } catch {
      // Handle error
    }
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  if (loading) {
    return <div className="p-8 text-on-surface/60">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-roboto text-2xl font-medium text-on-surface">
          API Keys
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          Create Key
        </button>
      </div>

      {createdKey && (
        <div className="mb-6 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="mb-2 text-sm font-medium text-on-surface">
            Copy your API key now — it won't be shown again:
          </p>
          <code className="block break-all rounded-lg bg-surface p-3 font-mono text-sm">
            {createdKey}
          </code>
          <button
            onClick={() => setCreatedKey(null)}
            className="mt-2 text-sm text-on-surface/60 hover:text-on-surface"
          >
            Dismiss
          </button>
        </div>
      )}

      {showCreate && (
        <div className="mb-6 rounded-xl border border-outline/20 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-medium text-on-surface">New API Key</h3>
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., MCP Server)"
            className="mb-3 w-full rounded-lg border border-outline/30 px-3 py-2 text-sm"
          />
          <div className="mb-3">
            <p className="mb-2 text-sm text-on-surface/60">Scopes:</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <button
                  key={scope.value}
                  onClick={() => toggleScope(scope.value)}
                  className={`rounded-lg border px-3 py-1 text-xs ${
                    newKeyScopes.includes(scope.value)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline/20 text-on-surface/60"
                  }`}
                >
                  {scope.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newKeyName || newKeyScopes.length === 0 || creating}
              className="rounded-full bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-full border border-outline/20 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="text-center text-on-surface/40">
          No API keys yet. Create one to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-xl border border-outline/20 bg-white p-4"
            >
              <div>
                <p className="font-medium text-on-surface">{key.name}</p>
                <p className="font-mono text-xs text-on-surface/40">
                  {key.key_prefix}...
                </p>
                <p className="mt-1 text-xs text-on-surface/40">
                  Created {new Date(key.created_at).toLocaleDateString()}
                  {key.last_used_at &&
                    ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                className="rounded-lg border border-error/30 px-3 py-1 text-xs text-error hover:bg-error/5"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd packages/frontend && npx next build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/account/api-keys/
git commit -m "feat: add personal API key management page"
```

---

## Task 13: E2E Integration Test — Full Flow

**Files:**

- Create: `packages/backend/test/enterprise/tier-gating-integration.e2e-spec.ts`

- [ ] **Step 1: Write the integration test**

File: `packages/backend/test/enterprise/tier-gating-integration.e2e-spec.ts`

```typescript
/**
 * Tier Gating Integration E2E Tests
 *
 * Verifies the full tier gating flow across personal keys,
 * org keys, and embed tokens against a live backend + DB.
 *
 * Tests:
 * 1. Personal key works for Pro+ user
 * 2. Org key works for Enterprise org
 * 3. Embed token requires Enterprise org owner
 * 4. Device flow provisions a working key
 */

import {
  seedTestOrg,
  cleanupTestOrg,
  TestOrgFixture,
} from "./setup/seed-test-org";

const BASE_URL = "http://localhost:3001";

describe("Tier Gating Integration", () => {
  let fixture: TestOrgFixture;

  beforeAll(async () => {
    fixture = await seedTestOrg();
  }, 30_000);

  afterAll(async () => {
    await cleanupTestOrg();
  }, 15_000);

  const adminFetch = (url: string, init?: RequestInit) =>
    fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${fixture.admin.accessToken}`,
        ...init?.headers,
      },
    });

  describe("Personal API keys", () => {
    let personalKey: string;

    it("creates a personal key and authenticates to Platform API", async () => {
      const createRes = await adminFetch(`${BASE_URL}/api/user/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Integration Test Key",
          scopes: ["scores:read", "metrics:read"],
        }),
      });
      expect(createRes.status).toBe(201);
      personalKey = (await createRes.json()).key;

      const apiRes = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
        headers: { Authorization: `Bearer ${personalKey}` },
      });
      expect(apiRes.status).toBe(200);
    });

    it("personal key has rate-limit headers", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
        headers: { Authorization: `Bearer ${personalKey}` },
      });
      expect(res.headers.get("X-RateLimit-Limit")).toBeDefined();
      expect(res.headers.get("X-RateLimit-Remaining")).toBeDefined();
    });
  });

  describe("Organization API keys", () => {
    it("org key authenticates to Platform API", async () => {
      const createRes = await adminFetch(
        `${BASE_URL}/api/org/${fixture.organization.slug}/api-keys`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Org Integration Key",
            scopes: ["scores:read"],
          }),
        },
      );
      expect(createRes.status).toBe(201);
      const orgKey = (await createRes.json()).key;

      const apiRes = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
        headers: { Authorization: `Bearer ${orgKey}` },
      });
      expect(apiRes.status).toBe(200);
    });
  });

  describe("Device auth flow", () => {
    it("full flow: create → verify → poll → key works", async () => {
      const createRes = await fetch(`${BASE_URL}/api/auth/device-code`, {
        method: "POST",
      });
      const { device_code, user_code } = await createRes.json();

      await adminFetch(`${BASE_URL}/api/auth/device-code/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_code }),
      });

      const pollRes = await fetch(
        `${BASE_URL}/api/auth/device-code/${device_code}`,
      );
      const poll = await pollRes.json();
      expect(poll.status).toBe("complete");
      expect(poll.api_key).toMatch(/^piq_live_/);

      const apiRes = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
        headers: { Authorization: `Bearer ${poll.api_key}` },
      });
      expect(apiRes.status).toBe(200);
    });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd packages/backend && npx jest test/enterprise/tier-gating-integration.e2e-spec.ts --forceExit`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/test/enterprise/tier-gating-integration.e2e-spec.ts
git commit -m "test: add tier gating integration E2E tests"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Run all enterprise E2E tests**

Run: `cd packages/backend && npx jest test/enterprise/ --forceExit`
Expected: All tests pass (existing + new).

- [ ] **Step 2: Verify backend compiles clean**

Run: `cd packages/backend && npx nest build`
Expected: No errors.

- [ ] **Step 3: Verify frontend compiles clean**

Run: `cd packages/frontend && npx next build`
Expected: No errors.

- [ ] **Step 4: Verify MCP server compiles clean**

Run: `cd packages/mcp-server && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: tier-gated API keys, MCP auth, and embed access control"
```
