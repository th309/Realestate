import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";

export interface ScriptArchetype {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  format_affinity: string[];
  prompt_template: string;
  example_video_ids: string[];
  median_view_count: number | null;
  member_count: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RefreshRun {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  videos_discovered: number;
  transcripts_fetched: number;
  clusters_built: number;
  archetypes_promoted: number;
  total_cost_usd: number;
  error_message: string | null;
}

export async function fetchArchetypes(
  format?: string,
): Promise<ScriptArchetype[]> {
  const url =
    "/api/admin/content-pipeline/archetypes" +
    (format ? `?format=${encodeURIComponent(format)}` : "");
  const res = await fetchAPI<{ data: { archetypes: ScriptArchetype[] } }>(url);
  return res.data.archetypes;
}

export async function fetchRefreshRuns(): Promise<RefreshRun[]> {
  const res = await fetchAPI<{ data: { runs: RefreshRun[] } }>(
    "/api/admin/content-pipeline/archetypes/refresh-runs",
  );
  return res.data.runs;
}

export async function updateArchetype(
  slug: string,
  patch: { display_name?: string; description?: string; enabled?: boolean },
) {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/archetypes/${encodeURIComponent(slug)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`updateArchetype failed: ${res.status} ${t}`);
  }
  return res.json();
}

export async function triggerArchetypeRefresh() {
  const res = await fetchAPIRaw(
    "/api/admin/content-pipeline/archetypes/refresh",
    { method: "POST" },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`refresh failed: ${res.status} ${t}`);
  }
  return res.json();
}
