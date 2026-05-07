/**
 * Analytics Chat Structured Data
 *
 * Pure functions for extracting structured data from tool results and
 * formatting responses. No class, no `this`.
 */

import { Logger } from '@nestjs/common';
import { StructuredData, ComparisonConfig } from './analytics-chat.types';

const logger = new Logger('AnalyticsChatStructuredData');

/** Parse "tell me about [geo]" / "market in [geo]" for single-geography focus. */
export function parseSingleGeographyFocus(userMessage: string): string | null {
  const m = userMessage.trim();
  const patterns = [
    /\btell\s+me\s+(?:everything\s+)?about\s+(?:the\s+)?(?:market\s+in\s+)?([^,.?!]+?)(?:\s+market|\s+metro|\s+county|$|\.|\?|,)/i,
    /(?:market|metro|area)\s+in\s+([^,.?!]+?)(?:\s+market|\s+metro|$|\.|\?|,)/i,
    /\b(?:analyze|profile|report\s+on)\s+(?:the\s+)?([^,.?!]+?)(?:\s+market|$|\.|\?|,)/i,
  ];
  for (const pattern of patterns) {
    const match = m.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

/** Parse "compare A and B" / "A vs B" from user message. Returns [nameA, nameB] or null. */
export function parseCompareTwoGeographies(userMessage: string): [string, string] | null {
  const m = userMessage.trim();
  const zipMatch = m.match(/\bcompare\s+(?:zip\s*codes?|zips?)\s+(\d{5})\s+and\s+(\d{5})/i)
    || m.match(/\bcompare\s+.+?\s+(\d{5})\s+and\s+(\d{5})/i);
  if (zipMatch) return [zipMatch[1], zipMatch[2]];

  const comparePatterns: Array<{ re: RegExp; minLen?: number }> = [
    { re: /\bcompare\s+(.+?)\s+and\s+(.+?)(?:\s+as|\s+using|$|,|\.)/i },
    { re: /(.+?)\s+vs\.?\s+(.+?)(?:\s+as|\s+using|$|,|\.)/i, minLen: 2 },
    { re: /(.+?)\s+and\s+(.+?)\s+as\s+(?:investment|homebuyer|market)/i },
  ];
  for (const { re, minLen } of comparePatterns) {
    const match = m.match(re);
    if (!match) continue;
    const a = match[1].trim().replace(/\s+as\s+.*$/i, '').trim();
    const b = match[2].trim().replace(/\s+as\s+.*$/i, '').trim();
    if (a && b && (!minLen || (a.length >= minLen && b.length >= minLen))) return [a, b];
  }
  return null;
}

/** Normalize appreciation values (some sources return 500% instead of 5.0). */
function normalizeAppreciation(value: number | null | undefined): number | undefined {
  if (value == null) return undefined;
  return Math.abs(value) > 100 ? value / 100 : value;
}

/** Filter ranking items to only the geographies the user asked about. */
function filterRankingItems(
  items: any[], compareNames: [string, string] | null, singleGeoFocus: string | null,
): any[] {
  if (compareNames) {
    const [na, nb] = compareNames.map((s) => s.toLowerCase().trim());
    const filtered = items.filter((it) => {
      const name = (it.name || '').toLowerCase();
      const id = (it.id ?? '').toString().toLowerCase();
      return name.includes(na) || id.includes(na) || name.includes(nb) || id.includes(nb);
    });
    if (filtered.length > 0) logger.log(`[Quinn Extract] Filtered to ${filtered.length} items for comparison`);
    return filtered;
  }
  if (singleGeoFocus) {
    const focus = singleGeoFocus.toLowerCase();
    const filtered = items.filter((it: { name: string }) => (it.name || '').toLowerCase().includes(focus));
    if (filtered.length > 0) logger.log(`[Quinn Extract] Filtered to ${filtered.length} item(s) for "${singleGeoFocus}"`);
    return filtered;
  }
  return items;
}

/** Determine the rankings card title based on user query context. */
function getRankingsTitle(
  compareNames: [string, string] | null, singleGeoFocus: string | null, direction: string,
): string {
  if (compareNames) return 'Comparison';
  if (singleGeoFocus) return `${singleGeoFocus} — Performance`;
  return direction === 'bottom' ? 'Bottom Performers' : 'Top Performers';
}

/** Extract structured data from tool results for visual rendering. */
export function extractStructuredData(
  toolResults: Array<{ toolName: string; data: any }>,
  userMessage?: string,
): StructuredData | undefined {
  if (toolResults.length === 0) return undefined;

  const structured: StructuredData = {};
  const compareNames = userMessage ? parseCompareTwoGeographies(userMessage) : null;
  const singleGeoFocus = userMessage && !compareNames ? parseSingleGeographyFocus(userMessage) : null;

  for (const { toolName, data } of toolResults) {
    if (!data) continue;
    const actualData = data.data || data;
    if (!actualData) continue;

    if (toolName === 'get_rankings') {
      extractRankings(structured, data, actualData, compareNames, singleGeoFocus);
    } else if (toolName === 'compare_to_benchmark' && actualData.comparison) {
      extractBenchmarkComparison(structured, actualData.comparison);
    } else if (toolName === 'analyze_data' && actualData.top_performers) {
      extractAnalysisResults(structured, actualData);
    }
  }

  return Object.keys(structured).length > 0 ? structured : undefined;
}

function extractRankings(
  structured: StructuredData, data: any, actualData: any,
  compareNames: [string, string] | null, singleGeoFocus: string | null,
): void {
  if (data?.success === false && data?.error) {
    structured.errorMessage = data.error;
  } else if (actualData?.error && !actualData.rankings?.length) {
    structured.errorMessage = actualData.error;
  }
  if (!actualData?.rankings?.length) return;

  let items = actualData.rankings.map((item: any) => ({
    rank: item.rank,
    name: item.geography_name || item.geography_id,
    id: item.geography_id,
    score: item.score,
    appreciation: normalizeAppreciation(item.appreciation_12m),
    state: item.state,
  }));
  items = filterRankingItems(items, compareNames, singleGeoFocus);

  structured.rankings = {
    title: getRankingsTitle(compareNames, singleGeoFocus, actualData.direction),
    direction: actualData.direction || 'top',
    items,
  };
}

function extractBenchmarkComparison(structured: StructuredData, comp: any): void {
  const metrics: ComparisonConfig['metrics'] = [];
  if (comp.score) {
    metrics.push({ label: 'Average Score', filtered: comp.score.filtered_mean, benchmark: comp.score.benchmark_mean, unit: 'score', higherIsBetter: true });
  }
  if (comp.appreciation_12m) {
    metrics.push({ label: '1-Year Appreciation', filtered: comp.appreciation_12m.filtered_mean_pct, benchmark: comp.appreciation_12m.benchmark_mean_pct, unit: 'percent', higherIsBetter: true });
  }
  if (comp.appreciation_36m) {
    metrics.push({ label: '3-Year Appreciation', filtered: comp.appreciation_36m.filtered_mean_pct, benchmark: comp.appreciation_36m.benchmark_mean_pct, unit: 'percent', higherIsBetter: true });
  }
  structured.comparison = {
    title: 'Benchmark Comparison',
    filteredLabel: 'Selected Markets',
    benchmarkLabel: comp.benchmark_name || 'National',
    metrics,
  };
}

function extractAnalysisResults(structured: StructuredData, actualData: any): void {
  structured.table = {
    title: 'Top Performers',
    columns: [
      { key: 'rank', label: '#', type: 'rank' },
      { key: 'name', label: 'Market', type: 'text' },
      { key: 'score', label: 'Score', type: 'score' },
      { key: 'appreciation', label: '12M Return', type: 'percent' },
    ],
    rows: actualData.top_performers.slice(0, 10).map((p: any, i: number) => ({
      rank: i + 1,
      name: p.geography_name || p.geography_id,
      score: p.score,
      appreciation: p.appreciation_12m,
    })),
    highlightTop: 3,
  };

  if (actualData.chart_data?.distribution) {
    const dist = actualData.chart_data.distribution;
    structured.chart = {
      type: 'distribution',
      title: 'Score Distribution',
      xLabel: 'Score',
      yLabel: 'Count',
      data: dist.bins.slice(0, -1).map((bin: number, i: number) => ({
        name: `${bin.toFixed(0)}-${dist.bins[i + 1].toFixed(0)}`,
        value: dist.counts[i],
        label: `${bin.toFixed(0)}-${dist.bins[i + 1].toFixed(0)}: ${dist.counts[i]} markets`,
      })),
      colorScale: 'score',
    };
  }
}

/**
 * Format rankings for inclusion in the response text (intro + list).
 */
export function formatRankingsForResponse(rankings: StructuredData['rankings']): string {
  if (!rankings?.items?.length) return '';
  const label = rankings.direction === 'bottom' ? 'Bottom' : 'Top';
  const top = rankings.items.slice(0, 10);
  const lines = top.map(
    (i) => `${i.rank}. ${i.name}${i.score != null ? ` (${i.score})` : ''}${i.state ? `, ${i.state}` : ''}`,
  );
  return `${label} markets:\n${lines.join('\n')}`;
}

/**
 * Build a short fallback text from structured data when the model returned no text.
 * Ensures the user always receives an answer when tools succeeded.
 */
export function buildFallbackResponseFromStructuredData(structured: StructuredData): string {
  const parts: string[] = [];
  if (structured.errorMessage) {
    parts.push(`Unable to retrieve rankings: ${structured.errorMessage}`);
  }
  if (structured.rankings?.items?.length) {
    const label = structured.rankings.direction === 'bottom' ? 'bottom' : 'top';
    parts.push(`Here are the ${label} markets.`);
  }
  if (structured.comparison) {
    parts.push('Comparison to benchmark is available in the data.');
  }
  if (structured.table) {
    parts.push('Analysis results are available in the data.');
  }
  return parts.length > 0 ? parts.join('\n\n') : '';
}
