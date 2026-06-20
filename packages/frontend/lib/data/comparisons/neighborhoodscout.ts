/**
 * PropertyIQ vs NeighborhoodScout comparison.
 *
 * Competitor facts accurate as of June 2026. PropertyIQ coverage/validation
 * numbers import from validation-claims.ts so they track the monthly backtest.
 */

import type { ComparisonData } from "../comparisons";
import { V4_CLAIMS } from "../validation-claims";

const { metrosScored, countiesScored, zipsScored, ic3Y, backtestYears } =
  V4_CLAIMS;

export const NEIGHBORHOODSCOUT_COMPARISON: ComparisonData = {
  slug: "propertyiq-vs-neighborhoodscout",
  competitorName: "NeighborhoodScout",
  competitorUrl: "https://www.neighborhoodscout.com",
  title: "PropertyIQ vs NeighborhoodScout: Predictive vs Descriptive (2026)",
  description:
    "Compare PropertyIQ and NeighborhoodScout for housing analytics. PropertyIQ predicts market performance with a validated score; NeighborhoodScout describes neighborhood crime, schools, and demographics. See coverage, scoring, and pricing.",
  features: [
    {
      feature: "Geographic coverage",
      propertyiq: `${metrosScored} metros, ${zipsScored.toLocaleString()} ZIPs`,
      competitor: "26,000+ indexed areas",
      winner: "tie",
    },
    {
      feature: "Market scoring",
      propertyiq: "PropertyIQ Score (1–99), validated",
      competitor: "Crime / school grades",
      winner: "propertyiq",
    },
    {
      feature: "Predictive vs descriptive",
      propertyiq: "Predictive (backtested)",
      competitor: "Descriptive (current/historical)",
      winner: "propertyiq",
    },
    {
      feature: "Crime & school data",
      propertyiq: "No",
      competitor: "Yes (detailed)",
      winner: "competitor",
    },
    {
      feature: "Interactive map",
      propertyiq: "Yes",
      competitor: "Yes",
      winner: "tie",
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
      propertyiq: "Yes",
      competitor: "No",
      winner: "propertyiq",
    },
  ],
  pricing: [
    { tier: "Free", propertyiq: "$0", competitor: "None" },
    {
      tier: "Pro",
      propertyiq: "{{PRO_PRICE}}/mo",
      competitor: "$41.60/mo (annual)",
    },
    {
      tier: "Enterprise",
      propertyiq: "{{ENTERPRISE_PRICE}}/mo",
      competitor: "$208/mo",
    },
  ],
  summary: `NeighborhoodScout has spent over a decade building deep, hyperlocal data — neighborhood crime rates by type, school quality grades, demographics, and historical appreciation across 26,000+ indexed areas. Its strength is describing what a neighborhood looks like today: drill into a specific area within a city and compare schools and crime block by block. The analytics are descriptive and presented largely as static tables.\n\nPropertyIQ solves a different problem — predicting which markets will outperform. The PropertyIQ Score is a single validated 1–99 number across ${metrosScored} metros, ${countiesScored.toLocaleString()} counties, and ${zipsScored.toLocaleString()} ZIP codes, calibrated so 50 equals the state average. It is out-of-sample validated across a ${backtestYears}-year walk-forward backtest (2001–2023), positive in 100% of validated years, with a 3-year information coefficient of ${ic3Y} — a level of predictive rigor descriptive platforms don't attempt. PropertyIQ also adds interactive visualizations, AI-written market reports, an MCP server for querying any market from Claude, and an A–F confidence grade on every value.\n\nBest for: choose NeighborhoodScout if you need hyperlocal neighborhood detail — crime breakdowns, school ratings, demographics — especially as a homebuyer evaluating specific neighborhoods. Choose PropertyIQ if you need validated, predictive market intelligence to decide which metros, counties, or ZIPs are likely to appreciate. They complement each other: PropertyIQ to pick the market, NeighborhoodScout to vet the neighborhood. Competitor pricing accurate as of June 2026; NeighborhoodScout's cheapest plan is $41.60/month billed annually ($499/year).`,
  faqs: [
    {
      question: "Is PropertyIQ a good NeighborhoodScout alternative?",
      answer:
        "It depends on the job. For predicting market performance, PropertyIQ is stronger — it offers a validated, published market score and a free tier, where NeighborhoodScout starts at $41.60/month and is descriptive rather than predictive. For neighborhood-level crime and school data, NeighborhoodScout goes deeper than PropertyIQ.",
    },
    {
      question: "How much does PropertyIQ cost vs NeighborhoodScout?",
      answer:
        "PropertyIQ has a free tier and Pro at {{PRO_PRICE}}/month. NeighborhoodScout's cheapest plan is $41.60/month billed annually ($499/year), with a professional plan around $208/month (as of June 2026). See our pricing page for current rates.",
    },
    {
      question:
        "Does NeighborhoodScout have crime and school data PropertyIQ doesn't?",
      answer:
        "Yes. NeighborhoodScout offers detailed neighborhood-level crime statistics and school quality grades that PropertyIQ does not include. If crime and school ratings are central to your research, NeighborhoodScout complements PropertyIQ's market analytics.",
    },
    {
      question:
        "Does PropertyIQ have neighborhood-level data like NeighborhoodScout?",
      answer:
        "PropertyIQ provides data at the metro, county, and ZIP level — not sub-ZIP neighborhood level. NeighborhoodScout offers finer-grained, block-by-block comparisons within cities. PropertyIQ trades that granularity for validated, predictive market scoring across a far broader footprint.",
    },
  ],
};
