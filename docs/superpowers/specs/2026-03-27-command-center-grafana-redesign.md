# Command Center v2 — Grafana-Inspired Redesign

**Date:** 2026-03-27
**Status:** Approved
**Scope:** Full redesign of `/admin` command center with time-series charts, new monitoring cards, and tabbed layout

---

## Overview

Redesign the PropertyIQ admin command center from a static 6-card summary into a Grafana-inspired monitoring dashboard with 15 cards, time-series visualizations, and a slide-out detail panel. All data stays internal — no external Grafana dependency. Uses new Supabase tables for metric history and Recharts for visualization.

## Design Decisions

| Decision           | Choice                                                                  | Rationale                                                                         |
| ------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Layout             | Hybrid: Hero stats + tabbed sections                                    | Instant glance at health + organized detail without endless scrolling             |
| Hero Stats         | System Health, Active Alerts, Data Freshness, Total Users, Score Health | Covers ops, data, business, and core product in one row                           |
| Card Interaction   | Slide-out right panel                                                   | Keeps dashboard context, matches existing map detail panel pattern                |
| Data Storage       | New Supabase tables                                                     | Simplest path, already in the stack, no new infrastructure                        |
| Charts             | Recharts                                                                | Already used for ScoreHistoryChart, consistent                                    |
| Design System      | M3 light theme (existing)                                               | Keep current site feel; Grafana-inspired layout and chart content inside M3 cards |
| Time Range Options | 1h, 24h, 7d, 30d, 90d, 6m, 1y, Custom                                   | Custom uses date picker                                                           |

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Command Center                              [Last: 2s ago] [Refresh] │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ System   │ │ Active   │ │ Data     │ │ Total    │ │ Score    │ │
│ │ Health   │ │ Alerts   │ │ Freshness│ │ Users    │ │ Health   │ │
│ │ 99.8%    │ │ 3        │ │ 6/9      │ │ 247      │ │ 61.8%   │ │
│ │ ~~~sparkline~~~ │ │ ~~~sparkline~~~ │ │ ~~~sparkline~~~ │ │ ~~~sparkline~~~ │ │ ~~~sparkline~~~ │ │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
├─────────────────────────────────────────────────────────────┤
│ [Operations]  [Data & Scores]  [Business]                        │
├─────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                    │
│ │ Card 1     │ │ Card 2     │ │ Card 3     │                    │
│ │ (w/ chart) │ │ (w/ chart) │ │ (w/ chart) │                    │
│ └────────────┘ └────────────┘ └────────────┘                    │
│ ┌────────────────────┐ ┌────────────────────┐                    │
│ │ Card 4             │ │ Card 5             │                    │
│ └────────────────────┘ └────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

Clicking any detail card opens a **slide-out panel** from the right (480px wide) with full charts, tables, and time range selector.

---

## Hero Stats Row (5 cards, always visible)

Each hero stat card shows: label, large value, subtitle, and a sparkline trend line.

| Stat           | Value             | Subtitle             | Sparkline                | Color              |
| -------------- | ----------------- | -------------------- | ------------------------ | ------------------ |
| System Health  | Uptime % (30d)    | "Uptime (30d)"       | Daily uptime %           | Green              |
| Active Alerts  | Count             | "X warn, Y critical" | Alert count per day (7d) | Amber/red when > 0 |
| Data Freshness | X/Y sources fresh | "Sources fresh"      | Fresh count per day (7d) | Green/red dynamic  |
| Total Users    | User count        | "+N this week"       | Daily signups (30d)      | Purple             |
| Score Health   | 1Y Hit Rate %     | "1Y Hit Rate"        | Monthly hit rate (12mo)  | Blue               |

Hero stat cards have a subtle colored border when in warning/critical state (e.g., Active Alerts border turns amber when alerts exist).

---

## Tab 1: Operations (5 cards)

### 1. Data Feeds

- **Card View:** Source list with freshness bars (green/amber/red), days since update, availability dot. Summary badge: "X/Y Available"
- **Panel View:** Freshness timeline per source over 30 days (Recharts AreaChart, stacked). Source detail table with response times, last check, schema changes.

### 2. Pipeline Runs

- **Card View:** Bar chart showing success/partial/fail per day (7d). 3 most recent runs with status badges and relative time.
- **Panel View:** Full run history table (paginated). Duration trend line chart. Records processed/failed per run. Error details expandable.

### 3. API Performance

- **Card View:** Line chart with p50/p95 latency (1h). Badge: "142ms p95". Error rate percentage.
- **Panel View:** Per-endpoint breakdown table (sortable by latency, error rate, request count). Latency distribution histogram. Error log.

