# Unified Embed Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the disconnected two-phase embed flow (CreateEmbedDialog + WidgetConfigurator) with a single 3-step wizard that creates embeds in one pass.

**Architecture:** A new `EmbedBuilder` component orchestrates a 3-step wizard (Choose Widget -> Configure -> Get Code). The backend gains `is_draft` and `embed_config` columns so draft tokens power the live preview, then get finalized when the user copies their code. A new `ExistingEmbeds` component replaces the old token list with simplified embed cards that include a copy-code button.

**Tech Stack:** React 19, Next.js 16, Tailwind CSS 4, NestJS 11, Supabase (PostgreSQL), lucide-react icons

**Spec:** `docs/superpowers/specs/2026-03-28-unified-embed-builder-design.md`

---

## File Structure

### New Files (Frontend)

| File                                                                       | Responsibility                                                             |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/frontend/app/org/[slug]/admin/embeds/EmbedBuilder.tsx`           | Main wizard component — orchestrates steps, manages draft token lifecycle  |
| `packages/frontend/app/org/[slug]/admin/embeds/StepIndicator.tsx`          | 3-dot progress indicator with labels                                       |
| `packages/frontend/app/org/[slug]/admin/embeds/steps/StepChooseWidget.tsx` | Step 1: widget type card picker                                            |
| `packages/frontend/app/org/[slug]/admin/embeds/steps/StepConfigure.tsx`    | Step 2: configuration + live preview (delegates to existing configurators) |
| `packages/frontend/app/org/[slug]/admin/embeds/steps/StepGetCode.tsx`      | Step 3: embed code display + copy button                                   |
| `packages/frontend/app/org/[slug]/admin/embeds/ExistingEmbeds.tsx`         | Collapsible section listing existing embeds with copy/revoke               |
| `packages/frontend/app/org/[slug]/admin/embeds/embed-builder-types.ts`     | Shared types for the wizard (WidgetType, EmbedBuilderState, etc.)          |

### Modified Files

| File                                                            | Changes                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/frontend/app/org/[slug]/admin/embeds/page.tsx`        | Gut and simplify: render EmbedBuilder + ExistingEmbeds                    |
| `packages/frontend/lib/data/fetchers/org-embeds.ts`             | Add `is_draft` and `embed_config` to types and create function            |
| `packages/frontend/lib/data/index.ts`                           | Export new `EmbedConfig` type                                             |
| `packages/backend/src/org-embeds/dto/create-embed-token.dto.ts` | Add optional `is_draft` and `embed_config` fields                         |
| `packages/backend/src/org-embeds/dto/update-embed-token.dto.ts` | Add optional `is_draft` and `embed_config` fields                         |
| `packages/backend/src/org-embeds/org-embeds.service.ts`         | Handle `is_draft`/`embed_config` in create/update/list; add draft cleanup |
| `packages/backend/src/org-embeds/org-embeds.controller.ts`      | Filter drafts from list; pass new fields through                          |

### Files to Delete (After Verification)

| File                                                                   | Replaced By                              |
| ---------------------------------------------------------------------- | ---------------------------------------- |
| `packages/frontend/app/org/components/CreateEmbedDialog.tsx`           | EmbedBuilder wizard flow                 |
| `packages/frontend/app/org/components/EmbedTokenCard.tsx`              | ExistingEmbeds component                 |
| `packages/frontend/app/org/components/EmbedCodeSnippet.tsx`            | StepGetCode + ExistingEmbeds copy button |
| `packages/frontend/app/org/[slug]/admin/embeds/WidgetConfigurator.tsx` | EmbedBuilder Step 2                      |

### Reused As-Is (No Changes)

| File                                  | Used By                    |
| ------------------------------------- | -------------------------- |
| `configurator/GeographySearch.tsx`    | StepConfigure              |
| `configurator/ShapeSizeSelector.tsx`  | StepConfigure              |
| `configurator/EmbedPreview.tsx`       | StepConfigure, StepGetCode |
| `configurator/ScoreConfigurator.tsx`  | StepConfigure              |
| `configurator/MetricConfigurator.tsx` | StepConfigure              |
| `configurator/MapConfigurator.tsx`    | StepConfigure              |
| `configurator/ChartConfigurator.tsx`  | StepConfigure              |
| `configurator/ReportConfigurator.tsx` | StepConfigure              |

---

## Task 1: Backend — Add `is_draft` and `embed_config` columns

**Files:**

- Create: `scripts/migrations/130-embed-builder-columns.sql`
- Modify: `packages/backend/src/org-embeds/dto/create-embed-token.dto.ts`
- Modify: `packages/backend/src/org-embeds/dto/update-embed-token.dto.ts`

- [ ] **Step 1: Write the migration SQL**

Create `scripts/migrations/130-embed-builder-columns.sql`:

```sql
-- Migration 130: Add draft token and embed config support for Embed Builder wizard
-- The wizard creates a draft token for live preview, then finalizes it on completion.

BEGIN;

ALTER TABLE organization_embed_tokens
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS embed_config JSONB;

-- Partial index: exclude drafts from normal list queries
CREATE INDEX IF NOT EXISTS idx_embed_tokens_active_non_draft
  ON organization_embed_tokens(organization_id)
  WHERE is_active = true AND is_draft = false;

COMMIT;
```

- [ ] **Step 2: Run migration against local database**

Run: `cd D:/projects/rei-platform && npx supabase db push` or apply via Supabase dashboard.
Expected: Migration applies without error, columns visible in table.

- [ ] **Step 3: Update CreateEmbedTokenDto with new optional fields**

Edit `packages/backend/src/org-embeds/dto/create-embed-token.dto.ts`:

```typescript
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ArrayMinSize,
  IsIn,
  IsOptional,
  IsBoolean,
  IsObject,
} from "class-validator";

export class CreateEmbedTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  allowed_origins: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(["score", "metric_card", "map", "chart", "map_full", "report"], {
    each: true,
  })
  widget_types: string[];

  @IsOptional()
  @IsBoolean()
  is_draft?: boolean;

  @IsOptional()
  @IsObject()
  embed_config?: Record<string, unknown>;
}
```

- [ ] **Step 4: Update UpdateEmbedTokenDto with new optional fields**

Edit `packages/backend/src/org-embeds/dto/update-embed-token.dto.ts`:

```typescript
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ArrayMinSize,
  IsIn,
  IsOptional,
  IsBoolean,
  IsObject,
} from "class-validator";

export class UpdateEmbedTokenDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  allowed_origins?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(["score", "metric_card", "map", "chart", "map_full", "report"], {
    each: true,
  })
  widget_types?: string[];

  @IsOptional()
  @IsBoolean()
  is_draft?: boolean;

  @IsOptional()
  @IsObject()
  embed_config?: Record<string, unknown>;
}
```

