/**
 * SEO Revalidation Service
 *
 * Daily cron (08:00 UTC) that detects when a new PropertyIQ score period has
 * landed in the DB and pings the Next.js frontend to revalidate its static
 * market pages.  The state singleton (seo_revalidation_state, id=1) is written
 * only on a successful 2xx response so the cron is fully idempotent.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

@Injectable()
export class SeoRevalidationService {
  private readonly logger = new Logger(SeoRevalidationService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 8 * * *')
  async checkAndRevalidate(): Promise<void> {
    try {
      // 1. Find the newest score_date in propertyiq_scores.
      const { data: latestRow, error: latestError } = await this.supabase
        .from('propertyiq_scores')
        .select('score_date')
        .eq('score_type', 'propertyiq')
        .order('score_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) {
        this.logger.error(
          `Failed to query latest score_date: ${latestError.message}`,
        );
        return;
      }

      if (!latestRow) {
        this.logger.warn('No propertyiq scores found — skipping revalidation');
        return;
      }

      const latest: string = latestRow.score_date;

      // 2. Load the last date we successfully pushed to the frontend.
      const { data: stateRow, error: stateError } = await this.supabase
        .from('seo_revalidation_state')
        .select('last_score_date')
        .eq('id', 1)
        .maybeSingle();

      if (stateError) {
        this.logger.error(
          `Failed to query seo_revalidation_state: ${stateError.message}`,
        );
        return;
      }

      const lastPushed: string | null = stateRow?.last_score_date ?? null;

      // 3. Nothing new — nothing to do.
      if (latest === lastPushed) {
        this.logger.log(
          `SEO revalidation already current (score_date=${latest})`,
        );
        return;
      }

      // 4. Missing config → bail without crashing.
      const frontendUrl = this.config.get<string>('FRONTEND_URL');
      const revalidateSecret = this.config.get<string>('REVALIDATE_SECRET');

      if (!frontendUrl || !revalidateSecret) {
        this.logger.warn(
          'FRONTEND_URL or REVALIDATE_SECRET not configured — skipping revalidation ping',
        );
        return;
      }

      // 5. Ping the frontend revalidation endpoint.
      const url = `${frontendUrl}/api/revalidate-markets`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'x-revalidate-secret': revalidateSecret },
      });

      if (!response.ok) {
        this.logger.error(
          `Revalidation ping failed: ${response.status} ${response.statusText} (url=${url})`,
        );
        return;
      }

      // 6. Record the pushed date so subsequent runs are no-ops.
      const { error: upsertError } = await this.supabase
        .from('seo_revalidation_state')
        .upsert(
          {
            id: 1,
            last_score_date: latest,
            revalidated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        );

      if (upsertError) {
        this.logger.error(
          `Failed to upsert seo_revalidation_state: ${upsertError.message}`,
        );
        return;
      }

      this.logger.log(`SEO market pages revalidated for score_date=${latest}`);
    } catch (err) {
      this.logger.error(
        `Unexpected error in checkAndRevalidate: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
