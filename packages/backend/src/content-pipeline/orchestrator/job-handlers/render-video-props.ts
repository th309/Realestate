// packages/backend/src/content-pipeline/orchestrator/job-handlers/render-video-props.ts
import { buildLongFormRenderPlan } from '../../render/long-form-render-plan';

/**
 * Props handed to the Remotion composition.
 *
 * Ranking formats (top_10_ranking / bottom_10_ranking) have no single resolved
 * market — they carry the N-market list on `params`, which Top10Layout reads.
 * Non-ranking formats keep the `resolvedMarket` + `dataBundle` shape that
 * GradeReveal/ScoreMover/etc. expect. fetch-data.handler already wrote the
 * ranking bundle into mcp_payload.metadata, so for ranking we forward it as
 * `params`.
 */
export function buildRenderVideoProps(opts: {
  format: string;
  isRanking: boolean;
  resolvedGeo: unknown;
  payloadMetadata: unknown;
  audioUrl: string;
  captionWords:
    | Array<{ startMs: number; endMs: number; word: string }>
    | undefined;
  longFormRenderPlan: ReturnType<typeof buildLongFormRenderPlan> | null;
}): Record<string, unknown> {
  const {
    format,
    isRanking,
    resolvedGeo,
    payloadMetadata,
    audioUrl,
    captionWords,
    longFormRenderPlan,
  } = opts;

  const captionProps =
    captionWords && captionWords.length > 0 ? { captionWords } : {};

  if (isRanking) {
    return {
      format,
      params: payloadMetadata,
      dataBundle: payloadMetadata,
      ctaUrl: '',
      audioUrl,
      ...captionProps,
    };
  }

  return {
    format,
    resolvedMarket: resolvedGeo,
    dataBundle: payloadMetadata,
    ctaUrl: '',
    audioUrl,
    ...captionProps,
    ...(longFormRenderPlan ? { longFormRenderPlan } : {}),
  };
}
