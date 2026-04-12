"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { CodeBlock } from "../../api/components/CodeBlock";
import { MCP_FAQ } from "./mcp-docs-data";

// ─── Shared table primitives ──────────────────────────────────────────────────

function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr className="border-b border-outline-variant">
        {columns.map((col) => (
          <th
            key={col}
            className="text-left text-xs font-medium text-on-surface-variant py-2 pr-4 first:pl-0"
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-xs bg-surface-container px-1.5 py-0.5 rounded font-mono">
      {children}
    </code>
  );
}

// ─── FAQ item ─────────────────────────────────────────────────────────────────

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-outline-variant last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 py-3 text-left"
      >
        <p className="font-medium text-on-surface text-sm">{question}</p>
        {open ? (
          <ChevronDown className="w-4 h-4 text-on-surface-variant shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-on-surface-variant shrink-0" />
        )}
      </button>
      {open && <p className="text-sm text-on-surface-variant pb-3">{answer}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function McpTroubleshootingTab() {
  return (
    <div className="space-y-12">
      {/* ── Section 1: Server won't start ── */}
      <section>
        <h2 className="text-xl font-medium text-on-surface mb-4">
          Server won&apos;t start
        </h2>

        <table className="w-full text-sm">
          <TableHead
            columns={["What You See", "What It Means", "How to Fix It"]}
          />
          <tbody>
            <tr className="border-b border-outline-variant">
              <td className="py-3 pr-4 align-top">
                <Code>Error: Cannot find module</Code>
              </td>
              <td className="py-3 pr-4 align-top text-on-surface-variant">
                Package failed to install
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Run <Code>npx -y @propertyiq/mcp-server</Code> manually in your
                terminal to see the full error. Usually a network or Node
                version issue.
              </td>
            </tr>
            <tr className="border-b border-outline-variant">
              <td className="py-3 pr-4 align-top">
                <Code>npm ERR! could not determine executable</Code>
              </td>
              <td className="py-3 pr-4 align-top text-on-surface-variant">
                npx can&apos;t find the package binary
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Clear the npx cache with <Code>npx clear-npx-cache</Code> and
                try again. Ensure Node.js 18+ is installed.
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 align-top">
                <Code>Error: listen EADDRINUSE</Code>
              </td>
              <td className="py-3 pr-4 align-top text-on-surface-variant">
                Port already in use
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Kill the existing MCP server process, or restart your AI client.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Section 2: Connected but tools aren't working ── */}
      <section>
        <h2 className="text-xl font-medium text-on-surface mb-4">
          Connected but tools aren&apos;t working
        </h2>

        <table className="w-full text-sm">
          <TableHead
            columns={["What You See", "What It Means", "How to Fix It"]}
          />
          <tbody>
            <tr className="border-b border-outline-variant">
              <td className="py-3 pr-4 align-top">
                <Code>API request timeout (15s)</Code>
              </td>
              <td className="py-3 pr-4 align-top text-on-surface-variant">
                Backend server is slow or unreachable
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Check your internet connection. The backend is at{" "}
                <Code>backend-production-ee4d.up.railway.app</Code>.
              </td>
            </tr>
            <tr className="border-b border-outline-variant">
              <td className="py-3 pr-4 align-top">
                <Code>No results found</Code>
              </td>
              <td className="py-3 pr-4 align-top text-on-surface-variant">
                Invalid geography ID or market name
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Use <Code>search_markets</Code> first to find the correct IDs
                before calling other tools.
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 align-top">
                <Code>State parameter required</Code>
              </td>
              <td className="py-3 pr-4 align-top text-on-surface-variant">
                ZIP/city queries need a state filter
              </td>
              <td className="py-3 align-top text-on-surface-variant">
                Include the <Code>state</Code> parameter (e.g., &quot;TX&quot;,
                &quot;CA&quot;) when querying at zip or city level.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Section 3: Client-specific issues ── */}
      <section>
        <h2 className="text-xl font-medium text-on-surface mb-4">
          Client-specific issues
        </h2>

        <div className="space-y-6">
          {/* Claude Code */}
          <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
            <h3 className="text-sm font-medium text-on-surface mb-3">
              Claude Code
            </h3>
            <ul className="space-y-2 text-sm text-on-surface-variant">
              <li>
                If tools don&apos;t appear: run <Code>claude mcp list</Code> to
                verify the server is registered.
              </li>
              <li>
                If the server crashes: check the stderr output with{" "}
                <Code>claude mcp logs propertyiq</Code>.
              </li>
            </ul>
          </div>

          {/* Claude Desktop */}
          <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
            <h3 className="text-sm font-medium text-on-surface mb-3">
              Claude Desktop
            </h3>
            <ul className="space-y-2 text-sm text-on-surface-variant mb-3">
              <li>
                Config file location: macOS{" "}
                <Code>
                  ~/Library/Application
                  Support/Claude/claude_desktop_config.json
                </Code>
                , Windows{" "}
                <Code>%APPDATA%\Claude\claude_desktop_config.json</Code>
              </li>
              <li>
                After editing config, fully restart Claude Desktop (not just
                close/reopen the window).
              </li>
            </ul>
            <p className="text-xs text-on-surface-variant mb-2">
              Validate your JSON config:
            </p>
            <CodeBlock
              code={`cat ~/Library/Application\\ Support/Claude/claude_desktop_config.json | python3 -m json.tool`}
              language="bash"
            />
          </div>

          {/* Cursor */}
          <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
            <h3 className="text-sm font-medium text-on-surface mb-3">Cursor</h3>
            <ul className="space-y-2 text-sm text-on-surface-variant">
              <li>
                Config goes in <Code>.cursor/mcp.json</Code> in project root.
              </li>
              <li>Restart Cursor after adding/modifying the MCP config.</li>
              <li>
                Check Cursor&apos;s MCP panel (bottom bar) to verify connection
                status.
              </li>
              <li>
                If the server returns 401 until you sign in, complete the OAuth
                flow in the browser when Cursor opens it (PropertyIQ uses
                dynamic client registration — no API key in{" "}
                <Code>mcp.json</Code>).
              </li>
            </ul>
          </div>

          {/* VS Code */}
          <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
            <h3 className="text-sm font-medium text-on-surface mb-3">
              VS Code
            </h3>
            <ul className="space-y-2 text-sm text-on-surface-variant">
              <li>
                Config goes in VS Code <Code>settings.json</Code>.
              </li>
              <li>
                Use Cmd/Ctrl+Shift+P &rarr; &quot;MCP: List Servers&quot; to
                verify.
              </li>
              <li>
                Make sure GitHub Copilot Chat extension is installed and
                updated.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Section 4: Still stuck? ── */}
      <section>
        <h2 className="text-xl font-medium text-on-surface mb-4">
          Still stuck?
        </h2>

        <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-sm mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-amber-800 dark:text-amber-200">
            Work through these steps in order. Most issues are resolved by step
            2.
          </p>
        </div>

        <ol className="space-y-2">
          {[
            <>
              Verify Node.js 18+ is installed: <Code>node --version</Code>
            </>,
            <>
              Verify the MCP server starts manually:{" "}
              <Code>npx -y @propertyiq/mcp-server</Code>
            </>,
            <>
              Check that the backend is reachable:{" "}
              <Code>
                curl https://backend-production-ee4d.up.railway.app/api/health
              </Code>
            </>,
            "Try removing and re-adding the server in your AI client.",
            <>
              Still stuck? Email{" "}
              <a
                href="mailto:support@propertyiq.app"
                className="text-primary hover:underline font-medium"
              >
                support@propertyiq.app
              </a>
              .
            </>,
          ].map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm text-on-surface-variant"
            >
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-container text-on-surface-variant text-xs font-medium shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Section 5: FAQ ── */}
      <section>
        <h2 className="text-xl font-medium text-on-surface mb-4">FAQ</h2>

        <div className="rounded-xl border border-outline-variant divide-y divide-outline-variant overflow-hidden px-4">
          {MCP_FAQ.map((item) => (
            <FaqItem
              key={item.question}
              question={item.question}
              answer={item.answer}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
