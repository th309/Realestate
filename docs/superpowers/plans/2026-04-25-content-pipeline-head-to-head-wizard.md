# Content Pipeline Head-to-Head Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `head_to_head` content-pipeline format runnable end-to-end from `/admin/content-pipeline/new` by adding a 4th wizard step ("Pick the opponent") with intent-driven suggestions (Biggest contrast / Similar peer / Search), a backend ranking endpoint, a DTO + DB column for the opponent, and a fetch handler that snapshots both markets into the existing `{primary, secondary}` payload shape the renderer already consumes.

**Architecture:** Wizard adds a conditional 4th step only when `format === 'head_to_head'`; other formats unchanged. One new backend service (`OpponentSuggestionService`) with two ranking SQL paths, one new GET endpoint, one new optional DTO field with `@ValidateIf`. The fetch handler reads `opponent_market_query` from the run row and, when present, snapshots a second market so the existing `head_to_head.md` prompt and `HeadToHeadLayout.tsx` get the `{primary, secondary}` data bundle they already expect. Single-run only in v1 — Single/Batch toggle is hidden for `head_to_head`.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind 4 · TanStack React Query · NestJS 11 · class-validator · Supabase Postgres · Jest · Playwright (validation-only).

**Spec:** `docs/superpowers/specs/2026-04-25-content-pipeline-head-to-head-wizard-design.md`

**Branch:** `feat/content-pipeline-p3-ranking` (current); spin a new branch only if the user asks.

---

## File Structure

### New backend files

| Path                                                                                  | Responsibility                                                                         |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `packages/backend/src/content-pipeline/opponents/opponent-suggestion.service.ts`      | Two ranking paths: `rankContrast` and `rankSimilar`; reads from existing tables        |
| `packages/backend/src/content-pipeline/opponents/opponent-suggestion.service.spec.ts` | Unit tests for both ranking paths and the empty-result case                            |
| `packages/backend/src/content-pipeline/opponents/opponents.controller.ts`             | `GET /api/admin/content-pipeline/opponents`                                            |
| `packages/backend/src/content-pipeline/dto/list-opponents.dto.ts`                     | Query-param DTO with class-validator                                                   |
| `supabase/migrations/20260425000500_content_runs_opponent_columns.sql`                | `ALTER TABLE content_runs ADD opponent_market_query TEXT, resolved_opponent_geo JSONB` |

### New frontend files

| Path                                                                       | Responsibility                                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/frontend/app/admin/content-pipeline/lib/opponents-api.ts`        | `fetchOpponents()` fetcher + `useOpponents()` React Query hook                              |
| `packages/frontend/app/admin/content-pipeline/new/market-search-input.tsx` | Extracted from `market-step.tsx`'s `SingleMarketBody` so opponent step can reuse it         |
| `packages/frontend/app/admin/content-pipeline/new/opponent-step.tsx`       | The new wizard step: intent chips, sub-controls, suggestion cards, free-text fallback       |
| `scripts/validate-head-to-head-wizard.mjs`                                 | Playwright destination-gate validator: walks the 4-step flow and asserts a real video lands |

### Modified files

| Path                                                                                    | Change                                                                                       |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/backend/src/content-pipeline/dto/create-run.dto.ts`                           | Add `opponentMarketQuery?: string` with `@ValidateIf((o) => o.format === 'head_to_head')`    |
| `packages/backend/src/content-pipeline/content-runs.service.ts`                         | Persist `opponent_market_query` if present in DTO                                            |
| `packages/backend/src/content-pipeline/orchestrator/job-handlers/fetch-data.handler.ts` | Read opponent query → snapshot both → store `{primary, secondary}` payload                   |
| `packages/backend/src/content-pipeline/content-pipeline.module.ts`                      | Register `OpponentSuggestionService` + `OpponentsController`                                 |
| `scripts/apply-content-pipeline-migrations.js`                                          | Append `20260425000500_content_runs_opponent_columns.sql` to `MIGRATIONS` array              |
| `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts`              | Extend `createRun` payload type to accept optional `opponentMarketQuery`                     |
| `packages/frontend/app/admin/content-pipeline/new/page.tsx`                             | Expand `step` union with `'opponent'`, branch by `format`, hold opponent state               |
| `packages/frontend/app/admin/content-pipeline/new/market-step.tsx`                      | Extract input into `MarketSearchInput`, hide Single/Batch toggle when format is head_to_head |
| `packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx`                     | Pass `opponentMarket` to `SingleMarketSummary` and into `createRun` payload                  |
| `packages/frontend/app/admin/content-pipeline/new/single-market-summary.tsx`            | Accept optional `opponentMarket` prop and render second market chip when present             |

---

## Phase A: Backend data path

### Task 1: DB migration for opponent columns

**Files:**

- Create: `supabase/migrations/20260425000500_content_runs_opponent_columns.sql`
- Modify: `scripts/apply-content-pipeline-migrations.js` (append migration filename)

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260425000500_content_runs_opponent_columns.sql`:

```sql
-- Head-to-head wizard: a run optionally carries a free-text query for the
-- opponent market, plus the resolved geo (mirrors resolved_geo). Both
-- nullable; non-head_to_head runs leave them NULL.

ALTER TABLE content_runs
  ADD COLUMN IF NOT EXISTS opponent_market_query TEXT NULL,
  ADD COLUMN IF NOT EXISTS resolved_opponent_geo JSONB NULL;

COMMENT ON COLUMN content_runs.opponent_market_query IS
  'Free-text canonical name of the opponent market (head_to_head only).';
COMMENT ON COLUMN content_runs.resolved_opponent_geo IS
  'Resolved opponent geo {geography, id, canonical_name} written by fetch-data handler.';
```

- [ ] **Step 2: Append to migration runner**

Edit `scripts/apply-content-pipeline-migrations.js` — append `'20260425000500_content_runs_opponent_columns.sql'` to the end of the `MIGRATIONS` array (after the most recent existing entry; preserve trailing comma style).

- [ ] **Step 3: Run the migration locally**

Run: `node scripts/apply-content-pipeline-migrations.js`
Expected: prints `applied 20260425000500_content_runs_opponent_columns.sql` (or equivalent), no errors.

- [ ] **Step 4: Verify columns exist**

Run a quick Supabase MCP query:

```
SELECT column_name FROM information_schema.columns
WHERE table_name='content_runs'
  AND column_name IN ('opponent_market_query','resolved_opponent_geo');
```

Expected: 2 rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260425000500_content_runs_opponent_columns.sql scripts/apply-content-pipeline-migrations.js
git commit -m "feat(content-pipeline): add opponent_market_query + resolved_opponent_geo to content_runs"
```

---

### Task 2: DTO field for opponent

**Files:**

- Modify: `packages/backend/src/content-pipeline/dto/create-run.dto.ts`

- [ ] **Step 1: Write failing test**

Create `packages/backend/src/content-pipeline/dto/create-run.dto.spec.ts`:

