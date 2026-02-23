/**
 * Analytics Chat Structured Data
 *
 * Pure functions for extracting structured data from tool results and
 * formatting responses. No class, no `this`.
 */

import { Logger } from '@nestjs/common';
import { StructuredData } from './analytics-chat.types';

const logger = new Logger('AnalyticsChatStructuredData');

/**
 * Parse "tell me about [geo]" / "market in [geo]" for single-geography focus.
 * Returns geography name or null.
 */
export function parseSingleGeographyFocus(userMessage: string): string | null {
  const m = userMessage.trim();
  let match = m.match(/\btell\s+me\s+(?:everything\s+)?about\s+(?:the\s+)?(?:market\s+in\s+)?([^,.?!]+?)(?:\s+market|\s+metro|\s+county|$|\.|\?|,)/i);
  if (match) return match[1].trim();
  match = m.match(/(?:market|metro|area)\s+in\s+([^,.?!]+?)(?:\s+market|\s+metro|$|\.|\?|,)/i);
  if (match) return match[1].trim();
  match = m.match(/\b(?:analyze|profile|report\s+on)\s+(?:the\s+)?([^,.?!]+?)(?:\s+market|$|\.|\?|,)/i);
  if (match) return match[1].trim();
  return null;
}

/**
 * Parse "compare A and B" / "A vs B" from user message.
 * Returns [nameA, nameB] or null. Works for any geography level.
 */
export function parseCompareTwoGeographies(userMessage: string): [string, string] | null {
  const m = userMessage.trim();
  // "compare zip codes 21701 and 22309" / "compare zip code X and Y" / "compare zips X and Y"
  const zipMatch = m.match(/\bcompare\s+(?:zip\s*codes?|zips?)\s+(\d{5})\s+and\s+(\d{5})/i)
    || m.match(/\bcompare\s+.+?\s+(\d{5})\s+and\s+(\d{5})/i);
  if (zipMatch) return [zipMatch[1], zipMatch[2]];

  let match = m.match(/\bcompare\s+(.+?)\s+and\s+(.+?)(?:\s+as|\s+using|$|,|\.)/i);
  if (match) {
    const a = match[1].trim().replace(/\s+as\s+.*$/i, '').trim();
    const b = match[2].trim().replace(/\s+as\s+.*$/i, '').trim();
    if (a && b) return [a, b];
  }
  match = m.match(/(.+?)\s+vs\.?\s+(.+?)(?:\s+as|\s+using|$|,|\.)/i);
  if (match) {
    const a = match[1].trim();
    const b = match[2].trim();
    if (a && b && a.length > 1 && b.length > 1) return [a, b];
  }
  match = m.match(/(.+?)\s+and\s+(.+?)\s+as\s+(investment|homebuyer|market)/i);
  if (match) {
    const a = match[1].trim();
    const b = match[2].trim();
    if (a && b) return [a, b];
  }
  return null;
}

/**
 * Extract structured data from tool results for visual rendering.
 * When user asked to "compare A and B" (any geography), filters get_rankings to only those geographies.
 */
