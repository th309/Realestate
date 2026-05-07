/**
 * Narrative Template Variables
 *
 * Builds the flat key-value template variable map consumed by Claude AI
 * narrative generation.  Each key corresponds to a `{{placeholder}}` in
 * the narrative prompt templates defined in report template configs.
 *
 * Extracted from reports-orchestrator.ts to keep file sizes manageable.
 */

import { formatCurrency, formatPriorityName } from './reports-score-context';
import type { PriorityWeightedResult } from './reports-market-comparison';
import type { GenerateReportDto } from './dto/generate-report.dto';
import {
  computeComponentExtremes,
  computeKeyTension,
  computeUserGoalSummary,
} from './reports-narrative-cross-section';
import { computeAnalyticalInsights } from './narrative-insights';
import { computeScenarioInputs } from './scenario-computation';
import { getValidationTemplateVars } from './validation-credibility';

/**
 * Build the full template-variable map that Claude uses for AI narrative
 * generation.  This is a flat key→value object whose keys match
 * `{{placeholders}}` in narrative prompt templates.
 *
 * @param briefingContext - Optional market briefing from the intelligence layer.
 *   When present, adds stance/risk/news context so AI narratives align with
 *   the intelligence assessment. When absent, narratives generate exactly as
 *   before — no degradation.
 */
