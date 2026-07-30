/**
 * Browser privacy signals: Global Privacy Control and Do Not Track.
 *
 * Deliberately dependency-free. Both the first-party tracker and
 * sentry.client.config.ts consult this, and Sentry initialises before the app
 * does, so importing anything with side effects here would pull the app's
 * module graph into the Sentry bundle and change boot order.
 *
 * This is a compliance control, not a courtesy. The Privacy Policy names both
 * signals as the self-service way to limit first-party analytics and session
 * recording, so ignoring either would make a published legal document false.
 *
 * GPC is the modern signal and is legally binding in several US states. DNT is
 * legacy and widely ignored by other vendors, but honouring it costs nothing
 * and we said we would.
 */

/**
 * Read once and cache. Both signals are static for the lifetime of the
 * document, so re-reading navigator on every event is pure overhead — and the
 * tracker calls this on every single event.
 */
let cached: boolean | undefined;

export function hasOptedOutOfTracking(): boolean {
  if (cached !== undefined) return cached;

  // SSR and Node test environments have no navigator. Absence of a signal is
  // not consent to opt out, so default to false rather than suppressing
  // everything during server rendering.
  if (typeof navigator === "undefined") return false;

  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean })
    .globalPrivacyControl;

  // Only the exact string "1" means opted out. Browsers report "unspecified",
  // "0", or null when the user has expressed nothing, and treating any
  // non-null value as opt-out would silently disable analytics for everyone.
  cached = gpc === true || navigator.doNotTrack === "1";
  return cached;
}

/** Test seam. Never call this in application code. */
export function resetPrivacySignalCacheForTests(): void {
  cached = undefined;
}
