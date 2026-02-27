# SaaS Analytics Suite — Full Design

**Date:** 2026-02-26
**Status:** Design Complete, Pending Implementation
**Goal:** Give a SaaS marketer the full picture — from first visit to paid conversion to retained user — using entirely first-party data.

---

## 1. Design Decisions

| Decision            | Choice                                               | Rationale                                                          |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Data ownership      | First-party only                                     | Own the data, tight entitlement integration, AI can query directly |
| Collection strategy | Auto pageviews + curated feature events + heartbeats | Clean signal over noisy volume                                     |
| Scale target        | Moderate (hundreds of DAU, thousands of events/day)  | Design once, don't rebuild in a week                               |
| Dashboard structure | `/admin/analytics/` with 5 tabs + AI panel           | Dedicated section, room to grow                                    |
| Existing page       | Replace entirely                                     | Clean slate, existing paywall data migrates in                     |

---

## 2. Data Collection Layer

### 2.1 Identity Model (Three Levels)

| Level        | Storage        | Lifespan                  | Purpose                                        |
| ------------ | -------------- | ------------------------- | ---------------------------------------------- |
| `visitor_id` | localStorage   | Permanent (until cleared) | Cross-session identity, pre-signup attribution |
| `session_id` | sessionStorage | One browser session       | Session-level aggregation                      |
| `user_id`    | Auth state     | After signup              | Authenticated identity                         |

On signup, `visitor_id` is linked to `user_id` via the `visitor_identities` table. Historical anonymous sessions/events are backfilled with the `user_id`.

### 2.2 Automatic Tracking

**Pageview tracking:** A single hook in the root layout fires on every Next.js route change. Captures:

- `page_path`, `previous_page_path` (computed client-side)
- `referrer`, UTM params (on first pageview of session)
- Device context: `device_type`, `screen_width`, `browser`, `os`

**Session lifecycle:** Detect session start (new `session_id`), track last activity, detect session end (30-min inactivity or page unload). Computes: landing page, exit page, pages per session, duration.

**Heartbeat tracking:** Lightweight `engagement.heartbeat` every 30 seconds while the tab is visible. **Does NOT write to events table** — routes directly to session `last_activity_at` update for accurate duration measurement.

**UTM/referrer capture:** On first pageview of a session, extract `utm_source`, `utm_medium`, `utm_campaign` from URL params. Classify `entry_type`: direct | organic | email | shared | utm | notification.

### 2.3 Curated Feature Events (~24)

**Feature interactions:**

| Event                  | Category | Action         | What it tells you              |
| ---------------------- | -------- | -------------- | ------------------------------ |
| Page view              | pageview | view           | Navigation flow, popular pages |
| Map filter change      | feature  | map_filter     | Which metrics users explore    |
| Region click on map    | feature  | region_select  | Geographic interest            |
| Market search          | feature  | search         | Intent signals                 |
| Search result click    | feature  | search_click   | Search effectiveness           |
| Score view             | feature  | score_view     | Score product engagement       |
| Score breakdown expand | feature  | score_expand   | Depth of engagement            |
| Report view            | feature  | report_view    | Report product engagement      |
| Report export          | feature  | report_export  | High-value action              |
| Watchlist add          | feature  | watchlist_add  | Commitment signal              |
| Alert create           | feature  | alert_create   | Retention hook                 |
| Market comparison      | feature  | market_compare | Power user signal              |

**Conversion events:**

| Event                           | Category   | Action             | What it tells you             |
| ------------------------------- | ---------- | ------------------ | ----------------------------- |
| Pricing page view               | conversion | pricing_view       | Purchase intent               |
| Pricing tier click              | conversion | pricing_tier_click | Which tier attracts attention |
| Pricing toggle (annual/monthly) | conversion | pricing_toggle     | Pricing preference            |
| Signup start                    | conversion | signup_start       | Top of funnel                 |
| Signup complete                 | conversion | signup_complete    | Activation                    |
| Trial start                     | conversion | trial_start        | Trial engagement              |
| Upgrade click                   | conversion | upgrade_click      | Upgrade intent                |
| Upgrade complete                | conversion | upgrade_complete   | Revenue event                 |
| Paywall encounter               | conversion | paywall_view       | Gating friction               |

**Engagement events:**

| Event                  | Category   | Action       | What it tells you                     |
| ---------------------- | ---------- | ------------ | ------------------------------------- |
| Scroll depth milestone | engagement | scroll_depth | Content effectiveness (25/50/75/100%) |

**Frustration events:**

| Event                    | Category    | Action       | What it tells you  |
| ------------------------ | ----------- | ------------ | ------------------ |
| Search with zero results | frustration | search_empty | Content gap signal |
| API error shown to user  | frustration | error_shown  | UX friction        |

**Acquisition events:**

| Event              | Category    | Action           | What it tells you           |
| ------------------ | ----------- | ---------------- | --------------------------- |
| Shared link opened | acquisition | shared_link_open | Viral loop tracking         |
| Email link clicked | acquisition | email_click      | Re-engagement effectiveness |

### 2.4 Client-Side Tracker Enhancement

