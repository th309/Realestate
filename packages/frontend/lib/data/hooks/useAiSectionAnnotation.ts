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

export function useAiSectionAnnotation(
  payload: AiInsightPayload,
  sectionId: AnalyzerSectionId,
  enabled = true,
) {
  return useQuery<AIAnnotationResult, Error>({
    queryKey: ["ai-insight", sectionId, JSON.stringify(payload).slice(0, 200)],
    queryFn: () => fetchAiInsight({ id: sectionId, payload }),
    enabled,
    staleTime: 1000 * 60 * 60 * 24, // 24h matches backend cache TTL
  });
}
