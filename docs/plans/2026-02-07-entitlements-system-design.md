# Entitlements System Design

> Feature gating, monetization, and growth tools for PropertyIQ

**Date:** 2026-02-07
**Status:** Draft
**Author:** Troy + Claude

---

## 1. Overview

### Problem

PropertyIQ needs to monetize its real estate analytics platform with a freemium model. Some features, metrics, and geography levels should be free, others should be teasers (limited preview), and others should be paid. The system must be configurable without code changes and automatically propagate to all pages including the pricing page.

### Solution

A three-layer entitlements system:

1. **Config file** - Default entitlements, version controlled
2. **Dev admin** - Test configurations before going live
3. **Prod admin** - Live changes without deploy

Plus analytics, automation rules, and a monetization playbook to optimize conversions.

### User Tiers

| Tier | Description |
|------|-------------|
| **Free** | Single user, limited features/data |
| **Pro** | Single user, full access |
| **Enterprise** | Multiple users under one account (team management deferred) |

### Gated Dimensions

| Dimension | Example |
|-----------|---------|
| **Metrics** | `home_value` = free, `rental_yield` = pro |
| **Geographies** | Metro = free, Zip = pro |
| **Features** | Map = free, AI Quinn = pro, API Access = enterprise |

### Access Levels

| Level | Behavior |
|-------|----------|
| **full** | Complete access |
| **preview** | Show first N results, then paywall |
| **none** | Hidden or blocked entirely |

---

## 2. Data Model

### 2.1 Database Schema

```sql
-- ============================================================================
-- ENTITLEMENTS SCHEMA
-- ============================================================================

-- Tiers enum
CREATE TYPE user_tier AS ENUM ('free', 'pro', 'enterprise');

-- Resource types that can be gated
CREATE TYPE resource_type AS ENUM ('metric', 'geography', 'feature');

-- Access levels
CREATE TYPE access_level AS ENUM ('full', 'preview', 'none');

-- Source of the rule (for layered config)
CREATE TYPE rule_source AS ENUM ('default', 'override');

-- Environment for overrides
CREATE TYPE environment AS ENUM ('dev', 'prod');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Features registry (admin-managed)
CREATE TABLE features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entitlement rules (what each tier can access)
CREATE TABLE entitlement_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier user_tier NOT NULL,
  resource_type resource_type NOT NULL,
  resource_id VARCHAR(100) NOT NULL,
  access access_level NOT NULL DEFAULT 'none',
  preview_limit INTEGER,  -- For 'preview' access, how many to show
  source rule_source NOT NULL DEFAULT 'default',
  environment environment,  -- NULL for defaults, 'dev'/'prod' for overrides
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per tier/resource/source/environment
  UNIQUE(tier, resource_type, resource_id, source, environment)
);

-- Index for fast lookups
CREATE INDEX idx_entitlement_rules_lookup
  ON entitlement_rules(tier, resource_type, resource_id);

-- ============================================================================
-- USER OVERRIDES
-- ============================================================================

-- Per-user tier overrides (beta testers, VIPs, demos)
CREATE TABLE user_tier_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email VARCHAR(255),  -- Can set by email before user exists
  tier user_tier NOT NULL,
  expires_at TIMESTAMPTZ,  -- NULL = never expires
  reason VARCHAR(255),  -- "Beta tester", "VIP", "Demo"
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Either user_id or email must be set
  CHECK (user_id IS NOT NULL OR email IS NOT NULL)
);

-- ============================================================================
-- FREE TRIAL
-- ============================================================================

CREATE TABLE trial_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN DEFAULT false,
  duration_days INTEGER DEFAULT 14,
  trial_tier user_tier DEFAULT 'pro',
  show_banner BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE user_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tier user_tier NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  converted_at TIMESTAMPTZ,  -- When they upgraded
  cancelled_at TIMESTAMPTZ,  -- When trial was cancelled

  UNIQUE(user_id)
);

-- ============================================================================
-- ANALYTICS
-- ============================================================================

-- Track paywall hits for analytics
CREATE TABLE paywall_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id VARCHAR(100),  -- For anonymous users
  resource_type resource_type NOT NULL,
  resource_id VARCHAR(100) NOT NULL,
  user_tier user_tier NOT NULL,
  page_path VARCHAR(500),
  event_type VARCHAR(50) NOT NULL,  -- 'view', 'click_upgrade', 'dismiss'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX idx_paywall_events_resource
  ON paywall_events(resource_type, resource_id, created_at);
CREATE INDEX idx_paywall_events_time
  ON paywall_events(created_at);

-- ============================================================================
-- AUTOMATIONS
-- ============================================================================

CREATE TYPE automation_status AS ENUM ('active', 'paused', 'draft');

CREATE TABLE automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status automation_status DEFAULT 'draft',
  trigger_type VARCHAR(100) NOT NULL,  -- 'paywall_count', 'inactive_days', 'trial_ending', etc.
  trigger_config JSONB NOT NULL,  -- Trigger-specific parameters
  action_type VARCHAR(100) NOT NULL,  -- 'send_email', 'apply_discount', etc.
  action_config JSONB NOT NULL,  -- Action-specific parameters
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track automation executions
CREATE TABLE automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES automations(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  status VARCHAR(50) NOT NULL,  -- 'success', 'failed', 'skipped'
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 Metrics Sync

Metrics are defined in `lib/data/registry.ts` and synced to the entitlements system on deploy. This ensures code remains the source of truth for metric definitions while allowing tier configuration in admin.

```typescript
// Sync script runs on deploy
async function syncMetricsToEntitlements() {
  const metricsFromRegistry = getAllMetricIds(); // From registry.ts

  for (const metricId of metricsFromRegistry) {
    // Ensure metric exists in entitlement_rules with default tier
    await upsertDefaultRule({
      resourceType: 'metric',
      resourceId: metricId,
      tier: 'free',  // Default to free, admin can change
      access: 'full',
    });
  }
}
```

---

## 3. Backend API Design

### 3.1 API Endpoints

Base path: `/api/admin/entitlements`

#### Rules Management

```
GET    /rules                    # List all rules (with tier/type filters)
GET    /rules/effective          # Get effective rules (defaults + overrides merged)
POST   /rules                    # Create/update rule
DELETE /rules/:id                # Delete override (can't delete defaults)

