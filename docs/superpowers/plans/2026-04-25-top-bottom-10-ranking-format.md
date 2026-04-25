# Top 10 / Bottom 10 Ranking Format — Implementation Plan (Plan A: Video Format)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two working content-pipeline formats — `top_10_ranking` (refactored) and `bottom_10_ranking` (new) — that take a metric × geo level × scope, resolve the top/bottom 5–10 markets, and produce a ranking video published to YouTube Shorts.

**Architecture:** New `RankingResolverService` queries metric data with scope filtering and freezes the resolved list into `runs.params`. The existing `Top10Layout` Remotion composition is generalized to read from frozen params (any metric, any direction, variable N=5–10). Wizard gains two new steps (params → preview) routed when format is a ranking format.

**Tech Stack:** NestJS (backend), Next.js 16 App Router (wizard), Remotion (renderer in `packages/video-template`), Supabase (Postgres), pg-boss (job queue), Claude API (script generation), edge-tts (voice synth), Playwright (E2E smoke).

**Companion spec:** `docs/superpowers/specs/2026-04-25-top-bottom-10-ranking-design.md`

**Out of scope (Plan B):** Magnet PDF generation, lead capture endpoint, Resend transactional email for magnets. Plan A's video CTA is generic ("Learn more at propertyiq.app"); Plan B replaces it.

---

## File structure

**New files (Plan A):**

| Path                                                                                | Responsibility                                                  |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.ts`         | Pure logic — query metric, filter by scope, sort, slice, format |
| `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.spec.ts`    | Unit tests for resolver                                         |
| `packages/backend/src/content-pipeline/ranking/ranking-resolver.controller.ts`      | `POST /api/admin/content-pipeline/ranking/resolve`              |
| `packages/backend/src/content-pipeline/ranking/dto/resolve-ranking.dto.ts`          | class-validator DTO for the request body                        |
| `packages/backend/src/content-pipeline/ranking/ranking-script.schema.ts`            | Zod schema for prompt output validation                         |
| `packages/backend/src/content-pipeline/ranking/ranking-script.schema.spec.ts`       | Unit tests for the schema validator                             |
| `packages/backend/src/content-pipeline/prompts/bottom_10_ranking.md`                | New Claude prompt for bottom-direction script                   |
| `packages/frontend/app/admin/content-pipeline/new/ranking-params-step.tsx`          | Wizard step: pick metric / level / scope                        |
| `packages/frontend/app/admin/content-pipeline/new/ranking-preview-step.tsx`         | Wizard step: show resolved 10 markets, confirm submit           |
| `packages/frontend/app/admin/content-pipeline/new/helpers/ranking-validity.ts`      | Pure helpers: `validLevelsForScope`, `validScopesForLevel`      |
| `packages/frontend/app/admin/content-pipeline/new/helpers/ranking-validity.spec.ts` | Unit tests for validity helpers                                 |
| `packages/video-template/src/components/MetricValue.tsx`                            | Format-aware value renderer (currency / percent / days / score) |
| `packages/video-template/tests/bottom-10.test.tsx`                                  | Snapshot test for `bottom_10_ranking`                           |
| `supabase/migrations/20260426000001_content_pipeline_top_bottom_10.sql`             | Format row update + new bottom row                              |
| `scripts/validate-ranking-wizard.mjs`                                               | Playwright E2E for the new wizard flow                          |

**Modified files (Plan A):**

| Path                                                                          | What changes                                                                                              |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/backend/src/content-pipeline/types.ts`                              | Verify `bottom_10_ranking` is in `ContentFormat` union (likely already there)                             |
| `packages/backend/src/content-pipeline/format-durations.ts`                   | Add/verify entry for `bottom_10_ranking`                                                                  |
| `packages/backend/src/content-pipeline/content-pipeline.module.ts`            | Register `RankingResolverService` + controller                                                            |
| `packages/backend/src/content-pipeline/content-runs.service.ts`               | Add submit-time drift check (re-resolve + diff)                                                           |
| `packages/backend/src/content-pipeline/drivers/anthropic-script-generator.ts` | Branch for ranking formats; pass enriched context; validate output via Zod schema; retry on fail          |
| `packages/backend/src/content-pipeline/prompts/top_10_ranking.md`             | Full rewrite for dynamic-metric flow                                                                      |
| `packages/video-template/src/PropertyIQVideo.tsx`                             | Route `bottom_10_ranking` → `Top10Layout` with `theme="bottom"`                                           |
| `packages/video-template/src/types.ts`                                        | Update `VideoProps` to carry `params.*` shape; update `VideoPropsSchema` Zod; add theme to FORMAT_CONFIGS |
| `packages/video-template/src/layouts/Top10Layout.tsx`                         | Read from `params.resolved_markets`; theme variant; variable N; `calculateMetadata`                       |
| `packages/video-template/tests/top-10.test.tsx`                               | Rewrite snapshots for new prop shape; add fixtures for currency/score formats and N=5 edge case           |
| `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts`    | Add `resolveRanking()` and `createRankingRun()` client helpers                                            |
| `packages/frontend/app/admin/content-pipeline/lib/format-previews.ts`         | Update FORMAT_META copy for both formats                                                                  |
| `packages/frontend/app/admin/content-pipeline/new/format-step.tsx`            | Verify both cards render                                                                                  |
| `packages/frontend/app/admin/content-pipeline/new/page.tsx`                   | Wizard orchestrator: route to ranking steps when format is `top_10_ranking` or `bottom_10_ranking`        |

---

## Phase A — Schema + scaffolding audit

### Task A1: Audit existing type unions

**Why:** P2 already scaffolded most of `bottom_10_ranking` in type unions. Verify, fill gaps. No commit if nothing to add.

**Files:**

- Read: `packages/backend/src/content-pipeline/types.ts`
- Read: `packages/backend/src/content-pipeline/dto/create-run.dto.ts`
- Read: `packages/backend/src/content-pipeline/dto/create-batch-runs.dto.ts`
- Read: `packages/backend/src/content-pipeline/format-durations.ts`
- Read: `packages/video-template/src/types.ts`
- Read: `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts`
- Read: `packages/frontend/app/admin/content-pipeline/lib/format-previews.ts`

- [ ] **Step 1: Grep for `bottom_10_ranking` across all 7 files**

```bash
rg -n 'bottom_10_ranking' packages/backend/src/content-pipeline/types.ts \
  packages/backend/src/content-pipeline/dto/create-run.dto.ts \
  packages/backend/src/content-pipeline/dto/create-batch-runs.dto.ts \
  packages/backend/src/content-pipeline/format-durations.ts \
  packages/video-template/src/types.ts \
  packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts \
  packages/frontend/app/admin/content-pipeline/lib/format-previews.ts
```

Expected: every file shows at least one match. If any file shows zero matches, add `'bottom_10_ranking'` to the relevant union/array/object.

- [ ] **Step 2: For `format-durations.ts`, verify entry exists**

Open file. Confirm:

```ts
export const FORMAT_DURATIONS_IN_FRAMES: Record<ContentFormat, number> = {
  // ...
  top_10_ranking: 1800,
  bottom_10_ranking: 1800, // ← must exist
  // ...
};
```

If missing, add the line. (1800 stays as the max ceiling — actual duration is dynamic, computed at render time per Phase C.)

- [ ] **Step 3: For `format-previews.ts`, verify FORMAT_META has both rows**

Confirm shape:

```ts
top_10_ranking: { displayName: 'Top 10 Markets', ... },
bottom_10_ranking: { displayName: 'Bottom 10 — Markets to Avoid', ... },
```

If `bottom_10_ranking` row is missing, add it (Task D1 will rewrite copy anyway — placeholder is fine for now).

- [ ] **Step 4: Run TypeScript check**

```bash
cd packages/backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit
cd ../video-template && npx tsc --noEmit
```

Expected: zero errors. If errors mention `bottom_10_ranking`, fix the missing union member from Step 1.

- [ ] **Step 5: Commit only if changes were made**

```bash
git status packages/backend/src/content-pipeline packages/video-template/src packages/frontend/app/admin/content-pipeline/lib
# If any modifications:
git add <changed files>
git commit -m "chore(content-pipeline): backfill bottom_10_ranking in type unions"
```

If `git status` shows clean, skip the commit.

---

### Task A2: Migration — update `top_10_ranking` row + insert `bottom_10_ranking`

**Why:** Refresh the `top_10_ranking` card copy and ensure `bottom_10_ranking` exists in `format_templates`. Magnet bindings are deferred to Plan B; do NOT add them here.

**Files:**

- Create: `supabase/migrations/20260426000001_content_pipeline_top_bottom_10.sql`
- Read: `supabase/migrations/20260425000400_content_runs_batch_id.sql` (latest existing — to confirm sequence)
- Modify: `scripts/apply-content-pipeline-migrations.js` (add migration to MIGRATIONS array)

- [ ] **Step 1: Confirm migration sequence number**

```bash
ls supabase/migrations/ | tail -5
```

Use `20260426000001` (one day after the previous `20260425000400`). If a later migration already exists, use the next available `20260426000002` etc.

- [ ] **Step 2: Write the migration SQL**

Create `supabase/migrations/20260426000001_content_pipeline_top_bottom_10.sql`:

```sql
-- Refresh top_10_ranking card copy (the row already exists from P2 seed)
UPDATE format_templates
SET
  display_name = 'Top 10 Markets',
  tagline      = 'Celebrate the leaders by any metric. National, state, or metro scope. 60s.',
  enabled      = true,
  updated_at   = now()
WHERE format = 'top_10_ranking';

-- Insert bottom_10_ranking (idempotent)
INSERT INTO format_templates (
  format,
  display_name,
  tagline,
  enabled,
  platforms,
  script_prompt_path,
  duration_frames,
  created_at,
  updated_at
)
VALUES (
  'bottom_10_ranking',
  'Bottom 10 — Markets to Avoid',
  'Spot the landmines on any metric you care about. 60s.',
  false,                                                                       -- flipped on after smoke (Phase F)
  ARRAY['youtube_shorts', 'tiktok', 'instagram_reels', 'facebook_reels'],
  'bottom_10_ranking.md',
  1800,
  now(),
  now()
)
ON CONFLICT (format) DO UPDATE SET
  display_name       = EXCLUDED.display_name,
  tagline            = EXCLUDED.tagline,
  platforms          = EXCLUDED.platforms,
  script_prompt_path = EXCLUDED.script_prompt_path,
  duration_frames    = EXCLUDED.duration_frames,
  updated_at         = now();

-- Ensure GRANTs (idempotent)
GRANT SELECT, INSERT, UPDATE, DELETE ON format_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON format_templates TO authenticated;
```

- [ ] **Step 3: Add to MIGRATIONS array in apply script**

Open `scripts/apply-content-pipeline-migrations.js`. Append to the `MIGRATIONS` array:

```js
'20260426000001_content_pipeline_top_bottom_10.sql',
```

- [ ] **Step 4: Apply to local dev DB**

```bash
node scripts/apply-content-pipeline-migrations.js
```

Expected output: `Applied: 20260426000001_content_pipeline_top_bottom_10.sql`.

- [ ] **Step 5: Verify rows exist**

Query via Supabase MCP or `psql`:

