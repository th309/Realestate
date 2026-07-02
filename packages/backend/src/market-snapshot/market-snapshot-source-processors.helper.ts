import {
  CENSUS_COLUMN_MAP,
  ECONOMIC_COLUMN_MAP,
  CALC_COLUMN_MAP,
  PERMITS_COLUMN_MAP,
} from './market-snapshot.types';
import {
  SnapshotAccumulator,
  ToMetric,
  SourceFetch,
  DataOnlyFetch,
} from './market-snapshot-assembler.helper';

// ============================================================================
// Snapshot Assembler (secondary sources)
//
// Pure transforms for census / economic / calculated / permits. Split from
// market-snapshot-assembler.helper.ts to keep both files within the line
// limit; shares the accumulator + ToMetric contract from that module.
// ============================================================================

export function processCensus(
  acc: SnapshotAccumulator,
  result: PromiseSettledResult<SourceFetch | null>,
  toMetric: ToMetric,
): void {
  if (result.status !== 'fulfilled' || !result.value) return;
  const { data, name } = result.value;
  if (name && acc.geographyName === acc.defaultName) acc.geographyName = name;
  const year = data.year ? `${data.year}-01-01` : null;
  for (const [col, metricId] of Object.entries(CENSUS_COLUMN_MAP)) {
    const raw = data[col];
    if (raw != null && Number(raw) !== -666666666) {
      acc.metrics[metricId] = toMetric(Number(raw), year, 'census');
    }
  }
}

export function processEconomic(
  acc: SnapshotAccumulator,
  result: PromiseSettledResult<SourceFetch | null>,
  toMetric: ToMetric,
): void {
  if (result.status !== 'fulfilled' || !result.value) return;
  const { data, name } = result.value;
  if (name && acc.geographyName === acc.defaultName) acc.geographyName = name;
  for (const [col, metricId] of Object.entries(ECONOMIC_COLUMN_MAP)) {
    const raw = data[col];
    if (raw != null) {
      acc.metrics[metricId] = toMetric(
        Number(raw),
        data.period_date ?? null,
        'economic',
      );
    }
  }
}

export function processCalculated(
  acc: SnapshotAccumulator,
  result: PromiseSettledResult<DataOnlyFetch | null>,
  toMetric: ToMetric,
): void {
  if (result.status !== 'fulfilled' || !result.value) return;
  const { data } = result.value;
  // Calculated metrics stored as fractions that need *100 for display
  const CALC_PERCENT_COLS = new Set(['rent_to_price_ratio']);
  for (const [col, metricId] of Object.entries(CALC_COLUMN_MAP)) {
    const raw = data[col];
    if (raw != null) {
      const value = CALC_PERCENT_COLS.has(col)
        ? Number(raw) * 100
        : Number(raw);
      acc.metrics[metricId] = toMetric(
        value,
        data.period_date ?? null,
        'calculated',
      );
    }
  }
  // Also set years_to_save from calculated_metrics if Zillow didn't provide it
  if (data.years_to_save != null && !acc.metrics['years_to_save']) {
    acc.metrics['years_to_save'] = toMetric(
      Number(data.years_to_save),
      data.period_date ?? null,
      'calculated',
    );
  }
}

export function processPermits(
  acc: SnapshotAccumulator,
  result: PromiseSettledResult<DataOnlyFetch | null>,
  toMetric: ToMetric,
): void {
  if (result.status !== 'fulfilled' || !result.value) return;
  const { data } = result.value;
  for (const [col, metricId] of Object.entries(PERMITS_COLUMN_MAP)) {
    const raw = data[col];
    if (raw != null) {
      acc.metrics[metricId] = toMetric(
        Number(raw),
        data.period_date ?? null,
        'permits',
      );
    }
  }
  // Derived: sf_mf_ratio and permit_value_per_unit
  const sf = Number(data.sf_units) || 0;
  const total = Number(data.total_units) || 0;
  if (total > 0) {
    acc.metrics['sf_mf_ratio'] = toMetric(
      (sf / total) * 100,
      data.period_date ?? null,
      'permits',
    );
  }
  const totalValue = Number(data.total_value) || 0;
  if (total > 0 && totalValue > 0) {
    acc.metrics['permit_value_per_unit'] = toMetric(
      totalValue / total,
      data.period_date ?? null,
      'permits',
    );
  }
}