GET    /rules/export             # Export as JSON (for config file)
POST   /rules/import             # Import from JSON
```

#### Features Management

```
GET    /features                 # List all features
POST   /features                 # Create feature
PUT    /features/:id             # Update feature
DELETE /features/:id             # Archive feature (soft delete)
```

#### User Overrides

```
GET    /user-overrides           # List all overrides
POST   /user-overrides           # Create override
DELETE /user-overrides/:id       # Remove override
```

#### Trial Configuration

```
GET    /trial/config             # Get trial settings
PUT    /trial/config             # Update trial settings
GET    /trial/users              # List users on trial
POST   /trial/users/:id/extend   # Extend a user's trial
```

#### Analytics

```
GET    /analytics/summary        # Paywall hits, conversions, rates
GET    /analytics/top-blocked    # Most blocked resources
GET    /analytics/top-converters # Highest converting resources
GET    /analytics/recommendations # AI-generated suggestions
GET    /analytics/events         # Raw event stream (paginated)
```

#### Automations

```
GET    /automations              # List all automations
POST   /automations              # Create automation
PUT    /automations/:id          # Update automation
DELETE /automations/:id          # Delete automation
POST   /automations/:id/activate # Activate
POST   /automations/:id/pause    # Pause
GET    /automations/:id/runs     # Get run history
```

### 3.2 Public API (for frontend)

Base path: `/api/entitlements`

```
GET    /check                    # Check access for current user
       ?resources=metric:home_value,geo:zip,feature:ai_insights

       Response:
       {
         "tier": "free",
         "access": {
           "metric:home_value": { "level": "full" },
           "metric:rental_yield": { "level": "preview", "limit": 3 },
           "geo:zip": { "level": "none" },
           "feature:ai_insights": { "level": "none", "tierRequired": "pro" }
         },
         "trial": {
           "active": true,
           "daysRemaining": 12,
           "tier": "pro"
         }
       }

POST   /events                   # Track paywall events
       { "resourceType": "metric", "resourceId": "rental_yield", "eventType": "view" }
