import type { ReactNode } from "react";
import { SETUP_CONFIGS, MCP_SERVER_URL } from "../mcp-docs-data";

export type InstallClientId = keyof typeof SETUP_CONFIGS;

export interface InstallRecipe {
  id: InstallClientId;
  label: string;
  authType: "oauth" | "apiKey";
  language: string;
  steps: ReactNode[];
  tip?: ReactNode;
  /** Overrides SETUP_CONFIGS[id] when the raw config text isn't what should render (e.g. Claude.ai's config is a full step-by-step guide, redundant with `steps` above). */
  configOverride?: string;
}

export const INSTALL_CLIENTS: InstallRecipe[] = [
  {
    id: "claudeAi",
    label: "Claude.ai",
    authType: "oauth",
    language: "text",
    steps: [
      "Go to claude.ai → Settings → Connectors",
      "Click + to add a custom connector, then paste the URL below",
      "Click Connect and sign in with your PropertyIQ account — done",
    ],
    tip: "No API key needed — Claude.ai uses your PropertyIQ login. Requires a Pro or Enterprise plan.",
    configOverride: MCP_SERVER_URL,
  },
  {
    id: "claudeCode",
    label: "Claude Code",
    authType: "apiKey",
    language: "bash",
    steps: [
      "Run this command in your terminal",
      "Restart Claude Code (or start a new session)",
    ],
  },
  {
    id: "claudeDesktop",
    label: "Claude Desktop",
    authType: "apiKey",
    language: "json",
    steps: [
      "Open Claude Desktop → Settings → Developer → Edit Config",
      "Replace the file contents with the config below and save",
      "Fully quit Claude Desktop (system tray → Quit) and relaunch — closing the window isn't enough",
    ],
    tip: "Config file: macOS ~/Library/Application Support/Claude/claude_desktop_config.json · Windows %APPDATA%\\Claude\\claude_desktop_config.json",
  },
  {
    id: "cursor",
    label: "Cursor",
    authType: "oauth",
    language: "json",
    steps: [
      "Create .cursor/mcp.json in your project root with the config below",
      "Restart Cursor — it opens a browser sign-in to PropertyIQ the first time you use it",
    ],
    tip: "Cursor only calls MCP tools in Agent mode, not Ask or Edit mode.",
  },
  {
    id: "windsurf",
    label: "Windsurf",
    authType: "apiKey",
    language: "json",
    steps: [
      "Open ~/.codeium/windsurf/mcp_config.json (create it if missing)",
      "Add the config below and restart Windsurf",
    ],
    tip: "Windsurf uses serverUrl, not url — using url will silently fail.",
  },
  {
    id: "vscodeCopilot",
    label: "VS Code",
    authType: "apiKey",
    language: "json",
    steps: [
      "Cmd/Ctrl+Shift+P → Open User Settings (JSON)",
      "Add the mcp block below, save, and restart VS Code",
    ],
    tip: "Tools appear in Copilot Chat when it's set to Agent mode.",
  },
  {
    id: "cline",
    label: "Cline",
    authType: "apiKey",
    language: "json",
    steps: [
      "Open the Cline sidebar → MCP Servers icon → Edit MCP Settings",
      "Add the config below and restart Cline",
    ],
  },
];
