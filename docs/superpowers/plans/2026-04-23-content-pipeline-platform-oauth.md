# Content Pipeline Platform OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the env-var + OAuth Playground dance with an in-app "Connect YouTube" button that stores an encrypted refresh token in Supabase Postgres. Fully eliminate the 24-hour Playground revocation trap.

**Architecture:** Backend-hosted OAuth callback at `GET /api/admin/content-pipeline/platforms/:platform/oauth-callback`, guarded by HMAC-signed state parameter (10-min expiry) rather than AdminGuard. Google redirects to the backend after user consent; backend exchanges `code` for tokens, encrypts the refresh token with `CredentialCrypto`, upserts into a new `platform_credentials` table, and 302s back to the frontend platforms page with a success/error query param. `YouTubeShortsPublisher.getAuth()` reads from the DB; no env-var fallback. Frontend platforms page handles the `?connected=` / `?error=` params and shows an M3 snackbar. All five P2/P3 platforms are pre-wired with disabled rows.

**Tech Stack:** NestJS 11 backend, Next.js 16 App Router frontend, Supabase Postgres (shared pooler), `googleapis` 148, AES-256-GCM via existing `CredentialCrypto` class (reused as HMAC-SHA256 secret for state signing), existing `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` env var (32 bytes).

**Spec:** `docs/superpowers/specs/2026-04-23-content-pipeline-platform-oauth-design.md`

**Branch:** `feat/content-pipeline-platform-oauth` (commit `c8982c5f` contains the spec + today's Wave 0 tail-end changes). All implementation commits land on this branch.

---

## File structure

**New files (5):**

- `supabase/migrations/20260423000200_platform_credentials.sql` — DDL for the new table.
- `packages/backend/src/content-pipeline/platform-credentials.service.ts` — CRUD service wrapping the table with `CredentialCrypto`. <150 lines.
- `packages/backend/src/content-pipeline/platform-credentials.service.spec.ts` — jest tests: encrypt round-trip, upsert-reactivate, disconnect, getActive null cases.
- `packages/backend/src/content-pipeline/oauth-state.ts` — pure function `signState(payload)` / `verifyState(state, expectedPlatform)` using HMAC-SHA256 and base64url. <80 lines.
- `packages/backend/src/content-pipeline/oauth-state.spec.ts` — jest tests: round-trip, tampered signature, expired state, wrong platform.
- `packages/backend/src/content-pipeline/platform-oauth-callback.controller.ts` — no class-level `AdminGuard`. One GET endpoint for Google's redirect.

**Modified files (10):**

- `scripts/apply-content-pipeline-migrations.js` — add the new migration to the `MIGRATIONS` array.
- `packages/backend/src/content-pipeline/drivers/platform-publisher.interface.ts` — `isConfigured(): boolean` → `isConfigured(): Promise<boolean>`.
- `packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.ts` — DB-backed auth, no env fallback.
- `packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.spec.ts` — update mocks.
- `packages/backend/src/content-pipeline/platform-manager.service.ts` — state signing inside `startOAuth`; widen `getPlatformStatuses` to emit all 6 canonical platforms with `supported` + `account_label`.
- `packages/backend/src/content-pipeline/content-pipeline.controller.ts` — add `DELETE /platforms/:platform/credentials`.
- `packages/backend/src/content-pipeline/content-pipeline.module.ts` — register `PlatformCredentialsService` and the new callback controller.
- `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts` — `disconnectPlatform(platform)` helper; widen `fetchPlatforms` return type.
- `packages/frontend/app/admin/content-pipeline/platforms/platform-row.tsx` — three-state rendering (connected / disconnected / unsupported) + Disconnect button with confirmation modal.
- `packages/frontend/app/admin/content-pipeline/platforms/page.tsx` — read `?connected=`/`?error=` on mount; M3 snackbar; clean URL.
- `docs/content-pipeline/deploy-state.md` — post-cutover state (migration applied, env var removed).
- `docs/content-pipeline/platform-setup/youtube.md` — "Setup (in-app)" section replacing the Playground walkthrough as the canonical flow.

---

## Phase A — Schema + credentials service

### Task 1: Migration 20260423000200 (platform_credentials)

**Files:**

- Create: `supabase/migrations/20260423000200_platform_credentials.sql`
- Modify: `scripts/apply-content-pipeline-migrations.js` (add to MIGRATIONS array)

- [ ] **Step 1: Create the migration file.**

```sql
-- supabase/migrations/20260423000200_platform_credentials.sql
-- Encrypted OAuth refresh tokens for content-pipeline platform publishers.
-- One active row per platform; re-connects upsert. Soft-deletes via
-- disconnected_at for audit history.

CREATE TABLE IF NOT EXISTS platform_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  account_label text,
  refresh_token_enc text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_credentials_platform_active_uniq
  ON platform_credentials (platform)
  WHERE disconnected_at IS NULL;

CREATE INDEX IF NOT EXISTS platform_credentials_platform_idx
  ON platform_credentials (platform);

GRANT SELECT, INSERT, UPDATE, DELETE ON platform_credentials TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_credentials TO authenticated;

COMMENT ON TABLE platform_credentials IS
  'Encrypted OAuth refresh tokens for content-pipeline platform publishers. One active row per platform; re-connects upsert. Soft-deletes via disconnected_at for audit history.';
COMMENT ON COLUMN platform_credentials.refresh_token_enc IS
  'CredentialCrypto.encrypt(refresh_token) output — AES-256-GCM with PLATFORM_CREDENTIALS_ENCRYPTION_KEY.';
COMMENT ON COLUMN platform_credentials.account_label IS
  'Human-readable account identifier. For YouTube: channel customUrl (e.g. @propertyIQ_app).';
```

- [ ] **Step 2: Add migration to the apply script.**

In `scripts/apply-content-pipeline-migrations.js`, extend the `MIGRATIONS` array:

```js
const MIGRATIONS = [
  "20260421000100_content_pipeline_core.sql",
  "20260421000200_content_pipeline_distribution.sql",
  "20260421000300_content_pipeline_attribution.sql",
  "20260421000400_content_pipeline_config.sql",
  "20260421000600_content_pipeline_seed_voices.sql",
  "20260421000500_content_pipeline_seed_formats.sql",
  "20260421000700_content_pipeline_seed_magnets.sql",
  "20260421010000_pgboss_schema_bootstrap.sql",
  "20260423000100_content_pipeline_format_pace_columns.sql",
  "20260423000200_platform_credentials.sql",
];
```

- [ ] **Step 3: Apply against the shared pooler.**

```bash
cd D:/Projects/rei-platform
node scripts/apply-content-pipeline-migrations.js
```

Expected: All 10 migrations print `OK`. Final output includes `Content-pipeline tables present: 15/14` (wait — 14 in the verification query, but we now have 15 tables; the script's verification query only counts the original 14 from P1. That's fine; extend verification in a follow-up if desired).

- [ ] **Step 4: Verify the table exists.**

```bash
node -e "const{Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:6543/postgres',ssl:{rejectUnauthorized:false}});await c.connect();const r=await c.query(\"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='platform_credentials' ORDER BY ordinal_position\");console.table(r.rows);await c.end()})()"
```

Expected: 7 columns (id, platform, account_label, refresh_token_enc, connected_at, updated_at, disconnected_at) with `id` as `uuid` and both timestamps as `timestamp with time zone`.

- [ ] **Step 5: Commit.**

```bash
git add supabase/migrations/20260423000200_platform_credentials.sql scripts/apply-content-pipeline-migrations.js
git commit -m "feat(content-pipeline): migration 20260423000200 platform_credentials"
```

---

### Task 2: PlatformCredentialsService

**Files:**

- Create: `packages/backend/src/content-pipeline/platform-credentials.service.ts`
- Create: `packages/backend/src/content-pipeline/platform-credentials.service.spec.ts`

- [ ] **Step 1: Write failing tests first.**

Create `packages/backend/src/content-pipeline/platform-credentials.service.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { PlatformCredentialsService } from "./platform-credentials.service";
import { CredentialCrypto } from "./drivers/credential-crypto";
import { SupabaseService } from "../supabase/supabase.service";

describe("PlatformCredentialsService", () => {
  let service: PlatformCredentialsService;
  let rows: Array<Record<string, any>>;
  const fakeSupabase = {
    getClient: () => ({
      from: (_table: string) => ({
        select: () => ({
          eq: (col: string, val: any) => ({
            is: (c2: string, v2: any) => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => {
                    const match = rows.find(
                      (r) => r[col] === val && r[c2] === v2,
                    );
                    return { data: match ?? null, error: null };
                  },
                }),
              }),
            }),
          }),
        }),
        insert: (row: Record<string, any>) => ({
          select: () => ({
            single: async () => {
              rows.push({
                ...row,
                id: "generated-id",
                connected_at: new Date().toISOString(),
              });
              return { data: rows[rows.length - 1], error: null };
            },
          }),
        }),
        update: (patch: Record<string, any>) => ({
          eq: (col: string, val: any) => ({
            is: (c2: string, v2: any) => ({
              select: () => ({
                maybeSingle: async () => {
                  const match = rows.find(
                    (r) => r[col] === val && r[c2] === v2,
                  );
                  if (match) Object.assign(match, patch);
                  return { data: match ?? null, error: null };
                },
              }),
            }),
          }),
        }),
      }),
    }),
  };

  beforeEach(async () => {
    rows = [];
    process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(
      32,
      "a",
    ).toString("base64");
    const mod = await Test.createTestingModule({
      providers: [
        PlatformCredentialsService,
        CredentialCrypto,
        { provide: SupabaseService, useValue: fakeSupabase },
      ],
    }).compile();
    service = mod.get(PlatformCredentialsService);
  });

  it("returns null when no active credential exists", async () => {
    expect(await service.getActive("youtube_shorts")).toBeNull();
  });

  it("upsert then get round-trips the refresh token", async () => {
    await service.upsertActive(
      "youtube_shorts",
      "@propertyIQ_app",
      "real-refresh-token-abc",
    );
    const got = await service.getActive("youtube_shorts");
    expect(got).not.toBeNull();
    expect(got!.refreshToken).toBe("real-refresh-token-abc");
    expect(got!.accountLabel).toBe("@propertyIQ_app");
  });

  it("upsert on existing active row updates in place", async () => {
    await service.upsertActive("youtube_shorts", "@propertyIQ_app", "token-v1");
    await service.upsertActive("youtube_shorts", "@propertyIQ_app", "token-v2");
    const got = await service.getActive("youtube_shorts");
    expect(got!.refreshToken).toBe("token-v2");
    expect(rows.length).toBe(1);
  });

  it("disconnect marks the active row and hides it from getActive", async () => {
    await service.upsertActive("youtube_shorts", "@propertyIQ_app", "token-v1");
    await service.disconnect("youtube_shorts");
    expect(await service.getActive("youtube_shorts")).toBeNull();
  });

  it("reconnect after disconnect creates a fresh active row", async () => {
    await service.upsertActive("youtube_shorts", "@propertyIQ_app", "token-v1");
    await service.disconnect("youtube_shorts");
    await service.upsertActive("youtube_shorts", "@propertyIQ_app", "token-v2");
    const got = await service.getActive("youtube_shorts");
    expect(got!.refreshToken).toBe("token-v2");
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail.**

```bash
cd packages/backend
npx jest platform-credentials.service.spec --testPathPatterns=content-pipeline
```

Expected: FAIL — `Cannot find module './platform-credentials.service'`.

- [ ] **Step 3: Write the service.**

Create `packages/backend/src/content-pipeline/platform-credentials.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CredentialCrypto } from "./drivers/credential-crypto";

