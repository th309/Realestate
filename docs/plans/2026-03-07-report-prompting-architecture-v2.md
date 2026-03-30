> **ARCHIVED:** This document describes the legacy 3-score system (HomeReady, InvestorEdge, MarketHealth) which was replaced by a single PropertyIQ Score in March 2026. See `docs/superpowers/specs/2026-03-29-propertyiq-single-score-redesign.md` for the current system.

# Report Prompting Architecture v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the report prompting system to produce premium-quality, deeply analytical reports — model-agnostic, admin-configurable, with narrative coherence across sections.

**Architecture:** Replace the current 10-11 isolated section prompts with a two-pass generation pipeline (outline → full report), a model-agnostic AI provider abstraction, admin-configurable model selection per report type, pre-computed analytical insights injected alongside raw data, and fewer but deeper report sections with cross-section awareness.

**Tech Stack:** NestJS backend, OpenAI-compatible SDK (works with DeepSeek/Claude/Gemini/OpenRouter), Supabase for config persistence, existing template variable infrastructure.

---

## Problem Summary

The current reports feel generic and shallow because of 8 compounding issues:

1. **Wrong abstraction level** — DeepSeek Reasoner via OpenAI SDK with no system prompt, no temperature control
2. **Paint-by-numbers structure** — "Paragraph 1: X, Paragraph 2: Y" produces formulaic output
3. **Too many shallow sections** — 10-11 independent sections, each 800-2000 tokens, no cross-awareness
4. **Thin context** — Raw numbers without interpretive framing ("72nd percentile nationally", "similar to Nashville")
5. **BAD/GOOD mimicry** — Static examples become the output template instead of sparking original analysis
6. **Prompt bloat** — 500+ tokens of meta-instructions repeated in every section compete for attention
7. **No narrative arc** — Each section generated independently; no buildup, callbacks, or coherence
8. **Model lock-in** — Hardcoded to DeepSeek with env vars; no admin UI, no per-report-type selection

## Design Principles

- **Keep the existing data pipeline intact.** `buildNarrativeTemplateVars()`, `reports-orchestrator.ts`, `reports-data-fetcher.ts`, `reports-data-assembly.ts` — all unchanged.
- **Keep the existing template variable infrastructure.** The `{{placeholder}}` interpolation system stays.
- **Model-agnostic from day one.** Any OpenAI-compatible API (DeepSeek, Claude via proxy, Gemini, OpenRouter, Ollama) works.
- **Admin-configurable.** Model, temperature, and prompt version selectable per report type from the admin UI.
- **Two-pass generation.** Pass 1: analytical outline with cross-section plan. Pass 2: full narrative with outline as context.
- **Fewer, deeper sections.** Consolidate 10-11 sections into 4-5 substantial analyses.
- **Pre-computed insights.** Inject percentile rankings, comparable market references, and "so what" calculations alongside raw data.
- **Premium feel is not solely a text generation problem.** It requires: (1) visual design that matches the quality of the prose, (2) credibility signals grounded in real validation data, (3) analyst-grade scenario thinking rather than market description, (4) a generation experience that communicates significant work, (5) personalization deep enough that two users analyzing the same market receive reports that feel written for fundamentally different situations, and (6) post-delivery engagement that makes the report feel like the beginning of a relationship rather than the end of a transaction. Density of insight beats coverage of topics — a shorter report that tells the user exactly what to do is more premium than a longer report that covers everything.

---

## Task 1: Model Provider Abstraction (`ai-provider.service.ts`)

Replace the hardcoded DeepSeek client in `claude.service.ts` with a provider abstraction that supports any OpenAI-compatible API.

**Files:**

- Create: `packages/backend/src/ai-provider/ai-provider.service.ts`
- Create: `packages/backend/src/ai-provider/ai-provider.types.ts`
- Create: `packages/backend/src/ai-provider/ai-provider.module.ts`
- Create: `packages/backend/src/ai-provider/__tests__/ai-provider.service.spec.ts`
- Modify: `packages/backend/src/reports/reports.module.ts` (import new module)

### Step 1: Write the types

```typescript
// ai-provider.types.ts

export type AiProviderType =
  | "deepseek"
  | "anthropic"
  | "openai"
  | "google"
  | "openrouter"
  | "custom";

export interface AiProviderConfig {
  provider: AiProviderType;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature?: number;
  maxRetries?: number;
}

export interface AiCompletionRequest {
  systemPrompt?: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number; // Override provider default
  responseFormat?: "text" | "json";
}

export interface AiCompletionResponse {
  content: string;
  model: string;
  provider: AiProviderType;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

/**
 * Provider presets — sensible defaults per provider.
 * Admin can override any of these.
 */
export const PROVIDER_PRESETS: Record<
  AiProviderType,
  {
    baseUrl: string;
    defaultModel: string;
    defaultTemperature: number;
    envKeyName: string;
    supportsSystemPrompt: boolean;
  }
> = {
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    defaultTemperature: 0.7,
    envKeyName: "DEEPSEEK_API_KEY",
    supportsSystemPrompt: true,
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    defaultTemperature: 0.7,
    envKeyName: "ANTHROPIC_API_KEY",
    supportsSystemPrompt: true,
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    defaultTemperature: 0.7,
    envKeyName: "OPENAI_API_KEY",
    supportsSystemPrompt: true,
  },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
    defaultTemperature: 0.7,
    envKeyName: "GOOGLE_AI_API_KEY",
    supportsSystemPrompt: true,
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-sonnet-4",
    defaultTemperature: 0.7,
    envKeyName: "OPENROUTER_API_KEY",
    supportsSystemPrompt: true,
  },
  custom: {
    baseUrl: "",
    defaultModel: "",
    defaultTemperature: 0.7,
    envKeyName: "CUSTOM_AI_API_KEY",
    supportsSystemPrompt: true,
  },
};
```

### Step 2: Write the service

```typescript
// ai-provider.service.ts

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import {
  AiProviderType,
  AiProviderConfig,
  AiCompletionRequest,
  AiCompletionResponse,
  PROVIDER_PRESETS,
} from "./ai-provider.types";

/**
 * Model configuration stored in Supabase `ai_model_config` table.
 * Each row maps a "purpose" (e.g., 'report_narrative', 'research_agent',
 * 'news_scout') to a provider + model + parameters.
 */
interface StoredModelConfig {
  purpose: string;
  provider: AiProviderType;
  model: string;
  base_url?: string;
  temperature?: number;
  is_active: boolean;
}

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private clients = new Map<string, OpenAI>();
  private configCache = new Map<
    string,
    { config: AiProviderConfig; cachedAt: number }
  >();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Get a completion for a given purpose (e.g. 'report_narrative').
   * Resolves the model config from DB (cached), falls back to env vars.
   */
  async complete(
    purpose: string,
    request: AiCompletionRequest,
  ): Promise<AiCompletionResponse> {
    const config = await this.resolveConfig(purpose);
    const client = this.getOrCreateClient(config);
    const startTime = Date.now();

    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    // Use system prompt if supported and provided
    if (request.systemPrompt && config.provider !== "deepseek") {
      // deepseek-reasoner doesn't support system role
      messages.push({ role: "system", content: request.systemPrompt });
    } else if (request.systemPrompt) {
      // For models without system prompt support, prepend to user message
      request.userPrompt = `${request.systemPrompt}\n\n---\n\n${request.userPrompt}`;
    }

    messages.push({ role: "user", content: request.userPrompt });

    const response = await client.chat.completions.create({
      model: config.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature ?? config.temperature,
      messages,
      ...(request.responseFormat === "json" && {
        response_format: { type: "json_object" },
      }),
    });

    const content = response.choices[0]?.message?.content || "";
    const durationMs = Date.now() - startTime;

    this.logger.log(
      `[${purpose}] ${config.provider}/${config.model} — ${durationMs}ms, ` +
        `${response.usage?.total_tokens || "?"} tokens`,
    );

    return {
      content,
      model: config.model,
      provider: config.provider,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      durationMs,
    };
  }

  /**
   * Resolve config: DB first (cached 5 min), then env var fallback.
   */
  private async resolveConfig(purpose: string): Promise<AiProviderConfig> {
    // Check cache
    const cached = this.configCache.get(purpose);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.config;
    }

    // Try DB
    try {
      const { data } = await this.supabase
        .from("ai_model_config")
        .select("*")
        .eq("purpose", purpose)
        .eq("is_active", true)
        .single();

      if (data) {
        const stored = data as StoredModelConfig;
        const preset = PROVIDER_PRESETS[stored.provider];
        const apiKey = this.configService.get<string>(preset.envKeyName) || "";

        const config: AiProviderConfig = {
          provider: stored.provider,
          model: stored.model,
          apiKey,
          baseUrl: stored.base_url || preset.baseUrl,
          temperature: stored.temperature ?? preset.defaultTemperature,
        };

        this.configCache.set(purpose, { config, cachedAt: Date.now() });
        return config;
      }
    } catch {
      // DB miss or error — fall through to env vars
    }

    // Fallback: env vars (backward compatible with current setup)
    const config = this.buildFallbackConfig();
    this.configCache.set(purpose, { config, cachedAt: Date.now() });
    return config;
  }

  private buildFallbackConfig(): AiProviderConfig {
    const provider = (this.configService.get<string>("AI_PROVIDER") ||
      "deepseek") as AiProviderType;
    const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.deepseek;

    return {
      provider,
      model: this.configService.get<string>("AI_MODEL") || preset.defaultModel,
      apiKey: this.configService.get<string>(preset.envKeyName) || "",
      baseUrl: this.configService.get<string>("AI_BASE_URL") || preset.baseUrl,
      temperature: parseFloat(
        this.configService.get<string>("AI_TEMPERATURE") ||
          String(preset.defaultTemperature),
      ),
    };
  }

  private getOrCreateClient(config: AiProviderConfig): OpenAI {
    const key = `${config.provider}:${config.baseUrl}`;
    let client = this.clients.get(key);
    if (!client) {
      client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
      this.clients.set(key, client);
    }
    return client;
  }

  /** Invalidate cached config (called by admin when config changes). */
  invalidateCache(purpose?: string): void {
    if (purpose) {
      this.configCache.delete(purpose);
    } else {
      this.configCache.clear();
    }
    this.logger.log(`Config cache invalidated: ${purpose || "all"}`);
  }
}
```

