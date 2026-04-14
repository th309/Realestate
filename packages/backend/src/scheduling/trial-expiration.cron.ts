import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { ServerEventEmitterService } from '../user-analytics/server-event-emitter.service';

/**
 * Trial source-of-truth note (Task 3.5):
 *
 * Trials live in the `user_trials` table (started_at, expires_at, converted_at,
 * cancelled_at). `user_profiles.trial_expired_emitted_at` is used purely as an
 * idempotency flag for this cron so `trial.expired` fires exactly once per
 * user — the migration adding that column was applied in Phase 0 Task 0.2.
 *
 * We chose Option A (query `user_trials`, flag on `user_profiles`) over
 * Option B (add an `expired_emitted_at` column to `user_trials`) because:
 *   1. The idempotency column already exists on `user_profiles`, so no new
 *      migration is needed mid-Phase-3.
 *   2. A user has at most one active trial, and the flag semantically belongs
 *      with the user identity (like `email_verified_at`), not the trial row.
 */

interface ExpiredTrialRow {
  user_id: string;
  started_at: string | null;
  expires_at: string;
}

interface UserProfileRow {
  id: string;
  trial_expired_emitted_at: string | null;
  usage_stats: Record<string, number> | null;
}

function daysBetween(
  a: string | Date | null,
  b: string | Date | null,
): number | null {
  if (!a || !b) return null;
  const aMs = typeof a === 'string' ? new Date(a).getTime() : a.getTime();
  const bMs = typeof b === 'string' ? new Date(b).getTime() : b.getTime();
  return Math.floor((bMs - aMs) / 86_400_000);
}

/**
 * Counts distinct features used, where a "feature" is a non-zero entry in the
 * standard usage_stats shape (markets_viewed, scores_checked, reports_generated).
 * Matches the increment keys in OnboardingService.incrementUsageStat.
 */
function countFeaturesUsed(
  usageStats: Record<string, number> | null | undefined,
): number {
  if (!usageStats) return 0;
  return Object.values(usageStats).filter((v) => typeof v === 'number' && v > 0)
    .length;
}

@Injectable()
export class TrialExpirationCron {
  private readonly logger = new Logger(TrialExpirationCron.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly emitter: ServerEventEmitterService,
  ) {}

  /**
   * Daily at 02:00 UTC — find trials past their expires_at that have not yet
   * converted or cancelled, and emit `trial.expired` exactly once per user.
   *
   * Idempotency: the `user_profiles.trial_expired_emitted_at` flag is checked
   * AND set atomically enough for this purpose — we emit the event first, then
   * set the flag. If the flag update fails, the next run will re-emit (at-least-
   * once semantics favour delivery over duplicate suppression here, since the
   * downstream `user_events` ingestion dedupes on `client_event_id` via the
   * random UUID per emit — but the flag is the primary dedupe mechanism).
   */
  @Cron('0 2 * * *')
  async expireTrials(): Promise<void> {
    const nowIso = new Date().toISOString();

    // 1. Find all user_trials whose expires_at has passed and which haven't
    //    been converted or cancelled. (A user can have at most one active
    //    trial at a time; if somehow there are multiple expired trials for the
    //    same user, the emit-flag dedupes them.)
    const { data: expiredTrials, error: trialsError } = await this.supabase
      .from('user_trials')
      .select('user_id, started_at, expires_at')
      .lte('expires_at', nowIso)
      .is('converted_at', null)
      .is('cancelled_at', null);

    if (trialsError) {
      this.logger.error(
        `Failed to fetch expired trials: ${trialsError.message}`,
      );
      return;
    }

    const rows = (expiredTrials as ExpiredTrialRow[] | null) ?? [];
    if (rows.length === 0) {
      this.logger.log('No expired trials to process');
      return;
    }

    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

    // 2. Load profiles to check emitted-flag and read usage_stats.
    const { data: profiles, error: profilesError } = await this.supabase
      .from('user_profiles')
      .select('id, trial_expired_emitted_at, usage_stats')
      .in('id', userIds);

    if (profilesError) {
      this.logger.error(
        `Failed to fetch user_profiles: ${profilesError.message}`,
      );
      return;
    }

    const profileByUserId = new Map<string, UserProfileRow>();
    for (const p of (profiles as UserProfileRow[] | null) ?? []) {
      profileByUserId.set(p.id, p);
    }

    // 3. Pick the earliest matching trial row per user (stable behaviour if
    //    there are somehow multiple) and process.
    const earliestTrialByUser = new Map<string, ExpiredTrialRow>();
    for (const row of rows) {
      const existing = earliestTrialByUser.get(row.user_id);
      if (
        !existing ||
        new Date(row.expires_at).getTime() <
          new Date(existing.expires_at).getTime()
      ) {
        earliestTrialByUser.set(row.user_id, row);
      }
    }

    let emitted = 0;
    let skipped = 0;

    for (const [userId, trial] of earliestTrialByUser) {
      const profile = profileByUserId.get(userId);

      // Idempotency: skip if already emitted.
      if (profile?.trial_expired_emitted_at) {
        skipped++;
        continue;
      }

      const daysActive = daysBetween(trial.started_at, trial.expires_at) ?? 0;
      const featuresUsedCount = countFeaturesUsed(profile?.usage_stats);

      await this.emitter.emit('trial', 'expired', userId, {
        days_active: daysActive,
        features_used_count: featuresUsedCount,
        trial_started_at: trial.started_at,
        trial_expires_at: trial.expires_at,
      });

      // Mark as emitted so subsequent runs skip this user.
      const { error: updateError } = await this.supabase
        .from('user_profiles')
        .update({ trial_expired_emitted_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) {
        this.logger.warn(
          `Failed to mark trial_expired_emitted_at for ${userId}: ${updateError.message}`,
        );
        // Continue — at-least-once is acceptable given downstream dedupe is
        // not available and the next run will retry via the same path.
      }

      emitted++;
    }

    this.logger.log(
      `Trial expiration cron complete: ${emitted} emitted, ${skipped} already-emitted skipped, ${rows.length} expired trials scanned`,
    );
  }
}
