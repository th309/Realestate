import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LateClientService } from './late-client.service';
import {
  LATE_PLATFORM_BY_SOCIAL,
  LateApiError,
  LateNotConfiguredError,
  SOCIAL_BY_LATE_PLATFORM,
  type LateAccount,
  type SocialPlatform,
} from './late-client.types';
import type {
  ConnectionStatus,
  ListConnectionsResult,
  PlatformConnectionRow,
  PublishViaConnectionInput,
  SocialConnectSetup,
  SocialConnectionView,
} from './social-connect.types';

const TABLE = 'platform_connections';

/**
 * Orchestrates PropertyIQ's social connections: reads/writes the
 * `platform_connections` table and drives the Late aggregator client.
 *
 * The feature is optional until Troy provisions a Late account. Every
 * Late-dependent path degrades to a structured "not configured" state instead
 * of crashing (CLAUDE.md §1.2 — no hardcoded fallback key, gate at request
 * time).
 */
@Injectable()
export class SocialConnectService {
  private readonly logger = new Logger(SocialConnectService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly late: LateClientService,
  ) {}

  // ── Config helpers ─────────────────────────────────────────────────────────

  isConfigured(): boolean {
    return this.late.isConfigured();
  }

  /** Human steps for the not-configured banner and the 503 payload. */
  setup(): SocialConnectSetup {
    return {
      error: 'late_not_configured',
      message:
        'Social connect is not active yet. Set LATE_API_KEY on the backend to enable one-click account connection.',
      steps: [
        'Create a Late account at https://getlate.dev',
        'In the Late dashboard, generate an API key',
        'Add LATE_API_KEY to the backend service environment (Railway → backend → Variables)',
        'Redeploy the backend, then reload this page',
      ],
    };
  }

  /** Where Late returns the user after the hosted OAuth flow. */
  defaultRedirectUrl(): string {
    const base = (
      process.env.APP_BASE_URL?.trim() || 'http://localhost:3000'
    ).replace(/\/$/, '');
    return `${base}/admin/content-pipeline/platforms`;
  }

