import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Build the canonical region_id -> cbsa_code map from zillow_metro_crosswalk,
 * enforcing one canonical region per CBSA (mirrors migration
 * 20260613140100_fix_zillow_metro_cbsa_from_crosswalk.sql).
 * Canonical owner = region whose full name matches the CBSA title
 * (cbsa_title starts with zillow_region_name), ties broken by lowest
 * zillow_region_id. Non-canonical regions are absent so their cbsa_code stays NULL.
 */
export async function buildCanonicalMetroCbsaMap(
  supabase: SupabaseClient,
): Promise<Map<number, string>> {
  const rows: Array<{
    zillow_region_id: number;
    zillow_region_name: string | null;
    cbsa_code: string | null;
    cbsa_title: string | null;
  }> = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("zillow_metro_crosswalk")
      .select("zillow_region_id, zillow_region_name, cbsa_code, cbsa_title")
      .not("cbsa_code", "is", null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw new Error(`crosswalk load failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  const titleMatchRank = (r: (typeof rows)[number]): number => {
    const name = (r.zillow_region_name ?? "").trim().toLowerCase();
    const title = (r.cbsa_title ?? "").toLowerCase();
    return name && title.startsWith(name) ? 0 : 1;
  };

  const bestByCbsa = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!r.cbsa_code) continue;
    const incumbent = bestByCbsa.get(r.cbsa_code);
    if (!incumbent) {
      bestByCbsa.set(r.cbsa_code, r);
      continue;
    }
    const a = titleMatchRank(r);
    const b = titleMatchRank(incumbent);
    if (a < b || (a === b && r.zillow_region_id < incumbent.zillow_region_id)) {
      bestByCbsa.set(r.cbsa_code, r);
    }
  }

  const map = new Map<number, string>();
  for (const [cbsa, owner] of bestByCbsa) map.set(owner.zillow_region_id, cbsa);
  return map;
}
