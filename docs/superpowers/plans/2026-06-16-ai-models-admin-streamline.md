# AI Models Admin Streamline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Streamline the `/admin/ai-models` model-selection feature — eliminate the duplicated model list, expose shadow A/B config in the UI, separate the evaluation harness from the config tool, modernize data fetching, and remove schema debt — without changing any runtime AI behavior.

**Architecture:** Six independently shippable phases, ordered safest-first. Phases 1–2 and 5–6 are exact, bounded changes. Phases 3–4 are structural refactors (route split + React Query migration) that relocate code without altering logic. Each phase ends with a green build + a commit; you may stop between any two phases and ship.

**Tech Stack:** Next.js 16 App Router (React 19, `'use client'`), TanStack React Query 5, NestJS 11 + class-validator, Supabase (PostgREST + SQL migrations), TypeScript.

---

## Shared Facts (read before starting)

These are verified against the current `develop` tree. Do not re-derive them.

**The 10 seeded purposes** live across three migrations (`20260307000100`, `20260514120000`, `20260523140000` / `20260601164126`):
`report_narrative`, `report_outline`, `custom_report`, `research_agent`, `research_narrative`, `news_scout`, `conversation`, `analyzer_header_verdict`, `analyzer_section_annotation`. **`report_follow_up` is called in code (`report-follow-up.service.ts:144`) but NEVER seeded** — it silently rides the env fallback.

**The duplication bug (Phase 1 target) is already live:** the frontend's hardcoded `PROVIDER_MODELS` (`ModelConfigCard.tsx:30-96`) and the backend's `PROVIDER_PRESETS.availableModels` (`ai-provider.types.ts:130-249`) disagree today — the frontend `anthropic` list is missing `claude-opus-4-7`, and the two pick different default models (`claude-sonnet-4-6` vs `claude-haiku-4-5`). The backend already exposes `GET /api/admin/ai-models/presets` returning the full `PROVIDER_PRESETS`, and a `fetchProviderPresets()` fetcher already exists (`lib/data/fetchers/ai-models.ts:99`) — **but the page never calls it.**

**Both target columns are unread:** `max_tokens_override` (only in DTO + frontend type + DB) and `prompt_version` (only written in seeds; `getPromptVersion()` at `reports-orchestrator-v2-routing.ts:17` hardcodes `return 'v2'`). Safe to drop.

**Shadow columns ARE read at runtime** by `AiConfigResolver.loadFromDb()` (`ai-config-resolver.ts:88,116-120`) but the DTO and UI cannot set them — only raw SQL can. Phase 2 exposes them.

**Conventions:**

- All frontend data fetching MUST go through `@/lib/data` (CLAUDE.md §5). Never `fetch()` directly.
- Migrations MUST use a real current timestamp in the filename (today: `2026-06-16` → prefix `20260616`). Backdated timestamps are silently skipped by Supabase (saved lesson).
- Frontend verification = production build (`NEXT_DIST_DIR=.next-verify`) + live render in a browser. No mock tests for UI (saved feedback). Backend logic = Jest.
- Branch: `develop`. Do NOT push; the user pushes.
- Run frontend type/build checks from `packages/frontend`; backend from `packages/backend`.

**Pre-flight (run once, before Phase 1):**

- [ ] **Step 0.1: Confirm branch and clean baseline**

Run: `git branch --show-current`
Expected: `develop`

- [ ] **Step 0.2: Confirm the backend builds clean before any change**

Run: `cd packages/backend && npm run build`
Expected: exits 0, no TS errors. (If it fails on pre-existing errors, STOP and surface them — a broken build is a broken build, per saved lesson.)

---

## Phase 1: Unify the model list via the existing `/presets` endpoint

**Why:** Removes an entire source of truth. After this, adding a model means editing ONLY `PROVIDER_PRESETS` in the backend; the dropdown updates automatically. Zero runtime behavior change — the card still saves the same `{provider, model, temperature, ...}` payload.

**Files:**

- Modify: `packages/frontend/lib/data/fetchers/ai-models.ts` (fix `fetchProviderPresets` return type, lines 16-28 + 99-109)
- Modify: `packages/frontend/app/(app)/admin/ai-models/page.tsx` (fetch presets, pass to cards)
- Modify: `packages/frontend/app/(app)/admin/ai-models/components/ModelConfigCard.tsx` (consume presets prop, delete hardcoded `PROVIDER_MODELS` + `PROVIDER_DEFAULT_MODELS`)

- [ ] **Step 1.1: Add a `ProviderPreset` type and fix the `fetchProviderPresets` return shape**

The endpoint returns the full `PROVIDER_PRESETS` object, but the fetcher currently mistypes it as `{ defaultModel, models }`. Replace the type block and the fetcher in `ai-models.ts`.

In `packages/frontend/lib/data/fetchers/ai-models.ts`, add after the `AiModelConfig` interface (after line 28):

```typescript
/** One model option shown in the admin provider dropdown. */
export interface ProviderModelOption {
  id: string;
  label: string;
  context?: string;
}

/** Mirrors backend ProviderPreset (ai-provider.types.ts). */
export interface ProviderPreset {
  baseUrl: string;
  defaultModel: string;
  defaultTemperature: number;
  envKeyName: string;
  supportsSystemPrompt: boolean;
  availableModels: ProviderModelOption[];
}

export type ProviderPresets = Record<string, ProviderPreset>;
```

Replace the existing `fetchProviderPresets` (lines 99-109) with:

```typescript
/**
 * Fetch provider presets (base URLs, default models, available model lists).
 * The single source of truth for the admin model dropdown — mirrors the
 * backend PROVIDER_PRESETS so the frontend never hardcodes model IDs.
 */
export async function fetchProviderPresets(): Promise<ProviderPresets> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/admin/ai-models/presets", {
    headers: authHeaders,
  });
  if (!res.ok) return {};
  const data = await res.json();
  return data.data || data || {};
}
```

- [ ] **Step 1.2: Verify the fetcher compiles**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no new errors referencing `ai-models.ts`. (Pre-existing unrelated errors, if any, are out of scope but note them.)

- [ ] **Step 1.3: Make `ModelConfigCard` consume presets instead of hardcoded lists**

In `ModelConfigCard.tsx`:

1. Delete the `PROVIDER_MODELS` constant (lines 30-96) and the `PROVIDER_DEFAULT_MODELS` constant (lines 114-121). Keep `PROVIDERS` (20-27) and `PURPOSE_DESCRIPTIONS` (99-112).

2. Update the import (line 14) and props:

```typescript
import type {
  AiModelConfig,
  ProviderPresets,
} from "@/lib/data/fetchers/ai-models";
```

```typescript
interface ModelConfigCardProps {
  config: AiModelConfig;
  presets: ProviderPresets;
  onSave: (purpose: string, update: Partial<AiModelConfig>) => Promise<boolean>;
}

export function ModelConfigCard({
  config,
  presets,
  onSave,
}: ModelConfigCardProps) {
```

3. Inside the component, derive the model list and default from `presets`. Add right after the `useState` declarations (after line 145):

```typescript
// Model options come from the backend preset for the selected provider —
// single source of truth, no hardcoded lists.
const modelOptions = presets[provider]?.availableModels ?? [];
const providerDefaultModel = presets[provider]?.defaultModel ?? "";
```

4. In `handleProviderChange` (154-168), replace `PROVIDER_DEFAULT_MODELS[newProvider] || ""` with `providerDefaultModel`. Note `providerDefaultModel` is derived from the _current_ `provider`, so compute the new default inline instead:

```typescript
const handleProviderChange = useCallback(
  (newProvider: string) => {
    setProvider(newProvider);
    // Auto-fill default model when switching providers
    if (newProvider !== provider) {
      setModel(presets[newProvider]?.defaultModel ?? "");
    }
    // Clear base URL when switching away from custom
    if (newProvider !== "custom") {
      setBaseUrl("");
    }
    setSaveStatus("idle");
  },
  [provider, presets],
);
```

5. In the Model `<select>` JSX (250-301), replace every `PROVIDER_MODELS[provider]` reference with `modelOptions`. The conditional becomes `modelOptions.length > 0 ? (...) : (...)`, the `.some((m) => m.id === model)` checks use `modelOptions`, and the `.map` iterates `modelOptions`. The "Custom model ID..." escape-hatch option and the free-text fallback stay exactly as-is — they already handle a saved model that isn't in the list (e.g. the seeded `deepseek-reasoner`).

- [ ] **Step 1.4: Wire presets through the page**

In `page.tsx`:

1. Update imports (13-20):

```typescript
import {
  fetchAiModelConfigs,
  updateAiModelConfig,
  fetchTestRunId,
  fetchProviderPresets,
  setTestRunId as setTestRunIdApi,
  type AiModelConfig,
  type ProviderPresets,
} from "@/lib/data/fetchers/ai-models";
```

2. Add state (after line 27): `const [presets, setPresets] = useState<ProviderPresets>({});`

3. In `loadConfigs` (36-52), add the presets fetch to the `Promise.all`:

```typescript
const [data, runId, presetData] = await Promise.all([
  fetchAiModelConfigs(),
  fetchTestRunId(),
  fetchProviderPresets(),
]);
setConfigs(data);
setTestRunId(runId || "");
setPresets(presetData);
```

4. Pass `presets` to each card (213-219):

```tsx
<ModelConfigCard
  key={config.purpose}
  config={config}
  presets={presets}
  onSave={handleSave}
/>
```

- [ ] **Step 1.5: Build the frontend and verify the dropdown renders from presets**

Run: `cd packages/frontend && NEXT_DIST_DIR=.next-verify npm run build`
Expected: build succeeds, no type errors.

Then start the dev server (per `local-dev-servers` skill), open `http://localhost:3000/admin/ai-models` as an admin, and confirm: each card's Model dropdown now lists the backend preset models (the `anthropic` card now shows **Claude Opus 4.7**, which the old hardcoded list lacked). Change a provider and confirm the model auto-fills the backend default. Save one card and confirm the toast + persisted value.

- [ ] **Step 1.6: Commit**

```bash
git add packages/frontend/lib/data/fetchers/ai-models.ts packages/frontend/app/(app)/admin/ai-models/page.tsx packages/frontend/app/(app)/admin/ai-models/components/ModelConfigCard.tsx
git commit -m "refactor(admin/ai-models): source model dropdown from backend presets, drop duplicated hardcoded list"
```

---

## Phase 2: Expose shadow A/B config in the UI

**Why:** The shadow columns are read at runtime but only settable via raw SQL — invisible and unmanageable. This makes the A/B harness a first-class admin feature. The controller already spreads `...dto` into the update, so adding the fields to the DTO is enough to persist them; the resolver already reads them.

**Files:**

- Modify: `packages/backend/src/ai-provider/ai-provider.dto.ts` (add shadow fields)
- Create: `packages/backend/src/ai-provider/ai-provider.dto.spec.ts` (validation tests)
- Modify: `packages/frontend/lib/data/fetchers/ai-models.ts` (add shadow fields to `AiModelConfig`)
- Create: `packages/frontend/app/(app)/admin/ai-models/components/ShadowConfigFields.tsx` (UI section)
- Modify: `packages/frontend/app/(app)/admin/ai-models/components/ModelConfigCard.tsx` (render shadow section, include in save payload)

- [ ] **Step 2.1: Write the failing DTO validation test**

Create `packages/backend/src/ai-provider/ai-provider.dto.spec.ts`:

```typescript
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { UpdateModelConfigDto } from "./ai-provider.dto";

describe("UpdateModelConfigDto shadow fields", () => {
  it("accepts a valid shadow config", async () => {
    const dto = plainToInstance(UpdateModelConfigDto, {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      shadow_provider: "deepseek",
      shadow_model: "deepseek-v4-pro",
      shadow_sample_rate: 0.25,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it("accepts null shadow_provider (shadow disabled)", async () => {
    const dto = plainToInstance(UpdateModelConfigDto, {
      provider: "deepseek",
      model: "deepseek-v4-pro",
      shadow_provider: null,
      shadow_model: null,
      shadow_sample_rate: 0,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it("rejects an unknown shadow_provider", async () => {
    const dto = plainToInstance(UpdateModelConfigDto, {
      provider: "deepseek",
      model: "deepseek-v4-pro",
      shadow_provider: "not-a-provider",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "shadow_provider")).toBe(true);
  });

  it("rejects shadow_sample_rate above 1", async () => {
    const dto = plainToInstance(UpdateModelConfigDto, {
      provider: "deepseek",
      model: "deepseek-v4-pro",
      shadow_sample_rate: 1.5,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "shadow_sample_rate")).toBe(true);
  });
});
```