### 4. Cache Performance

- **Card View:** Hit/miss ratio bar (green/red proportional), memory usage stat, eviction count.
- **Panel View:** Hit rate trend line chart over time. Per-cache-key breakdown table. Memory usage trend. Eviction rate trend.

### 5. Active Alerts

- **Card View:** Live list of current alerts sorted by severity (critical first). Each shows: severity dot, message, source, time.
- **Panel View:** Full alert history (active + resolved). Acknowledge/resolve buttons. Alert threshold configuration table.

---

## Tab 2: Data & Scores (5 cards)

### 1. Score Health

- **Card View:** Correlation + hit rate as two values with trend arrows. Validated scores count.
- **Panel View:** Correlation and hit rate trend line charts (monthly, 12mo). Per-score-type breakdown table. Geography-level drill-down.

### 2. ML Ops

- **Card View:** Connection status dot + version. Total cached records with per-geography breakdown (metro, county, zip, state).
- **Panel View:** Cache age per geography. Model version history timeline. Cache rebuild trigger button.

### 3. Geographic Coverage

- **Card View:** Percentage bars showing data coverage per geo level (metro: 95%, county: 78%, zip: 42%). Color-coded.
- **Panel View:** Full coverage matrix (metric x geo level). List of regions missing data per metric. Coverage trend over time.

### 4. Data Quality

- **Card View:** Anomaly count badge, recent outlier flags (metric + region + severity). Summary: "X anomalies detected".
- **Panel View:** Full anomaly list with metric, region, actual value, expected range, detection date. Dismiss/flag actions.

### 5. Score Computation

- **Card View:** Progress summary: scored / pending / failed counts. Last computation timestamp.
- **Panel View:** Per-geography scoring status table. Computation duration trend chart. Failed region list with error details.

---

## Tab 3: Business (5 cards)

### 1. Users & Growth

- **Card View:** Total users (large number) + weekly signup sparkline. Growth rate percentage.
- **Panel View:** Signup trend area chart (30d/90d/1y). Active vs inactive users. Retention cohort table.

### 2. Revenue / MRR

- **Card View:** MRR value with MoM change arrow. Requires Stripe integration.
- **Panel View:** MRR trend line chart. ARPU trend. Churn rate. Revenue by tier breakdown. (Note: Stripe integration is Phase 1 in the project — this card may show placeholder until Stripe is connected.)

### 3. Feature Usage

- **Card View:** Top 5 pages by traffic as horizontal bar chart.
- **Panel View:** Full page-level analytics table (sortable). Session duration distribution. Bounce rate per page. User flow sankey diagram (future).

### 4. Tier Distribution

- **Card View:** Donut chart showing user count per tier (free/starter/pro/enterprise) with legend.
- **Panel View:** Upgrade/downgrade trends over time. Tier migration flow. Conversion funnel: free → trial → paid.

### 5. Feedback Queue

- **Card View:** Open count badge + resolution trend sparkline. 3 most recent items with status dots.
- **Panel View:** Full feedback list with category/status/date filtering. Bulk status updates. Resolution time metrics.

---

## Data Architecture

### New Supabase Tables

All tables include `id` (UUID, PK) and are indexed on `timestamp` / `created_at`.

#### `admin_health_snapshots`

Records data source health at each check interval.

| Column            | Type        | Description                          |
| ----------------- | ----------- | ------------------------------------ |
| id                | uuid        | PK                                   |
| timestamp         | timestamptz | When the check ran                   |
| source_name       | text        | e.g., "zillow", "fred", "census_acs" |
| available         | boolean     | Was the source reachable?            |
| fresh             | boolean     | Is data within expected freshness?   |
| days_since_update | integer     | Days since last data update          |
| response_time_ms  | integer     | Health check response time           |
| error_message     | text        | Null if healthy                      |

**Recorded by:** Existing health check endpoint, extended to write a row on each check.
**Frequency:** Every 5 minutes.

#### `admin_pipeline_runs`

Records each pipeline execution. (Partially exists — extend with additional columns.)

| Column            | Type        | Description                              |
| ----------------- | ----------- | ---------------------------------------- |
| id                | uuid        | PK                                       |
| pipeline_name     | text        | e.g., "fred_import", "census_acs_import" |
| display_name      | text        | Human-readable name                      |
| started_at        | timestamptz | Run start                                |
| ended_at          | timestamptz | Run end (null if running)                |
| status            | text        | running, success, failed, partial        |
| records_processed | integer     | Total records handled                    |
| records_inserted  | integer     | New records written                      |
| records_failed    | integer     | Records that errored                     |
| duration_ms       | integer     | Total run duration                       |
| error_message     | text        | Null if successful                       |

