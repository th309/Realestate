"use client";

import React, { useState, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";
import { CodeTabs } from "../../api/components/CodeTabs";
import { SETUP_CONFIGS, MCP_SERVER_URL } from "./mcp-docs-data";
import { Code, Tip, Warning } from "./setup-helpers";
import { ClientSetupDetails } from "./ClientSetupDetails";
import { GenerateApiKeyStep } from "./GenerateApiKeyStep";

const API_KEY_PLACEHOLDER = "YOUR_PIQ_API_KEY";

function replaceKey(config: string, apiKey: string | null): string {
  if (!apiKey) return config;
  return config.replaceAll(API_KEY_PLACEHOLDER, apiKey);
}

function buildClientExamples(apiKey: string | null) {
  return [
    {
      language: "markdown",
      label: "Claude.ai",
      code: SETUP_CONFIGS.claudeAi,
    },
    {
      language: "bash",
      label: "Claude Code",
      code: replaceKey(SETUP_CONFIGS.claudeCode, apiKey),
    },
    {
      language: "json",
      label: "Claude Desktop",
      code: replaceKey(SETUP_CONFIGS.claudeDesktop, apiKey),
    },
    {
      language: "json",
      label: "Cursor",
      code: replaceKey(SETUP_CONFIGS.cursor, apiKey),
    },
    {
      language: "json",
      label: "Windsurf",
      code: replaceKey(SETUP_CONFIGS.windsurf, apiKey),
    },
    {
      language: "json",
      label: "VS Code Copilot",
      code: replaceKey(SETUP_CONFIGS.vscodeCopilot, apiKey),
    },
    {
      language: "json",
      label: "Cline",
      code: replaceKey(SETUP_CONFIGS.cline, apiKey),
    },
  ];
}

export function SetupTab() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const handleKeyGenerated = useCallback((key: string) => setApiKey(key), []);
  const clientSetupExamples = buildClientExamples(apiKey);

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

        <Tip>
          Think of it like giving your AI assistant a direct line to
          PropertyIQ&apos;s entire data platform. When you ask &quot;What&apos;s
          the PropertyIQ score for Austin?&quot;, your AI calls our API in
          real-time and responds with live data.
        </Tip>
      </section>

      {/* ── Step 2: Prerequisites ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-medium shrink-0">
            2
          </span>
          <h2 className="text-xl font-medium text-on-surface">Prerequisites</h2>
        </div>

        <ul className="space-y-3">
          {[
            {
              title: "A PropertyIQ API key",
              detail:
                "Generate one in step 3 below. Keys start with piq_live_. Requires a Pro or Enterprise plan. (Not needed for Claude.ai — it uses your PropertyIQ login instead.)",
            },
            {
              title: "An MCP-compatible AI client",
              detail:
                "Claude.ai (web), Claude Code, Claude Desktop, Cursor, Windsurf, VS Code (Copilot), or Cline.",
            },
          ].map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm text-on-surface-variant"
            >
              <CheckCircle2 className="w-5 h-5 text-[#00C853] shrink-0 mt-0.5" />
              <span>
                <strong className="text-on-surface">{item.title}</strong> —{" "}
                {item.detail}
              </span>
            </li>
          ))}
        </ul>

        <p className="text-sm text-on-surface-variant mt-4">
          No installation required. PropertyIQ runs a hosted MCP server — just
          point your AI client at the URL with your API key.
        </p>
      </section>

      {/* ── Step 3: Generate Your API Key ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-medium shrink-0">
            3
          </span>
          <h2 className="text-xl font-medium text-on-surface">
            Generate Your API Key
          </h2>
        </div>

        <GenerateApiKeyStep onKeyGenerated={handleKeyGenerated} />
      </section>

      {/* ── Step 4: Connect Your AI Client ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-medium shrink-0">
            4
          </span>
          <h2 className="text-xl font-medium text-on-surface">
            Connect Your AI Client
          </h2>
        </div>

        <p className="text-sm text-on-surface-variant mb-4">
          Select your AI client below. Each tab shows the exact config and where
          to put it.
        </p>

        <CodeTabs examples={clientSetupExamples} />

        <ClientSetupDetails apiKey={apiKey} />

        <p className="text-sm text-on-surface-variant mt-6">
          Using a different client? PropertyIQ uses{" "}
          <strong className="text-on-surface font-medium">
            Streamable HTTP transport
          </strong>
          . Any MCP-compatible client can connect at{" "}
          <Code>{MCP_SERVER_URL}</Code> with a Bearer token.
        </p>
      </section>

      {/* ── Step 5: Verify It Works ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-medium shrink-0">
            5
          </span>
          <h2 className="text-xl font-medium text-on-surface">
            Verify It Works
          </h2>
        </div>

        <p className="text-sm text-on-surface-variant mb-4">
          Once connected, try asking your AI assistant any of these:
        </p>

        <div className="space-y-2">
          {[
            "What's the PropertyIQ score for Austin, TX?",
            "Compare the housing markets of Miami and Nashville",
            "What are the top 10 metros for real estate investment?",
            "Give me a cashflow estimate for a $350K property in ZIP 78704",
          ].map((prompt, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg bg-surface-container px-4 py-2.5 text-sm text-on-surface"
            >
              <span className="text-primary font-mono text-xs">▶</span>
              {prompt}
            </div>
          ))}
        </div>

        <p className="text-sm text-on-surface-variant mt-4">
          The AI will automatically call PropertyIQ tools to fetch live data and
          respond with specific metrics, scores, and analysis.
        </p>

        <Warning>
          <strong>Not working?</strong> Check the{" "}
          <a
            href="#troubleshooting"
            className="text-primary hover:underline font-medium"
          >
            Troubleshooting tab
          </a>{" "}
          for common issues and fixes.
        </Warning>
      </section>

      {/* ── Step 6: What's Available ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-medium shrink-0">
            6
          </span>
          <h2 className="text-xl font-medium text-on-surface">
            What&apos;s Available
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              count: 12,
              label: "Core Data Tools",
              desc: "Scores, snapshots, home values, rents, forecasts, demographics",
            },
            {
              count: 7,
              label: "Content & SEO",
              desc: "Reddit posts, LinkedIn, SEO briefs, market narratives, cold emails",
            },
            {
              count: 7,
              label: "For Agents",
              desc: "Buyer briefs, listing data, relocations, market updates",
            },
            {
              count: 8,
              label: "For Investors",
              desc: "Cashflow, deal analysis, cycle position, 1031 targets",
            },
            {
              count: 5,
              label: "For Brokerages",
              desc: "Farm analysis, recruiting, coverage reports, opportunity alerts",
            },
            {
              count: 5,
              label: "For Property Managers",
              desc: "Rent pricing, vacancy risk, portfolio health, rent vs own",
            },
          ].map((cat, i) => (
            <div
              key={i}
              className="rounded-xl border border-outline-variant/50 p-4"
            >
              <div className="text-2xl font-bold text-primary font-mono">
                {cat.count}
              </div>
              <div className="text-sm font-medium text-on-surface mt-1">
                {cat.label}
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                {cat.desc}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <a
            href="#tools"
            className="text-sm font-medium text-primary hover:underline"
          >
            Browse all 44 tools with full parameter docs →
          </a>
        </div>
      </section>
    </div>
  );
}
