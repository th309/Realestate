/**
 * USAGE-COVERAGE FETCHER
 *
 * Reads the user's feature-coverage signal — which features they've used plus
 * whether they've connected MCP — from GET /api/usage/coverage. Powers the
 * dashboard return-surface, checklist auto-completion, and the email drip via
 * `lib/coverage/deriveCoverage`.
 */

import { fetchAPIRaw } from "./base";

export interface UsageCoverage {
  usedFeatures: string[];
  mcpConnected: boolean;
}

/**
 * Coverage is a soft signal — on any non-OK response we return an empty
 * coverage set rather than throwing, so a transient 401/500 never breaks the
 * dashboard render.
 */
export async function fetchUsageCoverage(): Promise<UsageCoverage> {
  const res = await fetchAPIRaw("/api/usage/coverage");
  if (!res.ok) return { usedFeatures: [], mcpConnected: false };
  const json = (await res.json()) as { data?: UsageCoverage };
  return json.data ?? { usedFeatures: [], mcpConnected: false };
}
