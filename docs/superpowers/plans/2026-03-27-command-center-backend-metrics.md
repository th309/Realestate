# Command Center v2 — Backend Metrics Services

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the database tables and NestJS backend services that record time-series admin metrics, evaluate alert thresholds, and expose query endpoints for the redesigned command center frontend.

**Architecture:** New `AdminMetricsModule` in `packages/backend/src/admin-metrics/` following existing NestJS patterns. Supabase tables store snapshots at various intervals. An NestJS interceptor collects API timing data. An alert evaluation service checks thresholds after each snapshot. All new endpoints are admin-guarded and accept `?from=&to=` time range params.

**Tech Stack:** NestJS 11, Supabase (PostgreSQL), ioredis (reading stats only), class-validator, @nestjs/schedule (cron)

**Spec:** `docs/superpowers/specs/2026-03-27-command-center-grafana-redesign.md`

**Related Plans:**

- Plan 2: Frontend Shell + Shared Components (depends on this)
- Plan 3: Frontend Cards + Panels (depends on this + Plan 2)

---

## File Structure

```
packages/backend/src/admin-metrics/
  admin-metrics.module.ts           # Module registration
  admin-metrics.controller.ts       # API endpoints (GET /api/admin/metrics/*)
  admin-metrics.types.ts            # Shared types and interfaces
  dto/
    query-metrics.dto.ts            # Time range query params DTO
    alert-action.dto.ts             # Acknowledge/resolve alert DTO
  services/
    snapshot-recorder.service.ts    # Writes health/cache/score/user snapshots
    api-metrics-buffer.service.ts   # In-memory buffer for API timings
    alert-evaluation.service.ts     # Threshold checking, alert creation/resolution
    metrics-query.service.ts        # Read queries for frontend (all GET endpoints)
    metrics-cleanup.service.ts      # Retention cleanup cron
  interceptors/
    api-metrics.interceptor.ts      # Request timing interceptor
```

---

### Task 1: Create Supabase Migration for Admin Metrics Tables

**Files:**

- Create: `packages/backend/supabase/migrations/20260327_create_admin_metrics_tables.sql`

- [ ] **Step 1: Create the migration SQL file**

```sql
-- Admin Metrics Tables for Command Center v2
-- Records time-series snapshots for dashboard visualizations

-- Data source health snapshots (every 5 min)
CREATE TABLE IF NOT EXISTS admin_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  source_name text NOT NULL,
  available boolean NOT NULL DEFAULT false,
  fresh boolean NOT NULL DEFAULT false,
  days_since_update integer,
  response_time_ms integer,
  error_message text
);

CREATE INDEX idx_admin_health_snapshots_timestamp ON admin_health_snapshots (timestamp DESC);
CREATE INDEX idx_admin_health_snapshots_source ON admin_health_snapshots (source_name, timestamp DESC);

-- API performance metrics (every 1 min, aggregated)
CREATE TABLE IF NOT EXISTS admin_api_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  p50_ms real NOT NULL DEFAULT 0,
  p95_ms real NOT NULL DEFAULT 0,
  p99_ms real NOT NULL DEFAULT 0,
  request_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  error_rate real NOT NULL DEFAULT 0
);

CREATE INDEX idx_admin_api_metrics_timestamp ON admin_api_metrics (timestamp DESC);
CREATE INDEX idx_admin_api_metrics_endpoint ON admin_api_metrics (endpoint, timestamp DESC);

-- Redis cache metrics (every 5 min)
CREATE TABLE IF NOT EXISTS admin_cache_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  hit_count integer NOT NULL DEFAULT 0,
  miss_count integer NOT NULL DEFAULT 0,
  hit_rate real NOT NULL DEFAULT 0,
  eviction_count integer NOT NULL DEFAULT 0,
  memory_used_bytes bigint NOT NULL DEFAULT 0,
  keys_count integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_admin_cache_metrics_timestamp ON admin_cache_metrics (timestamp DESC);

-- Alert events
CREATE TABLE IF NOT EXISTS admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  message text NOT NULL,
  source text NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  acknowledged boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_admin_alerts_active ON admin_alerts (triggered_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX idx_admin_alerts_severity ON admin_alerts (severity, triggered_at DESC);

-- Score validation snapshots (daily)
CREATE TABLE IF NOT EXISTS admin_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  score_type text NOT NULL,
  correlation_1y real,
  hit_rate_1y real,
  scores_validated integer NOT NULL DEFAULT 0,
  scores_pending integer NOT NULL DEFAULT 0,
  scores_failed integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_admin_score_snapshots_timestamp ON admin_score_snapshots (timestamp DESC);
CREATE INDEX idx_admin_score_snapshots_type ON admin_score_snapshots (score_type, timestamp DESC);

-- User & billing snapshots (daily)
CREATE TABLE IF NOT EXISTS admin_user_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  total_users integer NOT NULL DEFAULT 0,
  new_signups integer NOT NULL DEFAULT 0,
  active_trials integer NOT NULL DEFAULT 0,
  expiring_soon integer NOT NULL DEFAULT 0,
  tier_free integer NOT NULL DEFAULT 0,
  tier_starter integer NOT NULL DEFAULT 0,
  tier_pro integer NOT NULL DEFAULT 0,
  tier_enterprise integer NOT NULL DEFAULT 0,
  paywall_views integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  mrr_cents integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_admin_user_snapshots_timestamp ON admin_user_snapshots (timestamp DESC);

-- Page view analytics (daily rollup)
CREATE TABLE IF NOT EXISTS admin_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  page_path text NOT NULL,
  view_count integer NOT NULL DEFAULT 0,
  unique_visitors integer NOT NULL DEFAULT 0,
  avg_session_duration_ms integer NOT NULL DEFAULT 0,
  bounce_rate real NOT NULL DEFAULT 0
);

CREATE INDEX idx_admin_page_views_timestamp ON admin_page_views (timestamp DESC);
CREATE INDEX idx_admin_page_views_path ON admin_page_views (page_path, timestamp DESC);

-- Permissions (admin-only via service_role key, no RLS)
GRANT ALL ON admin_health_snapshots TO service_role;
GRANT ALL ON admin_api_metrics TO service_role;
GRANT ALL ON admin_cache_metrics TO service_role;
GRANT ALL ON admin_alerts TO service_role;
GRANT ALL ON admin_score_snapshots TO service_role;
GRANT ALL ON admin_user_snapshots TO service_role;
GRANT ALL ON admin_page_views TO service_role;

GRANT ALL ON admin_health_snapshots TO authenticated;
GRANT ALL ON admin_api_metrics TO authenticated;
GRANT ALL ON admin_cache_metrics TO authenticated;
GRANT ALL ON admin_alerts TO authenticated;
GRANT ALL ON admin_score_snapshots TO authenticated;
GRANT ALL ON admin_user_snapshots TO authenticated;
GRANT ALL ON admin_page_views TO authenticated;
```

- [ ] **Step 2: Run the migration against Supabase**

Run the SQL via the Supabase dashboard SQL editor or CLI. Verify all 7 tables are created:

```bash
# Verify tables exist (run in Supabase SQL editor)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'admin_%'
ORDER BY table_name;
```

Expected: 7 rows — `admin_alerts`, `admin_api_metrics`, `admin_cache_metrics`, `admin_health_snapshots`, `admin_page_views`, `admin_score_snapshots`, `admin_user_snapshots`.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/supabase/migrations/20260327_create_admin_metrics_tables.sql
git commit -m "feat(admin-metrics): add Supabase migration for 7 admin metrics tables"
```

---

### Task 2: Create Types and DTOs

**Files:**

- Create: `packages/backend/src/admin-metrics/admin-metrics.types.ts`
- Create: `packages/backend/src/admin-metrics/dto/query-metrics.dto.ts`
- Create: `packages/backend/src/admin-metrics/dto/alert-action.dto.ts`

- [ ] **Step 1: Create shared types**

```typescript
// packages/backend/src/admin-metrics/admin-metrics.types.ts

