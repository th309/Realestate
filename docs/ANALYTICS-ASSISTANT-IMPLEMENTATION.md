# Analytics Assistant - Master Implementation Plan

> **Natural Language Analytics for PropertyIQ**
>
> A conversational AI interface that lets users analyze market data by simply asking questions in plain English.

---

## Table of Contents

1. [Vision & Overview](#vision--overview)
2. [Architecture](#architecture)
3. [Feature Set](#feature-set)
4. [Database Schema](#database-schema)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [Feature Flag System](#feature-flag-system)
8. [Grandfathering System](#grandfathering-system)
9. [Implementation Phases](#implementation-phases)
10. [File Structure](#file-structure)

---

## Vision & Overview

### The Problem

Users have access to rich analytics data but need technical knowledge to query it. They want to ask questions like:
- "Show me Texas metros vs national average"
- "Which markets are undervalued right now?"
- "What's the correlation between our scores and 3-year returns?"

### The Solution

A Claude-powered conversational interface that:
1. Understands natural language queries
2. Translates them to data operations
3. Executes analysis against cached Parquet data
4. Returns results with visualizations
5. Allows saving, sharing, and alerting

### Key Differentiators

- **Visual outputs** - Charts, tables, mini-maps inline
- **Persistent memory** - Saved queries, watchlists, notes
- **Proactive insights** - Alerts when conditions are met
- **Modular & gated** - Tier-based access, admin-configurable
- **Grandfathering support** - Protect early adopters

---

## Architecture

### Hybrid Data Architecture (Option A)

The Analytics Assistant uses a **hybrid architecture** that combines fast cached queries with deep database analysis:

```
┌───────────────────────────────────┐     ┌────────────────────────────────────┐
│     PARQUET CACHE (fast ~50ms)    │     │      SUPABASE (direct 2-5s)       │
│                                   │     │                                    │
│  • PropertyIQ scores              │     │  • zillow_metro/county/zip/state   │
│  • Score components               │     │  • realtor_metro/county            │
│  • Outcomes (appreciation)        │     │  • census_metro/county             │
│                                   │     │  • economic_metro/county           │
│  Used for:                        │     │  • calculated_metrics              │
│  - Backtesting                    │     │                                    │
│  - Rankings                       │     │  Used for:                         │
│  - Compare to benchmark           │     │  - Raw metric analysis             │
│  - Basic filtering                │     │  - Feature discovery               │
│  - Weight optimization            │     │  - Cross-source correlations       │
└───────────────────────────────────┘     └────────────────────────────────────┘
```

### Tool Routing by Question Type

| User Question | Claude's Decision | Python Tool | Speed |
|---------------|-------------------|-------------|-------|
| "Compare Houston to Dallas" | Basic comparison | `analyze_data` (cache) | ~100ms |
| "Top 10 Texas metros" | Rankings needed | `get_rankings` (cache) | ~100ms |
| "What's the score correlation with 3-year returns?" | Stats on cached scores | `run_regression` (cache) | ~500ms |
| "Which RAW Zillow metrics predict appreciation?" | Need raw data from DB | `analyze_raw_metrics` (Supabase) | ~3s |
| "What raw data is available?" | Metadata request | `get_raw_metric_summary` | ~1s |
| "Cluster Texas markets" | ML clustering | `cluster_markets` (cache) | ~500ms |
| "Scatter plot of score vs returns" | Visualization | `generate_chart` | ~500ms |

### Full System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Modular Components (drop anywhere)                                     │ │
│  │  ├─ AnalyticsAssistantButton    - Inline trigger                       │ │
│  │  ├─ AnalyticsAssistantFAB       - Floating action button               │ │
│  │  ├─ AnalyticsAssistantModal     - Modal wrapper                        │ │
│  │  └─ AnalyticsAssistantPanel     - Core chat UI + visual renderers      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Visual Components                                                      │ │
│  │  ├─ ChartRenderer      - Bar, line, scatter, distribution charts       │ │
│  │  ├─ DataTable          - Sortable tables with score formatting         │ │
│  │  ├─ ComparisonCard     - Benchmark comparisons                         │ │
│  │  └─ RankingsList       - Top/bottom performers display                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Feature Gate Layer                                                     │ │
│  │  useFeatures() hook → reads from DB → caches in memory                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NESTJS BACKEND                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  AnalyticsChat Module                                                   │ │
│  │  ├─ analytics-chat.controller.ts    POST /api/analytics/chat/:id       │ │
│  │  ├─ analytics-chat.service.ts       Claude orchestration + tools       │ │
│  │  └─ analytics-tools.service.ts      14 tool definitions + execution    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Features Module (planned)                                              │ │
│  │  ├─ Admin endpoints for tier/feature management                        │ │
│  │  └─ User feature resolution with grandfathering                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PYTHON ANALYTICS SERVICE                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Ad-hoc Analysis Routes (/api/v1/adhoc/*)  [CACHE - FAST]              │ │
│  │  ├─ POST /filter         Filter cached data                            │ │
│  │  ├─ POST /analyze        Run analysis on filtered data                 │ │
│  │  ├─ POST /compare        Compare to benchmarks                         │ │
│  │  ├─ POST /rank           Top/bottom performers                         │ │
│  │  ├─ POST /history        Time-series data                              │ │
│  │  └─ GET  /metadata       Available filters/options                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Advanced Analysis Routes (/api/v1/advanced/*)  [ML TOOLS]             │ │
│  │  ├─ POST /regression          OLS/Ridge regression                     │ │
│  │  ├─ POST /feature-importance  Random Forest importance                 │ │
│  │  ├─ POST /cluster             K-means market clustering                │ │
│  │  ├─ POST /optimize-weights    Score weight optimization                │ │
│  │  ├─ POST /chart               Plotly visualization generation          │ │
│  │  ├─ POST /raw-metrics/analyze Analyze raw metrics (DB query)           │ │
│  │  └─ GET  /raw-metrics/summary List available raw metrics               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Services                                                               │ │
│  │  ├─ AdhocAnalysisService    Parquet cache queries (fast)              │ │
│  │  ├─ AdvancedAnalysisService ML analysis (regression, clustering)      │ │
│  │  └─ RawMetricService        Supabase direct queries for raw data      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │                   │
                     Cache Query         DB Query
                     (Parquet)          (Supabase)
                          │                   │
                          ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE                                           │
│  ┌──────────────────────────┐    ┌───────────────────────────────────────┐ │
│  │  Raw Data Tables         │    │  Config & User Data                    │ │
│  │  • zillow_metro/county   │    │  • Feature configuration               │ │
│  │  • realtor_metro/county  │    │  • Tier settings                       │ │
│  │  • census_metro/county   │    │  • User overrides                      │ │
│  │  • economic_metro/county │    │  • Grandfathering                      │ │
│  │  • calculated_metrics    │    │  • Saved queries, watchlists           │ │
│  │  • propertyiq_scores_*   │    │  • Conversation history                │ │
│  └──────────────────────────┘    └───────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Feature Set

### Core Features (MVP)

| Feature | Description |
|---------|-------------|
| Natural Language Queries | Ask questions in plain English |
| Geographic Filtering | Filter by state, metro, county, zip |
| Score Filtering | Filter by score ranges |
| Benchmark Comparison | Compare to national/regional averages |
| Top/Bottom Rankings | Find best/worst performers |
| Correlation Analysis | Score vs outcome correlations |

### Visual Outputs (Phase 2)

| Feature | Description |
|---------|-------------|
| Inline Charts | Bar charts, line charts, distributions |
| Data Tables | Sortable, filterable result tables |
| Mini-Maps | Geographic visualization of results |
| Score Breakdowns | Component-level score explanations |

### Persistence Features (Phase 3)

| Feature | Description |
|---------|-------------|
| Save Queries | Save frequently-used queries |
| Watchlist | Track specific markets |
| Notes | Attach notes to markets |
| Query History | Access past conversations |

### Proactive Features (Phase 4)

| Feature | Description |
|---------|-------------|
| Alerts | Notify when conditions are met |
| Scheduled Queries | Weekly/monthly reports |
| Score Change Notifications | Alert on significant changes |

### Advanced Features (Phase 5)

| Feature | Description |
|---------|-------------|
| Scenario Modeling | "What if rates drop to 5.5%?" |
| Statistical Deep Dives | Distributions, outliers, significance |
| Custom Screening | Multi-criteria market screens |
| Historical Trends | Time-based analysis |

### Sharing & Export (Phase 6)

| Feature | Description |
|---------|-------------|
| CSV Export | Download results |
| API Export | Programmatic access |
| Google Sheets | Direct export to Sheets |
| Shareable Links | Share analysis with others |
| Team Collaboration | Shared watchlists, queries |

---

## Database Schema

### User Data Tables

```sql
-- ============================================================================
-- SAVED QUERIES
-- ============================================================================
CREATE TABLE analytics_saved_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  query_text TEXT NOT NULL,           -- Natural language query
  query_params JSONB,                 -- Parsed parameters for direct execution
  result_type TEXT,                   -- 'table', 'chart', 'comparison', etc.
  is_favorite BOOLEAN DEFAULT FALSE,
  
  -- Scheduling
  is_scheduled BOOLEAN DEFAULT FALSE,
  schedule_cron TEXT,                 -- '0 9 * * 1' = weekly Monday 9am
  schedule_email BOOLEAN DEFAULT FALSE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  
  -- Metadata
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_queries_user ON analytics_saved_queries(user_id);
CREATE INDEX idx_saved_queries_scheduled ON analytics_saved_queries(is_scheduled, next_run_at) 
  WHERE is_scheduled = TRUE;

-- ============================================================================
-- WATCHLIST
-- ============================================================================
CREATE TABLE analytics_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  geography_type TEXT NOT NULL,       -- 'state', 'metro', 'county', 'zip'
  geography_id TEXT NOT NULL,
  geography_name TEXT,
  
  -- Organization
  tags TEXT[],
  folder TEXT,                        -- Optional folder/group name
  
  -- Tracking
  added_at TIMESTAMPTZ DEFAULT NOW(),
  score_at_add DECIMAL(5,2),          -- Score when added
  
  UNIQUE(user_id, geography_type, geography_id)
);

CREATE INDEX idx_watchlist_user ON analytics_watchlist(user_id);

-- ============================================================================
-- NOTES
-- ============================================================================
CREATE TABLE analytics_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  geography_type TEXT NOT NULL,
  geography_id TEXT NOT NULL,
  content TEXT NOT NULL,
  
  -- Optional reminder
  reminder_at TIMESTAMPTZ,
  reminder_sent BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_user ON analytics_notes(user_id);
CREATE INDEX idx_notes_geography ON analytics_notes(geography_type, geography_id);

-- ============================================================================
-- ALERTS
-- ============================================================================
CREATE TABLE analytics_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  
  -- Condition
  alert_type TEXT NOT NULL,           -- 'threshold', 'change', 'ranking', 'custom'
  condition JSONB NOT NULL,           -- Structured condition definition
  /*
    Examples:
    {"type": "threshold", "metric": "score", "operator": "<", "value": 60, "geography_filter": {"states": ["TX"]}}
    {"type": "change", "metric": "score", "change_type": "percent", "threshold": 10, "direction": "down"}
    {"type": "ranking", "metric": "score", "enters_top": 10}
  */
  
  -- Notification
  notify_email BOOLEAN DEFAULT TRUE,
  notify_inapp BOOLEAN DEFAULT TRUE,
  notify_sms BOOLEAN DEFAULT FALSE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON analytics_alerts(user_id);
CREATE INDEX idx_alerts_active ON analytics_alerts(is_active, last_checked_at) WHERE is_active = TRUE;

-- ============================================================================
-- SHARED LINKS
-- ============================================================================
CREATE TABLE analytics_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,   -- Short URL token
  
  title TEXT,
  description TEXT,
  content_type TEXT NOT NULL,         -- 'comparison', 'analysis', 'query_result'
  content JSONB NOT NULL,             -- The data to display
  
  -- Access control
  is_public BOOLEAN DEFAULT TRUE,
  password_hash TEXT,                 -- Optional password protection
  allowed_emails TEXT[],              -- Or restrict to specific emails
  
  -- Expiration
  expires_at TIMESTAMPTZ,
  max_views INTEGER,
  view_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shares_token ON analytics_shares(share_token);
CREATE INDEX idx_shares_user ON analytics_shares(user_id);

-- ============================================================================
-- CONVERSATION HISTORY
-- ============================================================================
CREATE TABLE analytics_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,      -- Client-generated ID
  
  title TEXT,                         -- Auto-generated or user-set
  messages JSONB NOT NULL DEFAULT '[]',
  context JSONB,                      -- Geography scope, etc.
  
  -- Metadata
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, conversation_id)
);

CREATE INDEX idx_conversations_user ON analytics_conversations(user_id, created_at DESC);
```

### Feature Configuration Tables

```sql
-- ============================================================================
-- SUBSCRIPTION TIERS
-- ============================================================================
CREATE TABLE subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,          -- 'free', 'pro', 'enterprise'
  name TEXT NOT NULL,
  description TEXT,
  
  -- Pricing
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  
  -- Display
  badge_color TEXT,                   -- '#4F46E5'
  display_order INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FEATURE DEFINITIONS
-- ============================================================================
CREATE TABLE feature_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  category TEXT NOT NULL,             -- 'analytics', 'persistence', 'alerts', 'export', 'collaboration'
  value_type TEXT NOT NULL,           -- 'boolean', 'integer', 'string', 'json'
  default_value JSONB,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TIER FEATURES (the matrix)
-- ============================================================================
CREATE TABLE tier_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id UUID REFERENCES subscription_tiers(id) ON DELETE CASCADE,
  feature_id UUID REFERENCES feature_definitions(id) ON DELETE CASCADE,
  value JSONB NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tier_id, feature_id)
);

-- ============================================================================
-- USER FEATURE OVERRIDES
-- ============================================================================
CREATE TABLE user_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_id UUID REFERENCES feature_definitions(id) ON DELETE CASCADE,
  value JSONB NOT NULL,
  
  reason TEXT,                        -- 'beta_tester', 'promotional', 'support'
  granted_by UUID,
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, feature_id)
);

-- ============================================================================
-- GRANDFATHERING
-- ============================================================================
CREATE TABLE user_grandfathering (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  grandfathered_type TEXT NOT NULL,   -- 'pricing', 'tier', 'feature', 'full_plan'
  
  -- For pricing
  original_price_monthly DECIMAL(10,2),
  original_price_yearly DECIMAL(10,2),
  
  -- For tier/full_plan
  original_tier_slug TEXT,
  original_tier_snapshot JSONB,
  
  -- For feature
  feature_id UUID REFERENCES feature_definitions(id),
  original_feature_value JSONB,
  
  -- Metadata
  reason TEXT NOT NULL,               -- 'early_adopter', 'beta_tester', 'pricing_change', 'loyalty'
  notes TEXT,
  
  -- Timing
  grandfathered_at TIMESTAMPTZ DEFAULT NOW(),
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,             -- NULL = forever
  
  -- Who/how
  granted_by UUID,
  grant_source TEXT,                  -- 'manual', 'automated', 'policy'
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  revoke_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grandfather_user ON user_grandfathering(user_id);
CREATE INDEX idx_grandfather_active ON user_grandfathering(user_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- GRANDFATHER POLICIES (automated rules)
-- ============================================================================
CREATE TABLE grandfather_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  trigger_type TEXT NOT NULL,         -- 'price_increase', 'feature_removal', 'signup_before'
  trigger_condition JSONB NOT NULL,
  
  grandfather_type TEXT NOT NULL,
  grandfather_config JSONB,
  
  duration_type TEXT NOT NULL,        -- 'forever', 'fixed_months', 'until_cancel'
  duration_months INTEGER,
  
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PRICING HISTORY
-- ============================================================================
CREATE TABLE pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_slug TEXT NOT NULL,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================
CREATE TABLE feature_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  performed_by UUID,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);
```

### Seed Data

```sql
-- ============================================================================
-- SEED: Tiers
-- ============================================================================
INSERT INTO subscription_tiers (slug, name, description, price_monthly, price_yearly, is_default, display_order, badge_color) VALUES
  ('free', 'Free', 'Basic access to PropertyIQ', 0, 0, TRUE, 1, '#6B7280'),
  ('pro', 'Pro', 'Full analytics and insights', 29, 290, FALSE, 2, '#4F46E5'),
  ('enterprise', 'Enterprise', 'Unlimited access + team features', 99, 990, FALSE, 3, '#059669'),
  ('admin', 'Admin', 'Internal admin access', NULL, NULL, FALSE, 99, '#DC2626');

-- ============================================================================
-- SEED: Feature Definitions
-- ============================================================================
INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  -- Analytics
  ('analytics_assistant_enabled', 'Analytics Assistant Access', 'analytics', 'boolean', 'false'),
  ('analytics_queries_per_day', 'Daily Query Limit', 'analytics', 'integer', '0'),
  ('analytics_queries_per_session', 'Queries Per Session', 'analytics', 'integer', '0'),
  ('analytics_allowed_geographies', 'Allowed Geography Types', 'analytics', 'json', '[]'),
  ('compare_markets_enabled', 'Market Comparisons', 'analytics', 'boolean', 'false'),
  ('compare_markets_limit', 'Max Markets to Compare', 'analytics', 'integer', '0'),
  ('time_history_months', 'Historical Data Access (months)', 'analytics', 'integer', '0'),
  ('scenario_modeling_enabled', 'Scenario Modeling', 'analytics', 'boolean', 'false'),
  ('statistical_deep_dives', 'Statistical Deep Dives', 'analytics', 'boolean', 'false'),
  
  -- Visual
  ('charts_enabled', 'Inline Charts', 'analytics', 'boolean', 'false'),
  ('mini_maps_enabled', 'Mini Maps', 'analytics', 'boolean', 'false'),
  
  -- Persistence
  ('saved_queries_enabled', 'Save Queries', 'persistence', 'boolean', 'false'),
  ('saved_queries_limit', 'Max Saved Queries', 'persistence', 'integer', '0'),
  ('watchlist_enabled', 'Market Watchlist', 'persistence', 'boolean', 'false'),
  ('watchlist_limit', 'Max Watchlist Markets', 'persistence', 'integer', '0'),
  ('notes_enabled', 'Market Notes', 'persistence', 'boolean', 'false'),
  ('conversation_history_enabled', 'Conversation History', 'persistence', 'boolean', 'false'),
  ('conversation_history_days', 'History Retention (days)', 'persistence', 'integer', '0'),
  
  -- Alerts
  ('alerts_enabled', 'Price/Score Alerts', 'alerts', 'boolean', 'false'),
  ('alerts_limit', 'Max Active Alerts', 'alerts', 'integer', '0'),
  ('scheduled_queries_enabled', 'Scheduled Query Reports', 'alerts', 'boolean', 'false'),
  
  -- Export
  ('export_csv_enabled', 'CSV Export', 'export', 'boolean', 'false'),
  ('export_api_enabled', 'API Export', 'export', 'boolean', 'false'),
  ('export_sheets_enabled', 'Google Sheets Export', 'export', 'boolean', 'false'),
  ('share_links_enabled', 'Shareable Links', 'export', 'boolean', 'false'),
  ('share_links_branded', 'Branded Share Links', 'export', 'boolean', 'false'),
  ('scheduled_exports_enabled', 'Scheduled Exports', 'export', 'boolean', 'false'),
  
  -- Collaboration
  ('team_enabled', 'Team Collaboration', 'collaboration', 'boolean', 'false'),
  ('team_members_limit', 'Max Team Members', 'collaboration', 'integer', '0'),
  ('shared_watchlists', 'Shared Watchlists', 'collaboration', 'boolean', 'false');
```

### Database Functions

```sql
-- ============================================================================
-- Get user's effective features (with grandfathering)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_features(p_user_id UUID)
RETURNS TABLE (
  feature_slug TEXT,
  feature_name TEXT,
  category TEXT,
  value_type TEXT,
  value JSONB,
  source TEXT,
  is_grandfathered BOOLEAN,
  grandfather_expires_at TIMESTAMPTZ
) AS $$
DECLARE
  v_tier_slug TEXT;
BEGIN
  SELECT COALESCE(
    (SELECT tier_slug FROM user_profiles WHERE id = p_user_id),
    'free'
  ) INTO v_tier_slug;
  
  RETURN QUERY
  SELECT 
    f.slug,
    f.name,
    f.category,
    f.value_type,
    COALESCE(
      -- 1. User overrides
      (SELECT ufo.value FROM user_feature_overrides ufo 
       WHERE ufo.user_id = p_user_id AND ufo.feature_id = f.id
       AND (ufo.expires_at IS NULL OR ufo.expires_at > NOW())),
      -- 2. Grandfathered features
      (SELECT ug.original_feature_value FROM user_grandfathering ug
       WHERE ug.user_id = p_user_id AND ug.feature_id = f.id
       AND ug.grandfathered_type = 'feature' AND ug.is_active = TRUE
       AND (ug.expires_at IS NULL OR ug.expires_at > NOW())),
      -- 3. Grandfathered tier
      (SELECT (ug.original_tier_snapshot->'features'->>f.slug)::jsonb 
       FROM user_grandfathering ug
       WHERE ug.user_id = p_user_id AND ug.grandfathered_type IN ('full_plan', 'tier')
       AND ug.is_active = TRUE AND (ug.expires_at IS NULL OR ug.expires_at > NOW())
       LIMIT 1),
      -- 4. Current tier
      (SELECT tf.value FROM tier_features tf 
       JOIN subscription_tiers t ON t.id = tf.tier_id
       WHERE t.slug = v_tier_slug AND tf.feature_id = f.id),
      -- 5. Default
      f.default_value
    ) as value,
    CASE
      WHEN EXISTS (SELECT 1 FROM user_feature_overrides ufo 
                   WHERE ufo.user_id = p_user_id AND ufo.feature_id = f.id
                   AND (ufo.expires_at IS NULL OR ufo.expires_at > NOW()))
        THEN 'override'
      WHEN EXISTS (SELECT 1 FROM user_grandfathering ug
                   WHERE ug.user_id = p_user_id 
                   AND (ug.feature_id = f.id OR ug.grandfathered_type IN ('full_plan', 'tier'))
                   AND ug.is_active = TRUE AND (ug.expires_at IS NULL OR ug.expires_at > NOW()))
        THEN 'grandfather'
      WHEN EXISTS (SELECT 1 FROM tier_features tf 
                   JOIN subscription_tiers t ON t.id = tf.tier_id
                   WHERE t.slug = v_tier_slug AND tf.feature_id = f.id)
        THEN 'tier'
      ELSE 'default'
    END as source,
    EXISTS (SELECT 1 FROM user_grandfathering ug
            WHERE ug.user_id = p_user_id 
            AND (ug.feature_id = f.id OR ug.grandfathered_type IN ('full_plan', 'tier'))
            AND ug.is_active = TRUE
            AND (ug.expires_at IS NULL OR ug.expires_at > NOW())) as is_grandfathered,
    (SELECT ug.expires_at FROM user_grandfathering ug
     WHERE ug.user_id = p_user_id 
     AND (ug.feature_id = f.id OR ug.grandfathered_type IN ('full_plan', 'tier'))
     AND ug.is_active = TRUE LIMIT 1) as grandfather_expires_at
  FROM feature_definitions f
  WHERE f.is_active = TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Get user's effective pricing (with grandfathering)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_pricing(p_user_id UUID)
RETURNS TABLE (
  tier_slug TEXT,
  tier_name TEXT,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  is_grandfathered BOOLEAN,
  grandfathered_reason TEXT,
  grandfather_expires_at TIMESTAMPTZ,
  current_price_monthly DECIMAL(10,2),
  current_price_yearly DECIMAL(10,2),
  savings_monthly DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.slug,
    t.name,
    COALESCE(
      (SELECT ug.original_price_monthly FROM user_grandfathering ug
       WHERE ug.user_id = p_user_id AND ug.grandfathered_type = 'pricing'
       AND ug.is_active = TRUE AND (ug.expires_at IS NULL OR ug.expires_at > NOW())
       LIMIT 1),
      t.price_monthly
    ) as price_monthly,
    COALESCE(
      (SELECT ug.original_price_yearly FROM user_grandfathering ug
       WHERE ug.user_id = p_user_id AND ug.grandfathered_type = 'pricing'
       AND ug.is_active = TRUE AND (ug.expires_at IS NULL OR ug.expires_at > NOW())
       LIMIT 1),
      t.price_yearly
    ) as price_yearly,
    EXISTS (SELECT 1 FROM user_grandfathering ug
            WHERE ug.user_id = p_user_id AND ug.grandfathered_type = 'pricing'
            AND ug.is_active = TRUE
            AND (ug.expires_at IS NULL OR ug.expires_at > NOW())) as is_grandfathered,
    (SELECT ug.reason FROM user_grandfathering ug
     WHERE ug.user_id = p_user_id AND ug.grandfathered_type = 'pricing'
     AND ug.is_active = TRUE LIMIT 1) as grandfathered_reason,
    (SELECT ug.expires_at FROM user_grandfathering ug
     WHERE ug.user_id = p_user_id AND ug.grandfathered_type = 'pricing'
     AND ug.is_active = TRUE LIMIT 1) as grandfather_expires_at,
    t.price_monthly as current_price_monthly,
    t.price_yearly as current_price_yearly,
    t.price_monthly - COALESCE(
      (SELECT ug.original_price_monthly FROM user_grandfathering ug
       WHERE ug.user_id = p_user_id AND ug.grandfathered_type = 'pricing'
       AND ug.is_active = TRUE LIMIT 1),
      t.price_monthly
    ) as savings_monthly
  FROM subscription_tiers t
  JOIN user_profiles up ON up.tier_slug = t.slug
  WHERE up.id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## Backend Implementation

### Python Analytics Service

#### Services

| Service | File | Purpose | Data Source |
|---------|------|---------|-------------|
| `AdhocAnalysisService` | `adhoc_analysis_service.py` | Fast filtering, analysis, rankings | Parquet cache |
| `AdvancedAnalysisService` | `advanced_analysis_service.py` | ML analysis (regression, clustering, charts) | Parquet cache |
| `RawMetricService` | `raw_metric_service.py` | Query raw metrics for feature discovery | Supabase direct |

#### API Routes

**Ad-hoc Routes** (`/api/v1/adhoc/*`) - Fast cache queries:
- `GET /metadata` - Available filters and options
- `POST /filter` - Filter dataset and return summary
- `POST /analyze` - Run full analysis on filtered data
- `POST /compare` - Compare to benchmarks
- `POST /rank` - Get top/bottom performers
- `POST /history` - Time series data

**Advanced Routes** (`/api/v1/advanced/*`) - ML and raw metric analysis:
- `POST /regression` - OLS/Ridge regression analysis
- `POST /feature-importance` - Random Forest/Gradient Boosting importance
- `POST /cluster` - K-means market clustering
- `POST /optimize-weights` - Score component weight optimization
- `POST /chart` - Plotly visualization generation
- `POST /raw-metrics/analyze` - Analyze raw metrics from Supabase
- `GET /raw-metrics/summary` - List available raw metrics by source

### NestJS Backend

#### Analytics Chat Module (`packages/backend/src/analytics-chat/`)

| File | Purpose |
|------|---------|
| `analytics-chat.module.ts` | Module definition |
| `analytics-chat.controller.ts` | REST endpoints for chat |
| `analytics-chat.service.ts` | Claude orchestration with tool use + structured data extraction |
| `analytics-tools.service.ts` | 14 tool definitions and execution against Python API |

#### Available Claude Tools (14 total)

**Basic Analysis Tools (cache-based, fast):**
1. `get_available_filters` - Get metadata about available options
2. `filter_geographies` - Filter by geography/state/score
3. `analyze_data` - Run statistical analysis on filtered data
4. `compare_to_benchmark` - Compare to national/regional benchmarks
5. `get_rankings` - Get top/bottom performers
6. `get_time_series` - Historical data for specific geography

**Advanced ML Tools (cache-based):**
7. `run_regression` - OLS/Ridge regression to find predictors
8. `get_feature_importance` - Random Forest/Gradient Boosting feature ranking
9. `cluster_markets` - K-means clustering to find similar markets
10. `optimize_weights` - Find optimal score component weights
11. `generate_chart` - Plotly chart generation (scatter, bar, histogram, box)

**Raw Metric Tools (Supabase direct, slower):**
12. `analyze_raw_metrics` - Find which raw metrics predict appreciation
13. `get_raw_metric_summary` - List available metrics from each data source

#### Features Module (Planned: `packages/backend/src/admin/features/`)

- `features.module.ts` - Module definition
- `features.controller.ts` - Admin endpoints for tier/feature management
- `features.service.ts` - Feature resolution with grandfathering

---

## Frontend Implementation

### Component Structure

```
packages/frontend/components/analytics-assistant/
├── index.ts                        # Public exports
├── types.ts                        # TypeScript types
├── AnalyticsAssistantButton.tsx    # Inline trigger button
├── AnalyticsAssistantFAB.tsx       # Floating action button
├── AnalyticsAssistantModal.tsx     # Modal wrapper
├── AnalyticsAssistantPanel.tsx     # Core chat UI
├── UpgradePrompt.tsx               # Shown to free users
├── hooks/
│   └── useAnalyticsChat.ts         # Chat state management
└── components/
    ├── MessageBubble.tsx           # Message display
    ├── ResultCard.tsx              # Structured result display
    ├── ChartRenderer.tsx           # Inline charts
    ├── TableRenderer.tsx           # Data tables
    └── StarterPrompts.tsx          # Suggestion chips
```

### Usage Examples

```tsx
// Anywhere in the app - button trigger
import { AnalyticsAssistantButton } from '@/components/analytics-assistant';

<AnalyticsAssistantButton />

// Floating action button (in layout)
import { AnalyticsAssistantFAB } from '@/components/analytics-assistant';

<AnalyticsAssistantFAB position="bottom-right" />

// Context-aware (on a report page)
<AnalyticsAssistantButton 
  context={{
    geographyType: 'metro',
    geographyId: '12420',
    geographyName: 'Austin, TX'
  }}
  starterPrompts={[
    'How does Austin compare to other Texas metros?',
    'What is Austin historical performance?',
  ]}
/>
```

### Feature Access Hook

```typescript
// packages/frontend/lib/hooks/useFeatures.ts

export function useFeatures(userId?: string): FeaturesState {
  // Calls get_user_features RPC
  // Returns helpers: isEnabled(), getLimit(), getValue()
}

// Usage
const { isEnabled, getLimit } = useFeatures(userId);

if (!isEnabled('analytics_assistant_enabled')) {
  return <UpgradePrompt />;
}

const dailyLimit = getLimit('analytics_queries_per_day'); // -1 = unlimited
```

---

## Feature Flag System

### Admin Dashboard (`/admin/features`)

1. **Tier Management** - Add/edit subscription tiers with pricing
2. **Feature Matrix** - Visual grid to toggle features per tier
3. **User Overrides** - Grant/revoke individual user access
4. **Grandfathering** - Manage grandfather policies and records
5. **Audit Log** - Track all configuration changes

### Feature Resolution Priority

1. **User Overrides** (highest) - Individual grants/revokes
2. **Grandfathered Features** - Preserved from old tiers
3. **Grandfathered Tier** - Full tier snapshot preserved
4. **Current Tier Features** - From tier_features table
5. **Default Value** (lowest) - From feature_definitions

---

## Grandfathering System

### Grandfathering Types

| Type | Description | Use Case |
|------|-------------|----------|
| `pricing` | Lock in old price | Price increases |
| `feature` | Keep specific feature | Feature moved to higher tier |
| `tier` | Keep entire tier config | Tier restructuring |
| `full_plan` | Lifetime access | Beta testers, lifetime deals |

### Grandfathering Durations

- **forever** - Never expires
- **until_cancel** - Lost if subscription cancelled
- **fixed_months** - Expires after X months

### Admin Capabilities

1. **Price Increase Flow** - Auto-grandfather existing subscribers
2. **Feature Removal Flow** - Grandfather users who had the feature
3. **Manual Grants** - Individual user overrides
4. **Bulk Import** - CSV upload for promotions
5. **Policy Engine** - Automated rules (e.g., "signup before X date")

### User-Facing Display

Show grandfathered status in account settings:
- What's grandfathered
- Original vs current pricing
- Expiration date (if any)
- Monthly savings amount

---

## Implementation Phases

### Phase 1: Core MVP ✅ COMPLETE

- [x] Python adhoc analysis service (`adhoc_analysis_service.py`)
- [x] Python API routes (`/api/v1/adhoc/*`)
- [x] NestJS analytics-chat module (4 files)
- [x] Claude tool definitions (6 basic tools)
- [x] Basic chat UI (text responses)
- [x] Database tables for features (2 migrations)
- [x] **ADDED:** Advanced ML analysis service (`advanced_analysis_service.py`)
- [x] **ADDED:** Raw metric service (`raw_metric_service.py`) - Hybrid Architecture
- [x] **ADDED:** Advanced API routes (`/api/v1/advanced/*`)
- [x] **ADDED:** 8 additional Claude tools (regression, clustering, charts, raw metrics)

**Deliverable:** Working NL query → text response with full ML capabilities

### Phase 2: Visual Outputs ✅ COMPLETE

- [x] Chart rendering component (bar, line, scatter, distribution)
- [x] Data table component (sortable, with score/percent formatting)
- [x] Comparison card component (benchmark comparisons)
- [x] Rankings list component (top/bottom performers)
- [x] Structured data extraction in backend
- [x] Frontend renders visuals inline with messages

**Deliverable:** Rich visual responses inline

### Phase 3: Persistence (IN PROGRESS)

- [ ] Save queries functionality
- [ ] Watchlist CRUD
- [ ] Notes on markets
- [ ] Conversation history storage
- [ ] Query history sidebar

**Deliverable:** Users can save and retrieve their work

### Phase 4: Admin & Features

- [ ] Feature management admin dashboard
- [ ] Tier configuration UI
- [ ] User override management
- [ ] Frontend feature gating (useFeatures hook)
- [ ] Upgrade prompts

**Deliverable:** Admin can configure tiers without code

### Phase 5: Grandfathering

- [ ] Grandfathering database functions
- [ ] Policy engine
- [ ] Admin grandfathering dashboard
- [ ] User-facing grandfather display
- [ ] Automated triggers (price increase, feature removal)

**Deliverable:** Full grandfathering support

### Phase 6: Alerts & Export

- [ ] Alert creation UI
- [ ] Alert checking background job
- [ ] Email notifications
- [ ] CSV export
- [ ] Shareable links
- [ ] Scheduled queries

**Deliverable:** Proactive features working

### Phase 7: Polish & Advanced

- [ ] Scenario modeling
- [ ] Statistical deep dives
- [ ] Google Sheets integration
- [ ] Team collaboration features
- [ ] Performance optimization
- [ ] Mobile responsiveness

---

## File Structure

### Files Created (Phase 1 & 2) ✅

```
packages/
├── backend/
│   └── src/
│       └── analytics-chat/
│           ├── analytics-chat.module.ts      ✅ Module definition
│           ├── analytics-chat.controller.ts  ✅ REST endpoints
│           ├── analytics-chat.service.ts     ✅ Claude orchestration + structured data
│           └── analytics-tools.service.ts    ✅ 14 tool definitions
│
├── propertyiq-analytics/
│   └── app/
│       ├── services/
│       │   ├── adhoc_analysis_service.py     ✅ Cache-based analysis
│       │   ├── advanced_analysis_service.py  ✅ ML analysis (regression, clustering)
│       │   └── raw_metric_service.py         ✅ Supabase direct queries
│       └── api/
│           └── routes/
│               ├── adhoc.py                   ✅ Ad-hoc analysis routes
│               └── advanced.py                ✅ ML and raw metric routes
│
└── frontend/
    ├── components/
    │   └── analytics-assistant/
    │       ├── index.ts                       ✅ Public exports
    │       ├── types.ts                       ✅ TypeScript types + StructuredData
    │       ├── AnalyticsAssistantButton.tsx   ✅ Trigger button
    │       ├── AnalyticsAssistantModal.tsx    ✅ Modal wrapper
    │       ├── AnalyticsAssistantPanel.tsx    ✅ Chat UI with visual rendering
    │       ├── hooks/
    │       │   └── useAnalyticsChat.ts        ✅ Chat state management
    │       └── visuals/
    │           ├── index.ts                   ✅ Visual exports
    │           ├── ChartRenderer.tsx          ✅ Bar/line/scatter/distribution
    │           ├── DataTable.tsx              ✅ Sortable data tables
    │           └── ComparisonCard.tsx         ✅ Benchmark comparisons
    └── app/
        ├── api/analytics/chat/
        │   ├── [conversationId]/route.ts      ✅ Chat API proxy
        │   └── health/route.ts                ✅ Health check proxy
        └── test-analytics/
            └── page.tsx                       ✅ Test page for components
```

### Files to Create (Remaining Phases)

```
packages/
├── backend/
│   └── src/
│       └── admin/
│           └── features/                      ⏳ Phase 4
│               ├── features.module.ts
│               ├── features.controller.ts
│               └── features.service.ts
│
└── frontend/
    ├── components/
    │   └── analytics-assistant/
    │       └── UpgradePrompt.tsx              ⏳ Phase 4
    ├── lib/
    │   ├── features/
    │   │   └── analytics-assistant.ts         ⏳ Phase 4
    │   └── hooks/
    │       └── useFeatures.ts                 ⏳ Phase 4
    └── app/
        └── admin/
            ├── features/page.tsx              ⏳ Phase 4
            └── grandfathering/page.tsx        ⏳ Phase 5
```

### Files Modified

```
packages/backend/src/app.module.ts          ✅ Added AnalyticsChatModule
packages/propertyiq-analytics/app/main.py   ✅ Added adhoc + advanced routers
packages/backend/.env                        ✅ Added ANTHROPIC_API_KEY, ANALYTICS_SERVICE_URL
```

### Database Migrations Created ✅

```
PropertyIQ/supabase/migrations/
├── 20240101005600_create-analytics-assistant-tables.sql  ✅ User data + feature config
└── 20240101005700_seed-feature-configuration.sql         ✅ Tiers + 31 feature definitions
```

---

## Feature Matrix Reference

| Feature | Free | Pro | Enterprise |
|---------|:----:|:---:|:----------:|
| Analytics Assistant | ❌ | ✅ | ✅ |
| Queries/Day | 0 | 20 | ∞ |
| Geography Types | - | State, Metro | All |
| Comparisons | ❌ | ✅ (5) | ✅ (∞) |
| History Access | - | 12 mo | Full |
| Charts | ❌ | ✅ | ✅ |
| Save Queries | ❌ | ✅ (10) | ✅ (∞) |
| Watchlist | ❌ | ✅ (20) | ✅ (∞) |
| Notes | ❌ | ✅ | ✅ |
| Alerts | ❌ | ✅ (5) | ✅ (∞) |
| Scheduled Queries | ❌ | ❌ | ✅ |
| Scenario Modeling | ❌ | ❌ | ✅ |
| Deep Statistics | ❌ | ❌ | ✅ |
| CSV Export | ❌ | ✅ | ✅ |
| API Export | ❌ | ❌ | ✅ |
| Sheets Export | ❌ | ❌ | ✅ |
| Share Links | ❌ | ✅ | ✅ (Branded) |
| Team Features | ❌ | ❌ | ✅ |

> **Note:** All limits are configurable via admin dashboard. `-1` = unlimited.

---

## Example Conversations

### Basic Query
```
User: "Show me the top 10 metros by InvestorEdge score"