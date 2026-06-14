import type { ToolCategory } from "./mcp-docs-data";

export const PROPERTY_MANAGER_TOOLS: ToolCategory = {
  id: "property-managers",
  name: "Property Management",
  emoji: "\u{1F511}",
  description:
    "Rent pricing, vacancy risk, portfolio health, and owner reports",
  toolCount: 5,
  tools: [
    {
      name: "rent_pricing_analysis",
      description: "Current rent index, trends, and suggested pricing context.",
      parameters: [
        {
          name: "zip",
          type: "string",
          required: true,
          description: "ZIP code",
        },
        {
          name: "state",
          type: "string",
          required: true,
          description: "2-letter state code",
        },
      ],
    },
    {
      name: "owner_monthly_report_narrative",
      description: "Ghostwritten market update paragraph for owner statements.",
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
      name: "vacancy_risk_score",
      description:
        "Demand-side signal for vacancy difficulty: DOM, population flow, absorption.",
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
      name: "portfolio_market_health",
      description:
        "Dashboard view across all portfolio markets, flagging deterioration.",
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
      name: "rent_vs_own_analysis",
      description:
        "Compare renting vs buying costs for tenant retention conversations.",
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
  ],
};