- [ ] **Step 5: Commit**

```bash
git add scripts/migrations/130-embed-builder-columns.sql packages/backend/src/org-embeds/dto/
git commit -m "feat(backend): add is_draft and embed_config columns for embed builder wizard"
```

---

## Task 2: Backend — Update service to handle drafts

**Files:**

- Modify: `packages/backend/src/org-embeds/org-embeds.service.ts`
- Modify: `packages/backend/src/org-embeds/org-embeds.controller.ts`

- [ ] **Step 1: Update `createToken` in service to persist draft fields**

In `packages/backend/src/org-embeds/org-embeds.service.ts`, find the `createToken` method. Locate the `.insert()` call and add the new columns. The current insert looks like:

```typescript
const { data, error } = await this.supabase
  .from("organization_embed_tokens")
  .insert({
    organization_id: orgId,
    name: dto.name,
    token: tokenValue,
    allowed_origins: dto.allowed_origins,
    widget_types: dto.widget_types,
    created_by: createdBy,
  })
  .select()
  .single();
```

Change it to:

```typescript
const { data, error } = await this.supabase
  .from("organization_embed_tokens")
  .insert({
    organization_id: orgId,
    name: dto.name,
    token: tokenValue,
    allowed_origins: dto.allowed_origins,
    widget_types: dto.widget_types,
    created_by: createdBy,
    is_draft: dto.is_draft ?? false,
    embed_config: dto.embed_config ?? null,
  })
  .select()
  .single();
```

- [ ] **Step 2: Update `updateToken` in service to handle draft finalization and embed_config**

In the same file, find the `updateToken` method. The current update builds an object of changed fields. Add handling for the new fields:

```typescript
async updateToken(
  orgId: string,
  tokenId: string,
  dto: UpdateEmbedTokenDto,
): Promise<EmbedTokenRecord> {
  const updates: Record<string, unknown> = {};
  if (dto.name !== undefined) updates.name = dto.name;
  if (dto.allowed_origins !== undefined) updates.allowed_origins = dto.allowed_origins;
  if (dto.widget_types !== undefined) updates.widget_types = dto.widget_types;
  if (dto.is_draft !== undefined) updates.is_draft = dto.is_draft;
  if (dto.embed_config !== undefined) updates.embed_config = dto.embed_config;

  // ... rest of the method (supabase .update(updates) call) stays the same
```

- [ ] **Step 3: Update `listTokens` in service to exclude drafts**

In the `listTokens` method, add a filter to exclude draft tokens. Find the existing query:

```typescript
const { data, error } = await this.supabase
  .from("organization_embed_tokens")
  .select("id, name, allowed_origins, widget_types, is_active, created_at")
  .eq("organization_id", orgId)
  .order("created_at", { ascending: false });
```

Add `embed_config` to the select and filter out drafts:

```typescript
const { data, error } = await this.supabase
  .from("organization_embed_tokens")
  .select(
    "id, name, allowed_origins, widget_types, is_active, created_at, embed_config",
  )
  .eq("organization_id", orgId)
  .eq("is_draft", false)
  .order("created_at", { ascending: false });
```

- [ ] **Step 4: Update `EmbedTokenRecord` interface to include new fields**

In the same file, add the new fields to the interface:

```typescript
export interface EmbedTokenRecord {
  id: string;
  organization_id: string;
  name: string;
  token: string;
  allowed_origins: string[];
  widget_types: string[];
  created_by: string;
  is_active: boolean;
  is_draft: boolean;
  embed_config: EmbedConfig | null;
  created_at: string;
}

export interface EmbedConfig {
  widgetType: string;
  embedPath: string;
  geographyName: string;
  width: number;
  height: number;
}
```

- [ ] **Step 5: Update `validateToken` to allow wildcard origins for draft tokens**

In the `validateToken` method, draft tokens use `["*"]` for allowed_origins. The existing `matchOrigin` method should already handle `*` as a wildcard match. Verify that it does. If not, add a check at the top of `matchOrigin`:

```typescript
private matchOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes('*')) return true;
  // ... rest of existing logic
}
```

- [ ] **Step 6: Verify backend compiles**

Run: `cd D:/projects/rei-platform/packages/backend && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/org-embeds/
git commit -m "feat(backend): handle draft tokens and embed_config in service layer"
```

---

## Task 3: Frontend Data Layer — Update types and fetchers

**Files:**

- Modify: `packages/frontend/lib/data/fetchers/org-embeds.ts`
- Modify: `packages/frontend/lib/data/index.ts`

- [ ] **Step 1: Add `EmbedConfig` interface and update `EmbedTokenListItem`**

In `packages/frontend/lib/data/fetchers/org-embeds.ts`, add the new types near the existing interfaces:

```typescript
export interface EmbedConfig {
  widgetType: string;
  embedPath: string;
  geographyName: string;
  width: number;
  height: number;
}

export interface EmbedToken {
  id: string;
  name: string;
  token: string;
  allowed_origins: string[];
  widget_types: string[];
  is_active: boolean;
  is_draft?: boolean;
  embed_config?: EmbedConfig | null;
  created_at: string;
}

export interface EmbedTokenListItem {
  id: string;
  name: string;
  allowed_origins: string[];
  widget_types: string[];
  is_active: boolean;
  embed_config?: EmbedConfig | null;
  created_at: string;
}
```

- [ ] **Step 2: Update `createOrgEmbedToken` to accept draft fields**

Find the existing function signature and update:

```typescript
export async function createOrgEmbedToken(
  slug: string,
  data: {
    name: string;
    allowed_origins: string[];
    widget_types: string[];
    is_draft?: boolean;
    embed_config?: EmbedConfig | null;
  },
): Promise<EmbedToken> {
  return fetchAPI<EmbedToken>(`/api/org/${slug}/embed-tokens`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
```

- [ ] **Step 3: Update `updateOrgEmbedToken` to accept new fields**

Find the existing function and update:

```typescript
export async function updateOrgEmbedToken(
  slug: string,
  tokenId: string,
  data: {
    name?: string;
    allowed_origins?: string[];
    widget_types?: string[];
    is_draft?: boolean;
    embed_config?: EmbedConfig | null;
  },
): Promise<EmbedTokenListItem> {
  return fetchAPI<EmbedTokenListItem>(
    `/api/org/${slug}/embed-tokens/${tokenId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
}
```

- [ ] **Step 4: Export `EmbedConfig` from data layer index**

In `packages/frontend/lib/data/index.ts`, add `EmbedConfig` to the org-embeds export block:

```typescript
export {
  fetchOrgEmbedTokens,
  createOrgEmbedToken,
  updateOrgEmbedToken,
  revokeOrgEmbedToken,
  fetchEmbedBranding,
  fetchEmbedScore,
  fetchEmbedMetricCard,
  fetchEmbedMapData,
  type EmbedToken,
  type EmbedTokenListItem,
  type EmbedConfig,
  type EmbedBranding,
  type EmbedScoreData,
  type EmbedMetricCardData,
  type EmbedMapRegion,
  type EmbedMapData,
} from "./fetchers";
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/data/
git commit -m "feat(data): add EmbedConfig type and draft token support to fetchers"
```

---

## Task 4: Frontend — Shared types and StepIndicator

**Files:**

- Create: `packages/frontend/app/org/[slug]/admin/embeds/embed-builder-types.ts`
- Create: `packages/frontend/app/org/[slug]/admin/embeds/StepIndicator.tsx`

- [ ] **Step 1: Create shared types file**

Create `packages/frontend/app/org/[slug]/admin/embeds/embed-builder-types.ts`:

```typescript
import type { EmbedConfig } from "@/lib/data";

export type WidgetType =
  | "score"
  | "metric_card"
  | "map"
  | "map_full"
  | "chart"
  | "report";

export interface WidgetTypeOption {
  type: WidgetType;
  label: string;
  description: string;
  iconName: string; // lucide icon name, resolved in component
}

export const WIDGET_TYPES: WidgetTypeOption[] = [
  {
    type: "score",
    label: "Score Ring",
    description: "Show a PropertyIQ score for any market",
    iconName: "Target",
  },
  {
    type: "metric_card",
    label: "Single Metric",
    description: "One key number with trend arrow",
    iconName: "BarChart3",
  },
  {
    type: "map",
    label: "Map Snapshot",
    description: "A small choropleth map",
    iconName: "Map",
  },
  {
    type: "map_full",
    label: "Interactive Map",
    description: "Full map visitors can explore",
    iconName: "Globe",
  },
  {
    type: "chart",
    label: "Trend Chart",
    description: "Compare trends across locations",
    iconName: "TrendingUp",
  },
  {
    type: "report",
    label: "Full Report",
    description: "Embed an entire market report",
    iconName: "FileText",
  },
];

/** Widget types that use responsive sizing instead of shape/size selector */
export const RESPONSIVE_WIDGET_TYPES: WidgetType[] = ["map_full", "report"];

/** Maps icon name string to the widget type for display in existing embeds */
export const WIDGET_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  WIDGET_TYPES.map((w) => [w.type, w.label]),
);

export type { EmbedConfig };
```

- [ ] **Step 2: Create StepIndicator component**

Create `packages/frontend/app/org/[slug]/admin/embeds/StepIndicator.tsx`:

```tsx
"use client";

import React from "react";

interface Step {
  label: string;
  number: number;
}

const STEPS: Step[] = [
  { number: 1, label: "Choose Widget" },
  { number: 2, label: "Configure" },
  { number: 3, label: "Get Your Code" },
];

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  onStepClick: (step: 1 | 2 | 3) => void;
  /** Highest step the user has reached (can click back to any step <= this) */
  maxReachedStep: 1 | 2 | 3;
}

