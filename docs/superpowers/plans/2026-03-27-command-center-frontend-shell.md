# Command Center v2 — Frontend Shell + Shared Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared frontend components, data hooks, and layout shell for the redesigned command center — hero stats row, tabbed sections, detail slide-out panel, and reusable chart/status components.

**Architecture:** Extend the existing `/admin` page with a hero stats row + 3-tab layout. Shared components in `admin/components/shared/` follow existing M3 patterns (WidgetShell, RightDetailPanel). Data fetched via new hooks using `fetchAPIWithParams` from `lib/data/fetchers/base.ts` + React Query v5.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS 4 (M3 tokens), Recharts, TanStack React Query v5, Lucide React icons

**Spec:** `docs/superpowers/specs/2026-03-27-command-center-grafana-redesign.md`
**Depends on:** Plan 1 (Backend Metrics Services) — all `/api/admin/metrics/*` endpoints must be live

**Related Plans:**

- Plan 1: Backend Metrics Services (COMPLETE)
- Plan 3: Cards + Panels (depends on this)

---

## Existing Patterns to Follow

| Pattern           | Source File                                                    | Key Details                                                                                           |
| ----------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Widget card shell | `admin/components/widgets/WidgetShell.tsx`                     | title, icon, href, loading, error props; `bg-surface-container-low border-outline-variant rounded-xl` |
| Slide-out panel   | `app/map/components/RightDetailPanel/RightDetailPanel.tsx`     | Fixed right, scrim on mobile, sticky header, `overflow-y-auto` body                                   |
| Tabs              | `admin/ai-models/components/EvaluationDashboard.tsx`           | Custom buttons in `bg-surface-container rounded-full p-1`, active: `bg-primary text-on-primary`       |
| Recharts + M3     | `admin/analytics/components/acquisition/ChannelTrendChart.tsx` | `ResponsiveContainer`, M3 CSS vars for grid/axis/tooltip, `dot={false}` for lines                     |
| Data fetcher      | `lib/data/fetchers/base.ts`                                    | `fetchAPIWithParams<T>(endpoint, params)` with retry + auth headers                                   |
| React Query hook  | `lib/data/hooks/useScoreData.ts`                               | `useQuery({ queryKey, queryFn, enabled, staleTime })` pattern                                         |
| M3 tokens         | `app/globals.css`                                              | `bg-surface`, `text-on-surface`, `border-outline-variant`, `bg-primary`, etc.                         |

---

## File Structure

```
packages/frontend/app/admin/
  page.tsx                              # REWRITE: hero stats + tabs + panel
  components/
    hero/
      HeroStatsRow.tsx                  # Row of 5 hero stat cards
      HeroStatCard.tsx                  # Single hero stat with sparkline
    tabs/
      TabBar.tsx                        # Reusable tab bar component
      OperationsTab.tsx                 # Placeholder grid for 5 ops cards
      DataScoresTab.tsx                 # Placeholder grid for 5 data cards
      BusinessTab.tsx                   # Placeholder grid for 5 business cards
    shared/
      DashboardCard.tsx                 # Clickable card shell (extends WidgetShell pattern)
      DetailPanel.tsx                   # Slide-out panel shell with time range
      SparklineChart.tsx                # Tiny SVG line chart
      TimeRangeSelector.tsx             # 1h/24h/7d/30d/90d/6m/1y/Custom toggle
      StatusDot.tsx                     # Green/amber/red dot indicator
      FreshnessBar.tsx                  # Horizontal freshness bar
      AlertItem.tsx                     # Single alert row
    hooks/
      useAdminDashboardRefresh.ts       # EXISTING — keep as-is
      useHeroStats.ts                   # Fetch hero stat values
      useAdminTimeSeries.ts             # Generic time-series query hook
      useAdminAlerts.ts                 # Active alerts hook
      useDetailPanel.ts                 # Panel open/close state
      useTimeRange.ts                   # Time range state + date calc
```

---

### Task 1: Create Data Hooks

**Files:**

- Create: `packages/frontend/app/admin/components/hooks/useHeroStats.ts`
- Create: `packages/frontend/app/admin/components/hooks/useAdminTimeSeries.ts`
- Create: `packages/frontend/app/admin/components/hooks/useAdminAlerts.ts`
- Create: `packages/frontend/app/admin/components/hooks/useDetailPanel.ts`
- Create: `packages/frontend/app/admin/components/hooks/useTimeRange.ts`

- [ ] **Step 1: Create useHeroStats hook**

