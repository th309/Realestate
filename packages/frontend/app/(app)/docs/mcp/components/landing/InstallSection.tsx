"use client";

import { useState, useCallback } from "react";
import { CodeBlock } from "../../../api/components/CodeBlock";
import { SETUP_CONFIGS, MCP_SERVER_URL } from "../mcp-docs-data";
import { Code, Tip } from "../setup-helpers";
import { GenerateApiKeyStep } from "../GenerateApiKeyStep";
import { INSTALL_CLIENTS } from "./install-recipes";

const API_KEY_PLACEHOLDER = "YOUR_PIQ_API_KEY";

function withKey(config: string, apiKey: string | null): string {
  if (!apiKey) return config;
  return config.replaceAll(API_KEY_PLACEHOLDER, apiKey);
}

export function InstallSection() {
  const [selectedId, setSelectedId] = useState(INSTALL_CLIENTS[0].id);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const handleKeyGenerated = useCallback((key: string) => setApiKey(key), []);

  const recipe =
    INSTALL_CLIENTS.find((c) => c.id === selectedId) ?? INSTALL_CLIENTS[0];
  const rawConfig = recipe.configOverride ?? SETUP_CONFIGS[recipe.id];
  const config =
    recipe.authType === "apiKey" ? withKey(rawConfig, apiKey) : rawConfig;

  return (
    <section id="install" className="max-w-3xl mx-auto px-6 py-14 scroll-mt-6">
      <span className="text-xs font-mono font-medium uppercase tracking-wide text-primary">
        Set up once
      </span>
      <h2 className="mt-2 text-2xl font-semibold text-on-surface">
        Add PropertyIQ to your AI client in a couple of minutes
      </h2>

      <div className="mt-6 flex flex-wrap gap-2">
        {INSTALL_CLIENTS.map((client) => (
          <button
            key={client.id}
            type="button"
            onClick={() => setSelectedId(client.id)}
            aria-pressed={client.id === selectedId}
            className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors duration-200 ${
              client.id === selectedId
                ? "bg-primary text-on-primary border-primary"
                : "bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
            }`}
          >
            {client.label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-outline-variant/50 p-5">
        <ol className="space-y-3">
          {recipe.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-medium shrink-0">
                {i + 1}
              </span>
              <span className="text-on-surface pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        {recipe.authType === "apiKey" && (
          <div className="mt-4">
            <GenerateApiKeyStep onKeyGenerated={handleKeyGenerated} />
          </div>
        )}

        <div className="mt-4">
          <CodeBlock code={config} language={recipe.language} />
        </div>

        {recipe.authType === "apiKey" && !apiKey && (
          <p className="mt-3 text-xs text-on-surface-variant">
            Replace <Code>YOUR_PIQ_API_KEY</Code> with your key (starts with{" "}
            <Code>piq_live_</Code>), or generate one above and it fills in
            automatically.
          </p>
        )}

        {recipe.tip && <Tip>{recipe.tip}</Tip>}
      </div>

      <p className="mt-6 text-sm text-on-surface-variant">
        Using a different client? PropertyIQ uses{" "}
        <strong className="text-on-surface font-medium">
          Streamable HTTP transport
        </strong>
        . Any MCP-compatible client can connect at <Code>{MCP_SERVER_URL}</Code>{" "}
        with a Bearer token.
      </p>
    </section>
  );
}