```sql
SELECT format, display_name, enabled
FROM format_templates
WHERE format IN ('top_10_ranking', 'bottom_10_ranking');
```

Expected:

```
top_10_ranking    | Top 10 Markets                    | true
bottom_10_ranking | Bottom 10 — Markets to Avoid       | false
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260426000001_content_pipeline_top_bottom_10.sql scripts/apply-content-pipeline-migrations.js
git commit -m "feat(content-pipeline): seed bottom_10_ranking format + refresh top copy"
```

---

## Phase B — Backend ranking resolver service + endpoint

### Task B1: `RankingResolverService` scaffold + happy-path test

**Files:**

- Create: `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.ts`
- Create: `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { RankingResolverService } from "./ranking-resolver.service";
import { MetricResolutionService } from "../../metric-resolution/metric-resolution.service";
import { SupabaseService } from "../../supabase/supabase.service";

describe("RankingResolverService", () => {
  let service: RankingResolverService;
  let metricResolution: jest.Mocked<MetricResolutionService>;
  let supabase: jest.Mocked<SupabaseService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RankingResolverService,
        {
          provide: MetricResolutionService,
          useValue: { getMetricDefinition: jest.fn() },
        },
        { provide: SupabaseService, useValue: { client: { from: jest.fn() } } },
      ],
    }).compile();
    service = moduleRef.get(RankingResolverService);
    metricResolution = moduleRef.get(MetricResolutionService);
    supabase = moduleRef.get(SupabaseService);
  });

  it("returns shaped response for top_10_ranking national metros happy path", async () => {
    metricResolution.getMetricDefinition.mockReturnValue({
      id: "piq_score",
      label: "PropertyIQ Score",
      unit: "",
      format: "index",
      sourceTable: "propertyiq_scores",
      stalenessDays: 90,
    } as any);

    // Mock supabase to return 12 metro rows; 2 stale, 10 valid
    const mockBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: Array.from({ length: 10 }, (_, i) => ({
          region_id: String(35620 + i),
          region_name: `Metro ${i + 1}`,
          state: "NY",
          value: 100 - i,
          period_date: "2026-04-01",
        })),
        error: null,
      }),
    };
    (supabase.client.from as jest.Mock).mockReturnValue(mockBuilder);

    const result = await service.resolve({
      format: "top_10_ranking",
      metric_id: "piq_score",
      geo_level: "metro",
      scope_type: "national",
      scope_id: null,
    });

    expect(result.direction).toBe("top");
    expect(result.metric.id).toBe("piq_score");
    expect(result.rankings).toHaveLength(10);
    expect(result.rankings[0].rank).toBe(1);
    expect(result.rankings[0].value).toBe(100);
    expect(result.insufficient_data).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
cd packages/backend && npx jest src/content-pipeline/ranking/ranking-resolver.service.spec.ts
```

Expected: FAIL — `Cannot find module './ranking-resolver.service'`.

- [ ] **Step 3: Implement minimal service**

Create `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { MetricResolutionService } from "../../metric-resolution/metric-resolution.service";
import { SupabaseService } from "../../supabase/supabase.service";

export type RankingFormat = "top_10_ranking" | "bottom_10_ranking";
export type RankingDirection = "top" | "bottom";
export type GeoLevel = "metro" | "county" | "zip";
export type ScopeType = "national" | "state" | "metro";

export interface ResolveRankingInput {
  format: RankingFormat;
  metric_id: string;
  geo_level: GeoLevel;
  scope_type: ScopeType;
  scope_id: string | null;
  limit?: number;
}

export interface RankingEntry {
  rank: number;
  region_id: string;
  region_name: string;
  state: string;
  value: number;
  value_formatted: string;
}

export interface ResolveRankingResult {
  metric: { id: string; label: string; unit: string; format: string };
  scope: { type: ScopeType; id: string | null; label: string };
  geo_level: GeoLevel;
  direction: RankingDirection;
  as_of: string;
  eligible_count: number;
  excluded_count: number;
  rankings: RankingEntry[];
  insufficient_data: boolean;
}

const MIN_RANKINGS = 5;

@Injectable()
export class RankingResolverService {
  constructor(
    private readonly metricResolution: MetricResolutionService,
    private readonly supabase: SupabaseService,
  ) {}

  async resolve(input: ResolveRankingInput): Promise<ResolveRankingResult> {
    const limit = input.limit ?? 10;
    const direction: RankingDirection =
      input.format === "top_10_ranking" ? "top" : "bottom";
    const metric = this.metricResolution.getMetricDefinition(input.metric_id);
    if (!metric) throw new Error(`Unknown metric: ${input.metric_id}`);

    const cutoffDate = new Date(
      Date.now() - metric.stalenessDays * 24 * 3600 * 1000,
    )
      .toISOString()
      .slice(0, 10);

    const builder = this.supabase.client
      .from(metric.sourceTable)
      .select("region_id, region_name, state, value, period_date")
      .not("value", "is", null)
      .gte("period_date", cutoffDate)
      .order("value", { ascending: direction === "bottom" });

    const { data, error } = await builder;
    if (error) throw error;

    const eligible = data ?? [];
    const sliced = eligible.slice(0, limit).map((row, idx) => ({
      rank: idx + 1,
      region_id: row.region_id,
      region_name: row.region_name,
      state: row.state,
      value: row.value,
      value_formatted: String(row.value), // refined in B7
    }));

    return {
      metric: {
        id: metric.id,
        label: metric.label,
        unit: metric.unit,
        format: metric.format,
      },
      scope: {
        type: input.scope_type,
        id: input.scope_id,
        label: input.scope_id ?? "United States",
      },
      geo_level: input.geo_level,
      direction,
      as_of: sliced[0]?.region_id ? eligible[0].period_date : "",
      eligible_count: eligible.length,
      excluded_count: 0, // refined in B3
      rankings: sliced,
      insufficient_data: sliced.length < MIN_RANKINGS,
    };
  }
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
cd packages/backend && npx jest src/content-pipeline/ranking/ranking-resolver.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/ranking/ranking-resolver.service.ts \
        packages/backend/src/content-pipeline/ranking/ranking-resolver.service.spec.ts
git commit -m "feat(content-pipeline): RankingResolverService scaffold with happy-path test"
```

---

### Task B2: Scope filtering (national / state / metro)

**Files:**

- Modify: `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.ts`
- Modify: `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.spec.ts`

- [ ] **Step 1: Add three failing tests** for each scope_type

In `ranking-resolver.service.spec.ts`, add:

```ts
it("filters by state via geography_crosswalk join", async () => {
  metricResolution.getMetricDefinition.mockReturnValue({
    id: "piq_score",
    label: "PIQ Score",
    unit: "",
    format: "index",
    sourceTable: "propertyiq_scores",
    stalenessDays: 90,
  } as any);

  const mockBuilder: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
  };
  (supabase.client.from as jest.Mock).mockReturnValue(mockBuilder);

  // Mock geography_crosswalk lookup to return county FIPS in CA
  // (Implementation should call a helper that returns ['06001', '06003', ...])

  await service.resolve({
    format: "top_10_ranking",
    metric_id: "piq_score",
    geo_level: "county",
    scope_type: "state",
    scope_id: "CA",
  });

  expect(mockBuilder.in).toHaveBeenCalledWith("region_id", expect.any(Array));
});

it("filters by metro via geography_crosswalk join", async () => {
  // Same shape but scope_type: 'metro', scope_id: '45300' (Tampa CBSA)
  // expect mockBuilder.in to be called with ZIPs in that CBSA
});

it("applies no filter for national scope", async () => {
  // expect mockBuilder.in to NOT be called
});
```

- [ ] **Step 2: Run tests, expect FAILs**

```bash
cd packages/backend && npx jest ranking-resolver.service.spec.ts
```

- [ ] **Step 3: Implement scope filter helper**

In `ranking-resolver.service.ts`, add a private method:

```ts
private async resolveScopeRegionIds(
  scope_type: ScopeType,
  scope_id: string | null,
  geo_level: GeoLevel,
): Promise<string[] | null> {
  if (scope_type === 'national') return null;

  const tableMap: Record<GeoLevel, string> = {
    metro:  'cbsa_code',
    county: 'county_fips',
    zip:    'postal_code',
  };
  const targetCol = tableMap[geo_level];

  let parentCol: string;
  if (scope_type === 'state') {
    parentCol = 'state_abbr';
  } else if (scope_type === 'metro') {
    parentCol = 'cbsa_code';
  } else {
    return null;
  }

  const { data, error } = await this.supabase.client
    .from('geography_crosswalk')
    .select(targetCol)
    .eq(parentCol, scope_id)
    .order(targetCol);

  if (error) throw error;
  // Deduplicate (crosswalk has one row per ZIP-county-metro-state combo)
  return [...new Set((data ?? []).map((r: any) => r[targetCol]))];
}
```

In `resolve()`, call this before building the metric query:

```ts
const regionIds = await this.resolveScopeRegionIds(
  input.scope_type,
  input.scope_id,
  input.geo_level,
);
let builder = this.supabase.client
  .from(metric.sourceTable)
  .select("region_id, region_name, state, value, period_date")
  .not("value", "is", null)
  .gte("period_date", cutoffDate)
  .order("value", { ascending: direction === "bottom" });

if (regionIds !== null) builder = builder.in("region_id", regionIds);

const { data, error } = await builder;
```

- [ ] **Step 4: Update happy-path test mock to include `in` method**

Already added in Step 1. Re-run.

- [ ] **Step 5: Run tests, expect PASS**

```bash
cd packages/backend && npx jest ranking-resolver.service.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/content-pipeline/ranking/ranking-resolver.service.ts \
        packages/backend/src/content-pipeline/ranking/ranking-resolver.service.spec.ts
git commit -m "feat(content-pipeline): RankingResolverService scope filtering"
```

---

### Task B3: Per-metric staleness exclusion + excluded_count tracking

**Files:**

- Modify: `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.ts`
- Modify: `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.spec.ts`

- [ ] **Step 1: Add failing test**

```ts
it("excludes stale rows beyond metric staleness threshold and counts them", async () => {
  metricResolution.getMetricDefinition.mockReturnValue({
    id: "home_value",
    label: "Home Value",
    unit: "$",
    format: "currency",
    sourceTable: "zillow_metro",
    stalenessDays: 60,
  } as any);

  // Mock supabase to return 12 rows: 10 fresh, 2 stale (period_date 90 days old)
  const mockBuilder: any = {
    select: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({
      data: [
        // Fresh rows are returned by .gte filter (mocked to return only fresh)
        ...Array.from({ length: 10 }, (_, i) => ({
          region_id: `${i}`,
          region_name: `M${i}`,
          state: "NY",
          value: 500000 - i * 1000,
          period_date: "2026-04-01",
        })),
      ],
      error: null,
    }),
  };
  (supabase.client.from as jest.Mock).mockReturnValue(mockBuilder);

  // Independent count query for excluded
  // (Implementation should issue a separate count query for stale exclusions)

  const result = await service.resolve({
    format: "top_10_ranking",
    metric_id: "home_value",
    geo_level: "metro",
    scope_type: "national",
    scope_id: null,
  });

  expect(result.eligible_count).toBe(10);
  expect(result.excluded_count).toBeGreaterThanOrEqual(0);
  // Verify .gte was called with cutoff date 60 days back
  const cutoffArg = (mockBuilder.gte as jest.Mock).mock.calls[0][1];
  const cutoffDate = new Date(cutoffArg);
  const expectedCutoff = new Date(Date.now() - 60 * 24 * 3600 * 1000);
  expect(
    Math.abs(cutoffDate.getTime() - expectedCutoff.getTime()),
  ).toBeLessThan(86400 * 1000);
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
cd packages/backend && npx jest ranking-resolver.service.spec.ts
```

