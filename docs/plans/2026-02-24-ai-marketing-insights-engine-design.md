# AI Marketing Insights Engine — Design Document

**Date:** 2026-02-24
**Status:** Approved
**Feature:** Real-time AI-powered growth strategist for admin entitlements analytics

---

## 1. Problem Statement

The `/admin/entitlements/analytics` page has a hardcoded "AI Insights" section (two placeholder strings with fake data). The platform needs a real AI-powered marketing advisor that:

- Analyzes all platform data to generate actionable growth recommendations
- Acts as a **fractional CMO** for a developer founder (not a marketer)
- Provides step-by-step implementation instructions, not just observations
- Tracks progress toward a specific growth goal
- Covers on-site optimization, off-site acquisition, and lifecycle/retention

---

## 2. Growth Goal

**Target:** 2,000 average monthly paid users by February 2, 2027
**Re-evaluation:** February 2027 (1 year from goal setting)

The AI anchors every recommendation against this goal. Progress is tracked with milestones: 10, 25, 100, 250, 500, 1,000, 2,000 users.

---

## 3. AI Persona

**Role:** SaaS Growth Director for PropertyIQ

**Core principles:**
- The founder is a developer, not a marketer. Every recommendation MUST include specific, step-by-step implementation instructions
- Don't say "leverage influencer marketing" — say exactly which influencers to contact, what to say, and expected outcomes
- Provide templates, scripts, example copy, and links where relevant
- Expert in web-based SaaS growth with deep knowledge of the real estate data industry
- Growth-driven: every insight evaluated against its potential to accelerate toward 2,000 paid users
- Prioritize automation and scalable tactics over manual effort
- Advertising/affiliate recommendations must pass the "useful to the user" test — only suggest placements that add genuine value to the user's workflow

**Three growth domains:**

| Domain | Focus |
|--------|-------|
| On-Site Optimization | Paywall placement, feature gating, trial UX, conversion flows, in-product monetization |
| Off-Site Acquisition | Influencer outreach, content marketing, SEO, social media, partnerships, PR |
| Lifecycle & Retention | Email campaigns, onboarding, re-engagement, referral programs, community |

---

## 4. Insight Categories (11)

Each insight within a category is priority-ranked (High/Medium/Low) and includes:
- **Evidence** — data-backed reasoning citing actual platform numbers
- **Recommendation** — what to do and why
- **Implementation** — step-by-step instructions with effort estimates and expected impact

### On-Site (4)
1. **Conversion Blockers** — What's actively hurting conversion (high dismiss rates, broken flows, confusing UX)
2. **Quick Wins** — Easy, high-impact changes (move high-CTR features, adjust copy, simplify flows)
3. **Growth Opportunities** — Bigger strategic moves (new feature gating, A/B tests, pricing experiments)
4. **Missing Tracking** — Instrumentation gaps that blind you to optimization opportunities

### Lifecycle (4)
5. **Retention Signals** — Are paid users using premium features? Churn risk indicators, feature adoption post-conversion
6. **Pricing & Packaging** — Are features in the right tiers? Is free tier too generous or too restrictive?
7. **Trial Health** — Trial-to-paid conversion, engagement during trial, optimal trial length
8. **Revenue Leaks** — Failed payments, downgrades, cancelled trials, users hitting limits but not upgrading

### Off-Site (2)
9. **Acquisition Channels** — Influencer partnerships, content marketing, SEO, social, community, paid ads
10. **Brand & Authority** — Thought leadership, PR, partnerships with RE industry players, conference presence

### Monetization (1)
11. **Monetization & Partnerships** — Contextual ad/affiliate placement opportunities, sponsorship strategies, revenue-per-user optimization (existing affiliate/ad system in reports can be extended site-wide where natural)

---

## 5. Architecture

### 5.1 Backend

**New SSE streaming endpoint:** `GET /api/admin/analytics/ai-insights`

**Query params:**
- `days` — time range (7, 30, 90)
- `provider` — `deepseek` | `claude` (default: `deepseek`)
- `prompt` — optional follow-up question (chat mode)
- `history` — JSON-encoded conversation history (multi-turn chat)

**Data assembly (7 sources injected into system prompt):**

| # | Source | Data |
|---|--------|------|
| 1 | PaywallAnalyticsService.getPaywallStats() | Views, clicks, CTR, top resources, 7-day trends, tier breakdown |
| 2 | PaywallAnalyticsService.getFunnelData() | View → click → convert rates |
| 3 | Stripe/Billing query | MRR, active subscriptions, churn count, failed payments |
| 4 | User trials query | Active trials, conversion rate, average trial length |
| 5 | analytics_events query | Top features by tier, adoption rates, engagement patterns |
| 6 | Tier feature matrix | What's gated where (free vs pro vs enterprise) |
| 7 | User profile aggregates | Users per tier, recent signups, active users, paid user count |

