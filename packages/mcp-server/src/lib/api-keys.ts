/**
 * Platform API key validation for the MCP server.
 *
 * Validates `piq_live_*` keys minted by the backend (organization_api_keys
 * for Enterprise orgs, user_api_keys for Pro individuals). Mirrors the
 * shape of `lookupAccessToken` in oauth/tokens.ts so `extractAuth` can
 * dispatch on token prefix without caring which path matched.
 *
 * Caching mirrors the entitlements-cache pattern: positive results held
 * briefly (60 s) so revocation propagates without an explicit invalidation
 * hook; negatives held shorter (30 s) so a freshly-minted key starts
 * working quickly. Source of truth lives in the backend tables.
 */

import { createHash } from "node:crypto";
import { requireSupabase } from "./oauth/supabase";

export const POSITIVE_TTL_MS = 60 * 1000;
export const NEGATIVE_TTL_MS = 30 * 1000;

export interface ValidatedApiKey {
  /** User to use for the entitlement check. For org keys this is the org owner. */
  userId: string;
  source: "org" | "user";
  /** Primary key of the api-key row (organization_api_keys.id or user_api_keys.id). */
  keyId: string;
  /** Present only when source = "org". */
  orgId?: string;
}

interface CacheEntry {
  result: ValidatedApiKey | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

/**
 * Validate a raw `piq_live_*` API key. Returns the resolved subject (user id
 * for entitlement checks plus source metadata) or null if the key is unknown,
 * inactive, expired, or belongs to an org with no owner.
 */
export async function lookupApiKey(
  rawKey: string,
): Promise<ValidatedApiKey | null> {
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const snippet = `${rawKey.slice(0, 12)}…`;
  const now = Date.now();

  const cached = cache.get(keyHash);
  if (cached && now < cached.expiresAt) {
    console.log(
      `[Auth:ApiKey] Cache hit | snippet=${snippet} | result=${cached.result ? "ok" : "null"}`,
    );
    return cached.result;
  }

  console.log(`[Auth:ApiKey] Looking up | snippet=${snippet}`);
  const sb = requireSupabase();

  // 1. Organization API keys take precedence (Enterprise tier)
  const { data: orgRow } = await sb
    .from("organization_api_keys")
    .select("id, organization_id, expires_at")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .maybeSingle();

  if (orgRow) {
    const row = orgRow as {
      id: string;
      organization_id: string;
      expires_at: string | null;
    };
    if (isExpired(row.expires_at)) {
      console.log(`[Auth:ApiKey] Org key expired | keyId=${row.id}`);
      cache.set(keyHash, { result: null, expiresAt: now + NEGATIVE_TTL_MS });
      return null;
    }

    // Resolve org owner so checkEntitlement (which is keyed on userId)
    // looks up the right subscription.
    const { data: orgData } = await sb
      .from("organizations")
      .select("owner_id")
      .eq("id", row.organization_id)
      .maybeSingle();
    const ownerId = (orgData as { owner_id?: string | null } | null)?.owner_id;
    if (!ownerId) {
      console.log(
        `[Auth:ApiKey] Org has no owner | orgId=${row.organization_id}`,
      );
      cache.set(keyHash, { result: null, expiresAt: now + NEGATIVE_TTL_MS });
      return null;
    }

    const result: ValidatedApiKey = {
      userId: ownerId,
      source: "org",
      keyId: row.id,
      orgId: row.organization_id,
    };
    cache.set(keyHash, { result, expiresAt: now + POSITIVE_TTL_MS });
    console.log(
      `[Auth:ApiKey] Org key ok | keyId=${row.id} | ownerUserId=${ownerId}`,
    );
    return result;
  }

  // 2. User API keys
  const { data: userRow } = await sb
    .from("user_api_keys")
    .select("id, user_id, expires_at")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .maybeSingle();

  if (userRow) {
    const row = userRow as {
      id: string;
      user_id: string;
      expires_at: string | null;
    };
    if (isExpired(row.expires_at)) {
      console.log(`[Auth:ApiKey] User key expired | keyId=${row.id}`);
      cache.set(keyHash, { result: null, expiresAt: now + NEGATIVE_TTL_MS });
      return null;
    }
    const result: ValidatedApiKey = {
      userId: row.user_id,
      source: "user",
      keyId: row.id,
    };
    cache.set(keyHash, { result, expiresAt: now + POSITIVE_TTL_MS });
    console.log(
      `[Auth:ApiKey] User key ok | keyId=${row.id} | userId=${row.user_id}`,
    );
    return result;
  }

  console.log(`[Auth:ApiKey] No matching key | snippet=${snippet}`);
  cache.set(keyHash, { result: null, expiresAt: now + NEGATIVE_TTL_MS });
  return null;
}

/** Test-only: clear the in-memory cache. Do not call outside vitest. */
export function __resetApiKeyCacheForTests(): void {
  cache.clear();
}