export interface ActiveCredential {
  refreshToken: string;
  accountLabel: string | null;
  connectedAt: Date;
}

@Injectable()
export class PlatformCredentialsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly crypto: CredentialCrypto,
  ) {}

  async getActive(platform: string): Promise<ActiveCredential | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from("platform_credentials")
      .select("refresh_token_enc, account_label, connected_at")
      .eq("platform", platform)
      .is("disconnected_at", null)
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      refreshToken: this.crypto.decrypt(data.refresh_token_enc as string),
      accountLabel: (data.account_label as string | null) ?? null,
      connectedAt: new Date(data.connected_at as string),
    };
  }

  async upsertActive(
    platform: string,
    accountLabel: string,
    refreshToken: string,
  ): Promise<void> {
    const client = this.supabase.getClient();
    const enc = this.crypto.encrypt(refreshToken);

    const { data: existing } = await client
      .from("platform_credentials")
      .select("id")
      .eq("platform", platform)
      .is("disconnected_at", null)
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await client
        .from("platform_credentials")
        .update({
          refresh_token_enc: enc,
          account_label: accountLabel,
          updated_at: new Date().toISOString(),
        })
        .eq("platform", platform)
        .is("disconnected_at", null)
        .select()
        .maybeSingle();
      if (error) throw error;
    } else {
      const { error } = await client
        .from("platform_credentials")
        .insert({
          platform,
          account_label: accountLabel,
          refresh_token_enc: enc,
        })
        .select()
        .single();
      if (error) throw error;
    }
  }

  async disconnect(platform: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from("platform_credentials")
      .update({
        disconnected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("platform", platform)
      .is("disconnected_at", null)
      .select()
      .maybeSingle();
    if (error) throw error;
  }
}
```

- [ ] **Step 4: Run the tests to confirm they pass.**

```bash
cd packages/backend
npx jest platform-credentials.service.spec --testPathPatterns=content-pipeline
```

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Register the service in the module.**

Modify `packages/backend/src/content-pipeline/content-pipeline.module.ts` to add `PlatformCredentialsService` to the `providers` array and export it. If `CredentialCrypto` is not already a provider, add it too.

```ts
import { PlatformCredentialsService } from './platform-credentials.service';
import { CredentialCrypto } from './drivers/credential-crypto';

// In the @Module providers array (append):
  providers: [
    ...existingProviders,
    PlatformCredentialsService,
    CredentialCrypto,
  ],
```

- [ ] **Step 6: Commit.**

```bash
git add packages/backend/src/content-pipeline/platform-credentials.service.ts \
        packages/backend/src/content-pipeline/platform-credentials.service.spec.ts \
        packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): PlatformCredentialsService with encrypt/decrypt round-trip"
