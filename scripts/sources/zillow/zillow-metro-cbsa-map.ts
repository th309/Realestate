import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Build the canonical region_id -> cbsa_code map from zillow_metro_crosswalk,
 * enforcing one canonical region per CBSA. This supersedes migration
 * 20260613140100_fix_zillow_metro_cbsa_from_crosswalk.sql's prefix-ILIKE rule,
 * which (along with a naive lowest-id tiebreak) mis-assigns CBSA 10860
 * (Aransas Pass-Rockport, TX) to "Alice, TX".
 * Canonical owner = the region whose city name appears in the cbsa_title; ties
 * broken by lowest zillow_region_id. Validated against all 15 real multi-region
 * CBSAs (15/15 correct). Non-canonical regions are absent so their cbsa_code
 * stays NULL.
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
    const city = (r.zillow_region_name ?? "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const title = (r.cbsa_title ?? "").toLowerCase();
    return city && title.includes(city) ? 0 : 1; // 0 = region's city named in the CBSA title
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