```

### 3.3 Backend Services

```
packages/backend/src/
  entitlements/
    entitlements.module.ts
    entitlements.controller.ts       # Admin API
    entitlements-public.controller.ts # Public API
    entitlements.service.ts          # Core logic
    rules.service.ts                 # Rule resolution
    analytics.service.ts             # Event tracking & aggregation
    automations.service.ts           # Automation execution
    sync.service.ts                  # Metrics sync from registry
    dto/
      create-rule.dto.ts
      update-rule.dto.ts
      ...
```

### 3.4 Rule Resolution Logic

```typescript
async function getEffectiveAccess(
  tier: UserTier,
  resourceType: ResourceType,
  resourceId: string,
  environment: Environment
): Promise<AccessLevel> {
  // 1. Check for override in current environment
  const override = await db.entitlementRules.findFirst({
    where: {
      tier,
      resourceType,
      resourceId,
      source: 'override',
      environment,
    },
  });

  if (override) return override;

  // 2. Fall back to default
  const defaultRule = await db.entitlementRules.findFirst({
    where: {
      tier,
      resourceType,
      resourceId,
      source: 'default',
    },
  });

  if (defaultRule) return defaultRule;

  // 3. No rule found = deny access
  return { access: 'none', previewLimit: null };
}
```

---

## 4. Frontend Architecture

### 4.1 Entitlements Context

Central provider that fetches and caches entitlements for current user.

```typescript
// packages/frontend/lib/entitlements/EntitlementsContext.tsx

interface EntitlementsContextValue {
  tier: UserTier;
  trial: TrialInfo | null;

  // Check access
  canAccess: (type: ResourceType, id: string) => boolean;
  getAccess: (type: ResourceType, id: string) => AccessInfo;
  getPreviewLimit: (type: ResourceType, id: string) => number | null;
  getTierRequired: (type: ResourceType, id: string) => UserTier;

  // For pricing page
  getFeaturesForTier: (tier: UserTier) => Feature[];

  // Track events
  trackPaywallView: (type: ResourceType, id: string) => void;
  trackUpgradeClick: (type: ResourceType, id: string) => void;

  // Dev mode
  simulatedTier: UserTier | null;
  setSimulatedTier: (tier: UserTier | null) => void;
}

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  // Fetch entitlements from API
  // Handle tier simulation from URL param or cookie
  // Cache and provide to children
}
```

### 4.2 Gating Components

```typescript
// packages/frontend/components/entitlements/

// Gate entire sections
<EntitlementGate
  type="feature"
  id="ai_insights"
  fallback={<UpgradePrompt feature="AI Insights" />}
>
  <AIInsightsPanel />
</EntitlementGate>

// Inline paywall for lists
<EntitlementList
  type="metric"
  id="rental_yield"
  data={metrics}
  renderItem={(metric) => <MetricCard metric={metric} />}
  renderPaywall={(remaining) => (
    <PaywallCard
      message={`${remaining} more metrics available`}
      feature="Full Metrics"
    />
  )}
/>

// Paywall overlay
<PaywallOverlay
  isVisible={!canAccess('geo', 'zip')}
  tierRequired="pro"
  featureName="Zip Code Data"
>
  <ZipCodeMap />
</PaywallOverlay>
```

### 4.3 Upgrade Components

```typescript
// Upgrade modal
<UpgradeModal
  isOpen={showUpgrade}
  onClose={() => setShowUpgrade(false)}
  highlightFeature="rental_yield"
  source="metric_paywall"
/>

// Inline upgrade prompt
<UpgradePrompt
  size="sm" | "md" | "lg"
  feature="AI Insights"
  benefits={['Unlimited queries', 'Market comparisons', 'Export results']}
/>

// Trial banner
<TrialBanner
  daysRemaining={trial.daysRemaining}
  onUpgrade={() => router.push('/pricing')}
/>
```

### 4.4 Pricing Page Integration

The pricing page reads from entitlements to display accurate feature lists:

```typescript
// packages/frontend/app/pricing/page.tsx