**Recorded by:** Pipeline scripts at start and completion.
**Frequency:** Per pipeline execution.

#### `admin_api_metrics`

Aggregated API performance metrics per endpoint.

| Column        | Type        | Description                           |
| ------------- | ----------- | ------------------------------------- |
| id            | uuid        | PK                                    |
| timestamp     | timestamptz | Aggregation window start              |
| endpoint      | text        | e.g., "/api/metrics/home_value/metro" |
| p50_ms        | real        | Median response time                  |
| p95_ms        | real        | 95th percentile response time         |
| p99_ms        | real        | 99th percentile response time         |
| request_count | integer     | Requests in this window               |
| error_count   | integer     | 4xx + 5xx responses                   |
| error_rate    | real        | error_count / request_count           |

**Recorded by:** NestJS interceptor that buffers request timings, flushes aggregates every 1 minute.
**Frequency:** Every 1 minute.

#### `admin_cache_metrics`

Redis cache performance snapshots.

| Column            | Type        | Description                          |
| ----------------- | ----------- | ------------------------------------ |
| id                | uuid        | PK                                   |
| timestamp         | timestamptz | When recorded                        |
| hit_count         | integer     | Cache hits since last snapshot       |
| miss_count        | integer     | Cache misses since last snapshot     |
| hit_rate          | real        | hit_count / (hit_count + miss_count) |
| eviction_count    | integer     | Evictions since last snapshot        |
| memory_used_bytes | bigint      | Current Redis memory usage           |
| keys_count        | integer     | Total keys in Redis                  |

**Recorded by:** Redis health check service.
**Frequency:** Every 5 minutes.

#### `admin_alerts`

Alert events triggered by threshold rules.

| Column       | Type        | Description                                                 |
| ------------ | ----------- | ----------------------------------------------------------- |
| id           | uuid        | PK                                                          |
| alert_type   | text        | e.g., "data_stale", "high_error_rate", "cache_low_hit_rate" |
| severity     | text        | critical, warning, info                                     |
| message      | text        | Human-readable alert description                            |
| source       | text        | What system triggered it                                    |
| triggered_at | timestamptz | When alert fired                                            |
| resolved_at  | timestamptz | Null if still active                                        |
| acknowledged | boolean     | Has admin seen it?                                          |
| metadata     | jsonb       | Extra context (thresholds, values, etc.)                    |

**Recorded by:** Alert evaluation service (new) that checks thresholds after each health/metrics snapshot.
**Frequency:** On trigger and resolve events.

#### `admin_score_snapshots`

Daily score validation metrics.

| Column           | Type        | Description                             |
| ---------------- | ----------- | --------------------------------------- |
| id               | uuid        | PK                                      |
| timestamp        | timestamptz | Snapshot date                           |
| score_type       | text        | homeready, investor_edge, market_health |
| correlation_1y   | real        | 1-year correlation value                |
| hit_rate_1y      | real        | 1-year hit rate percentage              |
| scores_validated | integer     | Scores with outcome data                |
| scores_pending   | integer     | Scores awaiting validation              |
| scores_failed    | integer     | Scores that failed computation          |

**Recorded by:** Score validation job.
**Frequency:** Daily.

#### `admin_user_snapshots`

Daily user and billing metrics.

| Column          | Type        | Description                        |
| --------------- | ----------- | ---------------------------------- |
| id              | uuid        | PK                                 |
| timestamp       | timestamptz | Snapshot date                      |
| total_users     | integer     | Total registered users             |
| new_signups     | integer     | New signups that day               |
| active_trials   | integer     | Currently in trial period          |
| expiring_soon   | integer     | Trials expiring within 7 days      |
| tier_free       | integer     | Users on free tier                 |
| tier_starter    | integer     | Users on starter tier              |
| tier_pro        | integer     | Users on pro tier                  |
| tier_enterprise | integer     | Users on enterprise tier           |
| paywall_views   | integer     | Paywall impressions that day       |
| conversions     | integer     | Paywall conversions that day       |
| mrr_cents       | integer     | Monthly recurring revenue in cents |

**Recorded by:** Daily cron job.
**Frequency:** Daily.

#### `admin_page_views`

Daily page-level analytics rollups.

| Column                  | Type        | Description                         |
| ----------------------- | ----------- | ----------------------------------- |
| id                      | uuid        | PK                                  |
| timestamp               | timestamptz | Day                                 |
| page_path               | text        | e.g., "/map", "/reports", "/scores" |
| view_count              | integer     | Page views that day                 |
| unique_visitors         | integer     | Unique visitors that day            |
| avg_session_duration_ms | integer     | Average time on page                |
| bounce_rate             | real        | Percentage who left immediately     |