export interface HealthSnapshot {
  id: string;
  timestamp: string;
  source_name: string;
  available: boolean;
  fresh: boolean;
  days_since_update: number | null;
  response_time_ms: number | null;
  error_message: string | null;
}

export interface ApiMetricRow {
  id: string;
  timestamp: string;
  endpoint: string;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  request_count: number;
  error_count: number;
  error_rate: number;
}

export interface CacheMetricRow {
  id: string;
  timestamp: string;
  hit_count: number;
  miss_count: number;
  hit_rate: number;
  eviction_count: number;
  memory_used_bytes: number;
  keys_count: number;
}

export interface AlertRow {
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

export interface ScoreSnapshot {
  id: string;
  timestamp: string;
  score_type: string;
  correlation_1y: number | null;
  hit_rate_1y: number | null;
  scores_validated: number;
  scores_pending: number;
  scores_failed: number;
}

export interface UserSnapshot {
  id: string;
  timestamp: string;
  total_users: number;
  new_signups: number;
  active_trials: number;
  expiring_soon: number;
  tier_free: number;
  tier_starter: number;
  tier_pro: number;
  tier_enterprise: number;
  paywall_views: number;
  conversions: number;
  mrr_cents: number;
}

export interface PageViewRow {
  id: string;
  timestamp: string;
  page_path: string;
  view_count: number;
  unique_visitors: number;
  avg_session_duration_ms: number;
  bounce_rate: number;
}

// In-memory buffer entry for API metrics interceptor
export interface ApiTimingEntry {
  endpoint: string;
  duration_ms: number;
  status_code: number;
  timestamp: number;
}

// Hero stats response shape
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

// Alert threshold config
export interface AlertThreshold {
  alert_type: string;
  severity: "critical" | "warning" | "info";
  source: string;
  condition: (value: number) => boolean;
  message: (value: number) => string;
}
```

- [ ] **Step 2: Create query metrics DTO**

```typescript
// packages/backend/src/admin-metrics/dto/query-metrics.dto.ts

import { IsOptional, IsString, IsISO8601 } from "class-validator";

export class QueryMetricsDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsString()
  source_name?: string;

