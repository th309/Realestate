/**
 * assemblePrompt — builds the deal-context block that every section task is
 * appended to. Extracted from AiInsightsService so the service stays under the
 * 300-line hard cap and so the batched and per-section call paths share one
 * source of truth for context construction.
 */

import {
  STRATEGY_DISPLAY,
  STRATEGY_KEY_METRICS,
  STRATEGY_LEVERS,
  type AnalysisStrategy,
} from './strategy-context';
import { humanizeAutoKill } from './auto-kill-humanize';
import { buildPiqByGeoBlock } from './piq-by-geo-block';

export interface AssemblePromptPayload {
  input: any;
  result: any;
  rentcast: any;
  piq: any;
  grading?: any;
  strategy?: AnalysisStrategy | null;
  piqByGeo?: {
    zip?: number | null;
    county?: number | null;
    metro?: number | null;
  };
  goal?:
    | 'cash_flow'
    | 'long_term_wealth'
    | 'fast_cash'
    | 'recycle_capital'
    | null;
}

const GOAL_LABELS: Record<string, string> = {
  cash_flow: 'Maximize monthly cash flow',
  long_term_wealth: 'Maximize long-term (30-year) wealth',
  fast_cash: 'Maximize fast cash within 12 months',
  recycle_capital: 'Recycle capital into the next deal as fast as possible',
};

function humanizeGoal(goal: string): string {
  return GOAL_LABELS[goal] ?? goal;
}

/**
 * Build the full prompt: shared deal context + a trailing `task` block. The
 * caller supplies the task text — either a single section prompt (legacy
 * per-section path) or the batched SECTION TASKS block.
 */
