/**
 * Request bodies for the analyzer AI-insights endpoints.
 *
 * Both endpoints accept the same shape under `payload` — the analyzer's
 * deterministic input + result + RentCast slice + PropertyIQ slice. The
 * section endpoint additionally requires the `id` of the section being
 * annotated so the right prompt template is selected and the cache key
 * is namespaced per section.
 *
 * `payload` is intentionally an opaque `IsObject` — the payload schema is
 * owned by the frontend analyzer state machine and the AI-insights service
 * only reads it positionally; tightening it here would couple this DTO to
 * the analyzer's evolving result snapshot.
 */
import { IsString, IsObject, IsIn } from 'class-validator';
import type { BatchedSectionId, SectionId } from '../prompts/section-prompts';

export class AiInsightsBodyDto {
  @IsObject()
  payload!: {
    input: any;
    result: any;
    rentcast: any;
    piq: any;
    /** Optional grading snapshot from analyzer-core (letter/label/metrics/
     *  autoKills/advisories). The `recommendation_analysis` section needs
     *  this; other sections ignore it. */
    grading?: any;
    /** Active strategy ('BUY_AND_HOLD' | 'FIX_AND_FLIP' | 'BRRRR'). Drives
     *  the strategy-aware guidance block so the AI talks in the right terms
     *  for the user's chosen play. Optional; null falls back to generic. */
    strategy?: 'BUY_AND_HOLD' | 'FIX_AND_FLIP' | 'BRRRR' | null;
    /** PIQ scores at metro / county / zip for this property. Surfaced to
     *  the AI with stability annotations so it leads with the most stable
     *  available level. Levels that didn't resolve are simply omitted. */
    piqByGeo?: {
      zip?: number | null;
      county?: number | null;
      metro?: number | null;
    };
    /** Investor goal for the "Help me decide" recommender. Optional —
     *  focused-mode and saved/shared routes leave this null. */
    goal?:
      | 'cash_flow'
      | 'long_term_wealth'
      | 'fast_cash'
      | 'recycle_capital'
      | null;
  };
}

export class AiInsightsSectionBodyDto extends AiInsightsBodyDto {
  @IsString()
  @IsIn([
    'recommendation_analysis',
    'projection',
    'expense_waterfall',
    'sensitivity',
    'comps',
    'market_context',
    'after_tax',
  ])
  id!: Exclude<SectionId, 'header_verdict'>;
}

export interface AIAnnotationDto {
  text: string;
  threadId: string;
  citedFacts: string[];
  cacheHit: boolean;
}

/** Response shape for the batched endpoint — one annotation per non-header,
 *  non-market-context section, all from a single LLM call. */
export type AIAnnotationBatchDto = Record<BatchedSectionId, AIAnnotationDto>;
