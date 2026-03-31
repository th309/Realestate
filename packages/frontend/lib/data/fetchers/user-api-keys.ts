/**
 * PERSONAL API KEY FETCHERS
 *
 * API functions for managing personal API keys (Pro tier).
 */

import { fetchAPI, fetchAPIRaw } from "./base";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Personal API key list item — secret value is omitted for security. */
export interface UserApiKeyListItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

/** Full personal API key — includes the secret value (only returned on creation). */
export interface UserApiKey extends UserApiKeyListItem {
  key?: string;
}

/** Payload for creating a new personal API key. */
export interface CreateUserApiKeyPayload {
  name: string;
  scopes: string[];
  rate_limit_rpm?: number;
}

// ---------------------------------------------------------------------------
// Read operations — use fetchAPI (auto-retries, typed return)
// ---------------------------------------------------------------------------

/**
 * Fetch all personal API keys for the authenticated user.
 * Secret key values are not included in list responses.
 */
export async function fetchUserApiKeys(): Promise<UserApiKeyListItem[]> {
  return fetchAPI<UserApiKeyListItem[]>("/api/user/api-keys");
}

// ---------------------------------------------------------------------------
// Mutation operations — use fetchAPIRaw (manual error handling)
// ---------------------------------------------------------------------------

/**
 * Create a new personal API key for the authenticated user.
 * Returns the full key (including the secret value) — store it immediately,
 * as it will not be returned again in subsequent list calls.
 */
export async function createUserApiKey(
  data: CreateUserApiKeyPayload,
): Promise<UserApiKey> {
  const res = await fetchAPIRaw("/api/user/api-keys", {
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
 * Revoke (delete) a personal API key. This immediately invalidates it.
 */
export async function revokeUserApiKey(keyId: string): Promise<void> {
  const res = await fetchAPIRaw(`/api/user/api-keys/${keyId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Revoke API key failed: ${res.status}`);
  }
}