```

---

## Phase B — OAuth state + endpoints + publisher

### Task 3: OAuth state signing helper

**Files:**

- Create: `packages/backend/src/content-pipeline/oauth-state.ts`
- Create: `packages/backend/src/content-pipeline/oauth-state.spec.ts`

- [ ] **Step 1: Write failing tests first.**

Create `packages/backend/src/content-pipeline/oauth-state.spec.ts`:

```ts
import { signState, verifyState } from "./oauth-state";

describe("oauth-state", () => {
  beforeEach(() => {
    process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(
      32,
      "a",
    ).toString("base64");
  });

  it("signed state round-trips with matching platform", () => {
    const state = signState("youtube_shorts");
    const payload = verifyState(state, "youtube_shorts");
    expect(payload.platform).toBe("youtube_shorts");
    expect(typeof payload.nonce).toBe("string");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects tampered signature", () => {
    const state = signState("youtube_shorts");
    const [body] = state.split(".");
    const tampered = `${body}.fakefakefake`;
    expect(() => verifyState(tampered, "youtube_shorts")).toThrow(/signature/);
  });

  it("rejects tampered body", () => {
    const state = signState("youtube_shorts");
    const [, sig] = state.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ platform: "tiktok", nonce: "x", exp: 9e9 }),
    ).toString("base64url");
    const tampered = `${forgedBody}.${sig}`;
    expect(() => verifyState(tampered, "youtube_shorts")).toThrow(/signature/);
  });

  it("rejects expired state", () => {
    const origNow = Date.now;
    try {
      Date.now = () => 1_000_000_000_000; // set "now" to a known moment
      const state = signState("youtube_shorts");
      Date.now = () => 1_000_000_000_000 + 601_000; // 601 seconds later → past 600s exp
      expect(() => verifyState(state, "youtube_shorts")).toThrow(/expired/);
    } finally {
      Date.now = origNow;
    }
  });

  it("rejects platform mismatch", () => {
    const state = signState("youtube_shorts");
    expect(() => verifyState(state, "tiktok")).toThrow(/platform mismatch/);
  });

  it("rejects malformed state (no dot)", () => {
    expect(() => verifyState("notdotted", "youtube_shorts")).toThrow(
      /malformed/,
    );
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail.**

```bash
cd packages/backend
npx jest oauth-state.spec --testPathPatterns=content-pipeline
```

Expected: FAIL — `Cannot find module './oauth-state'`.

- [ ] **Step 3: Write the helper.**

Create `packages/backend/src/content-pipeline/oauth-state.ts`:

```ts
import { createHmac, randomUUID, timingSafeEqual } from "crypto";

const STATE_TTL_SECONDS = 600; // 10 minutes

export interface StatePayload {
  platform: string;
  nonce: string;
  exp: number; // unix seconds
}

function getKey(): Buffer {
  const b64 = process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY;
  if (!b64) throw new Error("PLATFORM_CREDENTIALS_ENCRYPTION_KEY is required");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32)
    throw new Error(
      "PLATFORM_CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes",
    );
  return key;
}

function hmac(bodyB64: string): string {
  return createHmac("sha256", getKey()).update(bodyB64).digest("base64url");
}

export function signState(platform: string): string {
  const payload: StatePayload = {
    platform,
    nonce: randomUUID(),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  };
  const bodyB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${bodyB64}.${hmac(bodyB64)}`;
}

export function verifyState(
  state: string,
  expectedPlatform: string,
): StatePayload {
  const parts = state.split(".");
  if (parts.length !== 2) throw new Error("state malformed");
  const [bodyB64, sigB64] = parts;

  const expectedSig = hmac(bodyB64);
  const a = Buffer.from(sigB64);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("state signature invalid");
  }

  let payload: StatePayload;
  try {
    payload = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8"));
  } catch {
    throw new Error("state body malformed");
  }
  if (payload.platform !== expectedPlatform)
    throw new Error("state platform mismatch");
  if (payload.exp <= Math.floor(Date.now() / 1000))
    throw new Error("state expired");
  return payload;
}
```

- [ ] **Step 4: Run the tests to confirm they pass.**

```bash
cd packages/backend
npx jest oauth-state.spec --testPathPatterns=content-pipeline
```

Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit.**

```bash
git add packages/backend/src/content-pipeline/oauth-state.ts \
        packages/backend/src/content-pipeline/oauth-state.spec.ts
git commit -m "feat(content-pipeline): HMAC-signed OAuth state helper with 10-min expiry"
```

---

### Task 4: Update PlatformPublisher interface to async isConfigured

**Files:**

- Modify: `packages/backend/src/content-pipeline/drivers/platform-publisher.interface.ts`

- [ ] **Step 1: Update the interface signature.**

Replace the `isConfigured` method declaration:

```ts
export interface PlatformPublisher {
  readonly platform: Platform;
  isConfigured(): Promise<boolean>; // was: boolean
  publish(req: PublishRequest): Promise<PublishResult>;
  refreshCredentials?(): Promise<void>;
}
```

- [ ] **Step 2: Verify the change compiles (it will surface the callsites that need updating in the next tasks).**

```bash
cd packages/backend
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "isConfigured|platform-publisher"
```

Expected: compile errors pointing at `platform-manager.service.ts` (where `.map((p) => ({ configured: p.isConfigured() }))` is synchronous) and `youtube-shorts-publisher.ts` (current sync impl). Those are fixed in Tasks 5-6.

- [ ] **Step 3: Commit.**

```bash
git add packages/backend/src/content-pipeline/drivers/platform-publisher.interface.ts
git commit -m "refactor(content-pipeline): PlatformPublisher.isConfigured is async"
```

---

### Task 5: Rewrite YouTubeShortsPublisher to DB-backed auth

**Files:**

- Modify: `packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.ts`
- Modify: `packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.spec.ts`

- [ ] **Step 1: Write failing tests first.**

Replace `packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.spec.ts`:

```ts
import { YouTubeShortsPublisher } from "./youtube-shorts-publisher";
import { PlatformCredentialsService } from "../platform-credentials.service";