```ts
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CreateRunDto } from "./create-run.dto";
import { randomUUID } from "crypto";

describe("CreateRunDto", () => {
  const base = {
    marketQuery: "Tampa, FL",
    idempotencyKey: randomUUID(),
  };

  it("rejects head_to_head without opponentMarketQuery", async () => {
    const dto = plainToInstance(CreateRunDto, {
      ...base,
      format: "head_to_head",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "opponentMarketQuery")).toBe(true);
  });

  it("accepts head_to_head with opponentMarketQuery", async () => {
    const dto = plainToInstance(CreateRunDto, {
      ...base,
      format: "head_to_head",
      opponentMarketQuery: "Cleveland, OH",
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it("accepts grade_reveal without opponentMarketQuery", async () => {
    const dto = plainToInstance(CreateRunDto, {
      ...base,
      format: "grade_reveal",
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend jest packages/backend/src/content-pipeline/dto/create-run.dto.spec.ts`
Expected: FAIL — `opponentMarketQuery` field is unknown / no validation error raised.

- [ ] **Step 3: Add the field**

Edit `packages/backend/src/content-pipeline/dto/create-run.dto.ts`:

Add `ValidateIf` to the imports:

```ts
import {
  IsString,
  IsIn,
  IsOptional,
  IsArray,
  IsUUID,
  MinLength,
  ValidateIf,
} from "class-validator";
```

Append after `extraDirectives`:

```ts
@ValidateIf((o) => o.format === 'head_to_head')
@IsString()
@MinLength(2)
opponentMarketQuery?: string;
```

- [ ] **Step 4: Re-run test**

Run: `pnpm --filter backend jest packages/backend/src/content-pipeline/dto/create-run.dto.spec.ts`
Expected: PASS — all 3 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/dto/create-run.dto.ts packages/backend/src/content-pipeline/dto/create-run.dto.spec.ts
git commit -m "feat(content-pipeline): require opponentMarketQuery on head_to_head DTO"
```

---

### Task 3: Persist opponent on run creation

**Files:**

- Modify: `packages/backend/src/content-pipeline/content-runs.service.ts`

- [ ] **Step 1: Read the file** (handler logic lives near the existing INSERT)

Read `packages/backend/src/content-pipeline/content-runs.service.ts` to find the `createRun` method that builds the row inserted into `content_runs`. The existing call already sets `market_query`. We need to add `opponent_market_query`.

- [ ] **Step 2: Add the column to the INSERT payload**

In the row-build object (the `.from('content_runs').insert({...})` call), add:

```ts
opponent_market_query: dto.opponentMarketQuery ?? null,
```

If the service uses a typed parameter object instead of taking the DTO directly, thread the value through the same way `marketQuery` is threaded. No new method signatures.

- [ ] **Step 3: Update or add a unit test**

In the existing `content-runs.service.spec.ts` (or create one if absent), add:

```ts
it("persists opponent_market_query when DTO provides it", async () => {
  // arrange: spy on supabase insert
  // act: call createRun with format='head_to_head', opponentMarketQuery='Cleveland, OH'
  // assert: insert payload contains opponent_market_query: 'Cleveland, OH'
});

it("writes NULL opponent_market_query for non-head_to_head", async () => {
  // similar, format='grade_reveal', no opponentMarketQuery
  // assert: insert payload contains opponent_market_query: null
});
```

Use the existing test's mock-Supabase pattern; copy the structure of any sibling test in the same file.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter backend jest packages/backend/src/content-pipeline/content-runs.service.spec.ts`
Expected: all PASS, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/content-runs.service.ts packages/backend/src/content-pipeline/content-runs.service.spec.ts
git commit -m "feat(content-pipeline): persist opponent_market_query on run creation"
```

---

### Task 4: Fetch handler snapshots both markets

**Files:**

- Modify: `packages/backend/src/content-pipeline/orchestrator/job-handlers/fetch-data.handler.ts`

- [ ] **Step 1: Write failing test**

Create or extend `packages/backend/src/content-pipeline/orchestrator/job-handlers/fetch-data.handler.spec.ts` (one already exists per the file tree). Add:

```ts
it("snapshots both markets when opponent_market_query is set", async () => {
  // arrange: stub supabase select to return run with
  //   market_query='Tampa, FL', opponent_market_query='Cleveland, OH', format='head_to_head'
  // stub data.resolveMarket to return matching geos for each query
  // stub data.getMarketSnapshot to return distinct snapshot objects
  // act: handler.handle(runId)
  // assert:
  //   - getMarketSnapshot called twice
  //   - content_runs.update called with resolved_geo AND resolved_opponent_geo
  //   - content_assets insert metadata = { primary: snapshotA, secondary: snapshotB }
});

