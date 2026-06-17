/**
 * FEATURE-COVERAGE SIGNAL (pure)
 *
 * Answers one question — "what has this user done / not done?" — the single
 * signal that powers the dashboard return-surface (NextBestActionCard), the
 * checklist auto-completion, and the email drip's skip-used logic.
 *
 * Pure + unit-tested: no network, no React. All I/O lives in the thin
 * `useFeatureCoverage` hook that wraps this.
 */

import type { Persona } from "@/lib/data";

export type Feature =
  | "score"
  | "mcp"
  | "analyzer"
  | "screener"
  | "compare"
  | "watchlist"
  | "graphs"
  | "report";

export const FEATURES: Feature[] = [
  "score",
  "mcp",
  "analyzer",
  "screener",
  "compare",
  "watchlist",
  "graphs",
  "report",
];

/**
 * Maps a feature to the `event_action` (in `user_events`) that proves direct
 * use. `score`/`compare`/`report` have richer proof paths handled in `isUsed`.
 */
const EVENT_OF: Partial<Record<Feature, string>> = {
  analyzer: "analyzer_grade",
  screener: "screener_filter",
  graphs: "graphs_view",
  watchlist: "watchlist_add",
  compare: "compare",
  report: "report",
  mcp: "mcp_connected",
};

export interface CoverageInput {
  persona: Persona | null;
  /** event_actions returned by GET /api/usage/coverage */
  usedFeatures: string[];
  mcpConnected: boolean;
  /** onboarding_checklist task ids */
  checklist: string[];
  usageStats: {
    markets_viewed: number;
    scores_checked: number;
    reports_generated: number;
  } | null;
}

export interface Coverage {
  byFeature: Record<Feature, { used: boolean }>;
  recommendedNext: Feature | null;
}

/**
 * Per-persona ordering of which unused feature to surface first. MCP leads for
 * everyone (the only-on-PropertyIQ differentiator); the rest is weighted by
 * what each persona values most.
 */
const PRIORITY: Record<Persona | "default", Feature[]> = {
  investor: [
    "mcp",
    "analyzer",
    "screener",
    "compare",
    "watchlist",
    "graphs",
    "report",
  ],
  agent: [
    "mcp",
    "compare",
    "report",
    "screener",
    "watchlist",
    "analyzer",
    "graphs",
  ],
  homebuyer: [
    "mcp",
    "analyzer",
    "compare",
    "watchlist",
    "screener",
    "graphs",
    "report",
  ],
  default: [
    "mcp",
    "analyzer",
    "screener",
    "compare",
    "watchlist",
    "graphs",
    "report",
  ],
};

/** Narrow a raw `user_type` string to a known persona, else null. */
export function normalizePersona(
  value: string | null | undefined,
): Persona | null {
  return value === "homebuyer" || value === "investor" || value === "agent"
    ? value
    : null;
}

export function deriveCoverage(input: CoverageInput): Coverage {
  const used = new Set(input.usedFeatures);
  const stats = input.usageStats ?? {
    markets_viewed: 0,
    scores_checked: 0,
    reports_generated: 0,
  };

  const isUsed = (feature: Feature): boolean => {
    if (feature === "score")
      return (
        (stats.scores_checked ?? 0) > 0 ||
        input.checklist.includes("view_score")
      );
    if (feature === "mcp")
      return input.mcpConnected || used.has("mcp_connected");
    if (feature === "compare")
      return (
        input.checklist.includes("compare_markets") ||
        (stats.markets_viewed ?? 0) >= 2 ||
        used.has("compare")
      );
    if (feature === "report")
      return (
        (stats.reports_generated ?? 0) > 0 ||
        input.checklist.includes("generate_report") ||
        input.checklist.includes("read_report") ||
        used.has("report")
      );
    const event = EVENT_OF[feature];
    return event ? used.has(event) : false;
  };

  const byFeature = FEATURES.reduce(
    (acc, feature) => ((acc[feature] = { used: isUsed(feature) }), acc),
    {} as Coverage["byFeature"],
  );
  const order = PRIORITY[input.persona ?? "default"] ?? PRIORITY.default;
  const recommendedNext =
    order.find((feature) => !byFeature[feature].used) ?? null;
  return { byFeature, recommendedNext };
}