export default function PricingPage() {
  const { getFeaturesForTier } = useEntitlements();

  const tiers = [
    {
      name: 'Free',
      price: 0,
      features: getFeaturesForTier('free'),
    },
    {
      name: 'Pro',
      price: 29,
      features: getFeaturesForTier('pro'),
    },
    {
      name: 'Enterprise',
      price: 'Contact us',
      features: getFeaturesForTier('enterprise'),
    },
  ];

  return <PricingCards tiers={tiers} />;
}
```

### 4.5 File Structure

```
packages/frontend/
  lib/
    entitlements/
      EntitlementsContext.tsx    # Provider
      useEntitlements.ts         # Hook
      types.ts                   # TypeScript types
      api.ts                     # API client

  components/
    entitlements/
      EntitlementGate.tsx        # Gate wrapper
      EntitlementList.tsx        # List with paywall
      PaywallOverlay.tsx         # Blur overlay
      PaywallCard.tsx            # Paywall message card
      UpgradeModal.tsx           # Full upgrade modal
      UpgradePrompt.tsx          # Inline upgrade CTA
      TrialBanner.tsx            # Trial countdown banner
      TierBadge.tsx              # Show current tier
```

---

## 5. Admin UI

### 5.1 Page Structure

```
packages/frontend/app/_dev/admin/entitlements/
  page.tsx                       # Overview (home)
  layout.tsx                     # Sidebar navigation
  tiers/
    page.tsx                     # Drag-and-drop tier config
  features/
    page.tsx                     # Manage features
  analytics/
    page.tsx                     # Analytics dashboard
  automations/
    page.tsx                     # Automation rules
  trial/
    page.tsx                     # Trial settings
  users/
    page.tsx                     # User overrides
  playbook/
    page.tsx                     # Monetization playbook
```

### 5.2 Component Library

```
packages/frontend/app/_dev/admin/entitlements/components/
  layout/
    AdminSidebar.tsx             # Navigation sidebar
    AdminHeader.tsx              # Top bar with tier switcher

  tiers/
    TierLane.tsx                 # Drop zone for tier
    ResourceCard.tsx             # Draggable resource card
    TeaserConfigModal.tsx        # Configure preview limits

  analytics/
    StatsCard.tsx                # Metric display card
    PaywallChart.tsx             # Time series chart
    TopResourcesList.tsx         # Top blocked/converting
    RecommendationCard.tsx       # Actionable suggestion

  automations/
    AutomationCard.tsx           # Rule display
    AutomationEditor.tsx         # Create/edit modal
    TriggerSelector.tsx          # Trigger type picker
    ActionSelector.tsx           # Action type picker

  shared/
    ActionItemCard.tsx           # Urgent action display
    TierBadge.tsx                # Tier indicator
    ConfirmDialog.tsx            # Confirmation modal
