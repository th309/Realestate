/**
 * Quinn structured-data types (mirrors backend analytics-chat StructuredData).
 * Used to render tables, charts, and cards in the Quinn panel.
 */

export interface QuinnRankingsData {
  title?: string;
  direction: 'top' | 'bottom';
  items: Array<{
    rank: number;
    name: string;
    score?: number;
    appreciation?: number;
    state?: string;
  }>;
}

export interface QuinnComparisonConfig {
  title?: string;
  filteredLabel: string;
  benchmarkLabel: string;
  metrics: Array<{
    label: string;
    filtered: number | null;
    benchmark: number | null;
    unit?: 'score' | 'percent' | 'number';
    higherIsBetter?: boolean;
  }>;
}

export interface QuinnTableConfig {
  title?: string;
  columns: Array<{ key: string; label: string; type?: 'text' | 'number' | 'score' | 'percent' | 'rank' }>;
  rows: Array<Record<string, string | number | null>>;
  maxRows?: number;
  highlightTop?: number;
  highlightBottom?: number;
}

export interface QuinnChartConfig {
  type: 'bar' | 'line' | 'scatter' | 'distribution';
  title?: string;
  xLabel?: string;
  yLabel?: string;
  data: Array<{ name: string; value: number; label?: string }>;
  colorScale?: 'score' | 'appreciation' | 'neutral';
  referenceLine?: number;
  referenceLabel?: string;
}

export interface QuinnStructuredData {
  rankings?: QuinnRankingsData;
  comparison?: QuinnComparisonConfig;
  table?: QuinnTableConfig;
  chart?: QuinnChartConfig;
  errorMessage?: string;
}
