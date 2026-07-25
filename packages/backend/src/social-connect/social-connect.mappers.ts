import type { LateAccount } from './late-client.types';
import type {
  ConnectionStatus,
  PlatformConnectionRow,
  SocialConnectionView,
} from './social-connect.types';

/**
 * Pure mapping helpers shared by the service (read/overlay) and the reconciler
 * (write). No I/O, no DI — extracted from the service to keep both logic files
 * under the CLAUDE.md §1.3 limit.
 */

/** DB row → camel-cased shape the admin UI consumes. */
export function toConnectionView(
  r: PlatformConnectionRow,
): SocialConnectionView {
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

/** Overlay live fields from a Late account onto a stored row (non-mutating). */
export function mergeLiveAccount(
  row: PlatformConnectionRow,
  live: LateAccount,
): PlatformConnectionRow {
  return {
    ...row,
    handle: live.username ?? live.displayName ?? row.handle,
    avatar_url: live.profilePicture ?? row.avatar_url,
    status: live.isActive === false ? 'needs_reauth' : 'connected',
  };
}

/**
 * Whitelist the Late account fields we actually store in `meta` — never persist
 * the verbatim third-party payload (it can carry tokens or unbounded data).
 */
export function whitelistAccountMeta(
  account: LateAccount,
): Record<string, unknown> {
  return {
    id: account._id,
    platform: account.platform,
    username: account.username ?? null,
    displayName: account.displayName ?? null,
    profilePicture: account.profilePicture ?? null,
    profileUrl: account.profileUrl ?? null,
    isActive: account.isActive ?? null,
  };
}

/** Build the `platform_connections` upsert row for a Late account. */
export function lateAccountToRow(
  account: LateAccount,
  brandId: string,
  platform: string,
): {
  brand_id: string;
  platform: string;
  provider: 'late';
  external_account_id: string;
  handle: string | null;
  avatar_url: string | null;
  status: ConnectionStatus;
  meta: Record<string, unknown>;
  connected_at: string;
} {
  return {
    brand_id: brandId,
    platform,
    provider: 'late',
    external_account_id: account._id,
    handle: account.username ?? account.displayName ?? null,
    avatar_url: account.profilePicture ?? null,
    status: account.isActive === false ? 'needs_reauth' : 'connected',
    meta: whitelistAccountMeta(account),
    connected_at: new Date().toISOString(),
  };
}
