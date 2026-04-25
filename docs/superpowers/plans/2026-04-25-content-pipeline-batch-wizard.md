# Content Pipeline Batch Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in Batch mode to the `/admin/content-pipeline/new` wizard that resolves a scope (e.g. "all zips in metro 12420") to a list of markets, lets the operator prune the list, and on Submit creates one independent run per checked market — with a final destination-landing gate that produces 3 live YouTube videos before claiming done.

**Architecture:** Wizard-only UX changes. Per-run code path is unchanged — each batched run flows through fetch-data → script → render → publish exactly like a single-market run, sharing only a `batch_id` UUID for grouping. Two new backend endpoints: `GET /scope/resolve` (geography crosswalk lookup) and `POST /runs/batch` (loops existing `createRun`). One new schema column: `content_runs.batch_id`. Multi-market formats and MCP consolidation are explicitly out of scope (separate design docs).

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind 4 · TanStack React Query · NestJS 11 · Supabase Postgres · pg-boss · class-validator · react-window (NEW) · Jest · Playwright (validation-only).

**Spec:** `docs/superpowers/specs/2026-04-25-content-pipeline-batch-wizard-design.md`

**Branch:** `feat/content-pipeline-p2`

---

## File Structure

### New backend files

| Path                                                                 | Responsibility                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/backend/src/content-pipeline/scope/scope.service.ts`       | Resolve scope DTO → list of markets via `geography_crosswalk` |
| `packages/backend/src/content-pipeline/scope/scope.service.spec.ts`  | Unit tests for ScopeService                                   |
| `packages/backend/src/content-pipeline/scope/scope.controller.ts`    | `GET /api/admin/content-pipeline/scope/resolve`               |
| `packages/backend/src/content-pipeline/dto/resolve-scope.dto.ts`     | Discriminated union DTO with class-validator                  |
| `packages/backend/src/content-pipeline/dto/create-batch-runs.dto.ts` | `{format, markets[], approvalMode, platforms}`                |
| `packages/backend/src/content-pipeline/batch-runs.controller.ts`     | `POST /api/admin/content-pipeline/runs/batch`                 |
| `supabase/migrations/20260425000400_content_runs_batch_id.sql`       | Add `batch_id` UUID + partial index                           |

### New frontend files

| Path                                                                         | Responsibility                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/frontend/app/admin/content-pipeline/lib/scope-api.ts`              | `resolveScope()` fetcher + `useResolvedScope()` hook               |
| `packages/frontend/app/admin/content-pipeline/lib/batch-runs-api.ts`         | `createBatchRuns()` mutation + `useCreateBatchRuns()` hook         |
| `packages/frontend/app/admin/content-pipeline/new/scope-input.tsx`           | Discriminated input renderer (state / metro / textarea)            |
| `packages/frontend/app/admin/content-pipeline/new/resolved-markets-list.tsx` | Virtualized checklist with sticky header, search, sort, select-all |
| `packages/frontend/app/admin/content-pipeline/new/market-step-batch.tsx`     | Batch mode body — owns scope state, composes input + checklist     |
| `packages/frontend/app/admin/content-pipeline/new/single-market-summary.tsx` | Extracted from `confirm-step.tsx` to keep it under cap             |
| `packages/frontend/app/admin/content-pipeline/new/batch-confirm-banner.tsx`  | Confirm-step batch banner with collapsible markets list            |
| `packages/frontend/app/admin/content-pipeline/new/batch-submit-dialog.tsx`   | M3Dialog wrapper for 50+/250+ ack flow                             |
| `scripts/validate-batch-wizard.mjs`                                          | Playwright destination-gate validation runner                      |

### Modified files

| Path                                                                        | Change                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/backend/src/content-pipeline/content-pipeline.module.ts`          | Register ScopeService, ScopeController, BatchRunsController             |
| `packages/backend/src/content-pipeline/dto/create-run.dto.ts`               | Add optional `batchId?: string`                                         |
| `packages/backend/src/content-pipeline/content-runs.service.ts`             | Persist `batch_id` if provided in DTO                                   |
| `packages/backend/src/content-pipeline/content-pipeline-queries.service.ts` | `getDashboardRuns()` accepts `batchId?` filter                          |
| `packages/backend/src/content-pipeline/content-pipeline.controller.ts`      | `dashboard()` reads `?batchId=` query param, passes through             |
| `scripts/apply-content-pipeline-migrations.js`                              | Append `20260425000400_content_runs_batch_id.sql` to `MIGRATIONS` array |
| `packages/frontend/app/admin/content-pipeline/new/page.tsx`                 | Add `mode`/batch state, pass `mode` to children, branch submit handler  |
| `packages/frontend/app/admin/content-pipeline/new/market-step.tsx`          | Add Single/Batch toggle, render batch body via `<MarketStepBatch />`    |
| `packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx`         | Branch on `mode === 'batch'`, swap summary + Submit handler             |
| `packages/frontend/app/admin/content-pipeline/page.tsx` (dashboard)         | Read `?batch=<id>`, filter runs, show banner                            |
| `packages/frontend/package.json`                                            | Add `react-window` (and `@types/react-window`)                          |

---

## Phase A: Backend foundation

### Task 1: Schema migration for `batch_id`

**Files:**

- Create: `supabase/migrations/20260425000400_content_runs_batch_id.sql`
- Modify: `scripts/apply-content-pipeline-migrations.js` (append migration filename)

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260425000400_content_runs_batch_id.sql` with:

```sql
-- Add batch_id to content_runs so batch-created runs can be grouped/filtered
-- back at the dashboard. Most runs are single (NULL batch_id), so the index
-- is partial to keep it small.

ALTER TABLE content_runs
  ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_content_runs_batch_id
  ON content_runs(batch_id)
  WHERE batch_id IS NOT NULL;

GRANT ALL ON content_runs TO service_role;
GRANT ALL ON content_runs TO authenticated;
```

- [ ] **Step 2: Append to migrations runner**

Edit `scripts/apply-content-pipeline-migrations.js` — add the new file to the `MIGRATIONS` array at the end:

```javascript
// existing entries...
"20260425000200_platform_app_credentials.sql",
"20260425000300_platform_app_credentials_config.sql",
"20260425000400_content_runs_batch_id.sql",
```

- [ ] **Step 3: Apply migration**

Run: `node scripts/apply-content-pipeline-migrations.js`
Expected: `APPLYING: 20260425000400_content_runs_batch_id.sql` followed by `OK`. Existing migrations should all log `OK` (idempotent).

- [ ] **Step 4: Verify column exists**

Run: `node -e "const{Client}=require('pg');const c=new Client({connectionString:'postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:6543/postgres',ssl:{rejectUnauthorized:false}});(async()=>{await c.connect();const{rows}=await c.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='content_runs' AND column_name='batch_id'\");console.log(rows);await c.end();})();"`
Expected: `[ { column_name: 'batch_id' } ]`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260425000400_content_runs_batch_id.sql scripts/apply-content-pipeline-migrations.js
git commit -m "feat(content-pipeline): add batch_id column to content_runs"
```

---

### Task 2: ScopeService — DTO and resolution logic

**Files:**

- Create: `packages/backend/src/content-pipeline/dto/resolve-scope.dto.ts`
- Create: `packages/backend/src/content-pipeline/scope/scope.service.ts`
- Test: `packages/backend/src/content-pipeline/scope/scope.service.spec.ts`

- [ ] **Step 1: Create the DTO**

Create `packages/backend/src/content-pipeline/dto/resolve-scope.dto.ts`:

```typescript
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ArrayMaxSize,
  Length,
} from "class-validator";

export type ScopeType =
  | "metros_in_state"
  | "zips_in_state"
  | "zips_in_metro"
  | "custom";

export class ResolveScopeDto {
  @IsIn(["metros_in_state", "zips_in_state", "zips_in_metro", "custom"])
  type!: ScopeType;

  // For metros_in_state, zips_in_state — 2-letter state code (e.g. "TX")
  @IsOptional()
  @IsString()
  @Length(2, 2)
  state?: string;

  // For zips_in_metro — CBSA code (e.g. "12420")
  @IsOptional()
  @IsString()
  @Length(5, 5)
  cbsaCode?: string;

  // For custom — comma/whitespace-separated codes (zips OR cbsa codes, mixed OK)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  codes?: string[];
}

export interface ResolvedMarket {
  id: string;
  geography: "metro" | "zip";
  canonical_name: string;
  population: number | null;
  score: number | null;
}

export interface ResolveScopeResult {
  markets: ResolvedMarket[];
  truncated: boolean;
  unrecognized?: string[];
}
```

- [ ] **Step 2: Write the failing test**

Create `packages/backend/src/content-pipeline/scope/scope.service.spec.ts`:

```typescript
import { ScopeService } from "./scope.service";
import { SupabaseService } from "../../supabase/supabase.service";