export function assemblePrompt(
  payload: AssemblePromptPayload,
  task: string,
): string {
  const comps = (payload.rentcast?.sales_comps ?? []).slice(0, 6);
  const rentComps = (payload.rentcast?.rental_comps ?? []).slice(0, 6);

  const subjectPrice = payload.input?.price ?? null;
  const subjectSqft = payload.rentcast?.property_record?.sqft ?? null;
  const subjectPpsf =
    subjectPrice && subjectSqft && subjectSqft > 0
      ? Math.round(subjectPrice / subjectSqft)
      : null;
  const subjectRent = payload.input?.rentMonthly ?? null;
  const rentEstimate = payload.rentcast?.rent?.value ?? null;

  const grading = payload.grading;
  const autoKillsHumanized: string[] = Array.isArray(grading?.autoKills)
    ? grading.autoKills.map((k: any) =>
        humanizeAutoKill(typeof k === 'string' ? k : (k?.code ?? '')),
      )
    : [];
  const metricsSorted: any[] = Array.isArray(grading?.metrics)
    ? [...grading.metrics].sort((a: any, b: any) => {
        const av = typeof a?.gpa === 'number' ? a.gpa : 99;
        const bv = typeof b?.gpa === 'number' ? b.gpa : 99;
        return av - bv;
      })
    : [];
  const worstMetrics = metricsSorted.slice(0, 2);
  const bestMetric = metricsSorted[metricsSorted.length - 1];

  const strategy = payload.strategy ?? null;

  return [
    ...(strategy
      ? [
          'STRATEGY:',
          `- Mode: ${STRATEGY_DISPLAY[strategy]}`,
          `- Metrics that matter for this strategy: ${STRATEGY_KEY_METRICS[strategy]}`,
          `- Levers an investor can pull to improve this strategy: ${STRATEGY_LEVERS[strategy]}`,
          '',
        ]
      : []),
    'DEAL INPUT:',
    JSON.stringify(payload.input, null, 2),
    '',
    'COMPUTED METRICS (analyzer-core, deterministic):',
    JSON.stringify(payload.result, null, 2),
    '',
    ...(grading
      ? [
          'DEAL GRADING:',
          `- Letter: ${grading.letter ?? 'n/a'} (${grading.label ?? ''})`,
          `- GPA: raw ${grading.rawGpa ?? 'n/a'}, market adj ${grading.marketAdjustment ?? 'n/a'}, final ${grading.finalGpa ?? 'n/a'}${grading.flooredAt ? `, floored at ${grading.flooredAt}` : ''}`,
          `- Auto-disqualifications (already humanized; cite these in plain English): ${autoKillsHumanized.length > 0 ? autoKillsHumanized.join('; ') : 'none'}`,
          `- Worst metrics: ${
            worstMetrics
              .map(
                (m: any) =>
                  `${m?.label ?? m?.id ?? 'metric'} = ${m?.formattedValue ?? m?.value ?? 'n/a'} (grade ${m?.letter ?? '?'})`,
              )
              .join('; ') || 'n/a'
          }`,
          `- Best metric: ${bestMetric ? `${bestMetric.label ?? bestMetric.id ?? 'metric'} = ${bestMetric.formattedValue ?? bestMetric.value ?? 'n/a'} (grade ${bestMetric.letter ?? '?'})` : 'n/a'}`,
          '',
        ]
      : []),
    'SUBJECT PROPERTY:',
    `- Sqft: ${subjectSqft ?? 'unavailable'}`,
    `- Price per sqft: ${subjectPpsf != null ? `$${subjectPpsf}` : 'unavailable'}`,
    `- Underwritten monthly rent: ${subjectRent != null ? `$${subjectRent}` : 'unavailable'}`,
    `- RentCast rent estimate: ${rentEstimate != null ? `$${rentEstimate}` : 'unavailable'}`,
    '',
    'PROPERTY DATA (RentCast):',
    `- AVM: ${payload.rentcast?.avm?.value ?? 'unavailable'}`,
    `- Top sales comps (${comps.length}): ${comps
      .map((c: any) => {
        const ppsf =
          c.price && c.sqft && c.sqft > 0 ? Math.round(c.price / c.sqft) : null;
        const sqftPart = c.sqft ? `/${c.sqft}sqft` : '';
        const ppsfPart = ppsf != null ? ` ($${ppsf}/sqft)` : '';
        return `${c.address} $${c.price}${sqftPart}${ppsfPart} (${c.distance}mi)`;
      })
      .join('; ')}`,
    `- Top rental comps (${rentComps.length}): ${rentComps
      .map((c: any) => {
        const physParts: string[] = [];
        if (c.beds != null) physParts.push(`${c.beds}bd`);
        if (c.baths != null) physParts.push(`${c.baths}ba`);
        if (c.sqft != null) physParts.push(`${c.sqft}sqft`);
        const physPart = physParts.length ? ` (${physParts.join('/')})` : '';
        const distPart = c.distance != null ? ` (${c.distance}mi)` : '';
        return `${c.address} $${c.rent}/mo${physPart}${distPart}`;
      })
      .join('; ')}`,
    '',
    ...buildPiqByGeoBlock(payload.piqByGeo),
    'MARKET CONTEXT (PropertyIQ):',
    `- Geography resolved to: ${payload.piq?.geo_level ?? 'unknown'}${payload.piq?.geo_id ? ` (id=${payload.piq.geo_id})` : ''}`,
    `- Area typical-home value INDEX (Zillow ZHVI for the entire ${payload.piq?.geo_level ?? 'area'} — a smoothed benchmark for a typical home, NOT an appraisal of this specific property; do NOT treat the subject's price being above or below it as evidence of over/under-pricing): ${payload.piq?.home_value?.value ?? 'n/a'} (source: ${payload.piq?.home_value?.source ?? 'n/a'})`,
    `- Price appreciation YoY: ${payload.piq?.home_value_yoy?.value != null ? `${payload.piq.home_value_yoy.value}%` : 'n/a'} (source: ${payload.piq?.home_value_yoy?.source ?? 'n/a'})`,
    `- Rent index: ${payload.piq?.rent_index?.value ?? 'n/a'} (source: ${payload.piq?.rent_index?.source ?? 'n/a'})`,
    `- Market heat: ${payload.piq?.market_heat?.value ?? 'n/a'} (source: ${payload.piq?.market_heat?.source ?? 'n/a'})`,
    `- Net migration: ${payload.piq?.net_migration?.value ?? 'n/a'} (source: ${payload.piq?.net_migration?.source ?? 'n/a'})`,
    '',
    ...(payload.goal
      ? [
          'USER GOAL:',
          `- The user picked "${humanizeGoal(payload.goal)}" as their goal for this deal.`,
          '',
        ]
      : []),
    'TASK:',
    task,
  ].join('\n');
}