```typescript
// packages/frontend/app/admin/components/hooks/useHeroStats.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/data/fetchers/base";

export interface HeroStats {
  system_health: { uptime_pct: number; sparkline: number[] };
  active_alerts: {
    count: number;
    critical: number;
    warning: number;
    sparkline: number[];
  };
  data_freshness: { fresh: number; total: number; sparkline: number[] };
  total_users: { count: number; new_this_week: number; sparkline: number[] };
  score_health: { hit_rate_1y: number; sparkline: number[] };
}

interface HeroStatsResponse {
  success: boolean;
  data: HeroStats;
}

export function useHeroStats(refreshTrigger: number) {
  return useQuery({
    queryKey: ["admin", "hero-stats", refreshTrigger],
    queryFn: () => fetchAPI<HeroStatsResponse>("/api/admin/metrics/hero-stats"),
    staleTime: 2 * 60 * 1000, // 2 minutes
    select: (res) => res.data,
  });
}
```

- [ ] **Step 2: Create useAdminTimeSeries hook**

```typescript
// packages/frontend/app/admin/components/hooks/useAdminTimeSeries.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAPIWithParams } from "@/lib/data/fetchers/base";

interface TimeSeriesResponse<T = any> {
  success: boolean;
  data: T[];
}

export function useAdminTimeSeries<T = any>(
  endpoint: string,
  params?: Record<string, string | undefined>,
  options?: { enabled?: boolean; refreshTrigger?: number },
) {
  const cleanParams: Record<string, string> = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) cleanParams[k] = v;
    }
  }

  return useQuery({
    queryKey: [
      "admin",
      "timeseries",
      endpoint,
      cleanParams,
      options?.refreshTrigger,
    ],
    queryFn: () =>
      fetchAPIWithParams<TimeSeriesResponse<T>>(
        `/api/admin/metrics/${endpoint}`,
        cleanParams,
      ),
    enabled: options?.enabled !== false,
    staleTime: 2 * 60 * 1000,
    select: (res) => res.data,
  });
}
```

- [ ] **Step 3: Create useAdminAlerts hook**

```typescript
// packages/frontend/app/admin/components/hooks/useAdminAlerts.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAPIWithParams, fetchAPIRaw } from "@/lib/data/fetchers/base";
import { getAuthHeaders } from "@/lib/data/fetchers/base";

export interface Alert {
  id: string;
  alert_type: string;
  severity: "critical" | "warning" | "info";
  message: string;
  source: string;
  triggered_at: string;
  resolved_at: string | null;
  acknowledged: boolean;
  metadata: Record<string, unknown>;
}

interface AlertsResponse {
  success: boolean;
  data: Alert[];
}

export function useAdminAlerts(
  status: "active" | "resolved" | "all" = "active",
  refreshTrigger?: number,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin", "alerts", status, refreshTrigger],
    queryFn: () =>
      fetchAPIWithParams<AlertsResponse>("/api/admin/metrics/alerts", {
        status,
      }),
    staleTime: 60 * 1000, // 1 minute for alerts
    select: (res) => res.data,
  });

  const acknowledge = useMutation({
    mutationFn: async (alertId: string) => {
      const headers = await getAuthHeaders();
      await fetchAPIRaw(`/api/admin/metrics/alerts/${alertId}/acknowledge`, {
        method: "POST",
        headers,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "alerts"] }),
  });

  const resolve = useMutation({
    mutationFn: async (alertId: string) => {
      const headers = await getAuthHeaders();
      await fetchAPIRaw(`/api/admin/metrics/alerts/${alertId}/resolve`, {
        method: "POST",
        headers,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "alerts"] }),
  });

  return { ...query, acknowledge, resolve };
}
```

NOTE: Check if `getAuthHeaders` is exported from `base.ts`. If not, look for the actual auth header utility and adjust the import. The mutations may need to use a different fetch pattern — adapt to whatever auth pattern exists.

- [ ] **Step 4: Create useDetailPanel hook**

```typescript
// packages/frontend/app/admin/components/hooks/useDetailPanel.ts
"use client";

import { useState, useCallback } from "react";

export type PanelCardId = string; // e.g., 'data-feeds', 'api-performance'

export function useDetailPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCard, setActiveCard] = useState<PanelCardId | null>(null);

  const openPanel = useCallback((cardId: PanelCardId) => {
    setActiveCard(cardId);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    // Delay clearing card to allow close animation
    setTimeout(() => setActiveCard(null), 400);
  }, []);

  return { isOpen, activeCard, openPanel, closePanel };
}
```

- [ ] **Step 5: Create useTimeRange hook**

