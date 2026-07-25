# Market Detail Redesign (Hybrid: AI headline + primary chart + metric rail) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/market/[id]` detail page from an AI-6-section-plus-metric-grid layout into a Hybrid experience — a short AI-written headline framing at the top, then one large switchable time-series chart (the page spine) beside a slim rail of secondary metrics that highlights in sync with whatever is charted.

**Architecture:** Reuse the existing mature pieces rather than rebuild them: the `useMarketSnapshot` hook (one call for all metric cards + scores), the D3 `AnimatedTimeSeriesChart` (a clean, single-market-with-optional-comparison time-series renderer) behind a thin wrapper that owns metric/timeframe state and calls `useTimeSeriesData`, the ready-made connected `ScoreGaugeWidget` for the score, and the same backend AI pipeline (`ReportAiService.complete` → `AI_PURPOSES.REPORT_NARRATIVE`, Redis-cached 24h) — but with a NEW, much shorter headline prompt/endpoint alongside (not replacing) the existing 6-section one. The page composes: `DashboardHeader` → `MarketHeadline` → grid[`MarketPrimaryChart` (spine) | `MetricRail` (score gauge + clickable metric rows)].

**Tech Stack:** Next.js 16 App Router (React 19, `"use client"`), TanStack React Query 5, D3 (via `@/lib/visualizations/d3`), Tailwind CSS 4 with M3 semantic tokens, NestJS 11 backend, Redis (ioredis), Vitest (frontend) + Jest (backend) for tests.

## Global Constraints

_Every task's requirements implicitly include this section (copied verbatim from `D:\Projects\rei-platform\CLAUDE.md`)._

- **All frontend data fetching MUST go through `@/lib/data`.** Never call `fetch(${API_URL}/...)` outside `lib/data/fetchers/`. If an endpoint doesn't exist: add to `lib/data/fetchers/` → export from `lib/data/index.ts` → then use.
- **Metric config is centralized.** `packages/frontend/app/map/config/metrics.ts` / `lib/data/registry.ts` are the ONLY source of truth for metric names/formats. NEVER duplicate metric names/formats. NEVER format values manually — use `formatMetricValue()` / `getMetricFormat()` from `@/lib/data`.
- **Score labels are momentum/timing words, NOT quality verdicts.** Canonical labels: 90+ VERY STRONG, 80-89 STRONG, 70-79 RISING, 60-69 FIRMING, 50-59 STEADY, 40-49 EASING, 20-39 WEAK, <20 VERY WEAK. `50 = the market's state average`. NEVER reintroduce quality words (EXCELLENT/GOOD/POOR/etc.). Canonical util: `getScoreLabel()` in `app/components/scoring/ScoreDisplay.tsx`.
- **AI prose style (strict).** No markdown/formatting (no bold, italics, headers, bullets, backticks), no em-dashes (use a comma, period, or "and"), no code-style identifiers (write field names in plain English), keep all numbers exact.
- **All backend AI calls route through `AiProviderService`** (via `ReportAiService`) for cost guardrails (completion cache + daily spend cap). Do NOT introduce a new `AI_PURPOSES` entry unless genuinely needed — reuse `REPORT_NARRATIVE`.
- **File size limits.** Logic files target <200 / hard limit 300 lines. React components target <300 / hard limit 400 lines. One exported component per file with its local helpers.
- **Naming.** Every name descriptive and self-explanatory.
- **Simplicity / YAGNI / DRY / TDD / frequent commits.** Touch only what's necessary. Find root causes, no temporary fixes.

### Resolved open items (decisions locked for this plan)

1. **Rail metric set + ordering:** `['home_value', 'rent_index', 'cap_rate', 'days_on_market', 'months_of_supply', 'home_value_yoy']` — codified as `RAIL_METRIC_IDS`. Rationale: these are the highest-signal secondaries already shown on this page today (drawn from the `affordability`/`cash_flow`/`market_competition`/`appreciation` categories in `app/(app)/map/config/metric-categories.tsx`), they span all geo levels, and they map cleanly to the "Home Value / Rent / Cap Rate / DOM / Supply" set named in the brief. `home_value` is first so it is the default charted metric. **The PropertyIQ Score is deliberately NOT in the switchable chart set** — it has its own dedicated `ScoreGaugeWidget` at the top of the rail, and its history comes from a different data source (`useScoreData`) than the `useTimeSeriesData` engine that drives the chart; mixing them would couple two data layers into one chart for no real gain (the brief lists "Score" only as an "e.g.").
2. **AI headline caching:** Reuse the existing 24h Redis cache pattern with a NEW key (`piq:market-headline:v1:<geoType>:<geoId>:<audience>`) and the EXISTING `AI_PURPOSES.REPORT_NARRATIVE` purpose (no new purpose). Rationale: same cache-invalidation properties as today, just a shorter prompt/response and a distinct key so the headline and the legacy 6-section analysis never collide. Audience is in the key because the framing differs for homebuyer vs investor.
3. **Reframe vs. modify:** The old `AIMarketAnalysis.tsx` (6 fixed sections) is REPLACED on this page by a new lightweight `MarketHeadline.tsx`. `AIMarketAnalysis.tsx` and its helper `market-analysis-template.ts` are consumed ONLY by `MarketDashboard.tsx` (verified), so they are deleted in the final task. The backend 6-section endpoint (`POST :geoType/:geoId/ai-analysis`) and its fetcher are LEFT intact (out of scope, low blast radius); the new headline is a NEW sibling endpoint (`POST :geoType/:geoId/ai-headline`).

---

## Task 1: Backend headline prompt + deterministic fallback (pure functions)

**Files:**

- Create: `packages/backend/src/market-analysis/market-headline-prompt.ts`
- Test: `packages/backend/src/market-analysis/market-headline-prompt.spec.ts`

**Interfaces:**

- Consumes: nothing (leaf module).
- Produces:
  - `interface HeadlineRequest { geoType: string; geoId: string; geoName: string; audience: 'homebuyer' | 'investor'; metrics: Record<string, { value: number | null; formatted: string; change: number | null }>; scores: { propertyiq: { score: number; grade: string } }; }`
  - `interface HeadlineContent { headline: string; summary: string; }`
  - `function scoreMomentumWord(score: number): string`
  - `function buildHeadlinePrompt(request: HeadlineRequest): string`
  - `function buildHeadlineFallback(request: HeadlineRequest): HeadlineContent`

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/market-analysis/market-headline-prompt.spec.ts
import {
  scoreMomentumWord,
  buildHeadlinePrompt,
  buildHeadlineFallback,
  type HeadlineRequest,
} from "./market-headline-prompt";

const request: HeadlineRequest = {
  geoType: "metro",
  geoId: "12420",
  geoName: "Austin, TX",
  audience: "homebuyer",
  metrics: {
    home_value: { value: 455000, formatted: "$455K", change: 3.1 },
    days_on_market: { value: 48, formatted: "48 days", change: -5.0 },
    rent_index: { value: 1850, formatted: "$1,850", change: null },
  },
  scores: { propertyiq: { score: 62, grade: "B" } },
};

describe("scoreMomentumWord maps to the CLAUDE.md §9 momentum labels", () => {
  it("uses momentum words, never quality words", () => {
    expect(scoreMomentumWord(95)).toBe("VERY STRONG");
    expect(scoreMomentumWord(85)).toBe("STRONG");
    expect(scoreMomentumWord(72)).toBe("RISING");
    expect(scoreMomentumWord(62)).toBe("FIRMING");
    expect(scoreMomentumWord(55)).toBe("STEADY");
    expect(scoreMomentumWord(45)).toBe("EASING");
    expect(scoreMomentumWord(30)).toBe("WEAK");
    expect(scoreMomentumWord(10)).toBe("VERY WEAK");
  });
});

describe("buildHeadlinePrompt produces a short, grounded, momentum-framed prompt", () => {
  const prompt = buildHeadlinePrompt(request);

  it("names the market and the audience", () => {
    expect(prompt).toContain("Austin, TX");
    expect(prompt).toContain("homebuyer");
  });

  it("asks for a short headline and a two-to-three-sentence summary", () => {
    expect(prompt).toContain("no more than 8 words");
    expect(prompt).toContain("two to three sentences");
  });

  it("restates the data-grounding and plain-prose rules", () => {
    expect(prompt).toContain("Use ONLY the data provided");
    expect(prompt).toContain("no em-dashes");
    expect(prompt).toContain("no markdown");
  });

  it("forbids quality verdicts and frames the score as momentum", () => {
    expect(prompt).toContain("momentum");
    expect(prompt).toContain("never a quality verdict");
  });

  it("requests the exact JSON shape", () => {
    expect(prompt).toContain('{"headline":"...","summary":"..."}');
  });

  it("only lists metrics that have values", () => {
    expect(prompt).toContain("$455K");
    expect(prompt).not.toContain("rent_index");
  });
});

