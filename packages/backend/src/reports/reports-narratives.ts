/**
 * Report Narrative Generation Functions
 *
 * Extracted from ReportsService to keep file sizes manageable.
 * These functions handle AI narrative generation for report sections:
 * - Building context objects for prompt template interpolation
 * - Generating section narratives via ClaudeService
 * - Regenerating narratives after user input changes
 * - Resolving conditional template blocks
 */

import { Logger, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ClaudeService } from './claude.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { NARRATIVE_PROMPTS, SECTIONS_BY_REPORT_TYPE } from './narrative-prompts';
import { ScoreComponentBreakdown } from '../scoring/scoring.types';
import { HistoricalData } from './reports.service';

// ============================================================================
// Formatting Helpers (pure functions)
// ============================================================================

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return 'N/A';
  return '$' + Math.round(value).toLocaleString();
}

function formatPriorityName(priority: string): string {
  const names: Record<string, string> = {
    affordability: 'Affordability',
    appreciation: 'Appreciation',
    job_market: 'Job Market',
    market_timing: 'Market Timing',
    lifestyle: 'Lifestyle',
    cash_flow: 'Cash Flow',
    tenant_demand: 'Tenant Demand',
    entry_price: 'Entry Price',
    stability: 'Stability',
  };
  return names[priority] || priority;
}

// ============================================================================
// Conditional Template Resolution (pure function)
// ============================================================================

/**
 * Interpolate conditional blocks in a template.
 *
 * Handles {{#if variable}}...{{/if}} syntax:
 * - If the variable is truthy (not null, not undefined, not empty string),
 *   the block content is included.
 * - Otherwise, the entire block is removed.
 *
 * This pre-processes conditional blocks before ClaudeService.interpolateTemplate
 * handles {{variable}} substitution.
 *
 * @param template - Template string with conditional blocks
 * @param context - Context values for condition evaluation
 * @returns Template with conditionals resolved
 */
export function resolveConditionalBlocks(
  template: string,
  context: Record<string, any>,
): string {
  // Match {{#if variable}}...{{/if}} blocks (non-greedy, supports multiline)
  return template.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (match, variable, content) => {
      const value = context[variable];
      // Include the block if the value is truthy
      if (
        value !== null &&
        value !== undefined &&
        value !== '' &&
        value !== 'N/A'
      ) {
        return content;
      }
      return '';
    },
  );
}

// ============================================================================
// Narrative Context Builder (pure function)
// ============================================================================

/**
 * Build a comprehensive context object for narrative template interpolation.
 *
 * Extracts and formats all data needed by prompt templates:
 * - Geography info (name, type, state)
 * - Score breakdowns (overall + per-component scores and statuses)
 * - Current metric values (formatted for display)
 * - Benchmarks (national and state medians)
 * - User inputs (priorities, income, down payment, timeline)
 * - Trend data (direction and change_pct for key metrics)
 * - Comparison data (when applicable)
 *
 * @param reportData - Assembled report data
 * @param scores - Full score result with components
 * @param dto - Original generation request
 * @param newsContext - Optional formatted news string
 * @returns Flat context record for template interpolation
 */
