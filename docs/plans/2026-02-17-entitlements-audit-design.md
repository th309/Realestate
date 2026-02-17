# Entitlements Audit & Fix Design

**Date:** 2026-02-17
**Status:** Approved
**Approach:** Hybrid (DB cleanup + full frontend enforcement + pricing sync)

## Problem

The entitlements system has accumulated inconsistencies that make the admin tiers page unreliable as a source of truth:

1. Duplicate features (`analytics_assistant_enabled` vs `feature_analytics_assistant`) with contradictory values
2. Type mismatches (`time_history_months` stores `true` instead of an integer)
3. Frontend enforcement gaps (hardcoded tier in StepTemplate, missing gate on report viewer)
4. Pricing page is entirely hardcoded, doesn't reflect tiers page changes
5. Preview limits exist in DB but aren't enforced
6. Unbuilt features clutter the tiers page with no visual distinction from active ones

## Goal

The admin tiers page becomes the single source of truth. Drag a feature between tiers and it automatically reflects across the entire site and the pricing page.

---

## Section 1: Database Cleanup

### 1a. Remove duplicate features

Delete these from `tier_features` and set `is_active = false` in `feature_definitions`:

| Slug | Reason |
|---|---|
| `analytics_assistant_enabled` | Duplicate of `feature_analytics_assistant` |
| `export_csv_enabled` | Duplicate of `feature_export_csv` |
| `analytics_allowed_geographies` | Overlaps with `geo_*` features |
| `time_history_months` | Broken type (boolean in integer field); overlaps with `preview_timeseries_months` |
| `metric_custom_analytics` | Not a real metric |

### 1b. Add `is_enforced` column to `feature_definitions`

```sql
ALTER TABLE feature_definitions ADD COLUMN is_enforced BOOLEAN DEFAULT true;
```

Set `is_enforced = false` on unbuilt features so they appear in the "Planned" section:

- `export_sheets_enabled`, `export_api_enabled`, `scheduled_exports_enabled`
- `share_links_enabled`, `share_links_branded`
- `watchlist_enabled`, `watchlist_limit`, `notes_enabled`
- `saved_queries_enabled`, `saved_queries_limit`
- `alerts_enabled`, `alerts_limit`, `scheduled_queries_enabled`
- `team_enabled`, `team_members_limit`, `shared_watchlists`

Quinn features stay `is_enforced = true` (even though enforcement is partial) since Quinn is actively being developed:
- `analytics_queries_per_day`, `analytics_queries_per_session`
- `charts_enabled`, `compare_markets_enabled`, `compare_markets_limit`
- `mini_maps_enabled`, `scenario_modeling_enabled`, `statistical_deep_dives`
- `conversation_history_enabled`, `conversation_history_days`

### 1c. Fix tier values

| Feature | Change |
|---|---|
| `feature_analytics_assistant` | Set Pro value to `true` (was `false`) |

### 1d. Add new features

| Slug | Name | Type | Category | Free | Pro | Enterprise |
|---|---|---|---|---|---|---|
| `preview_reports_limit` | Report Generation Limit | integer | preview | 2 | -1 | -1 |

### 1e. Clean up feature names in DB

Improve `name` field for clarity on the admin tiers page. Examples:
- "Grm Metric" -> "Gross Rent Multiplier"
- "Mf Permits Metric" -> "Multi-Family Permits"
- "Sf Mf Ratio Metric" -> "SF/MF Permit Ratio"
- "Piq Score" -> "PropertyIQ Composite Score"
- "Home Value Mom Metric" -> "Home Value MoM Change"

---

## Section 2: Frontend Enforcement

### 2a. Fix broken enforcement

**`StepTemplate.tsx` line 196** — hardcoded `currentTier = 'pro'`
- Replace with `useEntitlements()` to read actual tier
- Templates with `tier_required` above user's tier show lock icon

**`/reports/[id]` (report viewer)** — no entitlement gate
- Wrap in `EntitlementGate type="feature" id="reports"`
- Free users who hit a report URL see a paywall with sample report option

**`EntitlementsContext.tsx` line 51** — hardcoded FEATURES array
- Keep the array but ensure it stays in sync with `feature_definitions` where `category = 'features'`
- Consider fetching this list from the API in a future iteration

### 2b. Wire preview limits

**New DB table: `user_feature_usage`**

```sql
CREATE TABLE user_feature_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feature_slug TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  period TEXT DEFAULT 'lifetime',  -- 'lifetime' | 'monthly' | 'daily'
  period_start TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, feature_slug, period, period_start)
);
```

**Enforcement points:**

| Limit Feature | Where Enforced | At-Limit Behavior |
|---|---|---|
| `preview_reports_limit` | Report generation button (`/reports`) | "You've used 2/2 free reports. Upgrade for unlimited." |
| `preview_markets_limit` | Market page navigation / map click | After N markets, show paywall overlay |
| `preview_metrics_limit` | Map metric selector / graphs metric picker | After N gated metrics, lock remaining with paywall |
| `preview_timeseries_months` | Time-series chart data fetch | Truncate to N months, show "Upgrade for full history" |

**New `EntitlementsContext` method:**
- `getRemainingUsage(featureSlug)` — compares limit from DB to usage count
- `incrementUsage(featureSlug)` — bumps counter after allowed action

### 2c. All enforcement points