export function buildNarrativeTemplateVars(
  dto: GenerateReportDto,
  scores: any,
  scoreContexts: any,
  marketMetrics: Record<string, any>,
  newsContext: string,
  signalSummary: any,
  priorities: string[],
  priorityWeightedWinner: PriorityWeightedResult | null,
  comparisons: Record<string, any>,
  userProfile?: {
    investment_goal?: string | null;
    experience_level?: string | null;
    preferred_markets?: any[] | null;
    full_name?: string | null;
  } | null,
  benchmarks?: Record<string, any>,
): Record<string, any> {
  // Pre-compute analytical insights ("so what" context for the AI)
  const analyticalInsights = computeAnalyticalInsights(
    marketMetrics,
    scores,
    benchmarks || {},
    dto.user_type,
    dto.user_inputs,
  );
  return {
    geography_name: dto.primary_geography.name,
    primary_geography_name: dto.primary_geography.name,
    geography_type: dto.primary_geography.type,
    user_type: dto.user_type,

    // PropertyIQ Score (v4 — primary)
    propertyiq_score: scores?.scores.propertyiq
      ? Math.round(scores.scores.propertyiq.score)
      : 'N/A',
    propertyiq_grade: scores?.scores.propertyiq?.grade || 'N/A',

    // Legacy scores (backward compat for old report templates)
    homeready_score: scores?.scores.propertyiq
      ? Math.round(scores.scores.propertyiq.score)
      : scores?.scores.homeready
        ? Math.round(scores.scores.homeready.score)
        : 'N/A',
    investoredge_score: scores?.scores.propertyiq
      ? Math.round(scores.scores.propertyiq.score)
      : scores?.scores.investoredge
        ? Math.round(scores.scores.investoredge.score)
        : 'N/A',
    markethealth_score: scores?.scores.propertyiq
      ? Math.round(scores.scores.propertyiq.score)
      : scores?.scores.markethealth
        ? Math.round(scores.scores.markethealth.score)
        : 'N/A',
    homeready_grade:
      scores?.scores.propertyiq?.grade ||
      scores?.scores.homeready?.grade ||
      'N/A',
    investoredge_grade:
      scores?.scores.propertyiq?.grade ||
      scores?.scores.investoredge?.grade ||
      'N/A',

    // HomeReady component scores
    ...buildComponentVars(
      scores?.scores?.homeready?.components as any[] | undefined,
      ['affordability', 'market_timing', 'stability', 'growth_potential'],
    ),

    // InvestorEdge component scores
    ...buildComponentVars(
      scores?.scores?.investoredge?.components as any[] | undefined,
      ['cash_flow', 'rent_demand', 'appreciation', 'entry_point', 'risk'],
    ),

    // Price metrics
    zhvi: formatCurrency(marketMetrics.zhvi),
    zhvi_yoy: marketMetrics.zhvi_yoy?.toFixed(1) ?? 'N/A',
    zhvi_3y_cagr: marketMetrics.zhvi_3y_cagr?.toFixed(1) ?? 'N/A',
    zhvi_5y_cagr: marketMetrics.zhvi_5y_cagr?.toFixed(1) ?? 'N/A',
    zhvf_1yr_pct: marketMetrics.zhvf_1yr_pct?.toFixed(1) ?? 'N/A',
    median_listing_price: formatCurrency(marketMetrics.median_listing_price),

    // Rent metrics
    zori: formatCurrency(marketMetrics.zori),
    zori_yoy: marketMetrics.zori_yoy?.toFixed(1) ?? 'N/A',
    zori_5y_cagr: marketMetrics.zori_5y_cagr?.toFixed(1) ?? 'N/A',

    // Market activity
    market_heat_index:
      marketMetrics.market_heat_index ?? marketMetrics.hotness_score ?? 'N/A',
    hotness_score: marketMetrics.hotness_score ?? 'N/A',
    demand_score: marketMetrics.demand_score ?? 'N/A',
    days_to_pending:
      marketMetrics.days_to_pending ?? marketMetrics.days_on_market ?? 'N/A',
    days_on_market: marketMetrics.days_on_market ?? 'N/A',
    for_sale_inventory:
      marketMetrics.for_sale_inventory ??
      marketMetrics.active_listing_count ??
      'N/A',
    active_listing_count: marketMetrics.active_listing_count ?? 'N/A',
    inventory_yoy: marketMetrics.inventory_yoy?.toFixed(1) ?? 'N/A',
    new_listings: marketMetrics.new_listings ?? 'N/A',
    pending_ratio: marketMetrics.pending_ratio
      ? (marketMetrics.pending_ratio * 100).toFixed(1)
      : 'N/A',
    price_cut_pct:
      (marketMetrics.price_cut_pct ?? marketMetrics.price_reduced_share) != null
        ? (
            marketMetrics.price_cut_pct ??
            marketMetrics.price_reduced_share ??
            0
          ).toFixed(1)
        : 'N/A',
    sale_to_list_ratio: marketMetrics.sale_to_list_ratio?.toFixed(1) ?? 'N/A',
    months_of_supply: marketMetrics.months_of_supply?.toFixed(1) ?? 'N/A',

    // Investment metrics
    gross_rent_multiplier:
      marketMetrics.gross_rent_multiplier ?? marketMetrics.grm ?? 'N/A',
    rent_to_price_ratio: marketMetrics.rent_to_price_ratio?.toFixed(2) ?? 'N/A',
    cap_rate_proxy:
      marketMetrics.cap_rate_proxy ?? marketMetrics.cap_rate ?? 'N/A',
    cap_rate: marketMetrics.cap_rate?.toFixed(2) ?? 'N/A',
    gross_yield: marketMetrics.gross_yield?.toFixed(2) ?? 'N/A',
    grm: marketMetrics.grm?.toFixed(1) ?? 'N/A',
    zordi: marketMetrics.zordi ?? 'N/A',
    rent_to_income_ratio:
      marketMetrics.rent_to_income_ratio?.toFixed(1) ?? 'N/A',

    // Affordability metrics
    affordability_index: marketMetrics.affordability_index ?? 'N/A',
    affordability_gap: marketMetrics.affordability_gap
      ? formatCurrency(marketMetrics.affordability_gap)
      : 'N/A',
    income_needed_to_buy: marketMetrics.income_needed_to_buy
      ? formatCurrency(marketMetrics.income_needed_to_buy)
      : 'N/A',
    income_percentile_to_buy: marketMetrics.income_percentile_to_buy ?? 'N/A',

    // Economic / Census data
    median_household_income: formatCurrency(
      marketMetrics.median_household_income ?? marketMetrics.median_income,
    ),
    median_income: formatCurrency(marketMetrics.median_income),
    population: marketMetrics.population?.toLocaleString() ?? 'N/A',
    population_growth_yoy:
      marketMetrics.population_growth_yoy?.toFixed(1) ?? 'N/A',
    unemployment_rate: marketMetrics.unemployment_rate?.toFixed(1) ?? 'N/A',
    job_growth_yoy: marketMetrics.job_growth_yoy?.toFixed(1) ?? 'N/A',
    income_growth_yoy: marketMetrics.income_growth_yoy?.toFixed(1) ?? 'N/A',
    net_migration: marketMetrics.net_migration?.toLocaleString() ?? 'N/A',
    median_age: marketMetrics.median_age ?? 'N/A',
    homeownership_rate: marketMetrics.homeownership_rate?.toFixed(1) ?? 'N/A',
    remote_work_pct: marketMetrics.remote_work_pct?.toFixed(1) ?? 'N/A',

    // Historical comparisons
    zhvi_vs_2007_peak: marketMetrics.zhvi_vs_2007_peak?.toFixed(1) ?? 'N/A',
    zhvi_vs_2012_trough: marketMetrics.zhvi_vs_2012_trough?.toFixed(1) ?? 'N/A',
    zhvi_vs_pre_covid: marketMetrics.zhvi_vs_pre_covid?.toFixed(1) ?? 'N/A',

    // Full objects for complex analysis
    scores,
    market_metrics: marketMetrics,
    news_context: newsContext,
    market_signal_summary: signalSummary
      ? `Overall market signal: ${signalSummary.overall.toUpperCase()} (${signalSummary.bullish_count} bullish, ${signalSummary.bearish_count} bearish signals)`
      : null,
    raw_news_items: [],
    raw_economic_indicators: [],
    raw_market_signals: [],
    raw_national_context: null,

    // Score context for AI narratives
    propertyiq_context: scoreContexts?.propertyiq?.interpretation || null,
    propertyiq_comparison: scoreContexts?.propertyiq?.comparison || null,
    propertyiq_impact: scoreContexts?.propertyiq?.dollar_impact || null,
    // Legacy template var aliases (old report templates reference these)
    homeready_context: scoreContexts?.propertyiq?.interpretation || null,
    homeready_comparison: scoreContexts?.propertyiq?.comparison || null,
    homeready_impact: scoreContexts?.propertyiq?.dollar_impact || null,
    investoredge_context: scoreContexts?.propertyiq?.interpretation || null,
    investoredge_comparison: scoreContexts?.propertyiq?.comparison || null,
    investoredge_impact: scoreContexts?.propertyiq?.dollar_impact || null,
    markethealth_context: scoreContexts?.propertyiq?.interpretation || null,
    markethealth_comparison: scoreContexts?.propertyiq?.comparison || null,
    markethealth_impact: scoreContexts?.propertyiq?.dollar_impact || null,

    // Priority and comparison context
    priorities,
    priorities_formatted:
      priorities.length > 0
        ? priorities
            .map((p, i) => `${i + 1}. ${formatPriorityName(p)}`)
            .join(', ')
        : 'No priorities specified',
    priority_weighted_winner: priorityWeightedWinner,
    winner_name: priorityWeightedWinner?.winnerName || null,
    winner_reasons: priorityWeightedWinner?.reasons || [],
    comparison_markets:
      dto.comparison_geographies?.map((g) => ({
        id: g.id,
        name: g.name,
        metrics: comparisons[g.id]?.current,
        scores: comparisons[g.id]?.scores,
      })) || [],

    // User onboarding profile (for tone/depth personalization)
    user_name: userProfile?.full_name || null,
    user_investment_goal: userProfile?.investment_goal || null,
    user_experience_level: userProfile?.experience_level || null,

    // Cross-section context for narrative coherence
    overall_score: scores?.scores.propertyiq
      ? Math.round(scores.scores.propertyiq.score)
      : scores?.scores.homeready
        ? Math.round(scores.scores.homeready.score)
        : 'N/A',
    overall_grade:
      scores?.scores.propertyiq?.grade ||
      scores?.scores.homeready?.grade ||
      'N/A',
    ...computeComponentExtremes(scores, dto.user_type),
    key_tension: computeKeyTension(scores, dto.user_type),
    user_goal_summary: computeUserGoalSummary(dto, priorities),

    ...dto.user_inputs,

    // Pre-computed analytical insights (digested "so what" context)
    ...analyticalInsights,

    // Pre-computed scenario analysis (rate/price/return scenarios)
    ...computeScenarioInputs(
      marketMetrics,
      scores,
      dto.user_type,
      dto.user_inputs,
    ),

    // Validation credibility stats for AI to cite in narratives
    ...getValidationTemplateVars(),
  };
}

