# Command Center v2 — Cards + Panels Implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 15 placeholder cards in the admin command center tabs with real data-driven cards that fetch from backend endpoints, and implement the detail panel content shown when a card is clicked.

**Architecture:** Each tab (Operations, Data & Scores, Business) gets 5 card components rendered inside `DashboardCard` shells. Cards use `useAdminTimeSeries` or direct `fetchAPI` calls. Clicking a card opens a `DetailPanel` with expanded Recharts charts and data tables. A `PanelContentRouter` maps card IDs to panel content components. Data comes from `/api/admin/metrics/*` endpoints (time-series snapshots) with fallback to live endpoints (`/api/health/*`) when snapshot tables are empty.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS 4 (M3 tokens), Recharts, TanStack React Query v5, Lucide React icons

**Spec:** `docs/superpowers/specs/2026-03-27-command-center-grafana-redesign.md`
**Depends on:** Plan 1 (Backend Metrics) ✅ COMPLETE, Plan 2 (Frontend Shell) ✅ COMPLETE

---

## Existing Patterns to Follow

| Pattern          | Source File                                                    | Key Details                                                                     |
| ---------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Card shell       | `admin/components/shared/DashboardCard.tsx`                    | `title`, `icon`, `badge`, `loading`, `error`, `onClick`, `children`             |
| Panel shell      | `admin/components/shared/DetailPanel.tsx`                      | `isOpen`, `onClose`, `title`, `timeRangeKey`, `onTimeRangeChange`, React Portal |
| Time-series hook | `admin/components/hooks/useAdminTimeSeries.ts`                 | `useAdminTimeSeries<T>(endpoint, params, options)`                              |
| Alerts hook      | `admin/components/hooks/useAdminAlerts.ts`                     | `useAdminAlerts(status, refreshTrigger)` with acknowledge/resolve mutations     |
| Recharts chart   | `admin/analytics/components/acquisition/ChannelTrendChart.tsx` | `ResponsiveContainer`, `LineChart`, M3 CSS vars for colors                      |
| Sparkline        | `admin/components/shared/SparklineChart.tsx`                   | SVG polyline for inline trends                                                  |
| Status dot       | `admin/components/shared/StatusDot.tsx`                        | `variant: 'success' \| 'warning' \| 'error' \| 'info'`                          |
| Freshness bar    | `admin/components/shared/FreshnessBar.tsx`                     | `daysSinceUpdate`, `expectedDays`                                               |
| Data fetcher     | `lib/data/fetchers/base.ts`                                    | `fetchAPI<T>(endpoint)`, `fetchAPIRaw(endpoint)`, auto-retry, auth headers      |

## Backend Endpoints Available

All accept `?from=&to=` query params. All return `{ success: true, data: T[] }`.

| Endpoint                                   | Table                    | Key Fields                                                                               |
| ------------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------- |
| `GET /api/admin/metrics/health-history`    | `admin_health_snapshots` | source_name, available, fresh, days_since_update, response_time_ms                       |
| `GET /api/admin/metrics/pipeline-history`  | `admin_health_snapshots` | (same — pipelines use health snapshots)                                                  |
| `GET /api/admin/metrics/api-performance`   | `admin_api_metrics`      | endpoint, p50_ms, p95_ms, request_count, error_count, error_rate                         |
| `GET /api/admin/metrics/cache-performance` | `admin_cache_metrics`    | hit_count, miss_count, hit_rate, eviction_count, memory_used_bytes, keys_count           |
| `GET /api/admin/metrics/alerts`            | `admin_alerts`           | alert_type, severity, message, source, triggered_at, resolved_at, acknowledged           |
| `GET /api/admin/metrics/score-history`     | `admin_score_snapshots`  | score_type, correlation_1y, hit_rate_1y, scores_validated, scores_pending, scores_failed |
| `GET /api/admin/metrics/user-history`      | `admin_user_snapshots`   | total*users, new_signups, tier*\*, paywall_views, conversions, mrr_cents                 |
| `GET /api/admin/metrics/page-views`        | `admin_page_views`       | page_path, view_count, unique_visitors, bounce_rate                                      |
| `GET /api/admin/metrics/coverage`          | counts per geo level     | `{ [geoLevel]: { [table]: count } }`                                                     |
| `GET /api/health/data-sources`             | live check               | sources[], summary (available, fresh, total)                                             |

## File Structure

```
packages/frontend/app/admin/components/
  cards/                                    # 15 card components (one per dashboard card)
    DataFeedsCard.tsx                       # Operations: data source freshness
    PipelineRunsCard.tsx                    # Operations: pipeline run status
    ApiPerformanceCard.tsx                  # Operations: API latency + errors
    CachePerformanceCard.tsx                # Operations: Redis hit/miss/memory
    ActiveAlertsCard.tsx                    # Operations: live alert list
    ScoreHealthCard.tsx                     # Data: correlation + hit rate
    MlOpsCard.tsx                           # Data: ML model + cache status
    GeographicCoverageCard.tsx              # Data: coverage bars per geo level
    DataQualityCard.tsx                     # Data: anomaly count + flags
    ScoreComputationCard.tsx                # Data: scored/pending/failed
    UsersGrowthCard.tsx                     # Business: total users + signups
    RevenueMrrCard.tsx                      # Business: MRR + MoM change
    FeatureUsageCard.tsx                    # Business: top pages bar chart
    TierDistributionCard.tsx                # Business: donut chart by tier
    FeedbackQueueCard.tsx                   # Business: open items + trend
  panels/                                   # 15 panel content components
    DataFeedsPanel.tsx                      # Expanded freshness timeline
    PipelineRunsPanel.tsx                   # Full run history table
    ApiPerformancePanel.tsx                 # Per-endpoint latency breakdown
    CachePerformancePanel.tsx               # Hit rate + memory trends
    ActiveAlertsPanel.tsx                   # Full alert history + actions
    ScoreHealthPanel.tsx                    # Correlation + hit rate trends
    MlOpsPanel.tsx                          # Cache age per geography
    GeographicCoveragePanel.tsx             # Full coverage matrix
    DataQualityPanel.tsx                    # Anomaly list with details
    ScoreComputationPanel.tsx               # Per-geography scoring status
    UsersGrowthPanel.tsx                    # Signup trend + retention
    RevenueMrrPanel.tsx                     # MRR trend + ARPU
    FeatureUsagePanel.tsx                   # Full page analytics table
    TierDistributionPanel.tsx               # Upgrade/downgrade trends
    FeedbackQueuePanel.tsx                  # Full feedback list
    PanelContentRouter.tsx                  # Maps cardId → panel component
  tabs/
    OperationsTab.tsx                       # MODIFY: replace PlaceholderCard with real cards
    DataScoresTab.tsx                       # MODIFY: replace PlaceholderCard with real cards
    BusinessTab.tsx                         # MODIFY: replace PlaceholderCard with real cards
  page.tsx                                  # MODIFY: add PanelContentRouter inside DetailPanel
packages/frontend/tests/e2e/
  admin-command-center.spec.ts              # E2E: card rendering + panel interactions
```

---

### Task 1: Create PanelContentRouter

Routes the active card ID to the correct panel content component. This is the glue between `DetailPanel` (shell) and individual panel implementations.

**Files:**

- Create: `packages/frontend/app/admin/components/panels/PanelContentRouter.tsx`
- Modify: `packages/frontend/app/admin/page.tsx`

- [ ] **Step 1: Create PanelContentRouter**

