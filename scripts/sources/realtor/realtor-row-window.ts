/**
 * Build a per-row predicate that keeps rows whose `monthField` (a YYYYMM string)
 * is on/after `isoCutoff`. Applied DURING the streaming parse of the multi-year
 * Realtor _History files so the full history never materializes (the Zip
 * core-History is ~770MB / ~3M rows and OOMs if parsed whole). An `undefined`
 * cutoff keeps everything (a `--full` backfill). YYYYMM strings sort lexically.
 */
export function monthCutoffFilter(
  monthField: string,
  isoCutoff: string | undefined,
): (row: Record<string, string>) => boolean {
  if (!isoCutoff) return () => true;
  const cutoffYm = isoCutoff.slice(0, 7).replace("-", ""); // 2026-03-15 -> 202603
  if (cutoffYm.length !== 6) return () => true;
  return (row) => {
    const ym = row[monthField];
    return typeof ym === "string" && ym.length === 6 && ym >= cutoffYm;
  };
}
