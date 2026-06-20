/**
 * PropertyIQ vs Mashvisor comparison.
 *
 * Competitor facts accurate as of June 2026 (2026-06-10 competitor deep-dive +
 * Mashvisor's public pricing). PropertyIQ coverage/validation numbers import from
 * validation-claims.ts so they track the monthly backtest — never hardcode here.
 */

import type { ComparisonData } from "../comparisons";
import { V4_CLAIMS } from "../validation-claims";

const { metrosScored, zipsScored, ic3Y, backtestYears } = V4_CLAIMS;

export const MASHVISOR_COMPARISON: ComparisonData = {
  slug: "propertyiq-vs-mashvisor",
  competitorName: "Mashvisor",
  competitorUrl: "https://www.mashvisor.com",
  title: "PropertyIQ vs Mashvisor: A Transparent Mashvisor Alternative (2026)",
  description:
    "Looking for a Mashvisor alternative? Compare PropertyIQ and Mashvisor on market coverage, scoring transparency, short-term rental data, billing, and price. PropertyIQ leads on validated market intelligence; Mashvisor leads on Airbnb analytics.",
  features: [
    {
      feature: "Market coverage",
      propertyiq: `${metrosScored} metros, ${zipsScored.toLocaleString()} ZIPs`,
      competitor: "~200 metros",
      winner: "propertyiq",
    },
    {
      feature: "Short-term rental (Airbnb) data",
      propertyiq: "No",
      competitor: "Yes (signature feature)",
      winner: "competitor",
    },
    {
      feature: "Market score methodology",
      propertyiq: "Public + validated",
      competitor: "Mashmeter (undisclosed)",
      winner: "propertyiq",
    },
    {
      feature: "Per-market confidence grade",
      propertyiq: "Yes (A–F)",
      competitor: "No",
      winner: "propertyiq",
    },
    {
      feature: "Data freshness",
      propertyiq: "Monthly refresh",
      competitor: "Degrades outside major metros",
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
      feature: "Free tier",
      propertyiq: "Yes (map + scores)",
      competitor: "No free tier",
      winner: "propertyiq",
    },
  ],
  pricing: [
    { tier: "Free", propertyiq: "$0", competitor: "No free tier" },
    {
      tier: "Entry",
      propertyiq: "{{PRO_PRICE}}/mo",
      competitor: "$49.99/mo (annual)",
    },
    {
      tier: "Pro",
      propertyiq: "{{PRO_PRICE}}/mo",
      competitor: "$99.99/mo (annual)",
    },
  ],
  summary: `Mashvisor's niche is short-term rental analytics — property-level Airbnb and VRBO estimates with nightly rates, occupancy, and cash-on-cash returns, plus its signature STR-vs-LTR side-by-side view. Across roughly 200 metros, that property-level rental detail is its real strength, and if you already know your market and need STR numbers for a specific address, it does a job PropertyIQ does not.\n\nBut Mashvisor is a strained incumbent: reviewers report data accuracy that collapses outside major metros, no methodology or confidence disclosure, and billing complaints (failed cancellations, post-renewal charges) that show up across BBB and Trustpilot. Its list pricing — Lite $49.99 up to Pro $99.99/month on annual plans — is undercut by constant promotional discounting that signals distress.\n\nPropertyIQ approaches the problem from the market level with transparency as the differentiator. The PropertyIQ Score is one validated 1–99 number across ${metrosScored} metros and ${zipsScored.toLocaleString()} ZIP codes, calibrated so 50 equals the state average, out-of-sample validated across a ${backtestYears}-year backtest (2001–2023), positive in 100% of validated years, with a 3-year information coefficient of ${ic3Y}. Every value carries an A–F confidence grade and a source + as-of date — the opposite of Mashvisor's undisclosed Mashmeter — plus AI-written market reports, an MCP server for querying markets from Claude, and a free tier Mashvisor doesn't offer.\n\nBest for: choose Mashvisor if your strategy is short-term rentals and you need property-level Airbnb revenue and occupancy estimates. Choose PropertyIQ if you want transparent, validated market intelligence to pick the right metro, county, or ZIP first — with clean billing and a free tier. Many investors pair them: PropertyIQ to select the market, Mashvisor to underwrite a specific STR. Competitor pricing and features are accurate as of June 2026; check mashvisor.com for current terms.`,
  faqs: [
    {
      question: "What's the best Mashvisor alternative for market research?",
      answer: `PropertyIQ is a strong Mashvisor alternative when your goal is choosing markets rather than underwriting individual short-term rentals. It covers ${metrosScored} metros (vs Mashvisor's ~200) with a published, validated scoring methodology, A–F confidence grades, a free tier, and transparent billing. For Airbnb-specific property analytics, Mashvisor remains the stronger tool.`,
    },
    {
      question: "How much does PropertyIQ cost compared to Mashvisor?",
      answer:
        "PropertyIQ has a free tier and Pro at {{PRO_PRICE}}/month. Mashvisor has no free tier; its plans run from $49.99 (Lite) to $99.99 (Pro) per month on annual billing as of June 2026, though it discounts heavily. See our pricing page for current PropertyIQ rates.",
    },
    {
      question: "Does Mashvisor have features PropertyIQ doesn't?",
      answer:
        "Yes. Mashvisor includes short-term rental (Airbnb) analytics — nightly rates, occupancy estimates, and an STR-vs-LTR comparison — that PropertyIQ does not currently offer. If your strategy centers on vacation rentals, Mashvisor can complement PropertyIQ's market-level intelligence.",
    },
    {
      question: "Is PropertyIQ's data more reliable than Mashvisor's?",
      answer: `PropertyIQ publishes its methodology and a ${backtestYears}-year out-of-sample backtest, and grades every market's data quality A–F so you can see where coverage is thin. Mashvisor discloses no methodology or confidence indicator, and reviewers report accuracy problems outside major metros. PropertyIQ is built to tell you when not to trust a number.`,
    },
    {
      question: "Can I use PropertyIQ and Mashvisor together?",
      answer:
        "Yes, and many investors do. Use PropertyIQ to identify the best-performing markets with validated scoring across hundreds of metros and tens of thousands of ZIPs, then use Mashvisor to analyze specific short-term rental properties within those markets.",
    },
  ],
};