describe("buildHeadlineFallback returns a deterministic momentum framing", () => {
  const content = buildHeadlineFallback(request);

  it("produces a non-empty headline and summary naming the market", () => {
    expect(content.headline.length).toBeGreaterThan(0);
    expect(content.summary.length).toBeGreaterThan(0);
    expect(content.summary).toContain("Austin, TX");
  });

  it("uses a momentum word, never a quality word", () => {
    expect(content.summary.toLowerCase()).toContain("firming");
    expect(content.summary.toLowerCase()).not.toMatch(
      /good|bad|excellent|poor/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/backend`): `npx jest src/market-analysis/market-headline-prompt.spec.ts`
Expected: FAIL with "Cannot find module './market-headline-prompt'".

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/backend/src/market-analysis/market-headline-prompt.ts

export interface HeadlineRequest {
  geoType: string;
  geoId: string;
  geoName: string;
  audience: "homebuyer" | "investor";
  metrics: Record<
    string,
    { value: number | null; formatted: string; change: number | null }
  >;
  scores: { propertyiq: { score: number; grade: string } };
}

export interface HeadlineContent {
  headline: string;
  summary: string;
}

// Restated verbatim from src/insights/insight-prompts.ts so the headline prompt
// carries the same guarantees the report/insight narratives already rely on.
const DATA_GROUNDING_RULE =
  "Use ONLY the data provided below. Do not fabricate or assume any numbers. If data is missing, say so.";
const PLAIN_PROSE_RULE =
  'Write plain prose only: no markdown or formatting (no bold, italics, headers, bullets, or backticks), no em-dashes (use a comma, period, or "and"), and no code-style identifiers (write field names in plain English). Keep all numbers exact.';

/**
 * CLAUDE.md §9 momentum labels. Momentum/timing words only — never quality
 * verdicts (a low score means cooling momentum, not a poor-quality market).
 */
export function scoreMomentumWord(score: number): string {
  if (score >= 90) return "VERY STRONG";
  if (score >= 80) return "STRONG";
  if (score >= 70) return "RISING";
  if (score >= 60) return "FIRMING";
  if (score >= 50) return "STEADY";
  if (score >= 40) return "EASING";
  if (score >= 20) return "WEAK";
  return "VERY WEAK";
}

export function buildHeadlinePrompt(request: HeadlineRequest): string {
  const { geoName, metrics, scores, audience } = request;

  const metricsBlock = Object.entries(metrics)
    .filter(([, v]) => v.value != null)
    .map(([key, v]) => {
      const changePart =
        v.change != null
          ? ` (${v.change >= 0 ? "+" : ""}${v.change.toFixed(1)}% YoY)`
          : "";
      return `- ${key.replace(/_/g, " ")}: ${v.formatted}${changePart}`;
    })
    .join("\n");

  const momentum = scoreMomentumWord(scores.propertyiq.score);

  return `You are a sharp, experienced real estate market analyst. Write a SHORT framing for ${geoName} for a ${audience} audience.

Market Data for ${geoName}:
${metricsBlock}

PropertyIQ Score: ${scores.propertyiq.score}/100 (momentum reads ${momentum}; 50 = the market's state average, higher = stronger demand momentum).

Write exactly two things:
1. "headline": a punchy framing of no more than 8 words. Describe the market's momentum or direction, never a quality verdict. Good: "Prices firming, buyers still have room". Bad: "Great market" or "Poor market".
2. "summary": two to three sentences, 40 to 60 words total. Reference two or three specific numbers from the data above. Speak to the ${audience}. End with one plain, practical takeaway sentence.

${DATA_GROUNDING_RULE}
${PLAIN_PROSE_RULE}
The PropertyIQ Score is a momentum and timing signal, not a quality grade. Use momentum words (rising, firming, steady, easing, cooling), never quality words (good, bad, excellent, poor).

Respond in this exact JSON format:
{"headline":"...","summary":"..."}`;
}

export function buildHeadlineFallback(
  request: HeadlineRequest,
): HeadlineContent {
  const { geoName, scores, metrics } = request;
  const momentum = scoreMomentumWord(scores.propertyiq.score).toLowerCase();

  const parts: string[] = [
    `${geoName} is showing ${momentum} demand momentum with a PropertyIQ Score of ${scores.propertyiq.score}.`,
  ];

  const homeValue = metrics.home_value;
  if (homeValue?.value != null) {
    const yoyPart =
      homeValue.change != null
        ? `, ${homeValue.change >= 0 ? "up" : "down"} ${Math.abs(homeValue.change).toFixed(1)}% year over year`
        : "";
    parts.push(
      `The typical home is valued around ${homeValue.formatted}${yoyPart}.`,
    );
  }

  parts.push("Review the metrics below to see where this market is heading.");

  return {
    headline: `${geoName}: ${momentum} momentum`,
    summary: parts.join(" "),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `packages/backend`): `npx jest src/market-analysis/market-headline-prompt.spec.ts`
Expected: PASS (all specs green).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/market-analysis/market-headline-prompt.ts packages/backend/src/market-analysis/market-headline-prompt.spec.ts
git commit -m "feat(market-headline): add short-headline prompt + deterministic fallback (pure)"
```

---

## Task 2: Backend MarketHeadlineService + controller route + module wiring

**Files:**

- Create: `packages/backend/src/market-analysis/market-headline.service.ts`
- Test: `packages/backend/src/market-analysis/market-headline.service.spec.ts`
- Modify: `packages/backend/src/market-analysis/market-analysis.controller.ts:1-53`
- Modify: `packages/backend/src/market-analysis/market-analysis.module.ts:1-11`

**Interfaces:**

- Consumes: `HeadlineRequest`, `HeadlineContent`, `buildHeadlinePrompt`, `buildHeadlineFallback` from `./market-headline-prompt` (Task 1); `ReportAiService.complete(prompt: string, maxTokens: number): Promise<string>` and `ReportAiService.isAvailable(): boolean` from `../reports/report-ai.service`; `RedisService.getByKey(key)` / `RedisService.setByKey(key, value, ttlSeconds)` from `../redis/redis.service`; `extractJsonObject<T>(response: string): T` from `../ai/extract-json`.
- Produces:
  - `interface MarketHeadlineResult { headline: string; summary: string; generatedAt: string; cached: boolean; }`
  - `class MarketHeadlineService { generateHeadline(request: HeadlineRequest): Promise<MarketHeadlineResult> }`
  - HTTP: `POST /api/markets/:geoType/:geoId/ai-headline` → `{ success: true; headline: MarketHeadlineResult }`, body `{ geoName, audience, metrics, scores }`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/market-analysis/market-headline.service.spec.ts
import { MarketHeadlineService } from "./market-headline.service";
import type { HeadlineRequest } from "./market-headline-prompt";

const request: HeadlineRequest = {
  geoType: "metro",
  geoId: "12420",
  geoName: "Austin, TX",
  audience: "homebuyer",
  metrics: { home_value: { value: 455000, formatted: "$455K", change: 3.1 } },
  scores: { propertyiq: { score: 62, grade: "B" } },
};

function makeRedis() {
  const store = new Map<string, unknown>();
  return {
    getByKey: jest.fn(async (k: string) => store.get(k) ?? null),
    setByKey: jest.fn(async (k: string, v: unknown) => {
      store.set(k, v);
    }),
  };
}

describe("MarketHeadlineService", () => {
  it("returns parsed AI headline JSON when AI is available", async () => {
    const redis = makeRedis();
    const reportAi = {
      isAvailable: () => true,
      complete: jest.fn(
        async () =>
          '{"headline":"Prices firming, room to negotiate","summary":"Austin, TX is firming."}',
      ),
    };
    const service = new MarketHeadlineService(reportAi as any, redis as any);

    const result = await service.generateHeadline(request);

    expect(result.headline).toBe("Prices firming, room to negotiate");
    expect(result.summary).toBe("Austin, TX is firming.");
    expect(result.cached).toBe(false);
    expect(reportAi.complete).toHaveBeenCalledTimes(1);
  });

  it("serves the second call from the Redis cache without re-calling AI", async () => {
    const redis = makeRedis();
    const reportAi = {
      isAvailable: () => true,
      complete: jest.fn(async () => '{"headline":"H","summary":"S"}'),
    };
    const service = new MarketHeadlineService(reportAi as any, redis as any);

    await service.generateHeadline(request);
    const second = await service.generateHeadline(request);

    expect(second.cached).toBe(true);
    expect(reportAi.complete).toHaveBeenCalledTimes(1);
  });

  it("falls back deterministically when AI is unavailable", async () => {
    const redis = makeRedis();
    const reportAi = { isAvailable: () => false, complete: jest.fn() };
    const service = new MarketHeadlineService(reportAi as any, redis as any);

    const result = await service.generateHeadline(request);

    expect(reportAi.complete).not.toHaveBeenCalled();
    expect(result.summary).toContain("Austin, TX");
    expect(result.headline.length).toBeGreaterThan(0);
  });

  it("falls back deterministically when the AI response cannot be parsed", async () => {
    const redis = makeRedis();
    const reportAi = {
      isAvailable: () => true,
      complete: jest.fn(async () => "not json at all"),
    };
    const service = new MarketHeadlineService(reportAi as any, redis as any);

    const result = await service.generateHeadline(request);

    expect(result.summary).toContain("Austin, TX");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/backend`): `npx jest src/market-analysis/market-headline.service.spec.ts`
Expected: FAIL with "Cannot find module './market-headline.service'".

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/backend/src/market-analysis/market-headline.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { ReportAiService } from "../reports/report-ai.service";
import { RedisService } from "../redis/redis.service";
import { extractJsonObject } from "../ai/extract-json";
import {
  buildHeadlinePrompt,
  buildHeadlineFallback,
  type HeadlineRequest,
  type HeadlineContent,
} from "./market-headline-prompt";

export interface MarketHeadlineResult {
  headline: string;
  summary: string;
  generatedAt: string;
  cached: boolean;
}

// 24h — same freshness contract as the 6-section analysis; inputs change slowly.
const CACHE_TTL_SECONDS = 86400;

@Injectable()
export class MarketHeadlineService {
  private readonly logger = new Logger(MarketHeadlineService.name);
  private readonly inflight = new Map<string, Promise<MarketHeadlineResult>>();

  constructor(
    private readonly reportAiService: ReportAiService,
    private readonly redisService: RedisService,
  ) {}

  async generateHeadline(
    request: HeadlineRequest,
  ): Promise<MarketHeadlineResult> {
    const cacheKey = `piq:market-headline:v1:${request.geoType}:${request.geoId}:${request.audience}`;

    const cached = await this.redisService.getByKey(cacheKey);
    if (cached) {
      return { ...(cached as MarketHeadlineResult), cached: true };
    }

    const existing = this.inflight.get(cacheKey);
    if (existing) return existing;

    const promise = this.computeAndCache(request, cacheKey);
    this.inflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  private async computeAndCache(
    request: HeadlineRequest,
    cacheKey: string,
  ): Promise<MarketHeadlineResult> {
    let content: HeadlineContent;

    if (this.reportAiService.isAvailable()) {
      content = await this.generateWithAi(request);
    } else {
      this.logger.warn("[MarketHeadline] AI unavailable, using fallback");
      content = buildHeadlineFallback(request);
    }

    const result: MarketHeadlineResult = {
      headline: content.headline,
      summary: content.summary,
      generatedAt: new Date().toISOString(),
      cached: false,
    };

    await this.redisService.setByKey(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  }

  private async generateWithAi(
    request: HeadlineRequest,
  ): Promise<HeadlineContent> {
    try {
      // Short output — 500 tokens is ample for a headline + 3 sentences and keeps
      // this well under the report-narrative cost of the 6-section analysis.
      const response = await this.reportAiService.complete(
        buildHeadlinePrompt(request),
        500,
      );
      const parsed = extractJsonObject<{ headline?: string; summary?: string }>(
        response,
      );
      if (
        typeof parsed.headline === "string" &&
        typeof parsed.summary === "string"
      ) {
        return { headline: parsed.headline, summary: parsed.summary };
      }
      throw new Error("MarketHeadline: AI response missing headline/summary");
    } catch (error) {
      this.logger.error(
        `[MarketHeadline] AI generation failed: ${error.message}`,
      );
      return buildHeadlineFallback(request);
    }
  }
}
```

Then modify the controller to inject the service and add the route. The current file (`market-analysis.controller.ts`) ends its constructor and single `@Post` method as shown; replace the constructor line and append the new route + body interface. Full updated file:

```ts
// packages/backend/src/market-analysis/market-analysis.controller.ts
import {
  Controller,
  Post,
  Param,
  Body,
  Logger,
  UseGuards,
} from "@nestjs/common";
import {
  MarketAnalysisService,
  MarketAnalysisResult,
} from "./market-analysis.service";
import {
  MarketHeadlineService,
  MarketHeadlineResult,
} from "./market-headline.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

interface MarketAnalysisBody {
  geoName: string;
  metrics: Record<
    string,
    { value: number | null; formatted: string; change: number | null }
  >;
  scores: {
    propertyiq: { score: number; grade: string };
  };
  lastUpdated?: string;
}

interface MarketHeadlineBody {
  geoName: string;
  audience: "homebuyer" | "investor";
  metrics: Record<
    string,
    { value: number | null; formatted: string; change: number | null }
  >;
  scores: {
    propertyiq: { score: number; grade: string };
  };
}

@Controller("api/markets")
export class MarketAnalysisController {
  private readonly logger = new Logger(MarketAnalysisController.name);

  constructor(
    private readonly marketAnalysisService: MarketAnalysisService,
    private readonly marketHeadlineService: MarketHeadlineService,
  ) {}

  @Post(":geoType/:geoId/ai-analysis")
  @UseGuards(JwtAuthGuard)
  async getAnalysis(
    @Param("geoType") geoType: string,
    @Param("geoId") geoId: string,
    @Body() body: MarketAnalysisBody,
  ): Promise<{ success: boolean; analysis: MarketAnalysisResult }> {
    this.logger.log(`[AI Analysis] ${body.geoName} (${geoType}/${geoId})`);

    const analysis = await this.marketAnalysisService.generateAnalysis({
      geoType,
      geoId,
      geoName: body.geoName,
      metrics: body.metrics,
      scores: body.scores,
      lastUpdated: body.lastUpdated,
    });

    return { success: true, analysis };
  }

  @Post(":geoType/:geoId/ai-headline")
  @UseGuards(JwtAuthGuard)
  async getHeadline(
    @Param("geoType") geoType: string,
    @Param("geoId") geoId: string,
    @Body() body: MarketHeadlineBody,
  ): Promise<{ success: boolean; headline: MarketHeadlineResult }> {
    this.logger.log(`[AI Headline] ${body.geoName} (${geoType}/${geoId})`);

    const headline = await this.marketHeadlineService.generateHeadline({
      geoType,
      geoId,
      geoName: body.geoName,
      audience: body.audience,
      metrics: body.metrics,
      scores: body.scores,
    });

    return { success: true, headline };
  }
}
```

Then register the provider. Full updated module:

```ts
// packages/backend/src/market-analysis/market-analysis.module.ts
import { Module } from "@nestjs/common";
import { MarketAnalysisController } from "./market-analysis.controller";
import { MarketAnalysisService } from "./market-analysis.service";
import { MarketHeadlineService } from "./market-headline.service";
import { ReportsModule } from "../reports/reports.module";

@Module({
  imports: [ReportsModule],
  controllers: [MarketAnalysisController],
  providers: [MarketAnalysisService, MarketHeadlineService],
})
export class MarketAnalysisModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `packages/backend`): `npx jest src/market-analysis/market-headline.service.spec.ts`
Expected: PASS (4 specs green).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/market-analysis/market-headline.service.ts packages/backend/src/market-analysis/market-headline.service.spec.ts packages/backend/src/market-analysis/market-analysis.controller.ts packages/backend/src/market-analysis/market-analysis.module.ts
git commit -m "feat(market-headline): add MarketHeadlineService + ai-headline route (24h cache, report_narrative purpose)"
```

---

## Task 3: Frontend fetcher `fetchMarketHeadline` + data-layer export

**Files:**

- Create: `packages/frontend/lib/data/fetchers/market-headline.ts`
- Modify: `packages/frontend/lib/data/index.ts` (add exports near the existing `fetchMarketAnalysis` export)
- Test: `packages/frontend/lib/data/fetchers/__tests__/market-headline.test.ts`

**Interfaces:**

- Consumes: `API_URL` from `./base`; `getAuthHeaders` from `./auth-headers` (both already used by the sibling `market-analysis.ts` fetcher).
- Produces:
  - `interface MarketHeadlineResult { headline: string; summary: string; generatedAt: string; cached: boolean; }`
  - `function fetchMarketHeadline(geoType: string, geoId: string, payload: { geoName: string; audience: 'homebuyer' | 'investor'; metrics: Record<string, { value: number | null; formatted: string; change: number | null }>; scores: { propertyiq: { score: number; grade: string } | null }; }): Promise<MarketHeadlineResult>`

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/lib/data/fetchers/__tests__/market-headline.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchMarketHeadline } from "../market-headline";

vi.mock("../auth-headers", () => ({
  getAuthHeaders: async () => ({ Authorization: "Bearer test-token" }),
}));

describe("fetchMarketHeadline", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          headline: {
            headline: "Prices firming",
            summary: "Austin is firming.",
            generatedAt: "2026-07-14T00:00:00.000Z",
            cached: false,
          },
        }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs to the ai-headline route and unwraps the headline payload", async () => {
    const result = await fetchMarketHeadline("metro", "12420", {
      geoName: "Austin, TX",
      audience: "homebuyer",
      metrics: {
        home_value: { value: 455000, formatted: "$455K", change: 3.1 },
      },
      scores: { propertyiq: { score: 62, grade: "B" } },
    });

    expect(result.headline).toBe("Prices firming");
    expect(result.summary).toBe("Austin is firming.");

    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(call[0])).toContain("/api/markets/metro/12420/ai-headline");
    expect(call[1].method).toBe("POST");
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    );
    await expect(
      fetchMarketHeadline("metro", "12420", {
        geoName: "Austin, TX",
        audience: "investor",
        metrics: {},
        scores: { propertyiq: null },
      }),
    ).rejects.toThrow("AI headline request failed: 500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/frontend`): `npx vitest run lib/data/fetchers/__tests__/market-headline.test.ts`
Expected: FAIL with "Failed to resolve import ... ../market-headline" (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/frontend/lib/data/fetchers/market-headline.ts
/**
 * MARKET HEADLINE FETCHER
 *
 * Fetches the short AI-written headline + summary framing for the market
 * detail page. Mirrors market-analysis.ts (same auth + POST contract), but
 * hits the lighter ai-headline route.
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface MarketHeadlineResult {
  headline: string;
  summary: string;
  generatedAt: string;
  cached: boolean;
}

export async function fetchMarketHeadline(
  geoType: string,
  geoId: string,
  payload: {
    geoName: string;
    audience: "homebuyer" | "investor";
    metrics: Record<
      string,
      { value: number | null; formatted: string; change: number | null }
    >;
    scores: {
      propertyiq: { score: number; grade: string } | null;
    };
  },
): Promise<MarketHeadlineResult> {
  const url = `${API_URL}/api/markets/${geoType}/${geoId}/ai-headline`;
  // Same JwtAuthGuard contract as every other authed fetcher — needs the
  // Supabase JWT in an Authorization: Bearer header (cookies alone are not honored).
  const authHeaders = await getAuthHeaders();

  const response = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      geoName: payload.geoName,
      audience: payload.audience,
      metrics: payload.metrics,
      scores: payload.scores,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI headline request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.headline;
}
```

Then export it from the data layer. In `packages/frontend/lib/data/index.ts`, find the existing market-analysis export block (it exports `fetchMarketAnalysis`, `type MarketAnalysisSection`, `type MarketAnalysisResult`) and add directly beneath it:

```ts
export { fetchMarketHeadline } from "./fetchers/market-headline";
export type { MarketHeadlineResult } from "./fetchers/market-headline";
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `packages/frontend`): `npx vitest run lib/data/fetchers/__tests__/market-headline.test.ts`
Expected: PASS (2 specs green).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/data/fetchers/market-headline.ts packages/frontend/lib/data/fetchers/__tests__/market-headline.test.ts packages/frontend/lib/data/index.ts
git commit -m "feat(data): add fetchMarketHeadline fetcher + data-layer export"
```

---

## Task 4: Frontend rail metric constants + pure helpers

**Files:**

- Create: `packages/frontend/app/(app)/market/[id]/components/market-rail-metrics.ts`
- Test: `packages/frontend/app/(app)/market/[id]/components/__tests__/market-rail-metrics.test.ts`

**Interfaces:**

- Consumes: `isMetricSupportedForGeo`, `type GeoLevel` from `@/lib/data`; `type TimeFrame` from `@/app/graphs/hooks/useGraphsState` (union `"1Y" | "3Y" | "5Y" | "10Y" | "Max"`).
- Produces:
  - `const RAIL_METRIC_IDS: readonly string[]` = `['home_value', 'rent_index', 'cap_rate', 'days_on_market', 'months_of_supply', 'home_value_yoy']`
  - `function timeFrameToHistoryMonths(tf: TimeFrame): number`
  - `function pickDefaultRailMetric(cards: Record<string, { value: number | null }>, geoType: string): string`

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/app/(app)/market/[id]/components/__tests__/market-rail-metrics.test.ts
import { describe, it, expect, vi } from "vitest";

// isMetricSupportedForGeo is data-layer config; stub it so the helper logic is
// tested in isolation (home_value + rent_index supported, cap_rate not).
vi.mock("@/lib/data", () => ({
  isMetricSupportedForGeo: (id: string) =>
    id === "home_value" || id === "rent_index" || id === "days_on_market",
}));

import {
  RAIL_METRIC_IDS,
  timeFrameToHistoryMonths,
  pickDefaultRailMetric,
} from "../market-rail-metrics";

describe("RAIL_METRIC_IDS", () => {
  it("lists the six secondary metrics with home_value first", () => {
    expect(RAIL_METRIC_IDS[0]).toBe("home_value");
    expect(RAIL_METRIC_IDS).toHaveLength(6);
    expect(RAIL_METRIC_IDS).toContain("cap_rate");
  });
});

describe("timeFrameToHistoryMonths", () => {
  it("maps each timeframe to a month count", () => {
    expect(timeFrameToHistoryMonths("1Y")).toBe(12);
    expect(timeFrameToHistoryMonths("3Y")).toBe(36);
    expect(timeFrameToHistoryMonths("5Y")).toBe(60);
    expect(timeFrameToHistoryMonths("10Y")).toBe(120);
    expect(timeFrameToHistoryMonths("Max")).toBe(240);
  });
});

describe("pickDefaultRailMetric", () => {
  it("prefers home_value when supported and present", () => {
    const cards = {
      home_value: { value: 455000 },
      rent_index: { value: 1850 },
    };
    expect(pickDefaultRailMetric(cards, "metro")).toBe("home_value");
  });

  it("falls through to the next supported metric with a value", () => {
    const cards = {
      home_value: { value: null },
      rent_index: { value: 1850 },
    };
    expect(pickDefaultRailMetric(cards, "metro")).toBe("rent_index");
  });

  it("defaults to the first rail metric when nothing has a value", () => {
    expect(pickDefaultRailMetric({}, "metro")).toBe("home_value");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/frontend`): `npx vitest run "app/(app)/market/[id]/components/__tests__/market-rail-metrics.test.ts"`
Expected: FAIL with "Failed to resolve import ... ../market-rail-metrics".

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/frontend/app/(app)/market/[id]/components/market-rail-metrics.ts
import { isMetricSupportedForGeo, type GeoLevel } from "@/lib/data";
import type { TimeFrame } from "@/app/graphs/hooks/useGraphsState";

/**
 * The secondary metrics shown in the market-detail rail and offered as
 * switchable series for the primary chart. Ordered by signal priority;
 * home_value is first so it is the default charted metric.
 */
export const RAIL_METRIC_IDS: readonly string[] = [
  "home_value",
  "rent_index",
  "cap_rate",
  "days_on_market",
  "months_of_supply",
  "home_value_yoy",
];

/** Months of history to request for a given chart timeframe. */
export function timeFrameToHistoryMonths(tf: TimeFrame): number {
  switch (tf) {
    case "1Y":
      return 12;
    case "3Y":
      return 36;
    case "5Y":
      return 60;
    case "10Y":
      return 120;
    case "Max":
      return 240;
  }
}

/**
 * First rail metric that is supported for this geography AND has a live value,
 * preferring the configured order (home_value first). Falls back to the first
 * rail metric so the chart always has a valid selection.
 */
export function pickDefaultRailMetric(
  cards: Record<string, { value: number | null }>,
  geoType: string,
): string {
  const firstSupported = RAIL_METRIC_IDS.find(
    (id) =>
      isMetricSupportedForGeo(id, geoType as GeoLevel) &&
      cards[id]?.value != null,
  );
  return firstSupported ?? RAIL_METRIC_IDS[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `packages/frontend`): `npx vitest run "app/(app)/market/[id]/components/__tests__/market-rail-metrics.test.ts"`
Expected: PASS (3 describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/[id]/components/market-rail-metrics.ts" "packages/frontend/app/(app)/market/[id]/components/__tests__/market-rail-metrics.test.ts"
git commit -m "feat(market): add rail metric constants + timeframe/default-metric helpers"
```

---

## Task 5: Client-side deterministic headline summary (pure)

**Files:**

- Create: `packages/frontend/app/(app)/market/[id]/market-headline-summary.ts`
- Test: `packages/frontend/app/(app)/market/[id]/__tests__/market-headline-summary.test.ts`

**Interfaces:**

- Consumes: `getScoreLabel` from `@/app/components/scoring/ScoreDisplay` (the canonical §9 momentum label — SSOT).
- Produces:
  - `interface HeadlineSummary { headline: string; summary: string; }`
  - `function buildHeadlineSummary(marketName: string, score: number | null, cards: Record<string, { formattedValue: string; percentChange: number | null; value: number | null }>): HeadlineSummary`

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/app/(app)/market/[id]/__tests__/market-headline-summary.test.ts
import { describe, it, expect } from "vitest";
import { buildHeadlineSummary } from "../market-headline-summary";

describe("buildHeadlineSummary", () => {
  it("frames the market with a momentum word and the score", () => {
    const result = buildHeadlineSummary("Austin, TX", 62, {
      home_value: {
        formattedValue: "$455K",
        percentChange: 3.1,
        value: 455000,
      },
    });
    // getScoreLabel(62) === 'FIRMING'
    expect(result.summary.toLowerCase()).toContain("firming");
    expect(result.summary).toContain("62");
    expect(result.summary).toContain("$455K");
    expect(result.summary).toContain("up 3.1% year over year");
    expect(result.headline.toLowerCase()).toContain("firming momentum");
  });

  it("never uses quality words", () => {
    const result = buildHeadlineSummary("Toledo, OH", 30, {
      home_value: {
        formattedValue: "$120K",
        percentChange: -1.2,
        value: 120000,
      },
    });
    expect(result.summary.toLowerCase()).not.toMatch(/good|bad|excellent|poor/);
    expect(result.summary).toContain("down 1.2% year over year");
  });

  it("returns a neutral overview when the score is unavailable", () => {
    const result = buildHeadlineSummary("Nowhere, USA", null, {});
    expect(result.headline).toContain("Nowhere, USA");
    expect(result.summary).toContain("Nowhere, USA");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/frontend`): `npx vitest run "app/(app)/market/[id]/__tests__/market-headline-summary.test.ts"`
Expected: FAIL with "Failed to resolve import ... ../market-headline-summary".

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/frontend/app/(app)/market/[id]/market-headline-summary.ts
import { getScoreLabel } from "@/app/components/scoring/ScoreDisplay";

export interface HeadlineSummary {
  headline: string;
  summary: string;
}

/**
 * Deterministic, no-AI framing for the market headline. Shown to users without
 * the ai_insights entitlement, and as the client-side fallback if the AI call
 * fails. Uses getScoreLabel (canonical §9 momentum label) so the wording stays
 * in lockstep with the score components — momentum words only, never a quality
 * verdict.
 */
export function buildHeadlineSummary(
  marketName: string,
  score: number | null,
  cards: Record<
    string,
    {
      formattedValue: string;
      percentChange: number | null;
      value: number | null;
    }
  >,
): HeadlineSummary {
  if (score == null) {
    return {
      headline: `${marketName} market overview`,
      summary: `Live market metrics for ${marketName} are below. Pick a metric on the right to chart how it has moved over time.`,
    };
  }

  const momentum = getScoreLabel(score).toLowerCase();
  const parts: string[] = [
    `${marketName} is showing ${momentum} demand momentum with a PropertyIQ Score of ${Math.round(score)}.`,
  ];

  const homeValue = cards.home_value;
  if (homeValue && homeValue.value != null) {
    const yoy = homeValue.percentChange;
    const yoyPart =
      yoy != null
        ? `, ${yoy >= 0 ? "up" : "down"} ${Math.abs(yoy).toFixed(1)}% year over year`
        : "";
    parts.push(
      `The typical home is valued around ${homeValue.formattedValue}${yoyPart}.`,
    );
  }

  parts.push("Pick a metric on the right to chart its trend.");

  return {
    headline: `${marketName}: ${momentum} momentum`,
    summary: parts.join(" "),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `packages/frontend`): `npx vitest run "app/(app)/market/[id]/__tests__/market-headline-summary.test.ts"`
Expected: PASS (3 specs green).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/[id]/market-headline-summary.ts" "packages/frontend/app/(app)/market/[id]/__tests__/market-headline-summary.test.ts"
git commit -m "feat(market): add deterministic client-side headline summary (SSOT momentum label)"
```

---

## Task 6: `MarketHeadline` component (short AI framing, replaces AIMarketAnalysis)

**Files:**

- Create: `packages/frontend/app/(app)/market/[id]/MarketHeadline.tsx`
- Test: `packages/frontend/app/(app)/market/[id]/__tests__/MarketHeadline.test.tsx`

**Interfaces:**

- Consumes: `fetchMarketHeadline`, `type MarketSnapshotCard` from `@/lib/data` (Task 3); `useEntitlements` from `@/lib/entitlements`; `buildHeadlineSummary` from `./market-headline-summary` (Task 5).
- Produces:
  - `interface MarketHeadlineProps { geoType: string; geoId: string; marketName: string; view: 'homebuyer' | 'investor'; cards: Record<string, MarketSnapshotCard>; score: number | null; scoreGrade: string; }`
  - `function MarketHeadline(props: MarketHeadlineProps): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/[id]/__tests__/MarketHeadline.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Force the non-AI path (no entitlement) so no network happens and the
// deterministic summary renders synchronously.
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ canAccess: () => false }),
}));

import { MarketHeadline } from "../MarketHeadline";

const cards = {
  home_value: {
    value: 455000,
    formattedValue: "$455K",
    percentChange: 3.1,
    direction: "up" as const,
    isLoading: false,
    date: "2026-05-31",
    source: "zillow",
    sourceGeoId: "12420",
    sourceGeoLevel: "metro" as const,
    isInherited: false,
    isFallback: false,
  },
};

describe("MarketHeadline (non-AI fallback path)", () => {
  it("renders the deterministic momentum framing when ai_insights is off", () => {
    render(
      <MarketHeadline
        geoType="metro"
        geoId="12420"
        marketName="Austin, TX"
        view="homebuyer"
        cards={cards}
        score={62}
        scoreGrade="B"
      />,
    );
    expect(screen.getByText(/firming momentum/i)).toBeTruthy();
    expect(screen.getByText(/PropertyIQ Score of 62/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/frontend`): `npx vitest run "app/(app)/market/[id]/__tests__/MarketHeadline.test.tsx"`
Expected: FAIL with "Failed to resolve import ... ../MarketHeadline".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/[id]/MarketHeadline.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { fetchMarketHeadline, type MarketSnapshotCard } from "@/lib/data";
import { useEntitlements } from "@/lib/entitlements";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  buildHeadlineSummary,
  type HeadlineSummary,
} from "./market-headline-summary";

interface MarketHeadlineProps {
  geoType: string;
  geoId: string;
  marketName: string;
  view: "homebuyer" | "investor";
  cards: Record<string, MarketSnapshotCard>;
  score: number | null;
  scoreGrade: string;
}

export function MarketHeadline({
  geoType,
  geoId,
  marketName,
  view,
  cards,
  score,
  scoreGrade,
}: MarketHeadlineProps) {
  const { canAccess } = useEntitlements();
  const aiEnabled = canAccess("feature", "ai_insights");

  const fallback = buildHeadlineSummary(marketName, score, cards);
  const [content, setContent] = useState<HeadlineSummary>(fallback);
  const [loading, setLoading] = useState(false);

  // Fetch the AI headline once per (geoId, view) when entitled. On any failure
  // we keep the deterministic fallback already in state.
  const fetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!aiEnabled) {
      setContent(buildHeadlineSummary(marketName, score, cards));
      return;
    }
    const key = `${geoId}:${view}`;
    if (fetchedRef.current === key) return;
    fetchedRef.current = key;

    const compactMetrics: Record<
      string,
      { value: number | null; formatted: string; change: number | null }
    > = {};
    for (const [id, card] of Object.entries(cards)) {
      if (card.value != null) {
        compactMetrics[id] = {
          value: card.value,
          formatted: card.formattedValue,
          change: card.percentChange,
        };
      }
    }

    setLoading(true);
    fetchMarketHeadline(geoType, geoId, {
      geoName: marketName,
      audience: view,
      metrics: compactMetrics,
      scores: {
        propertyiq: score != null ? { score, grade: scoreGrade } : null,
      },
    })
      .then((result) =>
        setContent({ headline: result.headline, summary: result.summary }),
      )
      .catch(() => (fetchedRef.current = null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoId, view, aiEnabled]);

  return (
    <motion.div
      className="bg-gradient-to-br from-primary/5 via-surface-container to-tertiary/5 rounded-2xl border border-primary/20 p-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-primary/15">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
          {aiEnabled ? "PropertyIQ Take" : "Market Overview"}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton variant="text" width={280} height={24} />
          <Skeleton variant="text" width="100%" height={16} />
          <Skeleton variant="text" width="90%" height={16} />
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-on-surface mb-2">
            {content.headline}
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {content.summary}
          </p>
        </>
      )}
    </motion.div>
  );
}

export default MarketHeadline;
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `packages/frontend`): `npx vitest run "app/(app)/market/[id]/__tests__/MarketHeadline.test.tsx"`
Expected: PASS (1 spec green).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/[id]/MarketHeadline.tsx" "packages/frontend/app/(app)/market/[id]/__tests__/MarketHeadline.test.tsx"
git commit -m "feat(market): add MarketHeadline (short AI framing, deterministic fallback)"
```

---

## Task 7: `MetricRail` component (score gauge + clickable metric rows)

**Files:**

- Create: `packages/frontend/app/(app)/market/[id]/components/MetricRail.tsx`
- Test: `packages/frontend/app/(app)/market/[id]/components/__tests__/MetricRail.test.tsx`

**Interfaces:**

- Consumes: `type MarketSnapshotCard`, `getMetricConfig` from `@/lib/data`; `ScoreGaugeWidget` from `@/app/components/scoring/ScoreGaugeWidget` (self-fetching connected gauge — props `{ geographyType, geographyId, scoreType: 'propertyiq' }`); `MetricTitle` from `@/app/components/MetricTitle`.
- Produces:
  - `interface MetricRailProps { geoType: string; geoId: string; cards: Record<string, MarketSnapshotCard>; metricIds: string[]; selectedMetricId: string; onSelectMetric: (id: string) => void; }`
  - `function MetricRail(props: MetricRailProps): JSX.Element`
- Note: the score gauge wrapper carries `data-tour="propertyiq-score"` (the sandbox tour step1 target that previously lived in `ScoreColumn`).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/[id]/components/__tests__/MetricRail.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Stub the self-fetching gauge (it calls useScoreData → network).
vi.mock("@/app/components/scoring/ScoreGaugeWidget", () => ({
  ScoreGaugeWidget: () => <div data-testid="score-gauge" />,
}));
// MetricTitle reads metric config; render its id plainly for the test.
vi.mock("@/app/components/MetricTitle", () => ({
  MetricTitle: ({ metricId }: { metricId: string }) => <span>{metricId}</span>,
}));

import { MetricRail } from "../MetricRail";

const card = (formattedValue: string, value: number) => ({
  value,
  formattedValue,
  percentChange: 2.0,
  direction: "up" as const,
  isLoading: false,
  date: "2026-05-31",
  source: "zillow",
  sourceGeoId: "12420",
  sourceGeoLevel: "metro" as const,
  isInherited: false,
  isFallback: false,
});

const cards = {
  home_value: card("$455K", 455000),
  rent_index: card("$1,850", 1850),
};

describe("MetricRail", () => {
  it("renders the score gauge and a row per metric", () => {
    render(
      <MetricRail
        geoType="metro"
        geoId="12420"
        cards={cards}
        metricIds={["home_value", "rent_index"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    expect(screen.getByTestId("score-gauge")).toBeTruthy();
    expect(screen.getByText("$455K")).toBeTruthy();
    expect(screen.getByText("$1,850")).toBeTruthy();
  });

  it("exposes the tour target on the score gauge wrapper", () => {
    const { container } = render(
      <MetricRail
        geoType="metro"
        geoId="12420"
        cards={cards}
        metricIds={["home_value"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    expect(
      container.querySelector('[data-tour="propertyiq-score"]'),
    ).toBeTruthy();
  });

  it("calls onSelectMetric with the clicked metric id", () => {
    const onSelect = vi.fn();
    render(
      <MetricRail
        geoType="metro"
        geoId="12420"
        cards={cards}
        metricIds={["home_value", "rent_index"]}
        selectedMetricId="home_value"
        onSelectMetric={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /rent_index/i }));
    expect(onSelect).toHaveBeenCalledWith("rent_index");
  });

  it("marks the selected row as pressed", () => {
    render(
      <MetricRail
        geoType="metro"
        geoId="12420"
        cards={cards}
        metricIds={["home_value", "rent_index"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    const selected = screen.getByRole("button", { name: /home_value/i });
    expect(selected.getAttribute("aria-pressed")).toBe("true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/frontend`): `npx vitest run "app/(app)/market/[id]/components/__tests__/MetricRail.test.tsx"`
Expected: FAIL with "Failed to resolve import ... ../MetricRail".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/[id]/components/MetricRail.tsx
"use client";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { type MarketSnapshotCard } from "@/lib/data";
import { ScoreGaugeWidget } from "@/app/components/scoring/ScoreGaugeWidget";
import { MetricTitle } from "@/app/components/MetricTitle";

interface MetricRailProps {
  geoType: string;
  geoId: string;
  cards: Record<string, MarketSnapshotCard>;
  metricIds: string[];
  selectedMetricId: string;
  onSelectMetric: (id: string) => void;
}

export function MetricRail({
  geoType,
  geoId,
  cards,
  metricIds,
  selectedMetricId,
  onSelectMetric,
}: MetricRailProps) {
  return (
    <div className="space-y-4">
      {/* Score gauge — self-fetching; carries the sandbox tour step1 target. */}
      <div
        data-tour="propertyiq-score"
        className="bg-surface-container rounded-3xl p-6 border border-outline-variant/30 flex justify-center"
      >
        <ScoreGaugeWidget
          geographyType={geoType as "metro" | "county" | "zip"}
          geographyId={geoId}
          scoreType="propertyiq"
        />
      </div>

      {/* Secondary metric rows — click to chart; the charted one is highlighted. */}
      <div className="space-y-1.5">
        {metricIds.map((metricId) => {
          const card = cards[metricId];
          const trend = card?.percentChange ?? null;
          const direction = card?.direction ?? "stable";
          const isSelected = metricId === selectedMetricId;

          return (
            <button
              key={metricId}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectMetric(metricId)}
              className={`w-full flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-outline-variant/30 bg-surface-container hover:border-outline-variant/60"
              }`}
            >
              <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant min-w-0 truncate">
                <MetricTitle metricId={metricId} />
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-on-surface">
                  {card?.formattedValue ?? "—"}
                </span>
                {trend != null && (
                  <span
                    className={`flex items-center gap-0.5 text-xs font-medium ${
                      direction === "up"
                        ? "text-green-600"
                        : direction === "down"
                          ? "text-red-600"
                          : "text-on-surface-variant"
                    }`}
                  >
                    {direction === "up" && (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    )}
                    {direction === "down" && (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {trend >= 0 ? "+" : ""}
                    {trend.toFixed(1)}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MetricRail;
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `packages/frontend`): `npx vitest run "app/(app)/market/[id]/components/__tests__/MetricRail.test.tsx"`
Expected: PASS (4 specs green).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/[id]/components/MetricRail.tsx" "packages/frontend/app/(app)/market/[id]/components/__tests__/MetricRail.test.tsx"
git commit -m "feat(market): add MetricRail (score gauge + clickable metric rows)"
```

---

## Task 8: `MarketPrimaryChart` component (thin wrapper over AnimatedTimeSeriesChart)

**Files:**

- Create: `packages/frontend/app/(app)/market/[id]/components/MarketPrimaryChart.tsx`
- Test: `packages/frontend/app/(app)/market/[id]/components/__tests__/MarketPrimaryChart.test.tsx`

**Interfaces:**

- Consumes: `useTimeSeriesData` from `@/lib/data` (`(metricId, geoLevel, regionId, { historyMonths }) => { data: TimeSeriesPoint[]; isLoading; error }`); `type GeoLevel` from `@/lib/data`; `AnimatedTimeSeriesChart` from `@/app/graphs/components/AnimatedTimeSeriesChart` (props include `primaryData: TimeSeriesPoint[]`, `primaryLabel: string`, `metricId: string`, `timeFrame: TimeFrame`, `onTimeFrameChange: (tf: TimeFrame) => void`, `isLoading: boolean`, `error?: string | null`); `type TimeFrame` from `@/app/graphs/hooks/useGraphsState`; `timeFrameToHistoryMonths` from `./market-rail-metrics` (Task 4).
- Produces:
  - `interface MarketPrimaryChartProps { geoType: GeoLevel; geoId: string; marketName: string; metricId: string; }`
  - `function MarketPrimaryChart(props: MarketPrimaryChartProps): JSX.Element`
- Note: `AnimatedTimeSeriesChart` renders single-market when only `primaryData` is passed (comparison/baseline are optional), and it ignores `timeFrame`/`onTimeFrameChange` internally (they are required props but vestigial) — the wrapper owns the real timeframe→`historyMonths` mapping and re-fetches on change.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/[id]/components/__tests__/MarketPrimaryChart.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const useTimeSeriesData = vi.fn(() => ({
  data: [
    { date: "2021-01-01", value: 400000 },
    { date: "2022-01-01", value: 455000 },
  ],
  isLoading: false,
  error: null,
}));
vi.mock("@/lib/data", () => ({
  useTimeSeriesData: (...args: unknown[]) => useTimeSeriesData(...args),
}));
// Stub the heavy D3 chart; surface the props we assert on.
vi.mock("@/app/graphs/components/AnimatedTimeSeriesChart", () => ({
  AnimatedTimeSeriesChart: (props: {
    metricId: string;
    primaryData: unknown[];
  }) => (
    <div
      data-testid="ts-chart"
      data-metric={props.metricId}
      data-points={props.primaryData.length}
    />
  ),
}));

import { MarketPrimaryChart } from "../MarketPrimaryChart";

describe("MarketPrimaryChart", () => {
  it("renders the chart for the selected metric with fetched points", () => {
    render(
      <MarketPrimaryChart
        geoType="metro"
        geoId="12420"
        marketName="Austin, TX"
        metricId="home_value"
      />,
    );
    const chart = screen.getByTestId("ts-chart");
    expect(chart.getAttribute("data-metric")).toBe("home_value");
    expect(chart.getAttribute("data-points")).toBe("2");
  });

  it("defaults to the 5Y timeframe (60 months) for the data hook", () => {
    render(
      <MarketPrimaryChart
        geoType="metro"
        geoId="12420"
        marketName="Austin, TX"
        metricId="home_value"
      />,
    );
    const lastCall = useTimeSeriesData.mock.calls.at(-1)!;
    expect(lastCall[0]).toBe("home_value");
    expect(lastCall[3]).toEqual({ historyMonths: 60 });
  });

  it("re-requests a shorter window when the 1Y timeframe pill is clicked", () => {
    render(
      <MarketPrimaryChart
        geoType="metro"
        geoId="12420"
        marketName="Austin, TX"
        metricId="home_value"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "1Y" }));
    const lastCall = useTimeSeriesData.mock.calls.at(-1)!;
    expect(lastCall[3]).toEqual({ historyMonths: 12 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/frontend`): `npx vitest run "app/(app)/market/[id]/components/__tests__/MarketPrimaryChart.test.tsx"`
Expected: FAIL with "Failed to resolve import ... ../MarketPrimaryChart".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/[id]/components/MarketPrimaryChart.tsx
"use client";

import { useState } from "react";
import { useTimeSeriesData, type GeoLevel } from "@/lib/data";
import { AnimatedTimeSeriesChart } from "@/app/graphs/components/AnimatedTimeSeriesChart";
import type { TimeFrame } from "@/app/graphs/hooks/useGraphsState";
import { timeFrameToHistoryMonths } from "./market-rail-metrics";

interface MarketPrimaryChartProps {
  geoType: GeoLevel;
  geoId: string;
  marketName: string;
  metricId: string;
}

const TIME_FRAMES: TimeFrame[] = ["1Y", "3Y", "5Y", "10Y", "Max"];

export function MarketPrimaryChart({
  geoType,
  geoId,
  marketName,
  metricId,
}: MarketPrimaryChartProps) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("5Y");

  const { data, isLoading, error } = useTimeSeriesData(
    metricId,
    geoType,
    geoId,
    {
      historyMonths: timeFrameToHistoryMonths(timeFrame),
    },
  );

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant/30 p-4">
      {/* Timeframe pills */}
      <div className="flex items-center justify-end gap-1 mb-2">
        {TIME_FRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            aria-pressed={tf === timeFrame}
            onClick={() => setTimeFrame(tf)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              tf === timeFrame
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Primary chart — single market (comparison/baseline omitted). */}
      <div className="w-full h-[380px]">
        <AnimatedTimeSeriesChart
          primaryData={data}
          primaryLabel={marketName}
          metricId={metricId}
          timeFrame={timeFrame}
          onTimeFrameChange={setTimeFrame}
          isLoading={isLoading}
          error={error ? error.message : null}
        />
      </div>
    </div>
  );
}

export default MarketPrimaryChart;
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `packages/frontend`): `npx vitest run "app/(app)/market/[id]/components/__tests__/MarketPrimaryChart.test.tsx"`
Expected: PASS (3 specs green).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/[id]/components/MarketPrimaryChart.tsx" "packages/frontend/app/(app)/market/[id]/components/__tests__/MarketPrimaryChart.test.tsx"
git commit -m "feat(market): add MarketPrimaryChart (switchable single-metric time-series spine)"
```

---

## Task 9: Rewire `MarketDashboard` into the Hybrid layout + retire the old grid/AI

**Files:**

- Modify: `packages/frontend/app/(app)/market/[id]/MarketDashboard.tsx:1-315` (full rewrite of the render + state, keeping data/entitlement/error scaffolding)
- Modify: `packages/frontend/app/(app)/market/[id]/components/index.ts:1-21` (export `MetricRail`, `MarketPrimaryChart`; drop `MetricCard`, `MetricCategorySection`, `ScoreColumn`)
- Delete: `packages/frontend/app/(app)/market/[id]/AIMarketAnalysis.tsx`
- Delete: `packages/frontend/app/(app)/market/[id]/market-analysis-template.ts`
- Delete: `packages/frontend/app/(app)/market/[id]/components/MetricCard.tsx`
- Delete: `packages/frontend/app/(app)/market/[id]/components/MetricCategorySection.tsx`
- Delete: `packages/frontend/app/(app)/market/[id]/components/ScoreColumn.tsx`
- Test: `packages/frontend/app/(app)/market/[id]/__tests__/MarketDashboard.integration.test.tsx`

**Interfaces:**

- Consumes: `useMarketSnapshot` from `@/lib/data` (Task-independent, existing); `MarketHeadline` (Task 6); `MetricRail` (Task 7); `MarketPrimaryChart` (Task 8); `RAIL_METRIC_IDS`, `pickDefaultRailMetric` from `./components/market-rail-metrics` (Task 4).
- Produces: the rewired `MarketDashboard` page. Lifted state: `selectedMetricId` (shared by `MarketPrimaryChart` and `MetricRail`).
- Deletion safety: `AIMarketAnalysis` + `market-analysis-template` are imported ONLY by `MarketDashboard` (verified). `MetricCard`/`MetricCategorySection`/`ScoreColumn` are imported only via `./components` + `MarketDashboard`. `MetricCard` is used by `MetricCategorySection` only (both deleted together). Before deleting each, Step 1 re-verifies no other consumer exists.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/[id]/__tests__/MarketDashboard.integration.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock the one-call snapshot hook so no network fires.
vi.mock("@/lib/data", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    useMarketSnapshot: () => ({
      cards: {
        home_value: {
          value: 455000,
          formattedValue: "$455K",
          percentChange: 3.1,
          direction: "up",
          isLoading: false,
          date: "2026-05-31",
          source: "zillow",
          sourceGeoId: "12420",
          sourceGeoLevel: "metro",
          isInherited: false,
          isFallback: false,
        },
        rent_index: {
          value: 1850,
          formattedValue: "$1,850",
          percentChange: 1.2,
          direction: "up",
          isLoading: false,
          date: "2026-05-31",
          source: "zillow",
          sourceGeoId: "12420",
          sourceGeoLevel: "metro",
          isInherited: false,
          isFallback: false,
        },
      },
      scores: { propertyiq: { score: 62 } },
      geography: { name: "Austin, TX" },
      lastUpdated: "2026-05-31",
      dataUpdatedAt: Date.now(),
      isLoading: false,
      error: null,
    }),
  };
});
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({
    getAccess: () => ({ level: "full" }),
    canAccess: () => true,
    isMetricGated: () => false,
  }),
}));
// Stub the leaf children so the test targets MarketDashboard's composition + state wiring.
vi.mock("../MarketHeadline", () => ({
  MarketHeadline: () => <div data-testid="headline" />,
}));
vi.mock("../components/MetricRail", () => ({
  MetricRail: ({
    selectedMetricId,
    onSelectMetric,
    metricIds,
  }: {
    selectedMetricId: string;
    onSelectMetric: (id: string) => void;
    metricIds: string[];
  }) => (
    <div data-testid="rail" data-selected={selectedMetricId}>
      {metricIds.map((id) => (
        <button key={id} onClick={() => onSelectMetric(id)}>
          {id}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("../components/MarketPrimaryChart", () => ({
  MarketPrimaryChart: ({ metricId }: { metricId: string }) => (
    <div data-testid="chart" data-metric={metricId} />
  ),
}));

import { MarketDashboard } from "../MarketDashboard";

describe("MarketDashboard hybrid layout", () => {
  const props = {
    geographyId: "12420",
    geographyType: "metro" as const,
    userView: "investor" as const,
  };

  it("renders headline, chart, and rail", () => {
    render(<MarketDashboard {...props} />);
    expect(screen.getByTestId("headline")).toBeTruthy();
    expect(screen.getByTestId("chart")).toBeTruthy();
    expect(screen.getByTestId("rail")).toBeTruthy();
  });

  it("defaults the charted metric to home_value", () => {
    render(<MarketDashboard {...props} />);
    expect(screen.getByTestId("chart").getAttribute("data-metric")).toBe(
      "home_value",
    );
    expect(screen.getByTestId("rail").getAttribute("data-selected")).toBe(
      "home_value",
    );
  });

  it("switches the charted metric when a rail row is selected", () => {
    render(<MarketDashboard {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "rent_index" }));
    expect(screen.getByTestId("chart").getAttribute("data-metric")).toBe(
      "rent_index",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/frontend`): `npx vitest run "app/(app)/market/[id]/__tests__/MarketDashboard.integration.test.tsx"`
Expected: FAIL — the current `MarketDashboard` renders no `headline`/`chart`/`rail` testids (it still renders the grid + `AIMarketAnalysis`), so the first assertion fails with a "Unable to find an element by: [data-testid='headline']" error.

- [ ] **Step 3: Write minimal implementation**

First, re-verify deletion safety (no unexpected consumers):

Run (from repo root): `git grep -n "AIMarketAnalysis\|market-analysis-template\|MetricCategorySection\|ScoreColumn\|components/MetricCard\|\"./MetricCard\"" -- packages/frontend`
Expected: matches only inside `MarketDashboard.tsx`, `components/index.ts`, the files being deleted, and `components/types.ts` comments. If any OTHER consumer appears, stop and reconcile before deleting.

Then rewrite `MarketDashboard.tsx` in full:

```tsx
// packages/frontend/app/(app)/market/[id]/MarketDashboard.tsx
"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  useMarketSnapshot,
  isMetricSupportedForGeo,
  incrementUsageStat,
  type GeoLevel,
} from "@/lib/data";
import { useEntitlements } from "@/lib/entitlements";
import { useQueryClient } from "@tanstack/react-query";
import { MarketLimitUpgradePrompt } from "@/components/entitlements";
import {
  DashboardHeader,
  ViewToggle,
  MetricRail,
  MarketPrimaryChart,
  QuickActions,
  MobileViewToggle,
  DashboardLoadingSpinner,
  DashboardErrorState,
  DashboardGeoGateWall,
  PREMIUM_GEO_LEVELS,
  ShareMarketModal,
} from "./components";
import {
  RAIL_METRIC_IDS,
  pickDefaultRailMetric,
} from "./components/market-rail-metrics";
import { MarketHeadline } from "./MarketHeadline";
import { SocialProofBadge } from "@/app/components/social-proof/SocialProofBadge";
import { TourSpotlight } from "@/app/tour/components/TourSpotlight";

interface MarketDashboardProps {
  geographyId: string;
  geographyType: "metro" | "county" | "zip";
  userView: "investor" | "homebuyer";
  stateFilter?: string;
}

export function MarketDashboard({
  geographyId,
  geographyType,
  userView,
  stateFilter,
}: MarketDashboardProps) {
  const [activeView, setActiveView] = useState<"investor" | "homebuyer">(
    userView,
  );
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Track market view for onboarding (once per geography)
  const trackedGeoRef = useRef<string | null>(null);
  useEffect(() => {
    if (trackedGeoRef.current === geographyId) return;
    trackedGeoRef.current = geographyId;
    incrementUsageStat("markets_viewed").catch(console.error);
  }, [geographyId]);

  // Entitlements for geography level
  const { getAccess, canAccess } = useEntitlements();
  const geoAccess = getAccess("geo", geographyType);
  const hasGeoAccess =
    geoAccess.level === "full" ||
    geoAccess.level === "preview" ||
    !PREMIUM_GEO_LEVELS.includes(geographyType);
  const canExport = canAccess("feature", "export_csv");

  const handleDownloadMarket = useCallback(() => {
    if (!canExport) return;
    window.print();
  }, [canExport]);

  const effectiveStateFilter = useMemo(() => {
    if (geographyType === "metro") return undefined;
    if (stateFilter) return stateFilter;
    return undefined;
  }, [stateFilter, geographyType]);

  // Single hook: all metric cards + scores + trends in 2 calls
  const {
    cards,
    scores,
    geography,
    lastUpdated,
    dataUpdatedAt,
    isLoading,
    error,
  } = useMarketSnapshot(geographyType, geographyId, {
    state: effectiveStateFilter,
    trendMonths: 3,
  });

  // Apply home_value → listing_price fallback (matches prior behavior)
  const displayData = useMemo(() => {
    const result = { ...cards };
    if (!result["home_value"]?.value && result["listing_price"]?.value) {
      result["home_value"] = { ...result["listing_price"] };
    }
    return result;
  }, [cards]);

  // Rail metrics = configured set, filtered to supported + present for this geo
  const railMetricIds = useMemo(
    () =>
      RAIL_METRIC_IDS.filter(
        (id) =>
          isMetricSupportedForGeo(id, geographyType as GeoLevel) &&
          displayData[id] !== undefined,
      ),
    [geographyType, displayData],
  );

  // Keep the charted metric valid: default to home_value, reset if it drops out
  useEffect(() => {
    if (railMetricIds.length === 0) return;
    setSelectedMetricId((current) =>
      current && railMetricIds.includes(current)
        ? current
        : pickDefaultRailMetric(displayData, geographyType),
    );
  }, [railMetricIds, displayData, geographyType]);

  const updatedDateLabel = useMemo(() => {
    if (!lastUpdated) return "Unknown";
    const parsed = new Date(lastUpdated);
    if (Number.isNaN(parsed.getTime())) return "Unknown";
    return parsed.toLocaleDateString();
  }, [lastUpdated]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["market-snapshot", geographyType, geographyId],
    });
    queryClient.invalidateQueries({
      queryKey: ["market-snapshot-trends", geographyType, geographyId],
    });
  }, [queryClient, geographyType, geographyId]);

  if (isLoading) {
    return <DashboardLoadingSpinner />;
  }

  if (error || !geography) {
    return (
      <DashboardErrorState
        errorMessage={error?.message ?? "Unknown error"}
        onRetry={handleRefresh}
      />
    );
  }

  if (!hasGeoAccess) {
    return <DashboardGeoGateWall geographyType={geographyType} />;
  }

  const primaryScore = scores?.propertyiq;
  const chartMetricId =
    selectedMetricId ?? railMetricIds[0] ?? RAIL_METRIC_IDS[0];

  return (
    <div className="min-h-screen bg-surface">
      <DashboardHeader
        geographyId={geographyId}
        geographyName={geography.name}
        geographyType={geographyType}
        updatedDateLabel={updatedDateLabel}
        dataUpdatedAt={dataUpdatedAt}
        canExport={canExport}
        onRefresh={handleRefresh}
        onShare={() => setShareModalOpen(true)}
        onDownload={handleDownloadMarket}
      />
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-2">
        <SocialProofBadge
          geoLevel={geographyType}
          geoId={geographyId}
          variant="tracking"
        />
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <ViewToggle activeView={activeView} onViewChange={setActiveView} />

        {/* Hybrid: short AI framing sets context */}
        <div data-tour="ai-assessment">
          <MarketHeadline
            geoType={geographyType}
            geoId={geographyId}
            marketName={geography.name}
            view={activeView}
            cards={displayData}
            score={primaryScore?.score ?? null}
            scoreGrade={(primaryScore as { grade?: string })?.grade ?? "—"}
          />
        </div>

        {/* Primary chart (spine) + metric rail */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <MarketPrimaryChart
              geoType={geographyType as GeoLevel}
              geoId={geographyId}
              marketName={geography.name}
              metricId={chartMetricId}
            />
          </div>
          <div className="lg:col-span-4">
            <MetricRail
              geoType={geographyType}
              geoId={geographyId}
              cards={displayData}
              metricIds={railMetricIds}
              selectedMetricId={chartMetricId}
              onSelectMetric={setSelectedMetricId}
            />
          </div>
        </div>

        <QuickActions
          geographyId={geographyId}
          geographyType={geographyType}
          geographyName={geography.name}
          userView={userView}
          stateFilter={stateFilter}
        />
      </main>

      <MobileViewToggle activeView={activeView} onViewChange={setActiveView} />
      <MarketLimitUpgradePrompt />

      <ShareMarketModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        geoLevel={geographyType}
        geoId={geographyId}
        geoName={geography.name}
        score={primaryScore?.score}
        homeValue={displayData["home_value"]?.formattedValue}
        appreciation={
          displayData["home_value"]?.percentChange != null
            ? `${displayData["home_value"].percentChange > 0 ? "+" : ""}${displayData["home_value"].percentChange.toFixed(1)}%`
            : undefined
        }
        dom={displayData["days_on_market"]?.formattedValue}
        supply={displayData["pending_ratio"]?.formattedValue}
      />

      {/* Sandbox tour value-arc spotlights. step1 highlights the PropertyIQ
          Score (data-tour="propertyiq-score" inside MetricRail); step2
          highlights the AI framing (data-tour="ai-assessment" above). */}
      <TourSpotlight stepId="step1" />
      <TourSpotlight stepId="step2" />
    </div>
  );
}
```

Then update the components barrel. Full updated file:

```ts
// packages/frontend/app/(app)/market/[id]/components/index.ts
export { MetricRail } from "./MetricRail";
export { MarketPrimaryChart } from "./MarketPrimaryChart";
export { DashboardScoreBadge } from "./DashboardScoreBadge";
export { DashboardHeader } from "./DashboardHeader";
export { ViewToggle } from "./ViewToggle";
export { QuickActions } from "./QuickActions";
export { MobileViewToggle } from "./MobileViewToggle";
export {
  DashboardLoadingSpinner,
  DashboardErrorState,
  DashboardGeoGateWall,
} from "./DashboardLoadingState";
export type {
  MarketDashboardProps,
  MetricCardData,
  GeographyInfo,
} from "./types";
export { PREMIUM_GEO_LEVELS } from "./types";
export { ShareMarketModal } from "./ShareMarketModal";
```

Then delete the retired files:

```bash
git rm "packages/frontend/app/(app)/market/[id]/AIMarketAnalysis.tsx" \
       "packages/frontend/app/(app)/market/[id]/market-analysis-template.ts" \
       "packages/frontend/app/(app)/market/[id]/components/MetricCard.tsx" \
       "packages/frontend/app/(app)/market/[id]/components/MetricCategorySection.tsx" \
       "packages/frontend/app/(app)/market/[id]/components/ScoreColumn.tsx"
```

- [ ] **Step 4: Run tests + typecheck to verify green**

Run (from `packages/frontend`): `npx vitest run "app/(app)/market/[id]/__tests__/MarketDashboard.integration.test.tsx"`
Expected: PASS (3 specs green).

Run (from `packages/frontend`): `npx tsc --noEmit`
Expected: no errors referencing `market/[id]` (deleted-file imports all resolved; `DashboardScoreBadge` still exists and is exported — it is unrelated to the deleted trio).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/[id]/MarketDashboard.tsx" "packages/frontend/app/(app)/market/[id]/components/index.ts" "packages/frontend/app/(app)/market/[id]/__tests__/MarketDashboard.integration.test.tsx"
git commit -m "feat(market): rewire MarketDashboard into hybrid headline + chart + rail; retire grid/6-section AI"
```

---

## Self-Review

**1. Spec coverage**

| Spec requirement                                        | Task(s)                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| AI headline reframe (short framing, replaces 6-section) | Task 1 (prompt/fallback), Task 2 (service+route), Task 3 (fetcher), Task 5 (client fallback), Task 6 (component)       |
| Primary switchable chart (page spine)                   | Task 4 (timeframe/default helpers), Task 8 (`MarketPrimaryChart` over `AnimatedTimeSeriesChart` + `useTimeSeriesData`) |
| Metric rail synced to charted metric                    | Task 4 (`RAIL_METRIC_IDS`, `pickDefaultRailMetric`), Task 7 (`MetricRail`), Task 9 (lifted `selectedMetricId`)         |
| Score display reused                                    | Task 7 (`ScoreGaugeWidget`, self-fetching)                                                                             |
| Integration into `MarketDashboard`                      | Task 9 (rewire + delete stale grid/AI)                                                                                 |
| Reuse existing metric data path (no new fetch for rail) | Tasks 7 + 9 (both read `useMarketSnapshot` `cards`)                                                                    |
| Data-layer compliance (`@/lib/data` only)               | Tasks 3, 6, 8 fetch/hook only via `@/lib/data`                                                                         |
| Momentum-not-quality score language                     | Tasks 1 (`scoreMomentumWord`), 5 (`getScoreLabel` SSOT)                                                                |
| File-size limits                                        | Backend headline split into prompt + service files; each frontend component in its own file, all well under 400 lines  |
| Reuse `report_narrative` (no new AI purpose)            | Task 2 (routes through `ReportAiService.complete`)                                                                     |
| Preserve sandbox tour targets                           | Task 7 (`data-tour="propertyiq-score"`), Task 9 (`data-tour="ai-assessment"`)                                          |

No gaps found. The only intentionally-descoped item is including the PropertyIQ Score as a switchable chart series (documented decision #1) — it keeps its dedicated gauge.

**2. Placeholder scan**

Searched the plan for "TBD", "TODO", "similar to Task", "add appropriate", "handle edge cases", "etc." in code steps: none present. Every code step contains complete, real code derived from the current files. Every command is exact with expected output.

**3. Type/signature consistency**

- `HeadlineRequest` / `HeadlineContent` — defined in Task 1, consumed unchanged in Task 2. ✓
- `MarketHeadlineResult` — identical shape in backend service (Task 2) and frontend fetcher (Task 3). ✓
- `fetchMarketHeadline` payload (`{ geoName, audience, metrics, scores }`) — matches the backend `MarketHeadlineBody` (Task 2) and the `MarketHeadline` component call site (Task 6). ✓
- `RAIL_METRIC_IDS` / `pickDefaultRailMetric` / `timeFrameToHistoryMonths` — defined in Task 4, consumed by Task 8 (`timeFrameToHistoryMonths`) and Task 9 (`RAIL_METRIC_IDS`, `pickDefaultRailMetric`). ✓
- `MetricRail` props (`geoType, geoId, cards, metricIds, selectedMetricId, onSelectMetric`) — Task 7 definition matches Task 9 call site. ✓
- `MarketPrimaryChart` props (`geoType, geoId, marketName, metricId`) — Task 8 definition matches Task 9 call site. ✓
- `AnimatedTimeSeriesChart` required props (`primaryData, primaryLabel, metricId, timeFrame, onTimeFrameChange, isLoading, error`) — all supplied by Task 8. ✓
- `ScoreGaugeWidget` props (`geographyType, geographyId, scoreType`) — matches its real signature; supplied by Task 7. ✓
- `buildHeadlineSummary` signature — Task 5 definition matches Task 6 fallback usage. ✓
- `useTimeSeriesData(metricId, geoLevel, regionId, { historyMonths })` — Task 8 call matches the real hook signature. ✓

All consistent.
