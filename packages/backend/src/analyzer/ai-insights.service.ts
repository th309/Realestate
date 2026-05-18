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

export interface InsightPayload {
  input: any;
  result: any;
  rentcast: any;
  piq: any;
  /** Optional grading snapshot from analyzer-core. Required for the
   *  recommendation_analysis section; ignored elsewhere. */
  grading?: any;
}

/**
 * Convert an UPPER_SNAKE_CASE auto-kill code into a short human sentence the
 * prompt can plug in directly. Keeps the LLM from echoing the raw identifier.
 * Unknown codes fall back to a lowercased, underscore-replaced form so the
 * model has something to work with.
 */
function humanizeAutoKill(code: string): string {
  const map: Record<string, string> = {
    REFI_NOT_FINANCEABLE:
      "the refinance can't be financed at the projected ARV and LTV",
    NEGATIVE_CASHFLOW_SEVERE: 'monthly cashflow is deeply negative',
    DSCR_BELOW_FLOOR: 'debt service coverage is below lender minimums',
    LTV_TOO_HIGH: 'the loan-to-value exceeds policy limits',
    REHAB_BUDGET_BLOWN: 'the rehab budget consumes too much of the deal margin',
    ARV_BELOW_ALL_IN:
      'the after-repair value comes in below the all-in basis (you would lose money on resale)',
  };
  if (map[code]) return map[code];
  return code.toLowerCase().replace(/_/g, ' ');
}

export interface InsightResult extends CachedInsight {
  cacheHit: boolean;
}

const SYSTEM_PROMPT = [
  'You are a precise, numerate real-estate analyst speaking to the investor like a knowledgeable friend.',
  'Cite specific numbers from the data provided. Never invent figures. Keep numbers exact (do not round "$3,350" to "around $3K").',
  'Write conversational prose. No markdown formatting at all: no asterisks for bold, no underscores around words.',
  'No em-dashes. Use commas, periods, or the word "and" instead.',
  'When the data contains code-style identifiers (UPPER_SNAKE_CASE like REFI_NOT_FINANCEABLE, or camelCase field names like rentMonthly, interestRatePct), translate them into plain English. "REFI_NOT_FINANCEABLE" becomes "the refinance can\'t be financed". "rentMonthly" becomes "monthly rent". Never leave the identifier raw in the output.',
  'Length: follow the section task brief. Be tight.',
].join(' ');

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
      maxTokens: 200,
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

    return [
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
      'MARKET CONTEXT (PropertyIQ):',
      `- Geography: ${payload.piq?.geo_level ?? 'unknown'}${payload.piq?.geo_id ? ` (id=${payload.piq.geo_id})` : ''}`,
      `- PIQ Score: ${payload.piq?.piq_score?.value ?? 'n/a'} (${payload.piq?.piq_score?.label ?? ''}) — 50 = state average, higher = outperformance vs state`,
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