```

### 5.3 Navigation Structure

```typescript
const ADMIN_NAV = [
  {
    label: 'Overview',
    href: '/_dev/admin/entitlements',
    icon: LayoutDashboard,
  },
  {
    label: 'Configure',
    items: [
      { label: 'Tiers', href: '/_dev/admin/entitlements/tiers', icon: Layers },
      { label: 'Trial', href: '/_dev/admin/entitlements/trial', icon: Clock },
      { label: 'Users', href: '/_dev/admin/entitlements/users', icon: Users },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics', href: '/_dev/admin/entitlements/analytics', icon: BarChart },
    ],
  },
  {
    label: 'Automate',
    items: [
      { label: 'Rules', href: '/_dev/admin/entitlements/automations', icon: Zap },
    ],
  },
  {
    label: 'Learn',
    items: [
      { label: 'Playbook', href: '/_dev/admin/entitlements/playbook', icon: BookOpen },
    ],
  },
];
```

---

## 6. Tier Simulation (Dev Mode)

### 6.1 URL Parameter

```
/_dev/admin/entitlements?tier=pro
```

Sets a cookie that overrides the user's actual tier. Only works when:
- In development environment, OR
- User is on `/_dev/*` routes

### 6.2 Sidebar Tier Switcher

Always visible in admin sidebar footer:

```typescript
<TierSwitcher
  currentTier={simulatedTier ?? actualTier}
  onChange={(tier) => setSimulatedTier(tier)}
  isSimulating={simulatedTier !== null}
/>
```

Shows clear indicator when simulating:
- Badge: "Viewing as Pro"
- Different background color
- "Reset" button to clear simulation

---

## 7. Analytics & Recommendations

### 7.1 Tracked Events

| Event | When | Data |
|-------|------|------|
| `paywall_view` | User sees a paywall | resource, tier, page |
| `paywall_click` | User clicks upgrade | resource, tier, page |
| `paywall_dismiss` | User dismisses paywall | resource, tier |
| `teaser_view` | User sees teaser content | resource, tier, items_shown |
| `teaser_expand` | User tries to see more | resource, tier |

### 7.2 Calculated Metrics

| Metric | Formula |
|--------|---------|
| Conversion rate | clicks / views |
| Teaser effectiveness | teaser_expand / teaser_view |
| Paywall friction | dismiss / views |

### 7.3 Recommendation Engine

Rules-based recommendations:

```typescript
const RECOMMENDATION_RULES = [
  {
    condition: (stats) => stats.views > 100 && stats.conversionRate < 0.02,
    recommendation: 'High views, low conversion. Consider adding teaser preview.',
    action: 'add_teaser',
  },
  {
    condition: (stats) => stats.conversionRate > 0.10,
    recommendation: 'High conversion rate. This gate is working well.',
    action: 'none',
  },
  {
    condition: (stats) => stats.dismissRate > 0.80,
    recommendation: 'Users are dismissing this paywall. Consider lowering tier or improving copy.',
    action: 'review_tier',
  },
];
```

---

## 8. Automations

### 8.1 Trigger Types

| Trigger | Parameters | Description |
|---------|------------|-------------|
| `paywall_count` | count, days | User hits N paywalls in X days |
| `inactive_days` | days | User hasn't logged in for X days |
| `trial_ending` | days_before | Trial expires in X days |
| `trial_ended` | days_after | Trial ended X days ago |
| `subscription_cancelled` | days_after | Cancelled X days ago |

### 8.2 Action Types

| Action | Parameters | Description |
|--------|------------|-------------|
| `send_email` | template_id | Send email from template |
| `apply_discount` | percent, duration | Create discount code |
| `extend_trial` | days | Extend trial by X days |
| `upgrade_tier` | tier, duration | Temporary tier upgrade |
| `webhook` | url, payload | Call external webhook |

### 8.3 Execution

Automations run via a scheduled job (cron):

```typescript
// Every hour, check automation triggers
async function runAutomations() {
  const activeAutomations = await db.automations.findMany({
    where: { status: 'active' },
  });

  for (const automation of activeAutomations) {
    const users = await findUsersMatchingTrigger(automation);

    for (const user of users) {
      if (!await hasRecentRun(automation, user)) {
        await executeAction(automation, user);
        await recordRun(automation, user);
      }
    }
  }
}
```

---

## 9. Playbook Content

Static content embedded in admin, organized by topic:

### Getting Started
- Setting your first gates
- Free vs Teaser vs Paid decision framework
- Pricing psychology basics

### Conversion Optimization
- Optimal teaser limits (research-backed)
- Paywall copy that converts
- When to offer discounts
- Trial length best practices (7 vs 14 vs 30 days)

### Retention
- Early warning signs of churn
- Re-engagement email timing
- Win-back campaign strategies
- Upgrade path optimization

Content stored as MDX files, rendered in admin UI.

---

## 10. Implementation Phases

### Phase 1: Core Entitlements (MVP)
- [ ] Database schema
- [ ] Backend API (rules, features)
- [ ] Frontend context and hooks
- [ ] Basic gating components
- [ ] Config file seeding

### Phase 2: Admin UI
- [ ] Admin layout and navigation
- [ ] Tier configuration (drag-and-drop)
- [ ] Features management
- [ ] Tier simulation

### Phase 3: Analytics
- [ ] Event tracking
- [ ] Analytics dashboard
- [ ] Recommendation engine

### Phase 4: Trials & Overrides
- [ ] Trial configuration
- [ ] User overrides
- [ ] Trial banner component

### Phase 5: Automations
- [ ] Automation CRUD
- [ ] Trigger evaluation
- [ ] Action execution
- [ ] Run history

### Phase 6: Playbook & Polish
- [ ] Playbook content
- [ ] UI polish
- [ ] Production admin access

---

## 11. Open Questions

1. **Email integration** - What email service for automations? (SendGrid, Postmark, Resend)
2. **Stripe integration** - When ready, how do subscriptions map to tiers?
3. **Enterprise teams** - Defer team management or include in v1?
4. **A/B testing** - Want to test different tier configurations?

---

## 12. Success Metrics

| Metric | Target |
|--------|--------|
| Free → Pro conversion | > 5% |
| Trial → Paid conversion | > 20% |
| Pro churn rate | < 5% monthly |
| Paywall-to-upgrade rate | > 3% |
