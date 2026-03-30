import type { ToolCategory } from "./mcp-docs-data";

export const INVESTOR_TOOLS: ToolCategory = {
  id: "investors",
  name: "Real Estate Investor",
  emoji: "\u{1F4B0}",
  description:
    "Cashflow estimates, deal analysis, market cycles, and 1031 exchange targets",
  toolCount: 8,
  tools: [
    {
      name: "cashflow_estimate",
      description:
        "Back-of-napkin model: monthly cashflow, cap rate, cash-on-cash return.",
      parameters: [
        {
          name: "zip",
          type: "string",
          required: true,
          description: "ZIP code",
        },
        {
          name: "purchase_price",
          type: "number",
          required: true,
          description: "Purchase price in dollars",
        },
        {
          name: "down_pct",
          type: "number",
          required: false,
          description: "Down payment percentage",
          default: "20",
        },
      ],
    },
    {
      name: "top_cashflow_markets",
      description: "Find markets with best rent-to-price ratio in a state.",
      parameters: [
        {
          name: "state",
          type: "string",
          required: true,
          description: "2-letter state code",
        },
        {
          name: "geography",
          type: "string",
          required: false,
          description: "metro or zip",
          default: "metro",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Number of results",
          default: "10",
        },
      ],
    },
    {
      name: "appreciation_vs_cashflow_matrix",
      description:
        "2x2 quadrant positioning: Growth, Balanced, Cashflow, or Avoid.",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "metro, county, or zip",
        },
        {
          name: "geo_ids",
          type: "string",
          required: true,
          description: "Auto-resolved from market names",
        },
      ],
    },
    {
      name: "deal_analyzer",
      description:
        "Analyze a specific deal: GRM, cap rate, cash-on-cash, verdict.",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "metro, county, or zip",
        },
        {
          name: "geo_id",
          type: "string",
          required: true,
          description: "Auto-resolved from market name",
        },
        {
          name: "purchase_price",
          type: "number",
          required: true,
          description: "Purchase price in dollars",
        },
        {
          name: "monthly_rent",
          type: "number",
          required: true,
          description: "Expected monthly rent",
        },
        {
          name: "down_pct",
          type: "number",
          required: false,
          description: "Down payment percentage",
          default: "20",
        },
      ],
    },
    {
      name: "market_cycle_position",
      description:
        "Assess where a market sits in the cycle: Recovery, Expansion, Hyper-Supply, or Recession.",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "metro, county, or zip",
        },
        {
          name: "geo_id",
          type: "string",
          required: true,
          description: "Auto-resolved from market name",
        },
      ],
    },
    {
      name: "short_term_rental_viability",
      description:
        "Assess STR/Airbnb viability based on tourism, income, and rental trends.",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "metro, county, or zip",
        },
        {
          name: "geo_id",
          type: "string",
          required: true,
          description: "Auto-resolved from market name",
        },
      ],
    },
    {
      name: "portfolio_diversification_score",
      description: "Assess geographic concentration risk across holdings.",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "metro, county, or zip",
        },
        {
          name: "geo_ids",
          type: "string",
          required: true,
          description: "Auto-resolved from market names",
        },
      ],
    },
    {
      name: "exchange_1031_targets",
      description: "Find top replacement property markets for 1031 exchanges.",
      parameters: [
        {
          name: "origin_geography",
          type: "string",
          required: true,
          description: "Auto-resolved from origin market name",
        },
        {
          name: "origin_id",
          type: "string",
          required: true,
          description: "Auto-resolved from origin market name",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Number of results",
          default: "10",
        },
      ],
    },
  ],
};