  /** Late profile (workspace/brand) name to connect accounts under. */
  private profileName(): string {
    return process.env.SOCIAL_CONNECT_PROFILE_NAME?.trim() || 'PropertyIQ';
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  /**
   * List connections from `platform_connections`, overlaying live status from
   * Late when configured. Never throws on a Late outage — falls back to the
   * stored rows so the wall still renders.
   */
  async listConnections(brandId?: string): Promise<ListConnectionsResult> {
    const rows = await this.selectRows(brandId);

    if (!this.late.isConfigured()) {
      return {
        configured: false,
        connections: rows.map((r) => this.toView(r)),
        setup: this.setup(),
      };
    }

    let liveById = new Map<string, LateAccount>();
    try {
      const accounts = await this.late.listAccounts();
      liveById = new Map(accounts.map((a) => [a._id, a]));
    } catch (err) {
      // Degrade gracefully — show stored rows if Late is unreachable.
      this.logger.warn(
        `listAccounts failed, returning stored rows only: ${String(err)}`,
      );
    }

    const connections = rows.map((r) => {
      const live = r.external_account_id
        ? liveById.get(r.external_account_id)
        : undefined;
      if (!live) return this.toView(r);
      return this.toView({
        ...r,
        handle: live.username ?? live.displayName ?? r.handle,
        avatar_url: live.profilePicture ?? r.avatar_url,
        status: live.isActive === false ? 'needs_reauth' : 'connected',
      });
    });

    return { configured: true, connections };
  }

  private async selectRows(brandId?: string): Promise<PlatformConnectionRow[]> {
    let query = this.supabase
      .getClient()
      .from(TABLE)
      .select(
        'id, brand_id, platform, provider, external_account_id, handle, avatar_url, status, meta, connected_at',
      )
      .eq('provider', 'late');
    if (brandId) query = query.eq('brand_id', brandId);

    const { data, error } = await query;
    if (error) {
      this.logger.error(`select ${TABLE} failed: ${error.message}`);
      return [];
    }
    return (data ?? []) as PlatformConnectionRow[];
  }

  // ── Connect ─────────────────────────────────────────────────────────────────

  /**
   * Start the hosted OAuth flow for a platform and return the URL the browser
   * opens in a popup. Throws {@link LateNotConfiguredError} when the key is
   * missing — the controller maps that to a 503 with the setup payload.
   */
  async createConnectLink(params: {
    platform: SocialPlatform;
    brandId?: string;
    redirectUrl?: string;
  }): Promise<{ authUrl: string; state?: string; platform: SocialPlatform }> {
    if (!this.late.isConfigured()) throw new LateNotConfiguredError();

    const latePlatform = LATE_PLATFORM_BY_SOCIAL[params.platform];
    const profile = await this.late.getOrCreateProfile(this.profileName());
    const { authUrl, state } = await this.late.startConnect({
      platform: latePlatform,
      profileId: profile._id,
      redirectUrl: params.redirectUrl ?? this.defaultRedirectUrl(),
    });
    return { authUrl, state, platform: params.platform };
  }

  // ── Disconnect ──────────────────────────────────────────────────────────────

  async disconnect(id: string): Promise<{ disconnected: string }> {
    const { data } = await this.supabase
      .getClient()
      .from(TABLE)
      .select('external_account_id')
      .eq('id', id)
      .maybeSingle();

    const externalId = (data as { external_account_id?: string } | null)
      ?.external_account_id;
    if (externalId && this.late.isConfigured()) {
      try {
        await this.late.disconnectAccount(externalId);
      } catch (err) {
        // Still mark disconnected locally even if Late already dropped it.
        this.logger.warn(`Late disconnect failed for ${id}: ${String(err)}`);
      }
    }

    await this.supabase
      .getClient()
      .from(TABLE)
      .update({ status: 'disconnected' satisfies ConnectionStatus })
      .eq('id', id);

    return { disconnected: id };
  }

  // ── Sync (webhook / poll) ────────────────────────────────────────────────────

  /**
   * Reconcile Late's connected accounts into `platform_connections`. Called
   * after the popup closes and by a future webhook. `brandId` is required — the
   * table's brand_id is NOT NULL.
   */
  async syncFromLate(brandId: string): Promise<{ synced: number }> {
    if (!this.late.isConfigured()) throw new LateNotConfiguredError();

    let accounts: LateAccount[];
    try {
      accounts = await this.late.listAccounts();
    } catch (err) {
      if (err instanceof LateApiError) throw err;
      throw err;
    }

    let synced = 0;
    for (const account of accounts) {
      const platform = SOCIAL_BY_LATE_PLATFORM[account.platform];
      if (!platform) continue; // ignore platforms PropertyIQ does not surface

      const row = {
        brand_id: brandId,
        platform,
        provider: 'late' as const,
        external_account_id: account._id,
        handle: account.username ?? account.displayName ?? null,
        avatar_url: account.profilePicture ?? null,
        status: (account.isActive === false
          ? 'needs_reauth'
          : 'connected') satisfies ConnectionStatus,
        meta: account as unknown as Record<string, unknown>,
        connected_at: new Date().toISOString(),
      };

      const { error } = await this.supabase
        .getClient()
        .from(TABLE)
        .upsert(row, { onConflict: 'brand_id,platform,provider' });
      if (error) {
        this.logger.error(`upsert ${TABLE} failed: ${error.message}`);
        continue;
      }
      synced += 1;
    }

    return { synced };
  }

  // ── Publish (used by a later phase) ──────────────────────────────────────────

  /**
   * Publish through a stored connection. Resolves our connection id to the Late
   * account id, then delegates to the Late client. Wired by a later phase.
   */
  async publishPost(connectionId: string, input: PublishViaConnectionInput) {
    if (!this.late.isConfigured()) throw new LateNotConfiguredError();

    const { data } = await this.supabase
      .getClient()
      .from(TABLE)
      .select('external_account_id, platform')
      .eq('id', connectionId)
      .maybeSingle();

    const row = data as { external_account_id?: string } | null;
    if (!row?.external_account_id) {
      throw new Error(`Connection ${connectionId} has no linked Late account`);
    }

    return this.late.publishPost({
      accountId: row.external_account_id,
      platform: LATE_PLATFORM_BY_SOCIAL[input.platform],
      copy: input.copy,
      mediaUrls: input.mediaUrls,
      scheduledAt: input.scheduledAt,
      timezone: input.timezone,
    });
  }

  // ── Mapping ──────────────────────────────────────────────────────────────────

  private toView(r: PlatformConnectionRow): SocialConnectionView {
    return {
      id: r.id,
      brandId: r.brand_id,
      platform: r.platform,
      provider: r.provider,
      externalAccountId: r.external_account_id,
      handle: r.handle,
      avatarUrl: r.avatar_url,
      status: r.status,
      connectedAt: r.connected_at,
    };
  }
}
