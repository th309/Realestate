/**
 * Best-effort buster for the backend's data-freshness cache.
 *
 * The backend caches /api/health/data-freshness in-memory for 24h (the "as of"
 * dates shown across the app). Data pipelines write straight to Supabase, so
 * after an ingest or scoring run that cache is stale until the TTL lapses.
 * Calling this at the end of a run forces the backend to recompute immediately.
 *
 * Targets the backend URL from env (API_URL / BACKEND_URL / BACKEND_API_URL /
 * NEXT_PUBLIC_API_URL), falling back to the documented production backend.
 * Never throws — a failed cache bust must not fail the data run.
 */

const DEFAULT_BACKEND_URL = "https://backend-production-ee4d.up.railway.app";

function resolveBackendUrl(): string {
  return (
    process.env.API_URL ||
    process.env.BACKEND_URL ||
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_BACKEND_URL
  ).replace(/\/$/, "");
}

export async function bustFreshnessCache(): Promise<void> {
  const url = `${resolveBackendUrl()}/api/health/data-freshness?refresh=true`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(url, {
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = (await res.json()) as {
        tableDates?: Record<string, string | null>;
      };
      const piq = data.tableDates?.propertyiq_scores ?? "?";
      console.log(
        `  Freshness cache refreshed (propertyiq_scores as-of: ${piq})`,
      );
    } else {
      console.log(`  Freshness cache refresh returned HTTP ${res.status}`);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.log(`  Freshness cache refresh skipped (${reason})`);
  }
}