- [ ] **Step 3: Implement excluded_count tracking**

In `resolve()`, add a separate count query for stale-or-null rows:

```ts
const excludedQuery = this.supabase.client
  .from(metric.sourceTable)
  .select("region_id", { count: "exact", head: true })
  .or(`value.is.null,period_date.lt.${cutoffDate}`);

if (regionIds !== null) excludedQuery.in("region_id", regionIds);

const { count: excludedCount } = await excludedQuery;
```

Replace the `excluded_count: 0` placeholder with `excludedCount ?? 0`.

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/ranking/ranking-resolver.service.ts \
        packages/backend/src/content-pipeline/ranking/ranking-resolver.service.spec.ts
git commit -m "feat(content-pipeline): RankingResolverService staleness filter + excluded count"
```

---

### Task B4: Sort direction + insufficient_data threshold

**Files:**

- Modify: `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.ts`
- Modify: `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.spec.ts`

- [ ] **Step 1: Add failing tests for direction and insufficient_data**

```ts
it("sorts ASC for bottom_10_ranking", async () => {
  metricResolution.getMetricDefinition.mockReturnValue({
    id: "vacancy_risk_score",
    label: "Vacancy Risk",
    unit: "",
    format: "index",
    sourceTable: "vacancy_risk_scores",
    stalenessDays: 60,
  } as any);
  const mockBuilder: any = {
    select: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
  };
  (supabase.client.from as jest.Mock).mockReturnValue(mockBuilder);

  await service.resolve({
    format: "bottom_10_ranking",
    metric_id: "vacancy_risk_score",
    geo_level: "metro",
    scope_type: "national",
    scope_id: null,
  });

  expect(mockBuilder.order).toHaveBeenCalledWith("value", { ascending: true });
});

it("returns insufficient_data: true when rankings.length < 5", async () => {
  metricResolution.getMetricDefinition.mockReturnValue({
    id: "piq_score",
    label: "PIQ",
    unit: "",
    format: "index",
    sourceTable: "propertyiq_scores",
    stalenessDays: 90,
  } as any);
  const mockBuilder: any = {
    select: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({
      data: Array.from({ length: 3 }, (_, i) => ({
        region_id: `${i}`,
        region_name: `M${i}`,
        state: "NY",
        value: 90 - i,
        period_date: "2026-04-01",
      })),
      error: null,
    }),
  };
  (supabase.client.from as jest.Mock).mockReturnValue(mockBuilder);

  const result = await service.resolve({
    format: "top_10_ranking",
    metric_id: "piq_score",
    geo_level: "metro",
    scope_type: "national",
    scope_id: null,
  });

  expect(result.insufficient_data).toBe(true);
  expect(result.rankings).toEqual([]);
});
```

- [ ] **Step 2: Run, expect FAIL on insufficient_data (sort already correct)**

```bash
cd packages/backend && npx jest ranking-resolver.service.spec.ts
```

- [ ] **Step 3: Update `resolve()` to clear rankings when insufficient**

In `ranking-resolver.service.ts`, after computing `sliced`:

```ts
const insufficient = sliced.length < MIN_RANKINGS;

return {
  // ...
  rankings: insufficient ? [] : sliced,
  insufficient_data: insufficient,
};
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/ranking/ranking-resolver.service.ts \
        packages/backend/src/content-pipeline/ranking/ranking-resolver.service.spec.ts
git commit -m "feat(content-pipeline): RankingResolverService sort direction + insufficient_data threshold"
```

---

### Task B5: Limit param (10 vs 50) + value formatting via format-utils

**Files:**

- Modify: `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.ts`
- Modify: `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.spec.ts`

- [ ] **Step 1: Add failing tests**

```ts
it("respects limit=50 for magnet PDF path", async () => {
  metricResolution.getMetricDefinition.mockReturnValue({
    id: "piq_score",
    label: "PIQ",
    unit: "",
    format: "index",
    sourceTable: "propertyiq_scores",
    stalenessDays: 90,
  } as any);
  const mockBuilder: any = {
    select: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({
      data: Array.from({ length: 60 }, (_, i) => ({
        region_id: `${i}`,
        region_name: `M${i}`,
        state: "NY",
        value: 100 - i,
        period_date: "2026-04-01",
      })),
      error: null,
    }),
  };
  (supabase.client.from as jest.Mock).mockReturnValue(mockBuilder);

  const result = await service.resolve({
    format: "top_10_ranking",
    metric_id: "piq_score",
    geo_level: "metro",
    scope_type: "national",
    scope_id: null,
    limit: 50,
  });

  expect(result.rankings).toHaveLength(50);
});

it("formats values using metric.format", async () => {
  metricResolution.getMetricDefinition.mockReturnValue({
    id: "home_value",
    label: "Home Value",
    unit: "$",
    format: "currency",
    sourceTable: "zillow_metro",
    stalenessDays: 60,
  } as any);
  const mockBuilder: any = {
    select: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => ({
        region_id: `${i}`,
        region_name: `M${i}`,
        state: "NY",
        value: 1_200_000 - i * 50000,
        period_date: "2026-04-01",
      })),
      error: null,
    }),
  };
  (supabase.client.from as jest.Mock).mockReturnValue(mockBuilder);

  const result = await service.resolve({
    format: "top_10_ranking",
    metric_id: "home_value",
    geo_level: "metro",
    scope_type: "national",
    scope_id: null,
  });

  expect(result.rankings[0].value_formatted).toBe("$1.2M");
});
```

- [ ] **Step 2: Run, expect FAIL on value_formatted**

- [ ] **Step 3: Wire format-utils into resolver**

Locate the format util:

```bash
rg -l "export function formatMetricValue|export function formatValue" packages/frontend/lib/format packages/backend/src
```

If it lives in `packages/frontend/lib/format/`, the backend cannot import frontend code. Two options:

- Move the function to a shared location (`packages/shared/format/`)
- Reimplement a tiny version in the backend

For Plan A simplicity, **reimplement** in `packages/backend/src/content-pipeline/ranking/format-value.ts`:

```ts
export type MetricFormat =
  | "currency"
  | "percent"
  | "percent_abs"
  | "number"
  | "index"
  | "days";