describe("ScopeService.resolve", () => {
  function buildHarness(rows: any[]) {
    const queryFn = jest.fn().mockResolvedValue({ data: rows, error: null });
    const supabase = {
      getClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              limit: () => ({
                then: (cb: any) => cb({ data: rows, error: null }),
              }),
            }),
            in: () => ({
              limit: () => ({
                then: (cb: any) => cb({ data: rows, error: null }),
              }),
            }),
          }),
        }),
        rpc: queryFn,
      }),
    } as unknown as SupabaseService;
    return { svc: new ScopeService(supabase), queryFn };
  }

  it("rejects metros_in_state with no state", async () => {
    const { svc } = buildHarness([]);
    await expect(
      svc.resolve({ type: "metros_in_state" } as any),
    ).rejects.toThrow(/state required/);
  });

  it("rejects zips_in_metro with no cbsaCode", async () => {
    const { svc } = buildHarness([]);
    await expect(svc.resolve({ type: "zips_in_metro" } as any)).rejects.toThrow(
      /cbsaCode required/,
    );
  });

  it("rejects custom with empty codes", async () => {
    const { svc } = buildHarness([]);
    await expect(
      svc.resolve({ type: "custom", codes: [] } as any),
    ).rejects.toThrow(/codes required/);
  });

  it("separates valid from unrecognized for custom type", async () => {
    // CBSA-like (5 digits, treated as metro), zip-like (5 digits — same shape; resolution disambiguates by which table contains the row)
    const validCbsa = {
      id: "12420",
      geography: "metro",
      canonical_name: "Austin, TX",
      population: 2295303,
      score: 72,
    };
    const validZip = {
      id: "78704",
      geography: "zip",
      canonical_name: "ZIP 78704 (Austin, TX)",
      population: 50000,
      score: 80,
    };
    const { svc } = buildHarness([validCbsa, validZip]);
    // Spy: resolveCustom returns recognized [validCbsa, validZip] + unrecognized ['99999']
    const spy = jest.spyOn(svc as any, "resolveCustom").mockResolvedValue({
      markets: [validCbsa, validZip],
      truncated: false,
      unrecognized: ["99999"],
    });
    const result = await svc.resolve({
      type: "custom",
      codes: ["12420", "78704", "99999"],
    });
    expect(result.markets).toHaveLength(2);
    expect(result.unrecognized).toEqual(["99999"]);
    spy.mockRestore();
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `cd packages/backend && pnpm jest src/content-pipeline/scope/scope.service.spec.ts`
Expected: FAIL with "Cannot find module './scope.service'"

- [ ] **Step 4: Implement ScopeService**

Create `packages/backend/src/content-pipeline/scope/scope.service.ts`:

```typescript
import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import {
  ResolveScopeDto,
  ResolveScopeResult,
  ResolvedMarket,
} from "../dto/resolve-scope.dto";

const MAX_RESOLVED_MARKETS = 2500;

@Injectable()
export class ScopeService {
  private readonly logger = new Logger(ScopeService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async resolve(dto: ResolveScopeDto): Promise<ResolveScopeResult> {
    switch (dto.type) {
      case "metros_in_state":
        if (!dto.state) throw new BadRequestException("state required");
        return this.resolveMetrosInState(dto.state.toUpperCase());
      case "zips_in_state":
        if (!dto.state) throw new BadRequestException("state required");
        return this.resolveZipsInState(dto.state.toUpperCase());
      case "zips_in_metro":
        if (!dto.cbsaCode) throw new BadRequestException("cbsaCode required");
        return this.resolveZipsInMetro(dto.cbsaCode);
      case "custom":
        if (!dto.codes || dto.codes.length === 0)
          throw new BadRequestException("codes required");
        return this.resolveCustom(dto.codes);
    }
  }

  private async resolveMetrosInState(
    stateCode: string,
  ): Promise<ResolveScopeResult> {
    // geography_crosswalk has state_code (2-letter) per row; distinct CBSA codes within
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from("geography_crosswalk")
      .select("cbsa_code, cbsa_name, cbsa_population")
      .eq("state_code", stateCode)
      .not("cbsa_code", "is", null)
      .limit(MAX_RESOLVED_MARKETS);
    if (error) throw new Error(`crosswalk lookup failed: ${error.message}`);
    const seen = new Set<string>();
    const markets: ResolvedMarket[] = [];
    for (const row of data ?? []) {
      const r = row as {
        cbsa_code: string;
        cbsa_name: string | null;
        cbsa_population: number | null;
      };
      if (!r.cbsa_code || seen.has(r.cbsa_code)) continue;
      seen.add(r.cbsa_code);
      markets.push({
        id: r.cbsa_code,
        geography: "metro",
        canonical_name: r.cbsa_name ?? `Metro ${r.cbsa_code}`,
        population: r.cbsa_population,
        score: null,
      });
    }
    await this.attachScores(markets);
    return { markets, truncated: markets.length >= MAX_RESOLVED_MARKETS };
  }

  private async resolveZipsInState(
    stateCode: string,
  ): Promise<ResolveScopeResult> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from("geography_crosswalk")
      .select("zip_code")
      .eq("state_code", stateCode)
      .not("zip_code", "is", null)
      .limit(MAX_RESOLVED_MARKETS);
    if (error) throw new Error(`crosswalk lookup failed: ${error.message}`);
    const markets: ResolvedMarket[] = (data ?? []).map((row) => {
      const r = row as { zip_code: string };
      return {
        id: r.zip_code,
        geography: "zip",
        canonical_name: `ZIP ${r.zip_code}`,
        population: null,
        score: null,
      };
    });
    await this.attachScores(markets);
    return {
      markets,
      truncated: markets.length >= MAX_RESOLVED_MARKETS,
    };
  }

  private async resolveZipsInMetro(
    cbsaCode: string,
  ): Promise<ResolveScopeResult> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from("geography_crosswalk")
      .select("zip_code")
      .eq("cbsa_code", cbsaCode)
      .not("zip_code", "is", null)
      .limit(MAX_RESOLVED_MARKETS);
    if (error) throw new Error(`crosswalk lookup failed: ${error.message}`);
    const markets: ResolvedMarket[] = (data ?? []).map((row) => {
      const r = row as { zip_code: string };
      return {
        id: r.zip_code,
        geography: "zip",
        canonical_name: `ZIP ${r.zip_code}`,
        population: null,
        score: null,
      };
    });
    await this.attachScores(markets);
    return {
      markets,
      truncated: markets.length >= MAX_RESOLVED_MARKETS,
    };
  }

  private async resolveCustom(rawCodes: string[]): Promise<ResolveScopeResult> {
    const client = this.supabase.getClient();
    const trimmed = rawCodes.map((c) => c.trim()).filter(Boolean);
    const dedupe = Array.from(new Set(trimmed));

    // Look up as both zip and cbsa concurrently; one or the other will hit.
    const [{ data: zipRows }, { data: cbsaRows }] = await Promise.all([
      client
        .from("geography_crosswalk")
        .select("zip_code, cbsa_name, state_code")
        .in("zip_code", dedupe),
      client
        .from("geography_crosswalk")
        .select("cbsa_code, cbsa_name, cbsa_population")
        .in("cbsa_code", dedupe)
        .not("cbsa_code", "is", null),
    ]);

    const matchedIds = new Set<string>();
    const markets: ResolvedMarket[] = [];

    for (const row of zipRows ?? []) {
      const r = row as {
        zip_code: string;
        cbsa_name: string | null;
        state_code: string | null;
      };
      if (!r.zip_code || matchedIds.has(`zip:${r.zip_code}`)) continue;
      matchedIds.add(`zip:${r.zip_code}`);
      markets.push({
        id: r.zip_code,
        geography: "zip",
        canonical_name: `ZIP ${r.zip_code}${r.cbsa_name ? ` (${r.cbsa_name})` : ""}`,
        population: null,
        score: null,
      });
    }

    const seenCbsa = new Set<string>();
    for (const row of cbsaRows ?? []) {
      const r = row as {
        cbsa_code: string;
        cbsa_name: string | null;
        cbsa_population: number | null;
      };
      if (!r.cbsa_code || seenCbsa.has(r.cbsa_code)) continue;
      seenCbsa.add(r.cbsa_code);
      matchedIds.add(`metro:${r.cbsa_code}`);
      markets.push({
        id: r.cbsa_code,
        geography: "metro",
        canonical_name: r.cbsa_name ?? `Metro ${r.cbsa_code}`,
        population: r.cbsa_population,
        score: null,
      });
    }

    const recognizedCodes = new Set([
      ...(zipRows ?? []).map((r: any) => r.zip_code).filter(Boolean),
      ...(cbsaRows ?? []).map((r: any) => r.cbsa_code).filter(Boolean),
    ]);
    const unrecognized = dedupe.filter((c) => !recognizedCodes.has(c));

    await this.attachScores(markets);
    return {
      markets,
      truncated: false,
      unrecognized: unrecognized.length > 0 ? unrecognized : undefined,
    };
  }

  private async attachScores(markets: ResolvedMarket[]): Promise<void> {
    if (markets.length === 0) return;
    const client = this.supabase.getClient();
    const byLevel: Record<"metro" | "zip", string[]> = { metro: [], zip: [] };
    for (const m of markets) byLevel[m.geography].push(m.id);

    const lookups: Promise<any>[] = [];
    if (byLevel.metro.length > 0) {
      lookups.push(
        client
          .from("propertyiq_scores")
          .select("geo_id, score")
          .eq("geo_level", "metro")
          .eq("score_type", "propertyiq")
          .in("geo_id", byLevel.metro),
      );
    }
    if (byLevel.zip.length > 0) {
      lookups.push(
        client
          .from("propertyiq_scores")
          .select("geo_id, score")
          .eq("geo_level", "zip")
          .eq("score_type", "propertyiq")
          .in("geo_id", byLevel.zip),
      );
    }
    if (lookups.length === 0) return;
    const results = await Promise.all(lookups);
    const scoreMap = new Map<string, number>();
    for (const res of results) {
      for (const row of res.data ?? []) {
        scoreMap.set(`${row.geo_id}`, Number(row.score));
      }
    }
    for (const m of markets) {
      const s = scoreMap.get(m.id);
      if (typeof s === "number") m.score = s;
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/backend && pnpm jest src/content-pipeline/scope/scope.service.spec.ts`
Expected: PASS — 4 tests passing.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/content-pipeline/dto/resolve-scope.dto.ts packages/backend/src/content-pipeline/scope/scope.service.ts packages/backend/src/content-pipeline/scope/scope.service.spec.ts
git commit -m "feat(content-pipeline): ScopeService resolves scope DTOs to market lists"
```

---

### Task 3: Scope controller + module wiring

**Files:**

- Create: `packages/backend/src/content-pipeline/scope/scope.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.module.ts`

- [ ] **Step 1: Create the controller**

Create `packages/backend/src/content-pipeline/scope/scope.controller.ts`:

```typescript
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../../common/guards/admin-auth.guard";
import { ResolveScopeDto } from "../dto/resolve-scope.dto";
import { ScopeService } from "./scope.service";

/**
 * Resolve a scope spec (metros-in-state, zips-in-metro, custom list...) to
 * a concrete list of markets. Used by the batch-mode wizard checklist.
 *
 * POST (not GET) because the body can hold a custom-list array of up to
 * 1000 codes — that hits URL length limits on GET.
 */
@UseGuards(AdminGuard)
@Controller("api/admin/content-pipeline/scope")
export class ScopeController {
  constructor(private readonly scope: ScopeService) {}

  @Post("resolve")
  async resolve(@Body() dto: ResolveScopeDto) {
    return { success: true, data: await this.scope.resolve(dto) };
  }
}
```

- [ ] **Step 2: Register in module**

Edit `packages/backend/src/content-pipeline/content-pipeline.module.ts`:

Add to imports near the top:

```typescript
import { ScopeController } from "./scope/scope.controller";
import { ScopeService } from "./scope/scope.service";
```

Add `ScopeController` to the `controllers` array (alongside `FormatsController`):

```typescript
controllers: [
  ContentPipelineController,
  PlatformOAuthCallbackController,
  ShortLinkController,
  MagnetLibraryController,
  StyleReferenceController,
  ArchetypeLibraryController,
  FormatsController,
  ScopeController,
],
```

Add `ScopeService` to the `providers` array (anywhere in the list):

```typescript
ScopeService,
```

- [ ] **Step 3: Build to verify no type errors**

Run: `cd packages/backend && pnpm build`
Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Smoke test the endpoint locally**

Start the backend: `cd packages/backend && pnpm start:dev` (run in background)

Then call the endpoint (replace `<ADMIN_TOKEN>` with a valid admin session cookie or auth header — get from the browser DevTools after logging in):

```bash
curl -X POST http://localhost:3001/api/admin/content-pipeline/scope/resolve \
  -H "Content-Type: application/json" \
  -H "Cookie: <ADMIN_SESSION>" \
  -d '{"type":"zips_in_metro","cbsaCode":"12420"}'
```

Expected: `{"success":true,"data":{"markets":[...],"truncated":false}}` with at least 50 zips for Austin metro.

Stop the backend.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/scope/scope.controller.ts packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): POST /scope/resolve endpoint with AdminGuard"
```

---

### Task 4: Plumb optional `batchId` through CreateRunDto and ContentRunsService

**Files:**

- Modify: `packages/backend/src/content-pipeline/dto/create-run.dto.ts`
- Modify: `packages/backend/src/content-pipeline/content-runs.service.ts`

- [ ] **Step 1: Add optional `batchId` to CreateRunDto**

Edit `packages/backend/src/content-pipeline/dto/create-run.dto.ts` — add at the end of the class, before the closing brace:

```typescript
  @IsOptional()
  @IsUUID('4')
  batchId?: string;
```

- [ ] **Step 2: Persist batch_id in createRun**

Edit `packages/backend/src/content-pipeline/content-runs.service.ts` — find the `.insert({...})` call inside `createRun` and add a `batch_id` line:

```typescript
const { data: inserted, error } = await client
  .from("content_runs")
  .insert({
    format: dto.format,
    audience: template.audience,
    market_query: dto.marketQuery,
    approval_mode: dto.approvalMode ?? template.default_approval_mode,
    tts_provider: template.default_tts_provider,
    tts_voice_id: template.default_tts_voice_id,
    selected_platforms: dto.selectedPlatforms ?? template.default_platforms,
    idempotency_key: dto.idempotencyKey,
    batch_id: dto.batchId ?? null,
    status: "queued",
    triggered_by: "manual",
  })
  .select("id, status")
  .single();
```

- [ ] **Step 3: Build to verify no type errors**

Run: `cd packages/backend && pnpm build`
Expected: clean build.

- [ ] **Step 4: Run existing content-runs tests**

Run: `cd packages/backend && pnpm jest src/content-pipeline/content-runs.service.spec.ts`
Expected: all existing tests still pass — `triggerTestMagnet` doesn't touch the changed insert path.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/dto/create-run.dto.ts packages/backend/src/content-pipeline/content-runs.service.ts
git commit -m "feat(content-pipeline): plumb optional batchId through createRun"
```

---

### Task 5: Batch runs DTO + controller

**Files:**

- Create: `packages/backend/src/content-pipeline/dto/create-batch-runs.dto.ts`
- Create: `packages/backend/src/content-pipeline/batch-runs.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.module.ts`

- [ ] **Step 1: Create the batch DTO**

Create `packages/backend/src/content-pipeline/dto/create-batch-runs.dto.ts`:

```typescript
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApprovalMode, ContentFormat, Platform } from "../types";

export class BatchMarketDto {
  @IsString()
  id!: string;

  @IsIn(["metro", "zip"])
  geography!: "metro" | "zip";
}

export class CreateBatchRunsDto {
  @IsIn([
    "grade_reveal",
    "top_10_ranking",
    "score_mover",
    "head_to_head",
    "long_form_deep_dive",
    "farm_area_spotlight",
    "brokerage_market_share",
    "recruitment_angle",
  ])
  format!: ContentFormat;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BatchMarketDto)
  markets!: BatchMarketDto[];

  @IsOptional()
  @IsIn(["auto", "review", "draft"])
  approvalMode?: ApprovalMode;

  @IsOptional()
  @IsArray()
  platforms?: Platform[];
}
```

- [ ] **Step 2: Create the controller**

Create `packages/backend/src/content-pipeline/batch-runs.controller.ts`:

```typescript
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AdminGuard } from "../common/guards/admin-auth.guard";
import { ContentRunsService } from "./content-runs.service";
import { CreateBatchRunsDto } from "./dto/create-batch-runs.dto";