Extends the existing `lib/analytics/tracker.ts`:

- Same batching (50 events / 5 second flush / beacon on unload)
- Adds `client_event_id` generation (timestamp + random) for deduplication
- Adds `visitor_id` from localStorage alongside existing `session_id`
- Adds `previous_page_path` tracking via client-side navigation state
- Heartbeat events intercepted and routed to a separate lightweight endpoint

---

## 3. Database Schema

### 3.1 `user_events` — Unified event store

```sql
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_event_id VARCHAR(50),

  -- Identity
  visitor_id VARCHAR(50) NOT NULL,
  session_id VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  user_tier VARCHAR(20) DEFAULT 'anonymous',

  -- Event classification
  event_category VARCHAR(30) NOT NULL,  -- pageview | feature | conversion | engagement | frustration | acquisition
  event_action VARCHAR(50) NOT NULL,
  event_label VARCHAR(200),
  numeric_value NUMERIC,                -- scroll %, result count, time-on-page seconds

  -- Page context
  page_path VARCHAR(500),
  previous_page_path VARCHAR(500),

  -- Flexible properties
  properties JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (session_id, client_event_id)
);

-- Indexes
CREATE INDEX idx_user_events_session ON user_events(session_id, created_at);
CREATE INDEX idx_user_events_visitor ON user_events(visitor_id, created_at);
CREATE INDEX idx_user_events_category_time ON user_events(event_category, created_at DESC);
CREATE INDEX idx_user_events_user ON user_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_user_events_page ON user_events(page_path, created_at DESC) WHERE event_category = 'pageview';
CREATE INDEX idx_user_events_numeric ON user_events(event_category, event_action, numeric_value) WHERE numeric_value IS NOT NULL;
```

### 3.2 `user_sessions` — Session-level aggregates

```sql
CREATE TABLE user_sessions (
  session_id VARCHAR(50) PRIMARY KEY,
  visitor_id VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  user_tier VARCHAR(20) DEFAULT 'anonymous',

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER DEFAULT 0,

  -- Navigation summary
  landing_page VARCHAR(500),
  exit_page VARCHAR(500),
  page_count INTEGER DEFAULT 0,
  is_bounce BOOLEAN DEFAULT TRUE,
  heartbeat_count INTEGER DEFAULT 0,

  -- Acquisition
  referrer VARCHAR(500),
  referrer_domain VARCHAR(200),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  entry_type VARCHAR(20) DEFAULT 'direct',

  -- Device
  device_type VARCHAR(20),
  screen_width INTEGER,
  browser VARCHAR(50),
  os VARCHAR(50),

  -- Engagement depth
  feature_events_count INTEGER DEFAULT 0,
  unique_features_used INTEGER DEFAULT 0,
  max_scroll_depth INTEGER DEFAULT 0,
  had_frustration_event BOOLEAN DEFAULT FALSE,

  -- Outcome
  converted BOOLEAN DEFAULT FALSE,
  conversion_type VARCHAR(50),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_sessions_visitor ON user_sessions(visitor_id, started_at DESC);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id, started_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_user_sessions_time ON user_sessions(started_at DESC);
CREATE INDEX idx_user_sessions_landing ON user_sessions(landing_page, started_at DESC);
CREATE INDEX idx_user_sessions_source ON user_sessions(entry_type, utm_source, started_at DESC);
CREATE INDEX idx_user_sessions_converted ON user_sessions(converted, started_at DESC) WHERE converted = TRUE;
CREATE INDEX idx_user_sessions_bounce ON user_sessions(is_bounce, started_at DESC);
```

### 3.3 `visitor_identities` — Anonymous-to-user stitching

```sql
CREATE TABLE visitor_identities (
  visitor_id VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  first_seen_at TIMESTAMPTZ NOT NULL,
  identified_at TIMESTAMPTZ DEFAULT NOW(),
  sessions_before_identification INTEGER DEFAULT 0,
  signup_cohort DATE,
  acquisition_source VARCHAR(100),
  PRIMARY KEY (visitor_id, user_id)
);

CREATE INDEX idx_visitor_identities_user ON visitor_identities(user_id);
CREATE INDEX idx_visitor_identities_cohort ON visitor_identities(signup_cohort);
```

### 3.4 `daily_analytics` — Rolled-up aggregates

```sql
CREATE TABLE daily_analytics (
  date DATE NOT NULL,
  metric_name VARCHAR(50) NOT NULL,
  dimension VARCHAR(100) DEFAULT 'all',
  user_tier VARCHAR(20) DEFAULT 'all',
  value NUMERIC NOT NULL,
  PRIMARY KEY (date, metric_name, dimension, user_tier)
);
```

### 3.5 `funnel_definitions` — Custom funnels