**Recorded by:** Analytics middleware rollup job.
**Frequency:** Daily rollup.

### Data Retention

| Granularity | Tables                                                              | Retention |
| ----------- | ------------------------------------------------------------------- | --------- |
| Per-minute  | `admin_api_metrics`                                                 | 90 days   |
| Per-5-min   | `admin_health_snapshots`, `admin_cache_metrics`                     | 90 days   |
| Per-event   | `admin_pipeline_runs`, `admin_alerts`                               | 1 year    |
| Daily       | `admin_score_snapshots`, `admin_user_snapshots`, `admin_page_views` | 1 year    |

A weekly cleanup job (`admin_metrics_cleanup`) prunes rows older than the retention period.

### Database Permissions

```sql
GRANT ALL ON admin_health_snapshots TO service_role;
GRANT ALL ON admin_pipeline_runs TO service_role;
GRANT ALL ON admin_api_metrics TO service_role;
GRANT ALL ON admin_cache_metrics TO service_role;
GRANT ALL ON admin_alerts TO service_role;
GRANT ALL ON admin_score_snapshots TO service_role;
GRANT ALL ON admin_user_snapshots TO service_role;
GRANT ALL ON admin_page_views TO service_role;
```

No RLS needed — these tables are admin-only and accessed exclusively through the NestJS backend with `sb_secret_` key.

---

## Slide-Out Detail Panel

- **Position:** Fixed right, 480px wide
- **Styling:** M3 `bg-surface-container-low`, `border-l border-outline-variant`, `rounded-l-2xl`
- **Header:** Card title, close (X) button, `TimeRangeSelector`
- **Body:** Full Recharts chart(s) + data table
- **Animation:** Slide in from right, `duration-400`, M3 standard easing
- **Backdrop:** Semi-transparent overlay on the dashboard content

### TimeRangeSelector Options

| Label  | Value    | Description             |
| ------ | -------- | ----------------------- |
| 1h     | `1h`     | Last hour               |
| 24h    | `24h`    | Last 24 hours           |
| 7d     | `7d`     | Last 7 days             |
| 30d    | `30d`    | Last 30 days            |
| 90d    | `90d`    | Last 90 days            |
| 6m     | `6m`     | Last 6 months           |
| 1y     | `1y`     | Last 1 year             |
| Custom | `custom` | Opens date range picker |

---

## Shared Components

| Component           | Purpose                                                      | Location                   |
| ------------------- | ------------------------------------------------------------ | -------------------------- |
| `HeroStatCard`      | Compact stat: value + subtitle + sparkline + color border    | `admin/components/hero/`   |
| `HeroStatsRow`      | Row of 5 `HeroStatCard` components                           | `admin/components/hero/`   |
| `DashboardCard`     | Standard card shell: title, badge, body slot, click handler  | `admin/components/shared/` |
| `DetailPanel`       | Slide-out panel shell: header, time range, close, body slot  | `admin/components/shared/` |
| `SparklineChart`    | Tiny inline SVG line chart for hero stats and card summaries | `admin/components/shared/` |
| `TimeRangeSelector` | Toggle group: 1h/24h/7d/30d/90d/6m/1y/Custom                 | `admin/components/shared/` |
| `StatusDot`         | Green/amber/red circle indicator                             | `admin/components/shared/` |
| `FreshnessBar`      | Horizontal bar colored by freshness status                   | `admin/components/shared/` |
| `AlertItem`         | Alert row: severity dot + message + source + time            | `admin/components/shared/` |

---

## File Structure

