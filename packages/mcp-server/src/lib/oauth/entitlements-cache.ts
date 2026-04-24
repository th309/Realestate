export const POSITIVE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const NEGATIVE_TTL_MS = 30 * 1000; // 30 seconds

interface CacheEntry {
  allowed: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const BACKEND_URL =
  process.env.PROPERTYIQ_API_URL ||
  "https://backend-production-ee4d.up.railway.app";

// Manual bypass list — comma-separated user IDs that skip the backend
// entitlement check entirely and are always allowed. Used to keep trusted
// agents (e.g. paperclip CMO heartbeat) online independently of the
// backend entitlements service. Revoke by removing the ID from the env var
// and redeploying.
const ALLOWLIST = new Set(
  (process.env.MCP_ENTITLEMENT_ALLOWLIST || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

export async function checkEntitlement(userId: string): Promise<boolean> {
  if (ALLOWLIST.has(userId)) {
    console.log(`[Auth:Entitlements] Allowlist bypass | userId=${userId}`);
    return true;
  }

  const now = Date.now();
  const cached = cache.get(userId);
  const isCached = !!(cached && now < cached.expiresAt);
  console.log(
    `[Auth:Entitlements] Checking userId=${userId} | cached=${isCached}`,
  );
  if (isCached) {
    console.log(`[Auth:Entitlements] Result: allowed=${cached!.allowed}`);
    return cached!.allowed;
  }

  try {
    const resource = "feature:mcp_access";
    const res = await fetch(
      `${BACKEND_URL}/api/entitlements/check?resources=${resource}`,
      { headers: { "x-user-id": userId } },
    );
    const body = (await res.json()) as {
      access?: Record<string, { level?: string }>;
    };
    const allowed = body?.access?.[resource]?.level === "full";
    const ttl = allowed ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
    cache.set(userId, { allowed, expiresAt: now + ttl });
    console.log(
      `[Auth:Entitlements] Result: allowed=${allowed} | ttl_ms=${ttl}`,
    );
    return allowed;
  } catch (err) {
    // On failure, allow access (fail open) but don't cache
    console.log(
      `[Auth:Entitlements] Check failed, failing open | error=${err instanceof Error ? err.message : String(err)}`,
    );
    return true;
  }
}

/** Remove cached entitlement decisions for the given userIds. Returns the number of entries actually removed. */
export function invalidateMany(userIds: string[]): number {
  let count = 0;
  for (const id of userIds) {
    if (cache.delete(id)) count++;
  }
  return count;
}

/** Test-only: clear the whole cache. Do not call outside vitest. */
export function __resetCacheForTests(): void {
  cache.clear();
}
