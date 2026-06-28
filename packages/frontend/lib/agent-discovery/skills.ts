// Source of truth for PropertyIQ's published Agent Skills (agentskills.io discovery
// RFC v0.2.0). Each skill's `markdown` is BOTH served verbatim at
// /.well-known/agent-skills/<name>/SKILL.md AND hashed (sha256 over these exact
// UTF-8 bytes) into /.well-known/agent-skills/index.json. Because the served bytes
// and the hashed bytes are the same string, the published `digest` can never drift
// from the served artifact. Keep content ASCII/UTF-8 with no BOM so the hash is
// deterministic across environments.

export interface AgentSkillDoc {
  /** Skill id: lowercase letters, numbers, and hyphens only (RFC v0.2.0). */
  name: string;
  /** One-line summary, mirrored in the index entry and the SKILL.md frontmatter. */
  description: string;
  /** The exact bytes served as SKILL.md and hashed into the index digest. */
  markdown: string;
}

const MARKET_ANALYSIS = `---
name: propertyiq-market-analysis
description: Analyze any US housing market (metro, county, or ZIP) with PropertyIQ's scores, momentum, and economic data.
---

# PropertyIQ market analysis

Use PropertyIQ to evaluate the health and momentum of a US real-estate market at the
metro, county, or ZIP level. Coverage: 900+ metros, 3,000+ counties, 29,000+ ZIPs.

## When to use

When a user asks whether a market is heating up or cooling, how it compares to its
state, what homes cost, or where demand is strongest.

## How to call it

PropertyIQ exposes the same data three ways. Prefer MCP for agents.

- MCP (recommended): connect to the streamable-HTTP server at
  https://mcp.propertyiq.app/mcp and call the tools below. Auth: see the agent-auth
  skill. Discovery: https://www.propertyiq.app/.well-known/mcp/server-card.json
- WebMCP (in-browser): on www.propertyiq.app, navigator.modelContext exposes
  search_markets, get_market_snapshot, and get_propertyiq_score with no auth.
- REST: GET https://www.propertyiq.app/backend/api/... (same-origin, anonymous-safe).

## Workflow

1. Resolve the market. Call search_markets (or GET /backend/api/geography/search?query=Austin)
   to turn a place name into a geography_type ("metro" | "county" | "zip") and geography_id.
2. Read the snapshot. Call get_market_snapshot (or GET
   /backend/api/market-snapshot/{geography}/{geo_id}) for current median price, the
   PropertyIQ Score, confidence, and 1y/3y returns.
3. Read the score in context. The PropertyIQ Score is a demand/momentum signal where
   50 = the market's state average. Higher means outperformance relative to its state.
   Labels describe momentum (RISING, STEADY, EASING), not market quality. A letter
   confidence (A-F) reports data coverage, independent of the score.

## Interpreting the score

- 60+ FIRMING/RISING/STRONG: demand momentum above the market's state average.
- 50-59 STEADY: roughly at the state average.
- below 50 EASING/WEAK: cooling momentum relative to the state.

Always report the confidence letter alongside the score, and prefer A/B confidence
markets for high-stakes decisions.
`;

const DEAL_ANALYSIS = `---
name: propertyiq-deal-analysis
description: Estimate rental cash flow, cap rate, and investment viability for a specific US property address.
---

# PropertyIQ deal analysis

Use PropertyIQ to underwrite a specific rental or investment property and to ground the
analysis in real market data for the surrounding ZIP/metro.

## When to use

When a user gives a property address (or price + rent assumptions) and asks whether it
cash-flows, what the cap rate is, or whether the surrounding market supports the deal.

## How to call it

- MCP (recommended): https://mcp.propertyiq.app/mcp. Relevant tools include
  deal_analyzer, cashflow_estimate, rent_pricing_analysis, and short_term_rental_viability.
  Auth: see the agent-auth skill.
- REST market context (anonymous-safe, same-origin on www.propertyiq.app):
  GET /backend/api/market-snapshot/{geography}/{geo_id} and
  GET /backend/api/scores/{geography}/{location_id}.

## Workflow

1. Locate the property's market. Resolve the ZIP (and parent metro) via search_markets.
2. Pull market context. Read the snapshot and PropertyIQ Score for the ZIP and metro:
   median price, rent levels, momentum, and confidence.
3. Underwrite. Call deal_analyzer / cashflow_estimate with the price, down payment,
   rate, taxes, insurance, and rent. Cross-check the rent against rent_pricing_analysis.
4. Judge viability. Combine the deal's cash flow and cap rate with the market's demand
   momentum (PropertyIQ Score vs its state) and supply signals (days on market, price cuts).

## Guidance

- Treat the market's PropertyIQ Score as a tailwind/headwind on the deal, not a buy/sell
  verdict on its own.
- Surface confidence: thin data (C/F) means wider error bars on the underwriting inputs.
- PropertyIQ provides market intelligence, not a guarantee of returns; state assumptions.
`;

const AGENT_AUTH = `---
name: agent-auth
description: How an AI agent authenticates to PropertyIQ's MCP server and REST API.
---

# PropertyIQ agent authentication

PropertyIQ exposes its analytics to agents two ways. Public, read-only market lookups
need no auth; tier-gated tools and the full MCP tool set require a token.

## MCP (recommended)

- Endpoint: https://mcp.propertyiq.app/mcp (transport: streamable-http).
- Auth: OAuth 2.1 + PKCE with dynamic client registration (RFC 7591).
  - Register:  https://mcp.propertyiq.app/register
  - Authorize: https://mcp.propertyiq.app/authorize
  - Token:     https://mcp.propertyiq.app/token
- Discovery metadata:
  - Protected resource (RFC 9728): https://mcp.propertyiq.app/.well-known/oauth-protected-resource
  - Authorization server (RFC 8414): https://mcp.propertyiq.app/.well-known/oauth-authorization-server
- Full recipe: https://www.propertyiq.app/auth.md

## Platform REST API

- Authenticate with a bearer API key prefixed piq_live_ in the Authorization header.
- Obtain a key and the base URL from the API docs: https://www.propertyiq.app/docs/api

## Anonymous access

- The same-origin endpoints under https://www.propertyiq.app/backend/api/ (geography
  search, market snapshot, scores) are public and need no credentials, so read-only
  agents and in-browser WebMCP tools work without registration.
`;

export const AGENT_SKILLS: readonly AgentSkillDoc[] = [
  {
    name: "propertyiq-market-analysis",
    description:
      "Analyze any US housing market (metro, county, or ZIP) with PropertyIQ's scores, momentum, and economic data.",
    markdown: MARKET_ANALYSIS,
  },
  {
    name: "propertyiq-deal-analysis",
    description:
      "Estimate rental cash flow, cap rate, and investment viability for a specific US property address.",
    markdown: DEAL_ANALYSIS,
  },
  {
    name: "agent-auth",
    description:
      "How an AI agent authenticates to PropertyIQ's MCP server and REST API.",
    markdown: AGENT_AUTH,
  },
] as const;

/** Find a published skill by its url-safe name. */
export function findAgentSkill(name: string): AgentSkillDoc | undefined {
  return AGENT_SKILLS.find((skill) => skill.name === name);
}