/**
 * Build component score template variables from score component breakdowns.
 * Returns e.g. { affordability_score: 72, affordability_status: 'good', ... }
 */
export function buildComponentVars(
  components:
    | Array<{ component: string; score: number; status: string }>
    | undefined,
  fallbackNames: string[],
): Record<string, any> {
  const ctx: Record<string, any> = {};
  if (components) {
    for (const comp of components) {
      ctx[`${comp.component}_score`] = Math.round(comp.score);
      ctx[`${comp.component}_status`] = comp.status;
    }
  } else {
    for (const name of fallbackNames) {
      ctx[`${name}_score`] = 'N/A';
      ctx[`${name}_status`] = 'N/A';
    }
  }
  return ctx;
}

// ============================================================================
// Market Intelligence Briefing Helpers
// ============================================================================

/**
 * Convert a market stance enum value into a human-readable description
 * suitable for inclusion in AI narrative prompts.
 */
function formatStanceForNarrative(stance: string): string {
  const stanceDescriptions: Record<string, string> = {
    strong_bullish: 'strongly bullish — the data overwhelmingly favors this market',
    weak_bullish: 'cautiously bullish — more positive signals than negative',
    neutral: 'neutral — mixed signals with no clear directional trend',
    weak_bearish: 'cautiously bearish — more warning signs than positive signals',
    strong_bearish: 'strongly bearish — significant risk factors present',
  };
  return stanceDescriptions[stance] || 'neutral';
}