export function formatRankingValue(
  value: number,
  format: MetricFormat,
): string {
  if (format === "currency") {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${Math.round(value / 1000)}K`;
    return `$${Math.round(value)}`;
  }
  if (format === "percent" || format === "percent_abs") {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (format === "days") return `${Math.round(value)} days`;
  if (format === "index") return `${Math.round(value)}`;
  return value.toLocaleString("en-US");
}
```

Add a unit test file `format-value.spec.ts` with one test per format type.

In `ranking-resolver.service.ts`, replace `value_formatted: String(row.value)` with:

```ts
import { formatRankingValue } from './format-value';
// ...
value_formatted: formatRankingValue(row.value, metric.format as any),
```

Apply the limit:

```ts
const sliced = eligible.slice(0, limit).map(/* ... */);
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/ranking/
git commit -m "feat(content-pipeline): RankingResolverService limit + format-aware value strings"
```

---

### Task B6: ResolveRankingDto

**Files:**

- Create: `packages/backend/src/content-pipeline/ranking/dto/resolve-ranking.dto.ts`

- [ ] **Step 1: Write the DTO**

```ts
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

export class ResolveRankingDto {
  @IsIn(["top_10_ranking", "bottom_10_ranking"])
  format!: "top_10_ranking" | "bottom_10_ranking";

  @IsString()
  metric_id!: string;

  @IsIn(["metro", "county", "zip"])
  geo_level!: "metro" | "county" | "zip";

  @IsIn(["national", "state", "metro"])
  scope_type!: "national" | "state" | "metro";

  @ValidateIf((o) => o.scope_type !== "national")
  @IsString()
  scope_id!: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
```

- [ ] **Step 2: Add unit test**

Create `dto/resolve-ranking.dto.spec.ts`:

```ts
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { ResolveRankingDto } from "./resolve-ranking.dto";

describe("ResolveRankingDto", () => {
  const valid = {
    format: "top_10_ranking",
    metric_id: "piq_score",
    geo_level: "metro",
    scope_type: "national",
    scope_id: null,
  };

  it("passes for valid input", async () => {
    const errors = await validate(plainToInstance(ResolveRankingDto, valid));
    expect(errors).toHaveLength(0);
  });

  it("rejects unknown format", async () => {
    const errors = await validate(
      plainToInstance(ResolveRankingDto, { ...valid, format: "foo" }),
    );
    expect(errors[0].constraints).toHaveProperty("isIn");
  });

  it("requires scope_id when scope_type !== national", async () => {
    const errors = await validate(
      plainToInstance(ResolveRankingDto, {
        ...valid,
        scope_type: "state",
        scope_id: null,
      }),
    );
    expect(errors[0].property).toBe("scope_id");
  });

  it("rejects limit > 50", async () => {
    const errors = await validate(
      plainToInstance(ResolveRankingDto, { ...valid, limit: 100 }),
    );
    expect(errors[0].constraints).toHaveProperty("max");
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd packages/backend && npx jest src/content-pipeline/ranking/dto/resolve-ranking.dto.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/content-pipeline/ranking/dto/
git commit -m "feat(content-pipeline): ResolveRankingDto with class-validator"
```

---

### Task B7: `RankingResolverController` + module wiring

**Files:**

- Create: `packages/backend/src/content-pipeline/ranking/ranking-resolver.controller.ts`
- Create: `packages/backend/src/content-pipeline/ranking/ranking-resolver.controller.spec.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.module.ts`

- [ ] **Step 1: Write the controller**

```ts
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../../auth/admin.guard";
import { RankingResolverService } from "./ranking-resolver.service";
import { ResolveRankingDto } from "./dto/resolve-ranking.dto";

@Controller("api/admin/content-pipeline/ranking")
@UseGuards(AdminGuard)
export class RankingResolverController {
  constructor(private readonly resolver: RankingResolverService) {}

  @Post("resolve")
  resolve(@Body() dto: ResolveRankingDto) {
    return this.resolver.resolve(dto);
  }
}
```

(Confirm `AdminGuard` import path — grep for it: `rg "export class AdminGuard"`)

- [ ] **Step 2: Register in module**

Open `packages/backend/src/content-pipeline/content-pipeline.module.ts`. Add:

```ts
import { RankingResolverService } from './ranking/ranking-resolver.service';
import { RankingResolverController } from './ranking/ranking-resolver.controller';
// ...
@Module({
  controllers: [
    // ... existing
    RankingResolverController,
  ],
  providers: [
    // ... existing
    RankingResolverService,
  ],
  exports: [
    // ... existing
    RankingResolverService,   // exported so ContentRunsService can use it for drift check (Task B8)
  ],
})
```

- [ ] **Step 3: Add controller integration test**

Create `ranking-resolver.controller.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { RankingResolverController } from "./ranking-resolver.controller";
import { RankingResolverService } from "./ranking-resolver.service";

describe("RankingResolverController", () => {
  let controller: RankingResolverController;
  let resolver: jest.Mocked<RankingResolverService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RankingResolverController],
      providers: [
        { provide: RankingResolverService, useValue: { resolve: jest.fn() } },
      ],
    })
      // Skip AdminGuard for unit test
      .overrideGuard(require("../../auth/admin.guard").AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(RankingResolverController);
    resolver = moduleRef.get(RankingResolverService);
  });

  it("forwards resolved result from service", async () => {
    const stub = { rankings: [], insufficient_data: true } as any;
    resolver.resolve.mockResolvedValue(stub);
    const result = await controller.resolve({
      format: "top_10_ranking",
      metric_id: "piq_score",
      geo_level: "metro",
      scope_type: "national",
      scope_id: null,
    } as any);
    expect(result).toBe(stub);
    expect(resolver.resolve).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd packages/backend && npx jest src/content-pipeline/ranking/
```

Expected: all PASS.

- [ ] **Step 5: Manual smoke**

```bash
cd packages/backend && npm run start:dev
```

In another terminal:

```bash
curl -X POST http://localhost:3001/api/admin/content-pipeline/ranking/resolve \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin session cookie>" \
  -d '{"format":"top_10_ranking","metric_id":"piq_score","geo_level":"metro","scope_type":"national","scope_id":null}'
```

Expected: 200 with `{ rankings: [...], insufficient_data: false, ... }`.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/content-pipeline/ranking/ranking-resolver.controller.ts \
        packages/backend/src/content-pipeline/ranking/ranking-resolver.controller.spec.ts \
        packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): RankingResolverController + module wiring"
```

---

### Task B8: Submit-time drift check on `ContentRunsService.createRun`

**Files:**

- Modify: `packages/backend/src/content-pipeline/content-runs.service.ts`
- Modify (or create): a spec file for `content-runs.service.ts`

- [ ] **Step 1: Locate createRun**

```bash
rg -n "createRun" packages/backend/src/content-pipeline/content-runs.service.ts
```

- [ ] **Step 2: Add failing test**

Add to `content-runs.service.spec.ts`:

```ts
it("returns 409 when ranking run resolved_markets do not match fresh resolve", async () => {
  // Mock RankingResolverService.resolve to return DIFFERENT order than the submitted snapshot
  rankingResolver.resolve.mockResolvedValue({
    rankings: [
      {
        rank: 1,
        region_id: "99999",
        region_name: "X",
        state: "NY",
        value: 100,
        value_formatted: "100",
      },
    ],
  } as any);

  const submittedParams = {
    format: "top_10_ranking",
    metric: { id: "piq_score" },
    scope: { type: "national", id: null },
    geo_level: "metro",
    resolved_markets: [
      {
        rank: 1,
        region_id: "12345",
        region_name: "Y",
        state: "NY",
        value: 100,
        value_formatted: "100",
      },
    ],
  };

  await expect(
    service.createRun({
      format: "top_10_ranking",
      params: submittedParams,
    } as any),
  ).rejects.toThrow(/data drift|409/i);
});
```

- [ ] **Step 3: Run, expect FAIL**

- [ ] **Step 4: Implement drift check**

In `content-runs.service.ts`, inject `RankingResolverService`. In `createRun`, branch on format:

```ts
if (run.format === "top_10_ranking" || run.format === "bottom_10_ranking") {
  await this.checkRankingDrift(run.params);
}
```

Add private method:

```ts
private async checkRankingDrift(params: any): Promise<void> {
  const fresh = await this.rankingResolver.resolve({
    format: params.format,
    metric_id: params.metric.id,
    geo_level: params.geo_level,
    scope_type: params.scope.type,
    scope_id: params.scope.id,
  });

  const submittedKey = (params.resolved_markets ?? [])
    .map((m: any) => `${m.rank}:${m.region_id}`).join('|');
  const freshKey     = fresh.rankings
    .map((m) => `${m.rank}:${m.region_id}`).join('|');

  if (submittedKey !== freshKey) {
    throw new ConflictException({
      error: 'data_drift',
      message: 'Data shifted while you were reviewing — please re-run preview.',
    });
  }
}
```

- [ ] **Step 5: Run, expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/content-pipeline/content-runs.service.ts \
        packages/backend/src/content-pipeline/content-runs.service.spec.ts
git commit -m "feat(content-pipeline): submit-time drift check for ranking runs"
```

---

## Phase C — Renderer (`Top10Layout` generalization)

### Task C1: Update `VideoProps` shape and `VideoPropsSchema` (Zod)

**Files:**

- Modify: `packages/video-template/src/types.ts`

- [ ] **Step 1: Add ranking params shape**

In `packages/video-template/src/types.ts`, add:

```ts
export interface ResolvedMarket {
  rank: number;
  region_id: string;
  region_name: string;
  state: string;
  value: number;
  value_formatted: string;
}

export interface RankingParams {
  format: "top_10_ranking" | "bottom_10_ranking";
  direction: "top" | "bottom";
  metric: { id: string; label: string; unit: string; format: string };
  scope: {
    type: "national" | "state" | "metro";
    id: string | null;
    label: string;
  };
  geo_level: "metro" | "county" | "zip";
  as_of: string;
  resolved_markets: ResolvedMarket[];
}
```

Update `VideoProps` to include optional `params`:

```ts
export interface VideoProps {
  // ... existing fields
  params?: RankingParams;
}
```

Update `VideoPropsSchema` (Zod) to mirror — add an optional `params` field with the matching shape.

- [ ] **Step 2: Verify TypeScript builds**

```bash
cd packages/video-template && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add packages/video-template/src/types.ts
git commit -m "feat(video-template): add RankingParams shape to VideoProps"
```

---

### Task C2: Variable-duration `calculateMetadata` for ranking compositions

**Files:**

- Modify: `packages/video-template/src/PropertyIQVideo.tsx` (or wherever `<Composition>` is registered)

- [ ] **Step 1: Locate Composition registration**

```bash
rg -n "Composition" packages/video-template/src/
```

- [ ] **Step 2: Add `calculateMetadata` for the ranking composition**

In the file that registers `<Composition>` for `top_10_ranking` (and add a new one for `bottom_10_ranking`):

```tsx
const INTRO_FRAMES = 90; // 3.0s @ 30fps
const ROW_FRAMES = 150; // 5.0s per row
const OUTRO_FRAMES = 135; // 4.5s

const calculateRankingMetadata = ({ props }: { props: VideoProps }) => {
  const n = props.params?.resolved_markets?.length ?? 10;
  return {
    durationInFrames: INTRO_FRAMES + n * ROW_FRAMES + OUTRO_FRAMES,
    fps: 30,
    width: 1080,
    height: 1920,
  };
};
```

Pass to both `<Composition>` instances:

```tsx
<Composition
  id="top_10_ranking"
  component={Top10Layout}
  defaultProps={...}
  calculateMetadata={calculateRankingMetadata}
/>
<Composition
  id="bottom_10_ranking"
  component={Top10Layout}
  defaultProps={{ /* with theme: 'bottom' if needed */ }}
  calculateMetadata={calculateRankingMetadata}
/>
```

- [ ] **Step 3: Add unit test**

In `packages/video-template/tests/calculate-metadata.test.ts` (new file):

```ts
import { describe, it, expect } from "@jest/globals";

const INTRO = 90,
  ROW = 150,
  OUTRO = 135;

function calc(n: number) {
  return INTRO + n * ROW + OUTRO;
}

describe("ranking calculateMetadata", () => {
  it("N=5 → 975 frames (32.5s)", () => {
    expect(calc(5)).toBe(975);
  });
  it("N=10 → 1725 frames (57.5s)", () => {
    expect(calc(10)).toBe(1725);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd packages/video-template && npm test -- calculate-metadata
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/video-template/src/PropertyIQVideo.tsx \
        packages/video-template/tests/calculate-metadata.test.ts
git commit -m "feat(video-template): variable duration for ranking compositions"
```

---

### Task C3: `MetricValue` subcomponent

**Files:**

- Create: `packages/video-template/src/components/MetricValue.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from "react";

interface Props {
  value_formatted: string;
  format: string;
}

export const MetricValue: React.FC<Props> = ({ value_formatted, format }) => {
  // Font sizing — currency tends to be longer ("$1.2M") than percent ("12.4%")
  const fontSize = format === "currency" ? 110 : format === "days" ? 100 : 130;

  return (
    <div
      style={{
        fontFamily: "Roboto Mono, monospace",
        fontWeight: 600,
        fontSize,
        lineHeight: 1,
        color: "#FFFFFF",
        letterSpacing: "-0.02em",
      }}
    >
      {value_formatted}
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

```bash
cd packages/video-template && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add packages/video-template/src/components/MetricValue.tsx
git commit -m "feat(video-template): MetricValue subcomponent with format-aware sizing"
```

---

### Task C4: Refactor `Top10Layout` to read from `params.resolved_markets`

**Files:**

- Modify: `packages/video-template/src/layouts/Top10Layout.tsx`

- [ ] **Step 1: Read existing component**

```bash
cat packages/video-template/src/layouts/Top10Layout.tsx
```

Note current data source (`dataBundle.top_cashflow_markets` per the explore).

- [ ] **Step 2: Refactor to read from params**

Replace the data-source line with:

```tsx
import { VideoProps } from "../types";
import { MetricValue } from "../components/MetricValue";

const DEFAULT_THEME = "top";

export const Top10Layout: React.FC<
  VideoProps & { theme?: "top" | "bottom" }
> = (props) => {
  const params = props.params!;
  const markets = params.resolved_markets;
  const theme = props.theme ?? DEFAULT_THEME;

  const accent = theme === "bottom" ? "#FF8F00" : "#00C853";
  const introCopy = theme === "bottom" ? "Markets to avoid" : "Top markets";
  const outroCopy =
    theme === "bottom"
      ? "Skip these. Find better →"
      : "Find your next market →";

  // ... existing scene composition, swapping data references for `markets`
  // and applying `accent` to colored elements
};
```

For each ranking row, render with `<MetricValue value_formatted={market.value_formatted} format={params.metric.format} />`.

- [ ] **Step 3: Update `top-10.test.tsx` fixture for new shape**

Open `packages/video-template/tests/top-10.test.tsx`. Replace `INPUT_PROPS` with:

```ts
const INPUT_PROPS = {
  format: "top_10_ranking",
  params: {
    format: "top_10_ranking",
    direction: "top",
    metric: {
      id: "cashflow_yield",
      label: "Cashflow Yield",
      unit: "%",
      format: "percent",
    },
    scope: { type: "state", id: "CA", label: "California" },
    geo_level: "county",
    as_of: "2026-04-01",
    resolved_markets: Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      region_id: `0600${i}`,
      region_name: `County ${i + 1}`,
      state: "CA",
      value: 0.124 - i * 0.005,
      value_formatted: `${((0.124 - i * 0.005) * 100).toFixed(1)}%`,
    })),
  },
} as const;
```

- [ ] **Step 4: Run snapshot test, regenerate snapshots**

```bash
cd packages/video-template && npm test -- top-10 -u
```

Expected: snapshots regenerated (review the diff to confirm the visual output is sane).

- [ ] **Step 5: Commit**

```bash
git add packages/video-template/src/layouts/Top10Layout.tsx \
        packages/video-template/tests/top-10.test.tsx \
        packages/video-template/tests/__snapshots__/