```sql
CREATE TABLE funnel_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  steps JSONB NOT NULL,    -- [{event_category, event_action, label}, ...]
  created_by UUID REFERENCES auth.users(id),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.6 `page_classifications` — Page grouping

```sql
CREATE TABLE page_classifications (
  path_pattern VARCHAR(200) PRIMARY KEY,  -- '/markets/*', '/map', '/pricing'
  page_group VARCHAR(50) NOT NULL,        -- 'market_detail', 'tool', 'conversion', 'content'
  page_name VARCHAR(100),
  is_conversion_page BOOLEAN DEFAULT FALSE
);
```

### 3.7 `analytics_annotations` — Timeline markers

```sql
CREATE TABLE analytics_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_date DATE NOT NULL,
  label VARCHAR(200) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_annotations_date ON analytics_annotations(annotation_date);
```

### 3.8 Migration of existing `paywall_events`

- Keep `paywall_events` table (historical data, existing writers)
- One-time migration script copies historical rows into `user_events` with mapped categories
- New paywall tracking writes to `user_events` via the enhanced tracker
- Dashboard reads from `user_events` only
- Eventually deprecate `paywall_events` writes

### 3.9 Data Retention

| Table                   | Retention                | Volume                             |
| ----------------------- | ------------------------ | ---------------------------------- |
| `user_events`           | 90 days raw, then purged | High (thousands/day)               |
| `user_sessions`         | 1 year                   | Low (one row per session)          |
| `daily_analytics`       | Forever                  | Tiny (rows per metric per day)     |
| `visitor_identities`    | Forever                  | Tiny (one row per identified user) |
| `funnel_definitions`    | Forever                  | Tiny (admin-created)               |
| `page_classifications`  | Forever                  | Tiny (admin-seeded)                |
| `analytics_annotations` | Forever                  | Tiny (admin-created)               |

---

## 4. Backend Services

### 4.1 Module Structure

```
packages/backend/src/user-analytics/
  user-analytics.module.ts

  # Ingestion
  event-ingestion.controller.ts         -- POST /api/analytics/events (replaces current)
  event-ingestion.service.ts            -- Validates, deduplicates, writes events + upserts sessions
  session-manager.service.ts            -- Session lifecycle: create, update, close, heartbeat
  identity-stitching.service.ts         -- Links visitor_id -> user_id on signup, backfills history

  # Query services (one per dashboard tab)
  overview-analytics.service.ts         -- KPIs, sparklines, quick funnel
  journey-analytics.service.ts          -- Navigation flows, landing/exit pages, common paths
  retention-analytics.service.ts        -- Cohort matrix, DAU/WAU/MAU, churn signals
  acquisition-analytics.service.ts      -- Traffic sources, attribution, landing page performance
  conversion-analytics.service.ts       -- Full funnel, paywall effectiveness, feature-to-conversion

  # Supporting
  daily-rollup.service.ts              -- Scheduled: aggregates raw -> daily_analytics, purges old events
  funnel-engine.service.ts             -- Evaluates any funnel definition against event data
  page-classifier.service.ts           -- Matches page_path -> page_group via page_classifications

  # Controller
  user-analytics.controller.ts         -- Admin-only endpoints for the dashboard

  # Types
  user-analytics.types.ts
```

### 4.2 Ingestion Flow

```
Client trackEvent()
  -> POST /api/analytics/events (batched, up to 50 events)
  -> @Throttle(100, 60) rate limit per IP
  -> EventIngestionService.ingestBatch(events[])
      1. Validate: required fields, known event_category values, sanitize strings
      2. Reject: malformed events, unknown categories
      3. Bulk INSERT into user_events with ON CONFLICT (session_id, client_event_id) DO NOTHING
      4. For each unique session_id in batch:
         -> SessionManagerService.upsertSession(sessionId, events)
           - First event? INSERT with landing_page, device, acquisition context
           - Subsequent? UPDATE exit_page, page_count, last_activity_at, duration, feature counts
           - page_count > 1? SET is_bounce = FALSE
           - Has frustration event? SET had_frustration_event = TRUE
      5. Return 202 Accepted
```

**Heartbeat handling:** Heartbeat events are intercepted before step 3. They never enter `user_events`. The ingestion service calls `SessionManagerService.updateHeartbeat(sessionId)` which only updates `last_activity_at` and increments `heartbeat_count`.

### 4.3 Identity Stitching

Triggered on signup or login (via auth webhook or signup event):

```
IdentityStitchingService.linkVisitorToUser(visitorId, userId)
  1. INSERT INTO visitor_identities
     - first_seen_at: MIN(started_at) from user_sessions WHERE visitor_id = ?
     - signup_cohort: date_trunc('week', NOW())
     - acquisition_source: entry_type from earliest session
     - sessions_before_identification: COUNT prior sessions
  2. Batch UPDATE user_sessions SET user_id = ? WHERE visitor_id = ? AND user_id IS NULL
     (batches of 1,000 rows, async, logged if > 10,000)
  3. Batch UPDATE user_events SET user_id = ? WHERE visitor_id = ? AND user_id IS NULL
     (same batching strategy)
