import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LateClientService } from './late-client.service';
import {
  LateNotConfiguredError,
  SOCIAL_BY_LATE_PLATFORM,
} from './late-client.types';
import { lateAccountToRow } from './social-connect.mappers';
import type { SyncFailure, SyncResult } from './social-connect.types';

const TABLE = 'platform_connections';

/**
 * Reconciles Late's connected accounts into `platform_connections`. Split out of
 * SocialConnectService (§1.3) — it owns the write path and the partial-failure
 * accounting so the public service stays a thin API surface.
 */
@Injectable()
export class SocialConnectReconciler {
  private readonly logger = new Logger(SocialConnectReconciler.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly late: LateClientService,
  ) {}

  /**
   * Upsert every Late account PropertyIQ surfaces into the brand's connections.
   * Returns both the success count and the accounts that failed to persist so
   * callers can distinguish full from partial success. `brandId` is required —
   * `platform_connections.brand_id` is NOT NULL and rows are tenant-scoped.
   */
  async syncFromLate(brandId: string): Promise<SyncResult> {
    if (!this.late.isConfigured()) throw new LateNotConfiguredError();

    const accounts = await this.late.listAccounts();
    let synced = 0;
    const failed: SyncFailure[] = [];

    for (const account of accounts) {
      const platform = SOCIAL_BY_LATE_PLATFORM[account.platform];
      if (!platform) continue; // ignore platforms PropertyIQ does not surface

      const row = lateAccountToRow(account, brandId, platform);
      const { error } = await this.supabase
        .getClient()
        .from(TABLE)
        .upsert(row, { onConflict: 'brand_id,platform,provider' });

      if (error) {
        this.logger.error(`upsert ${TABLE} failed: ${error.message}`);
        failed.push({
          platform,
          externalAccountId: account._id,
          error: error.message,
        });
        continue;
      }
      synced += 1;
    }

    return { synced, failed };
  }
}
