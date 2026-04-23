import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

export interface FormatDefaultRow {
  format: string;
  display_name?: string;
  default_approval_mode?: string;
  default_tts_voice_id?: string | null;
  default_platforms?: string[];
}

export interface ContentPipelineSettings {
  strictness: string;
  paused: boolean;
  formatDefaults: FormatDefaultRow[];
}

/**
 * Holds content-pipeline runtime settings: gate strictness, format defaults,
 * and the pause flag. The paused flag is in-memory for P1 (module-scoped).
 * The orchestrator consults isPaused() before transitioning from 'queued'.
 */
@Injectable()
export class PipelineSettingsService {
  private paused = false;

  constructor(private readonly supabase: SupabaseService) {}

  async getSettings(): Promise<ContentPipelineSettings> {
    const client = this.supabase.getClient();
    const { data: formats } = await client
      .from('format_templates')
      .select('*')
      .order('format');
    return {
      strictness: process.env.CONTENT_PIPELINE_GATE_STRICTNESS ?? 'balanced',
      paused: this.paused,
      formatDefaults: (formats ?? []) as FormatDefaultRow[],
    };
  }

  async updateSettings(
    dto: UpdateSettingsDto,
  ): Promise<ContentPipelineSettings> {
    if (dto.strictness)
      process.env.CONTENT_PIPELINE_GATE_STRICTNESS = dto.strictness;
    return this.getSettings();
  }

  async updateFormatDefault(
    format: string,
    patch: { default_approval_mode?: string },
  ): Promise<FormatDefaultRow> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('format_templates')
      .update(patch)
      .eq('format', format)
      .select('*')
      .single();
    if (error || !data) {
      throw new Error(
        error?.message ?? `format_templates row not found for format=${format}`,
      );
    }
    return data as FormatDefaultRow;
  }

  async pause(): Promise<{ paused: boolean }> {
    this.paused = true;
    return { paused: true };
  }

  async resume(): Promise<{ paused: boolean }> {
    this.paused = false;
    return { paused: false };
  }

  isPaused(): boolean {
    return this.paused;
  }
}
