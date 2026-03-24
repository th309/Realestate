/**
 * ORGANIZATION API KEY FETCHERS
 *
 * API functions for managing platform API keys: CRUD operations
 * with scope selection and rate limit configuration.
 */

import { fetchAPI, fetchAPIRaw } from "./base";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Full API key — includes the secret value (only returned on creation). */
export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  key?: string;
  scopes: string[];
  rate_limit_rpm: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

/** API key list item — secret value is omitted for security. */
export interface ApiKeyListItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

/** Payload for creating a new API key. */
export interface CreateApiKeyPayload {
  name: string;
  scopes: string[];
  rate_limit_rpm: number;
}

/** Payload for updating an existing API key. */
export interface UpdateApiKeyPayload {
  name?: string;
  scopes?: string[];
  rate_limit_rpm?: number;
}

// ---------------------------------------------------------------------------
// Read operations — use fetchAPI (auto-retries, typed return)
// ---------------------------------------------------------------------------

/**
 * Fetch all API keys for an organization.
 * Secret key values are not included in list responses.
 */
export async function fetchOrgApiKeys(slug: string): Promise<ApiKeyListItem[]> {
  return fetchAPI<ApiKeyListItem[]>(`/api/org/${slug}/api-keys`);
}

// ---------------------------------------------------------------------------
// Mutation operations — use fetchAPIRaw (manual error handling)
// ---------------------------------------------------------------------------

/**
 * Create a new API key for the organization.
 * Returns the full key (including the secret value) — store it immediately,
 * as it will not be returned again in subsequent list calls.
 */
export async function createOrgApiKey(
  slug: string,
  data: CreateApiKeyPayload,
): Promise<ApiKey> {
  const res = await fetchAPIRaw(`/api/org/${slug}/api-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Create API key failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Update an existing API key's settings (name, scopes, rate limit).
 */
export async function updateOrgApiKey(
  slug: string,
  keyId: string,
  data: UpdateApiKeyPayload,
): Promise<ApiKeyListItem> {
  const res = await fetchAPIRaw(`/api/org/${slug}/api-keys/${keyId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Update API key failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Revoke (delete) an API key. This immediately invalidates it.
 */
export async function revokeOrgApiKey(
  slug: string,
  keyId: string,
): Promise<void> {
  const res = await fetchAPIRaw(`/api/org/${slug}/api-keys/${keyId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Revoke API key failed: ${res.status}`);
  }
}