### Step 3: Write the module

```typescript
// ai-provider.module.ts
import { Global, Module } from "@nestjs/common";
import { AiProviderService } from "./ai-provider.service";
import { SupabaseModule } from "../supabase/supabase.module";

@Global()
@Module({
  imports: [SupabaseModule],
  providers: [AiProviderService],
  exports: [AiProviderService],
})
export class AiProviderModule {}
```

### Step 4: Write the failing test

```typescript
// ai-provider.service.spec.ts
describe("AiProviderService", () => {
  it("should fall back to env-var config when DB has no row", async () => {
    // Mock supabase returning null, configService returning DEEPSEEK_API_KEY
    // Assert resolveConfig returns deepseek provider with env values
  });

  it("should use DB config when available and cache for 5 min", async () => {
    // Mock supabase returning a stored config row
    // Assert config matches DB values
    // Call again within 5 min — assert supabase NOT called again
  });

  it("should prepend system prompt to user message for deepseek-reasoner", async () => {
    // Assert that when provider is deepseek, system prompt is merged into user content
  });

  it("should use system role for anthropic/openai/google providers", async () => {
    // Assert messages array has system + user roles
  });
});
```

### Step 5: Run tests, verify they fail, implement, verify they pass

### Step 6: Commit

```bash
git add packages/backend/src/ai-provider/
git commit -m "feat(ai): add model-agnostic AiProviderService with DB config + env fallback"
```

---

## Task 2: Database Table for Model Configuration

**Files:**

- Create: Supabase migration for `ai_model_config` table

### Step 1: Create the migration

```sql
-- Migration: create_ai_model_config_table

CREATE TABLE IF NOT EXISTS ai_model_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose TEXT NOT NULL,
  label TEXT NOT NULL,                    -- Human-readable label for admin UI
  provider TEXT NOT NULL DEFAULT 'deepseek',
  model TEXT NOT NULL,
  base_url TEXT,                          -- NULL = use provider preset
  temperature NUMERIC(3,2) DEFAULT 0.70,
  max_tokens_override INTEGER,            -- NULL = use prompt default
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,                             -- Admin notes
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_active_purpose UNIQUE (purpose) -- One active config per purpose
);

-- Seed with current defaults
INSERT INTO ai_model_config (purpose, label, provider, model, temperature) VALUES
  ('report_narrative',    'Report Narratives (HomeReady/InvestorEdge/Custom)', 'deepseek', 'deepseek-reasoner', 0.70),
  ('report_outline',      'Report Outline Pass',                               'deepseek', 'deepseek-reasoner', 0.50),
  ('custom_report',       'Custom Report Generation',                          'deepseek', 'deepseek-reasoner', 0.70),
  ('research_agent',      'Research Brief - Data Gathering',                   'deepseek', 'deepseek-chat', 0.30),
  ('research_narrative',  'Research Brief - Narrative Writing',                'deepseek', 'deepseek-reasoner', 0.70),
  ('news_scout',          'News Scouting (Web Search)',                        'anthropic', 'claude-sonnet-4-20250514', 0.30),
  ('conversation',        'Report Conversation Follow-up',                     'deepseek', 'deepseek-chat', 0.70)
ON CONFLICT (purpose) DO NOTHING;

-- RLS: only admins can read/write
ALTER TABLE ai_model_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_only" ON ai_model_config
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_model_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_model_config_updated
  BEFORE UPDATE ON ai_model_config
  FOR EACH ROW EXECUTE FUNCTION update_ai_model_config_timestamp();
```

### Step 2: Commit

```bash
git add supabase/migrations/
git commit -m "feat(db): add ai_model_config table for admin-configurable model selection"
```

---

## Task 3: Admin API Endpoint for Model Configuration

**Files:**

- Create: `packages/backend/src/ai-provider/ai-provider.controller.ts`
- Create: `packages/backend/src/ai-provider/ai-provider.dto.ts`
- Modify: `packages/backend/src/ai-provider/ai-provider.module.ts` (add controller)

### Step 1: Write the DTO

```typescript
// ai-provider.dto.ts
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
  Min,
  Max,
} from "class-validator";

export class UpdateModelConfigDto {
  @IsString()
  @IsIn(["deepseek", "anthropic", "openai", "google", "openrouter", "custom"])
  provider: string;

  @IsString()
  model: string;

  @IsOptional()
  @IsString()
  base_url?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  max_tokens_override?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
```

### Step 2: Write the controller

```typescript
// ai-provider.controller.ts
import { Controller, Get, Patch, Param, Body, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { AiProviderService } from "./ai-provider.service";
import { UpdateModelConfigDto } from "./ai-provider.dto";
import { SupabaseClient } from "@supabase/supabase-js";
import { InjectSupabaseClient } from "../supabase/supabase.decorator";

@Controller("api/admin/ai-models")
@UseGuards(AdminAuthGuard)
export class AiProviderController {
  constructor(
    private readonly aiProvider: AiProviderService,
    @InjectSupabaseClient() private readonly supabase: SupabaseClient,
  ) {}

  @Get()
  async listConfigs() {
    const { data, error } = await this.supabase
      .from("ai_model_config")
      .select("*")
      .order("purpose");
    if (error) throw error;
    return data;
  }

  @Patch(":purpose")
  async updateConfig(
    @Param("purpose") purpose: string,
    @Body() dto: UpdateModelConfigDto,
  ) {
    const { data, error } = await this.supabase
      .from("ai_model_config")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("purpose", purpose)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cached config so next generation uses new settings
    this.aiProvider.invalidateCache(purpose);
    return data;
  }
}
```

### Step 3: Commit

```bash
git add packages/backend/src/ai-provider/
git commit -m "feat(admin): add AI model configuration API endpoint"
```

---

## Task 4: Admin UI — AI Model Configuration Page

**Files:**

- Create: `packages/frontend/app/admin/ai-models/page.tsx`
- Create: `packages/frontend/app/admin/ai-models/components/ModelConfigCard.tsx`
- Create: `packages/frontend/lib/data/fetchers/ai-models.ts`
- Modify: `packages/frontend/lib/data/index.ts` (export new fetcher)

### Step 1: Write the fetcher

```typescript
// ai-models.ts
import { apiClient } from "./client";

export interface AiModelConfig {
  id: string;
  purpose: string;
  label: string;
  provider: string;
  model: string;
  base_url: string | null;
  temperature: number;
  max_tokens_override: number | null;
  is_active: boolean;
  notes: string | null;
  updated_at: string;
}

export async function fetchAiModelConfigs(): Promise<AiModelConfig[]> {
  return apiClient.get("/api/admin/ai-models");
}

export async function updateAiModelConfig(
  purpose: string,
  update: Partial<AiModelConfig>,
): Promise<AiModelConfig> {
  return apiClient.patch(`/api/admin/ai-models/${purpose}`, update);
}
```

### Step 2: Write the admin page

Build an admin page at `/admin/ai-models` that:

- Lists all `ai_model_config` rows as cards
- Each card shows: purpose label, current provider, model, temperature slider
- Provider dropdown: DeepSeek, Anthropic (Claude), OpenAI, Google (Gemini), OpenRouter, Custom
- Model text input (updates when provider changes to show preset default)
- Temperature slider (0.0 — 2.0, step 0.05)
- Save button per card (PATCH to API)
- "Test" button that sends a simple prompt and shows response time + token count
- Toast on save success with "Config cached — next report will use new settings"

Use M3 design system per CLAUDE.md Section 8. Cards with `bg-surface-container-low rounded-xl shadow-sm`.

### Step 3: Commit

```bash
git add packages/frontend/app/admin/ai-models/ packages/frontend/lib/data/fetchers/ai-models.ts
git commit -m "feat(admin): add AI model configuration page with provider switching"
```

---

## Task 5: Pre-Computed Analytical Insights

The current prompts receive raw numbers (cap_rate: 5.2%, median_listing_price: $425,000) but no interpretive framing. The model has to figure out what's good, bad, or notable — and it usually doesn't.

**Add a new module that pre-computes "so what" insights from the raw data before it reaches the prompts.**

**Files:**

- Create: `packages/backend/src/reports/narrative-insights.ts`
- Create: `packages/backend/src/reports/__tests__/narrative-insights.spec.ts`
- Modify: `packages/backend/src/reports/reports-narrative-template-vars.ts` (inject insights)

### Step 1: Write the insight computation