**Provider abstraction:** `AiProviderService` with `streamCompletion(messages, provider)` method. Routes to DeepSeek or Anthropic SDK based on provider param. Both support streaming.

**Environment variables:**
- `DEEPSEEK_API_KEY` — DeepSeek API key
- `ANTHROPIC_API_KEY` — Already exists
- `AI_INSIGHTS_DEFAULT_PROVIDER` — Default provider (`deepseek`)

**New files:**

| File | Purpose |
|------|---------|
| `packages/backend/src/admin/analytics/ai-insights.controller.ts` | SSE streaming endpoint |
| `packages/backend/src/admin/analytics/ai-insights.service.ts` | Data assembly + prompt construction |
| `packages/backend/src/admin/analytics/ai-provider.service.ts` | DeepSeek/Claude provider abstraction |
| `packages/backend/src/admin/analytics/ai-insights.types.ts` | Types |

### 5.2 Growth Goal Storage

**Database:** `growth_goals` table or admin config row in existing settings table.

Fields: `target_users`, `target_date`, `milestones` (JSONB array), `created_at`, `updated_at`.

Queried by both the goal progress widget (direct DB) and injected into the LLM system prompt.

### 5.3 Frontend

**Replaces:** The hardcoded AI Insights section (lines ~480-508 in analytics/page.tsx)

**Components:**

| Component | Description |
|-----------|-------------|
| GoalProgressWidget | Data-driven milestone tracker. Current paid users, target, trajectory, milestone timeline. Not LLM-generated. |
| AiInsightsPanel | Container for streaming insights. Parses LLM markdown into styled category cards. |
| InsightCategoryCard | Collapsible card for each of the 11 categories. Contains priority-ranked insight items. |
| InsightItem | Single insight with evidence, recommendation, and expandable implementation steps. |
| ProviderToggle | Dropdown to switch between DeepSeek and Claude. |
| InsightsChat | Text input + conversation history for follow-up questions. |

---

## 6. UI Layout

```
┌──────────────────────────────────────────────────────────┐
│  🎯 Goal: 2,000 Paid Users by Feb 2, 2027               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  Current: 47 paid  │  Target: 2,000  │  342 days left    │
│  ▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 2.4%             │
│                                                           │
│  Milestones:                                              │
│  ✅ 10 ── Jan 15   ✅ 25 ── Feb 3                        │
│  🔵 100 ── proj. Apr 12   ⚪ 250 ── proj. Jul 1          │
│  ⚪ 500 ── proj. Sep 28   ⚪ 1,000 ── proj. Dec 15       │
│  ⚪ 2,000 ── TARGET Feb 2, 2027                           │
│                                                           │
│  Growth: 1.2/day (30d avg)  │  Need: 5.7/day             │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  🧠 AI Marketing Insights          [DeepSeek ▾] [🔄]    │
│  ─────────────────────────────────────────────────────── │
│                                                           │
│  ┌─ 🔴 Conversion Blockers ────────────────────────┐    │
│  │ [High] ZIP paywall dismiss rate is 73%           │    │
│  │ Evidence: 1,247 views, 891 dismissals...         │    │
│  │ → Recommendation: Offer a 1-ZIP preview...       │    │
│  │ ▸ Implementation steps (expandable)              │    │
│  └──────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─ ⚡ Quick Wins ──────────────────────────────────┐    │
│  │ ...                                               │    │
│  └──────────────────────────────────────────────────┘    │
│                                                           │
│  (... 9 more category cards ...)                          │
│                                                           │
│  ─────────────────────────────────────────────────────── │
│  💬 Ask a follow-up question...                    [→]   │
│                                                           │
│  ┌─ Chat History ───────────────────────────────────┐    │
│  │ You: Why is rental_yield CTR so much higher?      │    │
│  │ AI: Rental yield is a direct monetization metric  │    │
│  │     that investors check daily. Unlike...         │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

**States:**
- Loading: Skeleton cards while LLM generates
- Streaming: Typing animation, cards appear as markdown sections complete
- Error: Retry button with error message
- Empty: "Not enough data yet" message if < 50 paywall events

---

## 7. Data Flow

```
Page loads
  → GoalProgressWidget renders (direct query: paid user count + growth_goals config)
  → User clicks refresh or page auto-triggers "Generate Insights"
  → Frontend opens SSE connection to /api/admin/analytics/ai-insights?days=30&provider=deepseek
  → Backend AiInsightsService:
      1. Gathers data from 7 sources in parallel
      2. Queries growth_goals for target + current progress
      3. Constructs system prompt (persona + data context + goal)
      4. Calls AiProviderService.streamCompletion() with provider selection
      5. Streams LLM response chunks via SSE
  → Frontend AiInsightsPanel:
      1. Receives SSE chunks
      2. Parses markdown in real-time into category cards
      3. Renders InsightCategoryCards as they complete
  → User types follow-up in InsightsChat
  → Same SSE endpoint called with prompt= and history= params
  → Response streamed into chat history area