| Page/Component | Gate | Status | Action |
|---|---|---|---|
| `/reports` (list) | `feature:reports` | Working | None |
| `/reports/[id]` (viewer) | `feature:reports` | **Missing** | Add gate |
| `/reports` StepTemplate | Template tier check | **Hardcoded** | Use entitlements |
| `/market/[id]` AI section | `feature:ai_insights` | Working | None |
| Map metric selector | `metric:*` | Working | None |
| Map geo level pills | `geo:*` | Working | None |
| Graphs score cards | `feature:scores` | Working | None |
| Graphs share/save buttons | `feature:export_csv` | Working | None |
| Quinn floating button | `feature:analytics_assistant` | Working | None |
| Time-series data | `preview_timeseries_months` | **Not enforced** | Add truncation |
| Market exploration | `preview_markets_limit` | **Not enforced** | Add counter |
| Report generation | `preview_reports_limit` | **Doesn't exist** | Add feature + counter |

---

## Section 3: Pricing Page Sync

### 3a. Current state

The pricing page (`/pricing/page.tsx`) has a hardcoded `PLANS` array with static feature bullet points. Changes on the tiers admin page don't reflect here.

### 3b. Changes

**Auto-generate plan comparison cards from DB:**

1. New API endpoint: `GET /api/admin/features/pricing-summary`
   - Returns structured comparison grouped by category
   - Reads from same `tier_features` + `feature_definitions` tables
2. Pricing page fetches this on load
3. Plan cards (Free / Pro / Enterprise) dynamically render feature bullets
4. Plan names, prices, descriptions come from `subscription_tiers` table

**Keep editorial sections as-is:**
- The hand-crafted marketing sections (AI Analysis, Scores, Reports, Geo Depth) stay as manual copy
- They sell the product well and shouldn't be auto-generated

**Fix inaccuracies:**
- Free tier claims "400+ metro-level dashboards" but `geo_metro = false` for free — fix copy
- "Team" tier label should match DB tier name or be separately configurable

### 3c. Auto-generated vs manual

| Element | Source |
|---|---|
| Plan card feature bullets | Auto from `tier_features` |
| Plan names, prices | From `subscription_tiers` |
| "Current Plan" badge | From `EntitlementsContext` (already works) |
| Feature showcase sections | Manual marketing copy |
| CTAs, trial messaging | Manual |

---

## Section 4: Tiers Admin Page Improvements

### 4a. Planned Features section

Features with `is_enforced = false` appear in a separate "Planned / To Be Built" section below the three tier columns:

- Shows which tier each planned feature is pre-assigned to
- Still draggable between tiers for pre-configuration
- When feature is built, set `is_enforced = true` and it moves to active columns
- Tier assignment is preserved

### 4b. UX improvements

1. **Tooltip on hover** — show `feature.description` and `feature.slug`
2. **Integer features get inline number inputs** — for limits like `preview_reports_limit`, `analytics_queries_per_day`, show editable number instead of just a draggable chip. `-1` = unlimited.
3. **Better category labels** — "Quinn Analytics" instead of "analytics", "Page Access" instead of "features"
4. **"Coming Soon" badge** — subtle indicator on Quinn features that are active in DB but not fully enforced yet

### 4c. Layout

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│    Free      │  │     Pro     │  │  Enterprise  │
│  ~68 active  │  │  ~78 active │  │  ~80 active  │
│  features    │  │  features   │  │  features    │
│  (draggable) │  │  (draggable)│  │  (draggable) │
└─────────────┘  └─────────────┘  └─────────────┘

━━━ Planned Features (not yet enforced) ━━━━━━━━━━
  Export: Google Sheets, API, Scheduled       [Pro]
  Sharing: Links, Branded Links         [Pro/Ent.]
  Persistence: Watchlist, Notes, Queries      [Pro]
  Alerts: Price Alerts, Scheduled          [Pro/E]
  Collaboration: Teams, Shared Lists   [Enterprise]
  (draggable between tiers for pre-config)
```

---

## Out of Scope

- Stripe integration (still TODO in EntitlementsService)
- Auth context for real user IDs (currently hardcoded)
- Quinn rate limiting enforcement (keeping the DB features but not wiring rate limits yet)
- Building the unbuilt features (exports, watchlist, notes, alerts, teams)

## Files Affected

**Backend:**
- `packages/backend/src/admin/features/features.service.ts` — add `is_enforced` to matrix query
- `packages/backend/src/admin/features/features.controller.ts` — new pricing-summary endpoint
- `packages/backend/src/entitlements/entitlements.service.ts` — no changes needed
- New migration for `is_enforced` column and `user_feature_usage` table

**Frontend:**
- `packages/frontend/app/dev/admin/entitlements/tiers/page.tsx` — planned section, tooltips, number inputs
- `packages/frontend/app/reports/page.tsx` — wire preview limits
- `packages/frontend/app/reports/[id]/*` — add EntitlementGate
- `packages/frontend/app/reports/components/wizard/StepTemplate.tsx` — remove hardcoded tier
- `packages/frontend/app/pricing/page.tsx` — auto-generate plan cards from API
- `packages/frontend/lib/entitlements/EntitlementsContext.tsx` — add usage tracking methods
- `packages/frontend/lib/entitlements/types.ts` — add usage types

**Database:**
- Migration: add `is_enforced` column to `feature_definitions`
- Migration: create `user_feature_usage` table
- Migration: add `preview_reports_limit` feature
- Data fix: remove duplicate features, fix `feature_analytics_assistant` for Pro
- Data fix: clean up feature display names