it("keeps single-market shape when opponent_market_query is null", async () => {
  // arrange: opponent_market_query=null
  // assert:
  //   - getMarketSnapshot called once
  //   - content_assets insert metadata equals the snapshot directly (current behavior)
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter backend jest packages/backend/src/content-pipeline/orchestrator/job-handlers/fetch-data.handler.spec.ts`
Expected: FAIL — handler currently fetches one snapshot only.

- [ ] **Step 3: Update handler logic**

Replace the body of `handle()` in `fetch-data.handler.ts` with:

```ts
async handle(runId: string): Promise<void> {
  try {
    const client = this.supabase.getClient();
    const { data: run } = await client
      .from('content_runs')
      .select('market_query, opponent_market_query, format')
      .eq('id', runId)
      .single();
    if (!run) throw new Error('run not found');

    const primaryGeo = await this.resolveOrThrow(run.market_query);
    const primarySnapshot = await this.data.getMarketSnapshot(primaryGeo);

    let opponentGeo = null as Awaited<ReturnType<typeof this.resolveOrThrow>> | null;
    let opponentSnapshot = null as Awaited<ReturnType<typeof this.data.getMarketSnapshot>> | null;
    if (run.opponent_market_query) {
      opponentGeo = await this.resolveOrThrow(run.opponent_market_query);
      opponentSnapshot = await this.data.getMarketSnapshot(opponentGeo);
    }

    await client
      .from('content_runs')
      .update({
        resolved_geo: primaryGeo,
        resolved_opponent_geo: opponentGeo,
      })
      .eq('id', runId);

    await client
      .from('content_assets')
      .delete()
      .eq('run_id', runId)
      .eq('kind', 'mcp_payload');

    const metadata = opponentSnapshot
      ? { primary: primarySnapshot, secondary: opponentSnapshot }
      : primarySnapshot;

    await client.from('content_assets').insert({
      run_id: runId,
      kind: 'mcp_payload',
      storage_url: 'inline',
      metadata,
    });

    await this.orchestrator.handleStepSuccess(runId);
  } catch (err) {
    await this.orchestrator.handleStepFailure(
      runId,
      `fetch_data: ${(err as Error).message}`,
    );
  }
}

private async resolveOrThrow(query: string) {
  const candidates = await this.data.resolveMarket(query);
  if (candidates.length === 0) throw new Error(`no market match for "${query}"`);
  return {
    geography: candidates[0].geography,
    id: candidates[0].id,
    canonical_name: candidates[0].canonical_name,
  };
}
```

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter backend jest packages/backend/src/content-pipeline/orchestrator/job-handlers/fetch-data.handler.spec.ts`
Expected: PASS for both new tests + any existing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/orchestrator/job-handlers/fetch-data.handler.ts packages/backend/src/content-pipeline/orchestrator/job-handlers/fetch-data.handler.spec.ts
git commit -m "feat(content-pipeline): fetch-data handler snapshots both markets for head_to_head"
```

---

## Phase B: Suggestion endpoint

### Task 5: OpponentSuggestionService — contrast ranking

**Files:**

- Create: `packages/backend/src/content-pipeline/opponents/opponent-suggestion.service.ts`
- Create: `packages/backend/src/content-pipeline/opponents/opponent-suggestion.service.spec.ts`

- [ ] **Step 1: Write the failing tests for contrast**

Create `packages/backend/src/content-pipeline/opponents/opponent-suggestion.service.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { OpponentSuggestionService } from "./opponent-suggestion.service";
import { SupabaseService } from "../../supabase/supabase.service";

function mockSupabase(handlers: Record<string, any>) {
  return {
    getClient: () => ({
      from: (table: string) => handlers[table],
    }),
  } as any;
}

describe("OpponentSuggestionService — rankContrast", () => {
  it("ranks national candidates by absolute gap on PIQ score", async () => {
    const supabase = mockSupabase({
      propertyiq_scores: {
        select: () => ({
          eq: () => ({
            // primary lookup
            single: async () => ({
              data: { region_id: "45300", score: 87 },
              error: null,
            }),
          }),
        }),
      },
      // (Implementation will issue separate queries; align mocks accordingly)
    });
    // The real test stubs both the primary lookup and the candidate list
    // explicitly — see implementation in Step 3 for exact call shape.
    const service = new OpponentSuggestionService(supabase);
    const result = await service.rankContrast({
      primary: { id: "45300", geography: "metro" },
      metric: "piq_score",
      geoFilter: "national",
      limit: 5,
    });
    expect(result.candidates.length).toBeLessThanOrEqual(5);
    expect(result.candidates[0].gap !== undefined).toBe(true);
  });

  it("returns empty candidates when primary metric value is missing", async () => {
    // stub primary lookup to return null
    // assert candidates: []
  });
});
```

(The mock shape will be tightened in Step 3 once the SQL pattern is fixed; this is the failing-test scaffold.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter backend jest packages/backend/src/content-pipeline/opponents/opponent-suggestion.service.spec.ts`
Expected: FAIL — service file doesn't exist.

- [ ] **Step 3: Implement the service**

Create `packages/backend/src/content-pipeline/opponents/opponent-suggestion.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";

export type Geography = "metro" | "county" | "zip" | "state";
export type ContrastMetric =
  | "piq_score"
  | "home_value_yoy"
  | "homeowner_affordability";

export interface RankArgs {
  primary: { id: string; geography: Geography };
  metric: ContrastMetric;
  geoFilter: "national" | "state";
  limit: number;
}

export interface SimilarArgs {
  primary: { id: string; geography: Geography };
  limit: number;
}

export interface Candidate {
  id: string;
  geography: Geography;
  canonicalName: string;
  value: number;
  gap: number;
  population: number | null;
}

export interface RankResult {
  primary: {
    id: string;
    geography: Geography;
    canonicalName: string;
    value: number | null;
  };
  candidates: Candidate[];
}

@Injectable()
export class OpponentSuggestionService {
  constructor(private readonly supabase: SupabaseService) {}

  async rankContrast(args: RankArgs): Promise<RankResult> {
    const client = this.supabase.getClient();

    // 1. Look up primary value for the chosen metric
    const primaryRow = await this.fetchMetricForGeo(
      args.primary.id,
      args.primary.geography,
      args.metric,
    );
    if (primaryRow == null) {
      return {
        primary: {
          id: args.primary.id,
          geography: args.primary.geography,
          canonicalName: "",
          value: null,
        },
        candidates: [],
      };
    }

    // 2. Optional: filter to primary's state
    let stateFilter: string | null = null;
    if (args.geoFilter === "state") {
      stateFilter = await this.fetchStateAbbrev(
        args.primary.id,
        args.primary.geography,
      );
    }

    // 3. Fetch candidate pool (same source as primary metric)
    const candidateRows = await this.fetchCandidatePool(
      args.metric,
      args.primary.geography,
      args.primary.id,
      stateFilter,
    );

    // 4. Sort by absolute gap, take top N
    const sorted = candidateRows
      .filter((r) => r.value != null)
      .map((r) => ({
        id: r.id,
        geography: args.primary.geography,
        canonicalName: r.canonicalName,
        value: r.value,
        gap: r.value - primaryRow.value,
        population: r.population,
      }))
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
      .slice(0, args.limit);

    return {
      primary: {
        id: args.primary.id,
        geography: args.primary.geography,
        canonicalName: primaryRow.canonicalName,
        value: primaryRow.value,
      },
      candidates: sorted,
    };
  }

  async rankSimilar(args: SimilarArgs): Promise<RankResult> {
    const client = this.supabase.getClient();

    // 1. Fetch primary's population + state
    const { data: primaryRow } = await client
      .from("geography_crosswalk")
      .select("cbsa_code, cbsa_name, cbsa_population, state_abbrev")
      .eq(
        args.primary.geography === "metro" ? "cbsa_code" : "zip_code",
        args.primary.id,
      )
      .limit(1)
      .single();

    if (
      !primaryRow ||
      !primaryRow.cbsa_population ||
      !primaryRow.state_abbrev
    ) {
      return {
        primary: {
          id: args.primary.id,
          geography: args.primary.geography,
          canonicalName: primaryRow?.cbsa_name ?? "",
          value: null,
        },
        candidates: [],
      };
    }

    const minPop = primaryRow.cbsa_population * 0.75;
    const maxPop = primaryRow.cbsa_population * 1.25;

    // 2. Same state, ±25% population, exclude self
    const { data: peers } = await client
      .from("geography_crosswalk")
      .select("cbsa_code, cbsa_name, cbsa_population")
      .eq("state_abbrev", primaryRow.state_abbrev)
      .gte("cbsa_population", minPop)
      .lte("cbsa_population", maxPop)
      .neq("cbsa_code", args.primary.id)
      .not("cbsa_code", "is", null)
      .limit(args.limit * 4); // overfetch, dedupe in memory

    // 3. Attach PIQ score for each peer (always — similar always uses piq_score)
    const peerIds = Array.from(
      new Set((peers ?? []).map((p: any) => p.cbsa_code)),
    );
    const { data: scores } = await client
      .from("propertyiq_scores")
      .select("region_id, score")
      .eq("geo_level", "metro")
      .eq("score_type", "propertyiq")
      .in("region_id", peerIds);

    const scoreMap = new Map(
      (scores ?? []).map((s: any) => [s.region_id, s.score]),
    );

    // 4. Primary's PIQ for gap computation
    const { data: primaryScoreRow } = await client
      .from("propertyiq_scores")
      .select("score")
      .eq("geo_level", "metro")
      .eq("score_type", "propertyiq")
      .eq("region_id", args.primary.id)
      .limit(1)
      .single();
    const primaryScore = primaryScoreRow?.score ?? 0;

    const candidates: Candidate[] = (peers ?? [])
      .map((p: any) => {
        const v = scoreMap.get(p.cbsa_code);
        if (v == null) return null;
        return {
          id: p.cbsa_code,
          geography: args.primary.geography,
          canonicalName: p.cbsa_name ?? `Metro ${p.cbsa_code}`,
          value: v as number,
          gap: (v as number) - primaryScore,
          population: p.cbsa_population,
        };
      })
      .filter((c: Candidate | null): c is Candidate => c !== null)
      .sort(
        (a, b) =>
          Math.abs(a.population! - primaryRow.cbsa_population) -
          Math.abs(b.population! - primaryRow.cbsa_population),
      )
      .slice(0, args.limit);

    return {
      primary: {
        id: args.primary.id,
        geography: args.primary.geography,
        canonicalName: primaryRow.cbsa_name ?? "",
        value: primaryScore,
      },
      candidates,
    };
  }

  // --- helpers ---

  private async fetchMetricForGeo(
    id: string,
    geography: Geography,
    metric: ContrastMetric,
  ): Promise<{ value: number; canonicalName: string } | null> {
    const client = this.supabase.getClient();
    if (metric === "piq_score") {
      const { data } = await client
        .from("propertyiq_scores")
        .select("score, region_id")
        .eq("geo_level", geography)
        .eq("score_type", "propertyiq")
        .eq("region_id", id)
        .limit(1)
        .single();
      if (!data) return null;
      const name = await this.fetchCanonicalName(id, geography);
      return { value: data.score, canonicalName: name };
    }
    // home_value_yoy → realtor table; homeowner_affordability → realtor table.
    // Implementation: join through the existing metric resolution path.
    // For v1, pull from a single canonical view. If the metric is missing for
    // this geo, return null (caller surfaces empty candidates).
    return this.fetchMetricFromMetricSource(id, geography, metric);
  }

  private async fetchMetricFromMetricSource(
    id: string,
    geography: Geography,
    metric: ContrastMetric,
  ): Promise<{ value: number; canonicalName: string } | null> {
    // Map metric to source table + column. Limit to metro for v1.
    const sourceTable = geography === "metro" ? "realtor_metro" : null;
    if (!sourceTable) return null;
    const valueColumn =
      metric === "home_value_yoy"
        ? "home_value_yoy_pct"
        : metric === "homeowner_affordability"
          ? "homeowner_affordability_index"
          : null;
    if (!valueColumn) return null;
    const client = this.supabase.getClient();
    const { data } = await client
      .from(sourceTable)
      .select(`${valueColumn}, region_name, period_date`)
      .eq("region_id", id)
      .order("period_date", { ascending: false })
      .limit(1)
      .single();
    if (!data || data[valueColumn] == null) return null;
    return { value: data[valueColumn], canonicalName: data.region_name };
  }

  private async fetchCanonicalName(
    id: string,
    geography: Geography,
  ): Promise<string> {
    const client = this.supabase.getClient();
    if (geography === "metro") {
      const { data } = await client
        .from("geography_crosswalk")
        .select("cbsa_name")
        .eq("cbsa_code", id)
        .limit(1)
        .single();
      return data?.cbsa_name ?? `Metro ${id}`;
    }
    if (geography === "zip") return `ZIP ${id}`;
    if (geography === "state") return id;
    return id;
  }

  private async fetchStateAbbrev(
    id: string,
    geography: Geography,
  ): Promise<string | null> {
    const client = this.supabase.getClient();
    const { data } = await client
      .from("geography_crosswalk")
      .select("state_abbrev")
      .eq(geography === "metro" ? "cbsa_code" : "zip_code", id)
      .limit(1)
      .single();
    return data?.state_abbrev ?? null;
  }

  private async fetchCandidatePool(
    metric: ContrastMetric,
    geography: Geography,
    excludeId: string,
    stateFilter: string | null,
  ): Promise<
    Array<{
      id: string;
      canonicalName: string;
      value: number;
      population: number | null;
    }>
  > {
    const client = this.supabase.getClient();
    if (metric === "piq_score") {
      // Pull all metro scores
      let query = client
        .from("propertyiq_scores")
        .select("region_id, score")
        .eq("geo_level", geography)
        .eq("score_type", "propertyiq")
        .neq("region_id", excludeId);
      const { data: scoreRows } = await query.limit(1000);
      const ids = (scoreRows ?? []).map((r: any) => r.region_id);
      // Join names + state for filter
      const { data: cwRows } = await client
        .from("geography_crosswalk")
        .select("cbsa_code, cbsa_name, cbsa_population, state_abbrev")
        .in(geography === "metro" ? "cbsa_code" : "zip_code", ids);
      const meta = new Map(
        (cwRows ?? []).map((r: any) => [
          geography === "metro" ? r.cbsa_code : r.zip_code,
          {
            name: r.cbsa_name ?? "",
            pop: r.cbsa_population ?? null,
            state: r.state_abbrev,
          },
        ]),
      );
      return (scoreRows ?? [])
        .map((r: any) => {
          const m = meta.get(r.region_id);
          if (!m) return null;
          if (stateFilter && m.state !== stateFilter) return null;
          return {
            id: r.region_id,
            canonicalName: m.name || `Metro ${r.region_id}`,
            value: r.score,
            population: m.pop,
          };
        })
        .filter((x: any): x is NonNullable<typeof x> => x !== null);
    }
    // For home_value_yoy / homeowner_affordability: pull from realtor_metro
    return this.fetchMetricCandidatePool(
      metric,
      geography,
      excludeId,
      stateFilter,
    );
  }

  private async fetchMetricCandidatePool(
    metric: ContrastMetric,
    geography: Geography,
    excludeId: string,
    stateFilter: string | null,
  ): Promise<
    Array<{
      id: string;
      canonicalName: string;
      value: number;
      population: number | null;
    }>
  > {
    if (geography !== "metro") return [];
    const valueColumn =
      metric === "home_value_yoy"
        ? "home_value_yoy_pct"
        : "homeowner_affordability_index";
    const client = this.supabase.getClient();
    const { data } = await client
      .from("realtor_metro")
      .select(`region_id, region_name, ${valueColumn}, period_date`)
      .neq("region_id", excludeId)
      .order("period_date", { ascending: false })
      .limit(2000);
    // Take latest period per region
    const latest = new Map<string, any>();
    for (const row of data ?? []) {
      const r = row as any;
      if (!latest.has(r.region_id)) latest.set(r.region_id, r);
    }
    let rows = Array.from(latest.values());

    if (stateFilter) {
      const ids = rows.map((r) => r.region_id);
      const { data: cw } = await client
        .from("geography_crosswalk")
        .select("cbsa_code, state_abbrev, cbsa_population")
        .in("cbsa_code", ids);
      const stateMap = new Map((cw ?? []).map((r: any) => [r.cbsa_code, r]));
      rows = rows.filter(
        (r) => stateMap.get(r.region_id)?.state_abbrev === stateFilter,
      );
    }

    return rows
      .filter((r) => r[valueColumn] != null)
      .map((r) => ({
        id: r.region_id,
        canonicalName: r.region_name,
        value: r[valueColumn],
        population: null,
      }));
  }
}
```

> **Implementation note:** The exact metric-source table names (`realtor_metro`, column `home_value_yoy_pct`, etc.) need to be confirmed against the live schema before merging. If a column name differs, swap it inline — the algorithm doesn't change. Run `\d realtor_metro` (or equivalent Supabase MCP `list_tables` + column inspection) before finalizing.

- [ ] **Step 4: Tighten the test mocks**

Now that the call shape is fixed, update the spec to match: stub `propertyiq_scores` for primary lookup, the candidate pool (1000 rows), `geography_crosswalk` for the meta lookup, and assert top-5 are sorted by `Math.abs(gap)` descending. Add a third test: `stateFilter: 'TX'` returns only TX peers.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter backend jest packages/backend/src/content-pipeline/opponents/opponent-suggestion.service.spec.ts`
Expected: PASS — both contrast cases + state-filter case.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/content-pipeline/opponents/
git commit -m "feat(content-pipeline): OpponentSuggestionService rankContrast"
```

---

### Task 6: OpponentSuggestionService — similar peer ranking + tests

**Files:**

- Modify: `packages/backend/src/content-pipeline/opponents/opponent-suggestion.service.spec.ts` (add similar tests)

- [ ] **Step 1: Add failing similar-peer tests**

Append to the spec:

```ts
describe("OpponentSuggestionService — rankSimilar", () => {
  it("returns peers in same state within ±25% population", async () => {
    // arrange:
    //   geography_crosswalk primary = { cbsa_code:'45300', cbsa_population:3M, state_abbrev:'FL', cbsa_name:'Tampa, FL' }
    //   peer query returns 4 FL metros: Jacksonville (1.6M), Orlando (2.7M), Miami (6.1M), Tallahassee (0.4M)
    //   propertyiq_scores returns scores for Jacksonville (72), Orlando (84), Miami (66), Tallahassee (61)
    //   primary score = 87
    // act: rankSimilar({primary:{id:'45300', geography:'metro'}, limit:5})
    // assert:
    //   - Miami excluded (6.1M > 3M*1.25=3.75M)
    //   - Tallahassee excluded (0.4M < 3M*0.75=2.25M)
    //   - Jacksonville excluded (1.6M < 2.25M)
    //   - Only Orlando (2.7M) returned
    //   - candidates[0] = Orlando, gap = 84-87 = -3
  });

  it("returns empty when primary has no population data", async () => {
    // primary lookup returns null cbsa_population
    // assert candidates: []
  });
});
```

- [ ] **Step 2: Run to verify failure (or pass — implementation is already in place)**

Run: `pnpm --filter backend jest packages/backend/src/content-pipeline/opponents/opponent-suggestion.service.spec.ts`
Expected: PASS — the implementation from Task 5 already covers this. If not, fix the implementation rather than the test.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/content-pipeline/opponents/opponent-suggestion.service.spec.ts
git commit -m "test(content-pipeline): cover rankSimilar peer-band logic"
```

---

### Task 7: Opponents controller + DTO + module wiring

**Files:**

- Create: `packages/backend/src/content-pipeline/opponents/opponents.controller.ts`
- Create: `packages/backend/src/content-pipeline/dto/list-opponents.dto.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.module.ts`

- [ ] **Step 1: Create the DTO**

Create `packages/backend/src/content-pipeline/dto/list-opponents.dto.ts`:

```ts
import { IsString, IsIn, IsOptional, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class ListOpponentsDto {
  @IsString()
  primaryGeoId!: string;

  @IsIn(["metro", "county", "zip", "state"])
  primaryGeography!: "metro" | "county" | "zip" | "state";

  @IsIn(["contrast", "similar"])
  intent!: "contrast" | "similar";

  @IsOptional()
  @IsIn(["piq_score", "home_value_yoy", "homeowner_affordability"])
  metric?: "piq_score" | "home_value_yoy" | "homeowner_affordability";

  @IsOptional()
  @IsIn(["national", "state"])
  geoFilter?: "national" | "state";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
```

- [ ] **Step 2: Create the controller**

Create `packages/backend/src/content-pipeline/opponents/opponents.controller.ts`:

```ts
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { OpponentSuggestionService } from "./opponent-suggestion.service";
import { ListOpponentsDto } from "../dto/list-opponents.dto";
import { AdminGuard } from "../../auth/admin.guard";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";

@Controller("api/admin/content-pipeline")
@UseGuards(JwtAuthGuard, AdminGuard)
export class OpponentsController {
  constructor(private readonly suggestion: OpponentSuggestionService) {}

  @Get("opponents")
  async list(@Query() dto: ListOpponentsDto) {
    const limit = dto.limit ?? 5;
    if (dto.intent === "contrast") {
      const result = await this.suggestion.rankContrast({
        primary: { id: dto.primaryGeoId, geography: dto.primaryGeography },
        metric: dto.metric ?? "piq_score",
        geoFilter: dto.geoFilter ?? "national",
        limit,
      });
      return { success: true, data: result };
    }
    // similar
    const result = await this.suggestion.rankSimilar({
      primary: { id: dto.primaryGeoId, geography: dto.primaryGeography },
      limit,
    });
    return { success: true, data: result };
  }
}
```

> **Verify guard imports:** open `content-pipeline.controller.ts` and copy the exact import paths used there for `JwtAuthGuard` and `AdminGuard` — they may live under a different module path than shown above.

- [ ] **Step 3: Register in module**

Edit `packages/backend/src/content-pipeline/content-pipeline.module.ts`:

Add imports:

```ts
import { OpponentsController } from "./opponents/opponents.controller";
import { OpponentSuggestionService } from "./opponents/opponent-suggestion.service";
```

Append `OpponentsController` to the `controllers` array and `OpponentSuggestionService` to the `providers` array (preserving existing order/comma style).

- [ ] **Step 4: Build the backend**

Run: `pnpm --filter backend build`
Expected: clean TypeScript build, no errors.

- [ ] **Step 5: Smoke-test the endpoint locally**

Start backend (`pnpm dev:backend` or however the project starts it), then in a new shell:

```bash
curl -s "http://localhost:3001/api/admin/content-pipeline/opponents?primaryGeoId=45300&primaryGeography=metro&intent=contrast&metric=piq_score&geoFilter=national&limit=5" \
  -H "Authorization: Bearer $JWT" | jq .
```

(Use a valid admin JWT from the cookie of an authenticated browser session.)

Expected: `{"success":true,"data":{"primary":{...},"candidates":[...5 items...]}}`. If the candidate list is empty for a metro you know has scores, log into the response shape and dig in.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/content-pipeline/opponents/opponents.controller.ts packages/backend/src/content-pipeline/dto/list-opponents.dto.ts packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): GET /opponents endpoint for opponent suggestions"
```

---

## Phase C: Frontend wizard

### Task 8: Extract `MarketSearchInput` from market-step

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/market-search-input.tsx`
- Modify: `packages/frontend/app/admin/content-pipeline/new/market-step.tsx`

- [ ] **Step 1: Create the extracted component**

Create `packages/frontend/app/admin/content-pipeline/new/market-search-input.tsx`:

```tsx
"use client";
import { useState } from "react";
import { resolveMarket } from "../lib/content-pipeline-api";

interface MarketMatch {
  id: string;
  canonical_name: string;
  geography: string;
  state?: string;
}

export function MarketSearchInput({
  placeholder,
  autoFocus,
  onPick,
}: {
  placeholder?: string;
  autoFocus?: boolean;
  onPick: (match: MarketMatch) => void;
}) {
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
        placeholder={placeholder ?? "Cleveland, Miami, 78704..."}
        className="w-full rounded-full border border-outline-variant px-6 py-4 text-lg"
        autoFocus={autoFocus}
      />
      <div className="mt-4 space-y-2">
        {matches.map((m) => (
          <button
            key={m.id}
            onClick={() => onPick(m)}
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
```

- [ ] **Step 2: Update market-step.tsx to use it**

Edit `packages/frontend/app/admin/content-pipeline/new/market-step.tsx` — replace the `SingleMarketBody` function with:

```tsx
import { MarketSearchInput } from "./market-search-input";

function SingleMarketBody({ onPick }: { onPick: (market: string) => void }) {
  return (
    <MarketSearchInput autoFocus onPick={(m) => onPick(m.canonical_name)} />
  );
}
```

Remove the now-unused `useState`, `MarketMatch`, and `resolveMarket` imports if nothing else in the file uses them.

- [ ] **Step 3: Build the frontend**

Run: `pnpm --filter frontend tsc --noEmit`
Expected: clean. (If anything else in the wizard imported `MarketMatch` from market-step.tsx, fix the import.)

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/market-search-input.tsx packages/frontend/app/admin/content-pipeline/new/market-step.tsx
git commit -m "refactor(content-pipeline): extract MarketSearchInput for reuse"
```

---

### Task 9: Hide Single/Batch toggle for head_to_head

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/new/page.tsx`
- Modify: `packages/frontend/app/admin/content-pipeline/new/market-step.tsx`

- [ ] **Step 1: Pass format down to MarketStep**

Edit `packages/frontend/app/admin/content-pipeline/new/page.tsx` — add `format={format}` to the `<MarketStep ... />` JSX.

- [ ] **Step 2: Accept and use format in MarketStep**

Edit `market-step.tsx`:

Add `format: string` to the `MarketStep` props interface. Then change the `ModeToggle` render to:

```tsx
{
  format !== "head_to_head" && (
    <ModeToggle mode={mode} onChange={onModeChange} />
  );
}

{
  mode === "single" || format === "head_to_head" ? (
    <SingleMarketBody onPick={onPickSingle} />
  ) : (
    <MarketStepBatch onPick={onPickBatch} />
  );
}
```

This forces single mode and hides the toggle entirely when format is head_to_head.

- [ ] **Step 3: TypeCheck**

Run: `pnpm --filter frontend tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/page.tsx packages/frontend/app/admin/content-pipeline/new/market-step.tsx
git commit -m "feat(content-pipeline): force single mode for head_to_head wizard"
```

---

### Task 10: Opponents API client

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/lib/opponents-api.ts`

- [ ] **Step 1: Write the file**

Create `packages/frontend/app/admin/content-pipeline/lib/opponents-api.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/data/fetchers/base";

export type Geography = "metro" | "county" | "zip" | "state";
export type Intent = "contrast" | "similar";
export type ContrastMetric =
  | "piq_score"
  | "home_value_yoy"
  | "homeowner_affordability";
export type GeoFilter = "national" | "state";

export interface OpponentCandidate {
  id: string;
  geography: Geography;
  canonicalName: string;
  value: number;
  gap: number;
  population: number | null;
}

export interface OpponentsResult {
  primary: {
    id: string;
    geography: Geography;
    canonicalName: string;
    value: number | null;
  };
  candidates: OpponentCandidate[];
}

export interface FetchOpponentsArgs {
  primaryGeoId: string;
  primaryGeography: Geography;
  intent: Intent;
  metric?: ContrastMetric;
  geoFilter?: GeoFilter;
  limit?: number;
}

export async function fetchOpponents(
  args: FetchOpponentsArgs,
): Promise<OpponentsResult> {
  const params = new URLSearchParams({
    primaryGeoId: args.primaryGeoId,
    primaryGeography: args.primaryGeography,
    intent: args.intent,
  });
  if (args.metric) params.set("metric", args.metric);
  if (args.geoFilter) params.set("geoFilter", args.geoFilter);
  if (args.limit) params.set("limit", String(args.limit));
  const res = await fetchAPI<{ data: OpponentsResult }>(
    `/api/admin/content-pipeline/opponents?${params.toString()}`,
  );
  return res.data;
}

export function useOpponents(args: FetchOpponentsArgs | null) {
  return useQuery({
    queryKey: args
      ? [
          "opponents",
          args.primaryGeoId,
          args.primaryGeography,
          args.intent,
          args.metric,
          args.geoFilter,
          args.limit,
        ]
      : ["opponents", "idle"],
    queryFn: () => fetchOpponents(args!),
    enabled: !!args,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: TypeCheck**

Run: `pnpm --filter frontend tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/lib/opponents-api.ts
git commit -m "feat(content-pipeline): opponents API client + React Query hook"
```

---

### Task 11: Opponent step component

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/opponent-step.tsx`

- [ ] **Step 1: Write the component**

Create `packages/frontend/app/admin/content-pipeline/new/opponent-step.tsx`:

```tsx
"use client";
import { useState } from "react";
import {
  useOpponents,
  type Intent,
  type ContrastMetric,
  type GeoFilter,
  type OpponentCandidate,
  type Geography,
} from "../lib/opponents-api";
import { MarketSearchInput } from "./market-search-input";

interface PrimaryRef {
  id: string;
  geography: Geography;
  canonicalName: string;
}

const METRIC_LABELS: Record<ContrastMetric, string> = {
  piq_score: "PIQ Score",
  home_value_yoy: "YoY Appreciation",
  homeowner_affordability: "Affordability",
};

export function OpponentStep({
  primary,
  onBack,
  onPick,
}: {
  primary: PrimaryRef;
  onBack: () => void;
  onPick: (opponentMarketQuery: string) => void;
}) {
  const [intent, setIntent] = useState<Intent | "search">("contrast");
  const [metric, setMetric] = useState<ContrastMetric>("piq_score");
  const [geoFilter, setGeoFilter] = useState<GeoFilter>("national");
  const [picked, setPicked] = useState<OpponentCandidate | null>(null);

  const args =
    intent === "search"
      ? null
      : {
          primaryGeoId: primary.id,
          primaryGeography: primary.geography,
          intent: intent as Intent,
          metric: intent === "contrast" ? metric : undefined,
          geoFilter: intent === "contrast" ? geoFilter : undefined,
          limit: 5,
        };
  const { data, isLoading } = useOpponents(args);

  const canSubmit = picked != null;

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>
      <h1 className="text-2xl font-semibold mb-2">Pick the opponent</h1>
      <p className="text-sm text-outline mb-6">
        vs <strong>{primary.canonicalName}</strong>
      </p>

      {/* Intent chips */}
      <div className="flex gap-2 mb-4" role="radiogroup">
        {(
          [
            { k: "contrast", label: "Biggest contrast" },
            { k: "similar", label: "Similar peer" },
            { k: "search", label: "Search" },
          ] as const
        ).map((o) => {
          const active = intent === o.k;
          return (
            <button
              key={o.k}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setIntent(o.k);
                setPicked(null);
              }}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${
                active
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface hover:bg-surface-container-high"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {/* Sub-controls */}
      {intent === "contrast" && (
        <div className="flex gap-2 mb-4 items-center">
          <span className="text-xs text-outline uppercase tracking-wide">
            Metric
          </span>
          {(Object.keys(METRIC_LABELS) as ContrastMetric[]).map((m) => {
            const active = metric === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  active
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-low border border-outline-variant"
                }`}
              >
                {METRIC_LABELS[m]}
              </button>
            );
          })}
          <span className="text-xs text-outline uppercase tracking-wide ml-4">
            Pool
          </span>
          <button
            type="button"
            onClick={() =>
              setGeoFilter(geoFilter === "national" ? "state" : "national")
            }
            className="px-3 py-1 rounded-full text-xs font-medium bg-surface-container-low border border-outline-variant"
          >
            {geoFilter === "national" ? "National" : "In-state only"}
          </button>
        </div>
      )}

      {/* Body */}
      {intent === "search" ? (
        <MarketSearchInput
          placeholder="Search for the opponent..."
          autoFocus
          onPick={(m) => {
            setPicked({
              id: m.id,
              geography: m.geography as Geography,
              canonicalName: m.canonical_name,
              value: 0,
              gap: 0,
              population: null,
            });
          }}
        />
      ) : (
        <>
          {isLoading && (
            <div className="text-sm text-outline p-4">Finding opponents…</div>
          )}
          {data && data.candidates.length === 0 && (
            <div className="rounded-xl bg-surface-container-low p-6 text-sm text-outline">
              No candidates. Try a different intent or use Search.
            </div>
          )}
          <div className="space-y-2">
            {data?.candidates.map((c) => {
              const active = picked?.id === c.id;
              const gapStr =
                (c.gap > 0 ? "+" : "") +
                c.gap.toFixed(
                  intent === "contrast" && metric === "home_value_yoy" ? 1 : 0,
                );
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPicked(c)}
                  className={`w-full flex justify-between items-center p-4 rounded-xl text-left transition-colors duration-150 ${
                    active
                      ? "bg-primary text-on-primary"
                      : "bg-surface border border-outline-variant hover:bg-surface-container-low"
                  }`}
                >
                  <span>
                    {active && "✓ "}
                    {c.canonicalName}{" "}
                    <span className="text-xs opacity-70">
                      · {c.value.toFixed(0)}
                    </span>
                  </span>
                  <span
                    className={`text-sm font-semibold ${active ? "" : c.gap < 0 ? "text-error" : "text-tertiary"}`}
                  >
                    {gapStr}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Picked summary */}
      {picked && (
        <div className="mt-6 text-sm">
          Opponent: <strong>{picked.canonicalName}</strong>
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button
          type="button"
          onClick={() => picked && onPick(picked.canonicalName)}
          disabled={!canSubmit}
          className="bg-primary text-on-primary rounded-full px-8 py-3 font-semibold disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeCheck**

Run: `pnpm --filter frontend tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/opponent-step.tsx
git commit -m "feat(content-pipeline): OpponentStep wizard component"
```

---

### Task 12: Wire opponent step into wizard page

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/new/page.tsx`
- Modify: `packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx`
- Modify: `packages/frontend/app/admin/content-pipeline/new/single-market-summary.tsx`
- Modify: `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts`

- [ ] **Step 1: Extend `createRun` payload type**

Edit `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts` — change the `createRun` `payload` type to:

```ts
export async function createRun(payload: {
  format: string;
  marketQuery: string;
  opponentMarketQuery?: string;
  idempotencyKey: string;
  approvalMode?: "auto" | "review" | "draft";
  selectedPlatforms?: string[];
}) {
  // body unchanged — JSON.stringify already serializes opponentMarketQuery if present
```

- [ ] **Step 2: Update wizard page state machine**

Edit `packages/frontend/app/admin/content-pipeline/new/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormatStep } from "./format-step";
import { MarketStep } from "./market-step";
import { OpponentStep } from "./opponent-step";
import { ConfirmStep } from "./confirm-step";
import type { BatchMarket } from "../lib/batch-runs-api";

export type WizardMode = "single" | "batch";
type Step = "format" | "market" | "opponent" | "confirm";

interface PrimaryRef {
  id: string;
  geography: "metro" | "county" | "zip" | "state";
  canonicalName: string;
}

export default function NewRunPage() {
  const [step, setStep] = useState<Step>("format");
  const [format, setFormat] = useState<string>("");
  const [mode, setMode] = useState<WizardMode>("single");
  const [market, setMarket] = useState<string>("");
  const [primaryRef, setPrimaryRef] = useState<PrimaryRef | null>(null);
  const [opponentMarket, setOpponentMarket] = useState<string>("");
  const [batchMarkets, setBatchMarkets] = useState<BatchMarket[]>([]);
  const router = useRouter();

  function handlePickPrimary(canonicalName: string, ref?: PrimaryRef) {
    setMarket(canonicalName);
    if (ref) setPrimaryRef(ref);
    if (format === "head_to_head") setStep("opponent");
    else setStep("confirm");
  }

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
          format={format}
          mode={mode}
          onModeChange={setMode}
          onBack={() => setStep("format")}
          onPickSingle={handlePickPrimary}
          onPickBatch={(markets) => {
            setBatchMarkets(markets);
            setStep("confirm");
          }}
        />
      )}
      {step === "opponent" && primaryRef && (
        <OpponentStep
          primary={primaryRef}
          onBack={() => setStep("market")}
          onPick={(opp) => {
            setOpponentMarket(opp);
            setStep("confirm");
          }}
        />
      )}
      {step === "confirm" && (
        <ConfirmStep
          format={format}
          mode={mode}
          market={market}
          opponentMarket={
            format === "head_to_head" ? opponentMarket : undefined
          }
          batchMarkets={batchMarkets}
          onBack={() =>
            setStep(format === "head_to_head" ? "opponent" : "market")
          }
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

> **Note on `primaryRef`:** the existing `MarketStep.onPickSingle` only emits `canonical_name` (a string). Update its `MarketSearchInput.onPick` callback to also pass the full match object up. Concretely: change `MarketStep`'s `onPickSingle` prop signature to `(canonicalName: string, ref?: PrimaryRef) => void` and pass through from `SingleMarketBody`. (Trivial 5-line patch — make the change in this task to keep the wizard wiring self-contained.)

- [ ] **Step 3: Update ConfirmStep to accept opponent**

Edit `packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx`:

Add `opponentMarket?: string` to the `ConfirmStep` props interface. Pass it to `<SingleMarketSummary>` and into the `createRun` call:

```tsx
const result = await createRun({
  format,
  marketQuery: market,
  opponentMarketQuery: opponentMarket,
  idempotencyKey,
  approvalMode,
  selectedPlatforms,
});
```

- [ ] **Step 4: Update SingleMarketSummary**

Edit `packages/frontend/app/admin/content-pipeline/new/single-market-summary.tsx`:

Accept optional `opponentMarket?: string` prop. When present, render a second market chip beneath the primary with a "vs" label:

```tsx
{
  opponentMarket && (
    <div className="mt-3 text-sm text-outline">
      <span className="opacity-70">vs</span> <strong>{opponentMarket}</strong>
    </div>
  );
}
```

- [ ] **Step 5: TypeCheck**

Run: `pnpm --filter frontend tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Manual smoke test**

Start frontend (`pnpm dev:frontend`) + backend, log in as admin, walk:

1. `/admin/content-pipeline/new`
2. Pick `head_to_head`
3. Search "Tampa" → pick metro
4. Should land on Opponent step. Default intent = Biggest contrast / PIQ Score / National. 5 candidate cards render.
5. Click one → "Next"
6. Confirm step shows both markets. Click "Start Run".
7. Lands on the run detail page. Run begins fetching data.

Expected: no errors, run advances past `fetching_data` to `scripting`. Both markets visible in any debug logs.

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/page.tsx packages/frontend/app/admin/content-pipeline/new/market-step.tsx packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx packages/frontend/app/admin/content-pipeline/new/single-market-summary.tsx packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts
git commit -m "feat(content-pipeline): wire opponent step into 4-step head_to_head wizard"
```

---

## Phase D: End-to-end validation

### Task 13: Probe — verify endpoint returns sane data for 5 metros

**Files:** none (script-only smoke check)

- [ ] **Step 1: Pick 5 representative metros and curl the endpoint**

For each of: Tampa (45300), Cleveland (17460), Austin (12420), Detroit (19820), Charlotte (16740):

```bash
curl -s "http://localhost:3001/api/admin/content-pipeline/opponents?primaryGeoId=<CBSA>&primaryGeography=metro&intent=contrast&metric=piq_score&geoFilter=national&limit=5" \
  -H "Authorization: Bearer $JWT" | jq '.data.candidates[] | {name:.canonicalName, gap}'
```

Expected: 5 candidates each, gaps are signed numbers, top candidate has the largest absolute gap. If any return empty: investigate before moving to Task 14 — Playwright will fail on the same root cause and waste time.

- [ ] **Step 2: Repeat for `intent=similar`**

```bash
curl -s "http://localhost:3001/api/admin/content-pipeline/opponents?primaryGeoId=45300&primaryGeography=metro&intent=similar&limit=5" \
  -H "Authorization: Bearer $JWT" | jq .
```

Expected: candidates only from FL, populations within ±25% of Tampa's. If empty for Tampa, the spec says we accept that — but check Austin (TX) too. If both empty, the population band may be too tight; flag for follow-up but don't block on it.

(No commit; this is a verification gate.)

---

### Task 14: Playwright destination-gate validation

**Files:**

- Create: `scripts/validate-head-to-head-wizard.mjs`

- [ ] **Step 1: Write the validation script**

Create `scripts/validate-head-to-head-wizard.mjs`. Model it on `scripts/validate-batch-wizard.mjs` (read it first for the auth + waiting patterns; reuse them).

The script must:

1. Launch Playwright headless against `http://localhost:3000` (or `STAGING_URL` env).
2. Sign in as admin (use the existing helper in the batch validator).
3. Navigate to `/admin/content-pipeline/new`.
4. Click the `Head-to-head` format card.
5. Type "Tampa" in the primary search, click the first match.
6. On the opponent step, default chips should be active. Click the first candidate card.
7. Click `Next`, then `Start Run` on confirm.
8. Capture the run ID from the redirect URL.
9. Poll the run detail page (or the `/runs/:id` API endpoint) every 10s until status is `published`, `published_partial`, `ready_for_review`, or `failed`. Timeout 15 minutes.
10. If terminal status is success, query Supabase MCP for the `mcp_payload` row and assert `metadata.primary` AND `metadata.secondary` exist.
11. Print the rendered video URL (signed) and the YouTube URL (if published).
12. Exit 0 on full success; exit non-zero with diagnostics on any failure.

- [ ] **Step 2: Run the validator**

Run: `node scripts/validate-head-to-head-wizard.mjs`

Expected: green output with both market names, a video URL, and (if approval-mode=auto) a YouTube URL. Per the `feedback_e2e-validation-real-output` rule, "done" means a real rendered video on disk plus the metadata assertion — not just an API 200.

- [ ] **Step 3: Iterate until green**

If the script fails:

- Read the failure mode (status, last poll output).
- Inspect the run via the admin UI.
- Fix the underlying issue (do NOT bypass the gate).
- Re-run.

- [ ] **Step 4: Commit**

```bash
git add scripts/validate-head-to-head-wizard.mjs
git commit -m "test(content-pipeline): destination-gate validator for head_to_head wizard"
```

---

### Task 15: Final sweep — full test run, build, lint

- [ ] **Step 1: Run all backend tests**

Run: `pnpm --filter backend test`
Expected: green.

- [ ] **Step 2: Run frontend type-check + lint**

Run: `pnpm --filter frontend tsc --noEmit && pnpm --filter frontend lint`
Expected: clean.

- [ ] **Step 3: Build everything**

Run: `pnpm build`
Expected: green across all packages.

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/content-pipeline-p3-ranking
```

(Only push when all gates above are green. Do not skip hooks.)

---

## Out of scope (do not implement)

These were listed in the spec under non-goals; no task implements them, by design:

- Batch mode for `head_to_head` (single only in v1).
- Migration-narrative intent.
- Strategy-contrast intent.
- Cashflow contrast metric.
- Run detail page two-market display polish (acknowledged v2 follow-up).

If a verifier asks "where's the batch task for head_to_head", point at the spec's non-goals section.
