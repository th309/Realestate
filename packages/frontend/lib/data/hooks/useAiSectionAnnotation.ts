/**
 * useAiSectionAnnotation — per-section AI insight, cached 24h.
 *
 * Query key includes a hash of the payload so identical payloads hit cache.
 * `enabled=false` on initial render to avoid a flood of insight calls before
 * the user has any data; consumers opt in once their section is on screen.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchAiInsight,
  type AiInsightPayload,
  type AnalyzerSectionId,
  type AIAnnotationResult,
} from "../fetchers/ai-insights";

/**
 * @param cacheKeyExtra Optional extra discriminator appended to the queryKey.
 *  The serialized payload is truncated to 200 chars to keep the queryKey small,
 *  so changes to deeply nested fields (e.g. the `piq` slice, which serializes
 *  last) can collide across calls. Sections that vary by such a field should
 *  pass a discriminator (e.g. `"metro:35620"`) so React Query treats each
 *  variation as a distinct query.
 */
export function useAiSectionAnnotation(
  payload: AiInsightPayload,
  sectionId: AnalyzerSectionId,
  enabled = true,
  cacheKeyExtra?: string,
) {
  return useQuery<AIAnnotationResult, Error>({
    queryKey: [
      "ai-insight",
      sectionId,
      JSON.stringify(payload).slice(0, 200),
      cacheKeyExtra ?? "",
    ],
    queryFn: () => fetchAiInsight({ id: sectionId, payload }),
    enabled,
    staleTime: 1000 * 60 * 60 * 24, // 24h matches backend cache TTL
  });
}