export function extractStructuredData(
  toolResults: Array<{ toolName: string; data: any }>,
  userMessage?: string,
): StructuredData | undefined {
  if (toolResults.length === 0) return undefined;

  const structured: StructuredData = {};
  const compareNames = userMessage ? parseCompareTwoGeographies(userMessage) : null;
  const singleGeoFocus = userMessage && !compareNames ? parseSingleGeographyFocus(userMessage) : null;

  for (const { toolName, data } of toolResults) {
    if (!data) {
      logger.warn(`[Quinn Extract] Skipping tool ${toolName} due to null data`);
      continue;
    }
    logger.debug(`[Quinn Extract] Processing tool: ${toolName}, data keys: ${JSON.stringify(Object.keys(data || {}))}`);

    // Unwrap if data is nested under data.data (analytics service wraps responses)
    const actualData = data.data || data;
    if (!actualData) {
      logger.warn(`[Quinn Extract] Skipping tool ${toolName} due to null actualData`);
      continue;
    }
    logger.debug(`[Quinn Extract] Actual data keys: ${JSON.stringify(Object.keys(actualData || {}))}`);

    // Handle rankings from get_rankings tool (including failed calls: data = { success, data, error })
    if (toolName === 'get_rankings') {
      const isFailed = data?.success === false && data?.error;
      if (isFailed) {
        structured.errorMessage = data.error;
      } else if (actualData?.error && (!actualData.rankings || actualData.rankings.length === 0)) {
        structured.errorMessage = actualData.error;
      }
      if (actualData?.rankings?.length) {
        let items = actualData.rankings.map((item: any) => ({
          rank: item.rank,
          name: item.geography_name || item.geography_id,
          id: item.geography_id,
          score: item.score,
          appreciation: (Math.abs(item.appreciation_12m) > 100)
            ? item.appreciation_12m / 100
            : item.appreciation_12m,
          state: item.state,
        }));
        // "Compare A and B" (any geography): show only the requested geographies, not a generic top-N
        if (compareNames && compareNames.length === 2) {
          const [na, nb] = compareNames.map((s) => s.toLowerCase().trim());
          items = items.filter(
            (it: { name: string; id?: string }) => {
              const name = (it.name || '').toLowerCase();
              const id = (it.id ?? '').toString().toLowerCase();
              return name.includes(na) || id.includes(na) || name.includes(nb) || id.includes(nb);
            },
          );
          if (items.length > 0) {
            logger.log(`[Quinn Extract] Filtered to ${items.length} items for "compare ${compareNames[0]} and ${compareNames[1]}"`);
          }
        } else if (singleGeoFocus) {
          // "Tell me about [geo]" / "market in [geo]": show only that geography, not full state list
          const focus = singleGeoFocus.toLowerCase();
          items = items.filter((it: { name: string }) => (it.name || '').toLowerCase().includes(focus));
          if (items.length > 0) {
            logger.log(`[Quinn Extract] Filtered to ${items.length} item(s) for single-geo focus "${singleGeoFocus}"`);
          }
        }
        logger.debug(`[Quinn Extract] Found rankings: ${items.length} items`);
        structured.rankings = {
          title: compareNames ? 'Comparison' : singleGeoFocus ? `${singleGeoFocus} — Performance` : (actualData.direction === 'bottom' ? 'Bottom Performers' : 'Top Performers'),
          direction: actualData.direction || 'top',
          items,
        };
      }
    }

    // Handle comparison from compare_to_benchmark tool
    if (toolName === 'compare_to_benchmark' && actualData.comparison) {
      const comp = actualData.comparison;
      structured.comparison = {
        title: 'Benchmark Comparison',
        filteredLabel: 'Selected Markets',
        benchmarkLabel: comp.benchmark_name || 'National',
        metrics: [],
      };

      if (comp.score) {
        structured.comparison.metrics.push({
          label: 'Average Score',
          filtered: comp.score.filtered_mean,
          benchmark: comp.score.benchmark_mean,
          unit: 'score',
          higherIsBetter: true,
        });
      }

      if (comp.appreciation_12m) {
        structured.comparison.metrics.push({
          label: '1-Year Appreciation',
          filtered: comp.appreciation_12m.filtered_mean_pct,
          benchmark: comp.appreciation_12m.benchmark_mean_pct,
          unit: 'percent',
          higherIsBetter: true,
        });
      }

      if (comp.appreciation_36m) {
        structured.comparison.metrics.push({
          label: '3-Year Appreciation',
          filtered: comp.appreciation_36m.filtered_mean_pct,
          benchmark: comp.appreciation_36m.benchmark_mean_pct,
          unit: 'percent',
          higherIsBetter: true,
        });
      }
    }

    // Handle analysis results from analyze_data tool
    if (toolName === 'analyze_data' && actualData.top_performers) {
      // Create a table for top performers
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

      // Create distribution chart if available
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
  }

  // Return undefined if no structured data was extracted
  return Object.keys(structured).length > 0 ? structured : undefined;
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
