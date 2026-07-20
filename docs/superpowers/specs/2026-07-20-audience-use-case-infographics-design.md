# Audience Use-Case Infographics — Design Spec

**Date:** 2026-07-20
**Status:** Approved for implementation
**Scope:** First of three planned infographic series (see "Out of Scope" below). This spec covers only the audience use-case series: Investor, Homebuyer, and Agents & Brokerages.

## Why

Inspired by three NotebookLM-generated infographics the user shared (score-methodology explainers). Rather than recreate those directly, the user asked for a series showing how each real audience (agents, brokers, investors, homebuyers) actually uses PropertyIQ — grounded in real product screens and real captured data, not invented content. Two Explore agents confirmed what's real on the site; three infographics are scoped from that inventory.

## Non-negotiable constraint: no fabricated content

Every number, quote, and screen depicted must trace to one of:

- A real, dated product-output capture already in the codebase (`packages/frontend/app/components/home/landing-v2/persona/snapshots.ts` — Austin, TX · ZIP 78704, captured 2026-05-31).
- A live MCP data pull made during this session (Seattle vs. Buffalo metro comparison, captured 2026-06-30).
- Real, existing marketing copy (`docs/marketing/propertyiq-social-media-brand-guide.md`, `app/components/home/UseCasesSection.tsx`, pricing copy).
- The canonical coverage constant `COVERAGE_COPY` in `packages/frontend/lib/data/validation-claims.ts`.

No invented screens, no invented numbers, no invented quotes. Every stat panel carries an "as of [date]" attribution line, matching the MCP data-attribution requirement.

## Audience scoping decision

Research found **no dedicated "broker" content anywhere in the codebase** — broker appears only as a bundled mention inside agent copy and one Enterprise-tier pricing line ("team/brokerage features"). Per user decision, Broker is folded into the Agent infographic as "Agents & Brokerages" rather than given its own infographic or fabricated content.

Final set: **3 infographics** — Investor, Homebuyer, Agents & Brokerages.

## Structural approach

"Stylized real-UI mockup dashboard" — multi-panel layout (visually similar in density/structure to the reference images) where each panel is a faithful, simplified recreation of a real screen or a real data point, not a literal screenshot. Recommended and approved over a plainer icon-grid or a step-by-step journey flow.

## Visual system

Rebuilt in PropertyIQ's actual brand system, not the reference images' muted editorial look:

| Token                     | Value                                                                |
| ------------------------- | -------------------------------------------------------------------- |
| Primary                   | `#3949AB` (indigo)                                                   |
| Primary Dark              | `#1A237E`                                                            |
| Primary Light / Container | `#C5CAE9` / `#E8EAF6`                                                |
| Accent (positive)         | `#00C853`                                                            |
| Error (negative)          | `#B3261E`                                                            |
| Warning                   | `#FF8F00`                                                            |
| Surface                   | `#FAFBFF`                                                            |
| Typography                | Roboto (UI text), Roboto Mono (numbers/stats)                        |
| Shape                     | `rounded-xl` cards, `rounded-full` chips, M3 elevation (`shadow-sm`) |

All three infographics share a common header strip — the 1–99 score scale with "50 = state average" — for series consistency and brand recognition.

## Canvas & delivery

