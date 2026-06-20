/**
 * "Best Real Estate Market Analysis Tools" roundup data.
 *
 * Powers the /compare hub page. Ranked list of the major market-analysis tools,
 * PropertyIQ included and ranked honestly with its real gaps disclosed. Competitor
 * facts accurate as of June 2026 (2026-06-10 competitor deep-dive). PropertyIQ
 * coverage/validation numbers import from validation-claims.ts.
 *
 * `priceFrom` may contain the {{PRO_PRICE}} token — the page interpolates it with
 * live pricing, the same way the head-to-head comparison pages do.
 */

import { V4_CLAIMS } from "../validation-claims";

const { metrosScored, zipsScored, backtestYears } = V4_CLAIMS;

export interface RoundupTool {
  rank: number;
  name: string;
  /** Short "best for X" positioning line. */
  bestFor: string;
  /** External site. */
  url: string;
  /** Slug of the in-depth head-to-head page, if one exists. */
  comparisonSlug?: string;
  /** Entry price summary. May contain {{PRO_PRICE}}. */
  priceFrom: string;
  pros: string[];
  cons: string[];
  blurb: string;
  isPropertyiq?: boolean;
}

export const ROUNDUP_TITLE =
  "Best Real Estate Market Analysis Tools (2026), Compared & Ranked";

export const ROUNDUP_DESCRIPTION =
  "An honest, criteria-based ranking of the best real estate market analysis tools in 2026 — PropertyIQ, Reventure, DealCheck, BiggerPockets, Mashvisor, and PropStream. Compared on data granularity, scoring transparency, validation, and price.";

/** How the ranking was produced — shown on-page for methodology transparency. */
export const ROUNDUP_CRITERIA =
  "Tools are ranked on five criteria: data granularity (metro → ZIP), data freshness, scoring transparency and validation, breadth of workflow (market screening through deal analysis), and price. PropertyIQ is our product; we rank it first on those criteria and disclose where competitors lead — short-term rental data, mobile apps, community, and off-market lead generation are genuine gaps PropertyIQ does not fill.";

export const ROUNDUP_TOOLS: RoundupTool[] = [
  {
    rank: 1,
    name: "PropertyIQ",
    bestFor: "Best overall for transparent, validated market scoring",
    url: "/",
    priceFrom: "Free · Pro {{PRO_PRICE}}/mo",
    isPropertyiq: true,
    pros: [
      `One validated PropertyIQ Score (1–99) across ${metrosScored} metros and ${zipsScored.toLocaleString()} ZIPs`,
      `Published methodology + ${backtestYears}-year out-of-sample backtest`,
      "A–F confidence grade and as-of date on every value",
      "AI market reports + a deal analyzer (market → property in one flow)",
      "Queryable from Claude and other AI assistants via its MCP server",
      "Free, open map — no signup wall",
    ],
    cons: [
      "Web only — no native mobile app yet",
      "No short-term rental (Airbnb) analytics",
      "No community or forums",
    ],
    blurb: `PropertyIQ scores ${metrosScored} metros, thousands of counties, and ${zipsScored.toLocaleString()} ZIP codes with a single 1–99 number, refreshed monthly. Its differentiator is trust: the methodology is public, the score is validated out-of-sample across a ${backtestYears}-year backtest, and every market carries an A–F confidence grade so you know when not to rely on it. It's the only tool here that takes you from market screening to a prefilled deal analysis without switching products — and the only one you can query live from Claude or another AI assistant through its MCP server.`,
  },
  {
    rank: 2,
    name: "Reventure App",
    bestFor: "Best for macro forecasting and mobile",
    url: "https://www.reventure.app",
    comparisonSlug: "propertyiq-vs-reventure",
    priceFrom: "Free · Premium $39/mo",
    pros: [
      "Polished iOS and Android apps",
      "Large, engaged audience (1M+ YouTube)",
      "Strong region-detail panels and metric glossary",
    ],
    cons: [
      "Forecast Score weights undisclosed; no public backtest",
      "Persistent bearish narrative bias",
      "Account wall blocks the map for anonymous users",
    ],
    blurb:
      "Reventure pairs a housing choropleth with a 0–100 Home Price Forecast Score and a media engine behind it. Coverage and UX are excellent, but the score is a black box — five named inputs, no weights, no per-geography validation — and the brand carries a heavy directional bias.",
  },
  {
    rank: 3,
    name: "DealCheck",
    bestFor: "Best for property-level deal analysis",
    url: "https://dealcheck.io",
    priceFrom: "Free · Pro ~$29/mo",
    pros: [
      "Address → full underwrite in under a minute",
      "Six deal types + reverse max-offer calculator",
      "Genuinely usable free tier (15 saved deals)",
    ],
    cons: [
      "No market-level intelligence — can't answer 'is this a good market?'",
      "Auto-filled comps can be stale and need correcting",
      "No AI or API",
    ],
    blurb:
      "DealCheck is the deal-math benchmark: fast property import, flexible projections, and shareable no-login reports. Its blind spot is the market layer — it tells you whether a property pencils, never whether the ZIP itself is a good bet. It pairs naturally with a market-scoring tool.",
  },
  {
    rank: 4,
    name: "BiggerPockets",
    bestFor: "Best for community and education",
    url: "https://www.biggerpockets.com",
    comparisonSlug: "propertyiq-vs-biggerpockets",
    priceFrom: "Free · Pro $39/mo",
    pros: [
      "3M+ member forums and podcast network",
      "50-state lawyer-reviewed lease packages (Pro)",
      "Solid deal calculators",
    ],
    cons: [
      "Market Finder is metro-only and was stamped 2024",
      '"Top 25" markets are editor-picked with no methodology',
      "Billing complaints (BBB/Trustpilot)",
    ],
    blurb:
      "BiggerPockets' community is its moat, and for education and networking it's unmatched. But the Market Finder is its weakest surface — MSA-only, two years stale, and editorially curated — so it's a poor fit when you need current, granular market data.",
  },
  {
    rank: 5,
    name: "Mashvisor",
    bestFor: "Best for short-term rental analytics",
    url: "https://www.mashvisor.com",
    comparisonSlug: "propertyiq-vs-mashvisor",
    priceFrom: "From $49.99/mo (annual)",
    pros: [
      "Property-level Airbnb/VRBO revenue and occupancy estimates",
      "Signature STR-vs-LTR side-by-side view",
      "Return-metric property search",
    ],
    cons: [
      "Data accuracy degrades outside major metros",
      "Undisclosed Mashmeter methodology; no confidence indicator",
      "No free tier; billing complaints",
    ],
    blurb:
      "Mashvisor is the go-to for short-term rental numbers on a specific property. Outside that lane it's strained — thin-market accuracy issues, an opaque score, and billing friction — and it covers far fewer markets than the broader market-intelligence tools.",
  },
  {
    rank: 6,
    name: "PropStream",
    bestFor: "Best for off-market lead generation",
    url: "https://www.propstream.com",
    priceFrom: "From $99/mo",
    pros: [
      "160M+ property records and 165+ filters",
      "Skip tracing and pre-built lead lists",
      "Daily-refreshing saved searches",
    ],
    cons: [
      "Real cost balloons to $278–$350/mo with add-ons",
      "County-record data lags weeks; no market scoring",
      "Overkill for market research — it's a lead-gen tool",
    ],
    blurb:
      "PropStream is a lead-generation engine, not a market-analysis tool — its strength is finding owners to contact, with skip tracing and parcel data. For deciding where to invest it's the wrong layer: stale county records, no geography scoring, and a price ladder market researchers won't want.",
  },
];
