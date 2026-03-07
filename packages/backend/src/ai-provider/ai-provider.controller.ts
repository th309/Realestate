/**
 * AI Provider Admin Controller
 *
 * Admin-only endpoints for managing AI model configurations.
 * Allows listing, viewing presets, and updating model configs
 * stored in the `ai_model_config` database table.
 */

import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
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

  /** Update a model config row identified by its purpose key. */
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