```typescript
// narrative-insights.ts

/**
 * Pre-computed analytical insights that transform raw metrics into
 * "so what" context. Injected into narrative template vars so the
 * AI model doesn't have to figure out what's notable.
 */

export interface AnalyticalInsights {
  // Affordability
  monthly_payment_estimate: string; // "$2,850/mo at 6.5% with 20% down"
  dti_at_median_income: string; // "34% DTI — at the edge of conventional limits"
  price_vs_national_pct: string; // "12% above national median"
  price_vs_state_pct: string; // "8% below state median"
  affordability_verdict: string; // "Affordable relative to state but stretching local incomes"

  // Market Position
  market_phase: string; // "Late Expansion — prices rising but momentum slowing"
  buyer_leverage_assessment: string; // "Slight buyer leverage: 1 in 5 sellers cutting prices, 4.2 months supply"
  offer_strategy: string; // "Start at 97% of list; 22% of listings see price cuts"
  waiting_cost_per_month: string; // "~$1,480/month in appreciation if you wait"

  // Investment Math
  net_yield_estimate: string; // "~4.1% net yield after vacancy (5%), maintenance (8%), mgmt (10%)"
  cash_on_cash_estimate: string; // "~8.2% CoC return with 25% down at current rates"
  monthly_cash_flow_estimate: string; // "~$285/mo net cash flow per unit at median price"
  total_return_estimate: string; // "~9.4% total return (4.1% yield + 5.3% appreciation)"
  break_even_occupancy: string; // "82% occupancy to break even on debt service"

  // Comparative Context
  comparable_markets: string; // "Similar profile to Charlotte (score 74) and Nashville (score 71)"
  national_percentile: string; // "Top 28% of metros by HomeReady score"

  // Trend Narrative
  appreciation_trajectory: string; // "Decelerating: 8.2% 1Y → 6.1% 3Y → 5.4% 5Y"
  rent_growth_trajectory: string; // "Steady: 3.1% 1Y vs 3.4% 5Y CAGR"

  // Risk Quantification
  downside_scenario: string; // "If unemployment rises 2pts, expect 8-12% price correction based on 2008 pattern"
  equity_at_risk: string; // "At median price with 20% down, a 10% correction = $34K equity loss"
}

export function computeAnalyticalInsights(
  metrics: Record<string, any>,
  scores: any,
  benchmarks: Record<string, any>,
  userType: string,
  userInputs?: Record<string, any>,
): Partial<AnalyticalInsights> {
  const insights: Partial<AnalyticalInsights> = {};
  const price = metrics.median_listing_price || metrics.zhvi;
  const income = metrics.median_income || metrics.median_household_income;
  const rate = 0.065; // Current approximate mortgage rate — could be injected from news

  // Monthly payment estimate
  if (price) {
    const downPct = userInputs?.down_payment_pct || 0.2;
    const loanAmount = price * (1 - downPct);
    const monthlyRate = rate / 12;
    const months = 360;
    const payment =
      (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
      (Math.pow(1 + monthlyRate, months) - 1);
    insights.monthly_payment_estimate = `$${Math.round(payment).toLocaleString()}/mo at ${(rate * 100).toFixed(1)}% with ${Math.round(downPct * 100)}% down`;

    if (income) {
      const annualPayment = payment * 12;
      const dti = (annualPayment / income) * 100;
      const qualifier =
        dti > 36
          ? "above conventional limits"
          : dti > 30
            ? "at the edge of conventional limits"
            : dti > 25
              ? "within comfortable range"
              : "very comfortable";
      insights.dti_at_median_income = `${dti.toFixed(0)}% DTI — ${qualifier}`;
    }
  }

  // Price vs benchmarks
  const nationalPrice = benchmarks?.national?.median_listing_price;
  const statePrice = benchmarks?.state?.median_listing_price;
  if (price && nationalPrice) {
    const pctDiff = ((price - nationalPrice) / nationalPrice) * 100;
    insights.price_vs_national_pct = `${Math.abs(pctDiff).toFixed(0)}% ${pctDiff > 0 ? "above" : "below"} national median ($${nationalPrice.toLocaleString()})`;
  }
  if (price && statePrice) {
    const pctDiff = ((price - statePrice) / statePrice) * 100;
    insights.price_vs_state_pct = `${Math.abs(pctDiff).toFixed(0)}% ${pctDiff > 0 ? "above" : "below"} state median ($${statePrice.toLocaleString()})`;
  }

  // Market phase classification
  const supply = metrics.months_of_supply;
  const priceCuts = metrics.price_cut_pct || metrics.price_reduced_share;
  const invYoy = metrics.inventory_yoy;
  const priceYoy = metrics.zhvi_yoy;

  if (supply != null && priceCuts != null) {
    const priceCutPct = priceCuts > 1 ? priceCuts : priceCuts * 100; // normalize
    if (supply > 6 && priceCutPct > 20) {
      insights.market_phase =
        "Buyer's Market — oversupply and widespread price cuts signal declining conditions";
    } else if (supply > 4 && priceCutPct > 15) {
      insights.market_phase =
        "Early Correction — supply rising and price cuts increasing, momentum shifting to buyers";
    } else if (
      supply >= 3 &&
      supply <= 5 &&
      priceCutPct >= 10 &&
      priceCutPct <= 18
    ) {
      insights.market_phase =
        "Balanced Market — neither buyers nor sellers have strong leverage";
    } else if (supply < 3 && priceYoy > 5) {
      insights.market_phase =
        "Seller's Market (Hot) — tight supply and rapid appreciation, expect competition";
    } else if (supply < 4 && priceCutPct < 12) {
      insights.market_phase =
        "Seller's Market (Moderate) — low supply but pace is manageable";
    } else {
      insights.market_phase =
        "Transitional — mixed signals suggest the market is between phases";
    }
  }

  // Appreciation trajectory
  const yoy1 = metrics.zhvi_yoy;
  const cagr3 = metrics.zhvi_3y_cagr;
  const cagr5 = metrics.zhvi_5y_cagr;
  if (yoy1 != null && cagr3 != null && cagr5 != null) {
    const trend =
      yoy1 > cagr3 && cagr3 > cagr5
        ? "Accelerating"
        : yoy1 < cagr3 && cagr3 < cagr5
          ? "Decelerating"
          : "Steady";
    insights.appreciation_trajectory = `${trend}: ${yoy1.toFixed(1)}% 1Y, ${cagr3.toFixed(1)}% 3Y CAGR, ${cagr5.toFixed(1)}% 5Y CAGR`;
  }

  // Investment math
  const rent = metrics.zori;
  const capRate = metrics.cap_rate;
  if (price && rent && capRate) {
    const vacancyRate = 0.05;
    const maintenancePct = 0.08;
    const mgmtPct = 0.1;
    const effectiveRent = rent * (1 - vacancyRate);
    const netOperating = effectiveRent * 12 * (1 - maintenancePct - mgmtPct);
    const netYield = (netOperating / price) * 100;
    insights.net_yield_estimate = `~${netYield.toFixed(1)}% net yield after vacancy (${vacancyRate * 100}%), maintenance (${maintenancePct * 100}%), mgmt (${mgmtPct * 100}%)`;

    const downPct = 0.25;
    const equity = price * downPct;
    const loanAmount = price * (1 - downPct);
    const monthlyDebt =
      (loanAmount * ((rate / 12) * Math.pow(1 + rate / 12, 360))) /
      (Math.pow(1 + rate / 12, 360) - 1);
    const annualDebt = monthlyDebt * 12;
    const cashFlow = netOperating - annualDebt;
    const coc = (cashFlow / equity) * 100;
    insights.cash_on_cash_estimate = `~${coc.toFixed(1)}% cash-on-cash return with 25% down at ${(rate * 100).toFixed(1)}%`;
    insights.monthly_cash_flow_estimate = `~$${Math.round(cashFlow / 12).toLocaleString()}/mo net cash flow per unit at median price`;

    const appreciation = metrics.zhvf_1yr_pct || metrics.zhvi_yoy || 0;
    const totalReturn = netYield + appreciation;
    insights.total_return_estimate = `~${totalReturn.toFixed(1)}% total return (${netYield.toFixed(1)}% yield + ${appreciation.toFixed(1)}% appreciation)`;

    // Break even occupancy
    const breakEvenRent =
      (annualDebt + price * maintenancePct * 0.5) / (rent * 12);
    insights.break_even_occupancy = `${Math.round(breakEvenRent * 100)}% occupancy to break even on debt service`;
  }

  // Waiting cost
  if (price && priceYoy) {
    const monthlyAppreciation = (price * priceYoy) / 100 / 12;
    insights.waiting_cost_per_month = `~$${Math.round(monthlyAppreciation).toLocaleString()}/month in appreciation if you wait (based on ${priceYoy.toFixed(1)}% YoY)`;
  }

  // Offer strategy
  const saleToList = metrics.sale_to_list_ratio;
  if (saleToList && priceCuts != null) {
    const priceCutPct = priceCuts > 1 ? priceCuts : priceCuts * 100;
    insights.offer_strategy =
      `Start offers at ${(saleToList * 100 - 1).toFixed(0)}% of list price; ` +
      `${priceCutPct.toFixed(0)}% of listings see price cuts — target those for steeper negotiation`;
  }

  // Equity at risk
  if (price) {
    const downPct = userInputs?.down_payment_pct || 0.2;
    const equity = price * downPct;
    const correction10 = price * 0.1;
    insights.equity_at_risk =
      `At median price with ${Math.round(downPct * 100)}% down ($${Math.round(equity).toLocaleString()} equity), ` +
      `a 10% correction = $${Math.round(correction10).toLocaleString()} loss — ` +
      `${correction10 > equity ? "you would be underwater" : `${Math.round((1 - correction10 / equity) * 100)}% of equity preserved`}`;
  }

  return insights;
}
```

### Step 2: Write tests

Test the key calculations — monthly payment, DTI, market phase classification, appreciation trajectory detection.

### Step 3: Integrate into template vars

Modify `buildNarrativeTemplateVars()` to call `computeAnalyticalInsights()` and spread results:

```typescript
// In reports-narrative-template-vars.ts, after the existing return object:

const insights = computeAnalyticalInsights(
  marketMetrics,
  scores,
  populatedData?.benchmarks || {},
  dto.user_type,
  dto.user_inputs,
);

return {
  ...existingVars,
  ...insights, // All pre-computed insights available as {{template_vars}}
};
```

Note: `buildNarrativeTemplateVars` doesn't currently receive `benchmarks`. The orchestrator has them in `populatedData.benchmarks` at line 249. Pass benchmarks as an additional parameter.

### Step 4: Commit

```bash
git add packages/backend/src/reports/narrative-insights.ts packages/backend/src/reports/__tests__/
git commit -m "feat(reports): add pre-computed analytical insights for narrative depth"
```

---

## Task 6: Consolidated Report Sections (Fewer, Deeper)

Replace the 10-11 isolated sections with 5 interconnected sections that build a narrative arc.

**Files:**

- Create: `packages/backend/src/reports/prompts-v2/system-prompt.ts`
- Create: `packages/backend/src/reports/prompts-v2/homeready-sections.ts`
- Create: `packages/backend/src/reports/prompts-v2/investor-sections.ts`
- Create: `packages/backend/src/reports/prompts-v2/comparison-sections.ts`
- Create: `packages/backend/src/reports/prompts-v2/custom-report-sections.ts`
- Create: `packages/backend/src/reports/prompts-v2/index.ts`

### Section Redesign

**Old HomeReady (10 sections, isolated):**

1. hero_verdict
2. score_story
3. affordability_narrative
4. market_timing_narrative
5. stability_narrative
6. growth_potential_narrative
7. priorities_narrative
8. bottom_line_narrative
9. bottom_line_actions
10. bottom_line_watch

