/**
 * Push Subscriptions Data Service
 *
 * All DB access for the push_subscriptions table. Uses the shared
 * service-role Supabase client (see ThresholdAlertDataService for the same
 * pattern) — RLS still applies to any client-facing paths, this service is
 * only reached through JwtAuthGuard-protected controller routes or trusted
 * server-side cron code.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_success_at: string | null;
}

/** Abuse-prevention cap — a legitimate user has a handful of devices/browsers, not dozens. */
const MAX_SUBSCRIPTIONS_PER_USER = 10;

@Injectable()
export class PushSubscriptionsDataService {
  private readonly logger = new Logger(PushSubscriptionsDataService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * All subscriptions for a user (a user may have several devices/browsers).
   */
  async findByUserId(userId: string): Promise<PushSubscriptionRow[]> {
    const { data, error } = await this.supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to fetch push subscriptions: ${error.message}`);
      return [];
    }

    return (data as PushSubscriptionRow[]) || [];
  }

  /**
   * Create or refresh a subscription. Upserts on `endpoint` (globally unique)
   * so a re-subscribe on the same device/browser reassigns user_id instead of
   * erroring — the previous owner (e.g. a signed-out user on a shared device)
   * loses that endpoint, which is the correct behavior for Web Push.
   */
  async upsert(
    userId: string,
    endpoint: string,
    p256dh: string,
    authSecret: string,
    userAgent?: string,
  ): Promise<void> {
    const { error } = await this.supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth: authSecret,
        user_agent: userAgent ?? null,
      },
      { onConflict: 'endpoint' },
    );

    if (error) {
      this.logger.error(`Failed to save push subscription: ${error.message}`);
      throw new Error(error.message);
    }

    await this.evictOldestBeyondCap(userId);
  }

  /**
   * Enforce MAX_SUBSCRIPTIONS_PER_USER by deleting the oldest rows beyond
   * the cap. Runs right after upsert() so a user can never accumulate
   * unbounded rows via repeated subscribe calls. Best-effort: a failure here
   * is logged, not thrown — it must never fail the subscribe request itself.
   */
  private async evictOldestBeyondCap(userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to check push-subscription cap for user: ${error.message}`,
      );
      return;
    }

    const rows = data || [];
    if (rows.length <= MAX_SUBSCRIPTIONS_PER_USER) return;

    const evictIds = rows.slice(MAX_SUBSCRIPTIONS_PER_USER).map((r) => r.id);
    const { error: deleteError } = await this.supabase
      .from('push_subscriptions')
      .delete()
      .in('id', evictIds);

    if (deleteError) {
      this.logger.error(
        `Failed to evict oldest push subscriptions beyond cap: ${deleteError.message}`,
      );
    } else {
      this.logger.log(
        `Evicted ${evictIds.length} push subscription(s) beyond the ${MAX_SUBSCRIPTIONS_PER_USER}-per-user cap`,
      );
    }
  }

  /**
   * Remove a subscription by endpoint, scoped to the requesting user so a
   * caller can't delete another user's subscription by guessing an endpoint.
   */
  async removeByEndpoint(userId: string, endpoint: string): Promise<void> {
    const { error } = await this.supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) {
      this.logger.error(`Failed to delete push subscription: ${error.message}`);
      throw new Error(error.message);
    }
  }

  /**
   * Prune a dead subscription by row id (used after a 404/410 push send
   * response — no user_id scoping needed since PushService already resolved
   * the row via findByUserId).
   */
  async removeById(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('push_subscriptions')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(
        `Failed to prune push subscription ${id}: ${error.message}`,
      );
    }
  }

  async markSuccess(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('push_subscriptions')
      .update({ last_success_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      this.logger.error(
        `Failed to update last_success_at for push subscription ${id}: ${error.message}`,
      );
    }
  }
}
