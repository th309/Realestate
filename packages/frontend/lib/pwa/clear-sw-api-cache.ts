/**
 * Posts a message to the currently controlling service worker instructing it
 * to purge the runtime `/backend` API cache (see app/sw.ts's
 * `PIQ_CLEAR_API_CACHE` message handler and `BACKEND_API_CACHE_NAME`).
 *
 * Call this on sign-out. `backendSwrAllowlist` in app/sw.ts serves cached
 * `/backend` responses stale-then-revalidate — without this purge, a cached
 * response from the outgoing user's session (e.g. a tier-aware market list)
 * could be served instantly to whoever uses this browser next, before the
 * background revalidation catches up.
 *
 * No-ops outside the browser, when Service Workers aren't supported, or when
 * no worker currently controls the page (nothing cached to clear).
 */
export function clearServiceWorkerApiCache(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  navigator.serviceWorker.controller?.postMessage({
    type: "PIQ_CLEAR_API_CACHE",
  });
}
