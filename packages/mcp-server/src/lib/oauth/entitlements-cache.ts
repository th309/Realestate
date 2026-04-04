const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  allowed: boolean;
  checkedAt: number;
}

const cache = new Map<string, CacheEntry>();

const BACKEND_URL =
  process.env.PROPERTYIQ_API_URL ||
  "https://backend-production-ee4d.up.railway.app";

export async function checkEntitlement(userId: string): Promise<boolean> {
  const now = Date.now();
  const cached = cache.get(userId);
  const isCached = !!(cached && now - cached.checkedAt < CACHE_TTL_MS);
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
    cache.set(userId, { allowed, checkedAt: now });
    console.log(`[Auth:Entitlements] Result: allowed=${allowed}`);
    return allowed;
  } catch (err) {
    // On failure, allow access (fail open) but don't cache
    console.log(
      `[Auth:Entitlements] Check failed, failing open | error=${err instanceof Error ? err.message : String(err)}`,
    );
    return true;
  }
}