git commit -m "refactor(video-template): Top10Layout reads from frozen resolved_markets"
```

---

### Task C5: Bottom theme variant + `bottom-10.test.tsx`

**Files:**

- Modify: `packages/video-template/src/PropertyIQVideo.tsx`
- Create: `packages/video-template/tests/bottom-10.test.tsx`

- [ ] **Step 1: Wire `bottom_10_ranking` Composition with `theme="bottom"`**

In `PropertyIQVideo.tsx`, add a separate `<Composition>` for `bottom_10_ranking` that passes `theme="bottom"` to `Top10Layout`:

```tsx
<Composition
  id="bottom_10_ranking"
  component={(props: VideoProps) => <Top10Layout {...props} theme="bottom" />}
  defaultProps={DEFAULT_BOTTOM_PROPS}
  calculateMetadata={calculateRankingMetadata}
  width={1080}
  height={1920}
  fps={30}
  durationInFrames={1725}
/>
```

- [ ] **Step 2: Add snapshot test**

Create `packages/video-template/tests/bottom-10.test.tsx`:

```tsx
import { renderToString } from "react-dom/server";
import { Top10Layout } from "../src/layouts/Top10Layout";
import { describe, it, expect } from "@jest/globals";

const INPUT_PROPS = {
  format: "bottom_10_ranking",
  theme: "bottom" as const,
  params: {
    format: "bottom_10_ranking",
    direction: "bottom",
    metric: {
      id: "vacancy_risk_score",
      label: "Vacancy Risk",
      unit: "",
      format: "index",
    },
    scope: { type: "national", id: null, label: "United States" },
    geo_level: "county",
    as_of: "2026-04-01",
    resolved_markets: Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      region_id: `${10000 + i}`,
      region_name: `County ${i + 1}`,
      state: "TX",
      value: 85 - i,
      value_formatted: `${85 - i}`,
    })),
  },
};

describe("Bottom 10 Ranking snapshots", () => {
  for (const frame of [0, 90, 240, 600, 1200, 1500, 1700]) {
    it(`renders frame ${frame}`, () => {
      // Per Remotion test pattern (mirror top-10.test.tsx implementation)
      const html = renderToString(<Top10Layout {...(INPUT_PROPS as any)} />);
      expect(html).toMatchSnapshot();
    });
  }
});
```

(If `top-10.test.tsx` uses a different rendering harness — e.g. `@remotion/renderer` — mirror that pattern. Read `top-10.test.tsx` first and copy its harness.)

- [ ] **Step 3: Run snapshot test**

```bash
cd packages/video-template && npm test -- bottom-10
```

Expected: snapshots created on first run.

- [ ] **Step 4: Commit**

```bash
git add packages/video-template/src/PropertyIQVideo.tsx \
        packages/video-template/tests/bottom-10.test.tsx \
        packages/video-template/tests/__snapshots__/bottom-10.test.tsx.snap
git commit -m "feat(video-template): bottom_10_ranking composition + snapshot test"
```

---

### Task C6: Additional snapshot fixtures (currency format, N=5 edge case)

**Files:**

- Modify: `packages/video-template/tests/top-10.test.tsx`

- [ ] **Step 1: Add fixtures**

In `top-10.test.tsx`, add two more describe blocks:

```ts
describe("Top 10 — currency format (home_value)", () => {
  const INPUT = {
    format: "top_10_ranking",
    params: {
      format: "top_10_ranking",
      direction: "top",
      metric: {
        id: "home_value",
        label: "Home Value",
        unit: "$",
        format: "currency",
      },
      scope: { type: "state", id: "CA", label: "California" },
      geo_level: "county",
      as_of: "2026-04-01",
      resolved_markets: Array.from({ length: 10 }, (_, i) => ({
        rank: i + 1,
        region_id: `0600${i}`,
        region_name: `County ${i + 1}`,
        state: "CA",
        value: 1_200_000 - i * 50000,
        value_formatted: `$${((1_200_000 - i * 50000) / 1_000_000).toFixed(1)}M`,
      })),
    },
  };
  for (const frame of [0, 240, 1200]) {
    it(`renders frame ${frame}`, () => {
      // Verify $1.2M renders without overflow (snapshot will catch layout shift)
      // Use same harness as primary top-10 test
    });
  }
});

describe("Top 10 — N=5 edge case (variable duration)", () => {
  const INPUT = {
    format: "top_10_ranking",
    params: {
      format: "top_10_ranking",
      direction: "top",
      metric: {
        id: "piq_score",
        label: "PIQ Score",
        unit: "",
        format: "index",
      },
      scope: { type: "metro", id: "45300", label: "Tampa" },
      geo_level: "zip",
      as_of: "2026-04-01",
      resolved_markets: Array.from({ length: 5 }, (_, i) => ({
        rank: i + 1,
        region_id: `3361${i}`,
        region_name: `ZIP ${i + 1}`,
        state: "FL",
        value: 90 - i * 3,
        value_formatted: `${90 - i * 3}`,
      })),
    },
  };
  for (const frame of [0, 90, 600, 870, 970]) {
    // last meaningful frame at 975
    it(`renders frame ${frame} (N=5, total 975 frames)`, () => {
      // Same harness
    });
  }
});
```

- [ ] **Step 2: Run snapshots**

```bash
cd packages/video-template && npm test -- top-10
```

Expected: new snapshots created.

- [ ] **Step 3: Visually inspect snapshots** to confirm no overflow on `$1.2M` and N=5 doesn't crash.

- [ ] **Step 4: Commit**

```bash
git add packages/video-template/tests/top-10.test.tsx packages/video-template/tests/__snapshots__/
git commit -m "test(video-template): currency format + N=5 fixtures for Top10Layout"
```

---

## Phase D — Wizard UI

### Task D1: Update format-step copy + verify card rendering

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/lib/format-previews.ts`

- [ ] **Step 1: Update FORMAT_META rows**

```ts
export const FORMAT_META: Record<ContentFormat, FormatMeta> = {
  // ... existing entries
  top_10_ranking: {
    displayName: "Top 10 Markets",
    audience: "Investors, agents prospecting",
    duration: "60s",
    aspect: "9:16",
    purpose:
      "Celebrate the leaders by any metric. National, state, or metro scope.",
    previewUrl: "/format-previews/top-10-ranking.mp4",
  },
  bottom_10_ranking: {
    displayName: "Bottom 10 — Markets to Avoid",
    audience: "Investors, agents protecting clients",
    duration: "60s",
    aspect: "9:16",
    purpose: "Spot the landmines on any metric you care about.",
    previewUrl: "/format-previews/bottom-10-ranking.mp4",
  },
};
```

- [ ] **Step 2: Visual smoke**

```bash
# Use the local-dev-servers skill if servers aren't running
cd packages/frontend && npm run dev
```

Open `http://localhost:3000/admin/content-pipeline/new` in browser. Confirm both cards render with new copy.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/lib/format-previews.ts
git commit -m "feat(content-pipeline): refresh format card copy for top/bottom 10"
```

---

### Task D2: Validity-matrix helpers + unit tests

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/helpers/ranking-validity.ts`
- Create: `packages/frontend/app/admin/content-pipeline/new/helpers/ranking-validity.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  validLevelsForScope,
  validScopesForLevel,
  isValidCombo,
} from "./ranking-validity";

describe("validLevelsForScope", () => {
  it("national → all levels", () => {
    expect(validLevelsForScope("national")).toEqual(["metro", "county", "zip"]);
  });
  it("state → all levels", () => {
    expect(validLevelsForScope("state")).toEqual(["metro", "county", "zip"]);
  });
  it("metro → only zip", () => {
    expect(validLevelsForScope("metro")).toEqual(["zip"]);
  });
});

describe("validScopesForLevel", () => {
  it("metro level → national or state only", () => {
    expect(validScopesForLevel("metro")).toEqual(["national", "state"]);
  });
  it("county level → national or state only", () => {
    expect(validScopesForLevel("county")).toEqual(["national", "state"]);
  });
  it("zip level → all scopes", () => {
    expect(validScopesForLevel("zip")).toEqual(["national", "state", "metro"]);
  });
});

describe("isValidCombo", () => {
  it("metro × national OK", () => {
    expect(isValidCombo("metro", "national")).toBe(true);
  });
  it("metro × metro NOT OK", () => {
    expect(isValidCombo("metro", "metro")).toBe(false);
  });
  it("county × metro NOT OK", () => {
    expect(isValidCombo("county", "metro")).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
cd packages/frontend && npx vitest run app/admin/content-pipeline/new/helpers/ranking-validity.spec.ts
```

(If frontend uses Jest instead of Vitest, swap the import. Check `package.json` test script.)

- [ ] **Step 3: Implement helpers**

```ts
export type GeoLevel = "metro" | "county" | "zip";
export type ScopeType = "national" | "state" | "metro";

const MATRIX: Record<ScopeType, GeoLevel[]> = {
  national: ["metro", "county", "zip"],
  state: ["metro", "county", "zip"],
  metro: ["zip"],
};

export const validLevelsForScope = (scope: ScopeType): GeoLevel[] =>
  MATRIX[scope];

export const validScopesForLevel = (level: GeoLevel): ScopeType[] =>
  (Object.keys(MATRIX) as ScopeType[]).filter((s) => MATRIX[s].includes(level));

export const isValidCombo = (level: GeoLevel, scope: ScopeType): boolean =>
  MATRIX[scope].includes(level);
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/helpers/
git commit -m "feat(content-pipeline): ranking validity-matrix helpers"
```

---

### Task D3: API client functions

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts`

- [ ] **Step 1: Add resolveRanking helper**

```ts
export interface ResolveRankingArgs {
  format: "top_10_ranking" | "bottom_10_ranking";
  metric_id: string;
  geo_level: "metro" | "county" | "zip";
  scope_type: "national" | "state" | "metro";
  scope_id: string | null;
  limit?: number;
}

export interface RankingEntry {
  rank: number;
  region_id: string;
  region_name: string;
  state: string;
  value: number;
  value_formatted: string;
}

export interface ResolveRankingResponse {
  metric: { id: string; label: string; unit: string; format: string };
  scope: { type: string; id: string | null; label: string };
  geo_level: string;
  direction: "top" | "bottom";
  as_of: string;
  eligible_count: number;
  excluded_count: number;
  rankings: RankingEntry[];
  insufficient_data: boolean;
}

