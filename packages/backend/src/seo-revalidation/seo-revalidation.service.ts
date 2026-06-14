/**
 * SEO Revalidation Service
 *
 * Two triggers keep the Next.js static market pages fresh:
 *
 * 1. Daily cron (08:00 UTC) — detects when a new PropertyIQ score period has
 *    landed in the DB and pings the frontend to revalidate. The state singleton
 *    (seo_revalidation_state, id=1) is written only on a successful 2xx response
 *    so the cron is fully idempotent.
 *
 * 2. Post-deploy boot — the market pages are SSG/ISR, so they bake their data at
 *    BUILD time. A frontend build that overlaps a backend redeploy can prerender
 *    empty pages (build-time fetches hit a backend that is mid-cutover). On boot
 *    we therefore fire a few spaced, unconditional revalidations so those stale
 *    prerenders regenerate against the now-live backend. The frontend deploys on
 *    a separate (usually slower) Railway pipeline, so we retry across a window to
 *    land at least one ping after its new container is serving. Revalidation is
 *    idempotent, so extra pings are harmless.
 */

import {
  Injectable,
  Inject,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

// Spaced attempts (ms after boot) to outlast the frontend's separate deploy
// pipeline. The first likely hits the old container; a later one lands after the
// new frontend is live.
const POST_DEPLOY_ATTEMPTS_MS = [120_000, 300_000, 600_000];

@Injectable()
export class SeoRevalidationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeoRevalidationService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    // Only the cron-owner instance pings (matches the @Cron RUN_CRONS gate), so
    // we don't fan out duplicate pings from every backend replica.
    if (this.config.get<string>('RUN_CRONS') !== 'true') return;

    for (const delay of POST_DEPLOY_ATTEMPTS_MS) {
      const timer = setTimeout(() => {
        void this.pingRevalidate(`post-deploy refresh (+${delay / 1000}s)`);
      }, delay);
      // Don't let these best-effort timers keep the process alive on shutdown.
      timer.unref?.();
    }
  }

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

      // 4. Ping the frontend; only record state on success.
      const ok = await this.pingRevalidate(`score_date=${latest}`);
      if (!ok) return;

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

  /**
   * POST the frontend revalidation endpoint. Returns true on a 2xx response.
   * Missing config or any network/HTTP failure is logged and returns false
   * (best-effort — never throws).
   */
  private async pingRevalidate(reason: string): Promise<boolean> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const revalidateSecret = this.config.get<string>('REVALIDATE_SECRET');

    if (!frontendUrl || !revalidateSecret) {
      this.logger.warn(
        'FRONTEND_URL or REVALIDATE_SECRET not configured — skipping revalidation ping',
      );
      return false;
    }

    const url = `${frontendUrl}/api/revalidate-markets`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'x-revalidate-secret': revalidateSecret },
      });

      if (!response.ok) {
        this.logger.error(
          `Revalidation ping failed (${reason}): ${response.status} ${response.statusText} (url=${url})`,
        );
        return false;
      }

      this.logger.log(`SEO market pages revalidated (${reason})`);
      return true;
    } catch (err) {
      this.logger.error(
        `Revalidation ping error (${reason}): ${(err as Error).message}`,
      );
      return false;
    }
  }
}
