import type { ToolCategory } from "./mcp-docs-data";

export const BROKERAGE_TOOLS: ToolCategory = {
  id: "brokerage",
  name: "Brokerage Operations",
  emoji: "\u{1F3E2}",
  description:
    "Farm area analysis, recruitment, coverage reports, and opportunity alerts",
  toolCount: 5,
  tools: [
    {
      name: "farm_area_analysis",
      description:
        "Aggregate analysis across a defined geographic farm (multiple ZIPs).",
      parameters: [
        {
          name: "zip_codes",
          type: "string",
          required: true,
          description: "Comma-separated ZIP codes",
        },
      ],
    },
    {
      name: "referral_network_finder",
      description: "Identify top-scoring markets as logical referral targets.",
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
    {
      name: "agent_recruitment_pitch",
      description:
        "Data-driven pitch for recruiting agents in a specific market.",
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
      name: "brokerage_market_coverage_report",
      description:
        "Executive brief summarizing market health across all brokerage markets.",
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
      name: "market_opportunity_alert",
      description: "Surface emerging markets in a state before competitors.",
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
          description: "metro or county",
          default: "metro",
        },
      ],
    },
  ],
};
