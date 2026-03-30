import type { ToolCategory } from "./mcp-docs-data";

export const CONTENT_TOOLS: ToolCategory = {
  id: "content",
  name: "Content & SEO",
  emoji: "\u270D\uFE0F",
  description:
    "Generate content for Reddit, LinkedIn, SEO pages, and cold outreach",
  toolCount: 7,
  tools: [
    {
      name: "generate_reddit_post",
      description:
        "Assemble live market data for Reddit posts, subreddit-specific.",
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
          name: "subreddit",
          type: "string",
          required: false,
          description: "Target subreddit (e.g., realestateinvesting)",
        },
        {
          name: "angle",
          type: "string",
          required: false,
          description: "bullish, bearish, neutral, data_dump, or question",
        },
      ],
    },
    {
      name: "generate_linkedin_post",
      description: "Assemble market data for LinkedIn with format guidance.",
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
          name: "format",
          type: "string",
          required: false,
          description: "single_insight, carousel, or building_in_public",
        },
      ],
    },
    {
      name: "generate_seo_page_brief",
      description:
        "Generate SEO page structure: title, meta, H1/H2 outline, keywords.",
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
      name: "generate_market_narrative",
      description: "Comprehensive data for a full market narrative or report.",
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
      name: "compare_markets_for_content",
      description: 'Side-by-side data for "City A vs City B" content pieces.',
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "metro, county, or zip",
        },
        {
          name: "geo_id_1",
          type: "string",
          required: true,
          description: "Auto-resolved from first market name",
        },
        {
          name: "geo_id_2",
          type: "string",
          required: true,
          description: "Auto-resolved from second market name",
        },
      ],
    },
    {
      name: "get_trending_markets",
      description:
        "Find markets with biggest PropertyIQ score movement (newsworthy).",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "metro, county, or zip",
        },
        {
          name: "direction",
          type: "string",
          required: false,
          description: "rising, falling, or both",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Number of results",
          default: "10",
        },
        {
          name: "state",
          type: "string",
          required: false,
          description: "Filter by state",
        },
      ],
    },
    {
      name: "generate_cold_email",
      description:
        "Assemble market data for outreach email with persona targeting.",
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
          name: "persona",
          type: "string",
          required: false,
          description: "agent, investor, broker, or property_manager",
        },
      ],
    },
  ],
};