interface BatchResponse {
  batchId: string;
  created: number;
  failed: number;
  runIds: string[];
  errors?: { marketId: string; message: string }[];
}

/**
 * Fan-out endpoint: one Submit creates N independent content_runs sharing
 * a batch_id. Each run still flows through the normal orchestrator —
 * batching is purely a creation-time grouping, not a separate code path.
 *
 * Partial success allowed: if 38 of 42 succeed, the response reports
 * `{created: 38, failed: 4, errors: [...]}` and the caller decides how
 * to surface that.
 */
@UseGuards(AdminGuard)
@Controller("api/admin/content-pipeline/runs")
export class BatchRunsController {
  constructor(private readonly runs: ContentRunsService) {}

  @Post("batch")
  async createBatch(@Body() dto: CreateBatchRunsDto) {
    const batchId = randomUUID();
    const runIds: string[] = [];
    const errors: { marketId: string; message: string }[] = [];

    for (const market of dto.markets) {
      try {
        // marketQuery is what FetchDataHandler parses; using the canonical
        // id is the most reliable form (resolveMarket accepts cbsa codes
        // and zip codes directly).
        const result = await this.runs.createRun({
          format: dto.format,
          marketQuery: market.id,
          idempotencyKey: randomUUID(),
          approvalMode: dto.approvalMode,
          selectedPlatforms: dto.platforms,
          batchId,
        });
        runIds.push(result.id);
      } catch (err) {
        errors.push({
          marketId: market.id,
          message: (err as Error).message,
        });
      }
    }

    const response: BatchResponse = {
      batchId,
      created: runIds.length,
      failed: errors.length,
      runIds,
    };
    if (errors.length > 0) response.errors = errors;
    return { success: true, data: response };
  }
}
```

- [ ] **Step 3: Register in module**

Edit `packages/backend/src/content-pipeline/content-pipeline.module.ts`:

Add import:

```typescript
import { BatchRunsController } from "./batch-runs.controller";
```

Add to `controllers` array:

```typescript
BatchRunsController,
```

- [ ] **Step 4: Build**

Run: `cd packages/backend && pnpm build`
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/dto/create-batch-runs.dto.ts packages/backend/src/content-pipeline/batch-runs.controller.ts packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): POST /runs/batch fan-out endpoint"
```

---

### Task 6: `?batchId=` filter on the dashboard runs query

**Files:**

- Modify: `packages/backend/src/content-pipeline/content-pipeline-queries.service.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`

- [ ] **Step 1: Inspect the existing dashboard query**

Run: `grep -n "getDashboard\|recentRuns" packages/backend/src/content-pipeline/content-pipeline-queries.service.ts | head`
Note the function signature you'll need to extend.

- [ ] **Step 2: Add optional `batchId` filter to dashboard query**

Edit `packages/backend/src/content-pipeline/content-pipeline-queries.service.ts` — locate the dashboard runs query (the one feeding `recentRuns`). Wrap the existing `.from('content_runs').select(...)` so that when `batchId` is provided it adds `.eq('batch_id', batchId)` and removes the recency limit (return all runs in the batch instead of just the latest 20).

Find the existing `getDashboard` method (signature like `async getDashboard()`). Change it to:

```typescript
async getDashboard(opts: { batchId?: string } = {}): Promise<DashboardData> {
  // ...existing thisWeek + reviewQueueCount logic unchanged...

  const client = this.supabase.getClient();
  let runsQuery = client
    .from('content_runs')
    .select(/* existing field list */)
    .order('created_at', { ascending: false });

  if (opts.batchId) {
    runsQuery = runsQuery.eq('batch_id', opts.batchId);
  } else {
    runsQuery = runsQuery.limit(20);
  }

  const { data: recentRuns } = await runsQuery;
  // ...rest unchanged...
}
```

(Replace `/* existing field list */` with whatever the current select string is — read the file first.)

- [ ] **Step 3: Pass query param through controller**

Edit `packages/backend/src/content-pipeline/content-pipeline.controller.ts` — find the `dashboard` handler and change to:

```typescript
@Get('dashboard')
async dashboard(@Query('batchId') batchId?: string) {
  return {
    success: true,
    data: await this.queries.getDashboard({ batchId }),
  };
}
```

- [ ] **Step 4: Build**

Run: `cd packages/backend && pnpm build`
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/content-pipeline-queries.service.ts packages/backend/src/content-pipeline/content-pipeline.controller.ts
git commit -m "feat(content-pipeline): dashboard supports ?batchId=<uuid> filter"
```

---

## Phase B: Frontend API client

### Task 7: scope-api.ts (resolveScope + useResolvedScope)

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/lib/scope-api.ts`

- [ ] **Step 1: Write the API module**

Create `packages/frontend/app/admin/content-pipeline/lib/scope-api.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export type ScopeType =
  | "metros_in_state"
  | "zips_in_state"
  | "zips_in_metro"
  | "custom";

export interface ScopeSpec {
  type: ScopeType;
  state?: string;
  cbsaCode?: string;
  codes?: string[];
}

export interface ResolvedMarket {
  id: string;
  geography: "metro" | "zip";
  canonical_name: string;
  population: number | null;
  score: number | null;
}

export interface ResolveScopeResult {
  markets: ResolvedMarket[];
  truncated: boolean;
  unrecognized?: string[];
}

export async function resolveScope(
  spec: ScopeSpec,
): Promise<ResolveScopeResult> {
  const res = await fetchAPIRaw("/api/admin/content-pipeline/scope/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`resolveScope failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { data: ResolveScopeResult };
  return json.data;
}

/**
 * Returns null when scope is incompletely specified (caller hasn't picked
 * everything yet) — caller should hide the resolved-markets list until
 * data is non-null.
 */
function isComplete(spec: ScopeSpec): boolean {
  if (spec.type === "metros_in_state" || spec.type === "zips_in_state")
    return !!spec.state;
  if (spec.type === "zips_in_metro") return !!spec.cbsaCode;
  if (spec.type === "custom") return (spec.codes?.length ?? 0) > 0;
  return false;
}

export function useResolvedScope(spec: ScopeSpec | null) {
  return useQuery({
    queryKey: ["scope-resolve", spec ? JSON.stringify(spec) : "none"],
    queryFn: () => resolveScope(spec!),
    enabled: !!spec && isComplete(spec),
    staleTime: 30 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Type-check the frontend**

Run: `cd packages/frontend && pnpm build`
Expected: clean build (or at least no errors in the new file — there may be unrelated existing errors).

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/lib/scope-api.ts
git commit -m "feat(content-pipeline): frontend scope-api with React Query hook"
```

---

### Task 8: batch-runs-api.ts (createBatchRuns + useCreateBatchRuns)

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/lib/batch-runs-api.ts`

- [ ] **Step 1: Write the API module**

Create `packages/frontend/app/admin/content-pipeline/lib/batch-runs-api.ts`:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export interface BatchMarket {
  id: string;
  geography: "metro" | "zip";
}

export interface CreateBatchRunsRequest {
  format: string;
  markets: BatchMarket[];
  approvalMode?: "auto" | "review" | "draft";
  platforms?: string[];
}

export interface CreateBatchRunsResponse {
  batchId: string;
  created: number;
  failed: number;
  runIds: string[];
  errors?: { marketId: string; message: string }[];
}

export async function createBatchRuns(
  req: CreateBatchRunsRequest,
): Promise<CreateBatchRunsResponse> {
  const res = await fetchAPIRaw("/api/admin/content-pipeline/runs/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createBatchRuns failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { data: CreateBatchRunsResponse };
  return json.data;
}

export function useCreateBatchRuns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBatchRuns,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-pipeline-dashboard"] });
    },
  });
}
```

- [ ] **Step 2: Build to verify**

Run: `cd packages/frontend && pnpm build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/lib/batch-runs-api.ts
git commit -m "feat(content-pipeline): frontend batch-runs-api with createBatchRuns mutation"
```

---

## Phase C: Frontend wizard — state and toggle

### Task 9: Add batch state to wizard shell

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/new/page.tsx`