/**
 * Build template variables from an optional market briefing.
 *
 * When `briefingContext` is null/undefined (intelligence off or no briefing
 * exists), all keys are set to null so conditional prompt blocks are skipped
 * and the narrative generates exactly as it did before intelligence existed.
 */
function buildBriefingTemplateVars(briefingContext?: any): Record<string, any> {
  if (!briefingContext) {
    return {
      market_stance: null,
      stance_description: null,
      risk_flags_text: null,
      briefing_narrative: null,
      briefing_news: null,
      briefing_intelligence_block: null,
    };
  }

  const stanceDescription = formatStanceForNarrative(briefingContext.market_stance);

  const riskFlagsText = (briefingContext.risk_flags || [])
    .map((f: any) => f.detail || f.description || f.flag)
    .filter(Boolean)
    .join('; ');

  const briefingNews = (briefingContext.news_snapshot || [])
    .map((n: any) => `${n.headline} (${n.source_name})`)
    .filter(Boolean)
    .join('; ');

  // Pre-built intelligence block that prompt templates can include via
  // {{#if market_stance}}...{{/if}} or {{briefing_intelligence_block}}
  const intelligenceBlock = [
    'MARKET INTELLIGENCE CONTEXT:',
    `Market Stance: ${stanceDescription}`,
    `Key Risks: ${riskFlagsText || 'None identified'}`,
    `Market Summary: ${briefingContext.narrative_summary || 'N/A'}`,
    briefingNews ? `Recent News: ${briefingNews}` : null,
    '',
    'Your analysis MUST be consistent with this market assessment. Personalization and depth remain unchanged.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return {
    market_stance: briefingContext.market_stance,
    stance_description: stanceDescription,
    risk_flags_text: riskFlagsText || null,
    briefing_narrative: briefingContext.narrative_summary || null,
    briefing_news: briefingNews || null,
    briefing_intelligence_block: intelligenceBlock,
  };
}