**New HomeReady (5 sections, connected via outline):**

1. **executive_verdict** — The hook. 2-3 sentences. What a homebuyer needs to know RIGHT NOW. (Replaces hero_verdict)
2. **market_deep_dive** — The core analysis. 6-8 paragraphs covering the market's personality, tensions, and cycle position. Weaves affordability + timing + stability + growth into one cohesive narrative instead of 4 separate boxes. Uses pre-computed insights. (Replaces score_story + affordability + timing + stability + growth)
3. **your_situation** — The personalization. Ties the market analysis to the user's specific priorities, income, timeline. This is the "$500 section." (Replaces priorities_narrative)
4. **verdict_and_actions** — The decision. Clear recommendation + 3 specific actions + key risk. (Replaces bottom_line_narrative + bottom_line_actions)
5. **what_to_watch** — Forward-looking. 2-3 metrics with thresholds + scenario analysis. (Replaces bottom_line_watch)

**New InvestorEdge (5 sections, connected via outline):**

1. **executive_verdict** — One-sentence investment signal
2. **investment_deep_dive** — Cash flow math + demand drivers + appreciation quality + entry point assessment, woven together. Uses pre-computed net yield, CoC, break-even.
3. **risk_and_resilience** — Quantified downside scenarios + historical stress test + mitigation playbook
4. **investment_thesis** — Strategy classification + tactical playbook + portfolio context
5. **actions_and_monitoring** — 3 actions + 2-3 watch metrics with investment-specific thresholds

**New Custom Report (generative sections, connected via outline):**

Custom reports differ from HomeReady/InvestorEdge in that their structure is not fixed — it is derived from the user's question/request during the outline pass. The two-pass pipeline is critical here:

- **Pass 1 (Outline):** The outline prompt receives the user's question, available data, and scores, then generates BOTH the analytical plan AND the section structure. It decides which sections are needed (3-6), what each covers, and what data is most relevant. This is a generative outline, not a template selection.
- **Pass 2 (Sections):** Each section from the outline is generated with the full outline as context. Section prompts are dynamically constructed from the outline rather than pulled from a static template map.

Fixed sections that always appear:

1. **executive_summary** — Direct answer to the user's question in 2-3 sentences
2. **scenario_analysis** — Forward-looking scenarios personalized to the question (required for all report types)

Dynamic sections (determined by outline):
3-6. Generated based on the user's question — could be market comparison, affordability deep-dive, investment analysis, neighborhood assessment, timing analysis, etc. The outline defines the section titles, purposes, and analytical priorities.

### Prompt Design Principles for v2

Each section prompt follows a new structure:

```
[SYSTEM PROMPT — shared, sent as system role]
  - Analyst persona
  - Writing caliber expectations
  - Anti-patterns (condensed to top 5)
  - Data grounding rules

[SECTION PROMPT — sent as user role]
  - Section purpose (1 sentence)
  - The outline from Pass 1 (cross-section context)
  - Analytical priorities (NOT paragraph assignments)
  - Pre-computed insights (the "so what" layer)
  - Raw data (existing template vars)
  - News context (filtered by section)
  - One example of the QUALITY LEVEL expected (not a structure template)
```

### Step 1: Write the system prompt

```typescript
// prompts-v2/system-prompt.ts

export const REPORT_SYSTEM_PROMPT_HOMEBUYER = `You are a senior real estate analyst writing a personalized market brief. Your client is making one of the biggest financial decisions of their life — buying a home. Your analysis must be worth more than anything they could find on Zillow, Redfin, or Realtor.com for free.

What makes your analysis premium:
- You connect multiple data points into insights that aren't obvious from any single metric
- You translate abstract numbers into lived financial reality (monthly payments, DTI impact, equity scenarios)
- You identify the one or two things about this market that actually matter for this specific buyer
- You're honest about risks and trade-offs — a buyer who overpays because you sugar-coated the analysis will never trust this platform again
- You ground every claim in specific data and explain what it means, not just what it is

What you never do:
- List metrics without interpretation ("the median price is $425,000")
- Use filler phrases ("the market shows promise," "a mixed bag," "something for everyone")
- Describe what a metric IS — the reader knows what days-on-market means. Tell them what THIS number means for THEIR situation
- Treat all data points as equally important — lead with what matters most
- Speculate beyond what the data supports or fabricate information

You write for someone making a real decision, not an academic audience. Be direct, confident, specific. Use "you" to address the reader.`;

export const REPORT_SYSTEM_PROMPT_INVESTOR = `You are a senior real estate investment analyst writing a market brief for a sophisticated investor. Your analysis must deliver insight worth more than any free resource — institutional-grade thinking applied to individual investment decisions.

What makes your analysis premium:
- You calculate the REAL math: net yield after vacancy/maintenance/management, cash-on-cash with leverage, break-even occupancy, total return vs alternatives (S&P 500, Treasuries, REITs)
- You identify the investment STRATEGY this market supports — cash flow play, appreciation play, value-add, or avoid — and commit to it
- You connect demand drivers (population, employment, migration) to their cash flow implications
- You quantify risk in dollar terms, not vague warnings
- You assess cycle positioning and entry timing with specificity

What you never do:
- Report headline numbers without calculating the real investor math
- Classify a market without committing to a strategy
- Mention risk without quantifying the downside scenario
- Present rankings as recommendations without cross-referencing fundamentals
- Speculate beyond what the data supports or fabricate information

You write for someone deploying capital, not browsing listings. Be analytical, decisive, specific.`;
```

### Step 2: Write the HomeReady section prompts

```typescript
// prompts-v2/homeready-sections.ts

import type { NarrativePromptConfig } from "../narrative-prompt-shared";

export const HOMEREADY_V2_SECTIONS: Record<string, NarrativePromptConfig> = {
  executive_verdict: {
    prompt_template: `Write a 2-3 sentence executive verdict for a homebuyer considering {{geography_name}}.

Score: {{homeready_score}}/100 ({{homeready_grade}})
Market phase: {{market_phase}}
Key tension: {{key_tension}}
Monthly payment at median: {{monthly_payment_estimate}}
DTI reality: {{dti_at_median_income}}

This is the first thing the reader sees. It must be specific, memorable, and grounded in data. Lead with the single most important thing about this market right now, then the key tension or trade-off.

Do NOT summarize all components. Capture the essence — the one insight that defines whether this market works for a homebuyer.`,
    max_tokens: 300,
    output_format: "text",
  },

  market_deep_dive: {
    prompt_template: `Write a comprehensive market analysis for a homebuyer considering {{geography_name}}. This is the core of the report — go deep.