```

### 4.4 Query Services

All admin-guarded. All cached in Redis (TTLs below).

**OverviewAnalyticsService** — `GET /api/admin/analytics/overview?days=30` — Cache: 5 min

```typescript
interface OverviewData {
  kpis: {
    uniqueVisitors: MetricWithTrend;
    totalSessions: MetricWithTrend;
    avgSessionDuration: MetricWithTrend;
    bounceRate: MetricWithTrend;
    pagesPerSession: MetricWithTrend;
    conversionRate: MetricWithTrend;
  };
  previousPeriodKpis: typeof kpis; // For comparison mode
  sparklines: Record<string, number[]>;
  quickFunnel: FunnelStep[];
  topPages: PageMetric[];
  activeUsersChart: TimeSeriesPoint[];
  goalProgress: GoalProgress[]; // From growth_goals table
  annotations: Annotation[]; // Timeline markers
}
```

**JourneyAnalyticsService** — `GET /api/admin/analytics/journeys?days=30` — Cache: 15 min

```typescript
interface JourneyData {
  landingPages: LandingPageMetric[];
  exitPages: ExitPageMetric[];
  navigationFlows: NavigationFlow[]; // Pre-computed from previous_page_path, no self-join
  commonPaths: PathSequence[];
  avgPagesPerSession: number;
  sessionDurationDistribution: Bucket[];
  annotations: Annotation[];
}
```

Navigation flows query (fast, no self-join):

```sql
SELECT previous_page_path AS from_page, page_path AS to_page, COUNT(*) AS transitions
FROM user_events
WHERE event_category = 'pageview' AND previous_page_path IS NOT NULL AND created_at >= $start
GROUP BY from_page, to_page ORDER BY transitions DESC LIMIT 50;
```

**RetentionAnalyticsService** — `GET /api/admin/analytics/retention?days=90` — Cache: 15 min

```typescript
interface RetentionData {
  cohortMatrix: CohortRow[];
  dauWauMau: { dau: number; wau: number; mau: number; stickiness: number };
  retentionCurves: { tier: string; curve: number[] }[];
  churnSignals: ChurnRiskUser[]; // user_id, last_seen, session_count, tier, top features
  engagementTrend: TimeSeriesPoint[];
  annotations: Annotation[];
}
```

**AcquisitionAnalyticsService** — `GET /api/admin/analytics/acquisition?days=30` — Cache: 15 min

```typescript
interface AcquisitionData {
  trafficSources: SourceMetric[];
  landingPagePerformance: LandingPerf[];
  sourceToConversion: AttributionRow[];
  channelTrend: { channel: string; data: TimeSeriesPoint[] }[];
  annotations: Annotation[];
}
```

**ConversionAnalyticsService** — `GET /api/admin/analytics/conversion?days=30` — Cache: 10 min

```typescript
interface ConversionData {
  fullFunnel: FunnelStep[];
  customFunnels: { name: string; steps: FunnelStep[] }[];
  paywallEffectiveness: PaywallMetric[];
  featureCorrelation: FeatureConvMetric[]; // First-session-only, duration-normalized
  revenueMetrics: { mrr: number; arpu: number; tierDistribution: TierCount[] };
  tierMigration: TierFlow[];
  annotations: Annotation[];
}
```

Feature correlation uses first-session-only analysis with duration normalization:

```sql
WITH first_sessions AS (
  SELECT s.session_id, s.visitor_id, s.converted, s.duration_seconds
  FROM user_sessions s
  INNER JOIN (
    SELECT visitor_id, MIN(started_at) AS first_start
    FROM user_sessions GROUP BY visitor_id
  ) f ON s.visitor_id = f.visitor_id AND s.started_at = f.first_start
  WHERE s.started_at >= $start
)
SELECT
  e.event_action AS feature,
  COUNT(DISTINCT CASE WHEN fs.converted THEN e.visitor_id END)::float /
    NULLIF(COUNT(DISTINCT e.visitor_id), 0) AS converter_rate,
  COUNT(DISTINCT CASE WHEN NOT fs.converted THEN e.visitor_id END)::float /
    NULLIF(COUNT(DISTINCT e.visitor_id), 0) AS non_converter_rate,
  COUNT(DISTINCT e.visitor_id) AS users
