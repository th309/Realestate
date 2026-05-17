/**
 * ThresholdsService — CRUD for per-user, per-strategy grading rubric overrides.
 *
 * Storage: `user_thresholds(user_id, strategy, thresholds JSONB)`. See
 * `migrations/create-user-thresholds-table.sql`. Backend uses service_role
 * (RLS bypassed) — service-level methods always filter by `user_id` to
 * enforce ownership.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Strategy, UserThresholds } from '@propertyiq/analyzer-core';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

@Injectable()
export class ThresholdsService {
  private readonly logger = new Logger(ThresholdsService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Return the user's saved thresholds for the given strategy, or null when
   * no row exists. Callers are responsible for the default-fallback.
   */
  async getThresholds(
    userId: string,
    strategy: Strategy,
  ): Promise<UserThresholds | null> {
    const { data, error } = await this.supabase
      .from('user_thresholds')
      .select('thresholds')
      .eq('user_id', userId)
      .eq('strategy', strategy)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `getThresholds failed for user ${userId}/${strategy}: ${error.message}`,
      );
      throw new Error(`Failed to fetch thresholds: ${error.message}`);
    }

    return (data?.thresholds as UserThresholds | undefined) ?? null;
  }

  /**
   * Insert or update the user's thresholds for the given strategy. Returns
   * the persisted thresholds payload (echoes the input on success).
   */
  async upsertThresholds(
    userId: string,
    strategy: Strategy,
    thresholds: UserThresholds,
  ): Promise<UserThresholds> {
    const { data, error } = await this.supabase
      .from('user_thresholds')
      .upsert(
        {
          user_id: userId,
          strategy,
          thresholds,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,strategy' },
      )
      .select('thresholds')
      .single();

    if (error) {
      this.logger.error(
        `upsertThresholds failed for user ${userId}/${strategy}: ${error.message}`,
      );
      throw new Error(`Failed to save thresholds: ${error.message}`);
    }

    return data.thresholds as UserThresholds;
  }

  /**
   * Idempotent delete — a missing row is not an error. Subsequent reads will
   * return null and callers will fall back to defaults.
   */
  async deleteThresholds(userId: string, strategy: Strategy): Promise<void> {
    const { error } = await this.supabase
      .from('user_thresholds')
      .delete()
      .eq('user_id', userId)
      .eq('strategy', strategy);

    if (error) {
      this.logger.error(
        `deleteThresholds failed for user ${userId}/${strategy}: ${error.message}`,
      );
      throw new Error(`Failed to delete thresholds: ${error.message}`);
    }
  }
}
