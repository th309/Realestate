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
  if (cached && now - cached.checkedAt < CACHE_TTL_MS) {
    return cached.allowed;
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/entitlements/check?resources=mcp_access`,
      { headers: { "x-user-id": userId } },
    );
    const body = (await res.json()) as { allowed?: boolean };
    const allowed = body?.allowed === true;
    cache.set(userId, { allowed, checkedAt: now });
    return allowed;
  } catch {
    // On failure, allow access (fail open) but don't cache
    return true;
  }
}