- **Size:** 2000×1125px (16:9), matching typical blog hero / OG-image / social-card ratios — serves both embed and standalone-share use cases (per user's "both" decision).
- **Build:** Static HTML/CSS file per infographic using the brand tokens above, rendered via Playwright screenshot at the fixed canvas size.
- **Output:** `packages/frontend/public/images/infographics/{slug}.png` — `investor-use-case.png`, `homebuyer-use-case.png`, `agents-brokerages-use-case.png`.
- Source HTML kept alongside for future edits (exact location decided at implementation time — likely a `content-pipeline/infographics/` or scratch build directory, not shipped to production).

## Content per infographic

### 1. Investor

- **Header hook** (from brand guide's investor positioning): _"Concrete, falsifiable data — see exactly why a market scores what it scores."_
- **Score scale strip** (shared component).
- **Panel: Deal Analyzer** — real captured output, Austin, TX · 78704, as of 2026-05-31:
  - Purchase price: $550,000
  - Net cash flow: −$2,224/mo
  - Cap rate: 1.61%
  - Overvalued vs. fundamentals: +115.7%
  - PropertyIQ Score: 7 · F
  - Verdict: "Pass — negative cash flow, ~116% overvalued"
- **Panel: Market contrast** — Seattle vs. Buffalo, live MCP data as of 2026-06-30:
  - Seattle, WA (metro 42660): Score 16 · F, 3-month trend −40 (was 56 in March 2026), overvalued 89.1%, cap rate 2.19%
  - Buffalo, NY (metro 15380): Score 98 · A+, 3-month trend +6 (was 84 in Dec 2025), overvalued 19.4%, cap rate 3.57%
- **Footer:** coverage stats (900+ metros, 3,000+ counties, 29,000+ ZIPs) + monthly refresh cadence.

### 2. Homebuyer

- **Header hook** (from brand guide's homebuyer positioning, "is this a good time to buy" framing).
- **Score scale strip** (shared component).
- **Panel: Affordability** — real captured output, Austin, TX · 78704, as of 2026-05-31:
  - Median home price: $733,554
  - Income needed to buy: $221,880
  - Median household income: $97,160
  - Affordable at median income: $361,262
  - Years to save a down payment: 17
  - Verdict: "Buying needs 2.3× the local income — renting wins today"
- **Panel: Market contrast** — same Seattle vs. Buffalo real data, reframed as "where affordability and momentum line up" (Buffalo's lower price point + rising score vs. Seattle's high price + falling score).
- **Footer:** coverage stats.

### 3. Agents & Brokerages

- **Header hook** (verbatim, real, from `UseCasesSection.tsx`): _"Walk into every listing presentation with a market score and an AI-generated narrative. Win listings with numbers, not instinct."_
- **Score scale strip** (shared component).
- **Panel: Listing presentation** — real captured output, Austin, TX · 78704, as of 2026-05-31:
  - Median days on market: 57 days
  - Price per sq ft: $572
  - Active inventory: 374 (−18.7% YoY)
  - New listings: 96 (−25% YoY)
  - Listings with price cuts: 23.4%
  - Home values: −10.81% YoY
  - Verdict: "Cooling + tight inventory — price it right or it sits"
- **Panel: Ask Claude / MCP** — real MCP exchange (`MCP_EXCHANGE` in `snapshots.ts`): the literal `get_propertyiq_score(geography="zip", location_id="78704")` call and its real JSON response, framed as "A real MCP tool call against live PropertyIQ data."
- **Panel: Brokerage callout** — real Enterprise-tier pricing line: "team/brokerage features," framed honestly as an Enterprise-tier capability, not a live dashboard.
- **Footer:** coverage stats.

## Verification plan

- Every number/quote in this spec is traceable to a cited source file or a live MCP call made 2026-06-30/2026-05-31; no additional "fact-check" pass needed before build, but the build step must not silently alter any value while translating into HTML.
- After rendering, open each PNG and manually confirm: text legibility at both full size and typical blog-embed width (~800px), all "as of" attributions present, brand colors match `globals.css` semantic tokens (no hardcoded off-brand hex).
- Confirm each PNG file size/dimensions are consistent (2000×1125) before considering the task done.

## Out of scope (future series, not built here)

1. **Score-methodology explainer infographics** — closest to the 3 reference images directly; real backtest numbers already researched and banked (3-year excess return by score band, confidence grade distribution, from the live `/scores/methodology` validation report). Separate spec when picked up.
2. **Market rankings/leaderboard series** — top 5 movers up/down, biggest surprise, top 10, bottom 10, top/bottom market per state. Separate spec when picked up.

Also out of scope: a real bug noticed in passing on `/scores/methodology` (`page.tsx` hardcodes "38,000+" total locations scored vs. the SSOT `formatMarketsScored()` computing "33,000+") — flagged to the user, not fixed as part of this task.
