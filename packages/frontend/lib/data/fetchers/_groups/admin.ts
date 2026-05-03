/**
 * ADMIN FETCHERS
 *
 * AI model configuration and admin analytics.
 */

// AI model configuration (admin)
export {
  fetchAiModelConfigs,
  updateAiModelConfig,
  fetchProviderPresets,
  type AiModelConfig,
} from "../ai-models";

// Admin analytics
export * from "../admin-analytics";
export type * from "../admin-analytics.types";