```typescript
// packages/frontend/app/admin/components/hooks/useTimeRange.ts
"use client";

import { useState, useMemo } from "react";

export type TimeRangeKey =
  | "1h"
  | "24h"
  | "7d"
  | "30d"
  | "90d"
  | "6m"
  | "1y"
  | "custom";

export interface TimeRange {
  key: TimeRangeKey;
  from: string; // ISO string
  to: string; // ISO string
}

function calcFrom(key: TimeRangeKey): string {
  const now = Date.now();
  const ms: Record<string, number> = {
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
    "6m": 180 * 24 * 60 * 60 * 1000,
    "1y": 365 * 24 * 60 * 60 * 1000,
  };
  return new Date(now - (ms[key] || ms["7d"])).toISOString();
}

export function useTimeRange(defaultKey: TimeRangeKey = "7d") {
  const [key, setKey] = useState<TimeRangeKey>(defaultKey);
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);

  const range = useMemo<TimeRange>(() => {
    if (key === "custom" && customFrom && customTo) {
      return { key, from: customFrom, to: customTo };
    }
    return { key, from: calcFrom(key), to: new Date().toISOString() };
  }, [key, customFrom, customTo]);

  const setRange = (newKey: TimeRangeKey) => setKey(newKey);

  const setCustomRange = (from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);
    setKey("custom");
  };

  return { range, setRange, setCustomRange };
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/admin/components/hooks/
git commit -m "feat(admin-metrics): add frontend data hooks for command center"
```

---

### Task 2: Create Shared UI Components

**Files:**

- Create: `packages/frontend/app/admin/components/shared/SparklineChart.tsx`
- Create: `packages/frontend/app/admin/components/shared/StatusDot.tsx`
- Create: `packages/frontend/app/admin/components/shared/FreshnessBar.tsx`
- Create: `packages/frontend/app/admin/components/shared/AlertItem.tsx`
- Create: `packages/frontend/app/admin/components/shared/TimeRangeSelector.tsx`

- [ ] **Step 1: Create SparklineChart**

A tiny inline SVG line chart used in hero stats and card summaries. Takes an array of numbers, renders as a smooth polyline.

```typescript
// packages/frontend/app/admin/components/shared/SparklineChart.tsx
'use client';

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;    // CSS color string, defaults to 'var(--color-primary)'
  className?: string;
}

export function SparklineChart({
  data,
  width = 100,
  height = 24,
  color = 'var(--color-primary)',
  className,
}: SparklineChartProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = padding + ((max - val) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
    </svg>
  );
}
```

- [ ] **Step 2: Create StatusDot**

```typescript
// packages/frontend/app/admin/components/shared/StatusDot.tsx

type StatusDotVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const VARIANT_COLORS: Record<StatusDotVariant, string> = {
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-on-surface-variant/40',
};

interface StatusDotProps {
  variant: StatusDotVariant;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

export function StatusDot({ variant, pulse, size = 'sm' }: StatusDotProps) {
  const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  return (
    <span
      className={`inline-block rounded-full ${sizeClass} ${VARIANT_COLORS[variant]} ${
        pulse ? 'animate-pulse' : ''
      }`}
    />
  );
}
```

- [ ] **Step 3: Create FreshnessBar**

```typescript
// packages/frontend/app/admin/components/shared/FreshnessBar.tsx

interface FreshnessBarProps {
  daysSinceUpdate: number;
  expectedDays: number; // threshold for "fresh"
  label?: string;
}

export function FreshnessBar({ daysSinceUpdate, expectedDays, label }: FreshnessBarProps) {
  const ratio = Math.min(daysSinceUpdate / (expectedDays * 2), 1); // max at 2x expected
  const color =
    daysSinceUpdate <= expectedDays
      ? 'bg-green-500'
      : daysSinceUpdate <= expectedDays * 1.5
        ? 'bg-amber-500'
        : 'bg-red-500';

  const statusText =
    daysSinceUpdate <= expectedDays
      ? 'Fresh'
      : `${daysSinceUpdate}d stale`;

  return (
    <div className="flex items-center gap-2 text-xs">
      {label && (
        <span className="text-on-surface-variant w-20 truncate">{label}</span>
      )}
      <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(ratio * 100, 8)}%` }}
        />
      </div>
      <span className={`w-16 text-right ${daysSinceUpdate <= expectedDays ? 'text-green-600' : 'text-red-500'}`}>
        {statusText}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Create AlertItem**

```typescript
// packages/frontend/app/admin/components/shared/AlertItem.tsx

import { StatusDot } from './StatusDot';

interface AlertItemProps {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  triggeredAt: string;
  acknowledged?: boolean;
}

export function AlertItem({ severity, message, triggeredAt, acknowledged }: AlertItemProps) {
  const severityVariant = severity === 'critical' ? 'error' : severity === 'warning' ? 'warning' : 'info';
  const timeAgo = formatTimeAgo(triggeredAt);

  return (
    <div className="flex items-center gap-2 py-1.5">
      <StatusDot variant={severityVariant} pulse={severity === 'critical' && !acknowledged} />
      <span className="flex-1 text-xs text-on-surface truncate">{message}</span>
      <span className="text-xs text-on-surface-variant whitespace-nowrap">{timeAgo}</span>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 5: Create TimeRangeSelector**

```typescript
// packages/frontend/app/admin/components/shared/TimeRangeSelector.tsx
'use client';

