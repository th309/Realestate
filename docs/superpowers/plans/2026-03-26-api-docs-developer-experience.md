# API Documentation & Developer Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the API docs page into a tabbed layout (Getting Started, Use Cases, API Reference, Troubleshooting), add contextual help to the admin UI, and create a health check endpoint — all to help non-technical enterprise users understand and use the PropertyIQ API.

**Architecture:** Backend health endpoint (NestJS controller with ApiKeyAuthGuard, no throttle). Frontend docs page converts from server-rendered single scroll to a client-side tabbed layout with hash routing. Admin UI gets inline guidance and "What's Next" flows. All frontend components follow M3 Material Design patterns with Tailwind semantic color variables.

**Tech Stack:** NestJS (backend), Next.js App Router (frontend), Tailwind CSS with M3 semantic tokens, Lucide React icons

**Spec:** `docs/superpowers/specs/2026-03-26-api-docs-and-developer-experience-design.md`

---

## File Structure

### Backend (new)

| File                                                        | Responsibility                                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/backend/src/platform-api/v1/health.controller.ts` | Health check endpoint — validates API key, returns org info + scopes + rate limit |

### Backend (modify)

| File                                                       | Change                                             |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `packages/backend/src/platform-api/platform-api.module.ts` | Register `HealthV1Controller` in controllers array |

### Frontend (new)

| File                                                               | Responsibility                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `packages/frontend/app/docs/api/components/DocsPageClient.tsx`     | Client component: tab state, hash routing, renders tab panels               |
| `packages/frontend/app/docs/api/components/CodeTabs.tsx`           | Multi-language code selector (curl/JS/Python) with localStorage persistence |
| `packages/frontend/app/docs/api/components/GettingStartedTab.tsx`  | Getting Started content — 3-step walkthrough                                |
| `packages/frontend/app/docs/api/components/UseCasesTab.tsx`        | Use Cases tab — renders 10 UseCaseCard components                           |
| `packages/frontend/app/docs/api/components/UseCaseCard.tsx`        | Collapsible card for a single use case                                      |
| `packages/frontend/app/docs/api/components/TroubleshootingTab.tsx` | Error tables, rate limit guide, FAQ                                         |

### Frontend (modify)

| File                                                               | Change                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `packages/frontend/app/docs/api/page.tsx`                          | Simplify to server shell importing DocsPageClient               |
| `packages/frontend/app/docs/api/components/api-docs-data.ts`       | Add tab definitions, use case metadata, scope-to-anchor mapping |
| `packages/frontend/app/docs/api/components/EndpointsReference.tsx` | Add health endpoint, add anchor IDs for scope deep linking      |
| `packages/frontend/app/org/[slug]/admin/api-keys/page.tsx`         | Better empty/disabled state copy                                |
| `packages/frontend/app/org/components/CreateApiKeyDialog.tsx`      | Scope helpers, rate limit helper, What's Next card              |
| `packages/frontend/app/org/components/ApiKeyCard.tsx`              | "Never used" quickstart link, clickable scope badges            |

---

## Task 1: Backend Health Check Endpoint

**Files:**

- Create: `packages/backend/src/platform-api/v1/health.controller.ts`
- Modify: `packages/backend/src/platform-api/platform-api.module.ts`

- [ ] **Step 1: Create the health controller**

Create `packages/backend/src/platform-api/v1/health.controller.ts`:

```typescript
/**
 * Platform API v1 - Health Controller
 *
 * Simple auth verification endpoint. Returns org name, scopes, and rate limit
 * for the authenticated API key. No scope requirement. Not rate-limited.
 *
 * Endpoint:
 *   GET /api/v1/health
 */

import {
  Controller,
  Get,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiKeyAuthGuard } from "../../org-api-keys/api-key-auth.guard";
import { ApiResponseInterceptor } from "../api-response.interceptor";