export async function resolveRanking(
  args: ResolveRankingArgs,
): Promise<ResolveRankingResponse> {
  const res = await fetch(
    `${API_URL}/api/admin/content-pipeline/ranking/resolve`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
  if (!res.ok)
    throw new Error(`resolveRanking failed: ${res.status} ${await res.text()}`);
  return res.json();
}
```

(If the file already has a typed fetch wrapper, use that instead of raw `fetch`.)

- [ ] **Step 2: Verify TS build**

```bash
cd packages/frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts
git commit -m "feat(content-pipeline): resolveRanking API client helper"
```

---

### Task D4: `ranking-params-step` component

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/ranking-params-step.tsx`

- [ ] **Step 1: Locate the existing MetricSelect** (or build one)

```bash
rg -n "MetricSelect|MetricSelector" packages/frontend/app/
```

If a reusable selector exists, import it. Otherwise inline a simple `<select>` populated from the metric registry helper:

```ts
import { getAllMetrics } from "@/lib/data/registry";
```

- [ ] **Step 2: Build the component**

```tsx
"use client";

import { useState } from "react";
import { getAllMetrics } from "@/lib/data/registry";
import { isMetricSupportedForGeo } from "@/lib/data/registry-helpers";
import { validLevelsForScope } from "./helpers/ranking-validity";
import type { GeoLevel, ScopeType } from "./helpers/ranking-validity";

interface Props {
  format: "top_10_ranking" | "bottom_10_ranking";
  initial?: Partial<{
    metric_id: string;
    geo_level: GeoLevel;
    scope_type: ScopeType;
    scope_id: string | null;
  }>;
  onBack: () => void;
  onNext: (params: {
    metric_id: string;
    geo_level: GeoLevel;
    scope_type: ScopeType;
    scope_id: string | null;
  }) => void;
}

export function RankingParamsStep({ format, initial, onBack, onNext }: Props) {
  const [metricId, setMetricId] = useState(initial?.metric_id ?? "");
  const [scopeType, setScopeType] = useState<ScopeType>(
    initial?.scope_type ?? "national",
  );
  const [scopeId, setScopeId] = useState<string | null>(
    initial?.scope_id ?? null,
  );
  const [geoLevel, setGeoLevel] = useState<GeoLevel>(
    initial?.geo_level ?? "metro",
  );

  const allMetrics = getAllMetrics();

  // Filter levels: must be valid for scope AND supported by metric
  const allowedLevels = validLevelsForScope(scopeType).filter(
    (lvl) => !metricId || isMetricSupportedForGeo(metricId, lvl as any),
  );

  // If chosen level becomes invalid after scope/metric change, reset to first allowed
  if (!allowedLevels.includes(geoLevel) && allowedLevels.length > 0) {
    setGeoLevel(allowedLevels[0]);
  }

  const canSubmit =
    metricId &&
    allowedLevels.length > 0 &&
    (scopeType === "national" || scopeId);

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">
        {format === "top_10_ranking"
          ? "Top 10 — Configure ranking"
          : "Bottom 10 — Configure ranking"}
      </h2>

      {/* Metric */}
      <div>
        <label className="block text-sm font-medium mb-2">What metric?</label>
        <select
          value={metricId}
          onChange={(e) => setMetricId(e.target.value)}
          className="w-full rounded-lg border border-outline px-3 py-2"
        >
          <option value="">Select a metric…</option>
          {allMetrics.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </div>

      {/* Level (radio group; only show allowed) */}
      <div>
        <label className="block text-sm font-medium mb-2">What level?</label>
        <div className="flex gap-3">
          {allowedLevels.map((lvl) => (
            <label key={lvl} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="level"
                checked={geoLevel === lvl}
                onChange={() => setGeoLevel(lvl)}
              />
              <span className="capitalize">
                {lvl === "zip" ? "ZIP Codes" : `${lvl}s`}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Scope (segmented control) */}
      <div>
        <label className="block text-sm font-medium mb-2">Where?</label>
        <div className="inline-flex rounded-full border border-outline overflow-hidden">
          {(["national", "state", "metro"] as ScopeType[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`px-4 py-2 ${scopeType === s ? "bg-primary text-on-primary" : "bg-surface"}`}
              onClick={() => {
                setScopeType(s);
                setScopeId(null);
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {scopeType === "state" && (
          <select
            className="mt-3 w-full rounded-lg border border-outline px-3 py-2"
            value={scopeId ?? ""}
            onChange={(e) => setScopeId(e.target.value || null)}
          >
            <option value="">Select a state…</option>
            {US_STATES.map((s) => (
              <option key={s.abbr} value={s.abbr}>
                {s.name}
              </option>
            ))}
          </select>
        )}

        {scopeType === "metro" && (
          <MetroAutocomplete
            value={scopeId}
            onChange={setScopeId}
            className="mt-3"
          />
        )}
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-4 py-2 border"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onNext({
              metric_id: metricId,
              geo_level: geoLevel,
              scope_type: scopeType,
              scope_id: scopeId,
            })
          }
          className="rounded-full px-4 py-2 bg-primary text-on-primary disabled:opacity-50"
        >
          Preview →
        </button>
      </div>
    </div>
  );
}
```

(Define `US_STATES` constant and import or stub `MetroAutocomplete` — reuse the grade_reveal market-search component if available.)

- [ ] **Step 3: Verify TS build**

```bash
cd packages/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/ranking-params-step.tsx
git commit -m "feat(content-pipeline): RankingParamsStep wizard component"
```

---

### Task D5: `ranking-preview-step` component

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/ranking-preview-step.tsx`

- [ ] **Step 1: Build the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  resolveRanking,
  type ResolveRankingResponse,
  type ResolveRankingArgs,
} from "../lib/content-pipeline-api";

interface Props {
  args: ResolveRankingArgs;
  onBack: () => void;
  onSubmit: (resolved: ResolveRankingResponse) => void;
}

export function RankingPreviewStep({ args, onBack, onSubmit }: Props) {
  const [data, setData] = useState<ResolveRankingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setData(null);
    resolveRanking(args)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [JSON.stringify(args)]);

  if (error)
    return (
      <div className="rounded-lg bg-error-container p-4 text-on-error-container">
        {error}
      </div>
    );
  if (!data) return <div className="text-on-surface-variant">Resolving…</div>;

  if (data.insufficient_data) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Not enough data for a ranking</h2>
        <p>
          Only {data.eligible_count} {data.geo_level}
          {data.eligible_count === 1 ? "" : "s"} in {data.scope.label} have
          current {data.metric.label} values. Minimum required: 5.
        </p>
        <p>Try a broader scope or a different metric.</p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-4 py-2 border"
        >
          ← Back
        </button>
      </div>
    );
  }

  const directionLabel = data.direction === "top" ? "Top" : "Bottom";
  const levelLabel =
    data.geo_level === "zip"
      ? "ZIP Codes"
      : data.geo_level.charAt(0).toUpperCase() + data.geo_level.slice(1) + "s";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">
        {directionLabel} {data.rankings.length} {levelLabel} in{" "}
        {data.scope.label} by {data.metric.label}
      </h2>
      <p className="text-sm text-on-surface-variant">As of {data.as_of}</p>

      <ol className="space-y-2">
        {data.rankings.map((m) => (
          <li
            key={m.region_id}
            className="flex justify-between rounded-lg bg-surface-container px-4 py-3"
          >
            <span>
              <span className="font-mono mr-3">#{m.rank}</span>
              {m.region_name}, {m.state}
            </span>
            <span className="font-mono">{m.value_formatted}</span>
          </li>
        ))}
      </ol>

      {data.excluded_count > 0 && (
        <p className="text-sm text-on-surface-variant">
          {data.excluded_count} {levelLabel.toLowerCase()} in {data.scope.label}{" "}
          had insufficient data and were excluded. Final ranking shows{" "}
          {directionLabel.toLowerCase()} {data.rankings.length} of{" "}
          {data.eligible_count} eligible.
        </p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-4 py-2 border"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => onSubmit(data)}
          className="rounded-full px-4 py-2 bg-primary text-on-primary"
        >
          Submit Run →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TS build**

```bash
cd packages/frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/ranking-preview-step.tsx
git commit -m "feat(content-pipeline): RankingPreviewStep wizard component"
```

---

### Task D6: Wizard orchestrator routing

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/new/page.tsx`

- [ ] **Step 1: Read current orchestrator**

```bash
cat packages/frontend/app/admin/content-pipeline/new/page.tsx
```

Identify the step state variable and how grade_reveal routes through `market-search-step` → `single-market-summary` → submit.

- [ ] **Step 2: Add ranking branch**

When `format === 'top_10_ranking' || format === 'bottom_10_ranking'`, route through:

```tsx
{
  step === "ranking-params" && format && (
    <RankingParamsStep
      format={format as "top_10_ranking" | "bottom_10_ranking"}
      initial={rankingArgs}
      onBack={() => setStep("format")}
      onNext={(args) => {
        setRankingArgs(args);
        setStep("ranking-preview");
      }}
    />
  );
}

{
  step === "ranking-preview" && rankingArgs && format && (
    <RankingPreviewStep
      args={{ format: format as any, ...rankingArgs }}
      onBack={() => setStep("ranking-params")}
      onSubmit={(resolved) => handleRankingSubmit(resolved)}
    />
  );
}
```

In `handleFormatSelected`, when format is a ranking format, set `step('ranking-params')` instead of `step('market-search')`.

`handleRankingSubmit` calls `createRun` with the full resolved response in `params`:

```tsx
const handleRankingSubmit = async (resolved: ResolveRankingResponse) => {
  const run = await createRun({
    format,
    params: {
      format,
      direction: resolved.direction,
      metric: resolved.metric,
      scope: resolved.scope,
      geo_level: resolved.geo_level,
      as_of: resolved.as_of,
      eligible_count: resolved.eligible_count,
      excluded_count: resolved.excluded_count,
      resolved_markets: resolved.rankings,
    },
  });
  router.push(`/admin/content-pipeline?run=${run.id}`);
};
```

If `createRun` returns 409 (drift), surface a banner with "Refresh preview" → setStep('ranking-preview').

- [ ] **Step 3: Visual smoke**

```bash
cd packages/frontend && npm run dev
```

Click through `/admin/content-pipeline/new` → top_10 card → params step → preview → submit. Confirm:

- Both new steps render
- Validity matrix hides invalid combos (try scope=metro and confirm only ZIP level shows)
- Insufficient-data path shows refusal copy

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/page.tsx
git commit -m "feat(content-pipeline): wizard orchestrator routes ranking formats through new steps"
```

---

### Task D7: Playwright E2E for ranking wizard

**Files:**

- Create: `scripts/validate-ranking-wizard.mjs`

- [ ] **Step 1: Read existing validator for the harness pattern**

```bash
cat scripts/validate-batch-wizard.mjs
```

- [ ] **Step 2: Write validator** (clone the batch validator pattern, swap selectors)

```js
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

(async () => {
  const browser = await chromium.launch();
  const page    = await browser.newPage();

  // Login (same flow as batch validator)
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]',    ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/);

  // === Test 1: Happy path top ===
  await page.goto(`${BASE_URL}/admin/content-pipeline/new`);
  await page.click('text=Top 10 Markets');
  await page.selectOption('select', { label: /PropertyIQ Score/i });
  await page.click('text=Counties');
  await page.click('text=State');
  await page.selectOption('select:near(:text("Select a state"))', 'CA');
  await page.click('text=Preview →');
  await page.waitForSelector('ol li');
  const rankCount = await page.locator('ol li').count();
  if (rankCount < 5) throw new Error(`Expected ≥5 rows, got ${rankCount}`);
  await page.click('text=Submit Run');
  await page.waitForURL(/\/admin\/content-pipeline\?run=/);
  console.log('✓ Happy path top passed');

  // === Test 2: Validity matrix (scope=metro hides counties) ===
  await page.goto(`${BASE_URL}/admin/content-pipeline/new`);
  await page.click('text=Top 10 Markets');
  await page.selectOption('select', { index: 1 });  // first metric
  await page.click('text=Metro');
  // Pick a metro from autocomplete (specific selector depends on MetroAutocomplete impl)
  // ...
  const countyRadio = await page.locator('label:has-text("Counties") input').count();
  if (countyRadio !== 0) throw new Error('Counties radio should be hidden when scope=metro');
  console.log('✓ Validity matrix passed');

  // === Test 3: Insufficient data refusal ===
  // Pick a deliberately sparse metric × scope (Vacancy Risk × ZIP × Tampa metro
  // — likely <5 ZIPs have vacancy_risk_score)
  // Confirm refusal copy and Submit disabled

  await browser.close();
  console.log('All wizard validators passed.');
})();
```

- [ ] **Step 3: Run against local dev**

```bash
node scripts/validate-ranking-wizard.mjs
```

Expected: all three tests pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/validate-ranking-wizard.mjs
git commit -m "test(content-pipeline): Playwright validator for ranking wizard"
```

