/**
 * Cross-origin map imagery that bypasses Serwist's defaultCache.
 *
 * PRECAUTION, not a fix for an observed failure. Added while chasing a
 * production 503 on Street View images that turned out to be client-side (a
 * browser extension or AV rule on one machine — the same URL loaded fine in
 * Firefox and from a different origin in the same Chrome). Unregistering the
 * service worker entirely did NOT change the 503, so the SW was ruled out.
 *
 * It is kept because the reasoning behind `supabaseStorageNetworkOnly` in
 * app/sw.ts applies here too: cross-origin <img> loads yield OPAQUE responses,
 * and each Street View URL carries a signature bound to its exact query, so a
 * re-mint produces a different URL. Caching them is waste at best. Note Mapbox
 * static images are also opaque cross-origin and work fine through
 * defaultCache, so opaque responses are not universally a problem.
 *
 * Scoped to the Street View endpoints specifically rather than all of
 * maps.googleapis.com, so any future Google Maps service we adopt has to make
 * a deliberate decision about its own caching rather than silently inheriting
 * NetworkOnly. Mapbox is deliberately excluded: it works through defaultCache
 * today, and widening this would change behaviour that is not broken.
 *
 * Caching these would be near-useless anyway — each URL carries a signature
 * bound to its exact query, so a re-mint produces a different URL.
 */
export function isOpaqueMapImageryUrl(url: URL): boolean {
  return (
    url.hostname === "maps.googleapis.com" &&
    url.pathname.startsWith("/maps/api/streetview")
  );
}