```typescript
// packages/frontend/app/admin/components/panels/PanelContentRouter.tsx
'use client';

import { lazy, Suspense } from 'react';
import type { TimeRange } from '../hooks/useTimeRange';

// Lazy-load panel content to avoid loading all 15 panels upfront
const DataFeedsPanel = lazy(() => import('./DataFeedsPanel').then(m => ({ default: m.DataFeedsPanel })));
const PipelineRunsPanel = lazy(() => import('./PipelineRunsPanel').then(m => ({ default: m.PipelineRunsPanel })));
const ApiPerformancePanel = lazy(() => import('./ApiPerformancePanel').then(m => ({ default: m.ApiPerformancePanel })));
const CachePerformancePanel = lazy(() => import('./CachePerformancePanel').then(m => ({ default: m.CachePerformancePanel })));
const ActiveAlertsPanel = lazy(() => import('./ActiveAlertsPanel').then(m => ({ default: m.ActiveAlertsPanel })));
const ScoreHealthPanel = lazy(() => import('./ScoreHealthPanel').then(m => ({ default: m.ScoreHealthPanel })));
const MlOpsPanel = lazy(() => import('./MlOpsPanel').then(m => ({ default: m.MlOpsPanel })));
const GeographicCoveragePanel = lazy(() => import('./GeographicCoveragePanel').then(m => ({ default: m.GeographicCoveragePanel })));
const DataQualityPanel = lazy(() => import('./DataQualityPanel').then(m => ({ default: m.DataQualityPanel })));
const ScoreComputationPanel = lazy(() => import('./ScoreComputationPanel').then(m => ({ default: m.ScoreComputationPanel })));
const UsersGrowthPanel = lazy(() => import('./UsersGrowthPanel').then(m => ({ default: m.UsersGrowthPanel })));
const RevenueMrrPanel = lazy(() => import('./RevenueMrrPanel').then(m => ({ default: m.RevenueMrrPanel })));
const FeatureUsagePanel = lazy(() => import('./FeatureUsagePanel').then(m => ({ default: m.FeatureUsagePanel })));
const TierDistributionPanel = lazy(() => import('./TierDistributionPanel').then(m => ({ default: m.TierDistributionPanel })));
const FeedbackQueuePanel = lazy(() => import('./FeedbackQueuePanel').then(m => ({ default: m.FeedbackQueuePanel })));

interface PanelContentRouterProps {
  cardId: string | null;
  timeRange: TimeRange;
  refreshTrigger: number;
}

function PanelSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-48 bg-surface-container rounded-xl" />
      <div className="h-4 bg-surface-container rounded w-3/4" />
      <div className="h-4 bg-surface-container rounded w-1/2" />
    </div>
  );
}

const PANEL_MAP: Record<string, React.ComponentType<{ timeRange: TimeRange; refreshTrigger: number }>> = {
  'data-feeds': DataFeedsPanel,
  'pipeline-runs': PipelineRunsPanel,
  'api-performance': ApiPerformancePanel,
  'cache-performance': CachePerformancePanel,
  'active-alerts': ActiveAlertsPanel,
  'score-health': ScoreHealthPanel,
  'ml-ops': MlOpsPanel,
  'geographic-coverage': GeographicCoveragePanel,
  'data-quality': DataQualityPanel,
  'score-computation': ScoreComputationPanel,
  'users-growth': UsersGrowthPanel,
  'revenue-mrr': RevenueMrrPanel,
  'feature-usage': FeatureUsagePanel,
  'tier-distribution': TierDistributionPanel,
  'feedback-queue': FeedbackQueuePanel,
};

export function PanelContentRouter({ cardId, timeRange, refreshTrigger }: PanelContentRouterProps) {
  if (!cardId) return null;

  const PanelComponent = PANEL_MAP[cardId];
  if (!PanelComponent) {
    return (
      <div className="text-center py-12 text-on-surface-variant text-sm">
        Panel not implemented for &quot;{cardId}&quot;
      </div>
    );
  }

  return (
    <Suspense fallback={<PanelSkeleton />}>
      <PanelComponent timeRange={timeRange} refreshTrigger={refreshTrigger} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Wire PanelContentRouter into page.tsx**

In `packages/frontend/app/admin/page.tsx`, replace the placeholder `<div>` inside `<DetailPanel>` with the router.

Add the import at the top of page.tsx:

```typescript
import { PanelContentRouter } from "./components/panels/PanelContentRouter";
```

Replace the `<DetailPanel>` children (the placeholder div with "Panel content for {activeCard}...") with:

```tsx
<PanelContentRouter
  cardId={activeCard}
  timeRange={range}
  refreshTrigger={refreshTrigger}
/>
```

- [ ] **Step 3: Create stub panel files**

Create all 15 panel files with a minimal stub so the lazy imports resolve. Each file follows this pattern (example for DataFeedsPanel):

```typescript
// packages/frontend/app/admin/components/panels/DataFeedsPanel.tsx
'use client';

import type { TimeRange } from '../hooks/useTimeRange';

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

export function DataFeedsPanel({ timeRange, refreshTrigger }: PanelProps) {
  return (
    <div className="text-sm text-on-surface-variant text-center py-8">
      Data Feeds panel — implementing in Task 4
    </div>
  );
}
```

Create **all 15** stub files with the same pattern, changing only the export name and placeholder text:

- `DataFeedsPanel.tsx`, `PipelineRunsPanel.tsx`, `ApiPerformancePanel.tsx`, `CachePerformancePanel.tsx`, `ActiveAlertsPanel.tsx`
- `ScoreHealthPanel.tsx`, `MlOpsPanel.tsx`, `GeographicCoveragePanel.tsx`, `DataQualityPanel.tsx`, `ScoreComputationPanel.tsx`
- `UsersGrowthPanel.tsx`, `RevenueMrrPanel.tsx`, `FeatureUsagePanel.tsx`, `TierDistributionPanel.tsx`, `FeedbackQueuePanel.tsx`

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/admin/components/panels/
git add packages/frontend/app/admin/page.tsx
git commit -m "feat(admin-command-center): add PanelContentRouter with lazy-loaded panel stubs"
```

---

### Task 2: Operations Tab — 5 Cards

Replace the `PlaceholderCard` components in `OperationsTab.tsx` with real data-driven cards.

**Files:**

- Create: `packages/frontend/app/admin/components/cards/DataFeedsCard.tsx`
- Create: `packages/frontend/app/admin/components/cards/PipelineRunsCard.tsx`
- Create: `packages/frontend/app/admin/components/cards/ApiPerformanceCard.tsx`
- Create: `packages/frontend/app/admin/components/cards/CachePerformanceCard.tsx`
- Create: `packages/frontend/app/admin/components/cards/ActiveAlertsCard.tsx`
- Modify: `packages/frontend/app/admin/components/tabs/OperationsTab.tsx`

- [ ] **Step 1: Create DataFeedsCard**

Shows data source availability and freshness status. Fetches from the live `/api/health/data-sources` endpoint for real-time status.

```typescript
// packages/frontend/app/admin/components/cards/DataFeedsCard.tsx
'use client';

import { useState, useEffect } from 'react';
import { Database } from 'lucide-react';
import { fetchAPIRaw } from '@/lib/data';
import { DashboardCard } from '../shared/DashboardCard';
import { StatusDot } from '../shared/StatusDot';

interface SourceHealth {
  sourceName: string;
  displayName: string;
  available: boolean;
  fresh: boolean;
  daysSinceUpdate: number | null;
  expectedFreshnessDays: number;
}

interface DataSourcesResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  sources: SourceHealth[];
  summary: { total: number; available: number; fresh: number };
}

interface DataFeedsCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function DataFeedsCard({ refreshTrigger, onClick }: DataFeedsCardProps) {
  const [data, setData] = useState<DataSourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAPIRaw('/api/health/data-sources');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: DataSourcesResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const badgeText = data ? `${data.summary.fresh}/${data.summary.total} Fresh` : undefined;
  const badgeColor = data && data.summary.fresh === data.summary.total ? 'bg-green-500/10 text-green-700' : 'bg-amber-500/10 text-amber-700';

  return (
    <DashboardCard
      title="Data Feeds"
      icon={Database}
      badge={data ? { text: badgeText!, color: badgeColor } : undefined}
      loading={loading}
      error={error}
      onClick={onClick}
    >
      {data && (
        <ul className="space-y-1.5">
          {data.sources.slice(0, 6).map((source) => (
            <li key={source.sourceName} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <StatusDot variant={source.available ? 'success' : 'error'} />
                <span className="text-on-surface truncate">{source.displayName}</span>
              </div>
              <span className={`font-mono ${source.fresh ? 'text-green-600' : 'text-red-500'}`}>
                {source.daysSinceUpdate !== null ? `${source.daysSinceUpdate}d` : '—'}
              </span>
            </li>
          ))}
          {data.sources.length > 6 && (
            <li className="text-xs text-on-surface-variant">+{data.sources.length - 6} more</li>
          )}
        </ul>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 2: Create PipelineRunsCard**

Shows recent pipeline runs with status badges. Falls back to the existing `/api/health/pipeline-runs` endpoint.

```typescript
// packages/frontend/app/admin/components/cards/PipelineRunsCard.tsx
'use client';

import { useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import { fetchAPIRaw } from '@/lib/data';
import { DashboardCard } from '../shared/DashboardCard';
import { StatusDot } from '../shared/StatusDot';

interface PipelineRun {
  pipeline_name: string;
  display_name?: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  records_processed?: number;
  duration_ms?: number;
}

interface PipelineRunsCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  success: 'success',
  partial: 'warning',
  failed: 'error',
  running: 'info',
};

