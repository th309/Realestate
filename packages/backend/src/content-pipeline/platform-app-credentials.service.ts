import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CredentialCrypto } from './drivers/credential-crypto';

export interface AppCredentialPair {
  clientId: string;
  clientSecret: string;
}

export interface AppCredentialStatus {
  configured: boolean;
  source: 'database' | 'env' | null;
  lastFour: string | null; // last 4 chars of client_id (UI confirmation only)
  updatedAt: string | null;
  notes: string | null;
  /**
   * The exact redirect URI THIS backend will receive OAuth callbacks at,
   * computed from APP_BASE_URL. Operators copy this into the platform's
   * developer console. Returned by the backend (NOT guessed by the
   * frontend) because in deployed envs the frontend host
   * (propertyiq.up.railway.app) and backend host
   * (backend-production-ee4d.up.railway.app) are different domains, and
   * locally the backend runs on :3001 while the frontend runs on :3000.
   *
   * Null when APP_BASE_URL is unset on the backend — the Configure
   * dialog surfaces that as an actionable error instead of silently
   * rendering a wrong URI.
   */
  redirectUri: string | null;
}

/**
 * App-level OAuth credentials per platform — the developer-app client_id
 * + client_secret pair. Distinct from PlatformCredentialsService which
 * stores per-account refresh tokens.
 *
 * Resolution order (DB-first then env):
 *   1. platform_app_credentials row (entered via admin UI, encrypted at rest)
 *   2. process.env.<PLATFORM>_OAUTH_CLIENT_ID + _SECRET (legacy / Railway path)
 *
 * This lets operators enter credentials in the UI without Railway env-var
 * trips, while preserving the existing YouTube setup that already uses
 * env vars.
 */
@Injectable()
export class PlatformAppCredentialsService {
  private readonly logger = new Logger(PlatformAppCredentialsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly crypto: CredentialCrypto,
  ) {}

  /**
   * Resolve the active app credentials for a platform. Returns null if
   * neither a DB row nor env vars are configured.
   */
  async resolve(platform: string): Promise<AppCredentialPair | null> {
    const dbRow = await this.readDb(platform);
    if (dbRow) return dbRow;
    return this.readEnv(platform);
  }

  /** Status describing where credentials live — for the admin UI. */
  async status(platform: string): Promise<AppCredentialStatus> {
    const redirectUri = this.computeRedirectUri(platform);
    const client = this.supabase.getClient();
    const { data } = await client
      .from('platform_app_credentials')
      .select('client_id_last4, notes, updated_at')
      .eq('platform', platform)
      .maybeSingle();
    if (data) {
      return {
        configured: true,
        source: 'database',
        lastFour: (data.client_id_last4 as string | null) ?? null,
        updatedAt: data.updated_at as string,
        notes: (data.notes as string | null) ?? null,
        redirectUri,
      };
    }
    const env = this.readEnv(platform);
    if (env) {
      return {
        configured: true,
        source: 'env',
        lastFour: env.clientId.slice(-4),
        updatedAt: null,
        notes: null,
        redirectUri,
      };
    }
    return {
      configured: false,
      source: null,
      lastFour: null,
      updatedAt: null,
      notes: null,
      redirectUri,
    };
  }

  /**
   * Single source of truth for the OAuth callback URI: the backend's own
   * APP_BASE_URL. In local dev this is "http://localhost:3001"; in
   * production it's the Railway backend host. Returned to the frontend
   * via `status()` so the Configure dialog renders the correct URI for
   * whichever environment served the request.
   */
  private computeRedirectUri(platform: string): string | null {
    const base = process.env.APP_BASE_URL;
    if (!base) return null;
    return `${base.replace(/\/$/, '')}/api/admin/content-pipeline/platforms/${platform}/oauth-callback`;
  }

  async upsert(args: {
    platform: string;
    clientId: string;
    clientSecret: string;
    notes?: string;
    updatedBy?: string;
  }): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client.from('platform_app_credentials').upsert(
      {
        platform: args.platform,
        client_id_enc: this.crypto.encrypt(args.clientId),
        client_secret_enc: this.crypto.encrypt(args.clientSecret),
        client_id_last4: args.clientId.slice(-4),
        notes: args.notes ?? null,
        updated_at: new Date().toISOString(),
        updated_by: args.updatedBy ?? null,
      },
      { onConflict: 'platform' },
    );
    if (error) throw error;
    this.logger.log(
      `[APP-CREDS] upsert platform=${args.platform} last4=${args.clientId.slice(-4)}`,
    );
  }

  async clear(platform: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('platform_app_credentials')
      .delete()
      .eq('platform', platform);
    if (error) throw error;
    this.logger.log(`[APP-CREDS] clear platform=${platform}`);
  }

  private async readDb(platform: string): Promise<AppCredentialPair | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('platform_app_credentials')
      .select('client_id_enc, client_secret_enc')
      .eq('platform', platform)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      clientId: this.crypto.decrypt(data.client_id_enc as string),
      clientSecret: this.crypto.decrypt(data.client_secret_enc as string),
    };
  }

  private readEnv(platform: string): AppCredentialPair | null {
    const map: Record<string, [string, string]> = {
      youtube_shorts: [
        'YOUTUBE_OAUTH_CLIENT_ID',
        'YOUTUBE_OAUTH_CLIENT_SECRET',
      ],
      tiktok: ['TIKTOK_OAUTH_CLIENT_KEY', 'TIKTOK_OAUTH_CLIENT_SECRET'],
      instagram_reels: ['META_GRAPH_APP_ID', 'META_GRAPH_APP_SECRET'],
      facebook_reels: ['META_GRAPH_APP_ID', 'META_GRAPH_APP_SECRET'],
      linkedin: ['LINKEDIN_OAUTH_CLIENT_ID', 'LINKEDIN_OAUTH_CLIENT_SECRET'],
    };
    const pair = map[platform];
    if (!pair) return null;
    const id = process.env[pair[0]];
    const secret = process.env[pair[1]];
    if (!id || !secret) return null;
    return { clientId: id, clientSecret: secret };
  }
}
