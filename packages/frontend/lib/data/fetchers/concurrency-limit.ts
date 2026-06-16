/**
 * BROWSER REQUEST CONCURRENCY LIMITER
 *
 * Caps how many data-layer fetches are in flight at once IN THE BROWSER.
 *
 * Why this exists: the browser QueryClient is a tab-lifetime singleton, so a
 * long session accumulates many per-region queries (market-snapshot +
 * home_value timeseries). With React Query's default `refetchOnReconnect`, a
 * backend reconnect (e.g. a Railway redeploy, or a flaky-wifi `online` event)
 * can fire all of them at once — a self-inflicted thundering herd that trips
 * the backend throttler (HTTP 429) and saturates its DB connection pool
 * (observed: ~550 calls in ~2.5 min, some responses taking 29s). Bounding
 * in-flight requests turns any such burst into an orderly queue.
 *
 * Server-side (SSR / ISR) is intentionally NOT limited: this module is a
 * process-wide singleton on the Next.js server, so a shared semaphore there
 * would serialize requests ACROSS concurrent users. Server fetches are already
 * governed per-request and bypass the throttler via the internal key
 * (see `fetchAPICached`). So on the server this is a transparent pass-through.
 */

/** Max concurrent browser fetches. Comfortably under the backend's 20 req/sec
 * short throttle while still saturating useful parallelism for normal pages. */
export const MAX_CONCURRENT_REQUESTS = 6;

let inFlight = 0;
const waiters: Array<() => void> = [];

/** Acquire a slot, resolving immediately if one is free, else queueing. */
function acquireSlot(): Promise<void> {
  if (inFlight < MAX_CONCURRENT_REQUESTS) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waiters.push(resolve);
  });
}

/** Release a slot: hand it directly to the next waiter, or free it. */
function releaseSlot(): void {
  const next = waiters.shift();
  if (next) {
    // Slot count is unchanged: this holder leaves as the next waiter enters.
    next();
  } else {
    inFlight--;
  }
}

/**
 * Run `task` under the browser concurrency cap. On the server it runs
 * immediately with no limiting. The slot is always released in `finally`, so a
 * rejected/aborted task can never leak a slot (which would deadlock the queue).
 */
export async function withRequestLimit<T>(task: () => Promise<T>): Promise<T> {
  if (typeof window === "undefined") {
    return task();
  }
  await acquireSlot();
  try {
    return await task();
  } finally {
    releaseSlot();
  }
}

/** Test-only: current in-flight count and queue depth. */
export function __getLimiterState(): { inFlight: number; queued: number } {
  return { inFlight, queued: waiters.length };
}