export function buildNarrativeContext(
  reportData: {
    current: Record<string, any>;
    historical: HistoricalData;
    benchmarks: Record<string, any>;
    scores: Record<string, any>;
    comparisons?: Record<string, any>;
  },
  scores: any,
  dto: GenerateReportDto,
  newsContext?: string,
): Record<string, any> {
  const context: Record<string, any> = {};

  // -------------------------------------------------------------------------
  // Geography Info
  // -------------------------------------------------------------------------
  context.geography_name = dto.primary_geography.name;
  context.primary_geography_name = dto.primary_geography.name;
  context.geography_type = dto.primary_geography.type;
  context.geography_state = dto.primary_geography.state || 'N/A';
  context.user_type = dto.user_type;

  // -------------------------------------------------------------------------
  // Overall Scores
  // -------------------------------------------------------------------------
  if (scores?.scores) {
    context.homeready_score = scores.scores.homeready
      ? Math.round(scores.scores.homeready.score)
      : 'N/A';
    context.homeready_grade = scores.scores.homeready?.grade || 'N/A';
    context.investoredge_score = scores.scores.investoredge
      ? Math.round(scores.scores.investoredge.score)
      : 'N/A';
    context.investoredge_grade = scores.scores.investoredge?.grade || 'N/A';
    context.markethealth_score = scores.scores.markethealth
      ? Math.round(scores.scores.markethealth.score)
      : 'N/A';
  }

  // -------------------------------------------------------------------------
  // HomeReady Component Scores
  // -------------------------------------------------------------------------
  const hrComponents = scores?.scores?.homeready?.components as
    | ScoreComponentBreakdown[]
    | undefined;
  if (hrComponents) {
    for (const comp of hrComponents) {
      context[`${comp.component}_score`] = Math.round(comp.score);
      context[`${comp.component}_status`] = comp.status;
      context[`${comp.component}_weight`] = (comp.weight * 100).toFixed(0);
    }
  } else {
    // Fallback: provide N/A for known HomeReady components
    for (const comp of [
      'affordability',
      'market_timing',
      'stability',
      'growth_potential',
    ]) {
      context[`${comp}_score`] = 'N/A';
      context[`${comp}_status`] = 'N/A';
      context[`${comp}_weight`] = 'N/A';
    }
  }

  // -------------------------------------------------------------------------
  // InvestorEdge Component Scores
  // -------------------------------------------------------------------------
  const ieComponents = scores?.scores?.investoredge?.components as
    | ScoreComponentBreakdown[]
    | undefined;
  if (ieComponents) {
    for (const comp of ieComponents) {
      context[`${comp.component}_score`] = Math.round(comp.score);
      context[`${comp.component}_status`] = comp.status;
      context[`${comp.component}_weight`] = (comp.weight * 100).toFixed(0);
    }
  } else {
    // Fallback: provide N/A for known InvestorEdge components
    for (const comp of [
      'cash_flow',
      'rent_demand',
      'appreciation',
      'entry_point',
      'risk',
    ]) {
      context[`${comp}_score`] = 'N/A';
      context[`${comp}_status`] = 'N/A';
      context[`${comp}_weight`] = 'N/A';
    }
  }

  // -------------------------------------------------------------------------
  // Current Metric Values (formatted for display in prompts)
  // -------------------------------------------------------------------------
  const current = reportData.current || {};

  // Price metrics
  context.median_listing_price = formatCurrency(
    current.median_listing_price || current.zhvi,
  );
  context.zhvi = formatCurrency(current.zhvi);
  context.zhvi_yoy = current.zhvi_yoy?.toFixed(1) ?? 'N/A';
  context.zhvi_3y_cagr = current.zhvi_3y_cagr?.toFixed(1) ?? 'N/A';
  context.zhvi_5y_cagr = current.zhvi_5y_cagr?.toFixed(1) ?? 'N/A';
  context.zhvf_1yr_pct = current.zhvf_1yr_pct?.toFixed(1) ?? 'N/A';

  // Rent metrics
  context.zori = formatCurrency(current.zori);
  context.zori_yoy = current.zori_yoy?.toFixed(1) ?? 'N/A';
  context.zori_5y_cagr = current.zori_5y_cagr?.toFixed(1) ?? 'N/A';
  context.zordi = current.zordi ?? 'N/A';

  // Market activity
  context.days_on_market = current.days_on_market ?? 'N/A';
  context.hotness_score = current.hotness_score ?? 'N/A';
  context.demand_score = current.demand_score ?? 'N/A';
  context.supply_score = current.supply_score ?? 'N/A';
  context.active_listing_count = current.active_listing_count ?? 'N/A';
  context.inventory_yoy = current.inventory_yoy?.toFixed(1) ?? 'N/A';
  context.pending_ratio = current.pending_ratio
    ? (current.pending_ratio * 100).toFixed(1)
    : 'N/A';
  context.price_cut_pct = current.price_reduced_share
    ? (current.price_reduced_share * 100).toFixed(1)
    : current.price_cut_pct?.toFixed(1) ?? 'N/A';
  context.sale_to_list_ratio =
    current.sale_to_list_ratio?.toFixed(2) ?? 'N/A';
  context.months_of_supply = current.months_of_supply?.toFixed(1) ?? 'N/A';

  // Investment metrics
  context.cap_rate = current.cap_rate?.toFixed(2) ?? 'N/A';
  context.gross_yield = current.gross_yield?.toFixed(2) ?? 'N/A';
  context.grm = current.grm?.toFixed(1) ?? 'N/A';
  context.rent_to_price_ratio =
    current.rent_to_price_ratio?.toFixed(3) ?? 'N/A';
  context.overvalued_pct = current.overvalued_pct?.toFixed(1) ?? 'N/A';
  context.affordability_index = current.affordability_index ?? 'N/A';
  context.income_needed_to_buy = current.income_needed_to_buy
    ? formatCurrency(current.income_needed_to_buy)
    : 'N/A';
  context.rent_to_income_ratio =
    current.rent_to_income_ratio?.toFixed(1) ?? 'N/A';

  // Economic/Census data
  context.median_income = formatCurrency(
    current.median_income || current.median_household_income,
  );
  context.median_household_income = formatCurrency(
    current.median_household_income || current.median_income,
  );
  context.population = current.population?.toLocaleString() ?? 'N/A';
  context.population_growth_yoy =
    current.population_growth_yoy?.toFixed(1) ?? 'N/A';
  context.unemployment_rate =
    current.unemployment_rate?.toFixed(1) ?? 'N/A';
  context.job_growth_yoy = current.job_growth_yoy?.toFixed(1) ?? 'N/A';
  context.income_growth_yoy =
    current.income_growth_yoy?.toFixed(1) ?? 'N/A';
  context.net_migration = current.net_migration?.toLocaleString() ?? 'N/A';
  context.median_age = current.median_age ?? 'N/A';
  context.homeownership_rate =
    current.homeownership_rate?.toFixed(1) ?? 'N/A';
  context.remote_work_pct = current.remote_work_pct?.toFixed(1) ?? 'N/A';

  // Historical comparisons
  context.zhvi_vs_2007_peak =
    current.zhvi_vs_2007_peak?.toFixed(1) ?? 'N/A';
  context.zhvi_vs_2012_trough =
    current.zhvi_vs_2012_trough?.toFixed(1) ?? 'N/A';
  context.zhvi_vs_pre_covid =
    current.zhvi_vs_pre_covid?.toFixed(1) ?? 'N/A';

  // -------------------------------------------------------------------------
  // Benchmarks (National and State medians)
  // -------------------------------------------------------------------------
  const benchmarks = reportData.benchmarks || {};
  context.national_median_price = formatCurrency(
    benchmarks.national_median_price,
  );
  context.state_median_price = formatCurrency(benchmarks.state_median_price);
  context.national_avg_cap_rate =
    benchmarks.national_avg_cap_rate?.toFixed(2) ?? 'N/A';

  // -------------------------------------------------------------------------
  // Trend Data (from historical timeseries)
  // -------------------------------------------------------------------------
  const historical = reportData.historical || {};

  // ZHVI trend
  if (historical.zhvi) {
    context.zhvi_trend = historical.zhvi.trend;
    context.zhvi_change_pct =
      historical.zhvi.change_pct?.toFixed(1) ?? '0';
  } else {
    context.zhvi_trend = 'N/A';
    context.zhvi_change_pct = 'N/A';
  }

  // Days on market trend
  if (historical.days_on_market) {
    context.dom_trend = historical.days_on_market.trend;
    context.dom_change_pct =
      historical.days_on_market.change_pct?.toFixed(1) ?? '0';
  } else {
    context.dom_trend = 'N/A';
    context.dom_change_pct = 'N/A';
  }

  // ZORI (rent) trend
  if (historical.zori) {
    context.zori_trend = historical.zori.trend;
    context.zori_change_pct =
      historical.zori.change_pct?.toFixed(1) ?? '0';
  } else {
    context.zori_trend = 'N/A';
    context.zori_change_pct = 'N/A';
  }

  // Cap rate trend
  if (historical.cap_rate) {
    context.cap_rate_trend = historical.cap_rate.trend;
    context.cap_rate_change_pct =
      historical.cap_rate.change_pct?.toFixed(1) ?? '0';
  } else {
    context.cap_rate_trend = 'N/A';
    context.cap_rate_change_pct = 'N/A';
  }

  // -------------------------------------------------------------------------
  // User Inputs (priorities, financials, timeline)
  // -------------------------------------------------------------------------
  const priorities = dto.priorities || dto.user_inputs?.priorities || [];
  context.priorities = priorities;
  context.priorities_formatted =
    priorities.length > 0
      ? priorities
          .map((p, i) => `${i + 1}. ${formatPriorityName(p)}`)
          .join(', ')
      : 'No priorities specified';

  // Financial inputs (formatted with $ for display in prompts)
  const userInputs = dto.user_inputs || {};
  const rawIncome =
    userInputs.income || userInputs.household_income || null;
  const rawDownPayment = userInputs.down_payment || null;
  const rawBudget = userInputs.budget || userInputs.price_range || null;

  context.user_income =
    rawIncome != null ? formatCurrency(Number(rawIncome)) : null;
  context.user_down_payment =
    rawDownPayment != null ? formatCurrency(Number(rawDownPayment)) : null;
  context.user_budget =
    rawBudget != null ? formatCurrency(Number(rawBudget)) : null;
  context.user_timeline = userInputs.timeline || null;
  context.user_target_return = userInputs.target_return || null;
  context.user_strategy =
    userInputs.strategy || userInputs.investment_strategy || null;

  // -------------------------------------------------------------------------
  // News Context
  // -------------------------------------------------------------------------
  context.news_context =
    newsContext || 'No recent news available for this market.';

  // -------------------------------------------------------------------------
  // Comparison Data (for comparison reports)
  // -------------------------------------------------------------------------
  if (
    reportData.comparisons &&
    Object.keys(reportData.comparisons).length > 0
  ) {
    // Build comparison summary text
    const compEntries = Object.entries(reportData.comparisons);
    const compSummaryParts: string[] = [];
    const compScoreParts: string[] = [];

    // Include primary market
    compSummaryParts.push(`- ${dto.primary_geography.name} (primary)`);
    if (scores?.scores) {
      const primaryScoreType =
        dto.user_type === 'investor' ? 'investoredge' : 'homeready';
      const primaryScore = scores.scores[primaryScoreType];
      compScoreParts.push(
        `- ${dto.primary_geography.name}: ${primaryScoreType} ${Math.round(primaryScore?.score || 0)}/100`,
      );
    }

    for (const [compId, compData] of compEntries) {
      const compGeo = (compData as any).geography;
      const compScores = (compData as any).scores;
      compSummaryParts.push(`- ${compGeo?.name || compId}`);

      if (compScores?.scores) {
        const scoreType =
          dto.user_type === 'investor' ? 'investoredge' : 'homeready';
        const score = compScores.scores[scoreType];
        compScoreParts.push(
          `- ${compGeo?.name || compId}: ${scoreType} ${Math.round(score?.score || 0)}/100`,
        );
      }
    }

    context.comparison_summary = compSummaryParts.join('\n');
    context.comparison_scores = compScoreParts.join('\n');

    // Build component comparison data
    const scoreType =
      dto.user_type === 'investor' ? 'investoredge' : 'homeready';
    const componentNames =
      dto.user_type === 'investor'
        ? [
            'cash_flow',
            'rent_demand',
            'appreciation',
            'entry_point',
            'risk',
          ]
        : [
            'affordability',
            'market_timing',
            'stability',
            'growth_potential',
          ];

    const compComponentLines: string[] = [];
    for (const compName of componentNames) {
      const primaryComp = (hrComponents || ieComponents || []).find(
        (c) => c.component === compName,
      );
      const primaryVal = primaryComp ? Math.round(primaryComp.score) : 'N/A';

      let line = `${compName}: ${dto.primary_geography.name}=${primaryVal}`;
      for (const [compId, compData] of compEntries) {
        const compGeo = (compData as any).geography;
        const compScores = (compData as any).scores;
        const compComponents =
          compScores?.scores?.[scoreType]?.components || [];
        const matchComp = compComponents.find(
          (c: any) => c.component === compName,
        );
        const compVal = matchComp ? Math.round(matchComp.score) : 'N/A';
        line += `, ${compGeo?.name || compId}=${compVal}`;
      }
      compComponentLines.push(line);
    }
    context.comparison_component_data = compComponentLines.join('\n');

    // Priority analysis data
    const priorityWeighted = (reportData as any).priority_weighted_winner;
    if (priorityWeighted) {
      context.winner_name = priorityWeighted.winnerName;
      const priorityLines = (priorityWeighted.priorityScores || []).map(
        (ps: any) =>
          `- Priority "${formatPriorityName(ps.priority)}" (weight ${ps.weight}x): Winner = ${ps.winnerName} — ${ps.reason}`,
      );
      context.priority_analysis_data = priorityLines.join('\n');
    }
  }

  return context;
}

