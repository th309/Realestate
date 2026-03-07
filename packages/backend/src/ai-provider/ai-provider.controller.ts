/**
 * AI Provider Admin Controller
 *
 * Admin-only endpoints for managing AI model configurations.
 * Allows listing, viewing presets, and updating model configs
 * stored in the `ai_model_config` database table.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import { AiProviderService } from './ai-provider.service';
import { UpdateModelConfigDto } from './ai-provider.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { PROVIDER_PRESETS } from './ai-provider.types';

@Controller('api/admin/ai-models')
@UseGuards(AdminGuard)
export class AiProviderController {
  constructor(
    private readonly aiProvider: AiProviderService,
    private readonly supabase: SupabaseService,
  ) {}

  /** List all AI model configurations, ordered by purpose. */
  @Get()
  async listConfigs() {
    const { data, error } = await this.supabase
      .getClient()
      .from('ai_model_config')
      .select('*')
      .order('purpose');

    if (error) throw error;
    return data;
  }

  /** Return static provider presets (base URLs, default models, etc.). */
  @Get('presets')
  getProviderPresets() {
    return PROVIDER_PRESETS;
  }

  /** Get the active test run ID for usage logging. */
  @Get('test-run-id')
  getTestRunId() {
    return { testRunId: this.aiProvider.getTestRunId() };
  }

  /** Set or clear the active test run ID for usage logging. */
  @Put('test-run-id')
  setTestRunId(@Body() body: { testRunId: string | null }) {
    this.aiProvider.setTestRunId(body.testRunId || null);
    return { testRunId: this.aiProvider.getTestRunId() };
  }

  /** Aggregated usage log summary grouped by test_run_id. */
  @Get('usage-summary')
  async getUsageSummary() {
    const { data, error } = await this.supabase
      .getClient()
      .from('ai_usage_log')
      .select('*')
      .not('test_run_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Aggregate in-memory (Supabase doesn't support GROUP BY via PostgREST)
    const grouped = new Map<string, any>();
    for (const row of data || []) {
      const key = row.test_run_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          test_run_id: key,
          model: row.model,
          provider: row.provider,
          total_calls: 0,
          successful_calls: 0,
          total_cost_usd: 0,
          total_duration_ms: 0,
          total_prompt_tokens: 0,
          total_completion_tokens: 0,
          total_tokens: 0,
          first_call: row.created_at,
        });
      }
      const g = grouped.get(key);
      g.total_calls++;
      if (row.success) g.successful_calls++;
      g.total_cost_usd += parseFloat(row.estimated_cost_usd || '0');
      g.total_duration_ms += row.duration_ms || 0;
      g.total_prompt_tokens += row.prompt_tokens || 0;
      g.total_completion_tokens += row.completion_tokens || 0;
      g.total_tokens += row.total_tokens || 0;
    }

    return Array.from(grouped.values()).map((g) => ({
      ...g,
      total_cost_usd: Math.round(g.total_cost_usd * 10000) / 10000,
      avg_duration_ms: Math.round(g.total_duration_ms / g.total_calls),
    }));
  }

  /** List all evaluation scores. */
  @Get('evaluation-scores')
  async listEvaluationScores() {
    const { data, error } = await this.supabase
      .getClient()
      .from('ai_model_evaluation_scores')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /** Upsert an evaluation score for a test run. */
  @Post('evaluation-scores')
  async upsertEvaluationScore(
    @Body()
    body: {
      test_run_id: string;
      model: string;
      provider: string;
      report_type?: string;
      geography?: string;
      depth_score?: number;
      accuracy_score?: number;
      writing_score?: number;
      actionability_score?: number;
      notes?: string;
      report_id?: string;
    },
  ) {
    const { data, error } = await this.supabase
      .getClient()
      .from('ai_model_evaluation_scores')
      .upsert(body, { onConflict: 'test_run_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /** Delete an evaluation score. */
  @Delete('evaluation-scores/:testRunId')
  async deleteEvaluationScore(@Param('testRunId') testRunId: string) {
    const { error } = await this.supabase
      .getClient()
      .from('ai_model_evaluation_scores')
      .delete()
      .eq('test_run_id', testRunId);

    if (error) throw error;
    return { deleted: true };
  }

  /** Clear all usage logs and evaluation scores (for rerunning tests fresh). */
  @Delete('test-data')
  async clearTestData() {
    const [usageResult, scoresResult] = await Promise.all([
      this.supabase
        .getClient()
        .from('ai_usage_log')
        .delete()
        .not('test_run_id', 'is', null),
      this.supabase
        .getClient()
        .from('ai_model_evaluation_scores')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000'),
    ]);

    if (usageResult.error) throw usageResult.error;
    if (scoresResult.error) throw scoresResult.error;

    return { cleared: true };
  }

  /** Update a model config row identified by its purpose key. Must be LAST (catches :purpose). */
  @Patch(':purpose')
  async updateConfig(
    @Param('purpose') purpose: string,
    @Body() dto: UpdateModelConfigDto,
  ) {
    const { data, error } = await this.supabase
      .getClient()
      .from('ai_model_config')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('purpose', purpose)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cached config so next generation uses new settings
    this.aiProvider.invalidateCache(purpose);
    return data;
  }
}
