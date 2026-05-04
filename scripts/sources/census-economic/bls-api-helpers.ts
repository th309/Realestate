/**
 * Pure helpers for the BLS API client.
 *
 * Kept in a sibling file so `bls-api-client.ts` stays under the 300-line
 * logic-file limit (CLAUDE.md §1.3). No HTTP, no IO — just data shaping.
 */

export const BLS_MAX_YEAR_SPAN = 20;

export function buildYearRanges(
  startYear: number,
  endYear: number,
  maxSpan: number = BLS_MAX_YEAR_SPAN,
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (let y = startYear; y <= endYear; y += maxSpan) {
    ranges.push({
      start: y,
      end: Math.min(y + maxSpan - 1, endYear),
    });
  }
  return ranges;
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