  @IsOptional()
  @IsString()
  score_type?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
```

- [ ] **Step 3: Create alert action DTO**

```typescript
// packages/backend/src/admin-metrics/dto/alert-action.dto.ts

import { IsUUID } from "class-validator";

export class AlertActionParamsDto {
  @IsUUID()
  id: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/admin-metrics/admin-metrics.types.ts
git add packages/backend/src/admin-metrics/dto/query-metrics.dto.ts
git add packages/backend/src/admin-metrics/dto/alert-action.dto.ts
git commit -m "feat(admin-metrics): add types and DTOs for admin metrics module"
```

---

### Task 3: Build SnapshotRecorderService

Records health, cache, score, and user snapshots to Supabase on a timer.

**Files:**

- Create: `packages/backend/src/admin-metrics/services/snapshot-recorder.service.ts`

- [ ] **Step 1: Create the snapshot recorder service**

```typescript
// packages/backend/src/admin-metrics/services/snapshot-recorder.service.ts

import { Injectable, Inject, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.constants";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class SnapshotRecorderService {
  private readonly logger = new Logger(SnapshotRecorderService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Record data source health snapshots every 5 minutes.
   * Queries the existing /api/health/data-sources logic internally.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async recordHealthSnapshots(): Promise<void> {
    try {
      // Query the same data_source_registry + freshness tables the health controller uses
      const { data: sources, error } = await this.supabase
        .from("data_source_registry")
        .select(
          "source_name, display_name, source_type, expected_freshness_days, check_endpoint",
        );

      if (error || !sources) {
        this.logger.warn(
          "Failed to query data_source_registry",
          error?.message,
        );
        return;
      }

      const snapshots = [];
      for (const source of sources) {
        const freshness = await this.getSourceFreshness(source.source_name);
        snapshots.push({
          source_name: source.source_name,
          available: freshness.available,
          fresh:
            freshness.daysSinceUpdate <= (source.expected_freshness_days || 30),
          days_since_update: freshness.daysSinceUpdate,
          response_time_ms: freshness.responseTimeMs,
          error_message: freshness.error || null,
        });
      }

      if (snapshots.length > 0) {
        const { error: insertError } = await this.supabase
          .from("admin_health_snapshots")
          .insert(snapshots);

        if (insertError) {
          this.logger.error(
            "Failed to insert health snapshots",
            insertError.message,
          );
        }
      }
    } catch (err) {
      this.logger.error("recordHealthSnapshots failed", err);
    }
  }

  /**
   * Record Redis cache metrics every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async recordCacheSnapshots(): Promise<void> {
    try {
      const stats = this.redisService.getStats();
      const redisClient = (this.redisService as any).client;

      let memoryUsed = 0;
      let keysCount = 0;

      if (redisClient && typeof redisClient.info === "function") {
        try {
          const info = await redisClient.info("memory");
          const memMatch = info.match(/used_memory:(\d+)/);
          if (memMatch) memoryUsed = parseInt(memMatch[1], 10);

          const keyspaceInfo = await redisClient.info("keyspace");
          const keysMatch = keyspaceInfo.match(/keys=(\d+)/);
          if (keysMatch) keysCount = parseInt(keysMatch[1], 10);
        } catch {
          // Redis may not be available — graceful degradation
        }
      }

      const { error } = await this.supabase.from("admin_cache_metrics").insert({
        hit_count: stats.hits,
        miss_count: stats.misses,
        hit_rate: stats.hitRate,
        eviction_count: 0, // Redis doesn't expose this easily; track via info stats
        memory_used_bytes: memoryUsed,
        keys_count: keysCount,
      });

      if (error) {
        this.logger.error("Failed to insert cache snapshot", error.message);
      }
    } catch (err) {
      this.logger.error("recordCacheSnapshots failed", err);
    }
  }

  /**
   * Record user/billing snapshots daily at midnight UTC.
   */
  @Cron("0 0 * * *")
  async recordUserSnapshots(): Promise<void> {
    try {
      // Total users
      const { count: totalUsers } = await this.supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // New signups today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: newSignups } = await this.supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today.toISOString());

      // Trial stats
      const { count: activeTrials } = await this.supabase
        .from("user_trials")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const { count: expiringSoon } = await this.supabase
        .from("user_trials")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .lte("expires_at", sevenDaysFromNow.toISOString());

      // Tier distribution
      const { data: tiers } = await this.supabase
        .from("user_entitlements")
        .select("tier_slug");

      const tierCounts = { free: 0, starter: 0, pro: 0, enterprise: 0 };
      if (tiers) {
        for (const row of tiers) {
          const slug = row.tier_slug?.toLowerCase() || "free";
          if (slug in tierCounts) tierCounts[slug as keyof typeof tierCounts]++;
        }
      }

      // Paywall stats (last 24h)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const { data: paywallData } = await this.supabase
        .from("paywall_events")
        .select("event_type")
        .gte("created_at", yesterday.toISOString());

      let paywallViews = 0;
      let conversions = 0;
      if (paywallData) {
        for (const ev of paywallData) {
          if (ev.event_type === "view") paywallViews++;
          if (ev.event_type === "conversion") conversions++;
        }
      }

      const { error } = await this.supabase
        .from("admin_user_snapshots")
        .insert({
          total_users: totalUsers || 0,
          new_signups: newSignups || 0,
          active_trials: activeTrials || 0,
          expiring_soon: expiringSoon || 0,
          tier_free: tierCounts.free,
          tier_starter: tierCounts.starter,
          tier_pro: tierCounts.pro,
          tier_enterprise: tierCounts.enterprise,
          paywall_views: paywallViews,
          conversions,
          mrr_cents: 0, // Placeholder until Stripe integration
        });

      if (error) {
        this.logger.error("Failed to insert user snapshot", error.message);
      }
    } catch (err) {
      this.logger.error("recordUserSnapshots failed", err);
    }
  }

  /**
   * Record score validation snapshots daily at 1 AM UTC.
   */
  @Cron("0 1 * * *")
  async recordScoreSnapshots(): Promise<void> {
    try {
      const scoreTypes = ["homeready", "investor_edge", "market_health"];

      for (const scoreType of scoreTypes) {
        const { data } = await this.supabase
          .from("score_validation_results")
          .select("correlation_1y, hit_rate_1y")
          .eq("score_type", scoreType)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const { count: validated } = await this.supabase
          .from("propertyiq_scores")
          .select("*", { count: "exact", head: true })
          .eq("score_type", scoreType)
          .not("validated_at", "is", null);

        const { count: pending } = await this.supabase
          .from("propertyiq_scores")
          .select("*", { count: "exact", head: true })
          .eq("score_type", scoreType)
          .is("validated_at", null);

        await this.supabase.from("admin_score_snapshots").insert({
          score_type: scoreType,
          correlation_1y: data?.correlation_1y || null,
          hit_rate_1y: data?.hit_rate_1y || null,
          scores_validated: validated || 0,
          scores_pending: pending || 0,
          scores_failed: 0,
        });
      }
    } catch (err) {
      this.logger.error("recordScoreSnapshots failed", err);
    }
  }

  /**
   * Helper: get freshness info for a single data source.
   */
  private async getSourceFreshness(sourceName: string): Promise<{
    available: boolean;
    daysSinceUpdate: number;
    responseTimeMs: number;
    error: string | null;
  }> {
    const start = Date.now();
    try {
      // Find the most recent record for this source across its tables
      const tableMap: Record<string, string> = {
        zillow: "zillow_metro",
        realtor: "realtor_metro",
        census_acs: "census_acs_metro",
        bls: "bls_metro",
        fred: "fred_national",
        hud_fmr: "hud_fmr_county",
        building_permits: "building_permits_metro",
        redfin_sales: "redfin_metro_sales",
        redfin_rental: "redfin_metro_rental",
      };

      const table = tableMap[sourceName];
      if (!table) {
        return {
          available: false,
          daysSinceUpdate: 999,
          responseTimeMs: Date.now() - start,
          error: `Unknown source: ${sourceName}`,
        };
      }

      const { data, error } = await this.supabase
        .from(table)
        .select("period_date")
        .order("period_date", { ascending: false })
        .limit(1)
        .single();

      const responseTimeMs = Date.now() - start;

      if (error || !data) {
        return {
          available: false,
          daysSinceUpdate: 999,
          responseTimeMs,
          error: error?.message || "No data",
        };
      }

      const lastDate = new Date(data.period_date);
      const daysSinceUpdate = Math.floor(
        (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      return { available: true, daysSinceUpdate, responseTimeMs, error: null };
    } catch (err) {
      return {
        available: false,
        daysSinceUpdate: 999,
        responseTimeMs: Date.now() - start,
        error: String(err),
      };
    }
  }
}
```

- [ ] **Step 2: Verify the service compiles**

```bash
cd packages/backend && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors in `admin-metrics/` files.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/admin-metrics/services/snapshot-recorder.service.ts
git commit -m "feat(admin-metrics): add SnapshotRecorderService for health, cache, user, score snapshots"
```

---

### Task 4: Build ApiMetricsBufferService + Interceptor

Collects per-request timings in-memory and flushes 1-minute aggregates to Supabase.

**Files:**

- Create: `packages/backend/src/admin-metrics/services/api-metrics-buffer.service.ts`
- Create: `packages/backend/src/admin-metrics/interceptors/api-metrics.interceptor.ts`

- [ ] **Step 1: Create the buffer service**

```typescript
// packages/backend/src/admin-metrics/services/api-metrics-buffer.service.ts

import { Injectable, Inject, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.constants";
import { ApiTimingEntry } from "../admin-metrics.types";

@Injectable()
export class ApiMetricsBufferService {
  private readonly logger = new Logger(ApiMetricsBufferService.name);
  private buffer: ApiTimingEntry[] = [];

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Record a single request timing. Called by the interceptor.
   */
  record(entry: ApiTimingEntry): void {
    this.buffer.push(entry);
  }

  /**
   * Flush aggregated metrics to Supabase every minute.
   */
  @Cron("*/1 * * * *")
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    // Swap buffer atomically
    const entries = this.buffer;
    this.buffer = [];

    try {
      // Group by endpoint
      const grouped = new Map<string, number[]>();
      const errorCounts = new Map<string, number>();

      for (const entry of entries) {
        // Normalize endpoint: strip query params and IDs
        const endpoint = this.normalizeEndpoint(entry.endpoint);

        if (!grouped.has(endpoint)) {
          grouped.set(endpoint, []);
          errorCounts.set(endpoint, 0);
        }
        grouped.get(endpoint)!.push(entry.duration_ms);

        if (entry.status_code >= 400) {
          errorCounts.set(endpoint, (errorCounts.get(endpoint) || 0) + 1);
        }
      }

      // Calculate percentiles and insert
      const rows = [];
      for (const [endpoint, durations] of grouped) {
        durations.sort((a, b) => a - b);
        const count = durations.length;
        const errors = errorCounts.get(endpoint) || 0;

        rows.push({
          endpoint,
          p50_ms: this.percentile(durations, 0.5),
          p95_ms: this.percentile(durations, 0.95),
          p99_ms: this.percentile(durations, 0.99),
          request_count: count,
          error_count: errors,
          error_rate: count > 0 ? errors / count : 0,
        });
      }

      if (rows.length > 0) {
        const { error } = await this.supabase
          .from("admin_api_metrics")
          .insert(rows);

        if (error) {
          this.logger.error("Failed to flush API metrics", error.message);
        }
      }
    } catch (err) {
      this.logger.error("API metrics flush failed", err);
    }
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  private normalizeEndpoint(path: string): string {
    // Remove query string
    const base = path.split("?")[0];
    // Replace UUIDs and numeric IDs with :id
    return base
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "/:id",
      )
      .replace(/\/\d{5,}/g, "/:id")
      .replace(/\/\d+/g, "/:id");
  }
}
```

- [ ] **Step 2: Create the interceptor**

```typescript
// packages/backend/src/admin-metrics/interceptors/api-metrics.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { ApiMetricsBufferService } from "../services/api-metrics-buffer.service";

@Injectable()
export class ApiMetricsInterceptor implements NestInterceptor {
  constructor(private readonly buffer: ApiMetricsBufferService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.buffer.record({
            endpoint: request.url,
            duration_ms: Date.now() - start,
            status_code: response.statusCode,
            timestamp: start,
          });
        },
        error: () => {
          this.buffer.record({
            endpoint: request.url,
            duration_ms: Date.now() - start,
            status_code: response.statusCode || 500,
            timestamp: start,
          });
        },
      }),
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/admin-metrics/services/api-metrics-buffer.service.ts
git add packages/backend/src/admin-metrics/interceptors/api-metrics.interceptor.ts
git commit -m "feat(admin-metrics): add API metrics buffer service and timing interceptor"
```

---

### Task 5: Build AlertEvaluationService

Checks thresholds after snapshots and creates/resolves alerts in the `admin_alerts` table.

**Files:**

- Create: `packages/backend/src/admin-metrics/services/alert-evaluation.service.ts`

- [ ] **Step 1: Create the alert evaluation service**

```typescript
// packages/backend/src/admin-metrics/services/alert-evaluation.service.ts

import { Injectable, Inject, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.constants";

interface ThresholdRule {
  alert_type: string;
  severity: "critical" | "warning";
  source: string;
  check: () => Promise<{
    triggered: boolean;
    message: string;
    metadata?: Record<string, unknown>;
  }>;
}

@Injectable()
export class AlertEvaluationService {
  private readonly logger = new Logger(AlertEvaluationService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Evaluate all threshold rules every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluateThresholds(): Promise<void> {
    const rules = this.getThresholdRules();

    for (const rule of rules) {
      try {
        const result = await rule.check();

        if (result.triggered) {
          await this.ensureAlertExists(
            rule.alert_type,
            rule.severity,
            rule.source,
            result.message,
            result.metadata,
          );
        } else {
          await this.autoResolveAlert(rule.alert_type);
        }
      } catch (err) {
        this.logger.error(`Alert check failed for ${rule.alert_type}`, err);
      }
    }
  }

  private getThresholdRules(): ThresholdRule[] {
    return [
      {
        alert_type: "data_source_stale",
        severity: "warning",
        source: "health_check",
        check: async () => {
          const { data } = await this.supabase
            .from("admin_health_snapshots")
            .select("source_name, days_since_update, fresh")
            .order("timestamp", { ascending: false })
            .limit(20);

          // Get latest per source
          const latest = new Map<string, { days: number; fresh: boolean }>();
          if (data) {
            for (const row of data) {
              if (!latest.has(row.source_name)) {
                latest.set(row.source_name, {
                  days: row.days_since_update || 0,
                  fresh: row.fresh,
                });
              }
            }
          }

          const staleSources = [];
          for (const [name, info] of latest) {
            if (!info.fresh) staleSources.push(`${name} (${info.days}d)`);
          }

          return {
            triggered: staleSources.length > 0,
            message: `Stale data sources: ${staleSources.join(", ")}`,
            metadata: { stale_sources: staleSources },
          };
        },
      },
      {
        alert_type: "high_api_error_rate",
        severity: "critical",
        source: "api_metrics",
        check: async () => {
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { data } = await this.supabase
            .from("admin_api_metrics")
            .select("endpoint, error_rate, request_count")
            .gte("timestamp", fiveMinAgo);

          if (!data || data.length === 0)
            return { triggered: false, message: "" };

          const totalRequests = data.reduce(
            (sum, r) => sum + r.request_count,
            0,
          );
          const totalErrors = data.reduce(
            (sum, r) => sum + Math.round(r.error_rate * r.request_count),
            0,
          );
          const overallErrorRate =
            totalRequests > 0 ? totalErrors / totalRequests : 0;

          return {
            triggered: overallErrorRate > 0.05, // >5% error rate
            message: `API error rate ${(overallErrorRate * 100).toFixed(1)}% exceeds 5% threshold`,
            metadata: {
              error_rate: overallErrorRate,
              total_requests: totalRequests,
            },
          };
        },
      },
      {
        alert_type: "cache_low_hit_rate",
        severity: "warning",
        source: "cache_metrics",
        check: async () => {
          const { data } = await this.supabase
            .from("admin_cache_metrics")
            .select("hit_rate")
            .order("timestamp", { ascending: false })
            .limit(1)
            .single();

          if (!data) return { triggered: false, message: "" };

          return {
            triggered: data.hit_rate < 0.7, // <70% hit rate
            message: `Cache hit rate ${(data.hit_rate * 100).toFixed(1)}% is below 70% threshold`,
            metadata: { hit_rate: data.hit_rate },
          };
        },
      },
      {
        alert_type: "data_source_unavailable",
        severity: "critical",
        source: "health_check",
        check: async () => {
          const { data } = await this.supabase
            .from("admin_health_snapshots")
            .select("source_name, available")
            .order("timestamp", { ascending: false })
            .limit(20);

          const latest = new Map<string, boolean>();
          if (data) {
            for (const row of data) {
              if (!latest.has(row.source_name)) {
                latest.set(row.source_name, row.available);
              }
            }
          }

          const unavailable = [];
          for (const [name, available] of latest) {
            if (!available) unavailable.push(name);
          }

          return {
            triggered: unavailable.length > 0,
            message: `Unavailable data sources: ${unavailable.join(", ")}`,
            metadata: { unavailable_sources: unavailable },
          };
        },
      },
    ];
  }

  /**
   * Create alert if not already active for this type.
   */
  private async ensureAlertExists(
    alertType: string,
    severity: "critical" | "warning",
    source: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    // Check if an active alert of this type already exists
    const { data: existing } = await this.supabase
      .from("admin_alerts")
      .select("id")
      .eq("alert_type", alertType)
      .is("resolved_at", null)
      .limit(1);

    if (existing && existing.length > 0) return; // Already active

    const { error } = await this.supabase.from("admin_alerts").insert({
      alert_type: alertType,
      severity,
      message,
      source,
      metadata: metadata || {},
    });

    if (error) {
      this.logger.error(`Failed to create alert: ${alertType}`, error.message);
    } else {
      this.logger.warn(
        `Alert triggered: [${severity}] ${alertType} — ${message}`,
      );
    }
  }

  /**
   * Auto-resolve active alert when condition clears.
   */
  private async autoResolveAlert(alertType: string): Promise<void> {
    const { error } = await this.supabase
      .from("admin_alerts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("alert_type", alertType)
      .is("resolved_at", null);

    if (error) {
      this.logger.error(
        `Failed to auto-resolve alert: ${alertType}`,
        error.message,
      );
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/admin-metrics/services/alert-evaluation.service.ts
git commit -m "feat(admin-metrics): add AlertEvaluationService with threshold rules"
```

---

### Task 6: Build MetricsQueryService

Read queries for all frontend dashboard endpoints.

**Files:**

- Create: `packages/backend/src/admin-metrics/services/metrics-query.service.ts`

- [ ] **Step 1: Create the query service**

```typescript
// packages/backend/src/admin-metrics/services/metrics-query.service.ts

import { Injectable, Inject, Logger } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.constants";
import { HeroStats, AlertRow } from "../admin-metrics.types";

@Injectable()
export class MetricsQueryService {
  private readonly logger = new Logger(MetricsQueryService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Get hero stats: 5 top-level values with sparkline data.
   */
  async getHeroStats(): Promise<HeroStats> {
    const [health, alerts, freshness, users, scores] = await Promise.allSettled(
      [
        this.getUptimeStats(),
        this.getAlertStats(),
        this.getFreshnessStats(),
        this.getUserStats(),
        this.getScoreStats(),
      ],
    );

    return {
      system_health:
        health.status === "fulfilled"
          ? health.value
          : { uptime_pct: 0, sparkline: [] },
      active_alerts:
        alerts.status === "fulfilled"
          ? alerts.value
          : { count: 0, critical: 0, warning: 0, sparkline: [] },
      data_freshness:
        freshness.status === "fulfilled"
          ? freshness.value
          : { fresh: 0, total: 0, sparkline: [] },
      total_users:
        users.status === "fulfilled"
          ? users.value
          : { count: 0, new_this_week: 0, sparkline: [] },
      score_health:
        scores.status === "fulfilled"
          ? scores.value
          : { hit_rate_1y: 0, sparkline: [] },
    };
  }

  /**
   * Query time-series data from any admin table with time range filtering.
   */
  async queryTimeSeries(
    table: string,
    from?: string,
    to?: string,
    filters?: Record<string, string>,
    limit = 1000,
  ): Promise<any[]> {
    const allowedTables = [
      "admin_health_snapshots",
      "admin_api_metrics",
      "admin_cache_metrics",
      "admin_alerts",
      "admin_score_snapshots",
      "admin_user_snapshots",
      "admin_page_views",
    ];

    if (!allowedTables.includes(table)) {
      throw new Error(`Table ${table} is not queryable`);
    }

    let query = this.supabase
      .from(table)
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);

    const tsColumn = table === "admin_alerts" ? "triggered_at" : "timestamp";

    if (from) query = query.gte(tsColumn, from);
    if (to) query = query.lte(tsColumn, to);

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value === "null") {
          query = query.is(key, null);
        } else {
          query = query.eq(key, value);
        }
      }
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Query failed for ${table}`, error.message);
      return [];
    }

    return data || [];
  }

  /**
   * Get active alerts with optional severity/status filtering.
   */
  async getAlerts(options?: {
    severity?: string;
    status?: string; // 'active' | 'resolved' | 'all'
    from?: string;
    to?: string;
  }): Promise<AlertRow[]> {
    let query = this.supabase
      .from("admin_alerts")
      .select("*")
      .order("triggered_at", { ascending: false })
      .limit(100);

    if (options?.severity) query = query.eq("severity", options.severity);
    if (options?.status === "active") query = query.is("resolved_at", null);
    if (options?.status === "resolved")
      query = query.not("resolved_at", "is", null);
    if (options?.from) query = query.gte("triggered_at", options.from);
    if (options?.to) query = query.lte("triggered_at", options.to);

    const { data, error } = await query;
    if (error) {
      this.logger.error("Failed to query alerts", error.message);
      return [];
    }

    return (data || []) as AlertRow[];
  }

  /**
   * Acknowledge an alert.
   */
  async acknowledgeAlert(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("admin_alerts")
      .update({ acknowledged: true })
      .eq("id", id);

    if (error) throw error;
  }

  /**
   * Resolve an alert.
   */
  async resolveAlert(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("admin_alerts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;
  }

  /**
   * Get geographic coverage stats — derived from existing metric tables.
   */
  async getCoverage(): Promise<Record<string, Record<string, number>>> {
    const geoTables = {
      metro: ["zillow_metro", "realtor_metro", "census_acs_metro"],
      county: ["zillow_county", "census_acs_county"],
      zip: ["zillow_zip", "census_acs_zip"],
      state: ["zillow_state", "census_acs_state"],
    };

    const coverage: Record<string, Record<string, number>> = {};

    for (const [geoLevel, tables] of Object.entries(geoTables)) {
      coverage[geoLevel] = {};
      for (const table of tables) {
        const { count } = await this.supabase
          .from(table)
          .select("region_id", { count: "exact", head: true });
        // Extract source name from table (e.g., "zillow_metro" → "zillow")
        const source = table.replace(`_${geoLevel}`, "");
        coverage[geoLevel][source] = count || 0;
      }
    }

    return coverage;
  }

  // --- Private helpers ---

  private async getUptimeStats(): Promise<{
    uptime_pct: number;
    sparkline: number[];
  }> {
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data } = await this.supabase
      .from("admin_health_snapshots")
      .select("timestamp, available")
      .gte("timestamp", thirtyDaysAgo)
      .order("timestamp", { ascending: true });

    if (!data || data.length === 0) return { uptime_pct: 100, sparkline: [] };

    const totalChecks = data.length;
    const availableChecks = data.filter((d) => d.available).length;
    const uptime_pct =
      totalChecks > 0 ? (availableChecks / totalChecks) * 100 : 100;

    // Build daily sparkline
    const sparkline = this.buildDailySparkline(data, (row) =>
      row.available ? 100 : 0,
    );

    return { uptime_pct: Math.round(uptime_pct * 10) / 10, sparkline };
  }

  private async getAlertStats(): Promise<{
    count: number;
    critical: number;
    warning: number;
    sparkline: number[];
  }> {
    const { data: active } = await this.supabase
      .from("admin_alerts")
      .select("severity")
      .is("resolved_at", null);

    const count = active?.length || 0;
    const critical =
      active?.filter((a) => a.severity === "critical").length || 0;
    const warning = active?.filter((a) => a.severity === "warning").length || 0;

    // Sparkline: alert count per day (7d)
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: recent } = await this.supabase
      .from("admin_alerts")
      .select("triggered_at")
      .gte("triggered_at", sevenDaysAgo);

    const sparkline = this.buildDailyCountSparkline(
      recent || [],
      "triggered_at",
      7,
    );

    return { count, critical, warning, sparkline };
  }

  private async getFreshnessStats(): Promise<{
    fresh: number;
    total: number;
    sparkline: number[];
  }> {
    // Get latest snapshot per source
    const { data } = await this.supabase
      .from("admin_health_snapshots")
      .select("source_name, fresh, timestamp")
      .order("timestamp", { ascending: false })
      .limit(50);

    const latest = new Map<string, boolean>();
    if (data) {
      for (const row of data) {
        if (!latest.has(row.source_name)) {
          latest.set(row.source_name, row.fresh);
        }
      }
    }

    const total = latest.size;
    const fresh = [...latest.values()].filter((v) => v).length;

    // Sparkline: fresh count per day (7d)
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: history } = await this.supabase
      .from("admin_health_snapshots")
      .select("timestamp, fresh")
      .gte("timestamp", sevenDaysAgo)
      .order("timestamp", { ascending: true });

    const sparkline = this.buildDailySparkline(history || [], (row) =>
      row.fresh ? 1 : 0,
    );

    return { fresh, total, sparkline };
  }

  private async getUserStats(): Promise<{
    count: number;
    new_this_week: number;
    sparkline: number[];
  }> {
    const { data } = await this.supabase
      .from("admin_user_snapshots")
      .select("total_users, new_signups, timestamp")
      .order("timestamp", { ascending: false })
      .limit(30);

    const latest = data?.[0];
    const count = latest?.total_users || 0;

    // Sum signups for last 7 entries (daily snapshots)
    const weekData = data?.slice(0, 7) || [];
    const new_this_week = weekData.reduce(
      (sum, d) => sum + (d.new_signups || 0),
      0,
    );

    const sparkline = (data || []).reverse().map((d) => d.new_signups || 0);

    return { count, new_this_week, sparkline };
  }

  private async getScoreStats(): Promise<{
    hit_rate_1y: number;
    sparkline: number[];
  }> {
    const { data } = await this.supabase
      .from("admin_score_snapshots")
      .select("hit_rate_1y, timestamp")
      .order("timestamp", { ascending: false })
      .limit(12);

    const latest = data?.[0];
    const hit_rate_1y = latest?.hit_rate_1y || 0;
    const sparkline = (data || []).reverse().map((d) => d.hit_rate_1y || 0);

    return { hit_rate_1y, sparkline };
  }

  private buildDailySparkline(
    rows: any[],
    getValue: (row: any) => number,
  ): number[] {
    const daily = new Map<string, number[]>();
    for (const row of rows) {
      const day = new Date(row.timestamp).toISOString().split("T")[0];
      if (!daily.has(day)) daily.set(day, []);
      daily.get(day)!.push(getValue(row));
    }

    return [...daily.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, values]) => values.reduce((a, b) => a + b, 0) / values.length);
  }

  private buildDailyCountSparkline(
    rows: any[],
    dateField: string,
    days: number,
  ): number[] {
    const counts = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      counts.set(d, 0);
    }

    for (const row of rows) {
      const day = new Date(row[dateField]).toISOString().split("T")[0];
      if (counts.has(day)) counts.set(day, (counts.get(day) || 0) + 1);
    }

    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, count]) => count);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/admin-metrics/services/metrics-query.service.ts
git commit -m "feat(admin-metrics): add MetricsQueryService for dashboard data queries"
```

---

### Task 7: Build AdminMetricsController

API endpoints consumed by the frontend command center.

**Files:**

- Create: `packages/backend/src/admin-metrics/admin-metrics.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
// packages/backend/src/admin-metrics/admin-metrics.controller.ts

import { Controller, Get, Post, Param, Query, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin-auth.guard";
import { MetricsQueryService } from "./services/metrics-query.service";
import { QueryMetricsDto } from "./dto/query-metrics.dto";

@UseGuards(AdminGuard)
@Controller("api/admin/metrics")
export class AdminMetricsController {
  constructor(private readonly queryService: MetricsQueryService) {}

  @Get("hero-stats")
  async getHeroStats() {
    const stats = await this.queryService.getHeroStats();
    return { success: true, data: stats };
  }

  @Get("health-history")
  async getHealthHistory(@Query() query: QueryMetricsDto) {
    const data = await this.queryService.queryTimeSeries(
      "admin_health_snapshots",
      query.from,
      query.to,
      query.source_name ? { source_name: query.source_name } : undefined,
    );
    return { success: true, data };
  }

  @Get("pipeline-history")
  async getPipelineHistory(@Query() query: QueryMetricsDto) {
    // Use existing data_ingestion_log table via pipeline-runs service
    const data = await this.queryService.queryTimeSeries(
      "admin_health_snapshots", // Placeholder — pipeline data comes from existing table
      query.from,
      query.to,
    );
    return { success: true, data };
  }

  @Get("api-performance")
  async getApiPerformance(@Query() query: QueryMetricsDto) {
    const filters: Record<string, string> = {};
    if (query.endpoint) filters.endpoint = query.endpoint;

    const data = await this.queryService.queryTimeSeries(
      "admin_api_metrics",
      query.from,
      query.to,
      Object.keys(filters).length > 0 ? filters : undefined,
    );
    return { success: true, data };
  }

  @Get("cache-performance")
  async getCachePerformance(@Query() query: QueryMetricsDto) {
    const data = await this.queryService.queryTimeSeries(
      "admin_cache_metrics",
      query.from,
      query.to,
    );
    return { success: true, data };
  }

  @Get("alerts")
  async getAlerts(@Query() query: QueryMetricsDto) {
    const data = await this.queryService.getAlerts({
      severity: query.severity,
      status: query.status,
      from: query.from,
      to: query.to,
    });
    return { success: true, data };
  }

  @Post("alerts/:id/acknowledge")
  async acknowledgeAlert(@Param("id") id: string) {
    await this.queryService.acknowledgeAlert(id);
    return { success: true };
  }

  @Post("alerts/:id/resolve")
  async resolveAlert(@Param("id") id: string) {
    await this.queryService.resolveAlert(id);
    return { success: true };
  }

  @Get("score-history")
  async getScoreHistory(@Query() query: QueryMetricsDto) {
    const filters: Record<string, string> = {};
    if (query.score_type) filters.score_type = query.score_type;

    const data = await this.queryService.queryTimeSeries(
      "admin_score_snapshots",
      query.from,
      query.to,
      Object.keys(filters).length > 0 ? filters : undefined,
    );
    return { success: true, data };
  }

  @Get("user-history")
  async getUserHistory(@Query() query: QueryMetricsDto) {
    const data = await this.queryService.queryTimeSeries(
      "admin_user_snapshots",
      query.from,
      query.to,
    );
    return { success: true, data };
  }

  @Get("page-views")
  async getPageViews(@Query() query: QueryMetricsDto) {
    const data = await this.queryService.queryTimeSeries(
      "admin_page_views",
      query.from,
      query.to,
    );
    return { success: true, data };
  }

  @Get("coverage")
  async getCoverage() {
    const data = await this.queryService.getCoverage();
    return { success: true, data };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/admin-metrics/admin-metrics.controller.ts
git commit -m "feat(admin-metrics): add AdminMetricsController with all dashboard endpoints"
```

---

### Task 8: Build MetricsCleanupService

Retention cleanup cron — prunes old rows per the retention policy.

**Files:**

- Create: `packages/backend/src/admin-metrics/services/metrics-cleanup.service.ts`

- [ ] **Step 1: Create the cleanup service**

```typescript
// packages/backend/src/admin-metrics/services/metrics-cleanup.service.ts

import { Injectable, Inject, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.constants";

@Injectable()
export class MetricsCleanupService {
  private readonly logger = new Logger(MetricsCleanupService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Run weekly cleanup on Sundays at 3 AM UTC.
   * - 90 days: minute/5-min level tables
   * - 1 year: event + daily tables
   */
  @Cron("0 3 * * 0")
  async cleanup(): Promise<void> {
    const ninetyDaysAgo = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const oneYearAgo = new Date(
      Date.now() - 365 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const cleanupTasks = [
      // 90-day retention (high-frequency tables)
      {
        table: "admin_api_metrics",
        cutoff: ninetyDaysAgo,
        column: "timestamp",
      },
      {
        table: "admin_health_snapshots",
        cutoff: ninetyDaysAgo,
        column: "timestamp",
      },
      {
        table: "admin_cache_metrics",
        cutoff: ninetyDaysAgo,
        column: "timestamp",
      },

      // 1-year retention (event + daily tables)
      { table: "admin_alerts", cutoff: oneYearAgo, column: "triggered_at" },
      {
        table: "admin_score_snapshots",
        cutoff: oneYearAgo,
        column: "timestamp",
      },
      {
        table: "admin_user_snapshots",
        cutoff: oneYearAgo,
        column: "timestamp",
      },
      { table: "admin_page_views", cutoff: oneYearAgo, column: "timestamp" },
    ];

    for (const task of cleanupTasks) {
      try {
        const { count, error } = await this.supabase
          .from(task.table)
          .delete({ count: "exact" })
          .lt(task.column, task.cutoff);

        if (error) {
          this.logger.error(`Cleanup failed for ${task.table}`, error.message);
        } else if (count && count > 0) {
          this.logger.log(
            `Cleaned up ${count} rows from ${task.table} (older than ${task.cutoff})`,
          );
        }
      } catch (err) {
        this.logger.error(`Cleanup error for ${task.table}`, err);
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/admin-metrics/services/metrics-cleanup.service.ts
git commit -m "feat(admin-metrics): add MetricsCleanupService for retention policy enforcement"
```

---

### Task 9: Wire Up Module and Register Globally

**Files:**

- Create: `packages/backend/src/admin-metrics/admin-metrics.module.ts`
- Modify: `packages/backend/src/app.module.ts` (add import)

- [ ] **Step 1: Create the module**

```typescript
// packages/backend/src/admin-metrics/admin-metrics.module.ts

import { Module } from "@nestjs/common";
import { AdminMetricsController } from "./admin-metrics.controller";
import { SnapshotRecorderService } from "./services/snapshot-recorder.service";
import { ApiMetricsBufferService } from "./services/api-metrics-buffer.service";
import { AlertEvaluationService } from "./services/alert-evaluation.service";
import { MetricsQueryService } from "./services/metrics-query.service";
import { MetricsCleanupService } from "./services/metrics-cleanup.service";
import { ApiMetricsInterceptor } from "./interceptors/api-metrics.interceptor";

@Module({
  controllers: [AdminMetricsController],
  providers: [
    SnapshotRecorderService,
    ApiMetricsBufferService,
    AlertEvaluationService,
    MetricsQueryService,
    MetricsCleanupService,
    ApiMetricsInterceptor,
  ],
  exports: [ApiMetricsBufferService, ApiMetricsInterceptor],
})
export class AdminMetricsModule {}
```

- [ ] **Step 2: Register module and global interceptor in AppModule**

Open `packages/backend/src/app.module.ts` and:

1. Add `AdminMetricsModule` to the `imports` array.
2. Add `ScheduleModule.forRoot()` to imports if not already present (required for `@Cron` decorators).
3. Register `ApiMetricsInterceptor` as a global interceptor.

```typescript
// Add to imports section:
import { AdminMetricsModule } from './admin-metrics/admin-metrics.module';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApiMetricsInterceptor } from './admin-metrics/interceptors/api-metrics.interceptor';

// In @Module({...}):
imports: [
  ScheduleModule.forRoot(), // Add if not present
  // ... existing modules
  AdminMetricsModule,
],
providers: [
  // ... existing providers
  {
    provide: APP_INTERCEPTOR,
    useClass: ApiMetricsInterceptor,
  },
],
```

- [ ] **Step 3: Verify the backend compiles**

```bash
cd packages/backend && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No compilation errors.

- [ ] **Step 4: Verify the backend starts**

```bash
cd packages/backend && npm run start:dev 2>&1 | head -30
```

Expected: Server starts, cron jobs are registered, no errors in admin-metrics module initialization.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/admin-metrics/admin-metrics.module.ts
git add packages/backend/src/app.module.ts
git commit -m "feat(admin-metrics): wire up AdminMetricsModule with global API interceptor"
```

---

### Task 10: Smoke Test Endpoints

Verify the new endpoints return valid responses.

- [ ] **Step 1: Test hero-stats endpoint**

```bash
# Get an admin auth token first (adjust for your auth flow)
TOKEN=$(curl -s http://localhost:3001/api/auth/login -X POST -H 'Content-Type: application/json' -d '{"email":"admin@test.com","password":"test"}' | jq -r '.access_token')

curl -s http://localhost:3001/api/admin/metrics/hero-stats -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{ "success": true, "data": { "system_health": {...}, "active_alerts": {...}, ... } }`

- [ ] **Step 2: Test time-series endpoints with time range params**

```bash
FROM=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)
TO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

curl -s "http://localhost:3001/api/admin/metrics/api-performance?from=$FROM&to=$TO" -H "Authorization: Bearer $TOKEN" | jq .
curl -s "http://localhost:3001/api/admin/metrics/health-history?from=$FROM&to=$TO" -H "Authorization: Bearer $TOKEN" | jq .
curl -s "http://localhost:3001/api/admin/metrics/alerts?status=active" -H "Authorization: Bearer $TOKEN" | jq .
curl -s "http://localhost:3001/api/admin/metrics/coverage" -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: All return `{ "success": true, "data": [...] }` (data may be empty if no snapshots recorded yet — that's expected).

- [ ] **Step 3: Test alert acknowledge/resolve**

```bash
# Create a test alert first
curl -s -X POST "http://localhost:3001/api/admin/metrics/alerts/test-id/acknowledge" -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{ "success": true }` or a 404 if ID doesn't exist (both are valid at this stage).

- [ ] **Step 4: Final commit — mark plan complete**

```bash
git add -A
git commit -m "feat(admin-metrics): complete backend metrics module — Plan 1 done"
```

---

### Task 11: E2E Integration Tests (Real Database)

Full end-to-end tests against the live Supabase database. Each test writes real data, exercises the service/endpoint, verifies the result, then cleans up after itself.

**Files:**

- Create: `packages/backend/src/admin-metrics/admin-metrics.e2e-spec.ts`

- [ ] **Step 1: Create the E2E test file**

```typescript
// packages/backend/src/admin-metrics/admin-metrics.e2e-spec.ts

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../app.module";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.constants";
import { ApiMetricsBufferService } from "./services/api-metrics-buffer.service";
import { MetricsCleanupService } from "./services/metrics-cleanup.service";

/**
 * E2E tests for AdminMetrics module against the REAL database.
 * Each test writes data, verifies it via API, then cleans up.
 */
describe("AdminMetrics E2E (real DB)", () => {
  let app: INestApplication;
  let supabase: SupabaseClient;
  let apiMetricsBuffer: ApiMetricsBufferService;
  let metricsCleanup: MetricsCleanupService;
  let adminToken: string;

  // Track all test-inserted IDs for cleanup
  const testIds: Record<string, string[]> = {
    admin_health_snapshots: [],
    admin_api_metrics: [],
    admin_cache_metrics: [],
    admin_alerts: [],
    admin_score_snapshots: [],
    admin_user_snapshots: [],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    supabase = moduleFixture.get<SupabaseClient>(SUPABASE_CLIENT);
    apiMetricsBuffer = moduleFixture.get(ApiMetricsBufferService);
    metricsCleanup = moduleFixture.get(MetricsCleanupService);

    // Get admin auth token
    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({
        email: process.env.TEST_ADMIN_EMAIL,
        password: process.env.TEST_ADMIN_PASSWORD,
      });
    adminToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    // Clean up ALL test data
    for (const [table, ids] of Object.entries(testIds)) {
      if (ids.length > 0) {
        await supabase.from(table).delete().in("id", ids);
      }
    }
    await app.close();
  });

  describe("Health Snapshots — write → query → verify", () => {
    it("should insert a health snapshot and return it via the API", async () => {
      const { data: inserted, error } = await supabase
        .from("admin_health_snapshots")
        .insert({
          source_name: "e2e_test_source",
          available: true,
          fresh: true,
          days_since_update: 1,
          response_time_ms: 42,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      testIds.admin_health_snapshots.push(inserted.id);

      const res = await request(app.getHttpServer())
        .get("/api/admin/metrics/health-history")
        .query({ source_name: "e2e_test_source" })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const found = res.body.data.find((r: any) => r.id === inserted.id);
      expect(found).toBeDefined();
      expect(found.source_name).toBe("e2e_test_source");
      expect(found.available).toBe(true);
      expect(found.response_time_ms).toBe(42);
    });
  });

  describe("API Metrics Buffer — record → flush → query", () => {
    it("should buffer timings, flush to DB, and return aggregated metrics", async () => {
      for (let i = 0; i < 10; i++) {
        apiMetricsBuffer.record({
          endpoint: "/api/e2e-test/fake-endpoint",
          duration_ms: 50 + i * 10,
          status_code: i < 8 ? 200 : 500, // 2 errors out of 10
          timestamp: Date.now(),
        });
      }

      await apiMetricsBuffer.flush();

      const res = await request(app.getHttpServer())
        .get("/api/admin/metrics/api-performance")
        .query({ endpoint: "/api/e2e-test/fake-endpoint" })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const row = res.body.data.find(
        (r: any) => r.endpoint === "/api/e2e-test/fake-endpoint",
      );
      expect(row).toBeDefined();
      expect(row.request_count).toBe(10);
      expect(row.error_count).toBe(2);
      expect(row.error_rate).toBeCloseTo(0.2, 1);
      expect(row.p50_ms).toBeGreaterThanOrEqual(50);
      expect(row.p95_ms).toBeGreaterThanOrEqual(100);

      testIds.admin_api_metrics.push(row.id);
    });
  });

  describe("Cache Metrics — write → query → verify", () => {
    it("should record and return cache metrics", async () => {
      const { data: inserted, error } = await supabase
        .from("admin_cache_metrics")
        .insert({
          hit_count: 940,
          miss_count: 60,
          hit_rate: 0.94,
          eviction_count: 5,
          memory_used_bytes: 50000000,
          keys_count: 1200,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      testIds.admin_cache_metrics.push(inserted.id);

      const res = await request(app.getHttpServer())
        .get("/api/admin/metrics/cache-performance")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.data.find((r: any) => r.id === inserted.id);
      expect(found).toBeDefined();
      expect(found.hit_rate).toBeCloseTo(0.94, 2);
      expect(found.keys_count).toBe(1200);
    });
  });

  describe("Alert Lifecycle — create → query → acknowledge → resolve", () => {
    let alertId: string;

    it("should create an alert and return it as active", async () => {
      const { data: inserted, error } = await supabase
        .from("admin_alerts")
        .insert({
          alert_type: "e2e_test_alert",
          severity: "warning",
          message: "E2E test alert — will be cleaned up",
          source: "e2e_test",
          metadata: { test: true },
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      alertId = inserted.id;
      testIds.admin_alerts.push(alertId);

      const res = await request(app.getHttpServer())
        .get("/api/admin/metrics/alerts")
        .query({ status: "active" })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.data.find((a: any) => a.id === alertId);
      expect(found).toBeDefined();
      expect(found.severity).toBe("warning");
      expect(found.resolved_at).toBeNull();
      expect(found.acknowledged).toBe(false);
    });

    it("should acknowledge the alert", async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/metrics/alerts/${alertId}/acknowledge`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(201);

      const { data } = await supabase
        .from("admin_alerts")
        .select("acknowledged")
        .eq("id", alertId)
        .single();

      expect(data.acknowledged).toBe(true);
    });

    it("should resolve the alert and remove it from active list", async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/metrics/alerts/${alertId}/resolve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get("/api/admin/metrics/alerts")
        .query({ status: "active" })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.data.find((a: any) => a.id === alertId);
      expect(found).toBeUndefined();
    });
  });

  describe("Score Snapshots — write → query → verify", () => {
    it("should record and return score validation history", async () => {
      const { data: inserted, error } = await supabase
        .from("admin_score_snapshots")
        .insert({
          score_type: "e2e_test_score",
          correlation_1y: 0.35,
          hit_rate_1y: 0.65,
          scores_validated: 500,
          scores_pending: 50,
          scores_failed: 3,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      testIds.admin_score_snapshots.push(inserted.id);

      const res = await request(app.getHttpServer())
        .get("/api/admin/metrics/score-history")
        .query({ score_type: "e2e_test_score" })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.data.find((r: any) => r.id === inserted.id);
      expect(found).toBeDefined();
      expect(found.correlation_1y).toBeCloseTo(0.35, 2);
      expect(found.scores_validated).toBe(500);
    });
  });

  describe("User Snapshots — write → query → verify", () => {
    it("should record and return user history", async () => {
      const { data: inserted, error } = await supabase
        .from("admin_user_snapshots")
        .insert({
          total_users: 250,
          new_signups: 5,
          active_trials: 12,
          expiring_soon: 2,
          tier_free: 180,
          tier_starter: 40,
          tier_pro: 25,
          tier_enterprise: 5,
          paywall_views: 88,
          conversions: 3,
          mrr_cents: 420000,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      testIds.admin_user_snapshots.push(inserted.id);

      const res = await request(app.getHttpServer())
        .get("/api/admin/metrics/user-history")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.data.find((r: any) => r.id === inserted.id);
      expect(found).toBeDefined();
      expect(found.total_users).toBe(250);
      expect(found.tier_pro).toBe(25);
      expect(found.mrr_cents).toBe(420000);
    });
  });

  describe("Hero Stats — aggregation correctness", () => {
    it("should return all 5 hero stats with correct shape", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/admin/metrics/hero-stats")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const stats = res.body.data;

      expect(stats).toHaveProperty("system_health");
      expect(stats).toHaveProperty("active_alerts");
      expect(stats).toHaveProperty("data_freshness");
      expect(stats).toHaveProperty("total_users");
      expect(stats).toHaveProperty("score_health");

      expect(Array.isArray(stats.system_health.sparkline)).toBe(true);
      expect(typeof stats.system_health.uptime_pct).toBe("number");
      expect(typeof stats.active_alerts.count).toBe("number");
      expect(typeof stats.data_freshness.fresh).toBe("number");
      expect(typeof stats.total_users.count).toBe("number");
      expect(typeof stats.score_health.hit_rate_1y).toBe("number");
    });
  });

  describe("Geographic Coverage — derived from real tables", () => {
    it("should return coverage counts per geo level", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/admin/metrics/coverage")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const coverage = res.body.data;

      expect(coverage).toHaveProperty("metro");
      expect(coverage).toHaveProperty("county");
      expect(coverage).toHaveProperty("zip");
      expect(coverage).toHaveProperty("state");
      expect(typeof coverage.metro.zillow).toBe("number");
    });
  });

  describe("Time Range Filtering — from/to params", () => {
    it("should filter results by time range", async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const { data: recent } = await supabase
        .from("admin_cache_metrics")
        .insert({
          timestamp: now.toISOString(),
          hit_count: 100,
          miss_count: 10,
          hit_rate: 0.91,
          eviction_count: 0,
          memory_used_bytes: 1000,
          keys_count: 50,
        })
        .select("id")
        .single();

      const { data: older } = await supabase
        .from("admin_cache_metrics")
        .insert({
          timestamp: twoDaysAgo.toISOString(),
          hit_count: 80,
          miss_count: 20,
          hit_rate: 0.8,
          eviction_count: 1,
          memory_used_bytes: 900,
          keys_count: 40,
        })
        .select("id")
        .single();

      testIds.admin_cache_metrics.push(recent.id, older.id);

      const res = await request(app.getHttpServer())
        .get("/api/admin/metrics/cache-performance")
        .query({ from: yesterday.toISOString() })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.data.map((r: any) => r.id);
      expect(ids).toContain(recent.id);
      expect(ids).not.toContain(older.id);
    });
  });

  describe("Metrics Cleanup — removes old rows", () => {
    it("should delete rows older than retention period", async () => {
      const oldDate = new Date(
        Date.now() - 100 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: inserted } = await supabase
        .from("admin_api_metrics")
        .insert({
          timestamp: oldDate,
          endpoint: "/api/e2e-cleanup-test",
          p50_ms: 10,
          p95_ms: 20,
          p99_ms: 30,
          request_count: 1,
          error_count: 0,
          error_rate: 0,
        })
        .select("id")
        .single();

      // Don't add to testIds — cleanup should remove it
      await metricsCleanup.cleanup();

      const { data: remaining } = await supabase
        .from("admin_api_metrics")
        .select("id")
        .eq("id", inserted.id);

      expect(remaining).toHaveLength(0);
    });
  });

  describe("Admin Guard — rejects unauthorized access", () => {
    it("should reject requests without auth token", async () => {
      await request(app.getHttpServer())
        .get("/api/admin/metrics/hero-stats")
        .expect(401);
    });

    it("should reject requests with invalid token", async () => {
      await request(app.getHttpServer())
        .get("/api/admin/metrics/hero-stats")
        .set("Authorization", "Bearer invalid-token-here")
        .expect(401);
    });
  });
});
```

- [ ] **Step 2: Run the E2E tests against the real database**

```bash
cd packages/backend && npx jest admin-metrics.e2e-spec.ts --verbose --forceExit --detectOpenHandles
```

Expected: All 11 describe blocks pass. The `afterAll` cleanup removes all test rows.

- [ ] **Step 3: Fix any failures and re-run until all green**

If tests fail, fix the service/controller code (not the tests). Common issues:

- Auth token format — check your login endpoint response shape
- Column name mismatches — verify migration matches types
- `afterAll` cleanup — ensure `testIds` tracking covers all inserts

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/admin-metrics/admin-metrics.e2e-spec.ts
git commit -m "test(admin-metrics): add E2E integration tests against real database"
```

---

## Notes for Plan 2 (Frontend Shell + Shared Components)

The frontend will consume these endpoints:

- `GET /api/admin/metrics/hero-stats` → `HeroStatsRow` component
- `GET /api/admin/metrics/{table-name}?from=&to=` → each card's chart data
- `GET /api/admin/metrics/alerts?status=active` → `ActiveAlertsCard`
- `POST /api/admin/metrics/alerts/:id/acknowledge` → panel action
- `GET /api/admin/metrics/coverage` → `GeographicCoverageCard`

All endpoints are admin-guarded and return `{ success: boolean, data: T }`.
