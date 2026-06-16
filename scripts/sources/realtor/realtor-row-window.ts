/**
 * Window CSV rows (core or hotness) to those on/after `isoCutoff` BEFORE the
 * merge. The Realtor _History files are full multi-year history (Zip core ~770MB,
 * Zip hotness ~340MB); an incremental run only needs rows back to the cutoff, and
 * holding the entire history in memory OOMs (exit 134 / JS heap). This does NOT
 * touch the years of history already in the DB — it only bounds what the live
 * merge holds. Callers pass `undefined` for a `--full` backfill (load it all).
 * `monthField` values are YYYYMM strings, which sort lexically.
 */
export function windowRowsByCutoff(
  rows: Record<string, string>[],
  monthField: string,
  isoCutoff: string | undefined,
): Record<string, string>[] {
  if (!isoCutoff) return rows; // full backfill — keep the entire history
  const cutoffYm = isoCutoff.slice(0, 7).replace("-", ""); // 2026-03-15 -> 202603
  if (cutoffYm.length !== 6) return rows;
  return rows.filter((r) => {
    const ym = r[monthField];
    return !ym || ym >= cutoffYm;
  });
}
