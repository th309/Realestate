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
 * Map backend AI narrative keys to frontend section keys.
 *
 * The backend generates narratives under:
 *   market_summary, score_analysis, risks_opportunities, next_steps
 *
 * The frontend section components expect:
 *   hero_verdict, score_story, affordability_narrative,
 *   market_timing_narrative, stability_narrative, growth_potential_narrative,
 *   bottom_line_narrative, bottom_line_actions, bottom_line_watch
 *
 * This mapping runs BEFORE fallback generation so generateNarrativeFallbacks
 * only fills in keys that are still empty after mapping.
 */
function mapBackendNarrativeKeys(report: any): void {
  if (!report.ai_narrative) report.ai_narrative = {};
  const n = report.ai_narrative;

  // market_summary → hero_verdict (first sentence or ~100 chars) + keep as market_summary
  if (n.market_summary && !n.hero_verdict) {
    const text = String(n.market_summary);
    // Extract first sentence (up to first period followed by space or end)
    const sentenceMatch = text.match(/^[^.!?]*[.!?]/);
    if (sentenceMatch && sentenceMatch[0].length <= 150) {
      n.hero_verdict = sentenceMatch[0].trim();
    } else {
      // Fallback: first ~100 chars at a word boundary
      const truncated = text.substring(0, 120);
      const lastSpace = truncated.lastIndexOf(' ');
      n.hero_verdict =
        lastSpace > 60 ? truncated.substring(0, lastSpace) + '.' : truncated + '…';
    }
  }

  // score_analysis → score_story
  if (n.score_analysis && !n.score_story) {
    n.score_story = n.score_analysis;
  }

  // risks_opportunities → section-specific narratives (only if not already set)
  if (n.risks_opportunities) {
    const ro = String(n.risks_opportunities);
    if (!n.affordability_narrative) n.affordability_narrative = ro;
    if (!n.market_timing_narrative) n.market_timing_narrative = ro;
    if (!n.stability_narrative) n.stability_narrative = ro;
    if (!n.growth_potential_narrative) n.growth_potential_narrative = ro;
  }

  // next_steps → bottom_line_narrative + try to extract action items
  if (n.next_steps && !n.bottom_line_narrative) {
    n.bottom_line_narrative = n.next_steps;
  }
  // bottom_line_actions: strip code fences and parse JSON array
  if (n.bottom_line_actions && typeof n.bottom_line_actions === 'string') {
    let actionsText = n.bottom_line_actions.trim()
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    try {
      const parsed = JSON.parse(actionsText);
      if (Array.isArray(parsed)) n.bottom_line_actions = parsed;
    } catch { /* leave as string */ }
  }

  if (n.next_steps && !n.bottom_line_actions) {
    let text = String(n.next_steps).trim()
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    // Try to parse as JSON array first (in case the model returned JSON)
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        n.bottom_line_actions = parsed;
      }
    } catch {
      // Extract numbered or bulleted items (e.g. "1. Do X", "- Do Y", "• Do Z")
      const items = text
        .split(/\n/)
        .map((line: string) => line.replace(/^\s*(?:\d+[.)]\s*|[-•*]\s*)/, '').trim())
        .filter((line: string) => line.length > 10 && line.length < 200);
      if (items.length >= 2) {
        n.bottom_line_actions = items.slice(0, 5);
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

  // Fill in any keys still empty after mapBackendNarrativeKeys.
  // Each block below guards on !narrative.<key> so existing values are preserved.

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
  mapBackendNarrativeKeys(report);
  generateNarrativeFallbacks(report);
  return report;
}
