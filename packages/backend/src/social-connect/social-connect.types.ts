/** Connection status persisted in `platform_connections.status`. */
export type ConnectionStatus = 'connected' | 'needs_reauth' | 'disconnected';

/** Row shape of the `platform_connections` table (owned by the migration agent). */
export interface PlatformConnectionRow {
  id: string;
  brand_id: string;
  platform: string;
  provider: 'late' | 'direct';
  external_account_id: string | null;
  handle: string | null;
  avatar_url: string | null;
  status: ConnectionStatus;
  meta: Record<string, unknown> | null;
  connected_at: string | null;
}

/** Camel-cased connection returned to the admin UI. */
export interface SocialConnectionView {
  id: string;
  brandId: string;
  platform: string;
  provider: 'late' | 'direct';
  externalAccountId: string | null;
  handle: string | null;
  avatarUrl: string | null;
  status: ConnectionStatus;
  connectedAt: string | null;
}

export interface ListConnectionsResult {
  /** True when LATE_API_KEY is set on the backend. */
  configured: boolean;
  connections: SocialConnectionView[];
  /** Present when not configured — the human steps to activate the feature. */
  setup?: SocialConnectSetup;
}

/** Structured "what Troy must do" payload for the not-configured banner + 503. */
export interface SocialConnectSetup {
  error: 'late_not_configured';
  message: string;
  steps: string[];
}

/** The static not-configured payload (banner + 503 body). */
export const SOCIAL_CONNECT_SETUP: SocialConnectSetup = {
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

/** One row that failed to upsert during a sync, with the reason. */
export interface SyncFailure {
  platform: string;
  externalAccountId: string;
  error: string;
}

/**
 * Outcome of a sync. `failed` lets callers tell full success from partial —
 * a non-empty array means some accounts did not persist.
 */
export interface SyncResult {
  synced: number;
  failed: SyncFailure[];
}