function formatDuration(ms: number | undefined): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function PipelineRunsCard({ refreshTrigger, onClick }: PipelineRunsCardProps) {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAPIRaw('/api/health/pipeline-runs');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.data ?? json.runs ?? [];
        if (!cancelled) setRuns(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const recent = runs.slice(0, 4);
  const successCount = runs.filter(r => r.status === 'success').length;
  const failCount = runs.filter(r => r.status === 'failed').length;

  return (
    <DashboardCard
      title="Pipeline Runs"
      icon={Play}
      badge={runs.length > 0 ? {
        text: `${successCount}✓ ${failCount}✗`,
        color: failCount > 0 ? 'bg-red-500/10 text-red-700' : 'bg-green-500/10 text-green-700',
      } : undefined}
      loading={loading}
      error={error}
      onClick={onClick}
    >
      {recent.length > 0 ? (
        <ul className="space-y-1.5">
          {recent.map((run, i) => (
            <li key={`${run.pipeline_name}-${i}`} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <StatusDot variant={STATUS_VARIANT[run.status] ?? 'neutral'} pulse={run.status === 'running'} />
                <span className="text-on-surface truncate max-w-[140px]">
                  {run.display_name ?? run.pipeline_name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant font-mono">
                <span>{formatDuration(run.duration_ms)}</span>
                <span>{formatRelativeTime(run.started_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-on-surface-variant">No pipeline runs recorded</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 3: Create ApiPerformanceCard**

Shows p50/p95 latency and error rate from the admin metrics endpoint.

```typescript
// packages/frontend/app/admin/components/cards/ApiPerformanceCard.tsx
'use client';

import { Activity } from 'lucide-react';
import { DashboardCard } from '../shared/DashboardCard';
import { SparklineChart } from '../shared/SparklineChart';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';

interface ApiMetricRow {
  timestamp: string;
  endpoint: string;
  p50_ms: number;
  p95_ms: number;
  request_count: number;
  error_count: number;
  error_rate: number;
}

interface ApiPerformanceCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function ApiPerformanceCard({ refreshTrigger, onClick }: ApiPerformanceCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<ApiMetricRow>(
    'api-performance',
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  const latestP95 = rows.length > 0 ? rows[0].p95_ms : null;
  const totalErrors = rows.reduce((acc, r) => acc + r.error_count, 0);
  const totalRequests = rows.reduce((acc, r) => acc + r.request_count, 0);
  const avgErrorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  const sparklineData = rows.slice(0, 30).reverse().map(r => r.p95_ms);

  return (
    <DashboardCard
      title="API Performance"
      icon={Activity}
      badge={latestP95 !== null ? {
        text: `${Math.round(latestP95)}ms p95`,
        color: latestP95 > 500 ? 'bg-red-500/10 text-red-700' : 'bg-green-500/10 text-green-700',
      } : undefined}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {rows.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-on-surface-variant">Error rate</span>
            <span className={avgErrorRate > 5 ? 'text-red-500 font-medium' : 'text-green-600'}>
              {avgErrorRate.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-on-surface-variant">Requests</span>
            <span className="text-on-surface font-mono">{totalRequests.toLocaleString()}</span>
          </div>
          {sparklineData.length >= 2 && (
            <SparklineChart data={sparklineData} color="var(--color-primary)" width={200} height={32} />
          )}
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">No API metrics recorded yet</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 4: Create CachePerformanceCard**

Shows Redis cache hit rate, memory, and evictions.

```typescript
// packages/frontend/app/admin/components/cards/CachePerformanceCard.tsx
'use client';

import { HardDrive } from 'lucide-react';
import { DashboardCard } from '../shared/DashboardCard';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';

interface CacheMetricRow {
  timestamp: string;
  hit_count: number;
  miss_count: number;
  hit_rate: number;
  eviction_count: number;
  memory_used_bytes: number;
  keys_count: number;
}

interface CachePerformanceCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function CachePerformanceCard({ refreshTrigger, onClick }: CachePerformanceCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<CacheMetricRow>(
    'cache-performance',
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  const latest = rows.length > 0 ? rows[0] : null;
  const hitRate = latest ? latest.hit_rate * 100 : 0;

  return (
    <DashboardCard
      title="Cache Performance"
      icon={HardDrive}
      badge={latest ? {
        text: `${hitRate.toFixed(0)}% hit`,
        color: hitRate >= 80 ? 'bg-green-500/10 text-green-700' : 'bg-amber-500/10 text-amber-700',
      } : undefined}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {latest ? (
        <div className="space-y-2">
          {/* Hit/miss bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-on-surface-variant">Hit / Miss</span>
              <span className="font-mono text-on-surface">{latest.hit_count} / {latest.miss_count}</span>
            </div>
            <div className="h-2 bg-surface-container rounded-full overflow-hidden flex">
              <div className="bg-green-500 h-full" style={{ width: `${hitRate}%` }} />
              <div className="bg-red-400 h-full flex-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-on-surface-variant">Memory</span>
              <p className="font-mono text-on-surface">{formatBytes(latest.memory_used_bytes)}</p>
            </div>
            <div>
              <span className="text-on-surface-variant">Evictions</span>
              <p className="font-mono text-on-surface">{latest.eviction_count.toLocaleString()}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">No cache metrics recorded yet</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 5: Create ActiveAlertsCard**

Shows active alerts sorted by severity.

```typescript
// packages/frontend/app/admin/components/cards/ActiveAlertsCard.tsx
'use client';

import { AlertTriangle } from 'lucide-react';
import { DashboardCard } from '../shared/DashboardCard';
import { AlertItem } from '../shared/AlertItem';
import { useAdminAlerts } from '../hooks/useAdminAlerts';

interface ActiveAlertsCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function ActiveAlertsCard({ refreshTrigger, onClick }: ActiveAlertsCardProps) {
  const { data: alerts, isLoading, error } = useAdminAlerts('active', refreshTrigger);

  const list = alerts ?? [];
  const criticalCount = list.filter(a => a.severity === 'critical').length;
  const warningCount = list.filter(a => a.severity === 'warning').length;

  return (
    <DashboardCard
      title="Active Alerts"
      icon={AlertTriangle}
      badge={list.length > 0 ? {
        text: `${list.length} active`,
        color: criticalCount > 0 ? 'bg-red-500/10 text-red-700' : 'bg-amber-500/10 text-amber-700',
      } : { text: 'Clear', color: 'bg-green-500/10 text-green-700' }}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {list.length > 0 ? (
        <ul className="space-y-1">
          {list.slice(0, 4).map((alert) => (
            <AlertItem
              key={alert.id}
              severity={alert.severity}
              message={alert.message}
              triggeredAt={alert.triggered_at}
              acknowledged={alert.acknowledged}
            />
          ))}
          {list.length > 4 && (
            <li className="text-xs text-on-surface-variant pt-1">+{list.length - 4} more alerts</li>
          )}
        </ul>
      ) : (
        <p className="text-xs text-green-600">No active alerts</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 6: Rewrite OperationsTab to use real cards**

Replace the `PlaceholderCard` components with the new card imports.

```typescript
// packages/frontend/app/admin/components/tabs/OperationsTab.tsx
'use client';

import { DataFeedsCard } from '../cards/DataFeedsCard';
import { PipelineRunsCard } from '../cards/PipelineRunsCard';
import { ApiPerformanceCard } from '../cards/ApiPerformanceCard';
import { CachePerformanceCard } from '../cards/CachePerformanceCard';
import { ActiveAlertsCard } from '../cards/ActiveAlertsCard';

interface OperationsTabProps {
  refreshTrigger: number;
  onCardClick: (cardId: string) => void;
}

export function OperationsTab({ refreshTrigger, onCardClick }: OperationsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <DataFeedsCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('data-feeds')} />
        <PipelineRunsCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('pipeline-runs')} />
        <ApiPerformanceCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('api-performance')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CachePerformanceCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('cache-performance')} />
        <ActiveAlertsCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('active-alerts')} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/app/admin/components/cards/DataFeedsCard.tsx
git add packages/frontend/app/admin/components/cards/PipelineRunsCard.tsx
git add packages/frontend/app/admin/components/cards/ApiPerformanceCard.tsx
git add packages/frontend/app/admin/components/cards/CachePerformanceCard.tsx
git add packages/frontend/app/admin/components/cards/ActiveAlertsCard.tsx
git add packages/frontend/app/admin/components/tabs/OperationsTab.tsx
git commit -m "feat(admin-command-center): implement 5 operations tab cards with real data"
```

---

### Task 3: Data & Scores Tab — 5 Cards

**Files:**

- Create: `packages/frontend/app/admin/components/cards/ScoreHealthCard.tsx`
- Create: `packages/frontend/app/admin/components/cards/MlOpsCard.tsx`
- Create: `packages/frontend/app/admin/components/cards/GeographicCoverageCard.tsx`
- Create: `packages/frontend/app/admin/components/cards/DataQualityCard.tsx`
- Create: `packages/frontend/app/admin/components/cards/ScoreComputationCard.tsx`
- Modify: `packages/frontend/app/admin/components/tabs/DataScoresTab.tsx`

- [ ] **Step 1: Create ScoreHealthCard**

Shows correlation and hit rate with trend arrows.

```typescript
// packages/frontend/app/admin/components/cards/ScoreHealthCard.tsx
'use client';

import { TrendingUp } from 'lucide-react';
import { DashboardCard } from '../shared/DashboardCard';
import { SparklineChart } from '../shared/SparklineChart';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';

interface ScoreSnapshotRow {
  timestamp: string;
  score_type: string;
  correlation_1y: number | null;
  hit_rate_1y: number | null;
  scores_validated: number;
  scores_pending: number;
  scores_failed: number;
}

interface ScoreHealthCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function ScoreHealthCard({ refreshTrigger, onClick }: ScoreHealthCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<ScoreSnapshotRow>(
    'score-history',
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  const latest = rows.length > 0 ? rows[0] : null;
  const hitRate = latest?.hit_rate_1y ?? 0;
  const correlation = latest?.correlation_1y ?? 0;
  const sparkline = rows.slice(0, 12).reverse().map(r => (r.hit_rate_1y ?? 0) * 100);

  return (
    <DashboardCard
      title="Score Health"
      icon={TrendingUp}
      badge={latest ? {
        text: `${(hitRate * 100).toFixed(0)}% hit rate`,
        color: hitRate >= 0.6 ? 'bg-green-500/10 text-green-700' : 'bg-amber-500/10 text-amber-700',
      } : undefined}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {latest ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-on-surface-variant">1Y Correlation</p>
              <p className="text-lg font-medium text-on-surface">{(correlation * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">1Y Hit Rate</p>
              <p className="text-lg font-medium text-on-surface">{(hitRate * 100).toFixed(1)}%</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant mb-1">Validated: {latest.scores_validated}</p>
            {sparkline.length >= 2 && (
              <SparklineChart data={sparkline} color="var(--color-primary)" width={200} height={28} />
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">No score validation data yet</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 2: Create MlOpsCard**

Shows ML model connection status and cache counts per geography.

```typescript
// packages/frontend/app/admin/components/cards/MlOpsCard.tsx
'use client';

import { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import { fetchAPI } from '@/lib/data';
import { DashboardCard } from '../shared/DashboardCard';
import { StatusDot } from '../shared/StatusDot';

interface MlOpsData {
  connected: boolean;
  version: string;
  cacheBreakdown: Record<string, number>;
  totalCached: number;
}

interface MlOpsCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function MlOpsCard({ refreshTrigger, onClick }: MlOpsCardProps) {
  const [data, setData] = useState<MlOpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [healthRes, cacheRes] = await Promise.allSettled([
          fetchAPI<{ data: { status: string; version: string } }>('/api/scoring/health'),
          fetchAPI<{ data: Record<string, number> }>('/api/scoring/cache-stats'),
        ]);

        const connected = healthRes.status === 'fulfilled';
        const version = healthRes.status === 'fulfilled' ? healthRes.value.data?.version ?? 'unknown' : 'offline';
        const cacheBreakdown = cacheRes.status === 'fulfilled' ? cacheRes.value.data ?? {} : {};
        const totalCached = Object.values(cacheBreakdown).reduce((a, b) => a + b, 0);

        if (!cancelled) setData({ connected, version, cacheBreakdown, totalCached });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  return (
    <DashboardCard
      title="ML Ops"
      icon={Cpu}
      badge={data ? {
        text: data.connected ? 'Connected' : 'Offline',
        color: data.connected ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700',
      } : undefined}
      loading={loading}
      error={error}
      onClick={onClick}
    >
      {data ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <StatusDot variant={data.connected ? 'success' : 'error'} />
            <span className="text-on-surface">v{data.version}</span>
            <span className="text-on-surface-variant ml-auto">{data.totalCached.toLocaleString()} cached</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {Object.entries(data.cacheBreakdown).map(([geo, count]) => (
              <div key={geo} className="flex justify-between">
                <span className="text-on-surface-variant capitalize">{geo}</span>
                <span className="font-mono text-on-surface">{count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">Loading ML status...</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 3: Create GeographicCoverageCard**

Shows percentage bars for data coverage at each geography level.

```typescript
// packages/frontend/app/admin/components/cards/GeographicCoverageCard.tsx
'use client';

import { Map } from 'lucide-react';
import { DashboardCard } from '../shared/DashboardCard';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';

interface CoverageData {
  [geoLevel: string]: { [table: string]: number };
}

interface GeographicCoverageCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

// Expected regions per geo level (approximate)
const GEO_TOTALS: Record<string, number> = {
  state: 51,
  metro: 400,
  county: 3200,
  zip: 33000,
};

export function GeographicCoverageCard({ refreshTrigger, onClick }: GeographicCoverageCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<CoverageData>(
    'coverage',
    undefined,
    { refreshTrigger },
  );

  // Coverage endpoint returns a single object, not an array
  const coverage = (Array.isArray(data) ? data[0] : data) as CoverageData | undefined;

  return (
    <DashboardCard
      title="Geographic Coverage"
      icon={Map}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {coverage ? (
        <div className="space-y-2">
          {Object.entries(GEO_TOTALS).map(([level, total]) => {
            const levelData = coverage[level] ?? {};
            const maxCount = Math.max(...Object.values(levelData), 0);
            const pct = total > 0 ? Math.min((maxCount / total) * 100, 100) : 0;
            const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
            return (
              <div key={level}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-on-surface-variant capitalize">{level}</span>
                  <span className="font-mono text-on-surface">{pct.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 3)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">No coverage data available</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 4: Create DataQualityCard**

Shows anomaly count and recent outlier flags. For now, derives quality signals from health snapshots (anomaly detection is a future feature — card shows data freshness quality).

```typescript
// packages/frontend/app/admin/components/cards/DataQualityCard.tsx
'use client';

import { ShieldCheck } from 'lucide-react';
import { DashboardCard } from '../shared/DashboardCard';
import { StatusDot } from '../shared/StatusDot';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';

interface HealthRow {
  timestamp: string;
  source_name: string;
  available: boolean;
  fresh: boolean;
  days_since_update: number | null;
  error_message: string | null;
}

interface DataQualityCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function DataQualityCard({ refreshTrigger, onClick }: DataQualityCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<HealthRow>(
    'health-history',
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];

  // Derive quality signals: stale sources, unavailable, errors
  const latestBySource = new Map<string, HealthRow>();
  for (const row of rows) {
    if (!latestBySource.has(row.source_name)) {
      latestBySource.set(row.source_name, row);
    }
  }

  const issues: Array<{ source: string; issue: string; severity: 'warning' | 'error' }> = [];
  for (const [source, row] of latestBySource) {
    if (!row.available) issues.push({ source, issue: 'Unavailable', severity: 'error' });
    else if (!row.fresh) issues.push({ source, issue: 'Stale data', severity: 'warning' });
    if (row.error_message) issues.push({ source, issue: row.error_message, severity: 'error' });
  }

  return (
    <DashboardCard
      title="Data Quality"
      icon={ShieldCheck}
      badge={{
        text: issues.length > 0 ? `${issues.length} issues` : 'Healthy',
        color: issues.length > 0 ? 'bg-amber-500/10 text-amber-700' : 'bg-green-500/10 text-green-700',
      }}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {issues.length > 0 ? (
        <ul className="space-y-1.5">
          {issues.slice(0, 4).map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <StatusDot variant={item.severity} />
              <span className="text-on-surface truncate">{item.source}</span>
              <span className="text-on-surface-variant ml-auto truncate max-w-[100px]">{item.issue}</span>
            </li>
          ))}
          {issues.length > 4 && (
            <li className="text-xs text-on-surface-variant">+{issues.length - 4} more</li>
          )}
        </ul>
      ) : (
        <p className="text-xs text-green-600">All data sources healthy</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 5: Create ScoreComputationCard**

Shows scored / pending / failed counts with progress summary.

```typescript
// packages/frontend/app/admin/components/cards/ScoreComputationCard.tsx
'use client';

import { Calculator } from 'lucide-react';
import { DashboardCard } from '../shared/DashboardCard';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';

interface ScoreSnapshotRow {
  timestamp: string;
  score_type: string;
  scores_validated: number;
  scores_pending: number;
  scores_failed: number;
}

interface ScoreComputationCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function ScoreComputationCard({ refreshTrigger, onClick }: ScoreComputationCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<ScoreSnapshotRow>(
    'score-history',
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];

  // Aggregate latest per score type
  const latestByType = new Map<string, ScoreSnapshotRow>();
  for (const row of rows) {
    if (!latestByType.has(row.score_type)) {
      latestByType.set(row.score_type, row);
    }
  }

  let totalValidated = 0, totalPending = 0, totalFailed = 0;
  for (const row of latestByType.values()) {
    totalValidated += row.scores_validated;
    totalPending += row.scores_pending;
    totalFailed += row.scores_failed;
  }
  const total = totalValidated + totalPending + totalFailed;

  return (
    <DashboardCard
      title="Score Computation"
      icon={Calculator}
      badge={total > 0 ? {
        text: `${totalValidated}/${total} scored`,
        color: totalFailed > 0 ? 'bg-red-500/10 text-red-700' : 'bg-green-500/10 text-green-700',
      } : undefined}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {total > 0 ? (
        <div className="space-y-2">
          {/* Progress bar */}
          <div className="h-2 bg-surface-container rounded-full overflow-hidden flex">
            {totalValidated > 0 && (
              <div className="bg-green-500 h-full" style={{ width: `${(totalValidated / total) * 100}%` }} />
            )}
            {totalPending > 0 && (
              <div className="bg-amber-400 h-full" style={{ width: `${(totalPending / total) * 100}%` }} />
            )}
            {totalFailed > 0 && (
              <div className="bg-red-500 h-full" style={{ width: `${(totalFailed / total) * 100}%` }} />
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div>
              <p className="text-green-600 font-medium">{totalValidated}</p>
              <p className="text-on-surface-variant">Scored</p>
            </div>
            <div>
              <p className="text-amber-600 font-medium">{totalPending}</p>
              <p className="text-on-surface-variant">Pending</p>
            </div>
            <div>
              <p className="text-red-600 font-medium">{totalFailed}</p>
              <p className="text-on-surface-variant">Failed</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">No score computation data yet</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 6: Rewrite DataScoresTab to use real cards**

```typescript
// packages/frontend/app/admin/components/tabs/DataScoresTab.tsx
'use client';

import { ScoreHealthCard } from '../cards/ScoreHealthCard';
import { MlOpsCard } from '../cards/MlOpsCard';
import { GeographicCoverageCard } from '../cards/GeographicCoverageCard';
import { DataQualityCard } from '../cards/DataQualityCard';
import { ScoreComputationCard } from '../cards/ScoreComputationCard';

interface DataScoresTabProps {
  refreshTrigger: number;
  onCardClick: (cardId: string) => void;
}

export function DataScoresTab({ refreshTrigger, onCardClick }: DataScoresTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ScoreHealthCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('score-health')} />
        <MlOpsCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('ml-ops')} />
        <GeographicCoverageCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('geographic-coverage')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DataQualityCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('data-quality')} />
        <ScoreComputationCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('score-computation')} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/app/admin/components/cards/ScoreHealthCard.tsx
git add packages/frontend/app/admin/components/cards/MlOpsCard.tsx
git add packages/frontend/app/admin/components/cards/GeographicCoverageCard.tsx
git add packages/frontend/app/admin/components/cards/DataQualityCard.tsx
git add packages/frontend/app/admin/components/cards/ScoreComputationCard.tsx
git add packages/frontend/app/admin/components/tabs/DataScoresTab.tsx
git commit -m "feat(admin-command-center): implement 5 data & scores tab cards with real data"
```

---

### Task 4: Business Tab — 5 Cards

**Files:**

- Create: `packages/frontend/app/admin/components/cards/UsersGrowthCard.tsx`
- Create: `packages/frontend/app/admin/components/cards/RevenueMrrCard.tsx`
- Create: `packages/frontend/app/admin/components/cards/FeatureUsageCard.tsx`
- Create: `packages/frontend/app/admin/components/cards/TierDistributionCard.tsx`
- Create: `packages/frontend/app/admin/components/cards/FeedbackQueueCard.tsx`
- Modify: `packages/frontend/app/admin/components/tabs/BusinessTab.tsx`

- [ ] **Step 1: Create UsersGrowthCard**

```typescript
// packages/frontend/app/admin/components/cards/UsersGrowthCard.tsx
'use client';

import { Users } from 'lucide-react';
import { DashboardCard } from '../shared/DashboardCard';
import { SparklineChart } from '../shared/SparklineChart';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';

interface UserSnapshotRow {
  timestamp: string;
  total_users: number;
  new_signups: number;
}

interface UsersGrowthCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function UsersGrowthCard({ refreshTrigger, onClick }: UsersGrowthCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<UserSnapshotRow>(
    'user-history',
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  const latest = rows.length > 0 ? rows[0] : null;
  const weekSignups = rows.slice(0, 7).reduce((acc, r) => acc + (r.new_signups ?? 0), 0);
  const sparkline = rows.slice(0, 30).reverse().map(r => r.total_users);

  return (
    <DashboardCard
      title="Users & Growth"
      icon={Users}
      badge={latest ? {
        text: `+${weekSignups} this week`,
        color: weekSignups > 0 ? 'bg-purple-500/10 text-purple-700' : 'bg-surface-container text-on-surface-variant',
      } : undefined}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {latest ? (
        <div className="space-y-2">
          <p className="text-2xl font-medium text-on-surface">{latest.total_users.toLocaleString()}</p>
          <p className="text-xs text-on-surface-variant">Total registered users</p>
          {sparkline.length >= 2 && (
            <SparklineChart data={sparkline} color="var(--color-tertiary, #7c3aed)" width={200} height={28} />
          )}
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">No user data recorded yet</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 2: Create RevenueMrrCard**

```typescript
// packages/frontend/app/admin/components/cards/RevenueMrrCard.tsx
'use client';

import { DollarSign } from 'lucide-react';
import { DashboardCard } from '../shared/DashboardCard';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';

interface UserSnapshotRow {
  timestamp: string;
  mrr_cents: number;
  conversions: number;
  paywall_views: number;
}

interface RevenueMrrCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function RevenueMrrCard({ refreshTrigger, onClick }: RevenueMrrCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<UserSnapshotRow>(
    'user-history',
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  const latest = rows.length > 0 ? rows[0] : null;
  const previous = rows.length > 1 ? rows[1] : null;
  const mrr = latest ? latest.mrr_cents / 100 : 0;
  const prevMrr = previous ? previous.mrr_cents / 100 : 0;
  const momChange = prevMrr > 0 ? ((mrr - prevMrr) / prevMrr) * 100 : 0;
  const conversionRate = latest && latest.paywall_views > 0
    ? (latest.conversions / latest.paywall_views) * 100
    : 0;

  return (
    <DashboardCard
      title="Revenue / MRR"
      icon={DollarSign}
      badge={mrr > 0 ? {
        text: momChange >= 0 ? `+${momChange.toFixed(1)}% MoM` : `${momChange.toFixed(1)}% MoM`,
        color: momChange >= 0 ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700',
      } : undefined}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {latest ? (
        <div className="space-y-2">
          <p className="text-2xl font-medium text-on-surface">${mrr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-on-surface-variant">Monthly recurring revenue</p>
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-on-surface-variant">Conversions:</span>{' '}
              <span className="font-mono text-on-surface">{latest.conversions}</span>
            </div>
            <div>
              <span className="text-on-surface-variant">CVR:</span>{' '}
              <span className="font-mono text-on-surface">{conversionRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">No revenue data — Stripe integration pending</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 3: Create FeatureUsageCard**

```typescript
// packages/frontend/app/admin/components/cards/FeatureUsageCard.tsx
'use client';

import { BarChart3 } from 'lucide-react';
import { DashboardCard } from '../shared/DashboardCard';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';

interface PageViewRow {
  timestamp: string;
  page_path: string;
  view_count: number;
  unique_visitors: number;
}

interface FeatureUsageCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function FeatureUsageCard({ refreshTrigger, onClick }: FeatureUsageCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<PageViewRow>(
    'page-views',
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];

  // Aggregate views by page path
  const pageMap = new Map<string, number>();
  for (const row of rows) {
    pageMap.set(row.page_path, (pageMap.get(row.page_path) ?? 0) + row.view_count);
  }
  const sorted = Array.from(pageMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxViews = sorted.length > 0 ? sorted[0][1] : 1;

  return (
    <DashboardCard
      title="Feature Usage"
      icon={BarChart3}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {sorted.length > 0 ? (
        <div className="space-y-2">
          {sorted.map(([path, views]) => (
            <div key={path}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-on-surface truncate max-w-[160px]">{path}</span>
                <span className="font-mono text-on-surface-variant">{views.toLocaleString()}</span>
              </div>
              <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(views / maxViews) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">No page view data recorded yet</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 4: Create TierDistributionCard**

```typescript
// packages/frontend/app/admin/components/cards/TierDistributionCard.tsx
'use client';

import { PieChart } from 'lucide-react';
import { DashboardCard } from '../shared/DashboardCard';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';

interface UserSnapshotRow {
  timestamp: string;
  tier_free: number;
  tier_starter: number;
  tier_pro: number;
  tier_enterprise: number;
}

interface TierDistributionCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

const TIER_COLORS: Record<string, string> = {
  Free: 'bg-zinc-400',
  Starter: 'bg-blue-500',
  Pro: 'bg-purple-500',
  Enterprise: 'bg-amber-500',
};

export function TierDistributionCard({ refreshTrigger, onClick }: TierDistributionCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<UserSnapshotRow>(
    'user-history',
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  const latest = rows.length > 0 ? rows[0] : null;

  const tiers = latest ? [
    { name: 'Free', count: latest.tier_free },
    { name: 'Starter', count: latest.tier_starter },
    { name: 'Pro', count: latest.tier_pro },
    { name: 'Enterprise', count: latest.tier_enterprise },
  ] : [];
  const total = tiers.reduce((acc, t) => acc + t.count, 0);

  return (
    <DashboardCard
      title="Tier Distribution"
      icon={PieChart}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {latest && total > 0 ? (
        <div className="space-y-2">
          {/* Stacked bar */}
          <div className="h-3 rounded-full overflow-hidden flex">
            {tiers.map((tier) => (
              tier.count > 0 && (
                <div
                  key={tier.name}
                  className={`h-full ${TIER_COLORS[tier.name]}`}
                  style={{ width: `${(tier.count / total) * 100}%` }}
                />
              )
            ))}
          </div>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {tiers.map((tier) => (
              <div key={tier.name} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${TIER_COLORS[tier.name]}`} />
                <span className="text-on-surface-variant">{tier.name}</span>
                <span className="font-mono text-on-surface ml-auto">{tier.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">No tier data recorded yet</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 5: Create FeedbackQueueCard**

```typescript
// packages/frontend/app/admin/components/cards/FeedbackQueueCard.tsx
'use client';

import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { fetchAPI } from '@/lib/data';
import { DashboardCard } from '../shared/DashboardCard';
import { StatusDot } from '../shared/StatusDot';

interface FeedbackItem {
  id: string;
  status: string;
  category: string;
  message: string;
  created_at: string;
}

interface FeedbackQueueCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
  resolved: 'success',
  in_progress: 'warning',
  open: 'info',
  new: 'info',
};

export function FeedbackQueueCard({ refreshTrigger, onClick }: FeedbackQueueCardProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAPI<{ data: FeedbackItem[] }>('/api/admin/feedback');
        if (!cancelled) setItems(res.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const openCount = items.filter(i => i.status !== 'resolved').length;

  return (
    <DashboardCard
      title="Feedback Queue"
      icon={MessageSquare}
      badge={{
        text: `${openCount} open`,
        color: openCount > 5 ? 'bg-amber-500/10 text-amber-700' : 'bg-surface-container text-on-surface-variant',
      }}
      loading={loading}
      error={error}
      onClick={onClick}
    >
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.slice(0, 3).map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-xs">
              <StatusDot variant={STATUS_VARIANT[item.status] ?? 'neutral'} />
              <span className="text-on-surface truncate flex-1">{item.message}</span>
              <span className="text-on-surface-variant shrink-0">{item.category}</span>
            </li>
          ))}
          {items.length > 3 && (
            <li className="text-xs text-on-surface-variant">+{items.length - 3} more</li>
          )}
        </ul>
      ) : (
        <p className="text-xs text-on-surface-variant">No feedback items</p>
      )}
    </DashboardCard>
  );
}
```

- [ ] **Step 6: Rewrite BusinessTab to use real cards**

```typescript
// packages/frontend/app/admin/components/tabs/BusinessTab.tsx
'use client';

import { UsersGrowthCard } from '../cards/UsersGrowthCard';
import { RevenueMrrCard } from '../cards/RevenueMrrCard';
import { FeatureUsageCard } from '../cards/FeatureUsageCard';
import { TierDistributionCard } from '../cards/TierDistributionCard';
import { FeedbackQueueCard } from '../cards/FeedbackQueueCard';

interface BusinessTabProps {
  refreshTrigger: number;
  onCardClick: (cardId: string) => void;
}

export function BusinessTab({ refreshTrigger, onCardClick }: BusinessTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <UsersGrowthCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('users-growth')} />
        <RevenueMrrCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('revenue-mrr')} />
        <FeatureUsageCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('feature-usage')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TierDistributionCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('tier-distribution')} />
        <FeedbackQueueCard refreshTrigger={refreshTrigger} onClick={() => onCardClick('feedback-queue')} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/app/admin/components/cards/UsersGrowthCard.tsx
git add packages/frontend/app/admin/components/cards/RevenueMrrCard.tsx
git add packages/frontend/app/admin/components/cards/FeatureUsageCard.tsx
git add packages/frontend/app/admin/components/cards/TierDistributionCard.tsx
git add packages/frontend/app/admin/components/cards/FeedbackQueueCard.tsx
git add packages/frontend/app/admin/components/tabs/BusinessTab.tsx
git commit -m "feat(admin-command-center): implement 5 business tab cards with real data"
```

---

### Task 5: Operations Tab — 5 Panels

Implement the detail panel content for each Operations card. Each panel shows expanded Recharts charts and data tables when the card is clicked.

**Files:**

- Modify: `packages/frontend/app/admin/components/panels/DataFeedsPanel.tsx`
- Modify: `packages/frontend/app/admin/components/panels/PipelineRunsPanel.tsx`
- Modify: `packages/frontend/app/admin/components/panels/ApiPerformancePanel.tsx`
- Modify: `packages/frontend/app/admin/components/panels/CachePerformancePanel.tsx`
- Modify: `packages/frontend/app/admin/components/panels/ActiveAlertsPanel.tsx`

- [ ] **Step 1: Implement DataFeedsPanel**

Freshness timeline per source with response time table.

```typescript
// packages/frontend/app/admin/components/panels/DataFeedsPanel.tsx
'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { StatusDot } from '../shared/StatusDot';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';
import type { TimeRange } from '../hooks/useTimeRange';

interface HealthRow {
  timestamp: string;
  source_name: string;
  available: boolean;
  fresh: boolean;
  days_since_update: number | null;
  response_time_ms: number | null;
}

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function DataFeedsPanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<HealthRow>(
    'health-history',
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const rows = data ?? [];

  // Build chart data: daily fresh source count
  const dailyMap = new Map<string, { date: string; fresh: number; total: number }>();
  for (const row of rows) {
    const day = row.timestamp.split('T')[0];
    if (!dailyMap.has(day)) dailyMap.set(day, { date: day, fresh: 0, total: 0 });
    const entry = dailyMap.get(day)!;
    entry.total++;
    if (row.fresh) entry.fresh++;
  }
  const chartData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Latest status per source
  const latestBySource = new Map<string, HealthRow>();
  for (const row of rows) {
    if (!latestBySource.has(row.source_name)) latestBySource.set(row.source_name, row);
  }

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-48 bg-surface-container rounded-xl" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Freshness chart */}
      {chartData.length > 1 && (
        <div>
          <h3 className="text-sm font-medium text-on-surface mb-3">Fresh Sources Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={formatDate} />
              <Area type="monotone" dataKey="fresh" fill="var(--color-primary)" fillOpacity={0.2} stroke="var(--color-primary)" strokeWidth={2} />
              <Area type="monotone" dataKey="total" fill="transparent" stroke="var(--color-outline)" strokeWidth={1} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Source detail table */}
      <div>
        <h3 className="text-sm font-medium text-on-surface mb-3">Source Status</h3>
        <div className="border border-outline-variant rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface-container">
              <tr>
                <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Source</th>
                <th className="text-center px-3 py-2 text-on-surface-variant font-medium">Status</th>
                <th className="text-center px-3 py-2 text-on-surface-variant font-medium">Fresh</th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Days Old</th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Response</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(latestBySource.entries()).map(([name, row]) => (
                <tr key={name} className="border-t border-outline-variant">
                  <td className="px-3 py-2 text-on-surface">{name}</td>
                  <td className="px-3 py-2 text-center"><StatusDot variant={row.available ? 'success' : 'error'} /></td>
                  <td className="px-3 py-2 text-center"><StatusDot variant={row.fresh ? 'success' : 'warning'} /></td>
                  <td className="px-3 py-2 text-right font-mono text-on-surface-variant">{row.days_since_update ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-on-surface-variant">{row.response_time_ms ? `${row.response_time_ms}ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement PipelineRunsPanel**

Full run history table with status and duration.

```typescript
// packages/frontend/app/admin/components/panels/PipelineRunsPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { fetchAPIRaw } from '@/lib/data';
import { StatusDot } from '../shared/StatusDot';
import type { TimeRange } from '../hooks/useTimeRange';

interface PipelineRun {
  pipeline_name: string;
  display_name?: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  records_processed?: number;
  records_inserted?: number;
  records_failed?: number;
  duration_ms?: number;
  error_message?: string;
}

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  success: 'success', partial: 'warning', failed: 'error', running: 'info',
};

function formatDuration(ms: number | undefined): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export function PipelineRunsPanel({ timeRange, refreshTrigger }: PanelProps) {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetchAPIRaw('/api/health/pipeline-runs');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.data ?? json.runs ?? [];
        if (!cancelled) setRuns(list);
      } catch {
        // silent — card already shows error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-48 bg-surface-container rounded-xl" /></div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-on-surface">Pipeline Run History</h3>
      {runs.length > 0 ? (
        <div className="border border-outline-variant rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface-container">
              <tr>
                <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Pipeline</th>
                <th className="text-center px-3 py-2 text-on-surface-variant font-medium">Status</th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Duration</th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Records</th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => (
                <tr key={`${run.pipeline_name}-${i}`} className="border-t border-outline-variant">
                  <td className="px-3 py-2 text-on-surface">{run.display_name ?? run.pipeline_name}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusDot variant={STATUS_VARIANT[run.status] ?? 'neutral'} pulse={run.status === 'running'} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-on-surface-variant">{formatDuration(run.duration_ms)}</td>
                  <td className="px-3 py-2 text-right font-mono text-on-surface-variant">
                    {run.records_processed?.toLocaleString() ?? '—'}
                    {(run.records_failed ?? 0) > 0 && <span className="text-red-500"> ({run.records_failed} err)</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-on-surface-variant">
                    {new Date(run.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant">No pipeline runs recorded</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Implement ApiPerformancePanel**

Latency line chart and per-endpoint breakdown table.

```typescript
// packages/frontend/app/admin/components/panels/ApiPerformancePanel.tsx
'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';
import type { TimeRange } from '../hooks/useTimeRange';

interface ApiMetricRow {
  timestamp: string;
  endpoint: string;
  p50_ms: number;
  p95_ms: number;
  request_count: number;
  error_count: number;
  error_rate: number;
}

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ApiPerformancePanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<ApiMetricRow>(
    'api-performance',
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const rows = data ?? [];

  // Aggregate chart data: overall latency over time
  const chartPoints = rows
    .slice(0, 100)
    .reverse()
    .map((r) => ({
      time: r.timestamp,
      p50: Math.round(r.p50_ms),
      p95: Math.round(r.p95_ms),
    }));

  // Aggregate per-endpoint
  const endpointMap = new Map<string, { requests: number; errors: number; p95Sum: number; count: number }>();
  for (const row of rows) {
    const entry = endpointMap.get(row.endpoint) ?? { requests: 0, errors: 0, p95Sum: 0, count: 0 };
    entry.requests += row.request_count;
    entry.errors += row.error_count;
    entry.p95Sum += row.p95_ms;
    entry.count++;
    endpointMap.set(row.endpoint, entry);
  }
  const endpoints = Array.from(endpointMap.entries())
    .map(([endpoint, stats]) => ({
      endpoint,
      requests: stats.requests,
      errors: stats.errors,
      errorRate: stats.requests > 0 ? (stats.errors / stats.requests) * 100 : 0,
      avgP95: stats.count > 0 ? stats.p95Sum / stats.count : 0,
    }))
    .sort((a, b) => b.requests - a.requests);

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-48 bg-surface-container rounded-xl" /></div>;
  }

  return (
    <div className="space-y-6">
      {chartPoints.length > 1 && (
        <div>
          <h3 className="text-sm font-medium text-on-surface mb-3">Latency Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartPoints}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="time" tickFormatter={(t) => formatDate(t)} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="ms" />
              <Tooltip labelFormatter={(t) => formatDate(t as string)} />
              <Legend />
              <Line type="monotone" dataKey="p50" stroke="var(--color-primary)" strokeWidth={2} dot={false} name="p50" />
              <Line type="monotone" dataKey="p95" stroke="#ef4444" strokeWidth={2} dot={false} name="p95" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {endpoints.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-on-surface mb-3">Per-Endpoint Breakdown</h3>
          <div className="border border-outline-variant rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-surface-container">
                <tr>
                  <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Endpoint</th>
                  <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Requests</th>
                  <th className="text-right px-3 py-2 text-on-surface-variant font-medium">p95 Avg</th>
                  <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Error %</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.slice(0, 15).map((ep) => (
                  <tr key={ep.endpoint} className="border-t border-outline-variant">
                    <td className="px-3 py-2 text-on-surface font-mono truncate max-w-[200px]">{ep.endpoint}</td>
                    <td className="px-3 py-2 text-right font-mono text-on-surface-variant">{ep.requests.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono text-on-surface-variant">{Math.round(ep.avgP95)}ms</td>
                    <td className={`px-3 py-2 text-right font-mono ${ep.errorRate > 5 ? 'text-red-500' : 'text-on-surface-variant'}`}>
                      {ep.errorRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length === 0 && <p className="text-sm text-on-surface-variant">No API metrics recorded yet</p>}
    </div>
  );
}
```

- [ ] **Step 4: Implement CachePerformancePanel**

Hit rate trend line chart + memory usage stats.

```typescript
// packages/frontend/app/admin/components/panels/CachePerformancePanel.tsx
'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';
import type { TimeRange } from '../hooks/useTimeRange';

interface CacheMetricRow {
  timestamp: string;
  hit_count: number;
  miss_count: number;
  hit_rate: number;
  eviction_count: number;
  memory_used_bytes: number;
  keys_count: number;
}

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function CachePerformancePanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<CacheMetricRow>(
    'cache-performance',
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const rows = data ?? [];
  const chartData = rows.slice(0, 100).reverse().map((r) => ({
    time: r.timestamp,
    hitRate: Math.round(r.hit_rate * 100),
    memory: r.memory_used_bytes,
    evictions: r.eviction_count,
  }));

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-48 bg-surface-container rounded-xl" /></div>;
  }

  return (
    <div className="space-y-6">
      {chartData.length > 1 && (
        <>
          <div>
            <h3 className="text-sm font-medium text-on-surface mb-3">Hit Rate Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="time" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip labelFormatter={(t) => formatDate(t as string)} />
                <Line type="monotone" dataKey="hitRate" stroke="var(--color-primary)" strokeWidth={2} dot={false} name="Hit Rate %" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="text-sm font-medium text-on-surface mb-3">Memory Usage</h3>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="time" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatBytes(v)} />
                <Tooltip labelFormatter={(t) => formatDate(t as string)} formatter={(v: number) => formatBytes(v)} />
                <Line type="monotone" dataKey="memory" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Memory" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Summary stats */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-surface-container rounded-xl p-3">
            <p className="text-lg font-medium text-on-surface">{rows[0].keys_count.toLocaleString()}</p>
            <p className="text-xs text-on-surface-variant">Total Keys</p>
          </div>
          <div className="bg-surface-container rounded-xl p-3">
            <p className="text-lg font-medium text-on-surface">{formatBytes(rows[0].memory_used_bytes)}</p>
            <p className="text-xs text-on-surface-variant">Memory Used</p>
          </div>
          <div className="bg-surface-container rounded-xl p-3">
            <p className="text-lg font-medium text-on-surface">{rows[0].eviction_count.toLocaleString()}</p>
            <p className="text-xs text-on-surface-variant">Evictions</p>
          </div>
        </div>
      )}

      {rows.length === 0 && <p className="text-sm text-on-surface-variant">No cache metrics recorded yet</p>}
    </div>
  );
}
```

- [ ] **Step 5: Implement ActiveAlertsPanel**

Full alert history with acknowledge/resolve actions.

```typescript
// packages/frontend/app/admin/components/panels/ActiveAlertsPanel.tsx
'use client';

import { useState } from 'react';
import { StatusDot } from '../shared/StatusDot';
import { useAdminAlerts, type Alert } from '../hooks/useAdminAlerts';
import type { TimeRange } from '../hooks/useTimeRange';

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

const SEVERITY_VARIANT: Record<string, 'error' | 'warning' | 'info'> = {
  critical: 'error',
  warning: 'warning',
  info: 'info',
};

export function ActiveAlertsPanel({ timeRange, refreshTrigger }: PanelProps) {
  const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('all');
  const { data: alerts, isLoading, acknowledge, resolve } = useAdminAlerts(filter, refreshTrigger);

  const list = alerts ?? [];

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-48 bg-surface-container rounded-xl" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2">
        {(['all', 'active', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              filter === f
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {list.length > 0 ? (
        <div className="space-y-2">
          {list.map((alert: Alert) => (
            <div key={alert.id} className="border border-outline-variant rounded-xl p-3">
              <div className="flex items-start gap-2">
                <StatusDot variant={SEVERITY_VARIANT[alert.severity] ?? 'info'} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface">{alert.message}</p>
                  <div className="flex gap-3 mt-1 text-xs text-on-surface-variant">
                    <span>{alert.source}</span>
                    <span>{new Date(alert.triggered_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    {alert.resolved_at && <span className="text-green-600">Resolved</span>}
                  </div>
                </div>
                {!alert.resolved_at && (
                  <div className="flex gap-1 shrink-0">
                    {!alert.acknowledged && (
                      <button
                        onClick={() => acknowledge.mutate(alert.id)}
                        className="px-2 py-1 text-xs rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant"
                      >
                        Ack
                      </button>
                    )}
                    <button
                      onClick={() => resolve.mutate(alert.id)}
                      className="px-2 py-1 text-xs rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-700"
                    >
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant text-center py-8">
          No {filter === 'all' ? '' : filter} alerts
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/admin/components/panels/DataFeedsPanel.tsx
git add packages/frontend/app/admin/components/panels/PipelineRunsPanel.tsx
git add packages/frontend/app/admin/components/panels/ApiPerformancePanel.tsx
git add packages/frontend/app/admin/components/panels/CachePerformancePanel.tsx
git add packages/frontend/app/admin/components/panels/ActiveAlertsPanel.tsx
git commit -m "feat(admin-command-center): implement 5 operations detail panels with charts and tables"
```

---

### Task 6: Data & Scores + Business Panels (10 panels)

These panels follow the same patterns established in Task 5. Each fetches from its admin-metrics endpoint and renders charts/tables.

**Files:**

- Modify: all 10 remaining panel stubs in `packages/frontend/app/admin/components/panels/`

- [ ] **Step 1: Implement ScoreHealthPanel**

```typescript
// packages/frontend/app/admin/components/panels/ScoreHealthPanel.tsx
'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';
import type { TimeRange } from '../hooks/useTimeRange';

interface ScoreSnapshotRow {
  timestamp: string;
  score_type: string;
  correlation_1y: number | null;
  hit_rate_1y: number | null;
  scores_validated: number;
}

interface PanelProps { timeRange: TimeRange; refreshTrigger: number; }

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ScoreHealthPanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<ScoreSnapshotRow>(
    'score-history',
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const rows = data ?? [];
  const chartData = rows.slice(0, 60).reverse().map((r) => ({
    time: r.timestamp,
    hitRate: r.hit_rate_1y ? Math.round(r.hit_rate_1y * 100) : null,
    correlation: r.correlation_1y ? Math.round(r.correlation_1y * 100) : null,
  }));

  if (isLoading) return <div className="animate-pulse"><div className="h-48 bg-surface-container rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      {chartData.length > 1 && (
        <div>
          <h3 className="text-sm font-medium text-on-surface mb-3">Score Validation Trends</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="time" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip labelFormatter={(t) => formatDate(t as string)} />
              <Legend />
              <Line type="monotone" dataKey="hitRate" stroke="var(--color-primary)" strokeWidth={2} dot={false} name="Hit Rate %" connectNulls />
              <Line type="monotone" dataKey="correlation" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Correlation %" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {rows.length === 0 && <p className="text-sm text-on-surface-variant">No score validation data yet</p>}
    </div>
  );
}
```

- [ ] **Step 2: Implement remaining 9 panels with consistent pattern**

Each of the remaining 9 panels follows the same template: fetch from the appropriate admin-metrics endpoint, render a chart and/or table. Create each file:

**MlOpsPanel.tsx** — Shows cache age per geography from `/api/scoring/cache-stats`. Table with geo level, cache count, last rebuild time.

**GeographicCoveragePanel.tsx** — Full coverage matrix from `/api/admin/metrics/coverage`. Table showing metric × geo level with count cells.

**DataQualityPanel.tsx** — Full issue list from health history. Table with source, issue type, severity, timestamp, and action columns.

**ScoreComputationPanel.tsx** — Per-score-type status from score history. Stacked bar chart (validated/pending/failed) + score type breakdown table.

**UsersGrowthPanel.tsx** — Signup trend area chart from user-history endpoint. Shows daily signups over time range.

**RevenueMrrPanel.tsx** — MRR trend line chart from user-history endpoint. Shows MRR over time + conversion rate trend.

**FeatureUsagePanel.tsx** — Full page analytics table from page-views endpoint. Sortable by views, visitors, bounce rate.

**TierDistributionPanel.tsx** — Tier counts over time from user-history endpoint. Stacked area chart showing tier composition.

**FeedbackQueuePanel.tsx** — Full feedback list from `/api/admin/feedback`. Filterable by status/category with status update buttons.

Each panel follows this template structure:

```typescript
// Template for all remaining panels
'use client';

import { useAdminTimeSeries } from '../hooks/useAdminTimeSeries';
import type { TimeRange } from '../hooks/useTimeRange';

interface PanelProps { timeRange: TimeRange; refreshTrigger: number; }

export function XxxPanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<RowType>(
    'endpoint-name',
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const rows = data ?? [];

  if (isLoading) return <div className="animate-pulse"><div className="h-48 bg-surface-container rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      {/* Chart section using Recharts ResponsiveContainer */}
      {/* Data table section */}
      {rows.length === 0 && <p className="text-sm text-on-surface-variant">No data recorded yet</p>}
    </div>
  );
}
```

Implement each panel with its specific data types, chart configuration, and table columns as described above. Use the exact endpoint names from the Backend Endpoints table. Use `ResponsiveContainer` height 200-240px for charts. Use the same table styling pattern from DataFeedsPanel (border-outline-variant, rounded-xl, bg-surface-container header).

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/components/panels/
git commit -m "feat(admin-command-center): implement 10 data/scores and business detail panels"
```

---

### Task 7: E2E Tests — Cards Render + Panel Interactions

Verify that cards render with real data and panels open/close correctly.

**Files:**

- Create: `packages/frontend/tests/e2e/admin-command-center.spec.ts`

- [ ] **Step 1: Write E2E test file**

Requires a running backend at localhost:3001 and frontend at localhost:3000. Tests against real data (no mocks).

```typescript
// packages/frontend/tests/e2e/admin-command-center.spec.ts
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

test.describe("Admin Command Center", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin page (assumes test user is logged in or admin auth is bypassed for testing)
    await page.goto(`${BASE_URL}/admin`);
    // Wait for hero stats to load
    await page.waitForSelector('[data-testid="hero-stats-row"]', {
      timeout: 15000,
    });
  });

  test("hero stats row renders 5 cards", async ({ page }) => {
    const heroCards = page.locator('[data-testid="hero-stats-row"] > div');
    await expect(heroCards).toHaveCount(5);
  });

  test("tab bar shows 3 tabs and switches content", async ({ page }) => {
    // Default tab should be Operations
    await expect(page.locator("text=Data Feeds")).toBeVisible();

    // Click Data & Scores tab
    await page.click('button:has-text("Data & Scores")');
    await expect(page.locator("text=Score Health")).toBeVisible();

    // Click Business tab
    await page.click('button:has-text("Business")');
    await expect(page.locator("text=Users & Growth")).toBeVisible();
  });

  test("operations tab renders 5 data-driven cards", async ({ page }) => {
    // Operations tab should show card titles (not placeholder text)
    await expect(page.locator("text=Data Feeds")).toBeVisible();
    await expect(page.locator("text=Pipeline Runs")).toBeVisible();
    await expect(page.locator("text=API Performance")).toBeVisible();
    await expect(page.locator("text=Cache Performance")).toBeVisible();
    await expect(page.locator("text=Active Alerts")).toBeVisible();

    // Cards should NOT contain "Card content — Plan 3" placeholder
    const placeholders = page.locator("text=Card content — Plan 3");
    await expect(placeholders).toHaveCount(0);
  });

  test("clicking a card opens the detail panel", async ({ page }) => {
    // Click the Data Feeds card
    await page.click("text=Data Feeds");

    // Panel should slide in with the correct title
    await expect(page.locator("text=Data Feeds Details")).toBeVisible({
      timeout: 5000,
    });

    // Panel should have a close button
    const closeButton = page.locator('[aria-label="Close panel"]');
    await expect(closeButton).toBeVisible();

    // Close the panel
    await closeButton.click();
    await expect(page.locator("text=Data Feeds Details")).not.toBeVisible({
      timeout: 2000,
    });
  });

  test("detail panel shows time range selector", async ({ page }) => {
    await page.click("text=API Performance");
    await expect(page.locator("text=API Performance Details")).toBeVisible({
      timeout: 5000,
    });

    // Time range selector should be present
    await expect(page.locator('button:has-text("7d")')).toBeVisible();
    await expect(page.locator('button:has-text("30d")')).toBeVisible();
  });

  test("business tab cards render real data or empty states", async ({
    page,
  }) => {
    await page.click('button:has-text("Business")');

    // Each card should render (either with data or empty state — no crashes)
    await expect(page.locator("text=Users & Growth")).toBeVisible();
    await expect(page.locator("text=Revenue / MRR")).toBeVisible();
    await expect(page.locator("text=Feature Usage")).toBeVisible();
    await expect(page.locator("text=Tier Distribution")).toBeVisible();
    await expect(page.locator("text=Feedback Queue")).toBeVisible();
  });

  test("data & scores tab cards render real data or empty states", async ({
    page,
  }) => {
    await page.click('button:has-text("Data & Scores")');

    await expect(page.locator("text=Score Health")).toBeVisible();
    await expect(page.locator("text=ML Ops")).toBeVisible();
    await expect(page.locator("text=Geographic Coverage")).toBeVisible();
    await expect(page.locator("text=Data Quality")).toBeVisible();
    await expect(page.locator("text=Score Computation")).toBeVisible();
  });

  test("refresh button triggers data reload", async ({ page }) => {
    const refreshButton = page.locator('button:has-text("Refresh")');
    await expect(refreshButton).toBeVisible();

    // Click refresh — page should not crash
    await refreshButton.click();
    // Brief wait for refetch
    await page.waitForTimeout(1000);
    // Cards should still be visible
    await expect(page.locator("text=Data Feeds")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the E2E tests**

```bash
cd packages/frontend && npx playwright test tests/e2e/admin-command-center.spec.ts --reporter=list
```

Expected: All tests pass (or fail with clear data-related reasons that can be addressed). Any failures should be investigated against real API responses.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/tests/e2e/admin-command-center.spec.ts
git commit -m "test(admin-command-center): add E2E tests for card rendering and panel interactions"
```

---

### Task 8: Cleanup — Remove Old Placeholder Code and Widget Duplicates

After all cards are wired, remove the old widget components that are superseded.

**Files:**

- Modify: `packages/frontend/app/admin/page.tsx` (remove any leftover widget imports if present)
- Verify: No remaining references to `PlaceholderCard` in the tabs

- [ ] **Step 1: Verify no PlaceholderCard references remain**

Search for `PlaceholderCard` across the admin directory. Should return 0 results after Tasks 2-4.

```bash
grep -rn "PlaceholderCard" packages/frontend/app/admin/
```

Expected: No output. If any remain, remove them.

- [ ] **Step 2: Verify build passes**

```bash
cd packages/frontend && npx tsc --noEmit
cd packages/backend && npx nest build
```

Both should complete with zero errors.

- [ ] **Step 3: Final commit**

```bash
git add -A packages/frontend/app/admin/
git commit -m "chore(admin-command-center): cleanup placeholder code and verify build"
```

---

## Parallelism Guide

Tasks 2, 3, and 4 (Operations cards, Data & Scores cards, Business cards) are fully independent and can run in **parallel** via separate agents.

Task 1 (PanelContentRouter) must complete before Tasks 5 and 6 (panels), since panels are lazy-imported by the router.

Task 5 and 6 (panels) can run in parallel with each other.

Task 7 (E2E tests) depends on all cards and panels being wired.

```
Task 1 (router) ──┬── Task 5 (ops panels) ──┐
                   ├── Task 6 (other panels) ─┤
Task 2 (ops cards) ──────────────────────────┤
Task 3 (data cards) ─────────────────────────┼── Task 7 (E2E) → Task 8 (cleanup)
Task 4 (biz cards) ──────────────────────────┘
```
