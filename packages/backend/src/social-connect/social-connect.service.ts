import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LateClientService } from './late-client.service';
import { SocialConnectReconciler } from './social-connect-reconciler.service';
import {
  LATE_PLATFORM_BY_SOCIAL,
  LateNotConfiguredError,
  type LateAccount,
  type SocialPlatform,
} from './late-client.types';
import { mergeLiveAccount, toConnectionView } from './social-connect.mappers';
import {
  assertAllowedRedirect,
  defaultRedirectUrl,
} from './social-connect-redirect';
import type {
  ConnectionStatus,
  ListConnectionsResult,
  PlatformConnectionRow,
  SocialConnectSetup,
  SyncResult,
} from './social-connect.types';
import type { PublishViaConnectionDto } from './dto/publish-via-connection.dto';

const TABLE = 'platform_connections';

/**
 * Public API for PropertyIQ's social connections: reads `platform_connections`
 * and drives the Late aggregator client. The write/reconcile path lives in
 * {@link SocialConnectReconciler}.
 *
 * The feature is optional until Troy provisions a Late account. Every
 * Late-dependent path degrades to a structured "not configured" state instead
 * of crashing (CLAUDE.md §1.2 — no hardcoded fallback key, gate at request
 * time).
 *
 * Tenant safety: the shared Supabase client is service-role and bypasses RLS,
 * so every row operation is scoped by `brand_id` in app code — never by id alone.
 */
@Injectable()
export class SocialConnectService {
  private readonly logger = new Logger(SocialConnectService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly late: LateClientService,
    private readonly reconciler: SocialConnectReconciler,
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

  /** Late profile (workspace/brand) name to connect accounts under. */
  private profileName(): string {
    return process.env.SOCIAL_CONNECT_PROFILE_NAME?.trim() || 'PropertyIQ';
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  /**
   * List connections from `platform_connections`, overlaying live status from
   * Late when configured. A DB failure throws (surfaces as a real error, not a
   * healthy-empty list); a Late outage degrades to the stored rows.
   */
  async listConnections(brandId?: string): Promise<ListConnectionsResult> {
    const rows = await this.selectRows(brandId);

    if (!this.late.isConfigured()) {
      return {
        configured: false,
        connections: rows.map(toConnectionView),
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
      return toConnectionView(live ? mergeLiveAccount(r, live) : r);
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
      // Propagate — a real outage must not render as an empty, healthy wall.
      this.logger.error(`select ${TABLE} failed: ${error.message}`);
      throw new Error(`Failed to read connections: ${error.message}`);
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

    let redirectUrl: string;
    if (params.redirectUrl) {
      assertAllowedRedirect(params.redirectUrl);
      redirectUrl = params.redirectUrl;
    } else {
      redirectUrl = defaultRedirectUrl();
    }

    const latePlatform = LATE_PLATFORM_BY_SOCIAL[params.platform];
    const profile = await this.late.getOrCreateProfile(this.profileName());
    const { authUrl, state } = await this.late.startConnect({
      platform: latePlatform,
      profileId: profile._id,
      redirectUrl,
    });
    return { authUrl, state, platform: params.platform };
  }

  // ── Disconnect ──────────────────────────────────────────────────────────────

  /** Disconnect a connection the brand owns (drops it at Late too). */
  async disconnect(
    id: string,
    brandId: string,
  ): Promise<{ disconnected: string }> {
    const { data, error: selectError } = await this.supabase
      .getClient()
      .from(TABLE)
      .select('external_account_id')
      .eq('id', id)
      .eq('brand_id', brandId)
      .maybeSingle();
    if (selectError) throw selectError;
    if (!data) {
      throw new NotFoundException('Connection not found for this brand');
    }

    const externalId = (data as { external_account_id?: string })
      .external_account_id;
    if (externalId && this.late.isConfigured()) {
      try {
        await this.late.disconnectAccount(externalId);
      } catch (err) {
        // Late may have already dropped it — still mark it locally.
        this.logger.warn(`Late disconnect failed for ${id}: ${String(err)}`);
      }
    }

    const { error: updateError } = await this.supabase
      .getClient()
      .from(TABLE)
      .update({ status: 'disconnected' satisfies ConnectionStatus })
      .eq('id', id)
      .eq('brand_id', brandId);
    if (updateError) throw updateError;

    return { disconnected: id };
  }

  // ── Sync (webhook / poll) ────────────────────────────────────────────────────

  /** Reconcile Late's accounts into `platform_connections` for a brand. */
  async syncFromLate(brandId: string): Promise<SyncResult> {
    return this.reconciler.syncFromLate(brandId);
  }

  // ── Publish (used by a later phase) ──────────────────────────────────────────

  /**
   * Publish through a connection the brand owns. Resolves our connection id to
   * the Late account id, then delegates to the Late client. Wired by a later
   * phase; scoped by brand_id like every other row operation.
   */
  async publishPost(
    connectionId: string,
    brandId: string,
    input: PublishViaConnectionDto,
  ) {
    if (!this.late.isConfigured()) throw new LateNotConfiguredError();

    const { data, error } = await this.supabase
      .getClient()
      .from(TABLE)
      .select('external_account_id')
      .eq('id', connectionId)
      .eq('brand_id', brandId)
      .maybeSingle();
    if (error) throw error;

    const externalId = (data as { external_account_id?: string } | null)
      ?.external_account_id;
    if (!externalId) {
      throw new NotFoundException(
        `Connection ${connectionId} has no linked Late account for this brand`,
      );
    }

    return this.late.publishPost({
      accountId: externalId,
      platform: LATE_PLATFORM_BY_SOCIAL[input.platform],
      copy: input.copy,
      mediaUrls: input.mediaUrls,
      scheduledAt: input.scheduledAt,
      timezone: input.timezone,
    });
  }
}
