import type { SocialPlatform } from './late-client.types';

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

/** Input for the later-phase publish path (connection id → Late account). */
export interface PublishViaConnectionInput {
  copy: string;
  platform: SocialPlatform;
  mediaUrls?: string[];
  scheduledAt?: string;
  timezone?: string;
}
