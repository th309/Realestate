/**
 * SOCIAL CONNECT FETCHERS
 *
 * Data-layer wrappers for the admin social-connect endpoints (one-click account
 * connection via the Late aggregator). All traffic routes through the canonical
 * fetch layer + same-origin `/backend` proxy — never a raw fetch (CLAUDE.md §5).
 *
 * YouTube is NOT handled here — it keeps its own direct OAuth flow through
 * `content-pipeline-api`.
 */

import { fetchAPI, fetchAPIRaw } from "./base";

export type SocialConnectPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "x";

export type SocialConnectionStatus =
  | "connected"
  | "needs_reauth"
  | "disconnected";

export interface SocialConnection {
  id: string;
  brandId: string;
  platform: string;
  provider: "late" | "direct";
  externalAccountId: string | null;
  handle: string | null;
  avatarUrl: string | null;
  status: SocialConnectionStatus;
  connectedAt: string | null;
}

/** Structured "what Troy must do" payload for the not-configured banner. */
export interface SocialConnectSetup {
  error: "late_not_configured";
  message: string;
  steps: string[];
}

export interface SocialConnectionsResult {
  /** False when LATE_API_KEY is unset on the backend. */
  configured: boolean;
  connections: SocialConnection[];
  setup?: SocialConnectSetup;
}

/** Thrown by connect/sync when the backend reports Late is not configured (503). */
export class SocialConnectNotConfiguredError extends Error {
  readonly setup?: SocialConnectSetup;
  constructor(setup?: SocialConnectSetup) {
    super(setup?.message ?? "Social connect is not configured");
    this.name = "SocialConnectNotConfiguredError";
    this.setup = setup;
  }
}

/** One account that failed to persist during a sync. */
export interface SocialConnectSyncFailure {
  platform: string;
  externalAccountId: string;
  error: string;
}

export interface SocialConnectSyncResult {
  synced: number;
  failed: SocialConnectSyncFailure[];
}

const BASE = "/api/admin/social-connect";

/**
 * Parse a 503 not-configured body. The backend wraps setup in the standard
 * envelope: `{ success: false, error: <setup> }`. Older/edge bodies that put
 * setup at the top level are tolerated.
 */
async function throwIfNotConfigured(res: Response): Promise<void> {
  if (res.status !== 503) return;
  const body = (await res.json().catch(() => undefined)) as
    | { error?: SocialConnectSetup }
    | SocialConnectSetup
    | undefined;
  const setup =
    body && "error" in body && typeof body.error === "object"
      ? (body.error as SocialConnectSetup)
      : (body as SocialConnectSetup | undefined);
  throw new SocialConnectNotConfiguredError(setup);
}

/** List stored connections, with live status overlaid when Late is configured. */
export async function fetchSocialConnections(
  brandId?: string,
): Promise<SocialConnectionsResult> {
  const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
  const res = await fetchAPI<{ data: SocialConnectionsResult }>(
    `${BASE}/connections${qs}`,
  );
  return res.data;
}

/** Return the hosted Late OAuth URL to open in a popup. */
export async function createSocialConnectLink(
  platform: SocialConnectPlatform,
  opts: { brandId?: string; redirectUrl?: string } = {},
): Promise<{
  authUrl: string;
  state?: string;
  platform: SocialConnectPlatform;
}> {
  const res = await fetchAPIRaw(`${BASE}/connections/connect-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform, ...opts }),
  });
  await throwIfNotConfigured(res);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Connect failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as {
    data: { authUrl: string; state?: string; platform: SocialConnectPlatform };
  };
  return json.data;
}

/**
 * Disconnect a stored connection (drops it at Late too when configured).
 * `brandId` is required — the endpoint is tenant-scoped by brand.
 */
export async function disconnectSocialConnection(
  id: string,
  brandId: string,
): Promise<void> {
  const res = await fetchAPIRaw(
    `${BASE}/connections/${encodeURIComponent(id)}?brandId=${encodeURIComponent(brandId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Disconnect failed (${res.status}): ${body}`);
  }
}

/** Reconcile Late's connected accounts into the DB after the popup closes. */
export async function syncSocialConnections(
  brandId?: string,
): Promise<SocialConnectSyncResult> {
  const res = await fetchAPIRaw(`${BASE}/connections/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(brandId ? { brandId } : {}),
  });
  await throwIfNotConfigured(res);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sync failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { data: SocialConnectSyncResult };
  return json.data;
}
