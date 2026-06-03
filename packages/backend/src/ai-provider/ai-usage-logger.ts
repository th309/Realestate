/**
 * AI Usage Logger
 *
 * Fire-and-forget logging of AI completion usage to `ai_usage_log` table.
 * Calculates estimated cost from MODEL_PRICING constants.
 * Used for model evaluation and cost tracking.
 */

import { Logger } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { estimateCostUsd } from './cost-estimator';

export interface UsageLogEntry {
  purpose: string;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  testRunId?: string;
  reportId?: string;
  sectionId?: string;
}

const logger = new Logger('AiUsageLogger');

/**
 * Log a usage entry to the ai_usage_log table. Fire-and-forget — errors
 * are logged but never thrown to avoid disrupting the AI completion flow.
 */
export function logUsage(
  supabase: SupabaseService,
  entry: UsageLogEntry,
): void {
  const cost = estimateCostUsd(
    entry.model,
    entry.promptTokens,
    entry.completionTokens,
  );

  supabase
    .getClient()
    .from('ai_usage_log')
    .insert({
      test_run_id: entry.testRunId || null,
      purpose: entry.purpose,
      provider: entry.provider,
      model: entry.model,
      prompt_tokens: entry.promptTokens ?? null,
      completion_tokens: entry.completionTokens ?? null,
      total_tokens: entry.totalTokens ?? null,
      estimated_cost_usd: cost,
      duration_ms: entry.durationMs,
      report_id: entry.reportId || null,
      section_id: entry.sectionId || null,
      success: entry.success,
      error_message: entry.errorMessage || null,
    })
    .then(({ error }) => {
      if (error) {
        logger.warn(`Failed to log AI usage: ${error.message}`);
      }
    });
}