// ============================================================================
// Section Narrative Generation
// ============================================================================

/**
 * Generate AI narratives for all relevant report sections.
 *
 * Determines which sections to generate based on report type, builds prompt
 * templates with resolved conditionals, and delegates to ClaudeService for
 * actual AI generation.
 *
 * @param claudeService - ClaudeService instance for AI generation
 * @param logger - Logger instance for diagnostics
 * @param reportData - Assembled report data (current, historical, benchmarks, scores)
 * @param scores - Full score result with components
 * @param dto - Original generation request
 * @param newsContext - Optional formatted news string
 * @param sectionFilter - Optional list of specific section IDs to generate
 * @returns Record mapping section IDs to their generated narratives
 */
export async function generateSectionNarratives(
  claudeService: ClaudeService,
  logger: Logger,
  reportData: {
    current: Record<string, any>;
    historical: HistoricalData;
    benchmarks: Record<string, any>;
    scores: Record<string, any>;
    comparisons?: Record<string, any>;
  },
  scores: any,
  dto: GenerateReportDto,
  newsContext?: string,
  sectionFilter?: string[],
): Promise<Record<string, string | string[] | object>> {
  // 1. Build the context object from all available data
  const context = buildNarrativeContext(reportData, scores, dto, newsContext);

  // 2. Determine which sections to generate
  let sectionIds: string[];
  if (sectionFilter && sectionFilter.length > 0) {
    sectionIds = sectionFilter;
  } else {
    // Determine sections based on report type
    const isComparison =
      dto.comparison_geographies && dto.comparison_geographies.length > 0;
    const isInvestor = dto.user_type === 'investor';

    sectionIds = [];
    if (isInvestor) {
      sectionIds.push(...SECTIONS_BY_REPORT_TYPE.investoredge);
    } else {
      sectionIds.push(...SECTIONS_BY_REPORT_TYPE.homeready);
    }
    if (isComparison) {
      sectionIds.push(...SECTIONS_BY_REPORT_TYPE.comparison);
    }
  }

  // 3. Build NarrativeSection objects for ClaudeService
  //    Pre-process conditional blocks ({{#if}}...{{/if}}) before passing
  //    to ClaudeService, which only handles {{variable}} interpolation.
  const sections = sectionIds
    .filter((id) => NARRATIVE_PROMPTS[id]) // Only generate sections with defined prompts
    .map((id) => {
      const config = NARRATIVE_PROMPTS[id];
      const resolvedTemplate = resolveConditionalBlocks(
        config.prompt_template,
        context,
      );
      return {
        id,
        prompt_template: resolvedTemplate,
        max_tokens: config.max_tokens,
        output_format: config.output_format,
      };
    });

  logger.log(
    `Generating ${sections.length} section narratives for ${dto.primary_geography.name} (${dto.user_type})`,
  );

  // 4. Delegate to ClaudeService for actual generation
  // ClaudeService.generateNarratives handles interpolation, news enhancement,
  // JSON parsing, and fallbacks.
  const results = await claudeService.generateNarratives(sections, context);

  logger.log(
    `Generated ${Object.keys(results).length} section narratives successfully`,
  );

  return results;
}