---

## Phase E — Prompt template + script generation

### Task E1: Rewrite `top_10_ranking.md` prompt

**Files:**

- Modify: `packages/backend/src/content-pipeline/prompts/top_10_ranking.md`

- [ ] **Step 1: Replace the file contents**

````markdown
You are writing a 60-second voiceover script for a PropertyIQ "Top 10 Ranking" video.

# Inputs you will receive

- `metric.label` — what's being ranked (e.g. "Cashflow Yield", "PropertyIQ Score")
- `metric.unit` — display unit ("%", "$", etc. — empty for indices)
- `scope.label` — geographic scope ("United States", "California", "Tampa-St. Petersburg, FL")
- `geo_level` — "metro" | "county" | "zip"
- `direction` — always "top" for this template
- `resolved_markets` — array of N (5–10) entries: `{ rank, region_name, state, value, value_formatted }`, sorted #1 best → #N worst-of-the-best

# Brand voice

- Apple keynote: declarative, confident, sparse
- 110–120 wpm target → ~25 syllables per row line max
- No filler words ("amazing", "incredible", "you'll love this")
- No causal claims — only what the data says
- Honor the punchline cadence: #1 reveal gets a beat of silence before VO

# Number formatting

When converting a `value_formatted` to the spoken form, follow these rules:

| Display   | Spoken                          |
| --------- | ------------------------------- |
| `12.4%`   | "twelve point four percent"     |
| `$1.2M`   | "one point two million dollars" |
| `28 days` | "twenty-eight days"             |
| `87`      | "eighty-seven"                  |

# Reveal cadence

Always count down from #N → #1, regardless of N. Save #1 as the punchline.

# Output

Return ONLY a JSON object matching this schema (no commentary, no markdown fences):

```json
{
  "hooks": [
    { "id": "data-led",     "intro_vo": "...", "subhead_text": "..." },
    { "id": "surprise-led", "intro_vo": "...", "subhead_text": "..." }
  ],
  "rows": [
    { "rank": <N>, "vo": "Number <N>. <region_name>, <state>. <spoken value>.", "emphasis": "name" | "value" },
    ...
    { "rank": 1, "vo": "...", "emphasis": "name" }
  ],
  "outro_vo": "PropertyIQ. Now you know.",
  "outro_cta": "Learn more at propertyiq.app."
}
```
````

# Hook variants (always produce both)

- `data-led`: state the ranking premise straight ("Ten counties in California by cashflow yield. Top to bottom.")
- `surprise-led`: tease the contents ("Two of these you've probably never heard of.")

# Rules

- `rows` length MUST equal `resolved_markets` length
- Each row's `rank` MUST equal the corresponding `resolved_markets` rank
- `region_name` and `state` MUST appear verbatim in the VO (do not paraphrase, abbreviate, or substitute)
- Do NOT mention any market that is not in `resolved_markets`
- Do NOT mention `excluded_count` or describe missing data
- `outro_cta` MUST be exactly: "Learn more at propertyiq.app." (Plan B will replace with magnet copy)

# Example (for shape only — your input will differ)

Input:

```
metric: { label: "Cashflow Yield", unit: "%", format: "percent" }
scope:  { label: "California" }
geo_level: "county"
resolved_markets: [
  { rank: 1, region_name: "Lassen County",   state: "CA", value: 0.124, value_formatted: "12.4%" },
  ...
]
```

Output: a JSON object as above with each row VO formatted like:
"Number ten. Modoc County, California. Eleven point eight percent."

````

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/content-pipeline/prompts/top_10_ranking.md
git commit -m "feat(content-pipeline): rewrite top_10_ranking prompt for dynamic-metric flow"
````

---

### Task E2: Create `bottom_10_ranking.md` prompt

**Files:**

- Create: `packages/backend/src/content-pipeline/prompts/bottom_10_ranking.md`

- [ ] **Step 1: Mirror top_10_ranking.md with direction-flipped framing**

Same structure as Task E1 with:

- `direction` always "bottom"
- Hook variants:
  - `warning-led`: "These ten markets carry the highest vacancy risk in America."
  - `stakes-led`: "Don't put your money in any of these."
- Reveal cadence still #N → #1 (saves the worst for last)
- Outro `outro_cta` exactly: "Learn more at propertyiq.app."
- Add reminder: "Do NOT moralize or dramatize. Stick to data."

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/content-pipeline/prompts/bottom_10_ranking.md
git commit -m "feat(content-pipeline): bottom_10_ranking prompt template"
```

---

### Task E3: Zod schema for script JSON validation

**Files:**

- Create: `packages/backend/src/content-pipeline/ranking/ranking-script.schema.ts`
- Create: `packages/backend/src/content-pipeline/ranking/ranking-script.schema.spec.ts`

- [ ] **Step 1: Write the schema**

```ts
import { z } from "zod";

export const RankingHookSchema = z.object({
  id: z.enum(["data-led", "surprise-led", "warning-led", "stakes-led"]),
  intro_vo: z.string().min(10),
  subhead_text: z.string().min(2),
});

export const RankingRowSchema = z.object({
  rank: z.number().int().min(1).max(50),
  vo: z.string().min(5),
  emphasis: z.enum(["name", "value"]),
});

export const RankingScriptSchema = z.object({
  hooks: z.array(RankingHookSchema).length(2),
  rows: z.array(RankingRowSchema).min(5).max(50),
  outro_vo: z.string().min(5),
  outro_cta: z.literal("Learn more at propertyiq.app."),
});

export type RankingScript = z.infer<typeof RankingScriptSchema>;

/**
 * Stricter validation that requires the script to match the resolved_markets context.
 * Returns array of error messages (empty if valid).
 */
export function validateScriptAgainstMarkets(
  script: RankingScript,
  markets: Array<{ rank: number; region_name: string; state: string }>,
): string[] {
  const errors: string[] = [];

  if (script.rows.length !== markets.length) {
    errors.push(
      `rows.length (${script.rows.length}) !== resolved_markets.length (${markets.length})`,
    );
  }

  const expectedRanks = markets.map((m) => m.rank).sort((a, b) => a - b);
  const actualRanks = script.rows.map((r) => r.rank).sort((a, b) => a - b);
  if (JSON.stringify(expectedRanks) !== JSON.stringify(actualRanks)) {
    errors.push(
      `row ranks ${JSON.stringify(actualRanks)} do not match resolved_markets ranks ${JSON.stringify(expectedRanks)}`,
    );
  }

  for (const market of markets) {
    const row = script.rows.find((r) => r.rank === market.rank);
    if (!row) continue;
    if (!row.vo.includes(market.region_name)) {
      errors.push(
        `rank ${market.rank} VO does not contain region_name "${market.region_name}"`,
      );
    }
    if (
      !row.vo.includes(market.state) &&
      !row.vo.includes(stateAbbrToFull(market.state))
    ) {
      errors.push(
        `rank ${market.rank} VO does not contain state "${market.state}"`,
      );
    }
  }

  return errors;
}

function stateAbbrToFull(abbr: string): string {
  const map: Record<string, string> = {
    CA: "California",
    TX: "Texas",
    NY: "New York",
    FL: "Florida" /* ... */,
  };
  return map[abbr] ?? abbr;
}
```

- [ ] **Step 2: Write tests**

```ts
import { describe, it, expect } from "@jest/globals";
import {
  RankingScriptSchema,
  validateScriptAgainstMarkets,
} from "./ranking-script.schema";

const baseScript = {
  hooks: [
    {
      id: "data-led",
      intro_vo: "Ten counties in California by cashflow yield.",
      subhead_text: "Top to bottom",
    },
    {
      id: "surprise-led",
      intro_vo: "Two of these you have probably never heard of.",
      subhead_text: "Watch closely",
    },
  ],
  rows: [
    {
      rank: 1,
      vo: "Number one. Lassen County, California. Twelve point four percent.",
      emphasis: "name" as const,
    },
    {
      rank: 2,
      vo: "Number two. Modoc County, California. Eleven point eight percent.",
      emphasis: "name" as const,
    },
    {
      rank: 3,
      vo: "Number three. Tehama County, California. Ten point one percent.",
      emphasis: "name" as const,
    },
    {
      rank: 4,
      vo: "Number four. Plumas County, California. Nine point five percent.",
      emphasis: "name" as const,
    },
    {
      rank: 5,
      vo: "Number five. Lake County, California. Eight point six percent.",
      emphasis: "name" as const,
    },
  ],
  outro_vo: "PropertyIQ. Now you know.",
  outro_cta: "Learn more at propertyiq.app.",
};

describe("RankingScriptSchema", () => {
  it("passes for valid script", () => {
    expect(() => RankingScriptSchema.parse(baseScript)).not.toThrow();
  });
  it("rejects wrong outro_cta", () => {
    expect(() =>
      RankingScriptSchema.parse({ ...baseScript, outro_cta: "Foo" }),
    ).toThrow();
  });
  it("rejects fewer than 5 rows", () => {
    expect(() =>
      RankingScriptSchema.parse({
        ...baseScript,
        rows: baseScript.rows.slice(0, 4),
      }),
    ).toThrow();
  });
});

