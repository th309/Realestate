import { Serwist } from "@serwist/window";

/**
 * Registers the Serwist service worker (production only) and reports when an
 * updated worker is waiting to activate.
 *
 * `onUpdateWaiting` fires once a new worker enters the "waiting" state; it
 * receives an `applyUpdate` callback that the caller should invoke ONLY in
 * response to explicit user action (e.g. tapping "Refresh" on a toast) —
 * this module never activates a waiting worker on its own. Calling
 * `applyUpdate` posts `{ type: "SKIP_WAITING" }` to the waiting worker; once
 * it takes control, the page is reloaded exactly once.
 *
 * No-ops outside production or in browsers without Service Worker support.
 */
export function registerServiceWorker(
  onUpdateWaiting: (applyUpdate: () => void) => void,
): void {
  if (process.env.NODE_ENV !== "production") return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const serwist = new Serwist("/sw.js");
  let hasReloaded = false;

  serwist.addEventListener("waiting", () => {
    onUpdateWaiting(() => serwist.messageSkipWaiting());
  });

  serwist.addEventListener("controlling", () => {
    if (hasReloaded) return;
    hasReloaded = true;
    window.location.reload();
  });

  serwist.register();
}
