/**
 * Report data normalization utilities.
 *
 * Transforms raw API response into the shape section components expect:
 * - Flattens nested scores_snapshot.scores.<type>.components
 * - Backfills populated_data.current from historical data
 * - Converts ratio-form YoY values to percentage-form
 * - Generates fallback narratives from score context when ai_narrative is empty
 */

/**
 * Flatten nested `scores.<type>.components` into the flat
 * `homeready_components`, `investoredge_components` format.
 */
function normalizeScoresSnapshot(report: any): void {
  const ss = report.scores_snapshot;
  if (!ss?.scores) return;
  const scores = ss.scores;

  for (const [type, data] of Object.entries(scores) as [string, any][]) {
    if (!data) continue;
    const prefix = type; // e.g. homeready, investoredge, markethealth
    if (!ss[`${prefix}_components`] && data.components) {
      ss[`${prefix}_components`] = data.components;
    }
    if (ss[`${prefix}_score`] == null && data.score != null) {
      ss[`${prefix}_score`] = data.score;
    }
    if (!ss[`${prefix}_grade`] && data.grade) {
      ss[`${prefix}_grade`] = data.grade;
    }
  }
}

/**
 * Backfill populated_data.current with the latest value from historical
 * when a metric is missing from current but exists in historical.
 */
function backfillCurrentFromHistorical(report: any): void {
  const pd = report.populated_data;
  if (!pd?.historical) return;
  if (!pd.current) pd.current = {};

  for (const [metricId, histObj] of Object.entries(pd.historical)) {
    const hist = histObj as any;
    if (pd.current[metricId] != null) continue;
    if (hist?.data?.length > 0) {
      const latest = hist.data[hist.data.length - 1];
      if (latest?.value != null) {
        pd.current[metricId] = latest.value;
      }
    }
  }
}

/**
 * Convert ratio-form YoY values to percentage-form and add aliases
 * so sections can find e.g. `home_value_yoy` from `median_listing_price_yoy`.
 */
function addYoyAliases(report: any): void {
  const current = report.populated_data?.current;
  if (!current) return;

  // Convert ratios to percentages (e.g. 0.05 → 5.0)
  const yoyRatioKeys = [
    'median_listing_price_yoy', 'inventory_yoy',
    'zhvi_yoy', 'home_value_yoy',
  ];
  for (const key of yoyRatioKeys) {
    if (current[key] != null && Math.abs(current[key]) < 1) {
      current[key] = current[key] * 100;
    }
  }

  // Copy to alias keys sections expect
  const yoyAliases: Record<string, string[]> = {
    median_listing_price_yoy: ['zhvi_yoy', 'home_value_yoy'],
  };
  for (const [source, targets] of Object.entries(yoyAliases)) {
    if (current[source] != null) {
      for (const target of targets) {
        if (current[target] == null) {
          current[target] = current[source];
        }
      }
    }
  }
}

/**
 * Generate fallback narrative content from score context data
 * when ai_narrative is empty. Uses real data from score context.
 */
function generateNarrativeFallbacks(report: any): void {
  if (!report.ai_narrative) report.ai_narrative = {};
  const narrative = report.ai_narrative;

  // Skip if any narratives already exist
  const hasNarratives = Object.values(narrative).some(
    (v) => v !== null && v !== undefined && v !== ''
  );
  if (hasNarratives) return;

  const scoreType = report.user_type === 'investor' ? 'investoredge' : 'homeready';
  const scoreCtx = report.populated_data?.scores?.[scoreType]?.context;
  const score = report[`${scoreType}_score`] ?? report.scores_snapshot?.scores?.[scoreType]?.score;
  const geoName = report.primary_geography_name || 'this market';

  // Hero verdict from score context interpretation
  if (!narrative.hero_verdict && scoreCtx?.interpretation) {
    narrative.hero_verdict = scoreCtx.interpretation;
  }

  // Score story from score context comparison + percentile + dollar impact
  if (!narrative.score_story && scoreCtx) {
    const parts: string[] = [];
    if (scoreCtx.comparison) parts.push(scoreCtx.comparison + '.');
    if (scoreCtx.percentile_text) parts.push(scoreCtx.percentile_text + '.');
    if (scoreCtx.dollar_impact) parts.push(scoreCtx.dollar_impact + '.');
    if (parts.length > 0) {
      narrative.score_story = parts.join(' ');
    }
  }

  // Bottom line from score + context
  if (!narrative.bottom_line_narrative && score != null) {
    if (score >= 65) {
      narrative.bottom_line_narrative =
        `${geoName} scores ${score}/100, indicating favorable conditions. ` +
        (scoreCtx?.dollar_impact || 'This market shows solid fundamentals for buyers.');
    } else if (score >= 45) {
      narrative.bottom_line_narrative =
        `${geoName} scores ${score}/100, suggesting moderate conditions. ` +
        'Careful evaluation of your specific needs and timing is recommended.';
    } else {
      narrative.bottom_line_narrative =
        `${geoName} scores ${score}/100, indicating challenging conditions. ` +
        'Consider waiting for improved conditions or exploring alternative markets.';
    }
  }

  // Section narratives from populated_data.recommendations
  const recs = report.populated_data?.recommendations;
  if (recs) {
    if (!narrative.affordability_narrative && recs.affordability) {
      narrative.affordability_narrative = recs.affordability;
    }
    if (!narrative.market_timing_narrative && recs.timing) {
      narrative.market_timing_narrative = recs.timing;
    }
    if (!narrative.stability_narrative && recs.stability) {
      narrative.stability_narrative = recs.stability;
    }
    if (!narrative.growth_potential_narrative && recs.growth) {
      narrative.growth_potential_narrative = recs.growth;
    }
  }
}

/**
 * Normalize a report from the API into the shape section components expect.
 */
export function normalizeReport(report: any): any {
  normalizeScoresSnapshot(report);
  backfillCurrentFromHistorical(report);
  addYoyAliases(report);
  generateNarrativeFallbacks(report);
  return report;
}