- [ ] **Step 2.2: Run the test to confirm it fails**

Run: `cd packages/backend && npx jest ai-provider.dto.spec --runTestsByPath src/ai-provider/ai-provider.dto.spec.ts`
Expected: FAIL — shadow fields rejected as non-whitelisted / unknown property errors.

- [ ] **Step 2.3: Add shadow fields to the DTO**

Replace `packages/backend/src/ai-provider/ai-provider.dto.ts` with:

```typescript
/**
 * AI Provider DTOs
 *
 * Validation DTOs for the admin AI model configuration API.
 * Uses class-validator for input validation on PATCH requests.
 */

import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
  Min,
  Max,
  ValidateIf,
} from "class-validator";

const PROVIDERS = [
  "deepseek",
  "anthropic",
  "openai",
  "google",
  "openrouter",
  "custom",
];

export class UpdateModelConfigDto {
  @IsString()
  @IsIn(PROVIDERS)
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
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  // Shadow A/B config. null/absent shadow_provider = shadow disabled for this purpose.
  @IsOptional()
  @ValidateIf(
    (o) => o.shadow_provider !== null && o.shadow_provider !== undefined,
  )
  @IsString()
  @IsIn(PROVIDERS)
  shadow_provider?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.shadow_model !== null && o.shadow_model !== undefined)
  @IsString()
  shadow_model?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  shadow_sample_rate?: number;
}
```

Note: `max_tokens_override` is intentionally removed here (it is dropped in Phase 6; it has zero readers). If executing Phase 2 standalone before Phase 6, leave the existing `max_tokens_override` field in place and remove it in Phase 6 instead.

- [ ] **Step 2.4: Run the test to confirm it passes**

Run: `cd packages/backend && npx jest ai-provider.dto.spec --runTestsByPath src/ai-provider/ai-provider.dto.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 2.5: Verify the backend still builds**

Run: `cd packages/backend && npm run build`
Expected: exits 0.

- [ ] **Step 2.6: Add shadow fields to the frontend `AiModelConfig` type**

In `packages/frontend/lib/data/fetchers/ai-models.ts`, extend the `AiModelConfig` interface (16-28) — the `listConfigs` endpoint already returns `select('*')`, so these columns are present in the response; we just declare them:

```typescript
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
  shadow_provider: string | null;
  shadow_model: string | null;
  shadow_sample_rate: number | null;
  updated_at: string;
}
```

- [ ] **Step 2.7: Create the `ShadowConfigFields` UI section**

Create `packages/frontend/app/(app)/admin/ai-models/components/ShadowConfigFields.tsx`:

```tsx
/**
 * ShadowConfigFields
 *
 * Collapsible shadow A/B config for one purpose: enable toggle, shadow
 * provider/model selectors, and a sample-rate slider (0-100%). Populated
 * from the backend presets so model options stay in sync.
 */

"use client";

import type {
  ProviderPresets,
  ProviderModelOption,
} from "@/lib/data/fetchers/ai-models";

const PROVIDERS = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google (Gemini)" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "Custom" },
] as const;

interface ShadowConfigFieldsProps {
  presets: ProviderPresets;
  shadowProvider: string | null;
  shadowModel: string | null;
  shadowSampleRate: number;
  onChange: (patch: {
    shadowProvider?: string | null;
    shadowModel?: string | null;
    shadowSampleRate?: number;
  }) => void;
}

