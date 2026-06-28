"use client";

import { useEffect } from "react";

// WebMCP (navigator.modelContext) — exposes a small set of read-only PropertyIQ
// market tools to in-browser AI agents on every page. All calls are same-origin
// (`/backend/*`, the ad-blocker-safe proxy) and anonymous-safe, so the tools work
// for any visitor without auth. We register declaratively via `provideContext`
// (the primary WebMCP API) and shim it when a browser has no native support, so a
// readiness checker that inspects `navigator.modelContext` after load finds the tools.

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
  _tools?: WebMcpTool[];
  __propertyiqRegistered?: boolean;
  registerTool?: (tool: WebMcpTool) => unknown;
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
  const mc: ModelContext = (nav.modelContext = nav.modelContext ?? {});

  // Idempotent: React StrictMode / re-mounts must not double-register.
  if (mc.__propertyiqRegistered) return;
  mc.__propertyiqRegistered = true;
  mc._tools = mc._tools ?? [];

  // Shim the API surface so detection works even without native WebMCP support.
  if (typeof mc.registerTool !== "function") {
    mc.registerTool = (tool: WebMcpTool) => {
      mc._tools!.push(tool);
      return Promise.resolve();
    };
  }
  if (typeof mc.provideContext !== "function") {
    mc.provideContext = ({ tools = [] }: { tools?: WebMcpTool[] } = {}) => {
      for (const tool of tools) mc.registerTool!(tool);
    };
  }

  // provideContext is the primary (declarative) WebMCP API the readiness check looks
  // for; native implementations treat it as the full tool set, so we don't also call
  // registerTool when it exists (that would double-register).
  mc.provideContext({ tools: PROPERTYIQ_TOOLS });
}

/**
 * Mounts once in the root layout. Registers PropertyIQ's read-only market tools on
 * `navigator.modelContext` on load. Renders nothing.
 */
export default function WebMcpProvider(): null {
  useEffect(() => {
    registerPropertyIqWebMcpTools();
  }, []);
  return null;
}
