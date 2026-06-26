// Curated markdown representations of React/data pages that have no MDX source.
// Hand-authored (same philosophy as public/llms.txt) so agents get high-signal,
// accurate content instead of low-quality runtime HTML→markdown scraping.
//
// Keyed by EXACT pathname. The same keys drive isMarkdownContentRoute() in
// ./negotiate (which routes the request) and resolveMarkdown() in ./resolve
// (which returns the body) — one source of truth for "which pages are covered".
//
// Deliberately omits volatile figures that would drift:
//   • Pro/Enterprise prices are dynamic (Supabase subscription_tiers via
//     /api/pricing/tiers) — we describe the tiers and point to /pricing.
//   • Score validation numbers are published on /scores/methodology (already
//     served as markdown) — we summarize and link there.
import { COVERAGE_COPY } from "@/lib/data/validation-claims";

export const STATIC_MARKDOWN_PAGES: Record<string, string> = {
  "/": `# PropertyIQ — The IQ Behind Every Market

PropertyIQ scores every U.S. real estate market — metro, county, and ZIP code — on a 1–99 scale, updated monthly. Know which markets are heating up, cooling off, or flying under the radar before you commit capital.

## What PropertyIQ does

- **Market rankings** — Surfaces the markets that beat the average, ranked by the PropertyIQ Score across ${COVERAGE_COPY.metros} metros, ${COVERAGE_COPY.counties} counties, and ${COVERAGE_COPY.zips} ZIP codes.
- **PropertyIQ Score** — A single 1–99 score that predicts market performance, validated across 20+ years of data and positive in every backtested year. See /scores and /scores/methodology.
- **AI market reports** — Personalized written analysis for a specific market.
- **Interactive map** — Explore scored markets visually across dozens of metrics.

## AI agent & assistant integration

PropertyIQ is built for AI. Connect it to Claude or ChatGPT over the Model Context Protocol (MCP) to query market scores, snapshots, rankings, and forecasts directly from your assistant. See /docs/mcp and /auth.md.

## Who uses it

Real estate investors, agents, and syndicators use PropertyIQ to decide where to put capital with data instead of guesswork.

## Data sources

Zillow (home values and momentum), Realtor.com (days on market and price cuts), plus Census, FRED, BLS, and BEA for economic context.

## Start here

- Explore the map (free): /map
- See a sample AI report: /reports/sample
- Browse markets: /markets
- Pricing: /pricing
`,
  "/markets": `# Browse Housing Markets — PropertyIQ

Browse PropertyIQ's housing-market analysis across U.S. metro areas, with AI-powered forecasts, investor scores, median home prices, and rental trends. Updated monthly.

## What you can do

- Search markets by city name and filter by state.
- Open any market for its PropertyIQ Score, home values, forecasts, rent data, days on market, and economic context.

## Geography levels

- Metro: /markets/[slug]
- State: /markets/state/[state]
- County: /markets/county/[slug]
- ZIP code: /markets/zip/[slug]

## Related

- Interactive map: /map
- How the score works: /scores and /scores/methodology
`,
  "/pricing": `# PropertyIQ Pricing

Start free, upgrade when you need more. For current prices and trial terms, see /pricing.

## Tiers

### Free — $0
- Interactive market maps
- National & state-level data
- Real estate metrics with historical trends and charts
- Preview reports

### Pro (Most Popular)
Everything in Free, plus:
- Metro, county, and ZIP code data
- PropertyIQ composite scores
- AI market analysis and AI reports
- CSV data export
- ChatGPT & Claude integration (MCP)

### Enterprise
Everything in Pro, plus:
- Embeddable objects and widgets
- Team & brokerage features
- Priority support

## Billing

- Monthly or yearly billing; annual plans save roughly 17%.
- A free trial is available on paid plans (no credit card required).

Live prices and current trial length are shown on /pricing.
`,
  "/scores": `# The PropertyIQ Score

One number, 1–99, that predicts a market's performance — validated, not vibes. Higher is better, and 50 equals the market's state average.

## How it's computed

The score combines four monthly market signals:

- Zillow home-value momentum, 12-month — higher is better
- Zillow home-value momentum, 3-month — higher is better
- Realtor.com median days on market — lower is better
- Share of listings with price cuts — lower is better

Each signal is standardized (z-score) across all markets at a geography level every month, combined, and mapped to a 1–99 percentile where 50 = the state average.

## Confidence (data quality)

Every score carries an A/B/C/F confidence grade reflecting how many of the four inputs were available and fresh. Confidence is independent of the score value.

## Coverage

Scored monthly across ${COVERAGE_COPY.metros} metros, ${COVERAGE_COPY.counties} counties, and ${COVERAGE_COPY.zips} ZIP codes, with history backfilled to 2001.

## Proof

Validated across 20+ years: top-scored markets have outperformed their state, and the relationship is positive in every backtested year. Full methodology, the decile-performance table, and validation results are at /scores/methodology.

## Explore

- Scored markets on the map: /map
- Generate a report: /reports
`,
};