@Controller("api/v1/health")
@UseGuards(ApiKeyAuthGuard)
@UseInterceptors(ApiResponseInterceptor)
export class HealthV1Controller {
  @Get()
  async check(@Req() req: any) {
    const { orgId, scopes, rateLimitRpm, keyId } = req.apiKeyOrg;

    // Look up org name from the key context
    // Note: apiKeyOrg doesn't include org name — return orgId for now,
    // or query organizations table if org name is needed.
    return {
      status: "ok",
      organization_id: orgId,
      scopes,
      rate_limit_rpm: rateLimitRpm,
      key_id: keyId,
      expires_at: req.apiKeyOrg.expiresAt ?? null,
    };
  }
}
```

Note: The `ApiKeyAuthGuard` is applied but `ApiThrottleGuard` is NOT — this endpoint is free for debugging. The `ApiResponseInterceptor` wraps the response in the standard `{ data, meta }` envelope.

Check whether `ValidatedApiKey` includes org name. If not, inject `SupabaseClient` and query:

```typescript
const { data } = await this.supabase
  .from('organizations')
  .select('name')
  .eq('id', orgId)
  .single();
return { status: 'ok', organization: data?.name ?? orgId, ... };
```

- [ ] **Step 2: Register in module**

In `packages/backend/src/platform-api/platform-api.module.ts`, add the import and register:

```typescript
import { HealthV1Controller } from './v1/health.controller';

// Add to controllers array:
controllers: [
  HealthV1Controller,  // Add at top — health check first
  ScoresV1Controller,
  // ... rest unchanged
],
```

- [ ] **Step 3: Verify build**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: Clean (no errors)

- [ ] **Step 4: Test locally**

Run: `cd packages/backend && npm run start:dev`
Then: `curl -H "Authorization: Bearer piq_live_YOUR_TEST_KEY" http://localhost:3001/api/v1/health`
Expected: `{ "data": { "status": "ok", ... }, "meta": { ... } }`

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/platform-api/v1/health.controller.ts packages/backend/src/platform-api/platform-api.module.ts
git commit -m "feat: add GET /api/v1/health endpoint — API key verification without rate limit"
```

---

## Task 2: Frontend Data Layer — Tab Definitions and Use Case Metadata

**Files:**

- Modify: `packages/frontend/app/docs/api/components/api-docs-data.ts`

- [ ] **Step 1: Add tab definitions, use case data, and scope-to-anchor mapping**

Extend `api-docs-data.ts` with:

```typescript
// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