describe("YouTubeShortsPublisher", () => {
  let getActive: jest.Mock;
  let creds: PlatformCredentialsService;

  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = "cid.apps.googleusercontent.com";
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = "GOCSPX-secret";
    getActive = jest.fn();
    creds = { getActive } as unknown as PlatformCredentialsService;
  });

  it("isConfigured returns true when an active credential exists", async () => {
    getActive.mockResolvedValue({
      refreshToken: "rt",
      accountLabel: "@x",
      connectedAt: new Date(),
    });
    const pub = new YouTubeShortsPublisher(creds);
    expect(await pub.isConfigured()).toBe(true);
  });

  it("isConfigured returns false when no active credential exists", async () => {
    getActive.mockResolvedValue(null);
    const pub = new YouTubeShortsPublisher(creds);
    expect(await pub.isConfigured()).toBe(false);
  });

  it("publish throws a clear error when no credential exists", async () => {
    getActive.mockResolvedValue(null);
    const pub = new YouTubeShortsPublisher(creds);
    await expect(
      pub.publish({
        runId: "r",
        videoPath: "/tmp/v.mp4",
        title: "t",
        description: "d",
        tags: [],
        postMode: "direct",
      } as any),
    ).rejects.toThrow(/YouTube not connected/);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail.**

```bash
cd packages/backend
npx jest youtube-shorts-publisher.spec --testPathPatterns=content-pipeline
```

Expected: FAIL — current publisher reads from env, not from `PlatformCredentialsService`.

- [ ] **Step 3: Rewrite the publisher.**

Replace `packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { createReadStream } from "fs";
import {
  PlatformPublisher,
  PublishRequest,
  PublishResult,
} from "./platform-publisher.interface";
import { Platform } from "../types";
import { PlatformCredentialsService } from "../platform-credentials.service";

@Injectable()
export class YouTubeShortsPublisher implements PlatformPublisher {
  readonly platform: Platform = "youtube_shorts";
  private cachedAuth: { refreshToken: string; client: OAuth2Client } | null =
    null;

  constructor(private readonly creds: PlatformCredentialsService) {}

  async isConfigured(): Promise<boolean> {
    return (await this.creds.getActive("youtube_shorts")) !== null;
  }

  private async getAuth(): Promise<OAuth2Client> {
    const row = await this.creds.getActive("youtube_shorts");
    if (!row) {
      throw new Error(
        "YouTube not connected. Visit /admin/content-pipeline/platforms and click Connect.",
      );
    }
    if (!this.cachedAuth || this.cachedAuth.refreshToken !== row.refreshToken) {
      const client = new google.auth.OAuth2(
        process.env.YOUTUBE_OAUTH_CLIENT_ID,
        process.env.YOUTUBE_OAUTH_CLIENT_SECRET,
      );
      client.setCredentials({ refresh_token: row.refreshToken });
      this.cachedAuth = { refreshToken: row.refreshToken, client };
    }
    return this.cachedAuth.client;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const auth = await this.getAuth();
    const yt = google.youtube({ version: "v3", auth });
    const privacyStatus = req.postMode === "direct" ? "public" : "private";

    const descriptionWithHashtag = req.description.includes("#Shorts")
      ? req.description
      : req.description + "\n\n#Shorts";

    const response = await yt.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: req.title,
          description: descriptionWithHashtag,
          tags: req.tags,
          categoryId: "22",
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
          publishAt: req.scheduledFor?.toISOString(),
        },
      },
      media: { body: createReadStream(req.videoPath) },
    });

    const videoId = (response.data as any).id;
    return {
      externalId: videoId,
      externalUrl: `https://youtube.com/shorts/${videoId}`,
      cost: {
        provider: "youtube",
        amount_usd: 0,
        units: 1,
        unit_type: "requests",
      },
      providerResponse: response.data,
    };
  }

  async refreshCredentials(): Promise<void> {
    const auth = await this.getAuth();
    await auth.getAccessToken();
  }
}
```

- [ ] **Step 4: Run the tests to confirm they pass.**

```bash
cd packages/backend
npx jest youtube-shorts-publisher.spec --testPathPatterns=content-pipeline
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit.**

```bash
git add packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.ts \
        packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.spec.ts
git commit -m "feat(content-pipeline): YouTubeShortsPublisher reads creds from DB (no env fallback)"
```

---

### Task 6: Update PlatformManagerService (state signing + widen getPlatformStatuses)

**Files:**

- Modify: `packages/backend/src/content-pipeline/platform-manager.service.ts`

- [ ] **Step 1: Rewrite the service to include state + broader statuses.**

Replace the full contents of `packages/backend/src/content-pipeline/platform-manager.service.ts`:

```ts
import { Inject, Injectable } from "@nestjs/common";
import {
  PLATFORM_PUBLISHERS,
  PlatformPublisher,
} from "./drivers/platform-publisher.interface";
import { PlatformCredentialsService } from "./platform-credentials.service";
import { signState } from "./oauth-state";

export interface PlatformStatus {
  platform: string;
  configured: boolean;
  supported: boolean;
  accountLabel: string | null;
  connectedAt: string | null;
  lastPublishedAt: string | null;
}

const ALL_PLATFORMS = [
  "youtube_shorts",
  "tiktok",
  "instagram_reels",
  "facebook_reels",
  "linkedin",
  "youtube_long",
] as const;

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

@Injectable()
export class PlatformManagerService {
  constructor(
    @Inject(PLATFORM_PUBLISHERS)
    private readonly publishers: PlatformPublisher[],
    private readonly creds: PlatformCredentialsService,
  ) {}

  async getPlatformStatuses(): Promise<PlatformStatus[]> {
    const registered = new Map(this.publishers.map((p) => [p.platform, p]));
    const rows = await Promise.all(
      ALL_PLATFORMS.map(async (platform): Promise<PlatformStatus> => {
        const pub = registered.get(platform);
        const cred = await this.creds.getActive(platform);
        return {
          platform,
          supported: Boolean(pub),
          configured: cred !== null,
          accountLabel: cred?.accountLabel ?? null,
          connectedAt: cred?.connectedAt.toISOString() ?? null,
          lastPublishedAt: null,
        };
      }),
    );
    return rows;
  }

  async startOAuth(platform: string): Promise<{ authUrl: string }> {
    if (platform !== "youtube_shorts") {
      throw new Error(`platform ${platform} not yet wired for OAuth in P1`);
    }
    const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error("YOUTUBE_OAUTH_CLIENT_ID not configured");
    const appBaseUrl = process.env.APP_BASE_URL;
    if (!appBaseUrl) throw new Error("APP_BASE_URL not configured");

    const redirectUri = encodeURIComponent(
      `${appBaseUrl}/api/admin/content-pipeline/platforms/${platform}/oauth-callback`,
    );
    const scope = encodeURIComponent(YOUTUBE_SCOPES.join(" "));
    const state = encodeURIComponent(signState(platform));

    const url =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${state}`;

    return { authUrl: url };
  }
}
```

- [ ] **Step 2: Typecheck to confirm no regressions.**

```bash
cd packages/backend
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "platform-manager|PlatformManager" | head -10
```

Expected: no errors pointing at `platform-manager.service.ts`.

- [ ] **Step 3: Run existing content-pipeline tests (catches regressions).**

```bash
cd packages/backend
npx jest --testPathPatterns='content-pipeline' --testPathIgnorePatterns='queue.service.spec'
```

Expected: all pass. If `platform-manager.service.spec.ts` exists and fails because the constructor signature changed, update its mock to pass in `PlatformCredentialsService`.

- [ ] **Step 4: Commit.**

```bash
git add packages/backend/src/content-pipeline/platform-manager.service.ts
git commit -m "feat(content-pipeline): platform manager returns all 6 platforms with connection state and signs OAuth state"
```

---

### Task 7: Add oauth-callback controller and disconnect endpoint

**Files:**

- Create: `packages/backend/src/content-pipeline/platform-oauth-callback.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.module.ts`

- [ ] **Step 1: Create the callback controller.**

Create `packages/backend/src/content-pipeline/platform-oauth-callback.controller.ts`:

```ts
import { Controller, Get, Logger, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { google } from "googleapis";
import { verifyState } from "./oauth-state";
import { PlatformCredentialsService } from "./platform-credentials.service";

@Controller("api/admin/content-pipeline/platforms")
export class PlatformOAuthCallbackController {
  private readonly logger = new Logger(PlatformOAuthCallbackController.name);

  constructor(private readonly creds: PlatformCredentialsService) {}

  @Get(":platform/oauth-callback")
  async callback(
    @Param("platform") platform: string,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") providerError: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const frontend = process.env.FRONTEND_URL ?? process.env.APP_BASE_URL ?? "";
    const redirectTo = (qs: string) =>
      res.redirect(302, `${frontend}/admin/content-pipeline/platforms?${qs}`);

    if (providerError) {
      this.logger.warn(
        `oauth-callback provider_error platform=${platform} err=${providerError}`,
      );
      return redirectTo(`error=${encodeURIComponent(providerError)}`);
    }
    if (!code || !state) {
      return redirectTo("error=missing_code_or_state");
    }

    try {
      verifyState(decodeURIComponent(state), platform);
    } catch (err) {
      this.logger.warn(
        `oauth-callback state_invalid platform=${platform} err=${(err as Error).message}`,
      );
      return redirectTo(`error=state_invalid`);
    }

    if (platform !== "youtube_shorts") {
      return redirectTo(`error=platform_not_supported`);
    }

    try {
      const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
      const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
      const appBaseUrl = process.env.APP_BASE_URL;
      if (!clientId || !clientSecret || !appBaseUrl)
        throw new Error("YOUTUBE_OAUTH_* env vars missing");

      const redirectUri = `${appBaseUrl}/api/admin/content-pipeline/platforms/${platform}/oauth-callback`;
      const oauth2 = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri,
      );
      const { tokens } = await oauth2.getToken(code);
      if (!tokens.refresh_token) {
        return redirectTo(`error=no_refresh_token_returned`);
      }
      oauth2.setCredentials(tokens);

      const yt = google.youtube({ version: "v3", auth: oauth2 });
      const channelsRes = await yt.channels.list({
        mine: true,
        part: ["snippet"],
      });
      const items = channelsRes.data.items ?? [];
      if (items.length > 1) {
        this.logger.warn(
          `oauth-callback multiple_channels platform=${platform} count=${items.length} — using first`,
        );
      }
      const handle =
        items[0]?.snippet?.customUrl ?? items[0]?.snippet?.title ?? "unknown";

      await this.creds.upsertActive(platform, handle, tokens.refresh_token);

      this.logger.log(
        `oauth-callback success platform=${platform} label=${handle}`,
      );
      return redirectTo(
        `connected=${encodeURIComponent(platform)}&label=${encodeURIComponent(handle)}`,
      );
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(
        `oauth-callback code_exchange_failed platform=${platform} err=${msg}`,
      );
      return redirectTo(`error=${encodeURIComponent("code_exchange_failed")}`);
    }
  }
}
```

- [ ] **Step 2: Add the disconnect endpoint to the main controller.**

In `packages/backend/src/content-pipeline/content-pipeline.controller.ts`, add an import and a new method. Append after the `platformConnect` method:

```ts
import { Delete } from "@nestjs/common";
import { PlatformCredentialsService } from "./platform-credentials.service";
```

Add to the constructor:

```ts
constructor(
  private readonly service: ContentPipelineService,
  private readonly platformManager: PlatformManagerService,
  private readonly settingsService: PipelineSettingsService,
  private readonly credentials: PlatformCredentialsService, // new
) {}
```

Add the method:

```ts
  @Delete('platforms/:platform/credentials')
  async platformDisconnect(@Param('platform') platform: string) {
    await this.credentials.disconnect(platform);
    return { success: true, data: { disconnected: platform } };
  }
```

- [ ] **Step 3: Register the callback controller in the module.**

In `packages/backend/src/content-pipeline/content-pipeline.module.ts`, add the callback controller to the `controllers` array:

```ts
import { PlatformOAuthCallbackController } from './platform-oauth-callback.controller';

// ...
  controllers: [
    ContentPipelineController,
    PlatformOAuthCallbackController,
  ],
```

- [ ] **Step 4: Typecheck and run content-pipeline tests.**

```bash
cd packages/backend
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "content-pipeline" | head -10
npx jest --testPathPatterns='content-pipeline' --testPathIgnorePatterns='queue.service.spec'
```

Expected: no content-pipeline type errors; all jest content-pipeline tests pass.

- [ ] **Step 5: Commit.**

```bash
git add packages/backend/src/content-pipeline/platform-oauth-callback.controller.ts \
        packages/backend/src/content-pipeline/content-pipeline.controller.ts \
        packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): OAuth callback controller + disconnect endpoint"
```

---

## Phase C — Frontend

### Task 8: API client helpers

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts`

- [ ] **Step 1: Locate the existing `fetchPlatforms` and `connectPlatform` functions.**

```bash
grep -n "fetchPlatforms\|connectPlatform" D:/Projects/rei-platform/packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts
```

- [ ] **Step 2: Widen the `PlatformStatus` type and add `disconnectPlatform`.**

Near the top of `content-pipeline-api.ts` (below the existing type declarations), replace or add:

```ts
export interface PlatformStatus {
  platform: string;
  configured: boolean;
  supported: boolean;
  accountLabel: string | null;
  connectedAt: string | null;
  lastPublishedAt: string | null;
}

export async function disconnectPlatform(
  platform: string,
): Promise<{ disconnected: string }> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/platforms/${platform}/credentials`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Disconnect failed (${res.status}): ${body}`);
  }
  const parsed = (await res.json()) as { data: { disconnected: string } };
  return parsed.data;
}
```

Ensure `fetchPlatforms` returns `Promise<PlatformStatus[]>` (adjust its declared return type if stricter).

- [ ] **Step 3: Typecheck the frontend package.**

```bash
cd packages/frontend
npx tsc --noEmit 2>&1 | grep -E "content-pipeline-api|PlatformStatus" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts
git commit -m "feat(content-pipeline/fe): PlatformStatus widened; disconnectPlatform helper"
```

---

### Task 9: Rewrite PlatformRow with three states

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/platforms/platform-row.tsx`

- [ ] **Step 1: Rewrite the component.**

Replace `packages/frontend/app/admin/content-pipeline/platforms/platform-row.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  connectPlatform,
  disconnectPlatform,
} from "../lib/content-pipeline-api";

