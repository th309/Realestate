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

/* ─── Server URL ─── */

export const MCP_SERVER_URL = "https://mcp.propertyiq.app/mcp";

/* ─── Client configuration examples ─── */

export const SETUP_CONFIGS = {
  claudeAi: `# No API key or config file needed — Claude.ai handles auth automatically.

1. Go to claude.ai → Settings → Connectors
2. Click "+" to add a custom connector
3. Enter a name (e.g. "PropertyIQ")
4. Paste this URL:

   ${MCP_SERVER_URL}

5. Click "Add" — this opens the connector page
6. Click "Connect" and authorize with your PropertyIQ login — done!`,

  claudeCode: `claude mcp add propertyiq \\
  --transport http \\
  "${MCP_SERVER_URL}" \\
  --header "Authorization: Bearer YOUR_PIQ_API_KEY"`,

  claudeDesktop: `{
  "mcpServers": {
    "propertyiq": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${MCP_SERVER_URL}",
        "--header",
        "Authorization:\${PIQ_API_KEY}"
      ],
      "env": {
        "PIQ_API_KEY": "Bearer YOUR_PIQ_API_KEY"
      }
    }
  }
}`,

  cursor: `{
  "mcpServers": {
    "propertyiq": {
      "url": "${MCP_SERVER_URL}"
    }
  }
}`,

  windsurf: `{
  "mcpServers": {
    "propertyiq": {
      "serverUrl": "${MCP_SERVER_URL}",
      "headers": {
        "Authorization": "Bearer YOUR_PIQ_API_KEY"
      }
    }
  }
}`,

  vscodeCopilot: `{
  "mcp": {
    "servers": {
      "propertyiq": {
        "type": "http",
        "url": "${MCP_SERVER_URL}",
        "headers": {
          "Authorization": "Bearer YOUR_PIQ_API_KEY"
        }
      }
    }
  }
}`,

  cline: `{
  "mcpServers": {
    "propertyiq": {
      "url": "${MCP_SERVER_URL}",
      "transportType": "streamableHttp",
      "headers": {
        "Authorization": "Bearer YOUR_PIQ_API_KEY"
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
      "For Claude.ai and Cursor (remote MCP over Streamable HTTP), no — you sign in with OAuth using your PropertyIQ account. For some other clients (Claude Code, Claude Desktop, Windsurf, etc.), you may still use a PropertyIQ API key (starts with piq_live_) where the client does not run the OAuth browser flow. A Pro or Enterprise subscription is required for MCP access.",
  },
  {
    question: "Which AI clients support MCP?",
    answer:
      "Claude.ai (web), Claude Code, Claude Desktop, Cursor, Windsurf, VS Code (GitHub Copilot), Cline, and any client that supports remote MCP servers over HTTP.",
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
    question: "How do I get an API key?",
    answer:
      "Sign up for a Pro or Enterprise plan at propertyiq.app/pricing, then generate your API key from your account settings. Keys start with piq_live_.",
  },
];