export const TABS = [
  { id: "getting-started", label: "Getting Started" },
  { id: "use-cases", label: "Use Cases" },
  { id: "reference", label: "API Reference" },
  { id: "troubleshooting", label: "Troubleshooting" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export const DEFAULT_TAB: TabId = "getting-started";

// ---------------------------------------------------------------------------
// Use case metadata
// ---------------------------------------------------------------------------

export interface UseCaseData {
  id: string;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  setupTime: string;
  icon: string; // Lucide icon name
}

export const USE_CASES: UseCaseData[] = [
  {
    id: "auto-generate-reports",
    title: "Auto-Generate Reports",
    description: "Create client-ready market reports on demand",
    difficulty: "Beginner",
    setupTime: "5 min",
    icon: "FileText",
  },
  {
    id: "embed-score",
    title: "Embed a Score on Your Website",
    description:
      "Show a live PropertyIQ score on Wix, Squarespace, or WordPress",
    difficulty: "Beginner",
    setupTime: "10 min",
    icon: "Code",
  },
  {
    id: "google-sheets",
    title: "Pull Data into Google Sheets",
    description:
      "Get market metrics into a spreadsheet that updates automatically",
    difficulty: "Beginner",
    setupTime: "10 min",
    icon: "Table",
  },
  {
    id: "client-alerts",
    title: "Automated Client Alerts",
    description: "Email clients when their market score changes significantly",
    difficulty: "Intermediate",
    setupTime: "15 min",
    icon: "Bell",
  },
  {
    id: "market-comparison",
    title: "Market Comparison for Listing Presentations",
    description: "Pull side-by-side data for two markets to win a listing",
    difficulty: "Intermediate",
    setupTime: "10 min",
    icon: "BarChart3",
  },
  {
    id: "monthly-newsletter",
    title: "Monthly Market Newsletter",
    description: "Auto-generate a monthly market update email for your sphere",
    difficulty: "Intermediate",
    setupTime: "20 min",
    icon: "Mail",
  },
  {
    id: "market-pages",
    title: "Website Market Pages",
    description: "Create dynamic market pages that update automatically",
    difficulty: "Advanced",
    setupTime: "30 min",
    icon: "Globe",
  },
  {
    id: "investor-pipeline",
    title: "Investor Pipeline Scoring",
    description: "Score and rank every market in your investment pipeline",
    difficulty: "Intermediate",
    setupTime: "15 min",
    icon: "TrendingUp",
  },
  {
    id: "slack-alerts",
    title: "Slack/Teams Market Alerts",
    description: "Get a daily market summary posted to your team channel",
    difficulty: "Intermediate",
    setupTime: "15 min",
    icon: "MessageSquare",
  },
  {
    id: "crm-dashboard",
    title: "Connect to Your CRM or Dashboard",
    description: "Feed PropertyIQ data into your internal tools",
    difficulty: "Advanced",
    setupTime: "30 min",
    icon: "Plug",
  },
];

// ---------------------------------------------------------------------------
// Scope to endpoint anchor mapping (for clickable scope badges)
// ---------------------------------------------------------------------------

export const SCOPE_ANCHORS: Record<string, string> = {
  "scores:read": "endpoint-scores",
  "metrics:read": "endpoint-metrics",
  "rankings:read": "endpoint-rankings",
  "reports:read": "endpoint-reports",
  "reports:write": "endpoint-reports",
  "watchlist:read": "endpoint-watchlist",
  "watchlist:write": "endpoint-watchlist",
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/docs/api/components/api-docs-data.ts
git commit -m "feat: add tab definitions, use case metadata, and scope anchor mapping for API docs"
```

---

## Task 3: CodeTabs Component

**Files:**

- Create: `packages/frontend/app/docs/api/components/CodeTabs.tsx`

- [ ] **Step 1: Create the multi-language code tab component**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { CodeBlock } from './CodeBlock';

const STORAGE_KEY = 'piq-docs-code-lang';

interface CodeExample {
  language: string;
  label: string;
  code: string;
}

interface CodeTabsProps {
  examples: CodeExample[];
}

export function CodeTabs({ examples }: CodeTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Restore last-selected language from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const idx = examples.findIndex((e) => e.language === saved);
      if (idx >= 0) setActiveIndex(idx);
    }
  }, [examples]);

  function handleSelect(index: number) {
    setActiveIndex(index);
    localStorage.setItem(STORAGE_KEY, examples[index].language);
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-outline-variant mb-0">
        {examples.map((ex, i) => (
          <button
            key={ex.language}
            onClick={() => handleSelect(i)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
              i === activeIndex
                ? 'bg-surface-container text-on-surface border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            {ex.label}
          </button>
        ))}
      </div>
      <CodeBlock code={examples[activeIndex].code} language={examples[activeIndex].language} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/docs/api/components/CodeTabs.tsx
git commit -m "feat: add CodeTabs component — multi-language code examples with localStorage persistence"
```

---

## Task 4: DocsPageClient — Tab Infrastructure

**Files:**

- Create: `packages/frontend/app/docs/api/components/DocsPageClient.tsx`
- Modify: `packages/frontend/app/docs/api/page.tsx`

- [ ] **Step 1: Create DocsPageClient with tab state and hash routing**

Create `packages/frontend/app/docs/api/components/DocsPageClient.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { TABS, DEFAULT_TAB, type TabId } from './api-docs-data';
import { GettingStartedTab } from './GettingStartedTab';
import { UseCasesTab } from './UseCasesTab';
import { TroubleshootingTab } from './TroubleshootingTab';
import { EndpointsReference } from './EndpointsReference';
import { SCOPES, ERROR_CODES } from './api-docs-data';

/** Read tab ID from URL hash, defaulting to getting-started */
function getTabFromHash(): TabId {
  if (typeof window === 'undefined') return DEFAULT_TAB;
  const hash = window.location.hash.replace('#', '');
  const tab = TABS.find((t) => t.id === hash);
  return tab ? tab.id : DEFAULT_TAB;
}

export function DocsPageClient() {
  const [activeTab, setActiveTab] = useState<TabId>(DEFAULT_TAB);

  // Sync tab from hash on mount and popstate (back/forward)
  useEffect(() => {
    setActiveTab(getTabFromHash());
    const onHashChange = () => setActiveTab(getTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    window.history.pushState(null, '', `#${tabId}`);
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="border-b border-outline-variant bg-surface-container-low">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-0">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-3xl font-medium text-on-surface">
              PropertyIQ API
            </h1>
            <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
              v1
            </span>
          </div>

          {/* Tab bar — horizontal scroll on mobile */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'getting-started' && <GettingStartedTab />}
        {activeTab === 'use-cases' && <UseCasesTab />}
        {activeTab === 'reference' && (
          <div className="space-y-8">
            {/* Scopes table */}
            <section>
              <h2 className="text-xl font-medium text-on-surface mb-4">Authentication & Scopes</h2>
              <p className="text-sm text-on-surface-variant mb-4">
                Include your API key in the Authorization header: <code className="text-xs bg-surface-container px-1.5 py-0.5 rounded">Authorization: Bearer piq_live_...</code>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="text-left py-2 pr-4 font-medium text-on-surface">Scope</th>
                      <th className="text-left py-2 font-medium text-on-surface">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCOPES.map((s) => (
                      <tr key={s.scope} className="border-b border-outline-variant/50">
                        <td className="py-2 pr-4 font-mono text-xs text-primary">{s.scope}</td>
                        <td className="py-2 text-on-surface-variant">{s.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Endpoints */}
            <EndpointsReference />

            {/* Error codes */}
            <section>
              <h2 className="text-xl font-medium text-on-surface mb-4">Error Codes</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="text-left py-2 pr-4 font-medium text-on-surface">Code</th>
                      <th className="text-left py-2 pr-4 font-medium text-on-surface">HTTP</th>
                      <th className="text-left py-2 font-medium text-on-surface">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ERROR_CODES.map((e) => (
                      <tr key={e.code} className="border-b border-outline-variant/50">
                        <td className="py-2 pr-4 font-mono text-xs">{e.code}</td>
                        <td className="py-2 pr-4">{e.status}</td>
                        <td className="py-2 text-on-surface-variant">{e.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
        {activeTab === 'troubleshooting' && <TroubleshootingTab />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Simplify page.tsx to a server shell**

Replace the contents of `packages/frontend/app/docs/api/page.tsx` with:

```typescript
import type { Metadata } from 'next';
import { DocsPageClient } from './components/DocsPageClient';

export const metadata: Metadata = {
  title: 'API Documentation | PropertyIQ',
  description: 'PropertyIQ Platform API documentation — getting started, use cases, endpoint reference, and troubleshooting.',
};

export default function ApiDocsPage() {
  return <DocsPageClient />;
}
```

- [ ] **Step 3: Verify build**

Run: `cd packages/frontend && npx tsc --noEmit 2>&1 | grep -v "TS2304.*onDeleteOrg\|TS2339.*actor_email"`
Expected: Will fail on missing tab components (GettingStartedTab, etc.) — that's expected. Verify only that DocsPageClient and page.tsx have no errors by checking the error list doesn't include those files.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/docs/api/page.tsx packages/frontend/app/docs/api/components/DocsPageClient.tsx
git commit -m "feat: add tabbed docs page infrastructure with hash routing"
```

---

## Task 5: Getting Started Tab

**Files:**

- Create: `packages/frontend/app/docs/api/components/GettingStartedTab.tsx`

- [ ] **Step 1: Create the Getting Started tab**

Write `GettingStartedTab.tsx` with three steps as described in the spec. Use plain English, inline jargon definitions, and `CodeTabs` for multi-language examples. Include:

1. **Create Your API Key** — walkthrough with warning callout and link to admin page
2. **Verify Your Key Works** — curl/JS/Python examples hitting `GET /api/v1/health`, show expected response
3. **Make Your First Real Call** — curl/JS/Python examples hitting `POST /api/v1/reports`, "Now what?" card linking to Use Cases tab

Key implementation details:

- Use `CodeTabs` for all code examples (curl + JS + Python)
- Warning callout: `bg-amber-50 dark:bg-amber-950/20` with `AlertTriangle` icon
- "Now what?" card: `bg-surface-container-low rounded-xl p-4` with links to other tabs
- Links to other tabs use `window.location.hash = '#use-cases'` (or anchor tags with hash)
- Tone: "An API key is like a password that lets your other tools pull data from PropertyIQ automatically."
- Define jargon inline: endpoint _(the URL you send your request to)_, header _(the line that tells our server who you are)_

- [ ] **Step 2: Verify it renders**

Run dev server, navigate to `/docs/api` — Getting Started tab should display by default.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/docs/api/components/GettingStartedTab.tsx
git commit -m "feat: add Getting Started tab — 3-step walkthrough from key creation to first API call"
```

---

## Task 6: UseCaseCard Component + Use Cases Tab (First 5)

**Files:**

- Create: `packages/frontend/app/docs/api/components/UseCaseCard.tsx`
- Create: `packages/frontend/app/docs/api/components/UseCasesTab.tsx`

- [ ] **Step 1: Create the UseCaseCard component**

Collapsible card with:

- Always visible: icon + title + one-line description + difficulty badge + setup time
- Expanded: full walkthrough content (passed as `children`)
- Chevron icon rotates on expand
- Difficulty badge colors: Beginner=green, Intermediate=amber, Advanced=red

```typescript
'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface UseCaseCardProps {
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  setupTime: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const DIFFICULTY_COLORS = {
  Beginner: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Intermediate: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Advanced: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export function UseCaseCard({ title, description, difficulty, setupTime, icon, children }: UseCaseCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-container transition-colors"
      >
        <span className="text-on-surface-variant shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-medium text-on-surface">{title}</h3>
            <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[difficulty]}`}>
              {difficulty}
            </span>
            <span className="text-xs text-on-surface-variant">~{setupTime}</span>
          </div>
          <p className="text-sm text-on-surface-variant mt-0.5">{description}</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-on-surface-variant shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-outline-variant/50">
          <div className="pt-4 space-y-4 text-sm text-on-surface-variant">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create UseCasesTab with first 5 use cases**

Create `UseCasesTab.tsx` that imports `UseCaseCard` and `CodeTabs`. Write the full content for:

1. Auto-Generate Reports (Beginner, 5 min)
2. Embed a Score on Your Website (Beginner, 10 min)
3. Pull Data into Google Sheets (Beginner, 10 min)
4. Automated Client Alerts (Intermediate, 15 min)
5. Market Comparison for Listing Presentations (Intermediate, 10 min)

Each use case card contains:

- Goal paragraph
- Step-by-step instructions in plain English
- `CodeTabs` with curl + JavaScript + Python examples
- Tips/bonus section where specified in the spec

For Use Case 2 (embed), include BOTH the embed widget approach (no API key) and the API proxy approach, with security note about not exposing keys client-side.

For Use Case 3 (Google Sheets), include the complete Apps Script snippet (~15 lines).

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/docs/api/components/UseCaseCard.tsx packages/frontend/app/docs/api/components/UseCasesTab.tsx
git commit -m "feat: add Use Cases tab with first 5 walkthroughs — reports, embed, sheets, alerts, comparison"
```

---

## Task 7: Use Cases Tab — Remaining 5 Use Cases

**Files:**

- Modify: `packages/frontend/app/docs/api/components/UseCasesTab.tsx`

- [ ] **Step 1: Add use cases 6-10**

Add to `UseCasesTab.tsx`: 6. Monthly Market Newsletter (Intermediate, 20 min) — Mailchimp/Resend integration 7. Website Market Pages (Advanced, 30 min) — dynamic pages with API data 8. Investor Pipeline Scoring (Intermediate, 15 min) — rankings + spreadsheet output 9. Slack/Teams Market Alerts (Intermediate, 15 min) — webhook integration 10. Connect to Your CRM or Dashboard (Advanced, 30 min) — pagination, retry logic, error handling, caching

Use Case 10 should be the most technical — include retry with exponential backoff code in JS and Python, pagination example, and caching guidance.

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/docs/api/components/UseCasesTab.tsx
git commit -m "feat: add remaining 5 use cases — newsletter, market pages, investor pipeline, Slack, CRM"
```

---

## Task 8: Troubleshooting Tab

**Files:**

- Create: `packages/frontend/app/docs/api/components/TroubleshootingTab.tsx`

- [ ] **Step 1: Create the Troubleshooting tab**

Write `TroubleshootingTab.tsx` with four sections per spec:

1. **"My key isn't working"** — Table with UNAUTHORIZED, API_KEY_EXPIRED, API_KEY_REVOKED
2. **"I'm getting an error on a specific endpoint"** — Table with INSUFFICIENT_SCOPE, RESOURCE_NOT_FOUND, VALIDATION_ERROR
3. **"I'm being rate limited"** — Plain English explanation, header guide, backoff code (CodeTabs), health endpoint tip
4. **"Everything looks right but I'm still stuck"** — Checklist, support contact
5. **FAQ** — 5 questions as collapsible items (reuse expand/collapse pattern or simple details/summary)

Use `CodeTabs` for the retry/backoff code examples. Use tables with `text-left` alignment for error guides.

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/docs/api/components/TroubleshootingTab.tsx
git commit -m "feat: add Troubleshooting tab — error guides, rate limit help, FAQ"
```

---

## Task 9: API Reference Tab Updates

**Files:**

- Modify: `packages/frontend/app/docs/api/components/EndpointsReference.tsx`

- [ ] **Step 1: Add health endpoint to EndpointsReference**

Add a new `EndpointSection` block at the TOP of the endpoints list:

```typescript
<EndpointSection
  method="GET"
  path="/api/v1/health"
  description="Verify your API key works. Returns your organization name, scopes, rate limit, and key expiration. Does not count against your rate limit."
  scope="(any valid key)"
  curlExample={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://backend-production-ee4d.up.railway.app/api/v1/health`}
  responseExample={`{
  "data": {
    "status": "ok",
    "organization": "Acme Realty Group",
    "scopes": ["scores:read", "metrics:read"],
    "rate_limit_rpm": 120,
    "expires_at": null
  },
  "meta": {
    "request_id": "req_7f3a2b1c",
    "timestamp": "2026-03-26T12:00:00Z"
  }
}`}
/>
```

- [ ] **Step 2: Add anchor IDs to each EndpointSection**

Add `id` props to the wrapper div of each endpoint section for deep linking from scope badges:

- Health: `id="endpoint-health"`
- Scores: `id="endpoint-scores"`
- Metrics: `id="endpoint-metrics"`
- Timeseries: `id="endpoint-timeseries"`
- Rankings: `id="endpoint-rankings"`
- Reports: `id="endpoint-reports"`
- Watchlist: `id="endpoint-watchlist"`

This may require modifying `EndpointSection.tsx` to accept an optional `id` prop and pass it to the root `<div>`.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/docs/api/components/EndpointsReference.tsx packages/frontend/app/docs/api/components/EndpointSection.tsx
git commit -m "feat: add health endpoint to API reference, add anchor IDs for deep linking"
```

---

## Task 10: Admin UI — API Keys Page Improvements

**Files:**

- Modify: `packages/frontend/app/org/[slug]/admin/api-keys/page.tsx`

- [ ] **Step 1: Improve empty state**

Replace the empty state content (around line 167-183):

Current:

```
No API keys yet
Create one to access PropertyIQ data programmatically.
```

New:

```
API keys let you pull PropertyIQ data into your website, spreadsheets, CRM, and automations.
Create your first key to get started.
```

Add a link below the Create Key button:

```tsx
<a
  href="/docs/api#getting-started"
  className="text-xs text-primary hover:underline mt-2 inline-block"
>
  Learn what you can build with the API →
</a>
```

- [ ] **Step 2: Improve API disabled state**

Find the disabled state message and update to:

```
API access is available on Enterprise plans. Contact your account manager to enable it.
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/org/[slug]/admin/api-keys/page.tsx
git commit -m "feat: improve API keys empty and disabled state copy with docs links"
```

---

## Task 11: Admin UI — CreateApiKeyDialog Improvements

**Files:**

- Modify: `packages/frontend/app/org/components/CreateApiKeyDialog.tsx`

- [ ] **Step 1: Add scope group helper text**

After each scope group heading in the create dialog, add a one-line description:

```typescript
const SCOPE_GROUP_HELPERS: Record<string, string> = {
  Scores:
    "Read PropertyIQ scores for any market — HomeReady, InvestorEdge, Market Health",
  Metrics:
    "Read individual metric values like home values, rent prices, and economic indicators",
  Rankings: "Access market leaderboards and top/bottom rankings by score type",
  Reports: "Generate and retrieve client-ready market analysis reports",
  Watchlist: "Read and manage your saved market watchlist",
};
```

Render below each group heading:

```tsx
<p className="text-xs text-on-surface-variant mt-0.5 mb-2">
  {SCOPE_GROUP_HELPERS[group.resource]}
</p>
```

- [ ] **Step 2: Add rate limit helper text**

Below the rate limit dropdown, add:

```tsx
<p className="text-xs text-on-surface-variant mt-1">
  How many requests per minute this key can make. 60 is fine for most use cases.
</p>
```

- [ ] **Step 3: Add "What's Next?" card to KeyRevealDialog**

In the `KeyRevealDialog` component (bottom of the same file), after the "Done" button, add a "What's Next?" section:

```tsx
{
  /* What's Next */
}
<div className="mt-4 rounded-xl bg-surface-container-low p-4 space-y-2">
  <p className="text-sm font-medium text-on-surface">What&apos;s next?</p>
  <div className="space-y-1.5">
    <a
      href="/docs/api#getting-started"
      className="block text-sm text-primary hover:underline"
    >
      1. Verify your key works →
    </a>
    <a
      href="/docs/api#use-cases"
      className="block text-sm text-primary hover:underline"
    >
      2. See what you can build →
    </a>
    <a
      href="/docs/api#reference"
      className="block text-sm text-primary hover:underline"
    >
      3. Full endpoint reference →
    </a>
  </div>
</div>;
```

- [ ] **Step 4: Strengthen key warning**

Replace the current amber warning in KeyRevealDialog with a stronger version:

```tsx
<div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 dark:bg-red-950/20 mb-4">
  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
  <p className="text-sm font-medium text-red-700 dark:text-red-400">
    Copy this key now. It will never be shown again. If you lose it, you&apos;ll
    need to create a new one.
  </p>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/org/components/CreateApiKeyDialog.tsx
git commit -m "feat: add scope helpers, rate limit guidance, and What's Next card to API key creation flow"
```

---

## Task 12: Admin UI — ApiKeyCard Improvements

**Files:**

- Modify: `packages/frontend/app/org/components/ApiKeyCard.tsx`

- [ ] **Step 1: Add quickstart link for never-used keys**

Change the "Never used" text (around line 115) from:

```tsx
"Never used";
```

To:

```tsx
<a href="/docs/api#getting-started" className="text-primary hover:underline">
  Never used — See quickstart
</a>
```

- [ ] **Step 2: Make scope badges link to endpoint reference**

Import the scope anchor mapping:

```typescript
import { SCOPE_ANCHORS } from "@/app/docs/api/components/api-docs-data";
```

Wrap each scope badge in an anchor:

```tsx
{
  apiKey.scopes.map((scope) => {
    const anchor = SCOPE_ANCHORS[scope];
    const badge = (
      <span
        className={`rounded-lg px-2 py-0.5 text-xs font-medium ${getScopeColor(scope)}`}
      >
        {SCOPE_LABELS[scope] ?? scope}
      </span>
    );
    return anchor ? (
      <a
        key={scope}
        href={`/docs/api#reference`}
        className="hover:opacity-80 transition-opacity"
      >
        {badge}
      </a>
    ) : (
      <span key={scope}>{badge}</span>
    );
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/org/components/ApiKeyCard.tsx
git commit -m "feat: add quickstart link for unused keys, clickable scope badges on API key cards"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Type check both packages**

```bash
cd packages/backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit
```

Expected: Only pre-existing errors (onDeleteOrg, actor_email).

- [ ] **Step 2: Manual walkthrough**

Start both servers and verify:

1. `/docs/api` loads with Getting Started tab by default
2. Tab switching works, URL hash updates
3. Deep link `/docs/api#troubleshooting` loads correct tab
4. Browser back/forward navigates between tabs
5. Use case cards expand/collapse
6. Code tabs switch languages and persist choice
7. API keys page shows improved empty state
8. Key creation dialog shows scope helpers and rate limit guidance
9. Key reveal dialog shows strengthened warning and What's Next card
10. Never-used keys show quickstart link

- [ ] **Step 3: Final commit and push**

```bash
git push origin develop
git checkout main && git merge develop && git push origin main && git checkout develop
```
