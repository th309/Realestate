/**
 * AiInsightsService — generates AI insights for analyzer sections.
 *
 * - Composite cache key from deterministic input + provider responses (24h TTL)
 * - Resolves model purpose: header_verdict → analyzer_header_verdict,
 *   else → analyzer_section_annotation
 * - Streams header verdict via async generator
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AiInsightsCache, CachedInsight } from './ai-insights.cache';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { getSectionPrompt, SectionId } from './prompts/section-prompts';
import {
  type AnalysisStrategy,
  STRATEGY_DISPLAY,
  STRATEGY_KEY_METRICS,
  STRATEGY_LEVERS,
} from './prompts/strategy-context';
import { humanizeAutoKill } from './prompts/auto-kill-humanize';
import { buildPiqByGeoBlock } from './prompts/piq-by-geo-block';

export type { AnalysisStrategy };

export interface InsightPayload {
  input: any;
  result: any;
  rentcast: any;
  piq: any;
  /** Optional grading snapshot from analyzer-core. Required for the
   *  recommendation_analysis section; ignored elsewhere. */
  grading?: any;
  /** Active strategy the user is analyzing under. Drives the strategy-aware
   *  guidance block in `assemblePrompt` so the AI talks in the right terms
   *  (cashflow + DSCR for B&H, ARV minus all-in cost for F&F, refinance
   *  outcome for BRRRR). Optional so older callers keep working — null falls
   *  back to generic guidance. */
  strategy?: AnalysisStrategy | null;
  /** PIQ scores at all three geography levels for this property. Whichever
   *  levels resolved are surfaced to the AI with stability annotations so
   *  it leads with metro (most stable, thousands of sales) and only calls
   *  out the ZIP score when it diverges sharply (the interesting micro-
   *  market signal). Rural or unincorporated addresses naturally fall
   *  through — only levels with actual data are surfaced. */
  piqByGeo?: {
    zip?: number | null;
    county?: number | null;
    metro?: number | null;
  };
}

export interface InsightResult extends CachedInsight {
  cacheHit: boolean;
}

const SYSTEM_PROMPT = [
  'You are a precise, numerate real-estate analyst speaking to the investor like a knowledgeable friend.',
  'Cite specific numbers from the data provided. Never invent figures.',
  'Money: always whole dollars, no cents. Write "$1,068" not "$1,068.49". Write "$552,800" not "$552,800.00". Round to the nearest dollar before writing.',
  'Other numbers (ratios, percents, days, scores) keep their natural precision. "0.71 DSCR" stays "0.71".',
  'Write conversational prose. No markdown formatting at all: no asterisks for bold, no underscores around words.',
  'No em-dashes. Use commas, periods, or the word "and" instead.',
  'When the data contains code-style identifiers (UPPER_SNAKE_CASE like REFI_NOT_FINANCEABLE, or camelCase field names like rentMonthly, interestRatePct), translate them into plain English. "REFI_NOT_FINANCEABLE" becomes "the refinance can\'t be financed". "rentMonthly" becomes "monthly rent". Never leave the identifier raw in the output.',
  'CRITICAL: never leave a thought unfinished. Every sentence you write must end with a period and a complete idea. If you are running low on space, stop at the previous complete sentence rather than starting one you can\'t finish. Never end with "$" or any other dangling fragment.',
  'Length: follow the section task brief. Be tight.',
].join(' ');

/**
 * Per-section token budget. Most sections need 1-2 sentences and 200 tokens
 * is plenty. The recommendation_analysis section is the centerpiece of the
 * grade card and asks for 3-5 sentences with concrete numbers, so it gets a
 * larger budget to avoid mid-thought truncation. Header verdict is also a
 * single sentence at most.
 */
function maxTokensForSection(sectionId: SectionId): number {
  if (sectionId === 'recommendation_analysis') return 450;
  return 200;
}

@Injectable()
export class AiInsightsService {
  constructor(
    private readonly cache: AiInsightsCache,
    private readonly provider: AiProviderService,
  ) {}

  async complete(
    payload: InsightPayload,
    sectionId: SectionId,
  ): Promise<InsightResult> {
    const key = this.cache.computeKey(payload, sectionId);
    const cached = await this.cache.get(key);
    if (cached) return { ...cached, cacheHit: true };

    const userPrompt = this.assemblePrompt(payload, sectionId);
    const purpose =
      sectionId === 'header_verdict'
        ? 'analyzer_header_verdict'
        : 'analyzer_section_annotation';

    const response = await this.provider.complete(purpose, {
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: maxTokensForSection(sectionId),
    });

    const result: CachedInsight = {
      text: response.content ?? '',
      threadId: randomUUID(),
      citedFacts: [],
    };
    await this.cache.set(key, result);
    return { ...result, cacheHit: false };
  }

  async *stream(payload: InsightPayload): AsyncGenerator<string> {
    const userPrompt = this.assemblePrompt(payload, 'header_verdict');
    yield* this.provider.stream('analyzer_header_verdict', {
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 200,
    });
  }

  private assemblePrompt(
    payload: InsightPayload,
    sectionId: SectionId,
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
    // Rank metrics so the prompt can name the worst one(s) and the best one
    // without dumping the whole table.
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
            c.price && c.sqft && c.sqft > 0
              ? Math.round(c.price / c.sqft)
              : null;
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
      `- Home value: ${payload.piq?.home_value?.value ?? 'n/a'} (source: ${payload.piq?.home_value?.source ?? 'n/a'})`,
      `- Price appreciation YoY: ${payload.piq?.home_value_yoy?.value != null ? `${payload.piq.home_value_yoy.value}%` : 'n/a'} (source: ${payload.piq?.home_value_yoy?.source ?? 'n/a'})`,
      `- Rent index: ${payload.piq?.rent_index?.value ?? 'n/a'} (source: ${payload.piq?.rent_index?.source ?? 'n/a'})`,
      `- Market heat: ${payload.piq?.market_heat?.value ?? 'n/a'} (source: ${payload.piq?.market_heat?.source ?? 'n/a'})`,
      `- Net migration: ${payload.piq?.net_migration?.value ?? 'n/a'} (source: ${payload.piq?.net_migration?.source ?? 'n/a'})`,
      '',
      'TASK:',
      getSectionPrompt(sectionId),
    ].join('\n');
  }
}
