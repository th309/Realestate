export interface MetricRow {
  regionId: string;
  date: string;
  value: number | null;
}

/** Normalize any ISO date to the first-of-month key 'YYYY-MM-01'. */
function monthKey(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/**
 * Pivot long-format rows into arrays aligned to one shared monthly axis.
 * The axis spans the last `months` calendar months, ending at either the latest month present
 * in the data (default) or at an explicitly provided `anchorDate`'s month (if provided).
 * The frontend timeline scrubber can index every region's array by integer month position.
 */
export function alignSeriesToAxis(
  rows: MetricRow[],
  months: number,
  anchorDate?: string,
): { dates: string[]; series: Record<string, (number | null)[]> } {
  if (!rows.length) return { dates: [], series: {} };

  const allMonths = [...new Set(rows.map((r) => monthKey(r.date)))].sort();
  const latestMonth = anchorDate
    ? monthKey(anchorDate)
    : allMonths[allMonths.length - 1];
  const [year, month] = latestMonth.split('-').map(Number);

  const dates: string[] = [];
  let currentMonth = month;
  let currentYear = year;

  for (let i = 0; i < months; i++) {
    dates.unshift(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`);
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
  }

  const idx = new Map(dates.map((d, i) => [d, i]));

  const series: Record<string, (number | null)[]> = {};
  for (const row of rows) {
    const i = idx.get(monthKey(row.date));
    if (i === undefined) continue; // outside the window
    if (!series[row.regionId])
      series[row.regionId] = new Array(dates.length).fill(null);
    series[row.regionId][i] = row.value;
  }
  return { dates, series };
}
