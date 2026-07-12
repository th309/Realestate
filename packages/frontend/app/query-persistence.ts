/**
 * React Query persister — IndexedDB-backed, via idb-keyval + the official
 * async storage persister (`@tanstack/query-async-storage-persister`).
 *
 * NOT `@tanstack/query-sync-storage-persister`: that package requires a
 * synchronous storage interface (`localStorage`-shaped). idb-keyval's
 * `get`/`set`/`del` are Promise-based, so the async persister is the
 * correct match — confirmed against the installed package's type defs
 * (`node_modules/@tanstack/query-async-storage-persister`).
 *
 * Wired into `app/providers.tsx` via `PersistQueryClientProvider`. This is a
 * BEST-EFFORT warm-cache, never a source of truth:
 *   - iOS Safari evicts non-installed-PWA IndexedDB data after ~7 days of no
 *     interaction (Apple's "Intelligent Tracking Prevention" storage cap).
 *     An installed/home-screen PWA is exempt, but we can't assume that.
 *   - `maxAge` below additionally discards anything older than 24h even if
 *     the browser kept it, since market data is monthly but we don't want a
 *     week-stale snapshot silently rendering as "current."
 * Every consumer already treats query data as possibly-loading/possibly-stale
 * (React Query's own `isLoading`/`isFetching`); this persister only removes
 * the loading flash on repeat visits, it doesn't change that contract.
 */
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
  defaultShouldDehydrateQuery,
  type Mutation,
  type Query,
} from "@tanstack/react-query";
import { createStore, get, set, del } from "idb-keyval";

// Dedicated IndexedDB database/store, namespaced away from idb-keyval's
// default shared store so other unrelated IndexedDB consumers (e.g. offline
// data caching) can't collide on keys.
const queryCacheStore = createStore("propertyiq-query-cache", "queries");

// idb-keyval's get/set/del already satisfy the shape the async persister
// wants (getItem/setItem/removeItem, all Promise-returning) — just renamed.
// `storage: undefined` on the server is the documented SSR path (see the
// package's `CreateAsyncStoragePersisterOptions.storage` doc comment); it's
// never touched during SSR anyway since IndexedDB doesn't exist there and
// PersistQueryClientProvider only restores/persists client-side.
const idbKeyvalStorage =
  typeof window === "undefined"
    ? undefined
    : {
        getItem: (key: string) => get<string>(key, queryCacheStore),
        setItem: (key: string, value: string) =>
          set(key, value, queryCacheStore),
        removeItem: (key: string) => del(key, queryCacheStore),
      };

export const queryPersister = createAsyncStoragePersister({
  storage: idbKeyvalStorage,
  key: "propertyiq-rq-cache",
  // Batch IndexedDB writes — the map/screener pages fire many settling
  // queries in quick succession; without this every one triggers a write.
  throttleTime: 1000,
});

/**
 * Cache-busting build id. Mirrors next.config.mjs's `generateBuildId`
 * fallback chain (RAILWAY_GIT_COMMIT_SHA → GIT_HASH → timestamp), but that
 * env var is server-only and NOT inlined into the client bundle unless
 * mirrored under a `NEXT_PUBLIC_` name via next.config.mjs's `env` block —
 * which doesn't exist yet (next.config.mjs is owned by a different task this
 * wave; adding it is a follow-up, not done here). Until that's wired, this
 * always resolves to the "dev" fallback, so a redeploy won't bust the
 * persisted cache by itself — `maxAge` (24h) is the real backstop in the
 * meantime.
 */
export const PERSISTED_QUERY_CACHE_BUSTER =
  process.env.NEXT_PUBLIC_BUILD_ID || "dev";

export const PERSISTED_QUERY_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Query key families safe to persist to disk between sessions: public,
 * non-personalized market/geo read data (map + markets pages, scores,
 * time series). Allowlisted, not denylisted — anything not explicitly
 * listed here stays memory-only, so a new hook can never accidentally leak
 * user-scoped data into shared/on-disk storage just by omission.
 *
 * Excluded on purpose (grepped across lib/data/hooks — see the wave report
 * for the full enumeration): entitlements ("entitlements"), user-scoped
 * reads ("user-preferences", "watchlist", "my-org", "onboarding-state"),
 * admin/content-pipeline/analytics keys, AI insight/grading/shadow-test
 * keys, and analyzer deal-grading keys. All of those either carry
 * per-user state or auth-gated data that must never survive sign-out on a
 * shared device.
 */
const PERSISTABLE_QUERY_KEY_FAMILIES = new Set([
  "snapshot", // useSnapshotData — current metric values
  "scores", // useScoreData — PropertyIQ score + confidence
  "score-heatmap", // useScoreHeatmap — metro score heatmap
  "dates", // useTimeSeriesData — available dates for a metric/geo
  "trend", // useTrendData — historical metric series
  "market-snapshot", // useMarketSnapshot / MarketDashboard
  "market-snapshot-trends", // MarketDashboard — market historical trends
  "market-match", // useMarketMatch — single-market comparison
  "market-match-top", // useMarketMatch — top markets list
  "top-markets", // useTopMarkets — market rankings
  "validation", // useValidationData — public score validation/backtest stats
]);

/**
 * `shouldDehydrateQuery` for `PersistQueryClientProvider`'s
 * `dehydrateOptions`. Persists only successful queries (the library
 * default) whose key's first segment is in the public-read allowlist above.
 */
export function shouldPersistQuery(query: Query): boolean {
  if (!defaultShouldDehydrateQuery(query)) return false;
  const [keyFamily] = query.queryKey;
  return (
    typeof keyFamily === "string" &&
    PERSISTABLE_QUERY_KEY_FAMILIES.has(keyFamily)
  );
}

/**
 * `shouldDehydrateMutation` for `PersistQueryClientProvider`'s
 * `dehydrateOptions`. Always `false` — the library default persists
 * PAUSED mutations (a write fired while offline, e.g. preferences,
 * analyzer thresholds, tour signup with an email address, deal grading).
 * This app has no offline-mutation-resume feature and mutations are
 * `retry: 0` by design (see providers.tsx); without this override, a
 * paused mutation's `variables` payload would land in IndexedDB and React
 * Query would auto-resume it on a later session's reconnect with stale
 * variables — silently re-submitting old data, and on a shared device,
 * leaking the previous user's payload to disk.
 */
export function shouldPersistMutation(_mutation: Mutation): boolean {
  return false;
}