// ============================================================================
// Narrative Regeneration
// ============================================================================

/**
 * Regenerate narratives after user personalization inputs change.
 *
 * Determines which narrative keys need regeneration based on which
 * inputs changed, updates the stored user_inputs, and returns the
 * keys that would be regenerated.
 *
 * @param supabaseClient - Supabase client for DB reads/writes
 * @param logger - Logger instance for diagnostics
 * @param reportId - ID of the report to update
 * @param userId - ID of the user who owns the report
 * @param userInputs - New user inputs to apply
 * @param userTier - Optional user tier for entitlement checks
 * @returns Updated keys list and current ai_narrative object
 */
export async function regenerateNarratives(
  supabaseClient: SupabaseClient,
  logger: Logger,
  reportId: string,
  userId: string,
  userInputs: Record<string, any>,
  userTier?: string,
): Promise<{ updated_keys: string[]; ai_narrative: Record<string, any> }> {
  // 1. Fetch the report to verify ownership
  const { data: report, error } = await supabaseClient
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .eq('user_id', userId)
    .single();

  if (error || !report) {
    throw new NotFoundException('Report not found');
  }

  // 2. Determine which narrative keys need regeneration based on changed inputs
  const existingInputs = report.user_inputs || {};
  const keysToRegenerate: string[] = [];

  // Income/down payment changed -> regenerate affordability narratives
  if (
    userInputs.income !== existingInputs.income ||
    userInputs.down_payment !== existingInputs.down_payment
  ) {
    keysToRegenerate.push(
      'affordability_narrative',
      'affordability_personalized',
    );
  }

  // Priorities changed -> regenerate priority narratives
  if (
    JSON.stringify(userInputs.priorities) !==
    JSON.stringify(existingInputs.priorities)
  ) {
    keysToRegenerate.push('priorities_narrative', 'priorities_personalized');
  }

  // Timeline changed
  if (userInputs.timeline !== existingInputs.timeline) {
    keysToRegenerate.push('market_timing_personalized');
  }

  // Investment strategy changed (investor)
  if (
    userInputs.investment_strategy !== existingInputs.investment_strategy
  ) {
    keysToRegenerate.push(
      'investment_thesis_narrative',
      'cash_flow_personalized',
    );
  }

  // Always regenerate bottom line when anything changes
  keysToRegenerate.push('bottom_line_narrative', 'bottom_line_actions');

  // 3. Update user_inputs on the report
  const { error: updateError } = await supabaseClient
    .from('reports')
    .update({ user_inputs: userInputs })
    .eq('id', reportId);

  if (updateError) {
    logger.error(`Failed to update user inputs: ${updateError.message}`);
  }

  // 4. For now, return the keys that would be regenerated
  // Full AI regeneration will be wired when the narrative service supports
  // selective regeneration
  const updatedNarrative = report.ai_narrative || {};

  return {
    updated_keys: keysToRegenerate,
    ai_narrative: updatedNarrative,
  };
}