import { TimeRangeKey } from '../hooks/useTimeRange';

const RANGE_OPTIONS: { key: TimeRangeKey; label: string }[] = [
  { key: '1h', label: '1h' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '6m', label: '6m' },
  { key: '1y', label: '1y' },
  { key: 'custom', label: 'Custom' },
];

interface TimeRangeSelectorProps {
  value: TimeRangeKey;
  onChange: (key: TimeRangeKey) => void;
  onCustomRange?: (from: string, to: string) => void;
}

export function TimeRangeSelector({ value, onChange, onCustomRange }: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-0.5 bg-surface-container rounded-full p-0.5">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => {
            if (opt.key === 'custom' && onCustomRange) {
              // For now, prompt with default range — custom date picker is a future enhancement
              onChange(opt.key);
            } else {
              onChange(opt.key);
            }
          }}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
            value === opt.key
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/admin/components/shared/
git commit -m "feat(admin-metrics): add shared UI components for command center"
```

---

### Task 3: Create DashboardCard Component

Extends the existing WidgetShell pattern but adds: click-to-open-panel, status badge, and no "View all" link (replaced by click handler).

**Files:**

- Create: `packages/frontend/app/admin/components/shared/DashboardCard.tsx`

- [ ] **Step 1: Create DashboardCard**

```typescript
// packages/frontend/app/admin/components/shared/DashboardCard.tsx
'use client';

import { type LucideIcon } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  icon: LucideIcon;
  badge?: { text: string; color: string }; // e.g., { text: '8/9 Available', color: 'text-green-600 bg-green-500/10' }
  loading?: boolean;
  error?: string | null;
  onClick?: () => void;
  children: React.ReactNode;
}

