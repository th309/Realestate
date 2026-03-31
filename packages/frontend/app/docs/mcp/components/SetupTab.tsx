"use client";

import React from "react";
import { Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { CodeBlock } from "../../api/components/CodeBlock";
import { CodeTabs } from "../../api/components/CodeTabs";
import { SETUP_CONFIGS } from "./mcp-docs-data";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
      {children}
    </code>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-primary/10 border border-primary/20 p-4 my-4">
      <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
      <div className="text-sm text-on-surface-variant">{children}</div>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-warning/10 border border-warning/20 p-4 my-4">
      <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
      <div className="text-sm text-on-surface-variant">{children}</div>
    </div>
  );
}

const clientSetupExamples = [
  { language: "bash", label: "Claude Code", code: SETUP_CONFIGS.claudeCode },
  {
    language: "json",
    label: "Claude Desktop",
    code: SETUP_CONFIGS.claudeDesktop,
  },
  { language: "json", label: "Cursor", code: SETUP_CONFIGS.cursor },
  { language: "json", label: "Windsurf", code: SETUP_CONFIGS.windsurf },
  {
    language: "json",
    label: "VS Code Copilot",
    code: SETUP_CONFIGS.vscodeCopilot,
  },
  { language: "json", label: "Cline", code: SETUP_CONFIGS.cline },
];

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
              title: "Node.js 18+",
              detail:
                "Check with: node --version. Download from nodejs.org if not installed.",
            },
            {
              title: "An MCP-compatible AI client",
              detail:
                "Claude Code, Claude Desktop, Cursor, Windsurf, VS Code (Copilot), or Cline.",
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
          No API keys, no repo cloning, no build steps. The package installs and
          runs automatically via <Code>npx</Code>.
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
          Select your AI client below. Each tab shows the exact config and where
          to put it.
        </p>

        <CodeTabs examples={clientSetupExamples} />

        {/* Detailed per-client instructions */}
        <div className="mt-6 space-y-6">
          {/* Claude Code */}
          <details className="group rounded-xl border border-outline-variant/50 overflow-hidden">
            <summary className="cursor-pointer px-5 py-3 bg-surface-container-low hover:bg-surface-container text-sm font-medium text-on-surface flex items-center justify-between">
              Claude Code — detailed steps
              <span className="text-on-surface-variant group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <div className="px-5 py-4 text-sm text-on-surface-variant space-y-3 border-t border-outline-variant/50">
              <p>
                <strong className="text-on-surface">1.</strong> Open your
                terminal and run:
              </p>
              <CodeBlock
                code="claude mcp add propertyiq -- npx -y @propertyiq/mcp-server"
                language="bash"
              />
              <p>
                <strong className="text-on-surface">2.</strong> Restart Claude
                Code (or start a new session). The 44 PropertyIQ tools will
                appear automatically.
              </p>
              <p>That&apos;s it. No config file to edit.</p>
            </div>
          </details>

          {/* Claude Desktop */}
          <details className="group rounded-xl border border-outline-variant/50 overflow-hidden">
            <summary className="cursor-pointer px-5 py-3 bg-surface-container-low hover:bg-surface-container text-sm font-medium text-on-surface flex items-center justify-between">
              Claude Desktop — detailed steps
              <span className="text-on-surface-variant group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <div className="px-5 py-4 text-sm text-on-surface-variant space-y-3 border-t border-outline-variant/50">
              <p>
                <strong className="text-on-surface">1.</strong> Open Claude
                Desktop → click your name (bottom-left) →{" "}
                <strong className="text-on-surface">Settings</strong> →{" "}
                <strong className="text-on-surface">Developer</strong> →{" "}
                <strong className="text-on-surface">Edit Config</strong>.
              </p>
              <p>
                <strong className="text-on-surface">2.</strong> This opens the
                config file. If it&apos;s empty or shows <Code>{"{}"}</Code>,
                replace the entire contents with:
              </p>
              <CodeBlock code={SETUP_CONFIGS.claudeDesktop} language="json" />
              <p>
                <strong className="text-on-surface">3.</strong> Save the file.
              </p>
              <p>
                <strong className="text-on-surface">4.</strong> Fully quit
                Claude Desktop (right-click the system tray icon → Quit). Then
                relaunch. Just closing the window is not enough — the app runs
                in the background.
              </p>
              <p>
                <strong className="text-on-surface">5.</strong> Look for a
                hammer icon (🔨) in the chat input. Click it to see the 44
                PropertyIQ tools listed.
              </p>
              <Warning>
                <strong>Common issue:</strong> If you see &quot;Server
                disconnected&quot;, it usually means <Code>npx</Code> is not in
                Claude Desktop&apos;s PATH. Fix: replace{" "}
                <Code>&quot;command&quot;: &quot;npx&quot;</Code> with the full
                path to npx. On Windows:{" "}
                <Code>
                  &quot;command&quot;: &quot;C:\\Program
                  Files\\nodejs\\npx.cmd&quot;
                </Code>
                . On macOS:{" "}
                <Code>&quot;command&quot;: &quot;/usr/local/bin/npx&quot;</Code>
                .
              </Warning>
              <p>
                <strong>Config file location:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  macOS:{" "}
                  <Code>
                    ~/Library/Application
                    Support/Claude/claude_desktop_config.json
                  </Code>
                </li>
                <li>
                  Windows:{" "}
                  <Code>%APPDATA%\Claude\claude_desktop_config.json</Code>
                </li>
              </ul>
            </div>
          </details>

          {/* Cursor */}
          <details className="group rounded-xl border border-outline-variant/50 overflow-hidden">
            <summary className="cursor-pointer px-5 py-3 bg-surface-container-low hover:bg-surface-container text-sm font-medium text-on-surface flex items-center justify-between">
              Cursor — detailed steps
              <span className="text-on-surface-variant group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <div className="px-5 py-4 text-sm text-on-surface-variant space-y-3 border-t border-outline-variant/50">
              <p>
                <strong className="text-on-surface">1.</strong> Open Cursor
                Settings (Cmd/Ctrl + Shift + J) → scroll to{" "}
                <strong className="text-on-surface">MCP Servers</strong> → click{" "}
                <strong className="text-on-surface">Add new MCP server</strong>.
              </p>
              <p>
                <strong className="text-on-surface">2.</strong> Or manually
                create <Code>.cursor/mcp.json</Code> in your project root:
              </p>
              <CodeBlock code={SETUP_CONFIGS.cursor} language="json" />
              <p>
                <strong className="text-on-surface">3.</strong> Restart Cursor.
                The tools will be available in Agent mode (not Ask mode).
              </p>
              <Tip>
                Cursor only uses MCP tools in <strong>Agent</strong> mode, not
                Ask or Edit mode. Make sure you&apos;re in the right mode.
              </Tip>
            </div>
          </details>

          {/* Windsurf */}
          <details className="group rounded-xl border border-outline-variant/50 overflow-hidden">
            <summary className="cursor-pointer px-5 py-3 bg-surface-container-low hover:bg-surface-container text-sm font-medium text-on-surface flex items-center justify-between">
              Windsurf — detailed steps
              <span className="text-on-surface-variant group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <div className="px-5 py-4 text-sm text-on-surface-variant space-y-3 border-t border-outline-variant/50">
              <p>
                <strong className="text-on-surface">1.</strong> Open the file{" "}
                <Code>~/.codeium/windsurf/mcp_config.json</Code>. Create it if
                it doesn&apos;t exist.
              </p>
              <p>
                <strong className="text-on-surface">2.</strong> Add the
                PropertyIQ server config:
              </p>
              <CodeBlock code={SETUP_CONFIGS.windsurf} language="json" />
              <p>
                <strong className="text-on-surface">3.</strong> Restart
                Windsurf.
              </p>
            </div>
          </details>

          {/* VS Code */}
          <details className="group rounded-xl border border-outline-variant/50 overflow-hidden">
            <summary className="cursor-pointer px-5 py-3 bg-surface-container-low hover:bg-surface-container text-sm font-medium text-on-surface flex items-center justify-between">
              VS Code (GitHub Copilot) — detailed steps
              <span className="text-on-surface-variant group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <div className="px-5 py-4 text-sm text-on-surface-variant space-y-3 border-t border-outline-variant/50">
              <p>
                <strong className="text-on-surface">1.</strong> Open VS Code →
                press Cmd/Ctrl + Shift + P → type{" "}
                <Code>Open User Settings (JSON)</Code> → press Enter.
              </p>
              <p>
                <strong className="text-on-surface">2.</strong> Add the{" "}
                <Code>&quot;mcp&quot;</Code> block inside the settings object:
              </p>
              <CodeBlock code={SETUP_CONFIGS.vscodeCopilot} language="json" />
              <p>
                <strong className="text-on-surface">3.</strong> Save and restart
                VS Code. Tools will be available in Copilot Chat (Agent mode).
              </p>
              <Tip>
                VS Code Copilot requires <strong>Agent mode</strong> to use MCP
                tools. Click the mode selector in Copilot Chat and switch from
                &quot;Ask&quot; to &quot;Agent&quot;.
              </Tip>
            </div>
          </details>

          {/* Cline */}
          <details className="group rounded-xl border border-outline-variant/50 overflow-hidden">
            <summary className="cursor-pointer px-5 py-3 bg-surface-container-low hover:bg-surface-container text-sm font-medium text-on-surface flex items-center justify-between">
              Cline — detailed steps
              <span className="text-on-surface-variant group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <div className="px-5 py-4 text-sm text-on-surface-variant space-y-3 border-t border-outline-variant/50">
              <p>
                <strong className="text-on-surface">Option A (UI):</strong> Open
                Cline sidebar → click{" "}
                <strong className="text-on-surface">MCP Servers</strong> → click{" "}
                <strong className="text-on-surface">Add</strong> → set command
                to <Code>npx</Code> and args to{" "}
                <Code>-y @propertyiq/mcp-server</Code>.
              </p>
              <p>
                <strong className="text-on-surface">Option B (file):</strong>{" "}
                Edit <Code>~/.cline/mcp_settings.json</Code>:
              </p>
              <CodeBlock code={SETUP_CONFIGS.cline} language="json" />
              <p>Restart Cline after adding.</p>
            </div>
          </details>
        </div>

        <p className="text-sm text-on-surface-variant mt-6">
          Using a different client? PropertyIQ uses standard{" "}
          <strong className="text-on-surface font-medium">
            stdio transport
          </strong>
          . Any MCP-compatible client can connect — just point it at{" "}
          <Code>npx -y @propertyiq/mcp-server</Code>.
        </p>
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

      {/* ── What's Available ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-medium shrink-0">
            5
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