{{#if outline}}
REPORT OUTLINE (maintain coherence with other sections):
{{outline}}
{{/if}}

SCORES & COMPONENTS:
- HomeReady Score: {{homeready_score}}/100 ({{homeready_grade}})
- Affordability: {{affordability_score}}/100 — Market Timing: {{market_timing_score}}/100 — Stability: {{stability_score}}/100 — Growth: {{growth_potential_score}}/100
- Strongest: {{strongest_component}} ({{strongest_score}}) | Weakest: {{weakest_component}} ({{weakest_score}})
- Key tension: {{key_tension}}

PRE-COMPUTED INSIGHTS (use these — they're already calculated):
- Monthly payment: {{monthly_payment_estimate}}
- DTI at median income: {{dti_at_median_income}}
- vs national: {{price_vs_national_pct}} | vs state: {{price_vs_state_pct}}
- Market phase: {{market_phase}}
- Appreciation trajectory: {{appreciation_trajectory}}
- Waiting cost: {{waiting_cost_per_month}}
- Offer strategy: {{offer_strategy}}
- Equity at risk: {{equity_at_risk}}

RAW DATA:
- Price: {{median_listing_price}} | Price YoY: {{zhvi_yoy}}% | Forecast: {{zhvf_1yr_pct}}%
- DOM: {{days_on_market}} | Supply: {{months_of_supply}}mo | Price cuts: {{price_cut_pct}}%
- Sale-to-list: {{sale_to_list_ratio}} | Inventory YoY: {{inventory_yoy}}%
- Income: {{median_income}} | Unemployment: {{unemployment_rate}}% | Job growth: {{job_growth_yoy}}%
- Population: {{population}} | Pop growth: {{population_growth_yoy}}% | Net migration: {{net_migration}}
- Rent: {{zori}} | Rent YoY: {{zori_yoy}}%
- 3Y CAGR: {{zhvi_3y_cagr}}% | 5Y CAGR: {{zhvi_5y_cagr}}%
- vs 2007 peak: {{zhvi_vs_2007_peak}}% | vs pre-COVID: {{zhvi_vs_pre_covid}}%
- Affordability index: {{affordability_index}} | Income needed: {{income_needed_to_buy}}

BENCHMARKS:
- National median: {{national_median_price}} | State median: {{state_median_price}}

User profile: {{user_goal_summary}}
{{#if user_experience_level}}Experience: {{user_experience_level}}{{/if}}

ANALYTICAL PRIORITIES (address these — in whatever order and structure serves the analysis):

1. THE MARKET'S PERSONALITY: What kind of market is this? Use the component scores and tensions to characterize it — don't just list them. A market with high affordability but weak timing tells a fundamentally different story than one with the reverse.

2. THE MATH THAT MATTERS: Use the pre-computed monthly payment, DTI, and price comparisons. The reader needs to understand what buying here actually costs as a lived experience, not an abstract index number.

3. THE TIMING QUESTION: Is this the right time? Use market phase, inventory trends, waiting cost, and offer strategy data. Give specific tactical guidance — not "it depends."

4. THE RESILIENCE TEST: How has this market handled stress? Use 2007 peak, pre-COVID comparisons, appreciation stability across 1Y/3Y/5Y. Frame as "if I buy here, will I be okay in 3-5 years?"

5. THE GROWTH ENGINE: What's driving this economy? Connect population, employment, migration to housing demand and appreciation quality. Are the fundamentals sound or is this appreciation driven by speculation?

Write 6-8 paragraphs. Weave these priorities together — they're interconnected, not separate boxes. Follow the thread of what's most important for this market.`,
    max_tokens: 4000,
    output_format: "text",
  },

  your_situation: {
    prompt_template: `Write the personalized section for a homebuyer considering {{geography_name}}. This is the "$500 section" — where the reader feels this was written for THEM.

{{#if outline}}
REPORT OUTLINE (maintain coherence):
{{outline}}
{{/if}}

Buyer's Priorities (ordered): {{priorities_formatted}}
Score Components: Affordability {{affordability_score}} | Timing {{market_timing_score}} | Stability {{stability_score}} | Growth {{growth_potential_score}}

Market context: {{market_phase}}
Monthly payment: {{monthly_payment_estimate}}
DTI: {{dti_at_median_income}}
Price: {{median_listing_price}} | Income needed: {{income_needed_to_buy}}

{{#if user_income}}
YOUR FINANCIAL PROFILE:
- Income: {{user_income}}
- Down payment: {{user_down_payment}}
- Budget: {{user_budget}}
- Timeline: {{user_timeline}}

Calculate THEIR specific numbers: their monthly payment, their DTI, whether they're above or below the income threshold, how their budget maps to the market. Don't just mention their numbers — show how the market dynamics interact with their specific constraints.
{{/if}}

Write 3-4 paragraphs. First, show the reader you listened — address their #1 priority with depth and specificity. Then address the trade-offs honestly. Finally, tie their priorities to their financial situation if available.

The reader should feel this section was written by an analyst who knows their name and their spreadsheet, not generated from a template.`,
    max_tokens: 2500,
    output_format: "text",
  },

  verdict_and_actions: {
    prompt_template: `Write the definitive verdict for a homebuyer considering {{geography_name}}.

{{#if outline}}
REPORT OUTLINE (maintain coherence):
{{outline}}
{{/if}}

Score: {{homeready_score}}/100 ({{homeready_grade}})
Market phase: {{market_phase}}
Key tension: {{key_tension}}
Strongest: {{strongest_component}} ({{strongest_score}}) | Weakest: {{weakest_component}} ({{weakest_score}})
Monthly payment: {{monthly_payment_estimate}}
DTI: {{dti_at_median_income}}
Waiting cost: {{waiting_cost_per_month}}
Equity at risk: {{equity_at_risk}}
Offer strategy: {{offer_strategy}}
Appreciation trajectory: {{appreciation_trajectory}}

Priorities: {{priorities_formatted}}
{{#if user_income}}Income: {{user_income}} | Down: {{user_down_payment}} | Timeline: {{user_timeline}}{{/if}}

Structure your response as:

VERDICT (1 paragraph): Lead with a clear recommendation — BUY NOW / WAIT / PROCEED WITH CAUTION / LOOK ELSEWHERE. Be decisive. Back it with the #1 reason and #1 risk.

ACTIONS (JSON array of 3 objects): Each action must be specific to {{geography_name}} and reference data. Format:
{"action": "specific instruction", "rationale": "why, with a number", "timeframe": "when to do this"}

Return the verdict paragraph followed by a JSON array on a new line starting with [.`,
    max_tokens: 2000,
    output_format: "text",
  },

  what_to_watch: {
    prompt_template: `Identify 2-3 metrics this homebuyer should monitor for {{geography_name}} over the next 3-6 months.

Score: {{homeready_score}}/100
Market phase: {{market_phase}}
Current metrics: DOM {{days_on_market}} | Supply {{months_of_supply}} | Cuts {{price_cut_pct}}% | Inventory YoY {{inventory_yoy}}% | Price YoY {{zhvi_yoy}}% | Forecast {{zhvf_1yr_pct}}%
Priorities: {{priorities_formatted}}

For each metric, identify:
- A threshold that would change the recommendation (buy signal or caution signal)
- WHY that threshold matters for the buyer's decision — not just the direction

Also include one scenario paragraph: "Best case: if X happens, expect Y. Worst case: if A happens, expect B."

Return ONLY a JSON object:
{
  "metrics": [
    {"metric": "name", "current": "value", "threshold": "value", "direction": "up|down", "rationale": "max 25 words, explains investment implication"}
  ],
  "scenario": "Best case: ... Worst case: ..."
}`,
    max_tokens: 800,
    output_format: "json_object",
  },
};
```

### Step 3: Write InvestorEdge and Comparison sections (same pattern)

Follow the same consolidation pattern. InvestorEdge v2 uses pre-computed `net_yield_estimate`, `cash_on_cash_estimate`, `total_return_estimate`, `break_even_occupancy` from the insights module.

### Step 4: Write the index

```typescript
// prompts-v2/index.ts
export {
  REPORT_SYSTEM_PROMPT_HOMEBUYER,
  REPORT_SYSTEM_PROMPT_INVESTOR,
  REPORT_SYSTEM_PROMPT_CUSTOM,
} from "./system-prompt";
export { HOMEREADY_V2_SECTIONS } from "./homeready-sections";
export { INVESTOR_V2_SECTIONS } from "./investor-sections";
export { COMPARISON_V2_SECTIONS } from "./comparison-sections";
export {
  CUSTOM_REPORT_SECTIONS,
  buildCustomSectionPrompt,
} from "./custom-report-sections";

export const V2_SECTIONS_BY_REPORT_TYPE = {
  homeready: [
    "executive_verdict",
    "market_deep_dive",
    "your_situation",
    "scenario_analysis",
    "verdict_and_actions",
    "what_to_watch",
  ],
  investoredge: [
    "executive_verdict",
    "investment_deep_dive",
    "risk_and_resilience",
    "scenario_analysis",
    "investment_thesis",
    "actions_and_monitoring",
  ],
  comparison: [
    "executive_verdict",
    "head_to_head",
    "scenario_analysis",
    "verdict_and_actions",
  ],
  custom: "dynamic", // Sections determined by outline pass — not a fixed list
} as const;
```

### Step 5: Commit

```bash
git add packages/backend/src/reports/prompts-v2/
git commit -m "feat(reports): add v2 consolidated prompt architecture with 5 deep sections"
```

---

## Task 7: Two-Pass Generation Pipeline (Outline → Narrative)

The key architectural change: generate an outline first, then feed it to each section so they maintain narrative coherence.

**Files:**

- Create: `packages/backend/src/reports/report-generation-v2.service.ts`
- Create: `packages/backend/src/reports/__tests__/report-generation-v2.spec.ts`
- Modify: `packages/backend/src/reports/reports-orchestrator.ts` (add v2 path)
- Modify: `packages/backend/src/reports/reports.module.ts` (register new service)

### Step 1: Write the two-pass service

````typescript
// report-generation-v2.service.ts

import { Injectable, Logger } from "@nestjs/common";
import { AiProviderService } from "../ai-provider/ai-provider.service";
import {
  REPORT_SYSTEM_PROMPT_HOMEBUYER,
  REPORT_SYSTEM_PROMPT_INVESTOR,
  HOMEREADY_V2_SECTIONS,
  INVESTOR_V2_SECTIONS,
  COMPARISON_V2_SECTIONS,
  V2_SECTIONS_BY_REPORT_TYPE,
} from "./prompts-v2";

@Injectable()
export class ReportGenerationV2Service {
  private readonly logger = new Logger(ReportGenerationV2Service.name);

  constructor(private readonly aiProvider: AiProviderService) {}

  /**
   * Two-pass report generation:
   * Pass 1: Generate analytical outline (what to emphasize, narrative arc, cross-section plan)
   * Pass 2: Generate each section with outline as shared context
   */
  async generateNarratives(
    reportType: "homeready" | "investoredge" | "comparison",
    context: Record<string, any>,
  ): Promise<Record<string, string | any>> {
    const systemPrompt =
      reportType === "investoredge"
        ? REPORT_SYSTEM_PROMPT_INVESTOR
        : REPORT_SYSTEM_PROMPT_HOMEBUYER;

    const sections = this.getSections(reportType);
    const sectionIds = V2_SECTIONS_BY_REPORT_TYPE[reportType];

    // ── Pass 1: Generate outline ────────────────────────────────────
    const outline = await this.generateOutline(
      reportType,
      context,
      systemPrompt,
    );
    this.logger.log(`[Pass 1] Outline generated: ${outline.length} chars`);

    // Inject outline into context so sections can reference it
    const enrichedContext = { ...context, outline };

    // ── Pass 2: Generate sections (parallel, with outline context) ──
    const results: Record<string, any> = {};
    const sectionPromises = sectionIds.map(async (sectionId) => {
      const section = sections[sectionId];
      if (!section) return { id: sectionId, value: "" };

      const interpolated = this.interpolateTemplate(
        section.prompt_template,
        enrichedContext,
      );

      // Add news context per section (reuse existing filtering logic)
      const enhancedPrompt = this.enhanceWithNews(
        interpolated,
        context,
        sectionId,
      );

      const response = await this.aiProvider.complete("report_narrative", {
        systemPrompt,
        userPrompt: enhancedPrompt,
        maxTokens: section.max_tokens,
      });

      let value: any = response.content;

      // Parse JSON sections
      if (
        section.output_format === "json_array" ||
        section.output_format === "json_object"
      ) {
        try {
          const cleaned = value
            .replace(/^```(?:json)?\s*\n?/i, "")
            .replace(/\n?```\s*$/i, "")
            .trim();
          value = JSON.parse(cleaned);
        } catch {
          this.logger.warn(
            `JSON parse failed for ${sectionId}, keeping raw text`,
          );
        }
      }

      // For verdict_and_actions, split the text verdict from the JSON actions
      if (sectionId === "verdict_and_actions" && typeof value === "string") {
        const jsonStart = value.indexOf("[");
        if (jsonStart > 0) {
          const verdictText = value.substring(0, jsonStart).trim();
          try {
            const actions = JSON.parse(value.substring(jsonStart));
            return { id: sectionId, value: { verdict: verdictText, actions } };
          } catch {
            return { id: sectionId, value: { verdict: value, actions: [] } };
          }
        }
      }

      return { id: sectionId, value };
    });

    const settled = await Promise.allSettled(sectionPromises);
    for (const result of settled) {
      if (result.status === "fulfilled") {
        results[result.value.id] = result.value.value;
      } else {
        this.logger.error(`Section generation failed: ${result.reason}`);
      }
    }

    results._meta = {
      version: "v2",
      outline, // Store outline for debugging/transparency
    };

    return results;
  }

  /**
   * Pass 1: Generate analytical outline.
   *
   * The outline identifies:
   * - The 2-3 most important things about this market
   * - The narrative arc (what story does the data tell?)
   * - What each section should emphasize
   * - Cross-references between sections
   */
  private async generateOutline(
    reportType: string,
    context: Record<string, any>,
    systemPrompt: string,
  ): Promise<string> {
    const outlinePrompt = `You are planning a premium market analysis report for {{geography_name}}. Before writing the full report, create an analytical outline.

SCORES: {{overall_score}}/100 ({{overall_grade}})
Components: {{strongest_component}} ({{strongest_score}}) → {{weakest_component}} ({{weakest_score}})
Key tension: {{key_tension}}

MARKET SNAPSHOT:
Price: {{median_listing_price}} ({{zhvi_yoy}}% YoY) | DOM: {{days_on_market}} | Supply: {{months_of_supply}}mo
Market phase: {{market_phase}} | Appreciation: {{appreciation_trajectory}}

INSIGHTS:
Monthly payment: {{monthly_payment_estimate}} | DTI: {{dti_at_median_income}}
vs National: {{price_vs_national_pct}} | Waiting cost: {{waiting_cost_per_month}}
{{#if net_yield_estimate}}Net yield: {{net_yield_estimate}} | CoC: {{cash_on_cash_estimate}}{{/if}}

User: {{user_goal_summary}}
Priorities: {{priorities_formatted}}

Create a brief outline (150-200 words) answering:
1. THE HEADLINE: What is the single most important thing about this market right now? (1 sentence)
2. THE STORY: What narrative arc does the data tell? (2-3 sentences identifying the core tension, opportunity, or warning)
3. SECTION EMPHASIS: For each report section, what should it focus on that the other sections won't cover? (avoid repetition)
4. CROSS-REFERENCES: What insights from one area should be referenced in another? (e.g., "the affordability advantage in section 2 should be tempered by the timing risk mentioned in section 3")

Be specific to THIS market's data. Not generic planning.`;

    const interpolated = this.interpolateTemplate(outlinePrompt, context);

    const response = await this.aiProvider.complete("report_outline", {
      systemPrompt,
      userPrompt: interpolated,
      maxTokens: 500,
      temperature: 0.4, // Lower temp for planning
    });

    return response.content;
  }

  private getSections(reportType: string): Record<string, any> {
    switch (reportType) {
      case "homeready":
        return HOMEREADY_V2_SECTIONS;
      case "investoredge":
        return INVESTOR_V2_SECTIONS;
      case "comparison":
        return COMPARISON_V2_SECTIONS;
      default:
        return HOMEREADY_V2_SECTIONS;
    }
  }

  private interpolateTemplate(
    template: string,
    context: Record<string, any>,
  ): string {
    // Handle {{#if var}}...{{/if}} conditional blocks
    let result = template.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, key, content) => {
        const value = context[key];
        return value && value !== "N/A" ? content : "";
      },
    );

    // Handle {{variable}} substitution
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = context[key];
      if (value === undefined || value === null) return match;
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    });

    return result;
  }

  private enhanceWithNews(
    prompt: string,
    context: Record<string, any>,
    sectionId: string,
  ): string {
    // Reuse the news enhancement logic from ClaudeService
    // or inject pre-formatted news from context
    const newsContext = context.news_context;
    if (
      !newsContext ||
      newsContext === "No recent news available for this market."
    ) {
      return prompt;
    }

    return `${prompt}

---
MARKET INTELLIGENCE (reference specific items when they support your analysis — don't force it):
${newsContext}
---

IMPORTANT: The Data section above is AUTHORITATIVE for Realtor.com and Zillow metrics. News articles may cite different geographies or time periods — always use the Data section values and note geographic distinctions if referencing news numbers.`;
  }
}
````

### Step 2: Wire into orchestrator

Add a feature flag or version check in `reports-orchestrator.ts` that routes to v2 when the `ai_model_config` table has a `report_narrative` row with a `prompt_version: 'v2'` field (or a simpler approach: check a column on `ai_model_config`).

Add `prompt_version TEXT DEFAULT 'v1'` column to `ai_model_config` table migration. When purpose = 'report_narrative' and prompt_version = 'v2', use `ReportGenerationV2Service`. Otherwise, fall through to existing `ClaudeService.generateNarratives()`.

### Step 3: Commit

```bash
git add packages/backend/src/reports/report-generation-v2.service.ts
git commit -m "feat(reports): add two-pass generation pipeline with outline-driven narrative coherence"
```

---

## Task 8: Migrate ClaudeService to Use AiProviderService

**Files:**

- Modify: `packages/backend/src/reports/claude.service.ts`
- Modify: `packages/backend/src/reports/reports.module.ts`

### Step 1: Replace the internal OpenAI client with AiProviderService

Replace `this.aiClient.chat.completions.create()` calls with `this.aiProvider.complete()` calls. Map the existing `purpose` values:

- `generateNarratives()` → purpose: `'report_narrative'`
- `generateConversation()` → purpose: `'conversation'`
- `generateInvestmentAnalysis()` → purpose: `'report_narrative'`

Keep the existing section-parallel logic, news enhancement, and JSON parsing. Just swap the completion backend.

For `generateConversation()`, the `AiProviderService.complete()` method needs a `conversationMessages` variant. Add a `completeConversation()` method to `AiProviderService` that accepts an array of messages instead of a single user prompt.

### Step 2: Remove the hardcoded OpenAI client setup from constructor

The DeepSeek-specific initialization (lines 42-58) is no longer needed — `AiProviderService` handles client creation.

### Step 3: Update the `ai_model_used` field in orchestrator

Replace the hardcoded `'claude-sonnet-4-20250514'` at `reports-orchestrator.ts:408` with the actual model name from the `AiCompletionResponse`.

### Step 4: Commit

```bash
git commit -m "refactor(reports): migrate ClaudeService to use AiProviderService"
```

---

## Task 9: Migrate Research Brief Pipeline

Both the research agent (data gathering) and the narrative generator must be fully admin-configurable through `AiProviderService`. There is no provider lock-in — DeepSeek, GPT-4o, Gemini, and Claude all support function calling via the OpenAI-compatible SDK.

**Files:**

- Modify: `packages/backend/src/reports/research-brief/research-brief.service.ts`
- Modify: `packages/backend/src/reports/research-brief/research-narrative-generator.ts`
- Modify: `packages/backend/src/reports/research-brief/research-tools.ts` (convert tool definitions to OpenAI function calling format if currently Anthropic-specific)

### Step 1: Research agent (tool-use loop)

Replace the direct Anthropic SDK client with `AiProviderService`. The research agent model is resolved via `AiProviderService.resolveConfig('research_agent')`. The tool-use loop uses the OpenAI-compatible function calling format, which is supported by all major providers (DeepSeek, OpenAI, Anthropic via proxy, Gemini). Convert tool definitions to OpenAI `tools` format if they currently use Anthropic-specific schema.

The admin can switch the research agent to any provider from the AI Models admin page. Default seed is `deepseek/deepseek-chat` (see Task 2 migration).

### Step 2: Narrative generator

Replace the direct `deepseek.chat.completions.create()` in `research-narrative-generator.ts` with `aiProvider.complete('research_narrative', ...)`. This makes the research brief narrative model admin-configurable.

### Step 3: Commit

```bash
git commit -m "refactor(research-brief): use AiProviderService for both agent and narrative generation"
```

---

## Task 10: Frontend — Update Report Rendering for v2 Sections

**Files:**

- Audit: `packages/frontend/app/reports/[id]/` — identify components that render section-specific narratives
- Modify: Components that reference old section IDs (hero_verdict, score_story, etc.)

### Step 1: Map old section IDs to new

The frontend renders narratives by section ID from `ai_narrative` in the report data. The v2 pipeline stores different section IDs. The frontend needs to handle both:

```typescript
// Helper to check if report uses v2 sections
function isV2Report(narrative: Record<string, any>): boolean {
  return narrative?._meta?.version === "v2";
}
```

### Step 2: Update rendering components

For v2 HomeReady/InvestorEdge reports:

- `executive_verdict` replaces `hero_verdict` / `investor_hero_verdict`
- `market_deep_dive` replaces `score_story` + `affordability_narrative` + `market_timing_narrative` + `stability_narrative` + `growth_potential_narrative` (single long section)
- `your_situation` replaces `priorities_narrative`
- `scenario_analysis` — new section, renders two forward-looking scenarios with action implications
- `verdict_and_actions` replaces `bottom_line_narrative` + `bottom_line_actions` (compound: `.verdict` + `.actions`)
- `what_to_watch` replaces `bottom_line_watch` (compound: `.metrics` + `.scenario`)

For v2 Custom reports:

- Section IDs are dynamic (generated during outline pass), so the renderer must iterate over all keys in `ai_narrative` rather than looking up fixed section IDs
- `executive_summary` and `scenario_analysis` are guaranteed to exist
- Dynamic sections include a `title` field from the outline — render it as the section header
- The `_meta.sections` array defines render order

Keep backward compatibility — existing v1 reports continue rendering with old section IDs.

### Step 3: Commit

```bash
git commit -m "feat(frontend): support v2 report section rendering with v1 backward compat"
```

---

## Task 11: Integration Testing & Comparison

**Files:**

- Create: `packages/backend/src/reports/__tests__/report-generation-v2.integration.spec.ts`

### Step 1: Write integration test

Generate one v1 and one v2 report for the same market (e.g., Tampa metro, CBSA 45300). Compare:

- Total token usage (v2 should be similar or lower despite fewer API calls)
- Section count and depth
- Whether outline references appear in section outputs
- Whether pre-computed insights are used in the narrative
- Response time (fewer parallel calls but each is larger)

### Step 2: Manual quality review

Generate 3 v2 reports for different market profiles:

1. Hot seller's market (Phoenix or Austin)
2. Affordable but slow-growth market (Pittsburgh or Memphis)
3. Investor-friendly market (Tampa or Jacksonville)

Read each report and evaluate:

- Does it feel like a $500 report?
- Are the pre-computed insights used naturally or awkwardly?
- Does the outline create coherence across sections?
- Are there still any "paragraph 1 about X" patterns?

### Step 3: Commit

```bash
git commit -m "test(reports): add v2 generation integration tests and quality comparison"
```

---

## Migration Strategy

1. **v2 runs alongside v1.** The `prompt_version` field on `ai_model_config` controls which pipeline runs. Default is 'v1' — everything stays the same until you flip it.
2. **Admin can switch per-purpose.** Set `report_narrative` to prompt_version 'v2' to activate. Old reports keep their v1 section IDs. New reports get v2.
3. **Frontend handles both.** The `_meta.version` field on the narrative JSON tells the frontend which renderer to use.
4. **Rollback is instant.** Set prompt_version back to 'v1' in admin. No code deployment needed.

### Recommended Implementation Sequence

Model differences should be evaluated on a fair baseline, not compared against the current broken prompt architecture. The recommended order:

1. **Provider abstraction first (Tasks 1-4).** Build the model-agnostic layer and admin UI. This is pure infrastructure — no prompt changes, no quality impact. Everything continues running on DeepSeek exactly as before, but now admin-configurable.
2. **Prompt fixes while still on DeepSeek (Tasks 5-7, 12-16).** Implement pre-computed insights, consolidated sections, two-pass pipeline, scenario analysis, visual presentation, and all quality improvements. Evaluate on DeepSeek-chat (not Reasoner) since the new prompts use system prompts and structured output. This establishes the new quality baseline.
3. **Cross-provider quality comparison (Tasks 8-9, 11).** Once v2 prompts are producing good output on DeepSeek, run the same reports on Claude Sonnet, GPT-4o, and Gemini. Compare quality, latency, and cost. The admin UI makes this a configuration change, not a code change. Let the output quality determine the default provider — don't assume any model is best until you've compared on the fixed prompts.

---

## Task 12: Scenario Analysis Section (All Report Types)

"Here is the market today" is a data product. "Here is what happens under three conditions" is an analyst product. Every report must include forward-looking scenario analysis personalized to the user.

**Files:**

- Create: `packages/backend/src/reports/prompts-v2/scenario-analysis-prompt.ts`
- Create: `packages/backend/src/reports/scenario-computation.ts`
- Modify: `packages/backend/src/reports/prompts-v2/homeready-sections.ts` (add scenario_analysis section)
- Modify: `packages/backend/src/reports/prompts-v2/investor-sections.ts` (add scenario_analysis section)
- Modify: `packages/backend/src/reports/prompts-v2/custom-report-sections.ts` (scenario_analysis is a fixed section)

### Requirements

- Minimum two forward-looking scenarios per report. Examples:
  - HomeReady: "Rates drop to 5.5% vs. rates hold at 6.5%" — show monthly payment delta, affordability shift, competitive pressure change
  - InvestorEdge: "10% price correction vs. continued 5% appreciation" — show cap rate impact, equity change, total return comparison
  - Custom: Scenarios derived from the user's question context
- Each scenario must be personalized to the user's situation — if they provided income/budget/timeline, the scenario calculations use those numbers, not market medians
- Each scenario must include a clear action implication: "If X happens, you should Y"
- Pre-compute the scenario math in `scenario-computation.ts` and inject as template vars so the model cites real numbers, not approximations

### Scenario Template Vars (pre-computed)

```typescript
interface ScenarioInputs {
  // Rate scenarios
  rate_drop_monthly_payment: string; // "At 5.5%, your payment drops to $2,340 (-$510/mo)"
  rate_hold_monthly_payment: string; // "At 6.5%, your payment stays at $2,850"
  rate_drop_buying_power_change: string; // "You can afford $48K more home at 5.5%"

  // Price correction scenarios
  correction_10pct_new_price: string; // "Median drops from $425K to $382K"
  correction_10pct_equity_impact: string; // "Your $85K down payment absorbs the full hit — no underwater risk"
  appreciation_5pct_equity_gain: string; // "At 5% continued appreciation, $21K equity gain in year 1"

  // Investment scenarios (InvestorEdge only)
  bull_case_total_return: string; // "If job growth accelerates: ~12.4% total return"
  base_case_total_return: string; // "Current trajectory: ~9.1% total return"
  bear_case_total_return: string; // "If unemployment rises 2pts: ~3.2% total return, negative appreciation"
}
```

### Step 1: Write scenario computation, write tests, integrate into template vars

### Step 2: Add scenario_analysis section prompt to each report type

### Step 3: Commit

```bash
git commit -m "feat(reports): add scenario analysis section with pre-computed forward-looking math"
```

---

## Task 13: Visual Presentation Layer

Premium reports require premium visual design. Better prose rendered as plain webpage text still looks cheap. The visual layer must match the analytical quality.

**Design Target:** Reference McKinsey, Goldman Sachs, and Cushman & Wakefield market report visual conventions — clean typography, structured data callouts, embedded visualizations, professional layout.

**Files:**

- Create: `packages/frontend/app/reports/[id]/components/v2/PullQuote.tsx`
- Create: `packages/frontend/app/reports/[id]/components/v2/DataCallout.tsx`
- Create: `packages/frontend/app/reports/[id]/components/v2/ReportHeader.tsx`
- Create: `packages/frontend/app/reports/[id]/components/v2/SectionChart.tsx`
- Create: `packages/frontend/app/reports/[id]/components/v2/ScenarioCard.tsx`
- Create: `packages/frontend/app/reports/[id]/components/v2/ReportPdfExport.tsx`
- Create: `packages/frontend/app/reports/[id]/components/v2/V2ReportLayout.tsx`

### Requirements

1. **Pull quote components** — Surface the most important single insight in each section as a visually distinct pull quote. Larger font, left border accent, stands out from body text. The AI should identify the pull-worthy sentence during generation (add `pull_quote` field to section output).

2. **Data callout boxes** — Key numbers rendered in context within the report, not just inline in paragraphs. Examples:
   - Monthly payment estimate with rate and down payment assumptions
   - Score ring with grade badge, inline with the executive verdict
   - Year-over-year comparison (price, rent, inventory) as a compact data strip
   - Net yield / CoC / total return as an investment math summary card

3. **Branded report header** — Report type badge (HomeReady / InvestorEdge / Custom), market name, generation date, score version, data freshness indicator. Professional layout, not a generic page title.

4. **Embedded charts** — Render key charts within report sections, not in a separate graphs tab:
   - Price trend sparkline in the market deep dive
   - Score component radar/bar chart near the executive verdict
   - Scenario comparison chart (dual-bar or toggle) in the scenario section
   - Use existing chart components from `app/graphs/` where possible

5. **PDF export with genuine visual design** — Layout, typography, spacing designed for PDF output. Not a print stylesheet — a purpose-built PDF layout using `@react-pdf/renderer` or server-side puppeteer. Include: branded header, page numbers, "Generated by PropertyIQ" footer, proper page breaks between sections.

6. **Report title** — See Task 15 (Report Title and Framing)

### Step 1: Build components following M3 design system (CLAUDE.md Section 8)

### Step 2: Integrate into V2ReportLayout, gated by `_meta.version === 'v2'`

### Step 3: Build PDF export pipeline

### Step 4: Commit

```bash
git commit -m "feat(reports): add premium visual presentation layer for v2 reports"
```

---

## Task 14: Validation Credibility Layer

The platform has real performance validation data (backtesting, quintile analysis, IC measurements across 400+ metros) that currently lives only in test files and internal docs. Every report should surface this as a credibility foundation — it is the primary justification for premium pricing.

**Files:**

- Create: `packages/backend/src/reports/validation-credibility.ts`
- Create: `packages/frontend/app/reports/[id]/components/v2/MethodologyFooter.tsx`
- Create: `packages/frontend/app/reports/[id]/components/v2/ScoreCredibilityBadge.tsx`
- Modify: `packages/backend/src/reports/reports-narrative-template-vars.ts` (inject validation stats)

### Requirements

1. **Methodology confidence statement** injected into every report's template vars:
   - HomeReady: "This score is based on a model that has been validated across 400+ metros with [X]% accuracy in identifying buyer-favorable markets. Top-quintile HomeReady markets have historically outperformed on [specific metric]."
   - InvestorEdge: "Top-quintile InvestorEdge markets have demonstrated a [X]% beat-market rate over [Y] years. The model's information coefficient of [Z] across [N] metros indicates statistically significant predictive power."
   - These numbers must come from actual validation data in the codebase — not fabricated. Read from `docs/audits/validation_report.md` or a structured validation results table.

2. **"About This Score" section/footer** in every report:
   - Brief plain-language explanation of what the score measures and how it was validated
   - Confidence level (A/B/C/F) with what it means for this specific market
   - Data freshness indicator (newest data point date, oldest data point date)
   - "This analysis uses data from [N] sources including [list]"

3. **Score credibility badge** — Visual component that appears near the score display:
   - "Validated across 400+ metros" badge
   - Backtest performance indicator (e.g., "Top-quintile markets outperformed 78% of the time")
   - Links to methodology page for users who want to dig deeper

### Step 1: Extract validation statistics from existing backtest results into a structured format

### Step 2: Build credibility components and inject into report layout

### Step 3: Commit

```bash
git commit -m "feat(reports): add validation credibility layer with backtest-backed methodology statements"
```

---

## Task 15: Report Title and Framing

Generic labels undermine perceived value. "HomeReady Report: Tampa, FL" is a filename. A premium product title sets expectations before the first sentence.

**Files:**

- Modify: `packages/backend/src/reports/prompts-v2/system-prompt.ts` (add title generation instruction to outline prompt)
- Modify: `packages/backend/src/reports/report-generation-v2.service.ts` (extract title from outline response)
- Modify: `packages/frontend/app/reports/[id]/components/v2/ReportHeader.tsx` (render dynamic title)

### Requirements

1. **Generate a unique, insight-driven report title** for every report based on actual findings. Examples:
   - "Your Path to Homeownership in Tampa: Why This Market Works for Your Budget — and What to Watch"
   - "Jacksonville Investment Brief: A 6.2% Cap Rate Market With Accelerating Demand"
   - "Denver vs. Austin: Why Denver Wins on Stability Despite Austin's Growth Premium"
   - Not: "HomeReady Report: Tampa, FL" or "Market Analysis Report"

2. **Title is generated in the outline pass** (Pass 1 of the two-pass pipeline) so it reflects the actual analytical conclusion. Add to the outline prompt: "Generate a compelling, insight-driven report title (max 20 words) that captures the key finding."

3. **Subtitle and metadata** rendered in the premium report header:
   - Subtitle: One sentence expanding on the title (also from outline)
   - Report type badge: "HomeReady Analysis" / "InvestorEdge Brief" / "Custom Research"
   - Generated date, score version, data freshness
   - User's name if available from profile

### Step 1: Add title/subtitle generation to outline prompt

### Step 2: Extract and store title in report `_meta`

### Step 3: Render in ReportHeader component

### Step 4: Commit

```bash
git commit -m "feat(reports): generate insight-driven report titles in outline pass"
```

---

## Task 16: Premium Generation Experience

The loading and generation state must communicate that significant analytical work is being performed. A spinner with "Generating..." undercuts the premium feel before the user reads a single word.

**Files:**

- Create: `packages/frontend/app/reports/[id]/components/GenerationProgress.tsx`
- Modify: `packages/backend/src/reports/reports-orchestrator.ts` (emit stage events)
- Modify: `packages/backend/src/reports/reports.controller.ts` (SSE endpoint for progress)

### Requirements

1. **Staged progress messages** that describe real work being performed:
   - Stage 1: "Fetching market data from 6 sources..." (data fetch)
   - Stage 2: "Calculating your affordability percentile across 400+ metros..." (insight pre-computation)
   - Stage 3: "Identifying historical market parallels..." (benchmark comparison)
   - Stage 4: "Scouting recent news and economic signals..." (news fetch)
   - Stage 5: "Building analytical outline..." (outline pass)
   - Stage 6: "Generating deep market analysis..." (section generation)
   - Stage 7: "Computing forward-looking scenarios..." (scenario analysis)
   - Stage 8: "Finalizing your personalized report..." (assembly)

2. **Progress reflects actual pipeline stages**, not a fake timer. Use Server-Sent Events (SSE) from the backend to push stage updates as the orchestrator progresses through the pipeline.

3. **Visual design** that frames the output as the result of significant expert work:
   - Each stage shows briefly what data/analysis is involved
   - Elapsed time indicator (subtle, not prominent)
   - Final stage transitions smoothly into the report view
   - M3 design: surface-container background, subtle animation, progress indicator

### Step 1: Add SSE progress endpoint to reports controller

### Step 2: Emit stage events from orchestrator at each pipeline step

### Step 3: Build GenerationProgress component

### Step 4: Commit

```bash
git commit -m "feat(reports): add premium generation progress experience with real pipeline stages"
```

---

## Task 17: Post-Delivery Engagement

Premium products don't end at delivery. The report should feel like the beginning of a relationship, not the end of a transaction.

**Files:**

- Create: `packages/backend/src/reports/report-follow-up.service.ts`
- Create: `packages/backend/src/reports/report-follow-up.controller.ts`
- Create: `packages/frontend/app/reports/[id]/components/v2/MarketUpdateBanner.tsx`
- Create: Migration: `report_follow_up_alerts` table
- Modify: `packages/backend/src/reports/reports.module.ts` (register follow-up service)

### Requirements

1. **30-day market change summary** — Automated follow-up showing what changed in the reported market since the report was generated:
   - Compare current metric values to the values at report generation time
   - Highlight significant changes (>5% move in price, >20% change in inventory, score change of 5+ points)
   - Generate a brief AI summary: "Since your report was generated 30 days ago, Tampa's inventory has risen 12% and days-on-market increased from 18 to 24. The market is shifting toward buyers — your report's 'Proceed with Caution' verdict is holding."
   - Deliver via email (Resend) and in-app banner on the report page

2. **Threshold alerts** — Notify user when a key metric crosses a meaningful threshold identified in their report's `what_to_watch` / `actions_and_monitoring` section:
   - Parse the watch metrics from the report's AI narrative (the JSON objects with metric, threshold, direction)
   - Run a daily/weekly check against current data
   - When a threshold is crossed, send notification: "Inventory in Tampa just crossed 4.5 months of supply — the buyer leverage threshold your report identified. This is the window your report predicted."
   - Store alert definitions in `report_follow_up_alerts` table linked to report ID

3. **Database schema:**

```sql
CREATE TABLE report_follow_up_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id),
  user_id UUID NOT NULL,
  metric_name TEXT NOT NULL,
  current_value NUMERIC,
  threshold_value NUMERIC NOT NULL,
  direction TEXT NOT NULL,         -- 'up' or 'down'
  rationale TEXT,
  status TEXT DEFAULT 'active',    -- active, triggered, dismissed
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Step 1: Build follow-up service with metric comparison logic

### Step 2: Build threshold alert check (cron job or scheduled task)

### Step 3: Build email templates for 30-day summary and threshold alerts

### Step 4: Build in-app MarketUpdateBanner component

### Step 5: Commit

```bash
git commit -m "feat(reports): add post-delivery engagement with 30-day updates and threshold alerts"
```

---

## File Impact Summary

| Action    | File                                                                | Purpose                                  |
| --------- | ------------------------------------------------------------------- | ---------------------------------------- |
| Create    | `src/ai-provider/ai-provider.service.ts`                            | Model-agnostic AI provider               |
| Create    | `src/ai-provider/ai-provider.types.ts`                              | Types + provider presets                 |
| Create    | `src/ai-provider/ai-provider.module.ts`                             | NestJS module                            |
| Create    | `src/ai-provider/ai-provider.controller.ts`                         | Admin API endpoint                       |
| Create    | `src/ai-provider/ai-provider.dto.ts`                                | Validation DTOs                          |
| Create    | `src/reports/narrative-insights.ts`                                 | Pre-computed analytical insights         |
| Create    | `src/reports/scenario-computation.ts`                               | Forward-looking scenario math            |
| Create    | `src/reports/validation-credibility.ts`                             | Validation stats for credibility layer   |
| Create    | `src/reports/report-follow-up.service.ts`                           | Post-delivery engagement service         |
| Create    | `src/reports/report-follow-up.controller.ts`                        | Follow-up API endpoints                  |
| Create    | `src/reports/prompts-v2/system-prompt.ts`                           | Shared system prompts (incl. custom)     |
| Create    | `src/reports/prompts-v2/homeready-sections.ts`                      | 6 consolidated HomeReady prompts         |
| Create    | `src/reports/prompts-v2/investor-sections.ts`                       | 6 consolidated InvestorEdge prompts      |
| Create    | `src/reports/prompts-v2/comparison-sections.ts`                     | 4 consolidated Comparison prompts        |
| Create    | `src/reports/prompts-v2/custom-report-sections.ts`                  | Dynamic custom report prompts            |
| Create    | `src/reports/prompts-v2/scenario-analysis-prompt.ts`                | Shared scenario analysis prompt          |
| Create    | `src/reports/prompts-v2/index.ts`                                   | Barrel export                            |
| Create    | `src/reports/report-generation-v2.service.ts`                       | Two-pass generation pipeline             |
| Create    | `frontend/app/admin/ai-models/page.tsx`                             | Admin model config UI                    |
| Create    | `frontend/app/admin/ai-models/components/ModelConfigCard.tsx`       | Config card component                    |
| Create    | `frontend/lib/data/fetchers/ai-models.ts`                           | Admin API fetcher                        |
| Create    | `frontend/app/reports/[id]/components/v2/PullQuote.tsx`             | Pull quote visual component              |
| Create    | `frontend/app/reports/[id]/components/v2/DataCallout.tsx`           | Data callout box component               |
| Create    | `frontend/app/reports/[id]/components/v2/ReportHeader.tsx`          | Premium report header                    |
| Create    | `frontend/app/reports/[id]/components/v2/SectionChart.tsx`          | Embedded section charts                  |
| Create    | `frontend/app/reports/[id]/components/v2/ScenarioCard.tsx`          | Scenario comparison card                 |
| Create    | `frontend/app/reports/[id]/components/v2/ReportPdfExport.tsx`       | PDF export with visual design            |
| Create    | `frontend/app/reports/[id]/components/v2/V2ReportLayout.tsx`        | V2 report layout wrapper                 |
| Create    | `frontend/app/reports/[id]/components/v2/MethodologyFooter.tsx`     | Validation credibility footer            |
| Create    | `frontend/app/reports/[id]/components/v2/ScoreCredibilityBadge.tsx` | Backtest-backed score badge              |
| Create    | `frontend/app/reports/[id]/components/v2/MarketUpdateBanner.tsx`    | Post-delivery market update banner       |
| Create    | `frontend/app/reports/[id]/components/GenerationProgress.tsx`       | Premium generation progress UI           |
| Create    | Migration: `ai_model_config` table                                  | DB table for model config                |
| Create    | Migration: `report_follow_up_alerts` table                          | DB table for threshold alerts            |
| Modify    | `src/reports/claude.service.ts`                                     | Use AiProviderService                    |
| Modify    | `src/reports/reports-orchestrator.ts`                               | Route to v2 pipeline + SSE progress      |
| Modify    | `src/reports/reports.controller.ts`                                 | SSE progress endpoint                    |
| Modify    | `src/reports/reports.module.ts`                                     | Register new services                    |
| Modify    | `src/reports/reports-narrative-template-vars.ts`                    | Inject insights + scenarios + validation |
| Modify    | `src/reports/research-brief/research-brief.service.ts`              | Use AiProviderService for agent          |
| Modify    | `src/reports/research-brief/research-narrative-generator.ts`        | Use AiProviderService for narrative      |
| Modify    | `src/reports/research-brief/research-tools.ts`                      | OpenAI-compatible tool format            |
| Modify    | `frontend/app/reports/[id]/` components                             | Support v2 section IDs + custom          |
| Untouched | `src/reports/reports-data-fetcher.ts`                               | Existing data pipeline                   |
| Untouched | `src/reports/reports-data-assembly.ts`                              | Existing data assembly                   |
| Untouched | `src/reports/narrative-prompts*.ts`                                 | v1 prompts (kept for backward compat)    |