```
app/admin/
  page.tsx                              # Redesigned: hero stats + tabs
  components/
    hero/
      HeroStatsRow.tsx                  # Row of 5 hero stat cards
      HeroStatCard.tsx                  # Single hero stat with sparkline
    tabs/
      OperationsTab.tsx                 # 5 operations cards in grid
      DataScoresTab.tsx                 # 5 data & scores cards in grid
      BusinessTab.tsx                   # 5 business cards in grid
    cards/
      DataFeedsCard.tsx
      PipelineRunsCard.tsx
      ApiPerformanceCard.tsx
      CachePerformanceCard.tsx
      ActiveAlertsCard.tsx
      ScoreHealthCard.tsx
      MlOpsCard.tsx
      GeographicCoverageCard.tsx
      DataQualityCard.tsx
      ScoreComputationCard.tsx
      UsersGrowthCard.tsx
      RevenueMrrCard.tsx
      FeatureUsageCard.tsx
      TierDistributionCard.tsx
      FeedbackQueueCard.tsx
    panels/
      DataFeedsPanel.tsx
      PipelineRunsPanel.tsx
      ApiPerformancePanel.tsx
      CachePerformancePanel.tsx
      ActiveAlertsPanel.tsx
      ScoreHealthPanel.tsx
      MlOpsPanel.tsx
      GeographicCoveragePanel.tsx
      DataQualityPanel.tsx
      ScoreComputationPanel.tsx
      UsersGrowthPanel.tsx
      RevenueMrrPanel.tsx
      FeatureUsagePanel.tsx
      TierDistributionPanel.tsx
      FeedbackQueuePanel.tsx
    shared/
      DashboardCard.tsx
      DetailPanel.tsx
      SparklineChart.tsx
      TimeRangeSelector.tsx
      StatusDot.tsx
      FreshnessBar.tsx
      AlertItem.tsx
    hooks/
      useAdminDashboardRefresh.ts       # Existing, keep
      useAdminMetrics.ts                # New: fetch time-series from admin_* tables
      useDetailPanel.ts                 # Panel open/close/card state
      useHeroStats.ts                   # Fetch hero stat values
      useTimeRange.ts                   # Time range state management
```

---

## Backend Changes

### New NestJS Module: `AdminMetricsModule`

| Service                  | Responsibility                                                          |
| ------------------------ | ----------------------------------------------------------------------- |
| `AdminMetricsService`    | Write snapshot rows to admin\_\* tables on timer / event                |
| `AdminMetricsController` | API endpoints for frontend to query time-series data                    |
| `AlertEvaluationService` | Check thresholds after snapshots, create/resolve alerts                 |
| `ApiMetricsInterceptor`  | NestJS interceptor buffering request timings, flushing 1-min aggregates |
| `MetricsCleanupService`  | Weekly cron to prune old rows per retention policy                      |

### New API Endpoints

| Endpoint                                    | Method | Description                                                    |
| ------------------------------------------- | ------ | -------------------------------------------------------------- |
| `/api/admin/metrics/hero-stats`             | GET    | All 5 hero stat values + sparkline data                        |
| `/api/admin/metrics/health-history`         | GET    | Data source freshness over time                                |
| `/api/admin/metrics/pipeline-history`       | GET    | Pipeline run history with duration/status                      |
| `/api/admin/metrics/api-performance`        | GET    | API latency/error metrics (filterable by endpoint, time range) |
| `/api/admin/metrics/cache-performance`      | GET    | Cache hit/miss/memory over time                                |
| `/api/admin/metrics/alerts`                 | GET    | Active + historical alerts                                     |
| `/api/admin/metrics/alerts/:id/acknowledge` | POST   | Mark alert as acknowledged                                     |
| `/api/admin/metrics/score-history`          | GET    | Score validation metrics over time                             |
| `/api/admin/metrics/user-history`           | GET    | User/tier/revenue metrics over time                            |
| `/api/admin/metrics/page-views`             | GET    | Page-level analytics over time                                 |
| `/api/admin/metrics/coverage`               | GET    | Geographic data coverage matrix                                |
| `/api/admin/metrics/data-quality`           | GET    | Anomaly/outlier flags                                          |

All endpoints accept `?from=&to=` query params for time range filtering.

---

## Polling & Refresh

- **Auto-refresh:** 5-minute interval (existing `useAdminDashboardRefresh` hook)
- **Manual refresh:** Button in header refreshes all visible cards
- **Per-card loading:** Each card fetches independently, shows skeleton loader
- **React Query:** All fetches go through React Query with 2-minute stale time for admin endpoints

---

## Migration Path

1. Create Supabase tables (migration)
2. Build backend `AdminMetricsModule` (services, controller, interceptor)
3. Start recording data (health snapshots, API metrics, etc.)
4. Build shared frontend components (HeroStatCard, DashboardCard, DetailPanel, etc.)
5. Build hero stats row
6. Build Operations tab cards + panels
7. Build Data & Scores tab cards + panels
8. Build Business tab cards + panels
9. Wire up existing admin pages as slide-out panel targets
10. Remove old widget components after new ones are verified

---

## Out of Scope

- WebSocket / real-time push (5-min polling is sufficient for now)
- Custom dashboard builder / drag-and-drop card arrangement
- Multi-user role-based card visibility
- Email/Slack alert notifications (alerts are in-dashboard only for now)
- Stripe integration for Revenue/MRR card (placeholder until Stripe Phase 1 is complete)