```

---

## 8. System Prompt Structure

```
SYSTEM:
You are the Growth Director for PropertyIQ, a real estate analytics SaaS platform.

MISSION: Help PropertyIQ reach {targetUsers} average monthly paid users by {targetDate}.
Current: {currentPaidUsers} paid users | {daysRemaining} days remaining
Required growth rate: {requiredRate} users/day | Current rate: {currentRate} users/day

ABOUT YOU:
- Expert SaaS growth strategist specializing in real estate data platforms
- The founder is a developer, not a marketer — every recommendation must include
  specific, step-by-step implementation instructions
- You provide templates, scripts, example copy, effort estimates, and expected impact
- You think across three domains: on-site optimization, off-site acquisition, lifecycle/retention
- Advertising/affiliate recommendations must genuinely help the user, never feel forced

PLATFORM DATA (last {days} days):
{serialized paywall stats}
{serialized funnel data}
{serialized Stripe/revenue data}
{serialized trial data}
{serialized feature usage data}
{serialized tier feature matrix}
{serialized user aggregates}

OUTPUT FORMAT:
Analyze the data and provide insights in these 11 categories, priority-ranked within each.
Skip categories where you have no meaningful insight (don't pad with generic advice).

For each insight:
- **[Priority] Title**
- Evidence: cite specific numbers from the data
- Recommendation: what to do and why
- Implementation: numbered steps, effort estimate, expected impact

Categories:
## 🔴 Conversion Blockers
## ⚡ Quick Wins
## 📈 Growth Opportunities
## 🔍 Missing Tracking
## 📊 Retention Signals
## 💰 Pricing & Packaging
## 🧪 Trial Health
## 💸 Revenue Leaks
## 🌐 Acquisition Channels
## 🏛️ Brand & Authority
## 🤝 Monetization & Partnerships
```

---

## 9. Provider Toggle

| Provider | Model | Use Case |
|----------|-------|----------|
| DeepSeek (default) | deepseek-chat | Cost-effective daily analysis |
| Claude | claude-sonnet-4-6 | Deeper strategic analysis when needed |

Toggle stored in frontend state (not persisted). Backend reads `?provider=` param and routes to the correct SDK.

Both providers use the same system prompt and streaming interface. The `AiProviderService` abstracts the difference.

---

## 10. Edge Cases

| Scenario | Handling |
|----------|---------|
| < 50 paywall events | Show "Not enough data" message instead of generating insights |
| LLM returns malformed markdown | Fallback: render as raw markdown in a single card |
| SSE connection drops | Show partial results + "Connection lost. Click to retry." |
| No Stripe data (pre-revenue) | AI acknowledges and focuses on acquisition/trial optimization |
| Provider API down | Fall back to other provider automatically, show notice |
| Goal reached early | AI celebrates, suggests setting a new goal |

---

## 11. Files to Create/Modify

### New Files
- `packages/backend/src/admin/analytics/ai-insights.controller.ts`
- `packages/backend/src/admin/analytics/ai-insights.service.ts`
- `packages/backend/src/admin/analytics/ai-provider.service.ts`
- `packages/backend/src/admin/analytics/ai-insights.types.ts`
- `packages/frontend/app/admin/entitlements/analytics/components/GoalProgressWidget.tsx`
- `packages/frontend/app/admin/entitlements/analytics/components/AiInsightsPanel.tsx`
- `packages/frontend/app/admin/entitlements/analytics/components/InsightCategoryCard.tsx`
- `packages/frontend/app/admin/entitlements/analytics/components/InsightsChat.tsx`
- `packages/frontend/app/admin/entitlements/analytics/hooks/useAiInsights.ts`
- Migration: `create_growth_goals_table`

### Modified Files
- `packages/frontend/app/admin/entitlements/analytics/page.tsx` — Remove hardcoded insights, add GoalProgressWidget + AiInsightsPanel
- `packages/backend/src/admin/admin.module.ts` — Register new controller/services
