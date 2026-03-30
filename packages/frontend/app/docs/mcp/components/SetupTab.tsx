"use client";

import { Info } from "lucide-react";
import { CodeBlock } from "../../api/components/CodeBlock";
import { CodeTabs } from "../../api/components/CodeTabs";
import { SETUP_CONFIGS } from "./mcp-docs-data";

// ─── Step 3: Client setup examples ──────────────────────────────────────────

const clientSetupExamples = [
  {
    language: "bash",
    label: "Claude Code",
    code: SETUP_CONFIGS.claudeCode,
  },
  {
    language: "json",
    label: "Claude Desktop",
    code: SETUP_CONFIGS.claudeDesktop,
  },
  {
    language: "json",
    label: "Cursor",
    code: SETUP_CONFIGS.cursor,
  },
  {
    language: "json",
    label: "VS Code",
    code: SETUP_CONFIGS.vscodeCopilot,
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function SetupTab() {
  return (
    <div className="space-y-12">
      {/* ── Step 1: What is MCP? ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-medium shrink-0">
            1
          </span>
          <h2 className="text-xl font-medium text-on-surface">What is MCP?</h2>
        </div>

        <p className="text-sm text-on-surface-variant mb-4">
          MCP (Model Context Protocol) is an open standard that lets AI
          assistants like Claude connect to external tools and data sources.
          PropertyIQ&apos;s MCP server gives your AI assistant access to 44 real
          estate analysis tools — scores, market data, comparisons, and more.
        </p>

        <div className="flex items-start gap-3 rounded-xl bg-primary/15 border border-outline-variant/50 p-4">
          <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-on-surface-variant">
            Think of it like giving your AI assistant a direct line to
            PropertyIQ&apos;s entire data platform.
          </p>
        </div>
      </section>

      {/* ── Step 2: Prerequisites ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-medium shrink-0">
            2
          </span>
          <h2 className="text-xl font-medium text-on-surface">Prerequisites</h2>
        </div>

        <ul className="space-y-2">
          {[
            "Node.js 18+ installed",
            "An MCP-compatible AI client (Claude Code, Claude Desktop, Cursor, or VS Code)",
          ].map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm text-on-surface-variant"
            >
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-container text-on-surface-variant text-xs font-medium shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <p className="text-sm text-on-surface-variant mt-4">
          That&apos;s it — no repo cloning, no build steps. The package installs
          and runs automatically via{" "}
          <span className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
            npx
          </span>
          .
        </p>
      </section>

      {/* ── Step 3: Connect Your AI Client ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-medium shrink-0">
            3
          </span>
          <h2 className="text-xl font-medium text-on-surface">
            Connect Your AI Client
          </h2>
        </div>

        <p className="text-sm text-on-surface-variant mb-4">
          Choose your AI client below and follow the instructions to connect
          PropertyIQ.
        </p>

        <CodeTabs examples={clientSetupExamples} />

        {/* Per-tab notes */}
        <div className="mt-4 space-y-2">
          <div className="flex items-start gap-3 rounded-xl bg-surface-container-low border border-outline-variant/50 p-4">
            <span className="text-on-surface-variant text-base mt-0.5 shrink-0">
              💡
            </span>
            <div className="text-sm text-on-surface-variant space-y-1.5">
              <p>
                <strong className="text-on-surface font-medium">
                  Claude Desktop:
                </strong>{" "}
                Add the JSON to your config file — macOS:{" "}
                <span className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
                  ~/Library/Application
                  Support/Claude/claude_desktop_config.json
                </span>
                , Windows:{" "}
                <span className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
                  %APPDATA%\Claude\claude_desktop_config.json
                </span>
              </p>
              <p>
                <strong className="text-on-surface font-medium">Cursor:</strong>{" "}
                Add to{" "}
                <span className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
                  .cursor/mcp.json
                </span>{" "}
                in your project root.
              </p>
              <p>
                <strong className="text-on-surface font-medium">
                  VS Code:
                </strong>{" "}
                Add to your VS Code{" "}
                <span className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
                  settings.json
                </span>{" "}
                (Cmd/Ctrl+Shift+P → &quot;Preferences: Open User Settings
                (JSON)&quot;).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Step 4: Verify It Works ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-medium shrink-0">
            4
          </span>
          <h2 className="text-xl font-medium text-on-surface">
            Verify It Works
          </h2>
        </div>

        <p className="text-sm text-on-surface-variant mb-4">
          Once connected, try asking your AI assistant:
        </p>

        <CodeBlock
          code="What's the PropertyIQ score for Austin, TX?"
          language="text"
        />

        <p className="text-sm text-on-surface-variant mt-4">
          If everything is set up correctly, the assistant will call{" "}
          <span className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
            search_markets
          </span>{" "}
          to find Austin, then{" "}
          <span className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
            get_propertyiq_score
          </span>{" "}
          to fetch the score.
        </p>

        {/* "Ready for more?" card */}
        <div className="mt-8 rounded-xl bg-surface-container-low border border-outline-variant/50 p-5">
          <h3 className="text-base font-medium text-on-surface mb-2">
            Ready for more?
          </h3>
          <p className="text-sm text-on-surface-variant mb-3">
            Now that your MCP server is connected, explore all the tools
            available:
          </p>
          <a
            href="#tools"
            className="text-sm font-medium text-primary hover:underline"
          >
            Browse all 44 tools →
          </a>
        </div>
      </section>
    </div>
  );
}
