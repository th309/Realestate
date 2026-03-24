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

/** Full embed token — includes the token value (only returned on creation). */
export interface EmbedToken {
  id: string;
  name: string;
  token: string;
  allowed_origins: string[];
  widget_types: string[];
  is_active: boolean;
  created_at: string;
}

/** Embed token list item — token value is omitted for security. */
export interface EmbedTokenListItem {
  id: string;
  name: string;
  allowed_origins: string[];
  widget_types: string[];
  is_active: boolean;
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
// Mutation operations — use fetchAPIRaw (manual error handling)
// ---------------------------------------------------------------------------

/**
 * Create a new embed token for the organization.
 * Returns the full token (including the secret value) — store it immediately,
 * as it will not be returned again in subsequent list calls.
 */
export async function createOrgEmbedToken(
  slug: string,
  data: { name: string; allowed_origins: string[]; widget_types: string[] },
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
  data: { name?: string; allowed_origins?: string[]; widget_types?: string[] },
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
