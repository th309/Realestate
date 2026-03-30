/* ─── Tab configuration ─── */

export type McpTabId = "setup" | "tools" | "examples" | "troubleshooting";

export const MCP_TABS: { id: McpTabId; label: string }[] = [
  { id: "setup", label: "Setup Guide" },
  { id: "tools", label: "Tools Reference" },
  { id: "examples", label: "Examples" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

export const DEFAULT_MCP_TAB: McpTabId = "setup";

/* ─── Tool types ─── */

export interface McpToolParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string;
}

export interface McpTool {
  name: string;
  description: string;
  parameters: McpToolParam[];
}

export interface ToolCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  toolCount: number;
  tools: McpTool[];
}

/* ─── Client configuration examples ─── */

export const SETUP_CONFIGS = {
  claudeCode: `claude mcp add propertyiq -- npx -y @propertyiq/mcp-server`,

  claudeDesktop: `{
  "mcpServers": {
    "propertyiq": {
      "command": "npx",
      "args": ["-y", "@propertyiq/mcp-server"]
    }
  }
}`,

  cursor: `{
  "mcpServers": {
    "propertyiq": {
      "command": "npx",
      "args": ["-y", "@propertyiq/mcp-server"]
    }
  }
}`,

  vscodeCopilot: `{
  "mcp": {
    "servers": {
      "propertyiq": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@propertyiq/mcp-server"]
      }
    }
  }
}`,
};

/* ─── FAQ items ─── */

export const MCP_FAQ = [
  {
    question: "What is MCP?",
    answer:
      "MCP (Model Context Protocol) is an open standard that lets AI assistants connect to external data sources and tools. It's like a USB-C port for AI — one protocol, many tools.",
  },
  {
    question: "Do I need an API key?",
    answer:
      "No. The MCP server connects directly to the PropertyIQ backend. It uses the same public API endpoints available to all users.",
  },
  {
    question: "Which AI clients support MCP?",
    answer:
      "Claude Code, Claude Desktop, Cursor, VS Code (GitHub Copilot), Windsurf, and any MCP-compatible client.",
  },
  {
    question: "Can I use this with ChatGPT or Gemini?",
    answer:
      "Not directly — ChatGPT and Gemini don't support MCP yet. You can use it with any MCP-compatible client listed above.",
  },
  {
    question: "How fresh is the data?",
    answer:
      "Metrics update monthly following source publication (Zillow, Census, BLS). PropertyIQ scores recalculate weekly.",
  },
  {
    question: "Is there a rate limit?",
    answer:
      "The MCP server calls the PropertyIQ API, which has standard rate limits. Normal conversational usage will never hit them.",
  },
  {
    question: "Can I modify the tools or add custom ones?",
    answer:
      "Yes — the MCP server is open source TypeScript. Check the GitHub repo for contribution instructions.",
  },
];
