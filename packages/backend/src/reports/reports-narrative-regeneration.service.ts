/**
 * Reports Narrative Regeneration Service
 *
 * Thin NestJS DI wrapper around reports-narrative-regeneration.ts's
 * standalone function. Split out of ReportsService to keep it under
 * CLAUDE.md's 300-line hard limit (§1.3).
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { regenerateNarratives as regenerateNarrativesFn } from './reports-narrative-regeneration';

@Injectable()
export class ReportsNarrativeRegenerationService {
  private readonly logger = new Logger(
    ReportsNarrativeRegenerationService.name,
  );

  constructor(private readonly supabase: SupabaseService) {}

  async regenerateNarratives(
    reportId: string,
    userId: string,
    userInputs: Record<string, any>,
  ): Promise<{ updated_keys: string[]; ai_narrative: Record<string, any> }> {
    return regenerateNarrativesFn(
      this.supabase.getClient(),
      this.logger,
      reportId,
      userId,
      userInputs,
    );
  }
}
