/**
 * PropertyIQ vs BiggerPockets comparison.
 *
 * Targets "BiggerPockets Market Finder alternative" intent. Competitor facts
 * accurate as of June 2026 (2026-06-10 competitor deep-dive + BiggerPockets'
 * public site). PropertyIQ numbers import from validation-claims.ts.
 */

import type { ComparisonData } from "../comparisons";
import { V4_CLAIMS } from "../validation-claims";

const { metrosScored, countiesScored, zipsScored, ic3Y, backtestYears } =
  V4_CLAIMS;

export const BIGGERPOCKETS_COMPARISON: ComparisonData = {
  slug: "propertyiq-vs-biggerpockets",
  competitorName: "BiggerPockets",
  competitorUrl: "https://www.biggerpockets.com",
  title:
    "BiggerPockets Market Finder Alternative: PropertyIQ vs BiggerPockets (2026)",
  description:
    "BiggerPockets is the biggest real estate community, but its Market Finder is MSA-only and was last stamped 2024. PropertyIQ refreshes monthly down to the ZIP with a validated, transparent score. Compare market data, granularity, freshness, and pricing.",
  features: [
    {
      feature: "Geographic granularity",
      propertyiq: "Metro + county + ZIP",
      competitor: "Metro (MSA) only",
      winner: "propertyiq",
    },
    {
      feature: "Market data freshness",
      propertyiq: "Refreshed monthly",
      competitor: "Market Finder stamped 2024",
      winner: "propertyiq",
    },
    {
      feature: "Market score",
      propertyiq: "PropertyIQ Score (1–99), validated",
      competitor: '"Top 25," editor-selected',
      winner: "propertyiq",
    },
    {
      feature: "Methodology disclosed",
      propertyiq: `Yes — public, ${backtestYears}-yr backtest`,
      competitor: "No",
      winner: "propertyiq",
    },
    {
      feature: "Per-market confidence grade",
      propertyiq: "Yes (A–F)",
      competitor: "No",
      winner: "propertyiq",
    },
    {
      feature: "AI market reports",
      propertyiq: "Yes",
      competitor: "No",
      winner: "propertyiq",
    },
    {
      feature: "Claude / AI assistant (MCP)",
      propertyiq: "Yes — MCP server",
      competitor: "No",
      winner: "propertyiq",
    },
    {
      feature: "Deal calculators",
      propertyiq: "Analyzer + AI insights",
      competitor: "Yes (manual entry)",
      winner: "tie",
    },
    {
      feature: "Community / forums",
      propertyiq: "No",
      competitor: "3M+ members (the moat)",
      winner: "competitor",
    },
    {
      feature: "Lawyer-reviewed lease packages",
      propertyiq: "No",
      competitor: "Yes (Pro, 50 states)",
      winner: "competitor",
    },
  ],
  pricing: [
    {
      tier: "Free",
      propertyiq: "$0 (map + scores)",
      competitor: "$0 (forums, 5 reports)",
    },
    {
      tier: "Pro",
      propertyiq: "{{PRO_PRICE}}/mo",
      competitor: "$39/mo (or $390/yr)",
    },
  ],
  summary: `BiggerPockets is a 20-year-old community giant — 3M+ members, a podcast network, forums, and books — and that community is its real moat. Its tools, including the Market Finder, exist mainly to upsell Pro. If you want education, networking, lawyer-reviewed lease packages, and the deepest forum archive in real estate investing, BiggerPockets has no equal, and PropertyIQ does not try to compete there.\n\nThe Market Finder itself, though, is BiggerPockets' weakest surface: metro/MSA-only with no county or ZIP drill-down, a flagship map stamped \"Updated: June 2024,\" and a \"Top 25 markets hand-selected by our experts\" list with no published methodology. For investors who need current, granular, defensible market data, that's a real gap — and it's the gap PropertyIQ fills.\n\nPropertyIQ scores ${metrosScored} metros, ${countiesScored.toLocaleString()} counties, and ${zipsScored.toLocaleString()} ZIP codes, refreshed monthly, with one validated 1–99 number per market. The PropertyIQ Score is out-of-sample validated across a ${backtestYears}-year backtest (2001–2023), positive in 100% of validated years, with a 3-year information coefficient of ${ic3Y}, and every value carries an A–F confidence grade plus a source and as-of date. Where BiggerPockets gives you a two-year-old top-25 list, PropertyIQ gives you a fresh, transparent score for any ZIP — plus AI market reports, an MCP server for AI assistants, and a deal analyzer to take you from market to underwriting.\n\nBest for: choose BiggerPockets for community, education, and its tooling ecosystem. Choose PropertyIQ when you need current, ZIP-level market intelligence with a methodology you can actually inspect — at {{PRO_PRICE}}/month. They pair well: BiggerPockets for the network, PropertyIQ for the data. Competitor pricing and features are accurate as of June 2026; check biggerpockets.com for current terms.`,
  faqs: [
    {
      question: "What's the best BiggerPockets Market Finder alternative?",
      answer: `PropertyIQ is built for exactly the gap BiggerPockets' Market Finder leaves: it scores ${metrosScored} metros, ${countiesScored.toLocaleString()} counties, and ${zipsScored.toLocaleString()} ZIPs, refreshed monthly, versus the Market Finder's metro-only data stamped 2024. PropertyIQ also publishes its methodology and grades each market's confidence A–F, which BiggerPockets does not.`,
    },
    {
      question: "Is PropertyIQ's market data more current than BiggerPockets'?",
      answer:
        "Yes. PropertyIQ recomputes every market score monthly as new data arrives, and shows the as-of date on each value. BiggerPockets' Market Finder map was publicly stamped 'Updated: June 2024,' and its top-markets list is editor-selected rather than refreshed on a schedule.",
    },
    {
      question: "How much does PropertyIQ cost vs BiggerPockets Pro?",
      answer:
        "Both have free tiers — BiggerPockets' includes forums and a small number of free calculator reports; PropertyIQ's includes the full market map and scores. PropertyIQ Pro is {{PRO_PRICE}}/month; BiggerPockets Pro is $39/month or $390/year as of June 2026. See our pricing page for current rates.",
    },
    {
      question: "Does BiggerPockets have things PropertyIQ doesn't?",
      answer:
        "Yes — its community is the reason to use it. BiggerPockets offers 3M+ member forums, a podcast network, educational content, and Pro-only perks like 50-state lawyer-reviewed lease packages. PropertyIQ is a focused market-intelligence tool, not a community, and the two complement each other.",
    },
    {
      question: "Can I use PropertyIQ and BiggerPockets together?",
      answer:
        "Absolutely. A common workflow is to use BiggerPockets for education, networking, and deal calculators, and PropertyIQ for current, validated, ZIP-level market scoring to decide where to invest before running the numbers on a specific property.",
    },
  ],
};