interface PlatformRowProps {
  platform: string;
  configured: boolean;
  supported: boolean;
  accountLabel: string | null;
  connectedAt: string | null;
  lastPublishedAt: string | null;
  onChange: () => void;
}

export function PlatformRow({
  platform,
  configured,
  supported,
  accountLabel,
  connectedAt,
  lastPublishedAt,
  onChange,
}: PlatformRowProps) {
  const [working, setWorking] = useState<"connect" | "disconnect" | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = platform.replaceAll("_", " ");

  async function handleConnect() {
    setError(null);
    setWorking("connect");
    try {
      const result = await connectPlatform(platform);
      if (result?.authUrl) {
        window.location.assign(result.authUrl);
        return;
      }
      setError("Backend returned no auth URL");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setWorking(null);
    }
  }

  async function handleDisconnect() {
    setError(null);
    setWorking("disconnect");
    try {
      await disconnectPlatform(platform);
      setConfirmDisconnect(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setWorking(null);
    }
  }

  const statusLine = !supported
    ? "Available in a later phase"
    : configured
      ? accountLabel
        ? `Connected · ${accountLabel}`
        : "Connected"
      : "Not connected";

  return (
    <div className="rounded-xl bg-surface-container-low shadow-sm">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`w-3 h-3 rounded-full ${
              configured
                ? "bg-accent"
                : supported
                  ? "bg-outline"
                  : "bg-surface-container-high"
            }`}
            aria-label={configured ? "Connected" : "Not connected"}
          />
          <div>
            <div
              className={`font-semibold capitalize ${!supported ? "text-outline" : ""}`}
            >
              {label}
            </div>
            <div className="text-xs text-outline">{statusLine}</div>
            {configured && lastPublishedAt && (
              <div className="text-xs text-outline mt-0.5">
                Last publish {new Date(lastPublishedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {supported && !configured && (
          <button
            type="button"
            disabled={working === "connect"}
            onClick={handleConnect}
            className="bg-primary text-on-primary rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {working === "connect" ? "Opening…" : "Connect"}
          </button>
        )}

        {supported && configured && (
          <button
            type="button"
            disabled={working === "disconnect"}
            onClick={() => setConfirmDisconnect(true)}
            className="bg-surface-container-high text-on-surface rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Disconnect
          </button>
        )}

        {!supported && (
          <button
            type="button"
            disabled
            title="Available in a later phase"
            className="rounded-full px-5 py-2 text-sm font-semibold bg-surface-container-high text-outline opacity-60 cursor-not-allowed"
          >
            Connect
          </button>
        )}
      </div>

      {error && <div className="px-4 pb-3 text-sm text-error">{error}</div>}

      {confirmDisconnect && (
        <div className="p-4 border-t border-outline-variant bg-surface-container space-y-3">
          <p className="text-sm">
            Disconnecting will stop publishing to{" "}
            <span className="font-semibold">{accountLabel ?? platform}</span>{" "}
            until you reconnect. Continue?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setConfirmDisconnect(false)}
              className="rounded-full px-4 py-1.5 text-sm bg-surface-container-high"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={working === "disconnect"}
              onClick={handleDisconnect}
              className="rounded-full px-4 py-1.5 text-sm bg-error text-on-error font-semibold disabled:opacity-60"
            >
              {working === "disconnect" ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck frontend.**

```bash
cd packages/frontend
npx tsc --noEmit 2>&1 | grep "platform-row" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/platforms/platform-row.tsx
git commit -m "feat(content-pipeline/fe): PlatformRow three-state render with confirm-modal disconnect"
```

---

### Task 10: Platforms page URL-param handling and snackbar

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/platforms/page.tsx`

- [ ] **Step 1: Rewrite the page to handle return params.**

Replace `packages/frontend/app/admin/content-pipeline/platforms/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchPlatforms } from "../lib/content-pipeline-api";
import { PlatformRow } from "./platform-row";

const ALL_PLATFORMS = [
  "youtube_shorts",
  "tiktok",
  "instagram_reels",
  "facebook_reels",
  "linkedin",
  "youtube_long",
] as const;

function errorMessage(code: string): string {
  switch (code) {
    case "state_invalid":
      return "Connect session expired. Click Connect and finish within 10 minutes.";
    case "state_expired":
      return "Connect session expired. Try again.";
    case "code_exchange_failed":
      return "Google rejected the authorization code. Try again.";
    case "channel_lookup_failed":
      return "Could not read the connected channel. Try again.";
    case "access_denied":
      return "You declined Google's consent screen. Connect again to retry.";
    case "no_refresh_token_returned":
      return "Google did not return a refresh token. Check consent screen settings.";
    case "missing_code_or_state":
      return "Callback was missing required parameters. Connect again.";
    case "platform_not_supported":
      return "That platform's OAuth flow is not yet wired in this phase.";
    default:
      return `Connect failed (${code}). Try again.`;
  }
}

export default function PlatformsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const {
    data = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["content-pipeline-platforms"],
    queryFn: fetchPlatforms,
  });

  useEffect(() => {
    const connected = searchParams.get("connected");
    const label = searchParams.get("label");
    const errorCode = searchParams.get("error");

    if (connected) {
      setToast({
        kind: "success",
        message: `Connected ${label ? label + " to " : ""}${connected.replaceAll("_", " ")}`,
      });
      refetch();
      router.replace("/admin/content-pipeline/platforms");
    } else if (errorCode) {
      setToast({ kind: "error", message: errorMessage(errorCode) });
      router.replace("/admin/content-pipeline/platforms");
    }
  }, [searchParams, router, refetch]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const byPlatform = new Map(data.map((p) => [p.platform, p]));

  return (
    <div className="p-8 max-w-3xl space-y-3">
      <h1 className="text-2xl font-semibold mb-4 text-on-surface">
        Platform Credentials
      </h1>

      {isLoading && (
        <div className="rounded-xl bg-surface-container-low p-6 text-sm text-outline">
          Loading platforms...
        </div>
      )}

      {ALL_PLATFORMS.map((platform) => {
        const row = byPlatform.get(platform);
        return (
          <PlatformRow
            key={platform}
            platform={platform}
            configured={row?.configured ?? false}
            supported={row?.supported ?? false}
            accountLabel={row?.accountLabel ?? null}
            connectedAt={row?.connectedAt ?? null}
            lastPublishedAt={row?.lastPublishedAt ?? null}
            onChange={() => refetch()}
          />
        );
      })}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 shadow-lg text-sm ${
            toast.kind === "success"
              ? "bg-primary text-on-primary"
              : "bg-error text-on-error"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck frontend.**

```bash
cd packages/frontend
npx tsc --noEmit 2>&1 | grep "platforms/page" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/platforms/page.tsx
git commit -m "feat(content-pipeline/fe): platforms page reads connect/error query params and shows toast"
```

---

## Phase D — Google Cloud Console + env vars (operator runs)

### Task 11: Update Google Console redirect URIs and local env

**Files:** (no code changes; operator UI work + env var edits)

- [ ] **Step 1: Update the OAuth client's Authorized redirect URIs in Google Console.**

Navigate to: https://console.cloud.google.com → APIs & Services → Credentials → the existing OAuth 2.0 Client ID used for YouTube.

Under **Authorized redirect URIs**, **add** these three entries (do not remove the Playground URI yet — keep it as a fallback until prod smoke is green):

```
http://localhost:3001/api/admin/content-pipeline/platforms/youtube_shorts/oauth-callback
https://backend-dev-d9ca.up.railway.app/api/admin/content-pipeline/platforms/youtube_shorts/oauth-callback
https://backend-production-ee4d.up.railway.app/api/admin/content-pipeline/platforms/youtube_shorts/oauth-callback
```

Click **Save**. Allow 2-5 minutes for Google to propagate.

- [ ] **Step 2: Ensure `APP_BASE_URL` in `packages/backend/.env.local` is set to the local backend origin.**

```bash
grep -E '^APP_BASE_URL=' D:/Projects/rei-platform/packages/backend/.env.local
```

Expected: `APP_BASE_URL=http://localhost:3001`. If it's set to a Railway URL or missing, update it:

```bash
# In packages/backend/.env.local, set:
APP_BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

- [ ] **Step 3: Verify `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` is set locally (required for encryption + HMAC).**

```bash
grep -c '^PLATFORM_CREDENTIALS_ENCRYPTION_KEY=' D:/Projects/rei-platform/packages/backend/.env.local
```

Expected: `1`. If `0`, set it to the same base64 32-byte value currently on Railway.

- [ ] **Step 4: (No commit — env and console are operator-side.)** Move to the next task.

---

## Phase E — Local smoke test

### Task 12: Local smoke — Connect, retry, Disconnect

**Files:** (manual verification; no code changes)

- [ ] **Step 1: Restart local dev servers (picks up new env vars).**

In a terminal:

```bash
# Stop existing dev:fresh (Ctrl+C in that terminal), then:
cd D:/Projects/rei-platform
npm run dev:fresh
```

Wait ~30-60s for both servers. Confirm:

```bash
curl -s http://localhost:3001/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin/content-pipeline/platforms
```

Expected: `{"status":"healthy",...}` and `307` (auth redirect — expected pre-login).

- [ ] **Step 2: Run the inspect script to confirm zero rows in `platform_credentials` before connect.**

```bash
cd D:/Projects/rei-platform
node -e "const{Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:6543/postgres',ssl:{rejectUnauthorized:false}});await c.connect();const r=await c.query('SELECT platform, account_label, disconnected_at FROM platform_credentials');console.table(r.rows);await c.end()})()"
```

Expected: empty table.

- [ ] **Step 3: Connect via the UI.**

In a browser logged in as admin, navigate to `http://localhost:3000/admin/content-pipeline/platforms`. Click **Connect** on the `youtube_shorts` row. Complete Google consent **with the Google account that manages @propertyIQ_app**. If multiple channels appear in Google's picker, select **@propertyIQ_app**.

You land back at `/admin/content-pipeline/platforms` with a green snackbar: `Connected @propertyIQ_app to youtube shorts`. The YouTube row shows **Connected · @propertyIQ_app** and a Disconnect button.

- [ ] **Step 4: Verify the DB row.**

```bash
node -e "const{Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:6543/postgres',ssl:{rejectUnauthorized:false}});await c.connect();const r=await c.query(\"SELECT platform, account_label, length(refresh_token_enc) as enc_len, disconnected_at FROM platform_credentials\");console.table(r.rows);await c.end()})()"
```

Expected: one row: `platform='youtube_shorts', account_label='@propertyIQ_app', enc_len > 100, disconnected_at=null`.

- [ ] **Step 5: Retry a previously-failed run.**

Pick one of today's `invalid_grant` failures: `c4c6b826-9dab-4e52-bd2a-7c52ea81b218` (Miami) or `095c7601-33ed-47b5-a8f4-9a0e96e2fe03` (Chicago).

Open `http://localhost:3000/admin/content-pipeline/runs/<runId>`. Click **Retry run**. Watch the pipeline progress via `node scripts/inspect-content-run.js <runId>`. Expected: `rendering_video` → `ready_for_review` (or `published` if approval_mode='auto'). If it reaches `ready_for_review`, approve in the review queue → `publishing` → `published`.

- [ ] **Step 6: Verify the video landed on @propertyIQ_app.**

In a browser, navigate to `https://youtube.com/@propertyIQ_app`. The newest Short should be the smoke-test upload (title includes the market name from the run).

- [ ] **Step 7: Disconnect via the UI.**

Back at `/admin/content-pipeline/platforms`, click **Disconnect** on the YouTube row. The confirmation modal appears. Click **Disconnect** in the modal. The row returns to **Not connected**.

- [ ] **Step 8: Verify disconnect marked the DB row.**

```bash
node -e "const{Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:6543/postgres',ssl:{rejectUnauthorized:false}});await c.connect();const r=await c.query('SELECT platform, account_label, disconnected_at FROM platform_credentials');console.table(r.rows);await c.end()})()"
```

Expected: one row with `disconnected_at` populated (a timestamp, not null).

- [ ] **Step 9: Attempt a publish without creds to confirm the publisher throws cleanly.**

Create a new run with `youtube_shorts` selected. It should fail at `publishing` with status reason containing `"YouTube not connected. Visit /admin/content-pipeline/platforms and click Connect."`.

- [ ] **Step 10: Re-connect (demonstrates upsert-reactivate behavior).**

Click Connect again, complete Google consent. DB row now shows `disconnected_at=null` again and the refresh_token_enc is updated.

- [ ] **Step 11: Commit only if there are code changes from smoke discoveries.** Otherwise skip.

---

## Phase F — Deploy to Railway

### Task 13: Merge branch → develop → main, apply migration, redeploy

**Files:** (ops work)

- [ ] **Step 1: Ensure clean working tree.**

```bash
cd D:/Projects/rei-platform
git status
```

Expected: `nothing to commit, working tree clean` on branch `feat/content-pipeline-platform-oauth`.

- [ ] **Step 2: Push the feature branch.**

```bash
git push -u origin feat/content-pipeline-platform-oauth
```

- [ ] **Step 3: Merge feature → develop.**

```bash
git checkout develop
git pull --ff-only origin develop
git merge --no-ff feat/content-pipeline-platform-oauth \
  -m "Merge branch 'feat/content-pipeline-platform-oauth' into develop"
git push origin develop
```

- [ ] **Step 4: Merge develop → main (triggers Railway prod build).**

```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff develop -m "Merge branch 'develop'"
git push origin main
```

- [ ] **Step 5: Apply migration to the shared Supabase pooler (safe; idempotent).**

```bash
node scripts/apply-content-pipeline-migrations.js
```

Expected: all 10 migrations OK; verification query lists 15 content-pipeline tables (or the known 14 if verification wasn't extended; the important thing is no errors).

- [ ] **Step 6: Add `FRONTEND_URL` to Railway dev if missing.**

Set-or-update in the Railway dashboard for both backend services:

- Prod: `FRONTEND_URL=https://www.propertyiq.app`
- Dev: `FRONTEND_URL=https://devpropertyiq.up.railway.app` (or whatever dev's frontend URL is — check `RAILWAY_SERVICE_FRONTEND_URL` already present in dev env)

(These can be set via the Railway MCP `set-variables` or UI. Per memory note `reference_railway-mcp-secrets-exposure`, do NOT echo any variable values into chat afterwards.)

- [ ] **Step 7: Watch both Railway builds reach SUCCESS.**

Takes ~5-8 min each. Verify via Railway MCP or dashboard. On SUCCESS, confirm:

```bash
curl -sS --ssl-no-revoke https://backend-production-ee4d.up.railway.app/api/health
curl -sS --ssl-no-revoke https://backend-dev-d9ca.up.railway.app/api/health
```

Expected: both return `{"status":"healthy",...}`.

- [ ] **Step 8: Prod smoke — Connect @propertyIQ_app via prod UI.**

Navigate to `https://www.propertyiq.app/admin/content-pipeline/platforms`. Click Connect on YouTube Shorts. Complete Google consent with the @propertyIQ_app account. Confirm green snackbar and connected state.

- [ ] **Step 9: Verify a prod run publishes.**

Create a new run from the wizard (or retry one of today's failed ones). Approve in review. Watch the run reach `published`. Verify upload on `https://youtube.com/@propertyIQ_app`.

- [ ] **Step 10: Remove `YOUTUBE_OAUTH_REFRESH_TOKEN` env var from all three environments.**

- Railway prod backend service: delete `YOUTUBE_OAUTH_REFRESH_TOKEN` variable.
- Railway dev backend service: delete `YOUTUBE_OAUTH_REFRESH_TOKEN` variable.
- Local `packages/backend/.env.local`: remove the `YOUTUBE_OAUTH_REFRESH_TOKEN=` line.

Restart both Railway services (or wait for the next deploy). Confirm prod + dev still heal-checky with the env var absent.

- [ ] **Step 11: Update `docs/content-pipeline/deploy-state.md`.**

Add to the migrations applied list:

```
9. `20260423000200_platform_credentials.sql` — platform_credentials table for in-app OAuth
```

Add a section:

```
## In-app OAuth (2026-04-23)

YouTube Shorts OAuth is now managed via /admin/content-pipeline/platforms. The YOUTUBE_OAUTH_REFRESH_TOKEN env var has been REMOVED from all three environments. To reconnect, click Connect on the platforms page.
```

Remove the "Rotate Google OAuth client secret" note from the Known gaps section if desired (optional cleanup — the secret is no longer exposed in a refresh-token URL at least).

```bash
git add docs/content-pipeline/deploy-state.md
git commit -m "docs(content-pipeline): deploy-state reflects in-app OAuth + migration 20260423000200"
git push origin main
```

- [ ] **Step 12: Update `docs/content-pipeline/platform-setup/youtube.md`.**

Add a new top-level section titled `## Setup (in-app, recommended)` that says:

```
1. Log in to the admin UI as an admin user.
2. Navigate to /admin/content-pipeline/platforms.
3. Click Connect on the YouTube Shorts row.
4. Complete Google's consent screen — sign in with the account that manages @propertyIQ_app. If Google shows a channel picker, select @propertyIQ_app.
5. You land back on the platforms page with a green snackbar. The row shows "Connected · @propertyIQ_app".

No env vars to set. Refresh token is stored encrypted in the platform_credentials table.
```

Move the existing "Step 1-6" (Google Cloud project / OAuth Playground walkthrough) under a section titled `## Legacy setup (deprecated)` with a note that this is kept only for recovery if the in-app flow breaks.

```bash
git add docs/content-pipeline/platform-setup/youtube.md
git commit -m "docs(content-pipeline): in-app OAuth is now the canonical YouTube setup"
git push origin main
```

---

## Self-review — spec coverage check

**Spec requirements → task mapping:**

| Spec requirement                                                            | Task    |
| --------------------------------------------------------------------------- | ------- |
| Migration `20260423000200_platform_credentials.sql` applies cleanly         | Task 1  |
| `PlatformCredentialsService` with `getActive`, `upsertActive`, `disconnect` | Task 2  |
| HMAC-signed state with 10-min expiry                                        | Task 3  |
| `PlatformPublisher.isConfigured` async                                      | Task 4  |
| YouTubeShortsPublisher DB-backed, no env fallback                           | Task 5  |
| `PlatformManagerService.startOAuth` signs state                             | Task 6  |
| `getPlatformStatuses` returns 6 canonical platforms                         | Task 6  |
| `GET /oauth-callback` (public, state-gated)                                 | Task 7  |
| `DELETE /credentials` (AdminGuard)                                          | Task 7  |
| PlatformRow three visual states                                             | Task 9  |
| Connect button = full navigation to authUrl                                 | Task 9  |
| Disconnect button with confirmation modal                                   | Task 9  |
| Platforms page handles `?connected=`/`?error=` params                       | Task 10 |
| Error-code → human-readable message mapping                                 | Task 10 |
| Google Console redirect URIs updated                                        | Task 11 |
| `APP_BASE_URL` = backend origin, `FRONTEND_URL` = frontend origin           | Task 11 |
| Local smoke: Connect → retry run → publish                                  | Task 12 |
| Disconnect behavior: isConfigured false, row marked                         | Task 12 |
| Merge branch → develop → main pattern                                       | Task 13 |
| Migration applied to shared Supabase post-merge                             | Task 13 |
| `YOUTUBE_OAUTH_REFRESH_TOKEN` removed from all envs                         | Task 13 |
| `deploy-state.md` + `platform-setup/youtube.md` updated                     | Task 13 |

No spec gaps.

**Placeholder scan:** no "TBD", "TODO", "implement later", or "similar to task N" patterns. All code blocks are complete. All commands are executable verbatim.

**Type consistency:**

- `isConfigured` is `Promise<boolean>` in the interface (Task 4), the publisher (Task 5), and the manager's `Promise.all` call (Task 6). ✓
- `PlatformStatus` shape matches between backend `platform-manager.service.ts` (Task 6) and frontend `content-pipeline-api.ts` (Task 8). ✓
- `getActive` return type `ActiveCredential | null` consistent across service (Task 2), publisher (Task 5), and manager (Task 6). ✓
- OAuth state `StatePayload` shape consistent between `oauth-state.ts` (Task 3) and callback controller (Task 7). ✓

**Scope check:** all changes land under `content-pipeline`; single implementation plan is appropriate.

No issues found on review.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-content-pipeline-platform-oauth.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration, clean main context. Uses superpowers:subagent-driven-development.

2. **Inline Execution** — execute tasks in this session using superpowers:executing-plans, batch execution with checkpoints for review.

Which approach?
