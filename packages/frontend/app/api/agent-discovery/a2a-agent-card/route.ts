import { AGENT_DISCOVERY } from "@/lib/agent-discovery/manifest";

// /.well-known/agent-card.json — A2A (Agent2Agent) Agent Card for agent-to-agent
// discovery. Reachable via a next.config rewrite. Follows the A2A AgentCard schema
// (https://a2a-protocol.org/latest/specification): `supportedInterfaces` declares
// where PropertyIQ's agent surface actually lives — the MCP endpoint, which speaks
// JSON-RPC 2.0 over streamable HTTP — and `skills` mirrors PropertyIQ's published
// agent-skills. A2A clients should follow `documentationUrl` to learn the MCP
// method set; this card is the discovery entry point, not a second protocol server.
export async function GET(): Promise<Response> {
  const { siteOrigin, mcp } = AGENT_DISCOVERY;
  const card = {
    name: "PropertyIQ",
    description:
      "Real-estate market intelligence for the United States: PropertyIQ Scores, price and rent momentum, economic indicators, and investment underwriting for metros, counties, and ZIP codes.",
    // The agent surface is the PropertyIQ MCP server. MCP's streamable-http
    // transport is JSON-RPC 2.0, so the A2A protocolBinding is JSONRPC.
    supportedInterfaces: [
      {
        url: mcp.endpoint,
        protocolBinding: "JSONRPC",
        protocolVersion: "1.0",
      },
    ],
    provider: {
      organization: "PropertyIQ",
      url: siteOrigin,
    },
    version: mcp.version,
    documentationUrl: mcp.docs,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
    },
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json", "text/plain"],
    skills: [
      {
        id: "market-analysis",
        name: "Market Analysis",
        description:
          "Analyze any US housing market (metro, county, or ZIP) with PropertyIQ's score, price and rent momentum, and economic data.",
        tags: ["real-estate", "market-analysis", "housing", "analytics"],
      },
      {
        id: "deal-analysis",
        name: "Deal Analysis",
        description:
          "Estimate rental cash flow, cap rate, and investment viability for a specific US property address.",
        tags: ["real-estate", "investment", "cash-flow", "underwriting"],
      },
    ],
  };
  return new Response(JSON.stringify(card, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
