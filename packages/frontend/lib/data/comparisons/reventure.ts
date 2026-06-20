/**
 * PropertyIQ vs Reventure App comparison.
 *
 * Competitor facts (pricing, coverage, features) are accurate as of June 2026,
 * sourced from the 2026-06-10 investor competitor deep-dive + Reventure's public
 * site. PropertyIQ coverage and validation numbers are imported from
 * validation-claims.ts (the single source of truth) so they stay in sync with the
 * monthly backtest refresh — never hardcode them here.
 */

import type { ComparisonData } from "../comparisons";
import { V4_CLAIMS } from "../validation-claims";

const { metrosScored, countiesScored, zipsScored, ic3Y, backtestYears } =
  V4_CLAIMS;

export const REVENTURE_COMPARISON: ComparisonData = {
  slug: "propertyiq-vs-reventure",
  competitorName: "Reventure App",
  competitorUrl: "https://www.reventure.app",
  title:
    "PropertyIQ vs Reventure: Transparent, Validated Housing Scores (2026)",
  description:
    "PropertyIQ and Reventure both score the U.S. housing market down to the ZIP code. The difference is transparency: PropertyIQ publishes its methodology, a 22-year out-of-sample backtest, and a confidence grade on every market. Compare coverage, scoring, and pricing.",
  features: [
    {
      feature: "Metro coverage",
      propertyiq: `${metrosScored} metros`,
      competitor: "~1,000 metros",
      winner: "tie",
    },
    {
      feature: "ZIP-level scores",
      propertyiq: `${zipsScored.toLocaleString()} ZIPs`,
      competitor: "~30,000 ZIPs",
      winner: "tie",
    },
    {
      feature: "Published methodology + backtest",
      propertyiq: `Yes — public, ${backtestYears}-yr out-of-sample`,
      competitor: "No (5 inputs, no weights)",
      winner: "propertyiq",
    },
    {
      feature: "Per-market confidence grade",
      propertyiq: "Yes (A–F data-quality grade)",
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
      feature: "Built-in deal analyzer",
      propertyiq: "Yes (with AI insights)",
      competitor: "Listing analyser (premium)",
      winner: "propertyiq",
    },
    {
      feature: "Free map (no signup)",
      propertyiq: "Yes",
      competitor: "No (account wall)",
      winner: "propertyiq",
    },
    {
      feature: "Market commentary / education",
      propertyiq: "Data-first, no narrative",
      competitor: "1M+ YouTube following",
      winner: "competitor",
    },
    {
      feature: "Mobile app",
      propertyiq: "Web (mobile-optimized)",
      competitor: "iOS + Android",
      winner: "competitor",
    },
  ],
  pricing: [
    {
      tier: "Free",
      propertyiq: "$0 (map + scores)",
      competitor: "$0 (account required)",
    },
    {
      tier: "Pro",
      propertyiq: "{{PRO_PRICE}}/mo",
      competitor: "$39/mo (or $399/yr)",
    },
  ],
  summary: `Reventure App, built by Nick Gerli, is the closest thing to a structural twin PropertyIQ has: a choropleth housing map plus a proprietary 0–100 Home Price Forecast Score covering roughly 1,000 metros, ~3,000 counties, and 30,000 ZIP codes, with iOS and Android apps and a 1M+ YouTube audience driving the funnel. If you want macro housing commentary and a polished mobile experience, Reventure is strong — its region detail panels and metric glossary are genuinely well built.\n\nWhere the two diverge is trust. Reventure's Forecast Score lists five named inputs but publishes no weights, no per-geography backtest, and no confidence indicator — and by the company's own admission, ZIP-level reliability drops meaningfully. PropertyIQ takes the opposite stance. The PropertyIQ Score is a single 1–99 number built from four momentum-and-liquidity signals (12-month and 3-month home-value growth, median days on market, and the share of listings with price cuts), calibrated so 50 equals the state average. It is out-of-sample validated across a ${backtestYears}-year walk-forward backtest (2001–2023), stays positive in 100% of validated years, and reaches a 3-year information coefficient of ${ic3Y}. Every value ships with an A–F confidence grade and a source + as-of date, so you know exactly when not to trust a number. Coverage is comparable — ${metrosScored} metros, ${countiesScored.toLocaleString()} counties, and ${zipsScored.toLocaleString()} ZIP codes.\n\nThe other structural gap is depth. Reventure answers \"where\"; PropertyIQ answers \"where\" and \"is this specific deal good,\" pairing the market map with a deal analyzer, AI-written market reports, and an MCP server that pulls any market straight into Claude or another AI assistant — surfaces Reventure has no answer for. And PropertyIQ keeps its map free and open — no signup wall on the front door.\n\nBest for: choose Reventure if you want macro market education, a recognizable on-camera voice, and native mobile apps. Choose PropertyIQ if you want a transparent, validated score with a published methodology, confidence grades on every market, and a path straight from market screening to underwriting a property — at {{PRO_PRICE}}/month. Competitor pricing and features are accurate as of June 2026; check reventure.app for current terms.`,
  faqs: [
    {
      question: "Is PropertyIQ a good Reventure alternative?",
      answer: `Yes. PropertyIQ and Reventure cover comparable geography (PropertyIQ scores ${metrosScored} metros and ${zipsScored.toLocaleString()} ZIPs), but PropertyIQ publishes its scoring methodology, a ${backtestYears}-year out-of-sample backtest, and an A–F confidence grade on every market — none of which Reventure discloses. PropertyIQ also adds AI market reports and a built-in deal analyzer.`,
    },
    {
      question: "How much does PropertyIQ cost vs Reventure?",
      answer:
        "Both have a free tier, though Reventure requires an account even to view the map. PropertyIQ Pro is {{PRO_PRICE}}/month; Reventure Premium is $39/month or $399/year (as of June 2026). See our pricing page for current PropertyIQ rates.",
    },
    {
      question:
        "Does PropertyIQ have the doom-and-gloom bias Reventure is known for?",
      answer:
        "No. PropertyIQ is data-first by design — the score, not the story. It highlights strong and weak markets symmetrically using the same validated formula, with no directional narrative attached. If you've found Reventure's bearish framing fatiguing, PropertyIQ gives you the map and the numbers without the thesis.",
    },
    {
      question: "Is the PropertyIQ Score actually validated?",
      answer: `Yes, and the proof is public. The PropertyIQ Score is walk-forward validated out-of-sample across a ${backtestYears}-year history (2001–2023), stays positive in 100% of validated years, and reaches a 3-year information coefficient of ${ic3Y}. Reventure publishes a self-graded annual blog post but no comparable per-geography backtest against realized outcomes.`,
    },
    {
      question: "Does PropertyIQ have a mobile app like Reventure?",
      answer:
        "PropertyIQ is currently web-only, optimized for desktop and mobile browsers. Reventure offers dedicated iOS and Android apps. A PropertyIQ mobile app is on the roadmap.",
    },
  ],
};
