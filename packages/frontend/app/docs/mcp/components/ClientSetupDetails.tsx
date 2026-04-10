"use client";

import React from "react";
import { CodeBlock } from "../../api/components/CodeBlock";
import { SETUP_CONFIGS, MCP_SERVER_URL } from "./mcp-docs-data";
import { Code, Tip } from "./setup-helpers";

const API_KEY_PLACEHOLDER = "YOUR_PIQ_API_KEY";

function replaceKey(config: string, apiKey: string | null): string {
  if (!apiKey) return config;
  return config.replaceAll(API_KEY_PLACEHOLDER, apiKey);
}

interface ClientSetupDetailsProps {
  apiKey: string | null;
}

export function ClientSetupDetails({ apiKey }: ClientSetupDetailsProps) {
  const hasKey = !!apiKey;
  return (
    <div className="mt-6 space-y-6">
      {/* Claude.ai */}
      <details className="group rounded-xl border border-outline-variant/50 overflow-hidden">
        <summary className="cursor-pointer px-5 py-3 bg-surface-container-low hover:bg-surface-container text-sm font-medium text-on-surface flex items-center justify-between">
          Claude.ai — detailed steps
          <span className="text-on-surface-variant group-open:rotate-180 transition-transform">
            ▾
          </span>
        </summary>
        <div className="px-5 py-4 text-sm text-on-surface-variant space-y-3 border-t border-outline-variant/50">
          <p>
            Claude.ai connects via OAuth — no API key or config file needed.
          </p>
          <p>
            <strong className="text-on-surface">1.</strong> Go to{" "}
            <a
              href="https://claude.ai"
              className="text-primary hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              claude.ai
            </a>{" "}
            → <strong className="text-on-surface">Settings</strong> →{" "}
            <strong className="text-on-surface">Connectors</strong>.
          </p>
          <p>
            <strong className="text-on-surface">2.</strong> Click the{" "}
            <strong className="text-on-surface">+</strong> button to add a
            custom connector.
          </p>
          <p>
            <strong className="text-on-surface">3.</strong> Enter a name (e.g.{" "}
            <Code>PropertyIQ</Code>) and paste the server URL:
          </p>
          <CodeBlock code={MCP_SERVER_URL} language="text" />
          <p>
            <strong className="text-on-surface">4.</strong> Click{" "}
            <strong className="text-on-surface">Add</strong> — this opens the
            connector page.
          </p>
          <p>
            <strong className="text-on-surface">5.</strong> Click{" "}
            <strong className="text-on-surface">Connect</strong>. You&apos;ll be
            redirected to PropertyIQ — sign in and click{" "}
            <strong className="text-on-surface">Allow</strong> on the consent
            screen.
          </p>
          <p>
            <strong className="text-on-surface">6.</strong> You&apos;re
            connected! The 44 PropertyIQ tools will appear in your conversations
            automatically.
          </p>
          <Tip>
            Claude.ai uses your PropertyIQ login — no API key needed. You still
            need a <strong>Pro or Enterprise</strong> subscription for MCP
            access.
          </Tip>
        </div>
      </details>

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
            <strong className="text-on-surface">1.</strong> Open your terminal
            and run:
          </p>
          <CodeBlock
            code={replaceKey(SETUP_CONFIGS.claudeCode, apiKey)}
            language="bash"
          />
          {!hasKey && (
            <p>
              Replace <Code>YOUR_PIQ_API_KEY</Code> with your actual API key
              (starts with <Code>piq_live_</Code>).
            </p>
          )}
          <p>
            <strong className="text-on-surface">2.</strong> Restart Claude Code
            (or start a new session). The 44 PropertyIQ tools will appear
            automatically.
          </p>
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
            Claude Desktop&apos;s config file only supports stdio transport. We
            use <Code>mcp-remote</Code> to bridge the remote HTTP server.
          </p>
          <p>
            <strong className="text-on-surface">1.</strong> Make sure you have{" "}
            <a
              href="https://nodejs.org/"
              className="text-primary hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              Node.js
            </a>{" "}
            installed (needed for <Code>npx</Code>).
          </p>
          <p>
            <strong className="text-on-surface">2.</strong> Open Claude Desktop
            → click your name (bottom-left) →{" "}
            <strong className="text-on-surface">Settings</strong> →{" "}
            <strong className="text-on-surface">Developer</strong> →{" "}
            <strong className="text-on-surface">Edit Config</strong>.
          </p>
          <p>
            <strong className="text-on-surface">3.</strong> This opens the
            config file. If it&apos;s empty or shows <Code>{"{}"}</Code>,
            replace the entire contents with:
          </p>
          <CodeBlock
            code={replaceKey(SETUP_CONFIGS.claudeDesktop, apiKey)}
            language="json"
          />
          {!hasKey && (
            <p>
              Replace <Code>YOUR_PIQ_API_KEY</Code> with your actual API key
              (starts with <Code>piq_live_</Code>).
            </p>
          )}
          <p>
            <strong className="text-on-surface">4.</strong> Save the file.
          </p>
          <p>
            <strong className="text-on-surface">5.</strong> Fully quit Claude
            Desktop (right-click the system tray icon → Quit). Then relaunch.
            Just closing the window is not enough — the app runs in the
            background.
          </p>
          <p>
            <strong className="text-on-surface">6.</strong> Look for a hammer
            icon in the chat input. Click it to see the 44 PropertyIQ tools
            listed.
          </p>
          <p>
            <strong>Config file location:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>
              macOS:{" "}
              <Code>
                ~/Library/Application Support/Claude/claude_desktop_config.json
              </Code>
            </li>
            <li>
              Windows: <Code>%APPDATA%\Claude\claude_desktop_config.json</Code>
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
            <strong className="text-on-surface">1.</strong> Create{" "}
            <Code>.cursor/mcp.json</Code> in your project root:
          </p>
          <CodeBlock
            code={replaceKey(SETUP_CONFIGS.cursor, apiKey)}
            language="json"
          />
          {!hasKey && (
            <p>
              Replace <Code>YOUR_PIQ_API_KEY</Code> with your actual API key.
            </p>
          )}
          <p>
            <strong className="text-on-surface">2.</strong> Restart Cursor. The
            tools will be available in Agent mode (not Ask mode).
          </p>
          <Tip>
            Cursor only uses MCP tools in <strong>Agent</strong> mode, not Ask
            or Edit mode. Make sure you&apos;re in the right mode.
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
            <strong className="text-on-surface">1.</strong> Open{" "}
            <Code>~/.codeium/windsurf/mcp_config.json</Code> (create it if it
            doesn&apos;t exist) and add:
          </p>
          <CodeBlock
            code={replaceKey(SETUP_CONFIGS.windsurf, apiKey)}
            language="json"
          />
          {!hasKey && (
            <p>
              Replace <Code>YOUR_PIQ_API_KEY</Code> with your actual API key.
            </p>
          )}
          <Tip>
            Windsurf uses <Code>serverUrl</Code> (not <Code>url</Code>). This is
            the most common mistake — using <Code>url</Code> will silently fail.
          </Tip>
          <p>
            <strong className="text-on-surface">2.</strong> Restart Windsurf.
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
            Cmd/Ctrl + Shift + P → <Code>Open User Settings (JSON)</Code>.
          </p>
          <p>
            <strong className="text-on-surface">2.</strong> Add the{" "}
            <Code>&quot;mcp&quot;</Code> block:
          </p>
          <CodeBlock
            code={replaceKey(SETUP_CONFIGS.vscodeCopilot, apiKey)}
            language="json"
          />
          {!hasKey && (
            <p>
              Replace <Code>YOUR_PIQ_API_KEY</Code> with your actual API key.
            </p>
          )}
          <p>
            <strong className="text-on-surface">3.</strong> Save and restart VS
            Code. Tools will be available in Copilot Chat (Agent mode).
          </p>
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
            <strong className="text-on-surface">1.</strong> In VS Code, open the
            Cline sidebar → click the MCP Servers icon →{" "}
            <strong className="text-on-surface">Edit MCP Settings</strong>.
          </p>
          <p>
            <strong className="text-on-surface">2.</strong> Add the PropertyIQ
            server:
          </p>
          <CodeBlock
            code={replaceKey(SETUP_CONFIGS.cline, apiKey)}
            language="json"
          />
          {!hasKey && (
            <p>
              Replace <Code>YOUR_PIQ_API_KEY</Code> with your actual API key.
            </p>
          )}
          <p>
            <strong className="text-on-surface">3.</strong> Restart Cline after
            saving.
          </p>
        </div>
      </details>
    </div>
  );
}
