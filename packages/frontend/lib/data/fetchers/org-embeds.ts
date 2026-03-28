/**
 * ORGANIZATION EMBED TOKEN FETCHERS
 *
 * API functions for managing embed tokens: CRUD operations and
 * public branding lookup for embedded widgets.
 */

import { fetchAPI, fetchAPIRaw } from "./base";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Widget configuration stored with an embed token for the Embed Builder wizard. */
export interface EmbedConfig {
  widgetType: string;
  embedPath: string;
  geographyName: string;
  width: number;
  height: number;
  snippet: string;
}

/** Full embed token — includes the token value (only returned on creation). */
export interface EmbedToken {
  id: string;
  name: string;
  token: string;
  allowed_origins: string[];
  widget_types: string[];
  is_active: boolean;
  is_draft?: boolean;
  embed_config?: EmbedConfig | null;
  created_at: string;
}

/** Embed token list item — token value is omitted for security. */
export interface EmbedTokenListItem {
  id: string;
  name: string;
  allowed_origins: string[];
  widget_types: string[];
  is_active: boolean;
  embed_config?: EmbedConfig | null;
  created_at: string;
}

/** Branding payload returned for embed widgets (public, token-authenticated). */
export interface EmbedBranding {
  logo_url: string | null;
  accent_color: string;
  org_name: string;
}

// ---------------------------------------------------------------------------
// Read operations — use fetchAPI (auto-retries, typed return)
// ---------------------------------------------------------------------------

/**
 * Fetch all embed tokens for an organization.
 * Token values are not included in list responses.
 */
export async function fetchOrgEmbedTokens(
  slug: string,
): Promise<EmbedTokenListItem[]> {
  return fetchAPI<EmbedTokenListItem[]>(`/api/org/${slug}/embed-tokens`);
}

/**
 * Fetch branding for an embed widget using its token (public endpoint).
 * Used by the embed widget runtime to style itself.
 */
export async function fetchEmbedBranding(
  token: string,
): Promise<EmbedBranding> {
  return fetchAPI<EmbedBranding>(
    `/api/embed/branding?token=${encodeURIComponent(token)}`,
  );
}

// ---------------------------------------------------------------------------
// Embed widget data fetchers (public, token-authenticated)
// ---------------------------------------------------------------------------

/** Response from the embed score endpoint. */
export interface EmbedScoreData {
  geography_name: string;
  scores: Record<
    string,
    {
      score: number;
      grade: string;
      confidence: number;
      confidence_level: string;
    }
  >;
}

/** Response from the embed metric-card endpoint. */
export interface EmbedMetricCardData {
  metric_id: string;
  geography_name: string;
  value: number | null;
  period_date: string;
  trend: number | null;
}

/** A single region entry from the embed map endpoint. */
export interface EmbedMapRegion {
  region_id: string;
  region_name: string;
  value: number;
}

/** Response from the embed map endpoint. */
export interface EmbedMapData {
  metric_id: string;
  geo_level: string;
  data: EmbedMapRegion[];
}

/**
 * Fetch score data for an embed widget (public, token-authenticated).
 */
export async function fetchEmbedScore(
  geoLevel: string,
  geoId: string,
  token: string,
): Promise<EmbedScoreData> {
  return fetchAPI<EmbedScoreData>(
    `/api/embed/score/${encodeURIComponent(geoLevel)}/${encodeURIComponent(geoId)}?token=${encodeURIComponent(token)}`,
  );
}

/**
 * Fetch metric card data for an embed widget (public, token-authenticated).
 */
export async function fetchEmbedMetricCard(
  metricId: string,
  geoLevel: string,
  geoId: string,
  token: string,
): Promise<EmbedMetricCardData> {
  return fetchAPI<EmbedMetricCardData>(
    `/api/embed/metric-card/${encodeURIComponent(metricId)}/${encodeURIComponent(geoLevel)}/${encodeURIComponent(geoId)}?token=${encodeURIComponent(token)}`,
  );
}

/**
 * Fetch map snapshot data for an embed widget (public, token-authenticated).
 */
export async function fetchEmbedMapData(
  geoLevel: string,
  metric: string,
  token: string,
): Promise<EmbedMapData> {
  return fetchAPI<EmbedMapData>(
    `/api/embed/map/${encodeURIComponent(geoLevel)}?metric=${encodeURIComponent(metric)}&token=${encodeURIComponent(token)}`,
  );
}

// ---------------------------------------------------------------------------
// Mutation operations — use fetchAPIRaw (manual error handling)
// ---------------------------------------------------------------------------

/**
 * Create a new embed token for the organization.
 * Returns the full token (including the secret value) — store it immediately,
 * as it will not be returned again in subsequent list calls.
 */
export async function createOrgEmbedToken(
  slug: string,
  data: {
    name: string;
    allowed_origins: string[];
    widget_types: string[];
    is_draft?: boolean;
    embed_config?: EmbedConfig | null;
  },
): Promise<EmbedToken> {
  const res = await fetchAPIRaw(`/api/org/${slug}/embed-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Create embed token failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Update an existing embed token's settings.
 */
export async function updateOrgEmbedToken(
  slug: string,
  tokenId: string,
  data: {
    name?: string;
    allowed_origins?: string[];
    widget_types?: string[];
    is_draft?: boolean;
    embed_config?: EmbedConfig | null;
  },
): Promise<EmbedTokenListItem> {
  const res = await fetchAPIRaw(`/api/org/${slug}/embed-tokens/${tokenId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Update embed token failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Revoke (delete) an embed token. This immediately invalidates it.
 */
export async function revokeOrgEmbedToken(
  slug: string,
  tokenId: string,
): Promise<void> {
  const res = await fetchAPIRaw(`/api/org/${slug}/embed-tokens/${tokenId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Revoke embed token failed: ${res.status}`);
  }
}