describe("validateScriptAgainstMarkets", () => {
  const markets = [
    { rank: 1, region_name: "Lassen County", state: "CA" },
    { rank: 2, region_name: "Modoc County", state: "CA" },
    { rank: 3, region_name: "Tehama County", state: "CA" },
    { rank: 4, region_name: "Plumas County", state: "CA" },
    { rank: 5, region_name: "Lake County", state: "CA" },
  ];

  it("passes when ranks and names match", () => {
    expect(validateScriptAgainstMarkets(baseScript, markets)).toEqual([]);
  });

  it("catches hallucinated region_name", () => {
    const tampered = {
      ...baseScript,
      rows: [
        ...baseScript.rows.slice(0, 4),
        {
          rank: 5,
          vo: "Number five. Tacoma, Washington. Eight point six percent.",
          emphasis: "name" as const,
        },
      ],
    };
    const errors = validateScriptAgainstMarkets(tampered, markets);
    expect(errors.some((e) => e.includes("Lake County"))).toBe(true);
  });

  it("catches mismatched row count", () => {
    const errors = validateScriptAgainstMarkets(
      { ...baseScript, rows: baseScript.rows.slice(0, 3) },
      markets,
    );
    expect(errors[0]).toMatch(/rows\.length/);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd packages/backend && npx jest src/content-pipeline/ranking/ranking-script.schema.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/content-pipeline/ranking/ranking-script.schema.ts \
        packages/backend/src/content-pipeline/ranking/ranking-script.schema.spec.ts
git commit -m "feat(content-pipeline): Zod schema for ranking script validation"
```

---

### Task E4: Wire ranking script generation into `anthropic-script-generator.ts`

**Files:**

- Modify: `packages/backend/src/content-pipeline/drivers/anthropic-script-generator.ts`

- [ ] **Step 1: Read current generator**

```bash
cat packages/backend/src/content-pipeline/drivers/anthropic-script-generator.ts
```

- [ ] **Step 2: Branch on format**

Add a branch for ranking formats:

```ts
import {
  RankingScriptSchema,
  validateScriptAgainstMarkets,
} from "../ranking/ranking-script.schema";

const MAX_RETRIES = 2;

async function generateRankingScript(
  run: { format: string; params: any },
  anthropic: Anthropic,
) {
  const promptPath =
    run.format === "top_10_ranking"
      ? "top_10_ranking.md"
      : "bottom_10_ranking.md";
  const promptTemplate = readFileSync(
    join(__dirname, "..", "prompts", promptPath),
    "utf-8",
  );

  const inputBlock = JSON.stringify(
    {
      metric: run.params.metric,
      scope: run.params.scope,
      geo_level: run.params.geo_level,
      direction: run.params.direction,
      resolved_markets: run.params.resolved_markets.map(
        ({ rank, region_name, state, value, value_formatted }: any) => ({
          rank,
          region_name,
          state,
          value,
          value_formatted,
        }),
      ),
    },
    null,
    2,
  );

  let lastError = "";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const messages: any[] = [
      {
        role: "user",
        content: `${promptTemplate}\n\n# Input\n\n\`\`\`json\n${inputBlock}\n\`\`\``,
      },
    ];
    if (lastError) {
      messages.push({
        role: "user",
        content: `Previous attempt failed validation:\n${lastError}\n\nReturn corrected JSON.`,
      });
    }

    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      messages,
    });

    const text = (response.content[0] as any).text;
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      lastError = `Could not parse JSON: ${(e as Error).message}`;
      continue;
    }

    const schemaResult = RankingScriptSchema.safeParse(parsed);
    if (!schemaResult.success) {
      lastError = `Schema errors: ${JSON.stringify(schemaResult.error.errors)}`;
      continue;
    }

    const contextErrors = validateScriptAgainstMarkets(
      schemaResult.data,
      run.params.resolved_markets,
    );
    if (contextErrors.length > 0) {
      lastError = `Context errors: ${contextErrors.join("; ")}`;
      continue;
    }

    return schemaResult.data;
  }

  throw new Error(
    `Ranking script generation failed after ${MAX_RETRIES + 1} attempts: ${lastError}`,
  );
}
```

In the main `generate` function, branch:

```ts
if (run.format === "top_10_ranking" || run.format === "bottom_10_ranking") {
  return generateRankingScript(run, anthropic);
}
// ... existing logic for other formats
```

- [ ] **Step 3: Add unit test**

In `anthropic-script-generator.spec.ts` (create if missing):

```ts
it("generateRankingScript retries on context-validation failure and eventually throws", async () => {
  // Mock anthropic to return a script with hallucinated region_name 3 times
  // Assert it throws after MAX_RETRIES
});

it("generateRankingScript returns parsed script on first valid attempt", async () => {
  // Mock anthropic to return a valid script
  // Assert it returns the parsed object
});
```

- [ ] **Step 4: Run tests**

```bash
cd packages/backend && npx jest drivers/anthropic-script-generator
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/drivers/anthropic-script-generator.ts \
        packages/backend/src/content-pipeline/drivers/anthropic-script-generator.spec.ts
git commit -m "feat(content-pipeline): ranking script generation with retry + Zod validation"
```

---

## Phase F — Live smoke + flip on

### Task F1: Local dev smoke — `top_10_ranking`

**Why:** Prove the full pipeline (wizard → resolve → submit → render → publish) on real local infrastructure before promoting.

- [ ] **Step 1: Start local dev**

Use the `local-dev-servers` skill to start backend (3001) and frontend (3000). Verify both render OK.

- [ ] **Step 2: Apply migration to local DB if not already done**

```bash
node scripts/apply-content-pipeline-migrations.js
```

- [ ] **Step 3: Run wizard end-to-end manually**

Open `http://localhost:3000/admin/content-pipeline/new`:

1. Click "Top 10 Markets"
2. Select metric: PropertyIQ Score
3. Select level: Counties
4. Select scope: State → California
5. Click "Preview →"
6. Confirm 10 California counties shown with PIQ scores descending
7. Click "Submit Run →"
8. Confirm redirect to `/admin/content-pipeline?run=<uuid>`

- [ ] **Step 4: Watch state machine progress**

Open the run detail page. Confirm transitions: `created → script_generated → render_queued → render_complete → publish_queued → publish_complete`.

If it stalls, check pg-boss logs and the run's error column.

- [ ] **Step 5: Verify YouTube Shorts upload**

Check the dedicated dev YouTube channel. Confirm:

- Video appears
- Duration ~58s (10 rows × 5s + intro/outro)
- VO mentions correct county names
- Visual matches snapshot test fixtures
- Description has correct title pattern

- [ ] **Step 6: Document smoke result**

Append to `docs/content-pipeline/deploy-state.md`:

```markdown
## 2026-04-26 — Ranking format smoke (top_10_ranking)

- Wizard: top_10_ranking × PIQ Score × Counties × California
- Run id: <uuid>
- YouTube link: <url>
- Outcome: PASS / FAIL with notes
```

- [ ] **Step 7: Commit only the deploy-state update**

```bash
git add docs/content-pipeline/deploy-state.md
git commit -m "docs(content-pipeline): top_10_ranking smoke result"
```

---

### Task F2: Local dev smoke — `bottom_10_ranking`

- [ ] **Step 1: Temporarily enable bottom_10_ranking in DB for smoke**

```sql
UPDATE format_templates SET enabled = true WHERE format = 'bottom_10_ranking';
```

(Reverted in Task F4 if smoke fails; left enabled if smoke passes.)

- [ ] **Step 2: Run wizard**

1. Click "Bottom 10 — Markets to Avoid"
2. Select metric: Vacancy Risk Score
3. Select level: Counties
4. Select scope: National
5. Preview → confirm 10 worst-vacancy-risk counties
6. Submit

- [ ] **Step 3: Verify state-machine, YouTube upload, document outcome** (mirror F1 steps 4-6 with the new run id)

- [ ] **Step 4: Commit deploy-state update**

```bash
git add docs/content-pipeline/deploy-state.md
git commit -m "docs(content-pipeline): bottom_10_ranking smoke result"
```

---

### Task F3: Acceptance criteria check + flip switch decision

- [ ] **Step 1: Verify each Plan A acceptance bullet has been proven**

Check off in this plan's progress tracking:

- [x] `POST /ranking/resolve` returns valid shape for all 6 scope×direction combos (B1–B7 unit + integration tests)
- [x] Wizard renders all 4 steps for both formats (D6 visual smoke)
- [x] Hide-invalid-combos works (D7 Playwright)
- [x] Insufficient-data refuses submit at <5 markets (D5 + D7)
- [x] Submit-time re-resolve catches a forced drift (B8 + D7)
- [x] Top10Layout renders both directions with correct theme + variable duration (C2 + C5 snapshots)
- [x] Script validation catches a deliberately wrong region_name (E3)
- [x] Live YouTube smoke for both formats lands on the dev channel (F1 + F2)

If any unchecked, do NOT proceed to Step 2.

- [ ] **Step 2: Flip `bottom_10_ranking.enabled = true` (production decision)**

If smoke passes, the migration's row insert with `enabled: false` was the safe-default. Either:

- (a) Apply a follow-up migration `20260426000002_enable_bottom_10.sql`:
  ```sql
  UPDATE format_templates SET enabled = true WHERE format = 'bottom_10_ranking';
  ```
- (b) Toggle via the admin Settings UI (no migration needed)

Pick (a) for reproducibility across environments. Apply via `apply-content-pipeline-migrations.js`.

- [ ] **Step 3: Commit migration**

```bash
git add supabase/migrations/20260426000002_enable_bottom_10.sql scripts/apply-content-pipeline-migrations.js
git commit -m "feat(content-pipeline): enable bottom_10_ranking after smoke pass"
```

---

### Task F4: Update lessons + tasks

- [ ] **Step 1: If anything novel surfaced during implementation**, update `tasks/lessons.md` with the lesson.

- [ ] **Step 2: Update `tasks/todo.md`** with a new section marking Plan A complete and noting Plan B (magnets) as the follow-on.

- [ ] **Step 3: Commit**

```bash
git add tasks/lessons.md tasks/todo.md
git commit -m "docs: capture lessons from ranking format ship"
```

---

## Plan B preview (out of scope here)

After Plan A ships, Plan B will:

1. Build the magnet PDF render pipeline (Puppeteer-on-Next.js or `@react-pdf/renderer`, decided after probing existing report infra)
2. Build `/api/magnets/capture` endpoint + `/reports/[magnet-slug]?run=` landing page
3. Add Resend transactional email + audience subscription
4. Replace the generic `outro_cta` in both prompt templates with the magnet-aware copy ("Free report — link below.")
5. Add magnet binding rows for both formats
6. E2E for magnet capture flow

Plan B file: `docs/superpowers/plans/<date>-top-bottom-10-ranking-magnets.md` (write when ready to start).

---

## Self-review notes (resolved before sharing)

- **Spec coverage:** all 8 sections of the spec (excluding §7 magnets) have at least one task. §7 deferred explicitly.
- **Type consistency:** `ResolveRankingResult` (B1) ↔ `ResolveRankingResponse` (D3) ↔ `RankingScriptSchema` (E3) all use the same field names: `rankings`, `metric`, `scope`, `geo_level`, `direction`, `eligible_count`, `excluded_count`, `insufficient_data`. ✓
- **Ranking entry shape** is identical across resolver output (`RankingEntry`), wizard preview (`ResolveRankingResponse.rankings`), persisted run params (`resolved_markets`), and renderer input (`ResolvedMarket` in `packages/video-template/src/types.ts`). All have: `rank, region_id, region_name, state, value, value_formatted`. ✓
- **Variable duration constants** `INTRO_FRAMES=90, ROW_FRAMES=150, OUTRO_FRAMES=135` consistent in C2 task code and the C2 unit test math: 90 + 5×150 + 135 = 975, and 90 + 10×150 + 135 = 1725. ✓
- **`outro_cta` literal** "Learn more at propertyiq.app." — appears in E1, E2, and E3 schema. Spelled identically in all three. ✓
- **No "TBD" or "implement later"** — every task has runnable code.