export function ShadowConfigFields({
  presets,
  shadowProvider,
  shadowModel,
  shadowSampleRate,
  onChange,
}: ShadowConfigFieldsProps) {
  const enabled = !!shadowProvider;
  const modelOptions: ProviderModelOption[] = shadowProvider
    ? (presets[shadowProvider]?.availableModels ?? [])
    : [];

  const toggle = (on: boolean) => {
    if (on) {
      const firstProvider = "deepseek";
      onChange({
        shadowProvider: firstProvider,
        shadowModel: presets[firstProvider]?.defaultModel ?? "",
        shadowSampleRate: shadowSampleRate || 0.1,
      });
    } else {
      onChange({
        shadowProvider: null,
        shadowModel: null,
        shadowSampleRate: 0,
      });
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-outline-variant bg-surface-container p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-on-surface">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
          className="accent-primary"
        />
        Shadow A/B (mirror traffic to a second model)
      </label>

      {enabled && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">
              Shadow Provider
            </label>
            <select
              value={shadowProvider ?? ""}
              onChange={(e) =>
                onChange({
                  shadowProvider: e.target.value,
                  shadowModel: presets[e.target.value]?.defaultModel ?? "",
                })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">
              Shadow Model
            </label>
            {modelOptions.length > 0 ? (
              <select
                value={
                  modelOptions.some((m) => m.id === shadowModel)
                    ? (shadowModel ?? "")
                    : ""
                }
                onChange={(e) => onChange({ shadowModel: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.context ? ` (${m.context})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={shadowModel ?? ""}
                onChange={(e) => onChange({ shadowModel: e.target.value })}
                placeholder="Enter model ID"
                className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">
              Sample Rate: {Math.round(shadowSampleRate * 100)}% of calls
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={shadowSampleRate}
              onChange={(e) =>
                onChange({ shadowSampleRate: parseFloat(e.target.value) })
              }
              className="w-full accent-primary"
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2.8: Render the shadow section in `ModelConfigCard` and include it in the save payload**

In `ModelConfigCard.tsx`:

1. Import the new component:

```typescript
import { ShadowConfigFields } from "./ShadowConfigFields";
```

2. Add shadow state alongside the existing `useState` block (after line 145):

```typescript
const [shadowProvider, setShadowProvider] = useState<string | null>(
  config.shadow_provider,
);
const [shadowModel, setShadowModel] = useState<string | null>(
  config.shadow_model,
);
const [shadowSampleRate, setShadowSampleRate] = useState<number>(
  config.shadow_sample_rate ?? 0,
);
```

3. Extend `isDirty` (147-152) to include shadow changes:

```typescript
const isDirty =
  provider !== config.provider ||
  model !== config.model ||
  temperature !== config.temperature ||
  baseUrl !== (config.base_url || "") ||
  notes !== (config.notes || "") ||
  shadowProvider !== config.shadow_provider ||
  shadowModel !== config.shadow_model ||
  shadowSampleRate !== (config.shadow_sample_rate ?? 0);
```

4. Include shadow fields in the `handleSave` payload (174-180):

```typescript
const update: Partial<AiModelConfig> = {
  provider,
  model,
  temperature,
  base_url: provider === "custom" ? baseUrl || null : null,
  notes: notes || null,
  shadow_provider: shadowProvider,
  shadow_model: shadowModel,
  shadow_sample_rate: shadowSampleRate,
};
```

5. Render the section inside the `space-y-4` block, after the Notes `<div>` (after line 362):

```tsx
{
  /* Shadow A/B */
}
<ShadowConfigFields
  presets={presets}
  shadowProvider={shadowProvider}
  shadowModel={shadowModel}
  shadowSampleRate={shadowSampleRate}
  onChange={(patch) => {
    if (patch.shadowProvider !== undefined)
      setShadowProvider(patch.shadowProvider);
    if (patch.shadowModel !== undefined) setShadowModel(patch.shadowModel);
    if (patch.shadowSampleRate !== undefined)
      setShadowSampleRate(patch.shadowSampleRate);
    setSaveStatus("idle");
  }}
/>;
```

- [ ] **Step 2.9: Build and verify shadow config round-trips**

Run: `cd packages/frontend && NEXT_DIST_DIR=.next-verify npm run build`
Expected: succeeds.

Then in the browser (`/admin/ai-models`): enable Shadow A/B on one card, pick a shadow provider/model, set 25%, Save. Reload the page and confirm the values persist (proves the DTO accepted them and the resolver-fed `select('*')` returns them). Disable shadow, Save, reload — confirm it clears to off.

- [ ] **Step 2.10: Commit**

```bash
git add packages/backend/src/ai-provider/ai-provider.dto.ts packages/backend/src/ai-provider/ai-provider.dto.spec.ts packages/frontend/lib/data/fetchers/ai-models.ts packages/frontend/app/(app)/admin/ai-models/components/ShadowConfigFields.tsx packages/frontend/app/(app)/admin/ai-models/components/ModelConfigCard.tsx
git commit -m "feat(admin/ai-models): expose shadow A/B config (provider/model/sample-rate) in the UI"
```

---

## Phase 3: Split the evaluation harness off the config route

**Why:** `/admin/ai-models` does three jobs (config / test-runner / eval-dashboard); ~70% of the code is the eval lab. Splitting it gives the config tool a single responsibility and shrinks the page. Pure relocation — no logic change.

**Approach:** Keep `/admin/ai-models` as the config-only page. Move the Test Run ID control, `TestRunner`, and `EvaluationDashboard` (plus their child components and `test-runner-config.ts`) to a sibling route `/admin/ai-models/evaluation`. Add a link between them.

**Files:**

- Create: `packages/frontend/app/(app)/admin/ai-models/evaluation/page.tsx`
- Move (git mv): `TestRunner.tsx`, `TestJobTable.tsx`, `StatusBadge.tsx`, `test-runner-config.ts`, `EvaluationDashboard.tsx`, `ScoringForm.tsx`, `CompositeResults.tsx`, `UsageSummaryTable.tsx` from `components/` → `evaluation/components/`
- Modify: `packages/frontend/app/(app)/admin/ai-models/page.tsx` (remove eval sections + Test Run ID block + the `dashboardRefreshRef` plumbing; add a link to the evaluation page)

- [ ] **Step 3.1: Move the eval/test components into the evaluation subtree**

```bash
cd packages/frontend/app/(app)/admin/ai-models
mkdir -p evaluation/components
git mv components/TestRunner.tsx evaluation/components/TestRunner.tsx
git mv components/TestJobTable.tsx evaluation/components/TestJobTable.tsx
git mv components/StatusBadge.tsx evaluation/components/StatusBadge.tsx
git mv components/test-runner-config.ts evaluation/components/test-runner-config.ts
git mv components/EvaluationDashboard.tsx evaluation/components/EvaluationDashboard.tsx
git mv components/ScoringForm.tsx evaluation/components/ScoringForm.tsx
git mv components/CompositeResults.tsx evaluation/components/CompositeResults.tsx
git mv components/UsageSummaryTable.tsx evaluation/components/UsageSummaryTable.tsx
```

These components import each other by relative path (e.g. `./TestJobTable`, `./UsageSummaryTable`) and `@/lib/data/...` (absolute) — moving them as a group preserves all relative imports. No import edits needed inside them.

- [ ] **Step 3.2: Create the evaluation page**

Create `packages/frontend/app/(app)/admin/ai-models/evaluation/page.tsx`. This hosts the Test Run ID control + TestRunner + EvaluationDashboard exactly as they currently sit on the main page (lift the Test Run ID block from the current `page.tsx` lines 129-164 verbatim, and the `dashboardRefreshRef` wiring from lines 34, 224, 227):

```tsx
/**
 * AI Model Evaluation Lab
 *
 * Batch-runs reports across models, logs usage/cost, and lets admins score
 * and rank model quality. Split out from the model-config page so each route
 * has one responsibility.
 */

"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { setTestRunId as setTestRunIdApi } from "@/lib/data/fetchers/ai-models";
import { TestRunner } from "./components/TestRunner";
import { EvaluationDashboard } from "./components/EvaluationDashboard";

export default function AiModelEvaluationPage() {
  const [testRunId, setTestRunId] = useState("");
  const [testRunSaving, setTestRunSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const dashboardRefreshRef = useRef<() => void>(null);

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-surface-container border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-on-surface">
              AI Model Evaluation Lab
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Batch-run reports across models, then score and rank quality.
            </p>
          </div>
          <Link
            href="/admin/ai-models"
            className="px-4 py-2 text-sm font-medium rounded-full bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 transition-colors duration-200"
          >
            ← Model Config
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Test Run ID — lifted verbatim from the old config page (lines 129-164). */}
        <div className="mb-6 p-4 rounded-xl bg-surface-container-low border border-outline-variant flex items-center gap-4">
          <label
            htmlFor="test-run-id"
            className="text-sm font-medium text-on-surface whitespace-nowrap"
          >
            Test Run ID
          </label>
          <input
            id="test-run-id"
            type="text"
            value={testRunId}
            onChange={(e) => setTestRunId(e.target.value)}
            placeholder="e.g. p1-sonnet46-tampa (empty = no tagging)"
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-surface border border-outline-variant text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={async () => {
              setTestRunSaving(true);
              const result = await setTestRunIdApi(testRunId || null);
              setTestRunId(result || "");
              setToast({
                message: testRunId
                  ? `Test run ID set: ${testRunId}`
                  : "Test run ID cleared.",
                type: "success",
              });
              setTimeout(() => setToast(null), 4000);
              setTestRunSaving(false);
            }}
            disabled={testRunSaving}
            className="px-4 py-2 text-sm font-medium rounded-full bg-tertiary text-on-tertiary hover:bg-tertiary/90 disabled:opacity-50 transition-colors duration-200"
          >
            {testRunSaving ? "Saving..." : testRunId ? "Set" : "Clear"}
          </button>
        </div>

        <TestRunner onBatchComplete={() => dashboardRefreshRef.current?.()} />
        <EvaluationDashboard onRefreshRef={dashboardRefreshRef} />
      </main>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg text-sm font-medium z-50 ${
            toast.type === "success"
              ? "bg-green-700 text-white"
              : "bg-red-700 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3.3: Strip the eval sections from the config page**

In `page.tsx`:

1. Remove imports of `TestRunner` and `EvaluationDashboard` (21-22). Remove `useRef` from the React import (12) if now unused. Add `import Link from "next/link";`.
2. Remove the `testRunId`, `testRunSaving`, and `dashboardRefreshRef` state (32-34) and the Test Run ID `<div>` block (129-164).
3. Remove `fetchTestRunId` / `setTestRunId` usage: in `loadConfigs`, drop the `fetchTestRunId()` call and the `setTestRunId(runId || "")` line, leaving just configs + presets in the `Promise.all`.
4. Remove the `<TestRunner ... />` and `<EvaluationDashboard ... />` lines (224, 227).
5. In the header actions (`<div className="flex items-center gap-4">`, ~111), add a link to the lab before the Refresh button:

```tsx
<Link
  href="/admin/ai-models/evaluation"
  className="px-4 py-2 text-sm font-medium rounded-full bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 transition-colors duration-200"
>
  Evaluation Lab →
</Link>
```

- [ ] **Step 3.4: Build and verify both routes**

Run: `cd packages/frontend && NEXT_DIST_DIR=.next-verify npm run build`
Expected: succeeds, no unresolved imports.

In the browser: `/admin/ai-models` shows only config cards + an "Evaluation Lab →" link; `/admin/ai-models/evaluation` shows Test Run ID + TestRunner + Dashboard and a "← Model Config" link. Run a quick Phase-1 test batch on the lab page to confirm the relocated runner still drives generation + the dashboard refreshes.

- [ ] **Step 3.5: Commit**

```bash
git add -A packages/frontend/app/(app)/admin/ai-models
git commit -m "refactor(admin/ai-models): split evaluation lab to its own route, leaving config page single-purpose"
```

---

## Phase 4: Migrate the config page to React Query

**Why:** The page uses manual `useState`/`useEffect`/`useCallback` and a ref hack (now removed in Phase 3). The rest of the app standardizes on TanStack Query (used in `map/hooks`, `dashboard/page.tsx`, etc.). Switching gives caching, automatic refetch, and a clean mutation→invalidate flow.

**Files:**

- Create: `packages/frontend/lib/data/hooks/useAiModelConfig.ts` (query + mutation hooks)
- Export from: `packages/frontend/lib/data/hooks/index.ts` (or the hooks barrel the project uses — confirm path)
- Modify: `packages/frontend/app/(app)/admin/ai-models/page.tsx` (consume hooks)

- [ ] **Step 4.1: Confirm the hooks barrel and an existing query-key convention**

Run: `cat packages/frontend/lib/data/hooks/index.ts` (or `ls packages/frontend/lib/data/hooks`) and open one existing hook (e.g. `useMetricData.ts`) to copy the exact `useQuery`/`queryKey` style and the `QueryClient` import path.
Expected: confirm `@tanstack/react-query` import and how keys are structured. Match that style below.

- [ ] **Step 4.2: Create the AI model config hooks**

Create `packages/frontend/lib/data/hooks/useAiModelConfig.ts`:

```typescript
/**
 * React Query hooks for the admin AI model configuration page.
 * Wraps the @/lib/data fetchers so the page gets caching + invalidation.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAiModelConfigs,
  fetchProviderPresets,
  updateAiModelConfig,
  type AiModelConfig,
  type ProviderPresets,
} from "@/lib/data/fetchers/ai-models";

const AI_MODEL_CONFIG_KEY = ["admin", "ai-model-config"] as const;
const AI_PRESETS_KEY = ["admin", "ai-model-presets"] as const;

export function useAiModelConfigs() {
  return useQuery<AiModelConfig[]>({
    queryKey: AI_MODEL_CONFIG_KEY,
    queryFn: fetchAiModelConfigs,
    staleTime: 0, // admin edits should reflect immediately on refetch
  });
}

export function useProviderPresets() {
  return useQuery<ProviderPresets>({
    queryKey: AI_PRESETS_KEY,
    queryFn: fetchProviderPresets,
    staleTime: 60 * 60 * 1000, // presets change only on deploy
  });
}

export function useUpdateAiModelConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { purpose: string; update: Partial<AiModelConfig> }) =>
      updateAiModelConfig(vars.purpose, vars.update),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AI_MODEL_CONFIG_KEY });
    },
  });
}
```

- [ ] **Step 4.3: Export the hooks from the barrel**

Add to `packages/frontend/lib/data/hooks/index.ts` (matching existing export style):

```typescript
export {
  useAiModelConfigs,
  useProviderPresets,
  useUpdateAiModelConfig,
} from "./useAiModelConfig";
```

If the project re-exports hooks through `@/lib/data` (`lib/data/index.ts`), add them there too, following the existing pattern.

- [ ] **Step 4.4: Rewrite the config page to use the hooks**

Replace the data-loading internals of `page.tsx`. The component keeps its toast UI but drops manual fetch state:

```tsx
"use client";

import Link from "next/link";
import {
  useAiModelConfigs,
  useProviderPresets,
  useUpdateAiModelConfig,
} from "@/lib/data/hooks";
import { useState } from "react";
import type { AiModelConfig } from "@/lib/data/fetchers/ai-models";
import { ModelConfigCard } from "./components/ModelConfigCard";

export default function AiModelConfigPage() {
  const configsQuery = useAiModelConfigs();
  const presetsQuery = useProviderPresets();
  const updateMutation = useUpdateAiModelConfig();
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const configs = configsQuery.data ?? [];
  const presets = presetsQuery.data ?? {};
  const loading = configsQuery.isLoading || presetsQuery.isLoading;

  const handleSave = async (
    purpose: string,
    update: Partial<AiModelConfig>,
  ): Promise<boolean> => {
    try {
      const result = await updateMutation.mutateAsync({ purpose, update });
      const ok = !!result;
      setToast({
        message: ok
          ? `${purpose} configuration saved.`
          : `Failed to save ${purpose} configuration.`,
        type: ok ? "success" : "error",
      });
      setTimeout(() => setToast(null), 4000);
      return ok;
    } catch {
      setToast({
        message: `Error saving ${purpose} configuration.`,
        type: "error",
      });
      setTimeout(() => setToast(null), 4000);
      return false;
    }
  };

  // ...header (with the Evaluation Lab link + a Refresh button calling
  //    configsQuery.refetch()), loading skeleton, empty state, and the
  //    configs.map(...) grid — all unchanged from the Phase 3 version, but
  //    reading `loading`, `configs`, `presets` from the hooks above and
  //    `configsQuery.refetch()` for the Refresh button.
}
```

Keep the existing header/skeleton/empty-state/grid JSX from the Phase 3 page; only the data source changes (hook values instead of `useState`). The Refresh button's `onClick` becomes `() => configsQuery.refetch()` and its disabled/label use `configsQuery.isFetching`.

- [ ] **Step 4.5: Build and verify**

Run: `cd packages/frontend && NEXT_DIST_DIR=.next-verify npm run build`
Expected: succeeds.

In the browser: confirm `/admin/ai-models` still loads configs + presets, saving a card still toasts and persists, and that the card's displayed value updates (React Query invalidation refetches). Navigate away and back — confirm cached data shows instantly then refetches.

- [ ] **Step 4.6: Commit**

```bash
git add packages/frontend/lib/data/hooks/useAiModelConfig.ts packages/frontend/lib/data/hooks/index.ts packages/frontend/app/(app)/admin/ai-models/page.tsx
git commit -m "refactor(admin/ai-models): move config page to React Query hooks (cache + invalidate)"
```

---

## Phase 5: Backend — purpose registry + bring `ai-provider.service.ts` under 300 lines

**Why:** Purposes are magic strings (a typo silently falls through to env config). And `ai-provider.service.ts` is 366 lines, over the 300 hard limit (CLAUDE.md §1.3). Extracting the completion executor — mirroring the existing `ai-stream-executor.ts` pattern — fixes both the size and isolates the provider-quirk logic.

**Files:**

- Modify: `packages/backend/src/ai-provider/ai-provider.types.ts` (add `AI_PURPOSES` + `AiPurpose`)
- Create: `packages/backend/src/ai-provider/ai-completion-executor.ts` (extracted `executeCompletion`)
- Modify: `packages/backend/src/ai-provider/ai-provider.service.ts` (delegate to the executor; drops ~90 lines)
- Modify: call sites that pass purpose strings (mechanical, mapping below)

- [ ] **Step 5.1: Add the purpose registry to types**

Append to `packages/backend/src/ai-provider/ai-provider.types.ts`:

```typescript
/**
 * Canonical AI purpose keys. Each maps to a row in `ai_model_config`.
 * Use these constants instead of string literals so a typo is a compile error,
 * not a silent fall-through to the env-var fallback config.
 */
export const AI_PURPOSES = {
  REPORT_NARRATIVE: "report_narrative",
  REPORT_OUTLINE: "report_outline",
  CUSTOM_REPORT: "custom_report",
  RESEARCH_AGENT: "research_agent",
  RESEARCH_NARRATIVE: "research_narrative",
  NEWS_SCOUT: "news_scout",
  CONVERSATION: "conversation",
  ANALYZER_HEADER_VERDICT: "analyzer_header_verdict",
  ANALYZER_SECTION_ANNOTATION: "analyzer_section_annotation",
  REPORT_FOLLOW_UP: "report_follow_up",
} as const;

export type AiPurpose = (typeof AI_PURPOSES)[keyof typeof AI_PURPOSES];
```

- [ ] **Step 5.2: Create the completion executor module**

Create `packages/backend/src/ai-provider/ai-completion-executor.ts` — lift the body of `executeCompletion` (current `ai-provider.service.ts:230-319`) into a free function, taking its dependencies explicitly (mirrors `ai-stream-executor.ts`):

```typescript
/**
 * AI Completion Executor
 *
 * Single-shot completion call + usage logging, extracted from
 * AiProviderService to keep that file under the 300-line limit.
 * Handles provider quirks: Anthropic sampling-param rejection and
 * json_object support.
 */

import { Logger } from "@nestjs/common";
import OpenAI from "openai";
import type { SupabaseService } from "../supabase/supabase.service";
import {
  AiProviderConfig,
  AiCompletionResponse,
  PROVIDER_PRESETS,
  modelRejectsSamplingParams,
  providerSupportsJsonObjectFormat,
} from "./ai-provider.types";
import { logUsage } from "./ai-usage-logger";

export async function executeCompletion(deps: {
  client: OpenAI;
  supabase: SupabaseService;
  logger: Logger;
  purpose: string;
  config: AiProviderConfig;
  messages: OpenAI.ChatCompletionMessageParam[];
  activeTestRunId: string | null;
  options: {
    maxTokens: number;
    temperature?: number;
    responseFormat?: "text" | "json";
    testRunId?: string;
    reportId?: string;
    sectionId?: string;
  };
}): Promise<AiCompletionResponse> {
  const { client, supabase, logger, purpose, config, messages, options } = deps;
  const startTime = Date.now();
  const temperature =
    options.temperature ??
    config.temperature ??
    PROVIDER_PRESETS[config.provider].defaultTemperature;

  try {
    const rejectsSampling = modelRejectsSamplingParams(
      config.provider,
      config.model,
    );
    const response = await client.chat.completions.create({
      model: config.model,
      messages,
      max_tokens: options.maxTokens,
      ...(rejectsSampling ? {} : { temperature }),
      ...(options.responseFormat === "json" &&
        providerSupportsJsonObjectFormat(config.provider) && {
          response_format: { type: "json_object" },
        }),
    });

    const durationMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || "";

    logger.log(
      `[${purpose}] ${config.provider}/${config.model} completed in ${durationMs}ms` +
        (response.usage ? ` (${response.usage.total_tokens} tokens)` : ""),
    );

    logUsage(supabase, {
      purpose,
      provider: config.provider,
      model: config.model,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
      durationMs,
      success: true,
      testRunId: options.testRunId || deps.activeTestRunId || undefined,
      reportId: options.reportId,
      sectionId: options.sectionId,
    });

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
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    logger.error(
      `[${purpose}] ${config.provider}/${config.model} failed after ${durationMs}ms: ${error.message}`,
    );
    logUsage(supabase, {
      purpose,
      provider: config.provider,
      model: config.model,
      durationMs,
      success: false,
      errorMessage: error.message,
      testRunId: options.testRunId || deps.activeTestRunId || undefined,
      reportId: options.reportId,
      sectionId: options.sectionId,
    });
    throw error;
  }
}
```

- [ ] **Step 5.3: Delegate from the service to the executor**

In `ai-provider.service.ts`:

1. Add the import:

```typescript
import { executeCompletion } from "./ai-completion-executor";
```

2. Delete the private `executeCompletion` method (230-319).

3. Replace the two call sites (`complete()` ~75 and `completeWithMessages()` ~114) that call `this.executeCompletion(...)` with a local client + the free function. For `complete()`:

```typescript
const client = this.getOrCreateClient(config);
const response = await executeCompletion({
  client,
  supabase: this.supabase,
  logger: this.logger,
  purpose,
  config,
  messages,
  activeTestRunId: this.activeTestRunId,
  options: {
    maxTokens: request.maxTokens,
    temperature,
    responseFormat: request.responseFormat,
    testRunId: request.testRunId,
    reportId: request.reportId,
    sectionId: request.sectionId,
  },
});
```

For `completeWithMessages()`:

```typescript
const client = this.getOrCreateClient(config);
const response = await executeCompletion({
  client,
  supabase: this.supabase,
  logger: this.logger,
  purpose,
  config,
  messages,
  activeTestRunId: this.activeTestRunId,
  options: { maxTokens },
});
```

- [ ] **Step 5.4: Verify the service is now under 300 lines and builds**

Run: `cd packages/backend && node -e "console.log(require('fs').readFileSync('src/ai-provider/ai-provider.service.ts','utf8').split('\n').length)"`
Expected: < 300.

Run: `cd packages/backend && npm run build`
Expected: exits 0.

- [ ] **Step 5.5: Run the existing AI-provider tests**

Run: `cd packages/backend && npx jest ai-provider ai-shadow`
Expected: existing suites pass (the extraction preserves behavior exactly).

- [ ] **Step 5.6: Convert known purpose call sites to the registry (mechanical)**

Replace string literals with `AI_PURPOSES.*` at these call sites (import `AI_PURPOSES` from `../ai-provider/ai-provider.types` or the correct relative path). Mapping:

| Literal                                                         | Constant                                  | Known file(s)                                                             |
| --------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `'report_narrative'`                                            | `AI_PURPOSES.REPORT_NARRATIVE`            | `reports/report-ai.service.ts`, `reports/report-generation-v2.service.ts` |
| `'report_outline'`                                              | `AI_PURPOSES.REPORT_OUTLINE`              | `reports/report-generation-v2.service.ts`                                 |
| `'conversation'`                                                | `AI_PURPOSES.CONVERSATION`                | `reports/report-ai.service.ts`                                            |
| `'news_scout'`                                                  | `AI_PURPOSES.NEWS_SCOUT`                  | `reports/news-scout-functions.ts`                                         |
| `'analyzer_header_verdict'`                                     | `AI_PURPOSES.ANALYZER_HEADER_VERDICT`     | `analyzer/analyzer.service.ts`                                            |
| `'analyzer_section_annotation'`                                 | `AI_PURPOSES.ANALYZER_SECTION_ANNOTATION` | `analyzer/ai-insights.service.ts`                                         |
| `'report_follow_up'`                                            | `AI_PURPOSES.REPORT_FOLLOW_UP`            | `reports/report-follow-up.service.ts`                                     |
| `'research_agent'` / `'research_narrative'` / `'custom_report'` | matching constant                         | research/report services                                                  |

For each: `grep -rn "'<literal>'" packages/backend/src` to find every occurrence, swap to the constant, and import `AI_PURPOSES`. Do NOT change the literal values — only how they are referenced. Skip occurrences inside migrations and the seed strings.

- [ ] **Step 5.7: Build after the conversion**

Run: `cd packages/backend && npm run build`
Expected: exits 0. (Any typo now surfaces as a missing-constant compile error — which is the point.)

- [ ] **Step 5.8: Commit**

```bash
git add packages/backend/src/ai-provider/ai-provider.types.ts packages/backend/src/ai-provider/ai-completion-executor.ts packages/backend/src/ai-provider/ai-provider.service.ts packages/backend/src
git commit -m "refactor(ai-provider): add AI_PURPOSES registry, extract completion executor (service <300 lines)"
```

---

## Phase 6: Schema debt — drop unused columns, seed `report_follow_up`

**Why:** `max_tokens_override` and `prompt_version` exist in the DB but are read by nothing (verified). `report_follow_up` is used in code but never seeded, so it silently rides env config. Clean the schema and make the purpose explicit & admin-tunable.

**Files:**

- Create: `supabase/migrations/20260616HHMMSS_ai_model_config_drop_unused_columns_seed_follow_up.sql`
- Modify: `packages/frontend/lib/data/fetchers/ai-models.ts` (remove `max_tokens_override` from `AiModelConfig`)
- Modify: `packages/backend/src/reports/reports-orchestrator-v2-routing.ts` (fix the stale header comment)
- (DTO already drops `max_tokens_override` in Phase 2 Step 2.3; if Phase 2 was skipped, remove it from the DTO here.)

- [ ] **Step 6.1: Confirm zero readers one more time (guard against drift since planning)**

Run: `grep -rn "max_tokens_override\|maxTokensOverride\|prompt_version\|promptVersion" packages/backend/src packages/frontend/lib packages/frontend/app | grep -v ".next"`
Expected: only the DTO/type declarations and the stale comment in `reports-orchestrator-v2-routing.ts:5` — NO code that reads either column's value. If anything reads them, STOP and reassess (do not drop a column something reads).

- [ ] **Step 6.2: Write the migration (real current timestamp)**

Create `supabase/migrations/20260616HHMMSS_ai_model_config_drop_unused_columns_seed_follow_up.sql` (replace `HHMMSS` with the actual current UTC time so the version is the max in `schema_migrations` — backdated files are silently skipped):

```sql
-- Migration: ai_model_config_drop_unused_columns_seed_follow_up
--
-- 1. Drop max_tokens_override and prompt_version (no code reads either).
-- 2. Seed the report_follow_up purpose, which is called by
--    report-follow-up.service.ts but was never seeded (silently rode env fallback).

ALTER TABLE ai_model_config
  DROP COLUMN IF EXISTS max_tokens_override,
  DROP COLUMN IF EXISTS prompt_version;

INSERT INTO ai_model_config (purpose, label, provider, model, temperature) VALUES
  ('report_follow_up', 'Report Follow-up (30-day market change summary)', 'deepseek', 'deepseek-v4-pro', 0.30)
ON CONFLICT (purpose) DO NOTHING;
```

- [ ] **Step 6.3: Apply the migration to the dev/remote DB and verify**

Apply via the project's migration path (Supabase CLI `supabase db push`, or the MCP `apply_migration` against the linked project — match how migrations are normally applied here). Then verify:

```sql
-- columns gone:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ai_model_config'
  AND column_name IN ('max_tokens_override', 'prompt_version');
-- expect 0 rows

-- purpose seeded:
SELECT purpose, provider, model FROM ai_model_config WHERE purpose = 'report_follow_up';
-- expect 1 row
```

Also confirm the new version is the max in `schema_migrations` (saved lesson — out-of-order migrations are skipped silently):
`SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3;`

- [ ] **Step 6.4: Remove `max_tokens_override` from the frontend type**

In `packages/frontend/lib/data/fetchers/ai-models.ts`, delete the `max_tokens_override: number | null;` line from the `AiModelConfig` interface.

- [ ] **Step 6.5: Fix the stale routing comment**

In `packages/backend/src/reports/reports-orchestrator-v2-routing.ts`, update the file header (lines 4-7) to drop the false "checking ai_model_config for a prompt_version flag" claim:

```typescript
/**
 * V2 Routing Helpers for the Reports Orchestrator
 *
 * All reports use the v2 two-pass generation pipeline. Maps report templates
 * to the v2 report type identifiers.
 */
```

- [ ] **Step 6.6: Build both packages**

Run: `cd packages/frontend && NEXT_DIST_DIR=.next-verify npm run build`
Expected: succeeds.
Run: `cd packages/backend && npm run build`
Expected: exits 0.

- [ ] **Step 6.7: Smoke-test that report generation still works (report_follow_up now has a row)**

In the browser/app, trigger a report generation path that uses these purposes (or re-run a Phase-1 eval batch on the lab page) and confirm reports still generate. Confirm the `report_follow_up` card now appears on `/admin/ai-models` (the page renders whatever rows `listConfigs` returns).

- [ ] **Step 6.8: Commit**

```bash
git add supabase/migrations packages/frontend/lib/data/fetchers/ai-models.ts packages/backend/src/reports/reports-orchestrator-v2-routing.ts packages/backend/src/ai-provider/ai-provider.dto.ts
git commit -m "chore(ai-models): drop unused max_tokens_override/prompt_version columns, seed report_follow_up purpose"
```

---

## Self-Review

**Spec coverage (maps to the 6 streamline items the user approved):**

- #1 duplicated model list → Phase 1 ✓
- #2 duplicated defaults → folded into Phase 1 (presets carry `defaultModel`) ✓
- #3 split the three tools → Phase 3 ✓
- #4 React Query → Phase 4 ✓
- #5 backend file-size + magic strings → Phase 5 ✓
- #6 schema debt (shadow exposed / unused columns / unseeded purpose) → Phase 2 (shadow) + Phase 6 (columns + seed) ✓

**Type consistency:** `ProviderPresets` / `ProviderPreset` / `ProviderModelOption` defined in Phase 1 Step 1.1 and reused in Phases 1–4. `AiModelConfig` gains shadow fields (Phase 2) and loses `max_tokens_override` (Phase 6) — sequenced so the field exists when the DB column does. `AI_PURPOSES` defined once (Phase 5) and referenced consistently. Mutation hook var shape `{ purpose, update }` matches its `mutationFn` and the page call site.

**Placeholder scan:** Phase 4 Step 4.4 intentionally references "unchanged header/skeleton/grid JSX from Phase 3" rather than re-pasting ~120 lines — this is a relocation of already-shown code, not an unspecified implementation. Phase 3 component moves use `git mv` (no content changes). All net-new code (fetcher type, ShadowConfigFields, executor module, hooks, migration, DTO) is shown in full.

**Ordering safety:** Phases are independent and safest-first. Phase 2's DTO edit pre-removes `max_tokens_override`; Phase 6 drops the column — if phases run out of order or 2 is skipped, Step 2.3 and Step 6 both note the fallback. Migration uses a real timestamp per the saved Supabase lesson.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-16-ai-models-admin-streamline.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (or per phase), review between tasks, fast iteration. Good fit here since phases are independent.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batched with checkpoints for your review.

Which approach?