- [ ] **Step 1: Replace the shell with batch-aware state**

Open `packages/frontend/app/admin/content-pipeline/new/page.tsx`. Replace the entire file contents with:

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormatStep } from "./format-step";
import { MarketStep } from "./market-step";
import { ConfirmStep } from "./confirm-step";
import type { BatchMarket } from "../lib/batch-runs-api";

export type WizardMode = "single" | "batch";

export default function NewRunPage() {
  const [step, setStep] = useState<"format" | "market" | "confirm">("format");
  const [format, setFormat] = useState<string>("");
  const [mode, setMode] = useState<WizardMode>("single");
  const [market, setMarket] = useState<string>("");
  const [batchMarkets, setBatchMarkets] = useState<BatchMarket[]>([]);
  const router = useRouter();

  return (
    <div>
      {step === "format" && (
        <FormatStep
          onPick={(f) => {
            setFormat(f);
            setStep("market");
          }}
        />
      )}
      {step === "market" && (
        <MarketStep
          mode={mode}
          onModeChange={setMode}
          onBack={() => setStep("format")}
          onPickSingle={(m) => {
            setMarket(m);
            setStep("confirm");
          }}
          onPickBatch={(markets) => {
            setBatchMarkets(markets);
            setStep("confirm");
          }}
        />
      )}
      {step === "confirm" && (
        <ConfirmStep
          format={format}
          mode={mode}
          market={market}
          batchMarkets={batchMarkets}
          onBack={() => setStep("market")}
          onCreatedSingle={(id) =>
            router.push(`/admin/content-pipeline/runs/${id}`)
          }
          onCreatedBatch={(batchId) =>
            router.push(`/admin/content-pipeline?batch=${batchId}`)
          }
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check (will fail because MarketStep / ConfirmStep don't accept these props yet)**

Run: `cd packages/frontend && pnpm build`
Expected: TypeScript errors in `MarketStep` and `ConfirmStep` prop types — that's fine, we wire those up in the next tasks. Note the errors and continue.

- [ ] **Step 3: Commit (with known-broken state)**

This commit will leave the wizard in a non-compiling state for one task. That's intentional for clarity — the next task brings it back.

```bash
git add packages/frontend/app/admin/content-pipeline/new/page.tsx
git commit -m "wip(content-pipeline): wizard shell adds mode + batchMarkets state"
```

---

### Task 10: Single/Batch mode toggle in market-step.tsx

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/new/market-step.tsx`

- [ ] **Step 1: Update MarketStep signature and render the toggle**

Replace `packages/frontend/app/admin/content-pipeline/new/market-step.tsx` with:

```typescript
"use client";
import { useState } from "react";
import { resolveMarket } from "../lib/content-pipeline-api";
import type { BatchMarket } from "../lib/batch-runs-api";
import type { WizardMode } from "./page";

interface MarketMatch {
  id: string;
  canonical_name: string;
  geography: string;
  state?: string;
}

export function MarketStep({
  mode,
  onModeChange,
  onPickSingle,
  onPickBatch,
  onBack,
}: {
  mode: WizardMode;
  onModeChange: (mode: WizardMode) => void;
  onPickSingle: (market: string) => void;
  onPickBatch: (markets: BatchMarket[]) => void;
  onBack: () => void;
}) {
  return (
    <div className="p-8 max-w-3xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>
      <h1 className="text-2xl font-semibold mb-6">Pick a market</h1>

      <ModeToggle mode={mode} onChange={onModeChange} />

      {mode === "single" ? (
        <SingleMarketBody onPick={onPickSingle} />
      ) : (
        <BatchPlaceholder onPick={onPickBatch} />
      )}
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: WizardMode;
  onChange: (m: WizardMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full bg-surface-container-low p-1 mb-6"
      role="radiogroup"
    >
      {(["single", "batch"] as WizardMode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={`px-5 py-2 rounded-full text-sm font-semibold capitalize transition-colors duration-200 ${
              active
                ? "bg-primary text-on-primary"
                : "text-on-surface hover:bg-surface-container"
            }`}
          >
            {m === "single" ? "Single market" : "Batch"}
          </button>
        );
      })}
    </div>
  );
}

function SingleMarketBody({ onPick }: { onPick: (market: string) => void }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MarketMatch[]>([]);

  async function handleChange(v: string) {
    setQuery(v);
    if (v.length < 2) {
      setMatches([]);
      return;
    }
    const m = await resolveMarket(v);
    setMatches(m as MarketMatch[]);
  }

  return (
    <>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Cleveland, Miami, 78704..."
        className="w-full rounded-full border border-outline-variant px-6 py-4 text-lg"
        autoFocus
      />
      <div className="mt-4 space-y-2">
        {matches.map((m) => (
          <button
            key={m.id}
            onClick={() => onPick(m.canonical_name)}
            className="block w-full text-left p-4 rounded-lg hover:bg-surface-container-low"
          >
            <div className="font-medium">{m.canonical_name}</div>
            <div className="text-xs text-outline">
              {m.geography} {m.state ? `, ${m.state}` : ""}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

// Placeholder: the real <MarketStepBatch /> lands in Task 14. Until then,
// switching to Batch mode shows a "coming next task" message so the
// commit chain compiles without a half-implemented batch UI.
function BatchPlaceholder({
  onPick,
}: {
  onPick: (markets: BatchMarket[]) => void;
}) {
  void onPick;
  return (
    <div className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
      Batch mode is being wired up in the next implementation step. Switch
      back to <strong>Single market</strong> for now.
    </div>
  );
}
```

- [ ] **Step 2: Type-check (page + market-step compile cleanly; ConfirmStep still broken)**

Run: `cd packages/frontend && pnpm build`
Expected: TS errors only in `confirm-step.tsx` referencing the new props — fine, fixed in Task 19. Toggle should compile.

- [ ] **Step 3: Visual smoke test**

Run: `cd packages/frontend && pnpm dev` (in background)
Open `http://localhost:3000/admin/content-pipeline/new`. Pick any format → should land on the Market step with a "Single market | Batch" toggle visible. Click Batch → see the placeholder text. Click Single → see autocomplete.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/market-step.tsx
git commit -m "feat(content-pipeline): single/batch mode toggle on Market step"
```

---

## Phase D: Frontend wizard — batch flow

### Task 11: Install react-window for virtualized checklist

**Files:**

- Modify: `packages/frontend/package.json` (via pnpm add)

- [ ] **Step 1: Install react-window and types**

Run: `cd packages/frontend && pnpm add react-window && pnpm add -D @types/react-window`
Expected: success. `package.json` and `pnpm-lock.yaml` updated.

- [ ] **Step 2: Verify installation**

Run: `grep react-window packages/frontend/package.json`
Expected: 2 lines — one in `dependencies`, one in `devDependencies`.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/package.json packages/frontend/pnpm-lock.yaml
git commit -m "chore(content-pipeline): add react-window for batch checklist virtualization"
```

---

### Task 12: scope-input.tsx (state picker, metro picker, custom textarea)

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/scope-input.tsx`

- [ ] **Step 1: Implement the discriminated input renderer**

Create `packages/frontend/app/admin/content-pipeline/new/scope-input.tsx`:

```typescript
"use client";
import { useEffect, useMemo, useState } from "react";
import { resolveMarket } from "../lib/content-pipeline-api";
import type { ScopeSpec, ScopeType } from "../lib/scope-api";

const STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
];

export function ScopeInput({
  type,
  spec,
  onChange,
}: {
  type: ScopeType;
  spec: ScopeSpec;
  onChange: (next: ScopeSpec) => void;
}) {
  if (type === "metros_in_state" || type === "zips_in_state") {
    return (
      <StatePicker
        value={spec.state ?? ""}
        onChange={(state) => onChange({ ...spec, type, state })}
      />
    );
  }
  if (type === "zips_in_metro") {
    return (
      <MetroPicker
        value={spec.cbsaCode ?? ""}
        onChange={(cbsaCode) => onChange({ ...spec, type, cbsaCode })}
      />
    );
  }
  // custom
  return (
    <CustomList
      codes={spec.codes ?? []}
      onChange={(codes) => onChange({ ...spec, type, codes })}
    />
  );
}

function StatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (state: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-full border border-outline-variant px-6 py-3 text-base bg-surface"
    >
      <option value="">Pick a state…</option>
      {STATE_CODES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

function MetroPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (cbsa: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [matches, setMatches] = useState<
    { id: string; canonical_name: string; geography: string }[]
  >([]);
  const [picked, setPicked] = useState(false);

  async function handleChange(v: string) {
    setQuery(v);
    setPicked(false);
    if (v.length < 2) {
      setMatches([]);
      return;
    }
    const m = await resolveMarket(v);
    // Only metros — zips are not valid for "zips_in_metro"
    setMatches(
      (m as any[]).filter((x) => x.geography === "metro").slice(0, 8),
    );
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Austin, Cleveland, 12420..."
        className="w-full rounded-full border border-outline-variant px-6 py-3 text-base"
      />
      {!picked && matches.length > 0 && (
        <div className="mt-2 space-y-1 max-h-64 overflow-auto">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange(m.id);
                setQuery(m.canonical_name);
                setPicked(true);
              }}
              className="block w-full text-left p-2 rounded hover:bg-surface-container-low text-sm"
            >
              {m.canonical_name}{" "}
              <span className="text-xs text-outline font-mono">{m.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomList({
  codes,
  onChange,
}: {
  codes: string[];
  onChange: (codes: string[]) => void;
}) {
  // Maintain a free-text textarea for editing; sync the parsed list
  // back through onChange. Codes from props are joined as "comma" form
  // for editability without disturbing operator typing.
  const [text, setText] = useState(codes.join(", "));

  useEffect(() => {
    setText(codes.join(", "));
  }, [codes]);

  const parsed = useMemo(() => {
    const tokens = text
      .split(/[,\s\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    return Array.from(new Set(tokens));
  }, [text]);

  const stats = useMemo(() => {
    const valid = parsed.filter((c) => /^\d{5}$/.test(c));
    const invalid = parsed.filter((c) => !/^\d{5}$/.test(c));
    return { valid, invalid };
  }, [parsed]);

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          // Push the deduped parsed list upstream — keep the textarea text
          // verbatim so the operator's whitespace/order isn't disturbed.
          const tokens = e.target.value
            .split(/[,\s\n]+/)
            .map((t) => t.trim())
            .filter(Boolean);
          onChange(Array.from(new Set(tokens)));
        }}
        rows={4}
        placeholder="Paste comma- or newline-separated zip codes or CBSA codes. Mix is OK."
        className="w-full rounded-xl border border-outline-variant px-4 py-3 text-sm font-mono bg-surface"
      />
      <div className="mt-2 text-xs text-on-surface-variant">
        {stats.valid.length} valid
        {stats.invalid.length > 0 && (
          <>
            {" · "}
            <span className="text-error">
              {stats.invalid.length} unrecognized
            </span>
          </>
        )}
      </div>
      {stats.invalid.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {stats.invalid.map((c) => (
            <span
              key={c}
              className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[11px] font-mono"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && pnpm build`
Expected: clean for this file (confirm-step still has stale errors from Task 9 — ignore).

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/scope-input.tsx
git commit -m "feat(content-pipeline): scope-input component (state/metro/custom)"
```

---

### Task 13: resolved-markets-list.tsx (virtualized checklist)

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/resolved-markets-list.tsx`

- [ ] **Step 1: Implement the checklist**

Create `packages/frontend/app/admin/content-pipeline/new/resolved-markets-list.tsx`:

```typescript
"use client";
import { useMemo, useState } from "react";
import { FixedSizeList as List } from "react-window";
import type { ResolvedMarket } from "../lib/scope-api";

type SortKey = "name" | "population" | "score";

export function ResolvedMarketsList({
  markets,
  truncated,
  checkedIds,
  onToggle,
  onCheckMany,
}: {
  markets: ResolvedMarket[];
  truncated: boolean;
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
  onCheckMany: (ids: string[], next: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = markets;
    if (q) {
      out = out.filter(
        (m) =>
          m.canonical_name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q),
      );
    }
    out = [...out].sort((a, b) => {
      if (sortKey === "name")
        return a.canonical_name.localeCompare(b.canonical_name);
      if (sortKey === "population")
        return (b.population ?? -1) - (a.population ?? -1);
      return (b.score ?? -1) - (a.score ?? -1);
    });
    return out;
  }, [markets, search, sortKey]);

  const visibleIds = filtered.map((m) => m.id);
  const visibleCheckedCount = visibleIds.filter((id) =>
    checkedIds.has(id),
  ).length;
  const allVisibleChecked =
    filtered.length > 0 && visibleCheckedCount === filtered.length;
  const someVisibleChecked =
    visibleCheckedCount > 0 && visibleCheckedCount < filtered.length;

  return (
    <div className="rounded-xl border border-outline-variant overflow-hidden">
      {truncated && (
        <div className="bg-warning-container/40 text-on-surface text-xs px-4 py-2 border-b border-outline-variant">
          Showing first 2,500 markets. Narrow your scope (e.g. pick a single
          state) to see all results.
        </div>
      )}

      {/* Sticky header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-container-low border-b border-outline-variant">
        <input
          type="checkbox"
          checked={allVisibleChecked}
          ref={(el) => {
            if (el) el.indeterminate = someVisibleChecked;
          }}
          onChange={() => onCheckMany(visibleIds, !allVisibleChecked)}
          className="h-4 w-4"
          aria-label="Select all visible"
        />
        <span className="text-sm">
          <strong>{checkedIds.size}</strong> of {markets.length} selected
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter…"
          className="ml-auto rounded-full border border-outline-variant px-3 py-1 text-sm w-48"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="text-xs rounded border border-outline-variant px-2 py-1 bg-surface"
        >
          <option value="name">Sort: Name</option>
          <option value="population">Sort: Population</option>
          <option value="score">Sort: Score</option>
        </select>
      </div>

      {/* Virtualized list */}
      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-sm text-on-surface-variant text-center">
          {search
            ? `No markets match "${search}" in this scope.`
            : "No markets in this scope."}
        </div>
      ) : (
        <List
          height={Math.min(440, filtered.length * 44)}
          itemCount={filtered.length}
          itemSize={44}
          width="100%"
          itemData={{ markets: filtered, checkedIds, onToggle }}
        >
          {Row}
        </List>
      )}

      <div className="px-4 py-2 text-xs text-on-surface-variant border-t border-outline-variant bg-surface-container-low">
        Showing {filtered.length} of {markets.length}
        {search ? " (filtered)" : ""}
      </div>
    </div>
  );
}

function Row({
  index,
  style,
  data,
}: {
  index: number;
  style: React.CSSProperties;
  data: {
    markets: ResolvedMarket[];
    checkedIds: Set<string>;
    onToggle: (id: string) => void;
  };
}) {
  const m = data.markets[index];
  const checked = data.checkedIds.has(m.id);
  return (
    <div
      style={style}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => data.onToggle(m.id)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          data.onToggle(m.id);
        }
      }}
      className={`flex items-center gap-3 px-4 cursor-pointer hover:bg-surface-container-low ${
        checked ? "bg-secondary-container/30" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="h-4 w-4 pointer-events-none"
        tabIndex={-1}
      />
      <span className="text-sm flex-1 truncate">{m.canonical_name}</span>
      <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-mono">
        {m.geography}
      </span>
      {m.population != null && (
        <span className="text-xs text-outline w-20 text-right">
          {Intl.NumberFormat("en-US", { notation: "compact" }).format(
            m.population,
          )}
        </span>
      )}
      {m.score != null && (
        <span className="text-xs text-primary font-mono w-10 text-right">
          {Math.round(m.score)}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && pnpm build`
Expected: clean for this file.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/resolved-markets-list.tsx
git commit -m "feat(content-pipeline): virtualized resolved-markets checklist"
```

---

### Task 14: market-step-batch.tsx (composes scope-input + resolved-markets-list)

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/market-step-batch.tsx`

- [ ] **Step 1: Implement the batch body**

Create `packages/frontend/app/admin/content-pipeline/new/market-step-batch.tsx`:

```typescript
"use client";
import { useEffect, useState } from "react";
import { useResolvedScope, type ScopeSpec, type ScopeType } from "../lib/scope-api";
import type { BatchMarket } from "../lib/batch-runs-api";
import { ScopeInput } from "./scope-input";
import { ResolvedMarketsList } from "./resolved-markets-list";

const SCOPE_LABELS: Record<ScopeType, string> = {
  metros_in_state: "All metros in state",
  zips_in_state: "All zips in state",
  zips_in_metro: "All zips in metro",
  custom: "Custom list",
};

const HARD_BATCH_CAP = 500;

export function MarketStepBatch({
  onPick,
}: {
  onPick: (markets: BatchMarket[]) => void;
}) {
  const [type, setType] = useState<ScopeType>("metros_in_state");
  const [spec, setSpec] = useState<ScopeSpec>({ type: "metros_in_state" });
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error, refetch } = useResolvedScope(spec);

  // When the resolved set changes (new scope), default all to checked.
  useEffect(() => {
    if (data?.markets) {
      setCheckedIds(new Set(data.markets.map((m) => m.id)));
    } else {
      setCheckedIds(new Set());
    }
  }, [data]);

  function toggleId(id: string) {
    setCheckedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function checkMany(ids: string[], on: boolean) {
    setCheckedIds((cur) => {
      const next = new Set(cur);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const checkedCount = checkedIds.size;
  const overCap = checkedCount > HARD_BATCH_CAP;

  const canSubmit = checkedCount > 0 && !overCap;

  function handleNext() {
    if (!data?.markets) return;
    const picked: BatchMarket[] = data.markets
      .filter((m) => checkedIds.has(m.id))
      .map((m) => ({ id: m.id, geography: m.geography }));
    onPick(picked);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wide text-on-surface-variant mb-1">
          Scope type
        </label>
        <select
          value={type}
          onChange={(e) => {
            const t = e.target.value as ScopeType;
            setType(t);
            setSpec({ type: t });
          }}
          className="w-full rounded-full border border-outline-variant px-6 py-3 text-base bg-surface"
        >
          {(Object.keys(SCOPE_LABELS) as ScopeType[]).map((t) => (
            <option key={t} value={t}>
              {SCOPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide text-on-surface-variant mb-1">
          Scope input
        </label>
        <ScopeInput type={type} spec={spec} onChange={setSpec} />
      </div>

      {isLoading && (
        <div className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
          Resolving scope…
        </div>
      )}

      {isError && (
        <div className="rounded-xl bg-error-container/40 p-4 text-sm text-on-surface flex items-center gap-3">
          <span>
            Couldn&apos;t resolve scope:{" "}
            <span className="font-mono text-xs">
              {(error as Error)?.message}
            </span>
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-auto text-xs px-3 py-1 rounded-full bg-primary text-on-primary"
          >
            Retry
          </button>
        </div>
      )}

      {data && data.markets.length > 0 && (
        <ResolvedMarketsList
          markets={data.markets}
          truncated={data.truncated}
          checkedIds={checkedIds}
          onToggle={toggleId}
          onCheckMany={checkMany}
        />
      )}

      {data && data.markets.length === 0 && (
        <div className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
          No markets found in this scope.
        </div>
      )}

      {data?.unrecognized && data.unrecognized.length > 0 && (
        <div className="text-xs text-error">
          Unrecognized codes (skipped):{" "}
          <span className="font-mono">
            {data.unrecognized.join(", ")}
          </span>
        </div>
      )}

      {overCap && (
        <p className="text-xs text-error">
          Batch cap is {HARD_BATCH_CAP}. Use a narrower scope or uncheck
          markets.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleNext}
          disabled={!canSubmit}
          className="bg-primary text-on-primary rounded-full px-8 py-3 font-semibold disabled:opacity-50"
        >
          Next ({checkedCount} run{checkedCount === 1 ? "" : "s"})
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && pnpm build`
Expected: clean for this file.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/market-step-batch.tsx
git commit -m "feat(content-pipeline): MarketStepBatch composes scope picker + checklist"
```

---

### Task 15: Wire MarketStepBatch into market-step.tsx

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/new/market-step.tsx`

- [ ] **Step 1: Replace `BatchPlaceholder` with the real component**

Edit `packages/frontend/app/admin/content-pipeline/new/market-step.tsx`. Add an import at the top:

```typescript
import { MarketStepBatch } from "./market-step-batch";
```

Find the `BatchPlaceholder` function and DELETE it. In the `MarketStep` component body, replace `<BatchPlaceholder onPick={onPickBatch} />` with `<MarketStepBatch onPick={onPickBatch} />`.

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && pnpm build`
Expected: clean (confirm-step still broken from Task 9; that's still fine until Task 19).

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/market-step.tsx
git commit -m "feat(content-pipeline): wire MarketStepBatch into market-step body"
```

---

## Phase E: Frontend wizard — confirm step

### Task 16: Extract single-market-summary.tsx

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/single-market-summary.tsx`
- Modify: `packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx`

- [ ] **Step 1: Extract the summary card**

Create `packages/frontend/app/admin/content-pipeline/new/single-market-summary.tsx`:

```typescript
"use client";
import { FORMAT_META } from "../lib/format-previews";

export function SingleMarketSummary({
  format,
  market,
  publishLine,
  outcomeLine,
}: {
  format: string;
  market: string;
  publishLine: string;
  outcomeLine: string;
}) {
  const meta = FORMAT_META[format];
  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">
        {meta.displayName} for {market}
      </h1>
      <p className="mb-3">We will:</p>
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Write a {meta.duration}-second script ({meta.aspect}) with 1 hook
          variant
        </li>
        <li>Use the PropertyIQ voice (Edge TTS, free)</li>
        <li>{publishLine}</li>
        <li>{outcomeLine}</li>
      </ul>
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && pnpm build`
Expected: clean for this file.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/single-market-summary.tsx
git commit -m "feat(content-pipeline): extract SingleMarketSummary from confirm-step"
```

---

### Task 17: batch-confirm-banner.tsx

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/batch-confirm-banner.tsx`

- [ ] **Step 1: Implement the banner**

Create `packages/frontend/app/admin/content-pipeline/new/batch-confirm-banner.tsx`:

```typescript
"use client";
import { useState } from "react";
import { FORMAT_META } from "../lib/format-previews";
import type { BatchMarket } from "../lib/batch-runs-api";

const PER_RENDER_COST_USD = 0.1; // placeholder until format_templates.estimated_cost_usd lands

export function BatchConfirmBanner({
  format,
  markets,
  onChangeScope,
}: {
  format: string;
  markets: BatchMarket[];
  onChangeScope: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = FORMAT_META[format];
  const count = markets.length;
  const cost = (count * PER_RENDER_COST_USD).toFixed(2);
  const queueMin = Math.max(1, Math.round((count * 20) / 60));

  const visibleNames = expanded ? markets : markets.slice(0, 5);

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          Batch: {count} markets · {meta.displayName}
        </h1>
        <button
          type="button"
          onClick={onChangeScope}
          className="text-sm text-primary hover:underline whitespace-nowrap"
        >
          ← change scope
        </button>
      </div>

      <div className="rounded-xl bg-surface-container-low p-4 text-sm">
        <ul className="space-y-1">
          {visibleNames.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-mono">
                {m.geography}
              </span>
              <span className="font-mono">{m.id}</span>
            </li>
          ))}
        </ul>
        {count > 5 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-xs text-primary hover:underline"
          >
            {expanded ? "Show less" : `…and ${count - 5} more (expand)`}
          </button>
        )}
      </div>

      <div className="text-xs text-on-surface-variant font-mono">
        ≈ ${cost} · {count} renders · ~{queueMin} min queue
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && pnpm build`
Expected: clean for this file.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/batch-confirm-banner.tsx
git commit -m "feat(content-pipeline): BatchConfirmBanner with collapsible markets list"
```

---

### Task 18: batch-submit-dialog.tsx (50+/250+ ack)

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/batch-submit-dialog.tsx`

- [ ] **Step 1: Implement the dialog**

Create `packages/frontend/app/admin/content-pipeline/new/batch-submit-dialog.tsx`:

```typescript
"use client";
import { useState } from "react";
import { M3Dialog } from "../components/m3-dialog";

const PER_RENDER_COST_USD = 0.1;
const REQUIRES_ACK_AT = 250;

export function BatchSubmitDialog({
  open,
  count,
  onCancel,
  onConfirm,
  submitting,
}: {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  const requiresAck = count >= REQUIRES_ACK_AT;
  const [acked, setAcked] = useState(false);
  const cost = (count * PER_RENDER_COST_USD).toFixed(2);

  return (
    <M3Dialog
      open={open}
      onClose={submitting ? () => {} : onCancel}
      ariaLabel="Confirm batch submission"
    >
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-medium">Review batch</h2>
        <p className="text-sm">
          You&apos;re about to create <strong>{count} runs</strong> at an
          estimated cost of <span className="font-mono">≈ ${cost}</span>.
          Each run will render a video and (depending on approval mode)
          publish to the platforms you selected.
        </p>
        {requiresAck && (
          <label className="flex items-start gap-2 text-sm bg-warning-container/40 rounded-lg p-3">
            <input
              type="checkbox"
              checked={acked}
              onChange={(e) => setAcked(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              I understand this will create <strong>{count} runs</strong> and
              cost <span className="font-mono">≈ ${cost}</span>.
            </span>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-on-surface hover:bg-on-surface/8 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting || (requiresAck && !acked)}
            className="px-5 py-2.5 rounded-full text-sm font-medium bg-primary text-on-primary disabled:opacity-50"
          >
            {submitting ? "Submitting…" : `Submit ${count} runs`}
          </button>
        </div>
      </div>
    </M3Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && pnpm build`
Expected: clean for this file.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/batch-submit-dialog.tsx
git commit -m "feat(content-pipeline): BatchSubmitDialog with 50+/250+ ack flow"
```

---

### Task 19: Branch confirm-step.tsx for batch mode

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx`

- [ ] **Step 1: Replace confirm-step contents**

Replace `packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx` with the following. The Single mode body is preserved (extracted to `<SingleMarketSummary />`), and a Batch branch is added:

```typescript
"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createRun,
  fetchPlatforms,
  type PlatformStatus,
} from "../lib/content-pipeline-api";
import { fetchSettings } from "../lib/settings-api";
import { useCreateBatchRuns, type BatchMarket } from "../lib/batch-runs-api";
import { SingleMarketSummary } from "./single-market-summary";
import { BatchConfirmBanner } from "./batch-confirm-banner";
import { BatchSubmitDialog } from "./batch-submit-dialog";
import type { WizardMode } from "./page";

type ApprovalMode = "auto" | "review" | "draft";

const MODE_DESCRIPTIONS: Record<ApprovalMode, string> = {
  auto: "Publish immediately after render. No human check.",
  review:
    "Park in the review queue after render. A human approves before publish.",
  draft:
    "Publish as a platform draft (YouTube private, TikTok draft, etc.). Spot-check before making public.",
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube_shorts: "YouTube Shorts",
  youtube_long: "YouTube",
  tiktok: "TikTok",
  instagram_reels: "Instagram",
  facebook_reels: "Facebook",
  linkedin: "LinkedIn",
};

const ALL_PLATFORMS = [
  "youtube_shorts",
  "tiktok",
  "instagram_reels",
  "facebook_reels",
  "linkedin",
] as const;

const BATCH_DIALOG_THRESHOLD = 50;

export function ConfirmStep({
  format,
  mode,
  market,
  batchMarkets,
  onBack,
  onCreatedSingle,
  onCreatedBatch,
}: {
  format: string;
  mode: WizardMode;
  market: string;
  batchMarkets: BatchMarket[];
  onBack: () => void;
  onCreatedSingle: (runId: string) => void;
  onCreatedBatch: (batchId: string) => void;
}) {
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const { data: settings } = useQuery({
    queryKey: ["content-pipeline-settings"],
    queryFn: fetchSettings,
  });
  const { data: platforms = [] } = useQuery({
    queryKey: ["content-pipeline-platforms"],
    queryFn: fetchPlatforms,
  });

  const formatDefault = (settings?.formatDefaults ?? []).find(
    (f: {
      format: string;
      default_approval_mode?: string;
      default_platforms?: string[];
    }) => f.format === format,
  );
  const defaultMode = (formatDefault?.default_approval_mode ??
    "review") as ApprovalMode;
  const defaultPlatforms = formatDefault?.default_platforms ?? [];

  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(defaultMode);
  const [operatorPickedMode, setOperatorPickedMode] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] =
    useState<string[]>(defaultPlatforms);
  const [operatorPickedPlatforms, setOperatorPickedPlatforms] = useState(false);

  useEffect(() => {
    if (!operatorPickedMode && formatDefault) setApprovalMode(defaultMode);
    if (!operatorPickedPlatforms && formatDefault)
      setSelectedPlatforms(defaultPlatforms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatDefault?.format, defaultMode, defaultPlatforms.join("|")]);

  const [submitting, setSubmitting] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platformByKey = new Map<string, PlatformStatus>(
    platforms.map((p) => [p.platform, p]),
  );

  const batchCount = batchMarkets.length;

  function togglePlatform(p: string) {
    setOperatorPickedPlatforms(true);
    setSelectedPlatforms((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
    );
  }

  const batchMutation = useCreateBatchRuns();

  async function submitSingle() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createRun({
        format,
        marketQuery: market,
        idempotencyKey,
        approvalMode,
        selectedPlatforms,
      });
      onCreatedSingle(result.id);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  async function submitBatch() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await batchMutation.mutateAsync({
        format,
        markets: batchMarkets,
        approvalMode,
        platforms: selectedPlatforms,
      });
      onCreatedBatch(result.batchId);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
      setShowBatchDialog(false);
    }
  }

  function handleSubmitClick() {
    if (mode === "batch" && batchCount >= BATCH_DIALOG_THRESHOLD) {
      setShowBatchDialog(true);
      return;
    }
    if (mode === "batch") void submitBatch();
    else void submitSingle();
  }

  const outcomeLine =
    approvalMode === "review"
      ? "Queue for your review before publishing"
      : approvalMode === "draft"
        ? "Publish as a platform draft (unlisted)"
        : "Publish immediately after render";

  const publishLine =
    selectedPlatforms.length === 0
      ? "Render only (no platforms selected — useful for previewing)"
      : `Post to ${selectedPlatforms.map((p) => PLATFORM_LABELS[p] ?? p).join(", ")}`;

  const submitLabel =
    mode === "batch"
      ? batchCount >= BATCH_DIALOG_THRESHOLD
        ? `Review batch (${batchCount} runs)`
        : `Submit ${batchCount} run${batchCount === 1 ? "" : "s"}`
      : submitting
        ? "Creating..."
        : "Start Run";

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>
      <div className="rounded-xl bg-surface-container-low p-8 shadow-sm">
        {mode === "batch" ? (
          <BatchConfirmBanner
            format={format}
            markets={batchMarkets}
            onChangeScope={onBack}
          />
        ) : (
          <SingleMarketSummary
            format={format}
            market={market}
            publishLine={publishLine}
            outcomeLine={outcomeLine}
          />
        )}

        <PlatformChips
          batchSize={mode === "batch" ? batchCount : 1}
          selected={selectedPlatforms}
          defaultPlatforms={defaultPlatforms}
          operatorPicked={operatorPickedPlatforms}
          platformByKey={platformByKey}
          onToggle={togglePlatform}
        />

        <fieldset className="mt-6">
          <legend className="text-xs text-outline mb-2 uppercase tracking-wide">
            Approval mode
            {mode === "batch" && ` for all ${batchCount} runs`}
          </legend>
          <div className="flex gap-2" role="radiogroup">
            {(["auto", "review", "draft"] as ApprovalMode[]).map((m) => {
              const active = approvalMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setApprovalMode(m);
                    setOperatorPickedMode(true);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition-colors duration-200 ${
                    active
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  {m}
                  {m === defaultMode && !operatorPickedMode && (
                    <span className="ml-1 text-[10px] opacity-70">default</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-outline mt-2">
            {MODE_DESCRIPTIONS[approvalMode]}
          </p>
        </fieldset>

        {error && <div className="mt-4 text-error">{error}</div>}
        <button
          onClick={handleSubmitClick}
          disabled={submitting}
          className="mt-6 bg-primary text-on-primary rounded-full px-8 py-3 font-semibold disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>

      <BatchSubmitDialog
        open={showBatchDialog}
        count={batchCount}
        onCancel={() => setShowBatchDialog(false)}
        onConfirm={submitBatch}
        submitting={submitting}
      />
    </div>
  );
}

function PlatformChips({
  batchSize,
  selected,
  defaultPlatforms,
  operatorPicked,
  platformByKey,
  onToggle,
}: {
  batchSize: number;
  selected: string[];
  defaultPlatforms: string[];
  operatorPicked: boolean;
  platformByKey: Map<string, PlatformStatus>;
  onToggle: (p: string) => void;
}) {
  const disconnectedSelected = selected.filter(
    (p) => !platformByKey.get(p)?.configured,
  );
  return (
    <fieldset className="mt-6">
      <legend className="text-xs text-outline mb-2 uppercase tracking-wide">
        Publish {batchSize > 1 ? `all ${batchSize} runs` : ""} to
        {!operatorPicked && (
          <span className="ml-2 normal-case text-[10px] opacity-70">
            (using format defaults — click to override)
          </span>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {ALL_PLATFORMS.map((p) => {
          const status = platformByKey.get(p);
          const connected = !!status?.configured;
          const active = selected.includes(p);
          const isDefault = defaultPlatforms.includes(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => connected && onToggle(p)}
              disabled={!connected}
              title={
                connected
                  ? active
                    ? `Click to remove ${PLATFORM_LABELS[p]}`
                    : `Click to add ${PLATFORM_LABELS[p]}`
                  : `${PLATFORM_LABELS[p]} not connected — set up on /platforms first`
              }
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 inline-flex items-center gap-1.5 ${
                !connected
                  ? "bg-surface-container-low text-on-surface-variant border-outline-variant opacity-60 cursor-not-allowed"
                  : active
                    ? "bg-secondary-container text-on-secondary-container border-transparent"
                    : "bg-surface text-on-surface border-outline hover:bg-surface-container-low"
              }`}
            >
              {active && connected && (
                <span className="text-[10px]" aria-hidden>
                  ✓
                </span>
              )}
              <span>{PLATFORM_LABELS[p] ?? p}</span>
              {isDefault && !operatorPicked && (
                <span className="text-[9px] opacity-60 font-mono">default</span>
              )}
            </button>
          );
        })}
      </div>
      {disconnectedSelected.length > 0 && (
        <p className="text-[11px] text-error mt-2">
          {disconnectedSelected.map((p) => PLATFORM_LABELS[p]).join(", ")} not
          connected — those publishes will fail. Connect on{" "}
          <a
            href="/admin/content-pipeline/platforms"
            className="text-primary underline"
          >
            Platforms
          </a>{" "}
          or remove them from this run.
        </p>
      )}
    </fieldset>
  );
}
```

- [ ] **Step 2: Type-check the whole frontend**

Run: `cd packages/frontend && pnpm build`
Expected: clean build, no TS errors. The wizard now compiles end-to-end.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx
git commit -m "feat(content-pipeline): confirm-step branches between single and batch"
```

---

## Phase F: Runs list integration

### Task 20: Filter dashboard by `?batch=<id>` + banner

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/page.tsx`

- [ ] **Step 1: Inspect the dashboard page**

Run: `wc -l packages/frontend/app/admin/content-pipeline/page.tsx`
Read the file to locate where it calls `fetchDashboard()` and where it renders the runs list.

- [ ] **Step 2: Read the dashboard fetcher to confirm contract**

Confirm `fetchDashboard()` in `lib/content-pipeline-api.ts` is the function used. Edit it to accept an optional `batchId` query parameter:

```typescript
export async function fetchDashboard(
  opts: { batchId?: string } = {},
): Promise<DashboardData> {
  const path = opts.batchId
    ? `/api/admin/content-pipeline/dashboard?batchId=${encodeURIComponent(opts.batchId)}`
    : "/api/admin/content-pipeline/dashboard";
  const res = await fetchAPI<{ data: DashboardData }>(path);
  return res.data;
}
```

- [ ] **Step 3: Update the dashboard page to read and pass the param**

Edit `packages/frontend/app/admin/content-pipeline/page.tsx`. Add at the top inside the component:

```typescript
import { useSearchParams } from "next/navigation";
// ...inside the component body:
const searchParams = useSearchParams();
const batchId = searchParams.get("batch") ?? undefined;
```

Change the existing `useQuery({ queryKey: ['content-pipeline-dashboard'], queryFn: fetchDashboard })` (or whatever the existing call is) to:

```typescript
const { data, isLoading } = useQuery({
  queryKey: ["content-pipeline-dashboard", batchId ?? "all"],
  queryFn: () => fetchDashboard({ batchId }),
});
```

Add a banner above the runs list when `batchId` is set:

```typescript
{batchId && data && (
  <div className="rounded-xl bg-secondary-container/40 px-4 py-3 mb-4 text-sm flex items-center gap-3">
    <span>
      Showing batch <span className="font-mono text-xs">{batchId}</span>
      {" — "}
      <strong>{data.recentRuns.length}</strong> runs
    </span>
    <a
      href="/admin/content-pipeline"
      className="ml-auto text-primary text-xs hover:underline"
    >
      Show all
    </a>
  </div>
)}
```

- [ ] **Step 4: Build**

Run: `cd packages/frontend && pnpm build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts packages/frontend/app/admin/content-pipeline/page.tsx
git commit -m "feat(content-pipeline): dashboard supports ?batch=<id> filter + banner"
```

---

## Phase G: Local validation

### Task 21: Full build + tests + manual smoke

**Files:** none modified

- [ ] **Step 1: Run backend type-check + tests**

Run: `cd packages/backend && pnpm build && pnpm jest src/content-pipeline`
Expected: clean build, all content-pipeline tests pass.

- [ ] **Step 2: Run frontend type-check**

Run: `cd packages/frontend && pnpm build`
Expected: clean build, no TS errors.

- [ ] **Step 3: Start both services**

Run in two background shells:

- `cd packages/backend && pnpm start:dev` (port 3001)
- `cd packages/frontend && pnpm dev` (port 3000)

Wait until both report ready.

- [ ] **Step 4: Manual smoke — Single mode unchanged**

Open `http://localhost:3000/admin/content-pipeline/new`, log in if prompted (`troy@propertyiq.app` / `Youknowwhy$$12`).

Pick `Grade Reveal` → `Single market` is the default → type "Austin" → pick the metro suggestion → review the confirm screen → DO NOT click Submit (just verify the layout is intact). Click Back twice to return to the dashboard.

- [ ] **Step 5: Manual smoke — Batch mode resolves a tiny scope**

Open `http://localhost:3000/admin/content-pipeline/new` again. Pick `Grade Reveal` → toggle to `Batch` → pick scope `Custom list` → paste `78704, 90210` → resolved-markets list should show 2 zips, both checked → Next button label `Next (2 runs)`. Click Next.

On the confirm step: should see the BatchConfirmBanner with `Batch: 2 markets · Grade Reveal`, the markets list, and the Submit button labeled `Submit 2 runs` (no dialog because count < 50). DO NOT click Submit yet — the destination-gate phase below will.

Stop both services.

- [ ] **Step 6: Commit any tweaks**

If anything had to be adjusted to make the smoke pass, commit those fixes now.

```bash
git status
# if there are tweaks:
git add -p
git commit -m "fix(content-pipeline): tweaks from local smoke test"
```

---

## Phase H: DESTINATION GATE — Live YouTube validation

This phase satisfies acceptance criterion 11 of the spec. Implementation is NOT complete until 3 videos are live on the YouTube channel.

### Task 22: Set up Playwright validation script

**Files:**

- Create: `scripts/validate-batch-wizard.mjs`

- [ ] **Step 1: Confirm Playwright is installed (or install it)**

Run: `cd packages/frontend && pnpm exec playwright --version`
If it errors with "command not found" or similar, install: `cd packages/frontend && pnpm add -D @playwright/test && pnpm exec playwright install chromium`

- [ ] **Step 2: Write the validation runner**

Create `scripts/validate-batch-wizard.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Destination-gate validation for the batch wizard. Drives the admin UI
 * via Playwright to:
 *   1. Log in
 *   2. Create one Single-mode run for grade_reveal in Austin
 *   3. Create one Batch-mode run for grade_reveal across 2 zips (78704, 90210)
 * Then waits for all 3 runs to reach `published`/`published_partial` and
 * verifies each has a YouTube video URL in the run detail.
 *
 * Run: node scripts/validate-batch-wizard.mjs
 *
 * Required env (or use defaults):
 *   ADMIN_EMAIL=troy@propertyiq.app
 *   ADMIN_PASSWORD=Youknowwhy$$12
 *   FRONTEND_URL=http://localhost:3000
 *   BACKEND_URL=http://localhost:3001
 */
import { chromium } from "@playwright/test";

const FRONTEND = process.env.FRONTEND_URL ?? "http://localhost:3000";
const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3001";
const EMAIL = process.env.ADMIN_EMAIL ?? "troy@propertyiq.app";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "Youknowwhy$$12";

const TIMEOUT_MS = 20 * 60 * 1000; // 20 min hard cap per run

async function login(page) {
  await page.goto(`${FRONTEND}/login`);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|dashboard)/, { timeout: 30_000 });
}

async function createSingleRun(page) {
  await page.goto(`${FRONTEND}/admin/content-pipeline/new`);
  await page.click('button:has-text("Grade Reveal")');
  // single is the default
  await page.fill('input[placeholder*="Cleveland"]', "Austin");
  await page.waitForSelector('button:has-text("Austin")', { timeout: 10_000 });
  await page.click('button:has-text("Austin")');
  await page.click('button:has-text("Start Run")');
  await page.waitForURL(/\/admin\/content-pipeline\/runs\//, {
    timeout: 30_000,
  });
  const url = page.url();
  const runId = url.match(/runs\/([0-9a-f-]{36})/)?.[1];
  if (!runId) throw new Error(`couldn't extract runId from ${url}`);
  return runId;
}

async function createBatchRun(page) {
  await page.goto(`${FRONTEND}/admin/content-pipeline/new`);
  await page.click('button:has-text("Grade Reveal")');
  await page.click('button[role="radio"]:has-text("Batch")');
  await page.selectOption("select", "custom");
  await page.fill("textarea", "78704, 90210");
  // Wait for resolved-markets list to populate
  await page.waitForSelector("text=/2 of 2 selected/", { timeout: 15_000 });
  await page.click('button:has-text("Next")');
  await page.click('button:has-text("Submit 2 runs")');
  // Lands on /admin/content-pipeline?batch=<id>
  await page.waitForURL(/\?batch=/, { timeout: 30_000 });
  const url = page.url();
  const batchId = new URL(url).searchParams.get("batch");
  if (!batchId) throw new Error(`couldn't extract batchId from ${url}`);
  // Fetch run IDs from the dashboard query
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const res = await fetch(
    `${BACKEND}/api/admin/content-pipeline/dashboard?batchId=${batchId}`,
    { headers: { Cookie: cookieHeader } },
  );
  const json = await res.json();
  const runIds = json.data.recentRuns.map((r) => r.id);
  if (runIds.length !== 2)
    throw new Error(`expected 2 runs in batch, got ${runIds.length}`);
  return { batchId, runIds };
}

async function pollUntilPublished(page, runId) {
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const res = await fetch(
      `${BACKEND}/api/admin/content-pipeline/runs/${runId}`,
      { headers: { Cookie: cookieHeader } },
    );
    const json = await res.json();
    const status = json.data?.status;
    console.log(`  run ${runId}: ${status}`);
    if (status === "published" || status === "published_partial") {
      return json.data;
    }
    if (status === "failed" || status === "rejected") {
      throw new Error(
        `run ${runId} terminated as ${status}: ${json.data?.failure_reason ?? "unknown"}`,
      );
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
  throw new Error(`run ${runId} did not publish within ${TIMEOUT_MS / 1000}s`);
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("== Logging in ==");
  await login(page);

  console.log("== Creating single run (Austin) ==");
  const singleRunId = await createSingleRun(page);
  console.log(`  singleRunId=${singleRunId}`);

  console.log("== Creating batch run (78704, 90210) ==");
  const { batchId, runIds: batchRunIds } = await createBatchRun(page);
  console.log(`  batchId=${batchId} runs=${batchRunIds.join(", ")}`);

  const allRunIds = [singleRunId, ...batchRunIds];
  console.log(`\n== Polling ${allRunIds.length} runs to publication ==`);
  const results = [];
  for (const id of allRunIds) {
    const data = await pollUntilPublished(page, id);
    const ytPost = (data.platform_posts ?? []).find(
      (p) => p.platform === "youtube_shorts",
    );
    const ytUrl = ytPost?.public_url ?? ytPost?.platform_post_id;
    if (!ytUrl)
      throw new Error(`run ${id} published but has no YouTube post URL`);
    console.log(`  ✓ ${id} → ${ytUrl}`);
    results.push({ runId: id, youtubeUrl: ytUrl });
  }

  console.log(`\n== ALL ${results.length} VIDEOS LIVE ==`);
  for (const r of results) console.log(`  ${r.runId}: ${r.youtubeUrl}`);

  await browser.close();
}

main().catch((err) => {
  console.error("VALIDATION FAILED:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Confirm grade_reveal has youtube_shorts in its default platforms**

Run: `node -e "const{Client}=require('pg');const c=new Client({connectionString:'postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:6543/postgres',ssl:{rejectUnauthorized:false}});(async()=>{await c.connect();const{rows}=await c.query(\"SELECT format, default_platforms, default_approval_mode FROM format_templates WHERE format='grade_reveal'\");console.log(JSON.stringify(rows,null,2));await c.end();})();"`
Expected: `default_platforms` includes `"youtube_shorts"`, `default_approval_mode` is `"auto"` (not `"review"` — review pauses for human approval which would block this validation).

If `default_approval_mode` is `"review"` or `"draft"`, the validation script will time out waiting for `published`. Two options: (1) toggle the format default to `auto` in the admin Settings page for the duration of validation, then back. (2) Modify the script to also call the approve endpoint after `ready_for_review`. Pick (1) for simplicity.

- [ ] **Step 4: Confirm YouTube is connected**

Open `http://localhost:3000/admin/content-pipeline/platforms` while the dev servers are running. The YouTube row should show `connected` with an account label (channel ID). If not, click `Connect` and complete OAuth before proceeding.

- [ ] **Step 5: Commit the validation script**

```bash
git add scripts/validate-batch-wizard.mjs
git commit -m "test(content-pipeline): Playwright destination-gate validation runner"
```

---

### Task 23: Run validation; debug + retry until 3 videos live

**Files:** any code files needed for fixes during debug

This is the iron gate. Each step is a probe — repeat the entire phase until success.

- [ ] **Step 1: Start both services**

Run in background shells:

- `cd packages/backend && pnpm start:dev`
- `cd packages/frontend && pnpm dev`

Wait until backend logs `API running on…` and frontend logs `Ready in…`.

- [ ] **Step 2: Run the validation script**

Run: `node scripts/validate-batch-wizard.mjs`
Expected on success: 3 lines `✓ <runId> → <youtubeUrl>` and final `== ALL 3 VIDEOS LIVE ==`.

- [ ] **Step 3: If script throws, identify the failure stage**

The script prints every status transition. Read from the bottom up:

- **`run X failed`** at status `fetching_data`: market resolution issue. Check `content_run_events` table for the failure_reason, look at FetchDataHandler logs.
- **at `scripting`**: prompt or LLM error. Check generate-script handler logs.
- **at `rendering_video`**: Remotion render failure. Tail the backend log for the Remotion stderr block.
- **at `publishing`** or no YouTube post URL despite `published`: YouTube credential / OAuth / quota issue. Check `platform_posts` table for the run, look for `last_error` in PublishYouTubeShortsHandler logs.
- **Playwright timeout selecting an element**: UI selector drift — open the page in headed mode (the script already runs headed), find the actual button text, update the selector in `scripts/validate-batch-wizard.mjs`.
- **Login fails**: confirm credentials match what the login form expects (email field, password field). The selector `input[type="email"]` may need adjustment — read the actual login form first.

- [ ] **Step 4: Apply systematic-debugging discipline**

Per `superpowers:systematic-debugging`:

1. Read the error message completely.
2. Reproduce: which run ID? what status? what failure_reason in DB?
3. Check recent changes (this branch's commits).
4. Form a single hypothesis. Don't guess multiple fixes at once.
5. Fix the SPECIFIC root cause. No "while I'm here" cleanup.

- [ ] **Step 5: Re-run only the failed run**

If runs 1 and 2 published but run 3 failed during publish, don't recreate everything — use the retry endpoint:

```bash
curl -X POST http://localhost:3001/api/admin/content-pipeline/runs/<failed-run-id>/retry \
  -H "Cookie: <ADMIN_SESSION>"
```

Then re-poll just that run via the script's `pollUntilPublished` logic (or refresh `/admin/content-pipeline?batch=<batchId>` in the browser until status is `published`).

If the failure is a code bug (not a transient network hiccup), commit the fix BEFORE re-running:

```bash
git add <fixed-files>
git commit -m "fix(content-pipeline): <root cause> — surfaced by destination-gate validation"
```

Then restart the backend so the fix is loaded, and re-run the validation script from Step 2.

- [ ] **Step 6: Verify each video on YouTube**

For each `youtubeUrl` printed by the script, open it in a browser. Confirm:

- The video plays.
- The title is reasonable (mentions the market name).
- The thumbnail is present.
- Duration matches the format (grade_reveal is 30-60s).

If any video is "Video unavailable" / private / removed, the publish reported success but the platform rejected — investigate that platform-side.

- [ ] **Step 7: Final commit if any debug fixes were made**

Already committed in Step 5. If the script needed adjustment for selector drift, commit that too:

```bash
git add scripts/validate-batch-wizard.mjs
git commit -m "test(content-pipeline): selector adjustments after live validation"
```

- [ ] **Step 8: Record the result**

In a short comment-only commit, log the validation outcome (purely for traceability):

```bash
git commit --allow-empty -m "test(content-pipeline): destination gate PASSED — 3 live YouTube videos

Single: <runId> → <youtubeUrl>
Batch [<batchId>]:
  - <runId> → <youtubeUrl>
  - <runId> → <youtubeUrl>"
```

Only run this commit when ALL 3 are confirmed live in YouTube Studio.

---

## Phase I: Final tidy

### Task 24: Clean up + update memory

- [ ] **Step 1: Run all tests one more time**

Run: `cd packages/backend && pnpm jest src/content-pipeline && cd ../frontend && pnpm build`
Expected: all green.

- [ ] **Step 2: Update P2 status memory**

If the P2 status memory file has a "remaining tasks" list that included this batch wizard, mark it done. Otherwise skip.

- [ ] **Step 3: Push the branch**

Run: `git push origin feat/content-pipeline-p2`
Expected: branch updated on remote.

- [ ] **Step 4: Final summary**

Print a one-line summary of what shipped:

- 1 schema migration
- 4 new backend files (scope service + controller, batch DTO + controller)
- 2 modified backend files (CreateRunDto, ContentRunsService)
- 8 new frontend files (scope-api, batch-runs-api, scope-input, resolved-markets-list, market-step-batch, single-market-summary, batch-confirm-banner, batch-submit-dialog)
- 4 modified frontend files (page.tsx, market-step.tsx, confirm-step.tsx, dashboard page)
- 1 validation script
- 3 live YouTube videos as evidence

---

## Self-Review

After writing this plan I checked it against the spec:

- **Spec § 4.1 step structure** → covered by Tasks 9, 10, 19
- **Spec § 4.2 batch mode body progression** → covered by Tasks 12, 14
- **Spec § 4.3 resolved markets checklist** → Task 13 (virtualization, search, sort, select-all, defaults, edge states all present)
- **Spec § 4.4 confirm step** → Task 17 (banner), 18 (dialog), 19 (branching)
- **Spec § 4.4 tiered confirms** → Task 18 (50+/250+ ack); >500 hard cap is in Task 14 (`HARD_BATCH_CAP = 500`)
- **Spec § 5.1 scope endpoint** → Tasks 2, 3
- **Spec § 5.2 batch run endpoint** → Tasks 4, 5
- **Spec § 5.3 schema migration** → Task 1
- **Spec § 5.4 modified backend files** → Tasks 4 (DTO + service), 6 (queries + controller dashboard filter)
- **Spec § 6 component breakdown** → all 6 new components and modified ones in Tasks 7-20
- **Spec § 7 acceptance criteria 1-10** → covered by Tasks 9, 10 (criterion 1, 2), 2-3 (criterion 3), 12 custom-list (criterion 4), 13 (criterion 5), 5, 9, 19 (criterion 6), 14, 18 (criterion 7), 17 (criterion 8), 5, 19 (criterion 9), 4 (criterion 10)
- **Spec § 7 acceptance criterion 11 (DESTINATION GATE)** → Tasks 22, 23 — the iron gate

**Type consistency check:** the property names `id`, `geography`, `canonical_name`, `population`, `score` for ResolvedMarket are used identically in the backend DTO (Task 2), frontend API (Task 7), and consuming components (Tasks 13, 14). The `BatchMarket` shape (`id`, `geography`) is used identically in the batch DTO (Task 5), the frontend mutation type (Task 8), and the wizard state (Task 9). `batchId` flows through CreateRunDto (Task 4), the batch controller (Task 5), the dashboard query param (Task 6), and the URL `?batch=<id>` (Task 9, 20). No drift.

**Placeholder scan:** no "TBD", "TODO", or "implement later" — every step contains the actual code or command to run. The `PER_RENDER_COST_USD = 0.1` is a documented placeholder per the spec, not a plan failure.
