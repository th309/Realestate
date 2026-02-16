# PropertyIQ Scores Section Design

**Date:** 2026-02-15
**Status:** Approved

## Overview

Create a public-facing Scores section with two pages that prove the value of PropertyIQ Scores and explain the statistical methodology behind them. Add "Scores" to the top navigation as a first-class product feature.

## Audience

All users (public) — prospects, free users, and paying customers. Serves as a credibility anchor and trust builder.

## Architecture

### Navigation

- Add "Scores" to the Header nav items, positioned after "Reports" and before "About us"
- Links to `/scores`

### Pages

| Page | Route | Purpose |
|------|-------|---------|
| Scores Overview | `app/scores/page.tsx` | What are PropertyIQ Scores, why they matter, the three score types |
| Methodology & Proof | `app/scores/methodology/page.tsx` | Dollar impact stats + full validation report |

### Shared Layout

`app/scores/layout.tsx` wraps both pages with consistent container styling (`max-w-5xl mx-auto px-6 py-8`) and `PageHeaderWithBreadcrumbs`.

### Linking Strategy

- ScorePaywall "Learn more" links to `/scores/methodology`
- Pricing page score section links to `/scores`
- Score cards on market pages get "How this works" link to `/scores/methodology`
- Top nav "Scores" links to `/scores`

## Page 1: Scores Overview (`/scores`)

Marketing-forward page explaining what PropertyIQ Scores are and why they matter.

### Sections

**1. Hero**
- `PageHeaderWithBreadcrumbs` with title "PropertyIQ Scores", icon (Target or TrendingUp)
- Description: "Data-driven scores that predict real estate market performance"
- Subtitle: "Validated across 1.1M+ observations, 384 metros, 5 years of data"

**2. Three Score Cards** (`grid md:grid-cols-3`)

Each card covers one score type:
- **HomeReady Score** — Predicts home price appreciation potential. Best for homebuyers and primary-residence investors.
- **InvestorEdge Score** — Predicts total investment return (appreciation + rental yield). Best for rental property investors.
- **MarketHealth Score** — Measures current market stability and fundamentals. Best for risk assessment.

Each card includes: icon, score name, one-line description, "what it measures" bullet list (3-4 items from feature weights), sample score badge.

**3. Value Proposition**
- Serif heading: "Why Scores Matter"
- Dollar impact stat: "$27,100 more equity on a typical home over 3 years"
- Quintile spread explanation (top-scored vs bottom-scored markets)
- CTA: "See the proof" linking to `/scores/methodology`

**4. How It Works**
- 3-step visual: Data Collection (40+ metrics) → ML Analysis (elastic net cross-validation) → Score (0-100 with letter grade)
- High-level, not technical

**5. CTA Footer**
- "Ready to find the best markets?" button
- Links to `/map` or `/pricing` depending on auth state

## Page 2: Methodology & Proof (`/scores/methodology`)

Marketing stats on top, full technical validation report below.

### Sections

**1. Header**
- Breadcrumbs: Scores > Methodology
- Title: "The Proof Behind PropertyIQ Scores"
- Description: "Walk-forward validated across 5 years of market data"

**2. Marketing Stats** (`grid md:grid-cols-2 lg:grid-cols-4`)

| Stat | Value | Context |
|------|-------|---------|
| Dollar Impact | $27,100 | More equity on a typical home (3yr) |
| Portfolio Impact | $81,300 | Extra appreciation on 3-property portfolio (3yr) |
| Hit Rate | 100% | Predictive accuracy across all periods |
| Data Points | 1.1M+ | Observations validated |

**3. Quintile Comparison**
- Visual bar comparison showing all 5 quintiles with average excess returns
- Callout: "Top-20% scored markets returned 142% more than bottom-20%"

**4. Key Findings**
- 3-4 callout cards: v2.0 improvements, zero sign flips (model stability), geographic consistency
- Each: icon + bold headline + 1-2 sentence explanation

**5. Full Validation Report**
- Section header: "Technical Validation Report"
- Subtitle: "Walk-forward elastic net cross-validation with bootstrap significance testing"
- Full content from `docs/audits/2026-02-13-v2-validation-report.md` rendered as styled HTML
- Tables rendered as proper HTML tables with design system styling
- Markdown headings mapped to typography system (serif for h2s, sans for body)

### Report Rendering

- Import markdown at build time using Next.js static generation
- Parse with remark/rehype markdown processing
- Apply Tailwind prose styling with custom overrides matching the design system

## Cross-cutting Concerns

### SEO Metadata
- `/scores` — "PropertyIQ Scores — AI-Powered Real Estate Market Predictions"
- `/scores/methodology` — "Methodology — How PropertyIQ Scores Predict Market Performance"

### No Backend Changes
- All content is static/build-time
- Validation report read from markdown at build time
- No new API endpoints

### No Entitlement Gating
- Both pages fully public (trust/credibility content)
- Score values remain gated on market pages
- These pages explain how scores work, not what individual scores are

### Existing Page Updates
- **ScorePaywall** — Add "Learn more" link to `/scores/methodology`
- **Pricing page** — Score sections link to `/scores`
- **Market dashboard score cards** — Add "How this works" link

## Design System Compliance

- Uses `PageHeaderWithBreadcrumbs` for headers
- Card components from `components/ui/Card.tsx`
- StatCard pattern for stat displays
- Color system: `bg-surface`, `bg-surface-container`, `bg-primary-container`
- Typography: Roboto (body), Source Serif 4 (editorial headings)
- Container: `max-w-5xl mx-auto px-6 py-8`

## Source Data

- Validation report: `docs/audits/2026-02-13-v2-validation-report.md`
- Formula weights: `packages/backend/src/scoring/formula-weights.ts`
- Score types: HomeReady, InvestorEdge, MarketHealth
