import { useQuery } from "@tanstack/react-query";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export type ScopeType =
  | "metros_in_state"
  | "zips_in_state"
  | "zips_in_metro"
  | "custom";

export interface ScopeSpec {
  type: ScopeType;
  state?: string;
  cbsaCode?: string;
  codes?: string[];
}

export interface ResolvedMarket {
  id: string;
  geography: "metro" | "zip";
  canonical_name: string;
  population: number | null;
  score: number | null;
}

export interface ResolveScopeResult {
  markets: ResolvedMarket[];
  truncated: boolean;
  unrecognized?: string[];
}

export async function resolveScope(
  spec: ScopeSpec,
): Promise<ResolveScopeResult> {
  const res = await fetchAPIRaw("/api/admin/content-pipeline/scope/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`resolveScope failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { data: ResolveScopeResult };
  return json.data;
}

function isComplete(spec: ScopeSpec): boolean {
  if (spec.type === "metros_in_state" || spec.type === "zips_in_state")
    return !!spec.state;
  if (spec.type === "zips_in_metro") return !!spec.cbsaCode;
  if (spec.type === "custom") return (spec.codes?.length ?? 0) > 0;
  return false;
}

export function useResolvedScope(spec: ScopeSpec | null) {
  return useQuery({
    queryKey: ["scope-resolve", spec ? JSON.stringify(spec) : "none"],
    queryFn: () => resolveScope(spec!),
    enabled: !!spec && isComplete(spec),
    staleTime: 30 * 60 * 1000,
  });
}
