"use client";

import { useEffect } from "react";

// WebMCP (navigator.modelContext) — exposes a small set of read-only PropertyIQ
// market tools to in-browser AI agents on every page. All calls are same-origin
// (`/backend/*`, the ad-blocker-safe proxy) and anonymous-safe, so the tools work
// for any visitor without auth. We register each tool via `registerTool` (the
// primary WebMCP API) and, when a browser has no native support, install a minimal
// shim that exposes the registered tools on `navigator.modelContext.tools`, so a
// readiness checker that inspects `navigator.modelContext` on load finds them.
// Registration runs as the client module evaluates (pre-hydration) and again from
// the mount effect; both are idempotent.

interface WebMcpToolResult {
  content: Array<{ type: "text"; text: string }>;
}

interface WebMcpTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<WebMcpToolResult>;
}

interface ModelContext {
  tools?: WebMcpTool[];
  __propertyiqRegistered?: boolean;
  registerTool?: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ) => unknown;
  provideContext?: (ctx: { tools?: WebMcpTool[] }) => unknown;
}

type NavigatorWithModelContext = Navigator & { modelContext?: ModelContext };

async function fetchPropertyIqJson(path: string): Promise<unknown> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`PropertyIQ request failed (${res.status}) for ${path}`);
  }
  return res.json();
}

function asText(data: unknown): WebMcpToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

const str = (v: unknown): string => (v == null ? "" : String(v));

const PROPERTYIQ_TOOLS: WebMcpTool[] = [
  {
    name: "search_markets",
    title: "Search PropertyIQ markets",
    description:
      "Search US real-estate markets (metros, counties, ZIP codes) by name or code. Returns matching geographies with their geography_type and geography_id, which feed get_market_snapshot and get_propertyiq_score.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Place name or code, e.g. 'Austin', 'Cook County', or '90210'.",
        },
        type: {
          type: "string",
          enum: ["metro", "county", "zip", "city"],
          description: "Optional geography type filter.",
        },
        limit: {
          type: "number",
          description: "Max results (default 10, max 50).",
        },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const params = new URLSearchParams({ query: str(input.query) });
      if (input.type) params.set("type", str(input.type));
      if (input.limit) params.set("limit", str(input.limit));
      return asText(
        await fetchPropertyIqJson(`/backend/api/geography/search?${params}`),
      );
    },
  },
  {
    name: "get_market_snapshot",
    title: "Get PropertyIQ market snapshot",
    description:
      "Get the current PropertyIQ market snapshot for a geography: median home price, PropertyIQ Score, confidence, and 1-year / 3-year returns.",
    inputSchema: {
      type: "object",
      properties: {
        geography: {
          type: "string",
          enum: ["state", "metro", "county", "zip"],
        },
        geo_id: {
          type: "string",
          description:
            "Geography id (CBSA code, FIPS, or ZIP) from search_markets.",
        },
        state: {
          type: "string",
          description:
            "Optional two-letter state filter for county/zip lookups.",
        },
      },
      required: ["geography", "geo_id"],
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const path = `/backend/api/market-snapshot/${encodeURIComponent(
        str(input.geography),
      )}/${encodeURIComponent(str(input.geo_id))}`;
      const qs = input.state
        ? `?state=${encodeURIComponent(str(input.state))}`
        : "";
      return asText(await fetchPropertyIqJson(path + qs));
    },
  },
  {
    name: "get_propertyiq_score",
    title: "Get PropertyIQ Score",
    description:
      "Get the PropertyIQ Score for a geography (a demand/momentum signal where 50 = the market's state average; higher = outperformance relative to its state), plus its confidence letter and recent trend.",
    inputSchema: {
      type: "object",
      properties: {
        geography: { type: "string", enum: ["metro", "county", "zip"] },
        location_id: {
          type: "string",
          description: "Geography id (CBSA, FIPS, or ZIP) from search_markets.",
        },
        historyMonths: {
          type: "number",
          description: "Months of trend history to include, 0-6 (default 3).",
        },
      },
      required: ["geography", "location_id"],
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const path = `/backend/api/scores/${encodeURIComponent(
        str(input.geography),
      )}/${encodeURIComponent(str(input.location_id))}`;
      const qs =
        input.historyMonths != null
          ? `?historyMonths=${encodeURIComponent(str(input.historyMonths))}`
          : "";
      return asText(await fetchPropertyIqJson(path + qs));
    },
  },
];

function registerPropertyIqWebMcpTools(): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as NavigatorWithModelContext;

  // Reuse an existing modelContext (a native browser agent or an injected polyfill)
  // and never clobber it. Otherwise install a minimal WebMCP shim that exposes the
  // registered tools publicly on `.tools` so a readiness scanner can enumerate them.
  let mc = nav.modelContext;
  if (!mc) {
    const tools: WebMcpTool[] = [];
    const shim: ModelContext = {
      tools,
      registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }) {
        tools.push(tool);
        // Honor AbortController: drop the tool if its registration is aborted.
        options?.signal?.addEventListener("abort", () => {
          const index = tools.indexOf(tool);
          if (index >= 0) tools.splice(index, 1);
        });
        return Promise.resolve();
      },
      provideContext({ tools: incoming = [] }: { tools?: WebMcpTool[] } = {}) {
        for (const tool of incoming) shim.registerTool!(tool);
      },
    };
    nav.modelContext = shim;
    mc = shim;
  }

  // Idempotent across StrictMode double-invokes and the early + effect calls.
  if (mc.__propertyiqRegistered) return;
  mc.__propertyiqRegistered = true;

  // registerTool is the primary WebMCP API the readiness check looks for. Register
  // each tool individually so detectors that wrap registerTool observe every call.
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : undefined;
  for (const tool of PROPERTYIQ_TOOLS) {
    mc.registerTool?.(
      tool,
      controller ? { signal: controller.signal } : undefined,
    );
  }
}

// Register as soon as the client module evaluates — before React hydration — so a
// readiness scanner that snapshots `navigator.modelContext` on load sees the tools
// even when hydration is slow. Idempotent with the mount effect below.
if (typeof window !== "undefined") {
  registerPropertyIqWebMcpTools();
}

/**
 * Mounts once in the root layout. Ensures PropertyIQ's read-only market tools are
 * registered on `navigator.modelContext` (an idempotent fallback to the module-level
 * registration above). Renders nothing.
 */
export default function WebMcpProvider(): null {
  useEffect(() => {
    registerPropertyIqWebMcpTools();
  }, []);
  return null;
}