export function StepIndicator({
  currentStep,
  onStepClick,
  maxReachedStep,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-8">
      {STEPS.map((step, i) => {
        const isActive = step.number === currentStep;
        const isCompleted = step.number < currentStep;
        const isClickable = step.number <= maxReachedStep;

        return (
          <React.Fragment key={step.number}>
            {i > 0 && (
              <div
                className={`hidden sm:block h-px w-12 ${
                  step.number <= currentStep
                    ? "bg-primary"
                    : "bg-outline-variant"
                }`}
              />
            )}
            <button
              type="button"
              onClick={() =>
                isClickable && onStepClick(step.number as 1 | 2 | 3)
              }
              disabled={!isClickable}
              className={`flex flex-col items-center gap-1.5 transition-colors duration-200 ${
                isClickable ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-primary text-on-primary"
                    : isCompleted
                      ? "bg-primary/20 text-primary"
                      : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {isCompleted ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isActive
                    ? "text-primary"
                    : isCompleted
                      ? "text-primary/70"
                      : "text-on-surface-variant"
                }`}
              >
                {step.label}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/org/\[slug\]/admin/embeds/embed-builder-types.ts packages/frontend/app/org/\[slug\]/admin/embeds/StepIndicator.tsx
git commit -m "feat(embeds): add shared types and step indicator for embed builder wizard"
```

---

## Task 5: Frontend — Step 1 (Choose Widget)

**Files:**

- Create: `packages/frontend/app/org/[slug]/admin/embeds/steps/StepChooseWidget.tsx`

- [ ] **Step 1: Create StepChooseWidget component**

Create `packages/frontend/app/org/[slug]/admin/embeds/steps/StepChooseWidget.tsx`:

```tsx
"use client";

import React from "react";
import {
  Target,
  BarChart3,
  Map,
  Globe,
  TrendingUp,
  FileText,
} from "lucide-react";
import { WIDGET_TYPES, type WidgetType } from "../embed-builder-types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Target,
  BarChart3,
  Map,
  Globe,
  TrendingUp,
  FileText,
};

interface StepChooseWidgetProps {
  selectedType: WidgetType | null;
  onSelect: (type: WidgetType) => void;
}

export function StepChooseWidget({
  selectedType,
  onSelect,
}: StepChooseWidgetProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-on-surface">
        What do you want to show?
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {WIDGET_TYPES.map((widget) => {
          const Icon = ICON_MAP[widget.iconName];
          const isSelected = selectedType === widget.type;

          return (
            <button
              key={widget.type}
              type="button"
              onClick={() => onSelect(widget.type)}
              className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-200 text-center ${
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-outline-variant bg-surface hover:border-primary/40 hover:bg-surface-container-low"
              }`}
            >
              {Icon && (
                <Icon
                  className={`w-7 h-7 ${
                    isSelected ? "text-primary" : "text-on-surface-variant"
                  }`}
                />
              )}
              <div>
                <div
                  className={`text-sm font-medium ${
                    isSelected ? "text-primary" : "text-on-surface"
                  }`}
                >
                  {widget.label}
                </div>
                <div className="text-xs text-on-surface-variant mt-0.5">
                  {widget.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/org/\[slug\]/admin/embeds/steps/
git commit -m "feat(embeds): add Step 1 - widget type card picker"
```

---

## Task 6: Frontend — Step 2 (Configure)

**Files:**

- Create: `packages/frontend/app/org/[slug]/admin/embeds/steps/StepConfigure.tsx`

- [ ] **Step 1: Create StepConfigure component**

This component reuses all existing configurators. It adds the website URL input and arranges the layout with a side-by-side preview on desktop.

Create `packages/frontend/app/org/[slug]/admin/embeds/steps/StepConfigure.tsx`:

```tsx
"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  type WidgetType,
  RESPONSIVE_WIDGET_TYPES,
} from "../embed-builder-types";
import { ScoreConfigurator } from "../configurator/ScoreConfigurator";
import { MetricConfigurator } from "../configurator/MetricConfigurator";
import { MapConfigurator } from "../configurator/MapConfigurator";
import { ChartConfigurator } from "../configurator/ChartConfigurator";
import { ReportConfigurator } from "../configurator/ReportConfigurator";
import {
  ShapeSizeSelector,
  getDimensions,
  type Shape,
  type Size,
} from "../configurator/ShapeSizeSelector";
import { EmbedPreview } from "../configurator/EmbedPreview";

interface StepConfigureProps {
  widgetType: WidgetType;
  token: string;
  shape: Shape;
  size: Size;
  onShapeChange: (s: Shape) => void;
  onSizeChange: (s: Size) => void;
  websiteUrl: string;
  onWebsiteUrlChange: (url: string) => void;
  onEmbedUrlChange: (url: string | null) => void;
  embedUrl: string | null;
}

function extractOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return null;
  }
}

function isValidUrl(value: string): boolean {
  if (!value) return true; // Empty is valid (not yet filled)
  return /^https?:\/\/.+/.test(value);
}

function ActiveConfigurator({
  widgetType,
  onUrlChange,
}: {
  widgetType: WidgetType;
  onUrlChange: (url: string | null) => void;
}) {
  switch (widgetType) {
    case "score":
      return <ScoreConfigurator onUrlChange={onUrlChange} />;
    case "metric_card":
      return <MetricConfigurator onUrlChange={onUrlChange} />;
    case "map":
    case "map_full":
      return <MapConfigurator onUrlChange={onUrlChange} />;
    case "chart":
      return <ChartConfigurator onUrlChange={onUrlChange} />;
    case "report":
      return <ReportConfigurator onUrlChange={onUrlChange} />;
    default:
      return null;
  }
}

export function StepConfigure({
  widgetType,
  token,
  shape,
  size,
  onShapeChange,
  onSizeChange,
  websiteUrl,
  onWebsiteUrlChange,
  onEmbedUrlChange,
  embedUrl,
}: StepConfigureProps) {
  const [urlTouched, setUrlTouched] = useState(false);

  const showShapeSize = !RESPONSIVE_WIDGET_TYPES.includes(widgetType);
  const dims = getDimensions(shape, size);
  const urlValid = isValidUrl(websiteUrl);
  const extractedOrigin = websiteUrl ? extractOrigin(websiteUrl) : null;

  const handleUrlBlur = useCallback(() => {
    setUrlTouched(true);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left: Configuration */}
      <div className="flex-1 space-y-6 min-w-0">
        <h3 className="text-lg font-medium text-on-surface">
          Configure your widget
        </h3>

        {/* Type-specific configurator */}
        <div className="space-y-4">
          <ActiveConfigurator
            widgetType={widgetType}
            onUrlChange={onEmbedUrlChange}
          />
        </div>

        {/* Shape & Size (not for responsive widgets) */}
        {showShapeSize && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-on-surface">
              Shape & Size
            </label>
            <ShapeSizeSelector
              shape={shape}
              size={size}
              onShapeChange={onShapeChange}
              onSizeChange={onSizeChange}
            />
          </div>
        )}

        {/* Website URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-on-surface">
            Where will you put this embed?
          </label>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => onWebsiteUrlChange(e.target.value)}
            onBlur={handleUrlBlur}
            placeholder="https://yourbrokerage.com"
            className={`w-full h-12 px-4 bg-surface border rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-200 ${
              urlTouched && websiteUrl && !urlValid
                ? "border-red-500"
                : "border-outline-variant"
            }`}
          />
          {urlTouched && websiteUrl && !urlValid ? (
            <p className="text-xs text-red-500">
              Enter a valid URL starting with http:// or https://
            </p>
          ) : extractedOrigin && extractedOrigin !== websiteUrl ? (
            <p className="text-xs text-on-surface-variant">
              We&apos;ll restrict the embed to{" "}
              <span className="font-medium">{extractedOrigin}</span>
            </p>
          ) : (
            <p className="text-xs text-on-surface-variant">
              We&apos;ll make sure the embed only works on this website.
            </p>
          )}
        </div>
      </div>

      {/* Right: Live Preview */}
      <div className="lg:w-[420px] shrink-0">
        {embedUrl && token ? (
          <div className="sticky top-4">
            <label className="text-sm font-medium text-on-surface mb-2 block">
              Live Preview
            </label>
            <EmbedPreview
              embedUrl={embedUrl}
              width={showShapeSize ? dims.w : 400}
              height={showShapeSize ? dims.h : 300}
              token={token}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant text-sm">
            Configure the widget to see a preview
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/org/\[slug\]/admin/embeds/steps/StepConfigure.tsx
git commit -m "feat(embeds): add Step 2 - configuration with live preview and website URL"
```

---

## Task 7: Frontend — Step 3 (Get Your Code)

**Files:**

- Create: `packages/frontend/app/org/[slug]/admin/embeds/steps/StepGetCode.tsx`

- [ ] **Step 1: Create StepGetCode component**

Create `packages/frontend/app/org/[slug]/admin/embeds/steps/StepGetCode.tsx`:

```tsx
"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Copy, Check, Pencil, CheckCircle } from "lucide-react";
import { EmbedPreview } from "../configurator/EmbedPreview";

interface StepGetCodeProps {
  embedUrl: string;
  token: string;
  width: number;
  height: number;
  name: string;
  onNameChange: (name: string) => void;
  onCreateAnother: () => void;
  onDone: () => void;
}

const PRODUCTION_HOST = "https://www.propertyiq.app";

export function StepGetCode({
  embedUrl,
  token,
  width,
  height,
  name,
  onNameChange,
  onCreateAnother,
  onDone,
}: StepGetCodeProps) {
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(name);

  const separator = embedUrl.includes("?") ? "&" : "?";
  const productionSrc = `${PRODUCTION_HOST}${embedUrl}${separator}token=${token}`;

  const snippet = useMemo(
    () =>
      `<iframe\n  src="${productionSrc}"\n  width="${width}"\n  height="${height}"\n  frameborder="0"\n  style="border-radius: 8px;"\n></iframe>`,
    [productionSrc, width, height],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy
    }
  }, [snippet]);

  const handleNameSave = useCallback(() => {
    onNameChange(nameInput.trim() || name);
    setEditingName(false);
  }, [nameInput, name, onNameChange]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Success Header */}
      <div className="flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-green-500" />
        <h3 className="text-lg font-medium text-on-surface">
          Your embed is ready!
        </h3>
      </div>

      {/* Code Block */}
      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
        <pre className="p-4 text-sm font-mono text-on-surface overflow-x-auto whitespace-pre">
          {snippet}
        </pre>

        {/* Copy Button */}
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              copied
                ? "bg-green-600 text-white"
                : "bg-primary text-on-primary hover:bg-primary/90"
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Code
              </>
            )}
          </button>
        </div>
      </div>

      {/* Helper Text */}
      <p className="text-sm text-on-surface-variant text-center">
        Paste this into your website&apos;s HTML where you want the widget to
        appear.
      </p>

      {/* Live Preview */}
      <div className="flex justify-center">
        <EmbedPreview
          embedUrl={embedUrl}
          width={width}
          height={height}
          token={token}
        />
      </div>

      {/* Name (editable) */}
      <div className="flex items-center gap-2 justify-center">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
              className="h-9 px-3 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <button
              type="button"
              onClick={handleNameSave}
              className="text-primary hover:text-primary/80"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameInput(name);
              setEditingName(true);
            }}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span>{name}</span>
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <button
          type="button"
          onClick={onCreateAnother}
          className="px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 rounded-xl transition-colors duration-200"
        >
          Create Another
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-5 py-2.5 text-sm font-medium bg-surface-container text-on-surface hover:bg-surface-container-high rounded-xl transition-colors duration-200"
        >
          Done
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/org/\[slug\]/admin/embeds/steps/StepGetCode.tsx
git commit -m "feat(embeds): add Step 3 - embed code display with copy button"
```

---

## Task 8: Frontend — EmbedBuilder orchestrator

**Files:**

- Create: `packages/frontend/app/org/[slug]/admin/embeds/EmbedBuilder.tsx`

- [ ] **Step 1: Create EmbedBuilder component**

This is the main wizard orchestrator. It manages step navigation, draft token lifecycle, and coordinates all three steps.

Create `packages/frontend/app/org/[slug]/admin/embeds/EmbedBuilder.tsx`:

```tsx
"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { StepIndicator } from "./StepIndicator";
import { StepChooseWidget } from "./steps/StepChooseWidget";
import { StepConfigure } from "./steps/StepConfigure";
import { StepGetCode } from "./steps/StepGetCode";
import {
  type WidgetType,
  WIDGET_TYPE_LABELS,
  RESPONSIVE_WIDGET_TYPES,
} from "./embed-builder-types";
import {
  getDimensions,
  type Shape,
  type Size,
} from "./configurator/ShapeSizeSelector";
import {
  createOrgEmbedToken,
  updateOrgEmbedToken,
  revokeOrgEmbedToken,
  type EmbedConfig,
} from "@/lib/data";

interface EmbedBuilderProps {
  orgSlug: string;
  onCreated: () => void;
}

function extractOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function generateName(widgetType: WidgetType, geoName?: string): string {
  const typeLabel = WIDGET_TYPE_LABELS[widgetType] || widgetType;
  return geoName ? `${typeLabel} - ${geoName}` : typeLabel;
}

export function EmbedBuilder({ orgSlug, onCreated }: EmbedBuilderProps) {
  // Wizard step
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [maxReached, setMaxReached] = useState<1 | 2 | 3>(1);

  // Step 1
  const [widgetType, setWidgetType] = useState<WidgetType | null>(null);

  // Step 2
  const [shape, setShape] = useState<Shape>("horizontal");
  const [size, setSize] = useState<Size>("medium");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  // Draft token
  const [draftTokenId, setDraftTokenId] = useState<string | null>(null);
  const [draftTokenValue, setDraftTokenValue] = useState<string | null>(null);
  const [draftCreating, setDraftCreating] = useState(false);
  const draftTokenIdRef = useRef<string | null>(null);

  // Step 3
  const [embedName, setEmbedName] = useState("");
  const [finalizing, setFinalizing] = useState(false);

  // Keep ref in sync for cleanup
  useEffect(() => {
    draftTokenIdRef.current = draftTokenId;
  }, [draftTokenId]);

  // Cleanup draft token on unmount
  useEffect(() => {
    return () => {
      if (draftTokenIdRef.current) {
        revokeOrgEmbedToken(orgSlug, draftTokenIdRef.current).catch(() => {});
      }
    };
  }, [orgSlug]);

  // Create draft token when entering Step 2
  const createDraftToken = useCallback(
    async (type: WidgetType) => {
      // Revoke existing draft if switching type
      if (draftTokenId) {
        revokeOrgEmbedToken(orgSlug, draftTokenId).catch(() => {});
        setDraftTokenId(null);
        setDraftTokenValue(null);
      }

      setDraftCreating(true);
      try {
        const result = await createOrgEmbedToken(orgSlug, {
          name: "Draft",
          allowed_origins: ["*"],
          widget_types: [type],
          is_draft: true,
        });
        setDraftTokenId(result.id);
        setDraftTokenValue(result.token);
      } catch (err) {
        console.error("[EmbedBuilder] Failed to create draft token:", err);
      } finally {
        setDraftCreating(false);
      }
    },
    [orgSlug, draftTokenId],
  );

  // Finalize draft token (Step 3)
  const finalizeDraftToken = useCallback(
    async (name: string) => {
      if (!draftTokenId || !embedUrl) return;

      const origin = websiteUrl ? extractOrigin(websiteUrl) : "*";
      const showShapeSize = widgetType
        ? !RESPONSIVE_WIDGET_TYPES.includes(widgetType)
        : true;
      const dims = getDimensions(shape, size);

      const config: EmbedConfig = {
        widgetType: widgetType!,
        embedPath: embedUrl,
        geographyName: name.includes(" - ")
          ? name.split(" - ").slice(1).join(" - ")
          : "",
        width: showShapeSize ? dims.w : 400,
        height: showShapeSize ? dims.h : 300,
      };

      setFinalizing(true);
      try {
        await updateOrgEmbedToken(orgSlug, draftTokenId, {
          name,
          allowed_origins: [origin],
          is_draft: false,
          embed_config: config,
        });
        // Clear the ref so cleanup doesn't revoke a finalized token
        draftTokenIdRef.current = null;
      } catch (err) {
        console.error("[EmbedBuilder] Failed to finalize token:", err);
      } finally {
        setFinalizing(false);
      }
    },
    [draftTokenId, embedUrl, websiteUrl, widgetType, shape, size, orgSlug],
  );

  // Navigation
  const goToStep = useCallback((target: 1 | 2 | 3) => {
    setStep(target);
    setMaxReached((prev) => Math.max(prev, target) as 1 | 2 | 3);
  }, []);

  const handleNext = useCallback(async () => {
    if (step === 1 && widgetType) {
      await createDraftToken(widgetType);
      goToStep(2);
    } else if (step === 2 && embedUrl && websiteUrl) {
      // Auto-generate name from embed URL (geography name is in the URL or from widget type)
      const autoName = generateName(widgetType!, embedName || undefined);
      setEmbedName(autoName);
      await finalizeDraftToken(autoName);
      goToStep(3);
      onCreated();
    }
  }, [
    step,
    widgetType,
    embedUrl,
    websiteUrl,
    embedName,
    createDraftToken,
    finalizeDraftToken,
    goToStep,
    onCreated,
  ]);

  const handleBack = useCallback(() => {
    if (step === 2) goToStep(1);
    else if (step === 3) goToStep(2);
  }, [step, goToStep]);

  const handleCreateAnother = useCallback(() => {
    // Reset all state
    setStep(1);
    setMaxReached(1);
    setWidgetType(null);
    setShape("horizontal");
    setSize("medium");
    setWebsiteUrl("");
    setEmbedUrl(null);
    setDraftTokenId(null);
    setDraftTokenValue(null);
    setEmbedName("");
  }, []);

  const handleDone = useCallback(() => {
    handleCreateAnother();
    // Scroll to existing embeds section
    document
      .getElementById("existing-embeds")
      ?.scrollIntoView({ behavior: "smooth" });
  }, [handleCreateAnother]);

  const handleNameChange = useCallback(
    async (newName: string) => {
      setEmbedName(newName);
      // Update the token name on the server
      if (draftTokenId) {
        updateOrgEmbedToken(orgSlug, draftTokenId, { name: newName }).catch(
          () => {},
        );
      }
    },
    [draftTokenId, orgSlug],
  );

  // Derive "Next" button enabled state
  const canGoNext =
    (step === 1 && widgetType !== null) ||
    (step === 2 &&
      embedUrl !== null &&
      websiteUrl &&
      /^https?:\/\/.+/.test(websiteUrl));

  // Derive dimensions
  const showShapeSize = widgetType
    ? !RESPONSIVE_WIDGET_TYPES.includes(widgetType)
    : true;
  const dims = getDimensions(shape, size);

  return (
    <div className="bg-surface-container-low rounded-2xl border border-outline-variant p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-on-surface">Embed Builder</h2>
        <p className="text-sm text-on-surface-variant">
          Add PropertyIQ data to your website in 3 steps
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator
        currentStep={step}
        onStepClick={goToStep}
        maxReachedStep={maxReached}
      />

      {/* Step Content */}
      <div className="min-h-[300px]">
        {step === 1 && (
          <StepChooseWidget
            selectedType={widgetType}
            onSelect={setWidgetType}
          />
        )}

        {step === 2 && widgetType && (
          <StepConfigure
            widgetType={widgetType}
            token={draftTokenValue || ""}
            shape={shape}
            size={size}
            onShapeChange={setShape}
            onSizeChange={setSize}
            websiteUrl={websiteUrl}
            onWebsiteUrlChange={setWebsiteUrl}
            onEmbedUrlChange={setEmbedUrl}
            embedUrl={embedUrl}
          />
        )}

        {step === 3 && embedUrl && draftTokenValue && (
          <StepGetCode
            embedUrl={embedUrl}
            token={draftTokenValue}
            width={showShapeSize ? dims.w : 400}
            height={showShapeSize ? dims.h : 300}
            name={embedName}
            onNameChange={handleNameChange}
            onCreateAnother={handleCreateAnother}
            onDone={handleDone}
          />
        )}
      </div>

      {/* Navigation (not shown on Step 3 — it has its own actions) */}
      {step !== 3 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-colors duration-200 ${
              step === 1
                ? "text-on-surface-variant/40 cursor-default"
                : "text-on-surface hover:bg-surface-container"
            }`}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext || draftCreating || finalizing}
            className={`px-6 py-2.5 text-sm font-medium rounded-xl transition-colors duration-200 ${
              canGoNext && !draftCreating && !finalizing
                ? "bg-primary text-on-primary hover:bg-primary/90"
                : "bg-primary/30 text-on-primary/50 cursor-not-allowed"
            }`}
          >
            {draftCreating || finalizing ? "Loading..." : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/org/\[slug\]/admin/embeds/EmbedBuilder.tsx
git commit -m "feat(embeds): add EmbedBuilder wizard orchestrator with draft token lifecycle"
```

---

## Task 9: Frontend — ExistingEmbeds component

**Files:**

- Create: `packages/frontend/app/org/[slug]/admin/embeds/ExistingEmbeds.tsx`

- [ ] **Step 1: Create ExistingEmbeds component**

Create `packages/frontend/app/org/[slug]/admin/embeds/ExistingEmbeds.tsx`:

```tsx
"use client";

import React, { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Trash2,
  Target,
  BarChart3,
  Map,
  Globe,
  TrendingUp,
  FileText,
} from "lucide-react";
import type { EmbedTokenListItem, EmbedConfig } from "@/lib/data";
import { WIDGET_TYPE_LABELS } from "./embed-builder-types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  score: Target,
  metric_card: BarChart3,
  map: Map,
  map_full: Globe,
  chart: TrendingUp,
  report: FileText,
};

const PRODUCTION_HOST = "https://www.propertyiq.app";

function formatRelativeDate(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function buildSnippetFromConfig(config: EmbedConfig, token: string): string {
  const separator = config.embedPath.includes("?") ? "&" : "?";
  const src = `${PRODUCTION_HOST}${config.embedPath}${separator}token=${token}`;
  return `<iframe\n  src="${src}"\n  width="${config.width}"\n  height="${config.height}"\n  frameborder="0"\n  style="border-radius: 8px;"\n></iframe>`;
}

interface ExistingEmbedsProps {
  embeds: EmbedTokenListItem[];
  orgSlug: string;
  onRevoke: (id: string) => void;
}

export function ExistingEmbeds({
  embeds,
  orgSlug,
  onRevoke,
}: ExistingEmbedsProps) {
  const activeEmbeds = embeds.filter((e) => e.is_active);
  const [expanded, setExpanded] = useState(activeEmbeds.length > 0);

  return (
    <div id="existing-embeds" className="mt-8">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-on-surface hover:text-primary transition-colors"
      >
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        <h3 className="text-base font-medium">
          Your Existing Embeds ({activeEmbeds.length})
        </h3>
      </button>

      {expanded && (
        <div className="mt-4">
          {embeds.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-4">
              No embeds yet. Use the builder above to create your first one!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {embeds.map((embed) => (
                <EmbedCard key={embed.id} embed={embed} onRevoke={onRevoke} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmbedCard({
  embed,
  onRevoke,
}: {
  embed: EmbedTokenListItem;
  onRevoke: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const config = embed.embed_config as EmbedConfig | null | undefined;
  const widgetType = config?.widgetType || embed.widget_types[0] || "score";
  const Icon = ICON_MAP[widgetType] || Target;
  const origin = embed.allowed_origins[0] || "";
  const originDomain = (() => {
    try {
      return new URL(origin).hostname;
    } catch {
      return origin;
    }
  })();

  const handleCopy = useCallback(async () => {
    if (!config) return;
    // We don't have the raw token value in list items.
    // The token field is masked in list responses. We need the embed_config.embedPath
    // to reconstruct the snippet. But we don't have the actual token value.
    // For the copy button to work, we need to store the snippet or the token isn't masked.
    // For now, show a message that they need to create a new embed if the token was lost.
    // ACTUALLY: The snippet uses the token value which is NOT available in list items.
    // The existing implementation used hardcoded example URLs, not real ones.
    // With embed_config, we can reconstruct everything EXCEPT the token secret.
    // SOLUTION: We need to store the snippet in embed_config too.
    // Let's add `snippet` to EmbedConfig.

    // For now, copy a reconstructed snippet using a placeholder:
    // NOTE: This will be addressed — see implementation note below.
    try {
      await navigator.clipboard.writeText(
        `<!-- Embed: ${embed.name} -->\n<!-- To get fresh embed code, create a new embed in the Embed Builder above -->`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [config, embed.name]);

  const handleRevoke = useCallback(() => {
    onRevoke(embed.id);
    setConfirmRevoke(false);
  }, [embed.id, onRevoke]);

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        embed.is_active
          ? "border-outline-variant bg-surface"
          : "border-outline-variant/50 bg-surface/50 opacity-60"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-on-surface truncate">
            {embed.name}
          </div>
          <div className="text-xs text-on-surface-variant">
            {formatRelativeDate(embed.created_at)}
          </div>
        </div>
      </div>

      {/* Details */}
      {originDomain && (
        <div className="text-xs text-on-surface-variant truncate">
          {originDomain}
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${
            embed.is_active ? "bg-green-500" : "bg-on-surface-variant/40"
          }`}
        />
        <span className="text-xs text-on-surface-variant">
          {embed.is_active ? "Active" : "Revoked"}
        </span>
      </div>

      {/* Actions */}
      {embed.is_active && (
        <div className="flex items-center gap-2 pt-1">
          {config && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Code
                </>
              )}
            </button>
          )}
          <div className="flex-1" />
          {confirmRevoke ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setConfirmRevoke(false)}
                className="text-xs text-on-surface-variant hover:text-on-surface px-2 py-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                className="text-xs text-red-500 hover:text-red-400 font-medium px-2 py-1"
              >
                Confirm
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRevoke(true)}
              className="text-on-surface-variant/60 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Implementation note on "Copy Code" for existing embeds:** The list API response doesn't include the raw token value (it's masked for security). To support "Copy Code" on existing embeds, we need to also store the complete `snippet` string in `embed_config`. This is addressed in the next step.

- [ ] **Step 2: Add `snippet` field to EmbedConfig**

In `packages/frontend/lib/data/fetchers/org-embeds.ts`, update the interface:

```typescript
export interface EmbedConfig {
  widgetType: string;
  embedPath: string;
  geographyName: string;
  width: number;
  height: number;
  snippet: string; // Complete iframe HTML for copy button
}
```

Then in `packages/frontend/app/org/[slug]/admin/embeds/EmbedBuilder.tsx`, update the `finalizeDraftToken` function to include the snippet:

```typescript
const separator = embedUrl.includes("?") ? "&" : "?";
const productionSrc = `https://www.propertyiq.app${embedUrl}${separator}token=${draftTokenValue}`;
const snippet = `<iframe\n  src="${productionSrc}"\n  width="${showShapeSize ? dims.w : 400}"\n  height="${showShapeSize ? dims.h : 300}"\n  frameborder="0"\n  style="border-radius: 8px;"\n></iframe>`;

const config: EmbedConfig = {
  widgetType: widgetType!,
  embedPath: embedUrl,
  geographyName: name.includes(" - ")
    ? name.split(" - ").slice(1).join(" - ")
    : "",
  width: showShapeSize ? dims.w : 400,
  height: showShapeSize ? dims.h : 300,
  snippet,
};
```

Then update the `handleCopy` in `ExistingEmbeds.tsx` `EmbedCard` to use `config.snippet`:

```typescript
const handleCopy = useCallback(async () => {
  if (!config?.snippet) return;
  try {
    await navigator.clipboard.writeText(config.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // ignore
  }
}, [config]);
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/org/\[slug\]/admin/embeds/ExistingEmbeds.tsx packages/frontend/lib/data/fetchers/org-embeds.ts packages/frontend/app/org/\[slug\]/admin/embeds/EmbedBuilder.tsx
git commit -m "feat(embeds): add ExistingEmbeds component with copy-code and revoke"
```

---

## Task 10: Frontend — Rewire page.tsx

**Files:**

- Modify: `packages/frontend/app/org/[slug]/admin/embeds/page.tsx`

- [ ] **Step 1: Rewrite page.tsx to use EmbedBuilder + ExistingEmbeds**

Replace the contents of `packages/frontend/app/org/[slug]/admin/embeds/page.tsx` with:

```tsx
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { AlertCircle, Code } from "lucide-react";
import { useOrg } from "../../../hooks/useOrg";
import {
  fetchOrgEmbedTokens,
  revokeOrgEmbedToken,
  type EmbedTokenListItem,
} from "@/lib/data";
import { EmbedBuilder } from "./EmbedBuilder";
import { ExistingEmbeds } from "./ExistingEmbeds";

export default function OrgAdminEmbeds() {
  const { org, loading: orgLoading } = useOrg();
  const [embeds, setEmbeds] = useState<EmbedTokenListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEmbeds = useCallback(async () => {
    if (!org?.slug) return;
    setLoading(true);
    setError(null);
    try {
      const tokens = await fetchOrgEmbedTokens(org.slug);
      setEmbeds(tokens);
    } catch (err) {
      setError("Failed to load embeds");
      console.error("[OrgAdminEmbeds] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [org?.slug]);

  useEffect(() => {
    loadEmbeds();
  }, [loadEmbeds]);

  const handleRevoke = useCallback(
    async (tokenId: string) => {
      if (!org?.slug) return;
      try {
        await revokeOrgEmbedToken(org.slug, tokenId);
        setEmbeds((prev) =>
          prev.map((e) => (e.id === tokenId ? { ...e, is_active: false } : e)),
        );
      } catch (err) {
        console.error("[OrgAdminEmbeds] Revoke error:", err);
      }
    },
    [org?.slug],
  );

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!org) return null;

  // Check if embed feature is enabled
  if (!org.embed_enabled) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <Code className="w-12 h-12 text-on-surface-variant/40 mx-auto" />
        <h2 className="text-lg font-medium text-on-surface">
          Embeddable Widgets
        </h2>
        <p className="text-sm text-on-surface-variant">
          Embed PropertyIQ data on your website. Contact your admin to enable
          this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <EmbedBuilder orgSlug={org.slug} onCreated={loadEmbeds} />

      {!loading && (
        <ExistingEmbeds
          embeds={embeds}
          orgSlug={org.slug}
          onRevoke={handleRevoke}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the page compiles**

Run: `cd D:/projects/rei-platform/packages/frontend && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/org/\[slug\]/admin/embeds/page.tsx
git commit -m "feat(embeds): rewire admin page to use unified Embed Builder wizard"
```

---

## Task 11: Manual Testing & Cleanup

**Files:**

- Delete: `packages/frontend/app/org/components/CreateEmbedDialog.tsx`
- Delete: `packages/frontend/app/org/components/EmbedTokenCard.tsx`
- Delete: `packages/frontend/app/org/components/EmbedCodeSnippet.tsx`
- Delete: `packages/frontend/app/org/[slug]/admin/embeds/WidgetConfigurator.tsx`

- [ ] **Step 1: Start dev servers and test the full wizard flow**

Run: `cd D:/projects/rei-platform && npm run dev` (or use the local-dev-servers skill)

Test flow:

1. Navigate to `/org/{slug}/admin/embeds`
2. Step 1: Click "Score Ring" card → "Next" button enables → click "Next"
3. Step 2: Select score type, search for "Dallas" in geography search, select a result → preview appears on right
4. Enter website URL: `https://example.com` → "Next" enables
5. Step 3: Code block appears with complete iframe snippet → click "Copy Code" → clipboard icon changes to checkmark
6. Click "Done" → scrolls to existing embeds section, new embed appears

- [ ] **Step 2: Test edge cases**

- Click browser back during wizard → wizard resets (no crash)
- Enter invalid URL → validation error shown, "Next" stays disabled
- Enter URL with path (`https://example.com/page`) → origin extracted and shown below input
- Click step dots to navigate back → works for completed steps
- Click "Create Another" → wizard resets to Step 1

- [ ] **Step 3: Verify no imports of deleted components remain**

Run: `cd D:/projects/rei-platform && grep -r "CreateEmbedDialog\|TokenRevealDialog\|EmbedTokenCard\|EmbedCodeSnippet\|WidgetConfigurator" packages/frontend/app/ --include="*.tsx" --include="*.ts" -l`

Expected: Only the old files themselves should match (if they still exist). No other files should import them.

- [ ] **Step 4: Delete replaced components**

```bash
rm packages/frontend/app/org/components/CreateEmbedDialog.tsx
rm packages/frontend/app/org/components/EmbedTokenCard.tsx
rm packages/frontend/app/org/components/EmbedCodeSnippet.tsx
rm packages/frontend/app/org/\[slug\]/admin/embeds/WidgetConfigurator.tsx
```

- [ ] **Step 5: Verify build succeeds after deletion**

Run: `cd D:/projects/rei-platform/packages/frontend && npx tsc --noEmit`
Expected: No type errors. If any file still imports deleted components, fix the imports.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore(embeds): remove replaced components (CreateEmbedDialog, EmbedTokenCard, EmbedCodeSnippet, WidgetConfigurator)"
```

---

## Task 12: Geography Name Extraction for Auto-Naming

The auto-generated embed name needs the geography name (e.g., "Score - Dallas-Fort Worth"). The existing configurators call `onUrlChange(url)` with just the URL path — they don't pass back the geography name. We need a lightweight way to capture it.

**Files:**

- Modify: `packages/frontend/app/org/[slug]/admin/embeds/steps/StepConfigure.tsx`
- Modify: `packages/frontend/app/org/[slug]/admin/embeds/EmbedBuilder.tsx`

- [ ] **Step 1: Add `onGeographyNameChange` callback to StepConfigure**

In `StepConfigure.tsx`, add a new prop and wrap `ActiveConfigurator` to extract the geography name from the URL or the configurator's internal state.

Since the existing configurators only emit URL strings (not structured data), the simplest approach is to pass an additional callback. Add to `StepConfigureProps`:

```typescript
interface StepConfigureProps {
  // ... existing props
  onGeographyNameChange: (name: string) => void;
}
```

The geography name can be captured by wrapping the `GeographySearch` onSelect in a way that bubbles up. However, since we're reusing existing configurators as-is, the pragmatic approach is: extract it from the embed URL pattern in the EmbedBuilder. For score: `/embed/score/metro/31080` — we'd need to look up "31080" → "Dallas-Fort Worth". That's complex.

**Simpler approach:** Store the geography name from the GeographySearch component when the user selects one. The existing configurators use GeographySearch internally, but don't expose the name. Rather than modifying all configurators, add a `ref`-based approach or simply let the user edit the name in Step 3 (which already works).

For the auto-name, use: `{Widget Type Label}` as the default. If the user wants a better name, they can edit it in Step 3.

Update `generateName` in `EmbedBuilder.tsx`:

```typescript
function generateName(widgetType: WidgetType): string {
  return WIDGET_TYPE_LABELS[widgetType] || widgetType;
}
```

This is already what the current code does when no geography name is provided. The edit button in Step 3 lets users refine it.

- [ ] **Step 2: Commit (if any changes needed)**

```bash
git add packages/frontend/app/org/\[slug\]/admin/embeds/
git commit -m "feat(embeds): finalize auto-naming with edit capability"
```
