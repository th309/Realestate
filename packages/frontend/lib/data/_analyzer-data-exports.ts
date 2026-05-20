/**
 * Analyzer-specific data layer exports (grading, upgrade-path, AI insights,
 * property lookup). Extracted out of `index.ts` per CLAUDE.md §1.3 to keep
 * the unified barrel under the 300-line logic-file cap.
 *
 * Re-exported wholesale from `lib/data/index.ts` so consumer import paths
 * (`@/lib/data`) are unchanged.
 */
// Property lookup + AI insights
export {
  fetchPropertyLookup,
  type PropertyLookupResult,
  type RentcastPropertyRecord,
  type RentcastComp,
  type RentcastTaxAssessment,
  type RentcastPropertyTax,
  type RentcastSaleEvent,
} from "./fetchers/property-lookup";
export {
  fetchAiInsight,
  fetchBatchedAiInsights,
  type AIAnnotationResult,
  type AIAnnotationBatch,
  type AiInsightPayload,
  type AnalyzerSectionId,
  type BatchedAnalyzerSectionId,
} from "./fetchers/ai-insights";
export { streamAiHeaderInsight } from "./fetchers/ai-insights-stream";

// B&H grading
export { fetchGradeDeal, type GradeDealRequest } from "./fetchers/grading";
export {
  fetchUpgradePath,
  type UpgradePathRequest,
} from "./fetchers/upgrade-path";
export { useGradeDeal, type UseGradeDealOptions } from "./hooks/useGradeDeal";
export {
  useUpgradePath,
  type UseUpgradePathOptions,
} from "./hooks/useUpgradePath";

// F&F grading
export {
  useGradeFlipDeal,
  type UseGradeFlipDealOptions,
} from "./hooks/useGradeFlipDeal";
export { fetchGradeFlipDeal } from "./fetchers/grade-flip";
export type { FixAndFlipGradeRequest } from "./fetchers/grade-flip";
export { useUpgradePathFlip } from "./hooks/useUpgradePathFlip";
export type { UpgradePathFlipRequest } from "./fetchers/upgrade-path-flip";

// BRRRR grading
export {
  useGradeBrrrrDeal,
  type UseGradeBrrrrDealOptions,
} from "./hooks/useGradeBrrrrDeal";
export { fetchGradeBrrrrDeal } from "./fetchers/grade-brrrr";
export type { BrrrrGradeRequest } from "./fetchers/grade-brrrr";
export { useUpgradePathBrrrr } from "./hooks/useUpgradePathBrrrr";
export type { UpgradePathBrrrrRequest } from "./fetchers/upgrade-path-brrrr";

// Threshold + defaults CRUD
export {
  fetchThresholds,
  updateThresholds,
  deleteThresholds,
} from "./fetchers/thresholds";
export {
  fetchAnalyzerDefaults,
  updateAnalyzerDefaults,
  type AnalyzerDefaults,
} from "./fetchers/analyzer-defaults";

// Misc analyzer hooks
export { usePropertyLookup } from "./hooks/usePropertyLookup";
export { useAiSectionAnnotation } from "./hooks/useAiSectionAnnotation";
export { useAiHeaderVerdict } from "./hooks/useAiHeaderVerdict";
export { useMarketContext } from "./hooks/useMarketContext";
export type {
  UseMarketContextOptions,
  UseMarketContextResult,
} from "./hooks/useMarketContext";
