import type { ToolCategory } from "./mcp-docs-data";

export const AGENT_TOOLS: ToolCategory = {
  id: "agents",
  name: "Real Estate Agent",
  emoji: "\u{1F3E0}",
  description:
    "Buyer consultations, listing presentations, and client communications",
  toolCount: 7,
  tools: [
    {
      name: "buyer_consultation_brief",
      description:
        "Prep sheet for buyer meetings: affordability, competition, DOM, inventory.",
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
          name: "budget",
          type: "number",
          required: false,
          description: "Buyer's budget",
        },
      ],
    },
    {
      name: "listing_presentation_data",
      description: "Hyperlocal stats for agent listing presentations.",
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
      name: "neighborhood_comparison",
      description:
        "Side-by-side comparison of 2-3 neighborhoods for buyer decisions.",
      parameters: [
        {
          name: "zip_1",
          type: "string",
          required: true,
          description: "First ZIP code",
        },
        {
          name: "zip_2",
          type: "string",
          required: true,
          description: "Second ZIP code",
        },
        {
          name: "zip_3",
          type: "string",
          required: false,
          description: "Third ZIP code",
        },
      ],
    },
    {
      name: "relocation_package",
      description:
        "Full narrative comparing two metros for relocating clients.",
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
          name: "destination_geography",
          type: "string",
          required: true,
          description: "Auto-resolved from destination market name",
        },
        {
          name: "destination_id",
          type: "string",
          required: true,
          description: "Auto-resolved from destination market name",
        },
      ],
    },
    {
      name: "monthly_market_update_email",
      description: "Draft a client newsletter/drip email ready for CRM paste.",
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
      name: "price_reduction_analysis",
      description:
        "Data to support price reduction conversations with sellers.",
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
      name: "first_time_buyer_explainer",
      description:
        "Plain-language market brief stripped of jargon for first-time buyers.",
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
