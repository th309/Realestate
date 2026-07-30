/**
 * Who counts as "us" rather than "a customer".
 *
 * Owner and admin browsing is indistinguishable from customer browsing at the
 * event level: same app, same pages, same heartbeats. 99 of 767 human sessions
 * in a trailing 30-day window were ours, so every engagement number on the
 * dashboard carried a ~13% self-inflicted lift. The only durable signal is the
 * signed-in user id, which `public.analytics_internal_user_ids()` resolves from
 * admin_users plus the owner's addresses (including plus-tag aliases).
 *
 * Cached in memory because ingestion asks per batch and the answer changes when
 * someone is added to admin_users — measured in months, not seconds. A TTL is
 * enough; there is no invalidation hook and none is warranted.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/** Long enough that ingestion never drives real query load, short enough that a
 *  newly-added admin is flagged within one coffee break. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** After a failed refresh, retry sooner than the success TTL but not per batch. */
const FAILURE_RETRY_MS = 30 * 1000;

@Injectable()
export class InternalUserRegistryService {
  private readonly logger = new Logger(InternalUserRegistryService.name);

  private cachedIds = new Set<string>();
  private expiresAt = 0;

  /** Collapses concurrent refreshes so a burst of batches issues one query. */
  private inFlight: Promise<Set<string>> | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * True when this user id belongs to us.
   *
   * Fails OPEN to `false` — an unresolvable id is treated as a customer. The
   * asymmetry is deliberate: mislabelling a customer as internal deletes them
   * from every customer-facing number with no trace, while mislabelling one of
   * ours as a customer is the status quo and is correctable by a backfill.
   */
  async isInternal(userId?: string | null): Promise<boolean> {
    if (!userId) return false;
    const ids = await this.getInternalUserIds();
    return ids.has(userId);
  }

  /** True when ANY event in the batch was emitted by an internal user. */
  async isAnyInternal(
    userIds: readonly (string | null | undefined)[],
  ): Promise<boolean> {
    const candidates = userIds.filter((id): id is string => !!id);
    if (candidates.length === 0) return false;
    const ids = await this.getInternalUserIds();
    return candidates.some((id) => ids.has(id));
  }

  async getInternalUserIds(): Promise<Set<string>> {
    // Gate on expiry ALONE. Requiring a prior success here meant the failure
    // backoff below could never engage before the first successful load: on a
    // cold start with a failing RPC — a missing migration, a permissions
    // problem — `hasLoadedOnce` stayed false, so every ingestion batch retried
    // immediately and hammered the RPC continuously through exactly the outage
    // the backoff exists to survive. `expiresAt` starts at 0, i.e. already
    // expired, so the first call still refreshes.
    if (Date.now() < this.expiresAt) {
      return this.cachedIds;
    }
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.refresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async refresh(): Promise<Set<string>> {
    const client = this.supabase.getClient();
    // `.rpc()` is typed loosely, so it is narrowed here rather than letting
    // `any` leak into the id set.
    const { data, error } = (await client.rpc(
      'analytics_internal_user_ids',
    )) as {
      data: { user_id: string | null }[] | null;
      error: { message: string } | null;
    };

    if (error) {
      // Keep serving the last known set rather than reclassifying everyone as
      // external on a transient failure, which would silently readmit our own
      // traffic to the customer numbers for as long as the outage lasted.
      this.logger.error(
        `Failed to load internal user ids: ${error.message}; ` +
          `serving ${this.cachedIds.size} cached id(s)`,
      );
      this.expiresAt = Date.now() + FAILURE_RETRY_MS;
      return this.cachedIds;
    }

    this.cachedIds = new Set(
      (data ?? []).map((row) => row.user_id).filter((id): id is string => !!id),
    );
    this.expiresAt = Date.now() + CACHE_TTL_MS;
    return this.cachedIds;
  }
}