FROM user_events e
JOIN first_sessions fs ON e.session_id = fs.session_id
WHERE e.event_category = 'feature'
GROUP BY e.event_action
HAVING COUNT(DISTINCT e.visitor_id) >= 10
ORDER BY (converter_rate - non_converter_rate) DESC;
```

### 4.5 Scheduled Jobs

**Session cleanup** — `@Cron('*/15 * * * *')` (every 15 min):

- Close stale sessions (last_activity_at > 30 min ago)
- Compute final duration_seconds

**Daily rollup** — `@Cron('0 2 * * *')` (2 AM daily):

- Aggregate yesterday's data into `daily_analytics` rows
- Metrics: unique_visitors, sessions, pageviews, signups, bounce_rate, avg_duration, conversion_rate
- Each broken down by: tier, device_type, entry_type, top landing pages
- Purge `user_events` older than 90 days
- Clear all Redis analytics caches

### 4.6 Export Endpoint

`GET /api/admin/analytics/export?section=overview&days=30&format=csv`

Returns CSV for any dashboard section. Headers match the table columns shown in the UI. Admin-guarded.

### 4.7 Enhanced AI Insights

`AiInsightsService.gatherDataSnapshot()` expands to include:

```typescript
const [
  // Existing 8 sources...
  paywallStats, funnelData, revenueData, trialData,
  featureUsage, tierMatrix, userAggregates, growthProgress,
  // New 5 sources...
  overviewData, journeyData, retentionData, acquisitionData, conversionData,
] = await Promise.all([...]);
```

System prompt gets new analysis sections:

- **User Journey Intelligence**: landing pages, navigation flows, drop-off points
- **Retention & Engagement**: cohort health, churn risks, stickiness ratio
- **Acquisition Performance**: which channels bring converting users
- **Feature-to-Conversion Insights**: which product features predict payment

Prompt persona adapts based on the active dashboard tab:

- Overview → General growth strategist
- Journeys → UX/CRO specialist
- Retention → Engagement & lifecycle marketer
- Acquisition → Growth/channel marketer
- Conversion → Revenue optimization specialist

### 4.8 API Endpoints Summary

| Endpoint                                | Auth                  | Service                      | Cache TTL       |
| --------------------------------------- | --------------------- | ---------------------------- | --------------- |
| `POST /api/analytics/events`            | Public (rate-limited) | EventIngestionService        | N/A             |
| `GET /api/admin/analytics/overview`     | Admin                 | OverviewAnalyticsService     | 5 min           |
| `GET /api/admin/analytics/journeys`     | Admin                 | JourneyAnalyticsService      | 15 min          |
| `GET /api/admin/analytics/retention`    | Admin                 | RetentionAnalyticsService    | 15 min          |
| `GET /api/admin/analytics/acquisition`  | Admin                 | AcquisitionAnalyticsService  | 15 min          |
| `GET /api/admin/analytics/conversion`   | Admin                 | ConversionAnalyticsService   | 10 min          |
| `POST /api/admin/analytics/funnels`     | Admin                 | FunnelEngineService          | N/A             |
| `GET /api/admin/analytics/funnels/:id`  | Admin                 | FunnelEngineService          | 10 min          |
| `GET /api/admin/analytics/export`       | Admin                 | Export handler               | N/A             |
| `POST /api/admin/analytics/annotations` | Admin                 | CRUD                         | N/A             |
| `GET /api/admin/analytics/ai-insights`  | Admin                 | AiInsightsService (enhanced) | N/A (streaming) |

All `GET /api/admin/analytics/*` endpoints accept:

- `days` (number) — date range
- `tier` (string) — filter by user tier
- `device` (string) — filter by device type
- `source` (string) — filter by entry type / utm source

---

## 5. Frontend Dashboard

### 5.1 Page Location & Navigation

**Route:** `/admin/analytics` (replaces `/admin/entitlements/analytics`)

**Admin sidebar addition:** "Analytics" with BarChart3 icon, added to the Monitor group between "Dashboard" and "Data Feeds."

### 5.2 Global Controls

```
┌───────────────────────────────────────────────────────────────────┐
│ Analytics                                                         │
│                                                                   │
│ [7d] [30d] [90d] [Custom ▾]   [Compare ◻]   Tier [All ▾]       │
│                                 Device [All ▾]  Source [All ▾]   │
│                                                         [Export] │
├───────────────────────────────────────────────────────────────────┤
│ Overview │ Journeys │ Retention │ Acquisition │ Conversion        │
└───────────────────────────────────────────────────────────────────┘
```

- **Date range**: 7d / 30d / 90d presets + custom date picker
- **Compare toggle**: When active, shows previous period comparison on all charts (dashed overlay) and delta columns in tables
- **Global filters**: Tier, Device, Source — apply to all tabs and all API calls
- **Export button**: Downloads current tab as CSV
- **Tab navigation**: 5 tabs, lazy-loaded (only fetch when selected)

### 5.3 Overview Tab (default)

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Visitors │ │ Sessions │ │ Avg Dur  │ │ Bounce % │ │ Pg/Sess  │ │ Conv %   │
│  1,247   │ │  2,891   │ │  4:32    │ │  38%     │ │  3.7     │ │  4.2%    │
│  +12%    │ │  +8%     │ │  +15%    │ │  -3%     │ │  +0.4    │ │  +0.8%   │
│ [spark]  │ │ [spark]  │ │ [spark]  │ │ [spark]  │ │ [spark]  │ │ [spark]  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘

┌──── Goal Progress ────────────────────────────────────────────────┐
│ 100 paid users by Mar 31    ████████████░░░░░░░░  52/100 (52%)   │
│ Bounce rate < 30%           ██████████████░░░░░░  38% → 30%      │
└───────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐ ┌─────────────────────────────────┐
│ Quick Funnel                    │ │ Active Users (DAU)              │
│                                 │ │                                 │
│ Visitors  ████████████████ 1247 │ │ [line chart with annotations]   │
│ Signups   ██████████        312 │ │ Annotations: "Launched email    │
│ Active    ████████          198 │ │ campaign" appears as vertical   │
│ Paid      ███                52 │ │ dashed line on Feb 15           │
└─────────────────────────────────┘ └─────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│ Top Pages                                                         │
│ Page               Group       Views  Bounce  Avg Time  Conv %   │
│ /                  content      892    42%     1:20      2.1%    │
│ /map               tool         634    18%     8:45      6.3%    │
│ /pricing           conversion   412    55%     2:10      12.8%   │
│ /markets/31080     market       287    22%     5:30      8.1%    │
│ /reports/homeready tool         198    15%     6:15      9.4%    │
│                                                                   │
│ (click any row to filter dashboard to sessions visiting that page)|
└───────────────────────────────────────────────────────────────────┘
```

**Empty state:** "Tracking is active. KPIs will populate as visitors arrive. Share your site to start collecting data."

### 5.4 Journeys Tab

```
┌───────────────────────────────────────────────────────────────────┐
│ Navigation Flow                              [Sankey ▾] [Table]  │
│                                                                   │
│ Progressive 3-column flow:                                        │
│ Landing      ->     Second Page    ->    Third Page / Exit        │
│ ┌─────┐            ┌──────┐              ┌──────┐                │
│ │  /  │━━━━━━━━━▶ │ /map │━━━━━━━━━━━▶ │/mkt/*│                │
│ │     │━━━━▶      │      │━━━━▶        │      │━━▶ [EXIT]      │
│ └─────┘     ┌──────┐    └──────┘   ┌───────┐  └──────┘          │
│             │/price│               │/scores│                      │
│             └──────┘               └───────┘                      │
│                                                                   │
│ Click any node to expand its destinations                         │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────┐ ┌─────────────────────────────────────┐
│ Top Landing Pages         │ │ Top Exit Pages                      │
│                           │ │                                     │
│ /          52% bounce     │ │ /pricing     28% of exits           │
│ /map       18% bounce     │ │ /map         22% of exits           │
│ /pricing   55% bounce     │ │ /            18% of exits           │
│ /blog/x    68% bounce     │ │ /markets/*   15% of exits           │
│                           │ │                                     │
│ (clickable -> filter)     │ │ (clickable -> filter)               │
└───────────────────────────┘ └─────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│ Common Paths (highest converting highlighted)                     │
│ Path                                Sessions  Conv Rate           │
│ / -> /map -> /markets/*             312       8.2%                │
│ / -> /pricing                       287       12.1%               │
│ / -> /map -> /scores/* -> /pricing  142       18.6%  ★ best      │
│ /blog/* -> / -> /map                 98       5.4%                │
│                                                                   │
│ Session Duration: [<30s: 22%] [30s-5m: 41%] [5-15m: 28%] [15m+: 9%]
└───────────────────────────────────────────────────────────────────┘
```

**Flow visualization:** Progressive 3-column layout (top 5 per column). Click a node to expand. Toggle to table view for raw from→to data. Uses `d3-sankey` for the Sankey variant.

**Empty state:** "Navigation flows appear after 50+ sessions. Currently at X/50."

### 5.5 Retention Tab

```
┌───────────────────────────────────────────────────────────────────┐
│ Cohort Retention Matrix                                           │
│                                                                   │
│ Signup Week   Wk1    Wk2    Wk3    Wk4    Wk5    Wk6            │
│ Feb 3        100%    62%    48%    41%    38%    35%             │
│ Feb 10       100%    58%    45%    39%    36%     -              │
│ Feb 17       100%    65%    51%    44%     -      -              │
│ Feb 24       100%    61%    47%     -      -      -              │
│                                                                   │
│ (cells heat-mapped: green -> yellow -> red)                       │
│ (click any cell to see the users in that cohort+week)             │
└───────────────────────────────────────────────────────────────────┘

┌────────────────────────────┐ ┌────────────────────────────────────┐
│ Engagement Health          │ │ Retention by Tier                  │
│                            │ │                                    │
│ DAU:  87                   │ │ [line chart]                       │
│ WAU:  342                  │ │ Pro tier retains ~2x vs Free       │
│ MAU:  1,247                │ │                                    │
│ Stickiness: 6.9% (DAU/MAU)│ │                                    │
└────────────────────────────┘ └────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│ Churn Risk (inactive >14d, previously had 3+ sessions)            │
│ User             Last Seen   Sessions  Tier   Top Features        │
│ u***@email.com   Feb 10      12        Pro    map, scores         │
│ o***@email.com   Feb 8       8         Free   reports             │
│ (emails partially masked for PII protection)                      │
└───────────────────────────────────────────────────────────────────┘
```

**Empty state:** "Cohort data requires 2+ weeks of signups. First cohort will appear on [date]."

### 5.6 Acquisition Tab

```
┌───────────────────────────────┐ ┌─────────────────────────────────┐
│ Traffic Sources               │ │ Channel Trend                   │
│ [bar chart]                   │ │ [multi-line chart with          │
│                               │ │  annotations]                   │
│ Direct     42% ████████      │ │                                 │
│ Organic    31% ██████        │ │ Shows each channel over time    │
│ UTM/Paid   15% ███          │ │ Annotation markers visible      │
│ Email       8% ██           │ │                                 │
│ Shared      4% █            │ │                                 │
└───────────────────────────────┘ └─────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│ Source -> Conversion Attribution                                   │
│                                                                   │
│ Source           Visitors  Signups  Trials  Paid  Conv%   ARPU    │
│ Organic/Google    412       48       22      8    1.9%   $29/mo  │
│ Direct            534       36       15      5    0.9%   $19/mo  │
│ UTM/newsletter    189       32       18     12    6.3%   $49/mo★ │
│ Shared links       52       12        8      4    7.7%   $39/mo  │
│                                                                   │
│ ★ = Highest value (click to filter dashboard to this source)      │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│ Landing Page Performance                                          │
│ Landing Page        Sessions  Bounce  Avg Time  Signups  Conv%   │
│ /                    892      42%     1:20      28       3.1%    │
│ /blog/market-101     156      35%     4:30      18       11.5%  │
│ /pricing              98      55%     2:10      12       12.2%  │
│ /shared/report/x      52      12%     6:45       8       15.4%  │
└───────────────────────────────────────────────────────────────────┘
```

**Empty state:** "Acquisition data appears as visitors arrive. Add UTM parameters to your marketing links for source tracking."

### 5.7 Conversion Tab

```
┌───────────────────────────────────────────────────────────────────┐
│ Full Conversion Funnel                                            │
│                                                                   │
│ Visitors  ████████████████████████████████████████  1,247         │
│ Signups   ██████████████████                         312  25.0%  │
│ Active    ████████████                               198  63.5%  │
│ Trial     ████████                                    98  49.5%  │
│ Paid      ███                                         52  53.1%  │
│                                                                   │
│ (click any stage to see who dropped off and what they did instead)│
└───────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐ ┌───────────────────────────────┐
│ Feature -> Conversion           │ │ Tier Migration                │
│ (first-session analysis)        │ │                               │
│                                 │ │ Free ━━━━━━━▶ Pro      (32)  │
│ Converter vs Non-converter:     │ │ Free ━━━▶ Premium     (12)  │
│            Non-conv  Converters │ │ Pro ━━▶ Premium        (8)  │
│ watchlist  ██        █████████ │ │ Pro ━▶ Free             (3)  │
│ score_view ████      ████████  │ │                               │
│ map_filter ██████    ████████  │ │ Net upgrades: +49             │
│ search     ██████    ███████   │ │ Net downgrades: -3            │
│                                 │ │                               │
│ Gap = signal strength           │ │                               │
└─────────────────────────────────┘ └───────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│ Paywall Effectiveness                                             │
│ Resource            Views  Clicks  CTR     Conversions            │
│ Score Breakdown      892    142    15.9%   18                     │
│ AI Insights          634     98    15.5%   12                     │
│ ZIP-level data       412     67    16.3%    8                     │
│ Custom Reports       287     52    18.1%    6                     │
│                                                                   │
│ Revenue: MRR $2,340 | ARPU $45 | LTV est. $540                  │
└───────────────────────────────────────────────────────────────────┘
```

**Feature correlation visualization:** Horizontal bar chart showing converter vs. non-converter usage rates side by side. The _gap_ between bars is the signal — large gap means the feature strongly predicts conversion.

**Empty state:** "Funnel data requires signups and conversions to populate. Paywall effectiveness data will migrate from existing tracking."

### 5.8 AI Marketing Insights Panel (bottom of every tab)

```
┌───────────────────────────────────────────────────────────────────┐
│ AI Marketing Insights                    [Generate] [Regenerate]  │
│                                                                   │
│ Persona: Growth Strategist (adapts to active tab)                 │
│                                                                   │
│ [Streaming markdown content...]                                   │
│                                                                   │
│ Previously generated insights persist when switching tabs.        │
│ "Generate" triggers fresh analysis with full cross-tab data.      │
│ Persona shifts based on active tab (UX specialist for Journeys,  │
│ revenue optimizer for Conversion, etc.)                           │
│                                                                   │
│ Data sources: ALL tab data + Stripe revenue + trial data +        │
│ feature usage + tier matrix + user aggregates + growth goals      │
│                                                                   │
│ [Copy Prompt] [Save Insight] [View History]                       │
└───────────────────────────────────────────────────────────────────┘
```

**Behavior:**

- Manual trigger only (not auto-run on tab switch)
- Full data snapshot sent to AI regardless of active tab
- System prompt persona adapts to the active tab's focus area
- Previous insights persist when switching tabs
- Save/history functionality preserved from existing implementation
- Copy-prompt workflow preserved from recent refactor

### 5.9 Drill-Down Interaction Model

Every clickable element in tables and charts applies a filter rather than navigating away:

| Click target       | Filter applied                                                       |
| ------------------ | -------------------------------------------------------------------- |
| Landing page row   | `landing_page = '/pricing'`                                          |
| Traffic source row | `source = 'utm/newsletter'`                                          |
| Cohort matrix cell | `cohort = 'Feb 10' AND retained_week = 3` → shows user list          |
| Funnel stage       | `stage = 'signups' AND dropped_off = true` → shows drop-off behavior |
| Page in top pages  | `page_visited = '/map'`                                              |

Filters stack and show as removable chips below the global filter bar. "Clear all" resets to default.

### 5.10 Component Architecture

```
/admin/analytics/
  page.tsx                              -- Tab container + global state
  components/
    AnalyticsDateRange.tsx              -- Date presets + custom picker
    AnalyticsFilterBar.tsx              -- Tier / Device / Source filters + compare toggle
    AnalyticsTabNav.tsx                 -- Tab navigation
    DrillDownChips.tsx                  -- Active drill-down filters display
    AnnotationMarker.tsx                -- Vertical line on time series charts

    overview/
      OverviewTab.tsx
      KpiCardRow.tsx                    -- 6 KPI cards with sparklines + comparison
      GoalProgressBar.tsx               -- Compact goal tracking
      QuickFunnel.tsx
      DauChart.tsx
      TopPagesTable.tsx

    journeys/
      JourneysTab.tsx
      ProgressiveFlow.tsx               -- 3-column flow with expand (d3-sankey optional)
      LandingPagesTable.tsx
      ExitPagesTable.tsx
      CommonPathsTable.tsx
      SessionDurationDist.tsx

    retention/
      RetentionTab.tsx
      CohortMatrix.tsx                  -- Heat-mapped grid with click-to-drill
      EngagementHealth.tsx
      RetentionByCurve.tsx
      ChurnRiskTable.tsx

    acquisition/
      AcquisitionTab.tsx
      TrafficSourcesChart.tsx
      ChannelTrendChart.tsx
      AttributionTable.tsx
      LandingPerfTable.tsx

    conversion/
      ConversionTab.tsx
      FullFunnel.tsx
      FeatureCorrelationChart.tsx       -- Side-by-side bar chart (converter vs non)
      TierMigrationFlow.tsx
      PaywallEffectiveness.tsx
      RevenueMetrics.tsx

    shared/
      MetricCard.tsx                    -- KPI with sparkline + trend + comparison
      FunnelChart.tsx                   -- Reusable horizontal funnel
      TrendLineChart.tsx                -- Line chart with annotation support
      DataTable.tsx                     -- Sortable, clickable, paginated
      EmptyState.tsx                    -- Contextual empty state with progress
      SkeletonLoader.tsx                -- Tab-specific skeleton layouts

    AiInsightsPanel.tsx                 -- Enhanced, bottom of every tab
```

### 5.11 Data Fetching

New fetchers in `lib/data/fetchers/admin-analytics.ts`:

```typescript
export async function fetchOverviewAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<OverviewData>;
export async function fetchJourneyAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<JourneyData>;
export async function fetchRetentionAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<RetentionData>;
export async function fetchAcquisitionAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<AcquisitionData>;
export async function fetchConversionAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<ConversionData>;
export async function exportAnalyticsCsv(
  section: string,
  days: number,
  filters?: AnalyticsFilters,
): Promise<Blob>;
export async function createAnnotation(
  date: string,
  label: string,
): Promise<void>;
export async function createFunnelDefinition(
  name: string,
  steps: FunnelStep[],
): Promise<void>;
```

All exported from `lib/data/index.ts`. React Query hooks per tab with 5-minute stale time matching backend cache.

### 5.12 Loading & Empty States

**Loading:** Each tab has a skeleton layout matching its structure — shimmer cards, shimmer table rows, shimmer chart areas. Content fades in when data arrives.

**Empty states by tab:**

| Tab         | Empty State Message                                     | Progress Indicator                |
| ----------- | ------------------------------------------------------- | --------------------------------- |
| Overview    | "Tracking is active. KPIs populate as visitors arrive." | "X sessions collected so far"     |
| Journeys    | "Navigation flows need 50+ sessions."                   | "X/50 sessions"                   |
| Retention   | "Cohort data needs 2+ weeks of signups."                | "First cohort available [date]"   |
| Acquisition | "Add UTM params to links for source tracking."          | "X sources detected"              |
| Conversion  | "Funnel populates as users sign up and convert."        | "X signups, X conversions so far" |

---

## 6. Implementation Phases (High-Level)

### Phase 1: Foundation (data collection + schema)

- Database migration (all 7 tables)
- Enhanced client-side tracker (visitor_id, pageviews, heartbeat, curated events)
- Event ingestion service (validate, dedup, session upsert)
- Identity stitching service
- Migrate historical paywall_events

### Phase 2: Backend Query Services

- All 5 analytics query services
- Redis caching layer
- Daily rollup job + session cleanup job
- Funnel engine
- Enhanced AI insights data gathering

### Phase 3: Frontend Dashboard

- Page shell (tabs, filters, date range, compare toggle)
- Overview tab (KPIs, funnel, DAU chart, top pages)
- Journeys tab (flow viz, landing/exit, common paths)
- Retention tab (cohort matrix, DAU/WAU/MAU, churn)
- Acquisition tab (sources, attribution, landing perf)
- Conversion tab (funnel, feature correlation, paywall, revenue)
- AI Insights panel (enhanced, wired to all data)
- Empty states, skeletons, drill-down, export, annotations

### Phase 4: Polish

- Instrument all 24 curated events across existing components
- Seed page_classifications with known routes
- Create default funnel definitions
- End-to-end testing
- Deprecate old analytics page route