export function DashboardCard({
  title,
  icon: Icon,
  badge,
  loading,
  error,
  onClick,
  children,
}: DashboardCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-surface-container-low border border-outline-variant rounded-xl
        ${onClick ? 'cursor-pointer hover:border-primary/40 hover:shadow-md transition-all duration-200' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-on-surface-variant" />
          <h3 className="text-sm font-medium text-on-surface">{title}</h3>
        </div>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pb-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 bg-surface-container rounded animate-pulse w-3/4" />
            <div className="h-3 bg-surface-container rounded animate-pulse w-1/2" />
            <div className="h-16 bg-surface-container rounded animate-pulse" />
          </div>
        ) : error ? (
          <div className="text-xs text-error bg-error-container/30 rounded-lg px-3 py-2">
            {error}
          </div>
        ) : (
          children
        )}
      </div>

      {/* Footer hint */}
      {onClick && !loading && !error && (
        <div className="px-4 pb-3 pt-0">
          <span className="text-xs text-on-surface-variant/60">Click for details</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/admin/components/shared/DashboardCard.tsx
git commit -m "feat(admin-metrics): add DashboardCard component with click-to-expand"
```

---

### Task 4: Create HeroStatCard + HeroStatsRow

**Files:**

- Create: `packages/frontend/app/admin/components/hero/HeroStatCard.tsx`
- Create: `packages/frontend/app/admin/components/hero/HeroStatsRow.tsx`

- [ ] **Step 1: Create HeroStatCard**

```typescript
// packages/frontend/app/admin/components/hero/HeroStatCard.tsx
'use client';

import { SparklineChart } from '../shared/SparklineChart';

interface HeroStatCardProps {
  label: string;
  value: string;
  subtitle: string;
  sparkline: number[];
  color: string;           // CSS color for sparkline and value, e.g., '#22c55e'
  borderAlert?: boolean;   // Show warning border (e.g., when alerts > 0)
}

export function HeroStatCard({
  label,
  value,
  subtitle,
  sparkline,
  color,
  borderAlert,
}: HeroStatCardProps) {
  return (
    <div
      className={`
        flex-1 bg-surface-container-low rounded-xl px-4 py-3 text-center
        border ${borderAlert ? 'border-amber-500/30' : 'border-outline-variant'}
      `}
    >
      <div className="text-xs text-on-surface-variant uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className="text-2xl font-bold mb-0.5" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-on-surface-variant/60 mb-1">{subtitle}</div>
      {sparkline.length > 1 && (
        <SparklineChart data={sparkline} color={color} width={120} height={20} className="mx-auto" />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create HeroStatsRow**

```typescript
// packages/frontend/app/admin/components/hero/HeroStatsRow.tsx
'use client';

import { HeroStatCard } from './HeroStatCard';
import { useHeroStats, type HeroStats } from '../hooks/useHeroStats';

interface HeroStatsRowProps {
  refreshTrigger: number;
}

export function HeroStatsRow({ refreshTrigger }: HeroStatsRowProps) {
  const { data: stats, isLoading } = useHeroStats(refreshTrigger);

  if (isLoading || !stats) {
    return (
      <div className="flex gap-3 mb-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 bg-surface-container-low rounded-xl px-4 py-3 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  const { system_health, active_alerts, data_freshness, total_users, score_health } = stats;

  return (
    <div className="flex gap-3 mb-5">
      <HeroStatCard
        label="System Health"
        value={`${system_health.uptime_pct.toFixed(1)}%`}
        subtitle="Uptime (30d)"
        sparkline={system_health.sparkline}
        color="#22c55e"
      />
      <HeroStatCard
        label="Active Alerts"
        value={String(active_alerts.count)}
        subtitle={`${active_alerts.critical} critical, ${active_alerts.warning} warn`}
        sparkline={active_alerts.sparkline}
        color={active_alerts.count > 0 ? '#f59e0b' : '#22c55e'}
        borderAlert={active_alerts.count > 0}
      />
      <HeroStatCard
        label="Data Freshness"
        value={`${data_freshness.fresh}/${data_freshness.total}`}
        subtitle="Sources fresh"
        sparkline={data_freshness.sparkline}
        color={data_freshness.fresh === data_freshness.total ? '#22c55e' : '#ef4444'}
      />
      <HeroStatCard
        label="Total Users"
        value={String(total_users.count)}
        subtitle={`+${total_users.new_this_week} this week`}
        sparkline={total_users.sparkline}
        color="#a78bfa"
      />
      <HeroStatCard
        label="Score Health"
        value={`${(score_health.hit_rate_1y * 100).toFixed(1)}%`}
        subtitle="1Y Hit Rate"
        sparkline={score_health.sparkline}
        color="#3b82f6"
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/admin/components/hero/
git commit -m "feat(admin-metrics): add HeroStatCard and HeroStatsRow components"
```

---

### Task 5: Create DetailPanel Component

The slide-out panel that opens when clicking a dashboard card. Follows the existing RightDetailPanel pattern.

**Files:**

- Create: `packages/frontend/app/admin/components/shared/DetailPanel.tsx`

- [ ] **Step 1: Create DetailPanel**

```typescript
// packages/frontend/app/admin/components/shared/DetailPanel.tsx
'use client';

import { X } from 'lucide-react';
import { TimeRangeSelector } from './TimeRangeSelector';
import { type TimeRangeKey } from '../hooks/useTimeRange';

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  timeRangeKey?: TimeRangeKey;
  onTimeRangeChange?: (key: TimeRangeKey) => void;
  children: React.ReactNode;
}

export function DetailPanel({
  isOpen,
  onClose,
  title,
  timeRangeKey,
  onTimeRangeChange,
  children,
}: DetailPanelProps) {
  return (
    <>
      {/* Scrim overlay (mobile + desktop) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-on-surface/40 z-40"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={`
          fixed inset-y-0 right-0 z-50
          w-full sm:w-[480px]
          bg-surface-container-low border-l border-outline-variant
          flex flex-col
          transform transition-transform duration-400 ease-[cubic-bezier(0.2,0,0,1)]
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant sticky top-0 bg-surface-container-low z-10">
          <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
          <div className="flex items-center gap-3">
            {timeRangeKey && onTimeRangeChange && (
              <TimeRangeSelector value={timeRangeKey} onChange={onTimeRangeChange} />
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {children}
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/admin/components/shared/DetailPanel.tsx
git commit -m "feat(admin-metrics): add DetailPanel slide-out component"
```

---

### Task 6: Create TabBar + Tab Content Placeholders

**Files:**

- Create: `packages/frontend/app/admin/components/tabs/TabBar.tsx`
- Create: `packages/frontend/app/admin/components/tabs/OperationsTab.tsx`
- Create: `packages/frontend/app/admin/components/tabs/DataScoresTab.tsx`
- Create: `packages/frontend/app/admin/components/tabs/BusinessTab.tsx`

- [ ] **Step 1: Create TabBar**

```typescript
// packages/frontend/app/admin/components/tabs/TabBar.tsx
'use client';

export type AdminTab = 'operations' | 'data-scores' | 'business';

interface TabBarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'operations', label: 'Operations' },
  { key: 'data-scores', label: 'Data & Scores' },
  { key: 'business', label: 'Business' },
];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex gap-0 mb-4 border-b-2 border-outline-variant/30">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`
            px-5 py-2.5 text-sm font-medium transition-colors duration-200
            ${activeTab === tab.key
              ? 'text-on-surface border-b-2 border-primary -mb-[2px]'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create OperationsTab placeholder**

```typescript
// packages/frontend/app/admin/components/tabs/OperationsTab.tsx
'use client';

import { PanelCardId } from '../hooks/useDetailPanel';

interface OperationsTabProps {
  refreshTrigger: number;
  onCardClick: (cardId: PanelCardId) => void;
}

export function OperationsTab({ refreshTrigger, onCardClick }: OperationsTabProps) {
  return (
    <>
      {/* Row 1: 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        <PlaceholderCard title="Data Feeds" onClick={() => onCardClick('data-feeds')} />
        <PlaceholderCard title="Pipeline Runs" onClick={() => onCardClick('pipeline-runs')} />
        <PlaceholderCard title="API Performance" onClick={() => onCardClick('api-performance')} />
      </div>
      {/* Row 2: 2 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlaceholderCard title="Cache Performance" onClick={() => onCardClick('cache-performance')} />
        <PlaceholderCard title="Active Alerts" onClick={() => onCardClick('active-alerts')} />
      </div>
    </>
  );
}

function PlaceholderCard({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-surface-container-low border border-outline-variant rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
    >
      <h3 className="text-sm font-medium text-on-surface mb-2">{title}</h3>
      <div className="h-16 bg-surface-container rounded-lg flex items-center justify-center text-xs text-on-surface-variant">
        Card content — Plan 3
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create DataScoresTab placeholder** (same pattern, cards: Score Health, ML Ops, Geographic Coverage, Data Quality, Score Computation)

- [ ] **Step 4: Create BusinessTab placeholder** (same pattern, cards: Users & Growth, Revenue / MRR, Feature Usage, Tier Distribution, Feedback Queue)

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/admin/components/tabs/
git commit -m "feat(admin-metrics): add TabBar and tab placeholder components"
```

---

### Task 7: Rewrite Admin Page with New Layout

Replace the existing 6-widget grid with the new hero stats + tabs + detail panel layout.

**Files:**

- Modify: `packages/frontend/app/admin/page.tsx`

- [ ] **Step 1: Read the current page.tsx to understand what exists**

- [ ] **Step 2: Rewrite page.tsx with new layout**

The new page should:

1. Import and render `HeroStatsRow` at the top
2. Import and render `TabBar` with state management
3. Conditionally render `OperationsTab`, `DataScoresTab`, or `BusinessTab`
4. Import and render `DetailPanel` with state from `useDetailPanel`
5. Keep the existing `useAdminDashboardRefresh` hook for auto-refresh
6. Keep the existing header (title, subtitle, refresh button, last update time)
7. Pass `refreshTrigger` down to hero stats and tabs

Structure:

```tsx
"use client";

export default function AdminPage() {
  const { refreshTrigger, lastRefresh, refresh } = useAdminDashboardRefresh();
  const [activeTab, setActiveTab] = useState<AdminTab>("operations");
  const { isOpen, activeCard, openPanel, closePanel } = useDetailPanel();
  const { range, setRange } = useTimeRange();

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="p-6 pb-0 flex justify-between items-start">
        <div>
          <h1>Command Center</h1>
          <p>Live overview of all PropertyIQ systems</p>
        </div>
        <div className="flex items-center gap-3">
          <span>Last updated: {formatTimeAgo(lastRefresh)}</span>
          <button onClick={refresh}>Refresh</button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="px-6 pt-4">
        <HeroStatsRow refreshTrigger={refreshTrigger} />
      </div>

      {/* Tabs */}
      <div className="px-6">
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === "operations" && (
          <OperationsTab
            refreshTrigger={refreshTrigger}
            onCardClick={openPanel}
          />
        )}
        {activeTab === "data-scores" && (
          <DataScoresTab
            refreshTrigger={refreshTrigger}
            onCardClick={openPanel}
          />
        )}
        {activeTab === "business" && (
          <BusinessTab
            refreshTrigger={refreshTrigger}
            onCardClick={openPanel}
          />
        )}
      </div>

      {/* Detail Panel */}
      <DetailPanel
        isOpen={isOpen}
        onClose={closePanel}
        title={getPanelTitle(activeCard)}
        timeRangeKey={range.key}
        onTimeRangeChange={setRange}
      >
        <div className="text-sm text-on-surface-variant">
          Panel content for {activeCard} — will be populated in Plan 3
        </div>
      </DetailPanel>
    </div>
  );
}
```

- [ ] **Step 3: Verify the page renders** — start the frontend dev server (`npm run dev` in packages/frontend) and check `http://localhost:3000/admin`

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/admin/page.tsx
git commit -m "feat(admin-metrics): rewrite admin page with hero stats + tabs + detail panel layout"
```

---

### Task 8: E2E Verification — Visual + Functional

Verify the redesigned command center works end-to-end in the browser against the real backend.

- [ ] **Step 1: Start both servers**

```bash
# Terminal 1: Backend
cd packages/backend && npm run start:dev

# Terminal 2: Frontend
cd packages/frontend && npm run dev
```

- [ ] **Step 2: Navigate to http://localhost:3000/admin and verify:**

1. **Hero stats row** renders 5 cards with values and sparklines
2. **Tab bar** shows 3 tabs (Operations, Data & Scores, Business) — Operations active by default
3. **Tab switching** works — clicking each tab swaps the content
4. **Placeholder cards** render in each tab with correct titles
5. **Card click** opens the slide-out detail panel from the right
6. **Detail panel** shows title, time range selector, close button
7. **Time range selector** toggles work (buttons highlight correctly)
8. **Panel close** — clicking X or scrim closes the panel
9. **Refresh button** — clicking triggers data refetch, "Last updated" resets
10. **Mobile responsive** — resize browser to check hero stats stack and tabs scroll

- [ ] **Step 3: Fix any rendering issues**

Common issues:

- Missing `'use client'` directive on interactive components
- Import path errors (check casing on Windows)
- M3 token variables not resolving (verify globals.css is loaded)
- Hero stats returning `undefined` if backend isn't running

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(admin-metrics): resolve rendering issues found in visual verification"
```

---

### Task 9: E2E Integration Tests with Playwright (Real Backend + Real Data)

Automated Playwright tests that verify the command center renders correctly with live data from the real backend and database. No mocks.

**Files:**

- Create: `packages/frontend/e2e/admin-command-center.spec.ts`

- [ ] **Step 1: Check existing Playwright setup**

Look at `packages/frontend/playwright.config.ts` and any existing `e2e/` tests to understand the setup (base URL, auth helpers, test patterns).

- [ ] **Step 2: Create the E2E test file**

```typescript
// packages/frontend/e2e/admin-command-center.spec.ts

import { test, expect } from "@playwright/test";

// Assumes backend running on 3001, frontend on 3000
// Assumes admin user exists and can log in

test.describe("Command Center v2", () => {
  test.beforeEach(async ({ page }) => {
    // Log in as admin — adapt to your actual auth flow
    // Check existing e2e tests for the login pattern
    await page.goto("/admin");
    // If redirected to login, handle auth first
  });

  test("hero stats row renders 5 cards with real data", async ({ page }) => {
    await page.goto("/admin");

    // Wait for hero stats to load (not skeleton)
    await page.waitForSelector('[data-testid="hero-stats-row"]', {
      timeout: 10000,
    });

    // Verify 5 hero stat cards exist
    const heroCards = page.locator('[data-testid="hero-stat-card"]');
    await expect(heroCards).toHaveCount(5);

    // Verify System Health shows a percentage (real data)
    const healthCard = heroCards.first();
    const healthValue = healthCard.locator('[data-testid="hero-stat-value"]');
    await expect(healthValue).toContainText("%");

    // Verify Total Users shows a number > 0 (real data exists)
    const usersCard = heroCards.nth(3);
    const usersValue = usersCard.locator('[data-testid="hero-stat-value"]');
    const usersText = await usersValue.textContent();
    expect(parseInt(usersText || "0", 10)).toBeGreaterThanOrEqual(0);
  });

  test("tab bar switches between 3 tabs", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForSelector('[data-testid="hero-stats-row"]');

    // Operations tab is active by default
    const opsTab = page.locator('button:has-text("Operations")');
    await expect(opsTab).toHaveClass(/border-primary/);

    // Click Data & Scores tab
    await page.click('button:has-text("Data & Scores")');
    const dsTab = page.locator('button:has-text("Data & Scores")');
    await expect(dsTab).toHaveClass(/border-primary/);

    // Verify Operations tab is no longer active
    await expect(opsTab).not.toHaveClass(/border-primary/);

    // Click Business tab
    await page.click('button:has-text("Business")');
    const bizTab = page.locator('button:has-text("Business")');
    await expect(bizTab).toHaveClass(/border-primary/);
  });

  test("Operations tab shows 5 cards", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForSelector('[data-testid="hero-stats-row"]');

    // Should show Data Feeds, Pipeline Runs, API Performance, Cache Performance, Active Alerts
    await expect(page.locator("text=Data Feeds")).toBeVisible();
    await expect(page.locator("text=Pipeline Runs")).toBeVisible();
    await expect(page.locator("text=API Performance")).toBeVisible();
    await expect(page.locator("text=Cache Performance")).toBeVisible();
    await expect(page.locator("text=Active Alerts")).toBeVisible();
  });

  test("clicking a card opens the detail panel", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForSelector('[data-testid="hero-stats-row"]');

    // Click the first card
    await page.click("text=Data Feeds");

    // Detail panel should slide in
    const panel = page.locator('[data-testid="detail-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Panel should have a title
    await expect(panel.locator("h2")).toContainText("Data Feeds");

    // Panel should have time range selector
    await expect(panel.locator("text=7d")).toBeVisible();

    // Panel should have close button
    const closeBtn = panel.locator("button").first();
    await expect(closeBtn).toBeVisible();
  });

  test("detail panel closes on X click and scrim click", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForSelector('[data-testid="hero-stats-row"]');

    // Open panel
    await page.click("text=Data Feeds");
    const panel = page.locator('[data-testid="detail-panel"]');
    await expect(panel).toBeVisible();

    // Close via X button
    await panel.locator("button:has(svg)").first().click();
    await expect(panel).not.toBeVisible({ timeout: 2000 });

    // Open again
    await page.click("text=Data Feeds");
    await expect(panel).toBeVisible();

    // Close via scrim
    await page.locator('[data-testid="detail-panel-scrim"]').click();
    await expect(panel).not.toBeVisible({ timeout: 2000 });
  });

  test("time range selector toggles active state", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForSelector('[data-testid="hero-stats-row"]');

    // Open panel
    await page.click("text=Data Feeds");
    const panel = page.locator('[data-testid="detail-panel"]');
    await expect(panel).toBeVisible();

    // Default should be 7d
    const btn7d = panel.locator('button:has-text("7d")');
    await expect(btn7d).toHaveClass(/bg-primary/);

    // Click 30d
    await panel.locator('button:has-text("30d")').click();
    const btn30d = panel.locator('button:has-text("30d")');
    await expect(btn30d).toHaveClass(/bg-primary/);
    await expect(btn7d).not.toHaveClass(/bg-primary/);
  });

  test("hero stats fetch real data from backend API", async ({ page }) => {
    // Intercept the API call to verify it hits the real backend
    const apiResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/admin/metrics/hero-stats") &&
        resp.status() === 200,
    );

    await page.goto("/admin");

    const response = await apiResponse;
    const json = await response.json();

    // Verify real data structure
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty("system_health");
    expect(json.data).toHaveProperty("active_alerts");
    expect(json.data).toHaveProperty("data_freshness");
    expect(json.data).toHaveProperty("total_users");
    expect(json.data).toHaveProperty("score_health");

    // Verify sparklines are populated arrays
    expect(Array.isArray(json.data.system_health.sparkline)).toBe(true);
  });

  test("refresh button triggers new data fetch", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForSelector('[data-testid="hero-stats-row"]');

    // Click refresh and wait for API call
    const apiResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/admin/metrics/hero-stats") &&
        resp.status() === 200,
    );

    await page.click('[data-testid="refresh-button"]');
    const response = await apiResponse;
    expect(response.status()).toBe(200);
  });
});
```

NOTE: The test file uses `data-testid` attributes. The implementer MUST add these to the components:

- `data-testid="hero-stats-row"` on HeroStatsRow container div
- `data-testid="hero-stat-card"` on each HeroStatCard
- `data-testid="hero-stat-value"` on the value div in HeroStatCard
- `data-testid="detail-panel"` on the DetailPanel aside
- `data-testid="detail-panel-scrim"` on the scrim div
- `data-testid="refresh-button"` on the refresh button

- [ ] **Step 3: Add data-testid attributes to components**

Add the testid attributes listed above to HeroStatsRow, HeroStatCard, DetailPanel, and the page refresh button. These are small edits — one attribute per component.

- [ ] **Step 4: Run the E2E tests**

Both backend and frontend must be running:

```bash
# Start backend (port 3001)
cd packages/backend && npm run start:dev &

# Start frontend (port 3000)
cd packages/frontend && npm run dev &

# Run Playwright tests
cd packages/frontend && npx playwright test e2e/admin-command-center.spec.ts --headed
```

- [ ] **Step 5: Fix failures and re-run until all green**

Common issues:

- Auth flow differs from expected — adapt `beforeEach` login
- Selectors don't match — use Playwright's `codegen` to inspect actual DOM
- Timing — add `waitForSelector` or `waitForResponse` where needed
- Backend not running — verify port 3001 is responding

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/e2e/admin-command-center.spec.ts
git add -A  # Include data-testid additions
git commit -m "test(admin-metrics): add Playwright E2E tests for command center against real backend"
```

---

## Notes for Plan 3 (Cards + Panels)

The placeholder cards in each tab will be replaced with actual implementations:

- Each card gets its own component file in `admin/components/cards/`
- Each panel gets its own component file in `admin/components/panels/`
- Cards use `DashboardCard` shell + Recharts for inline charts
- Panels use `DetailPanel` shell + full Recharts charts + data tables
- The `page.tsx` will map `activeCard` to the correct panel content component
