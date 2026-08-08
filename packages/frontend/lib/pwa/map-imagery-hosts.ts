/**
 * Cross-origin map imagery that must bypass Serwist's defaultCache.
 *
 * Street View images are loaded cross-origin via <img>, so the browser hands
 * the service worker an OPAQUE response. defaultCache's generic cross-origin
 * route runs Serwist's copyResponse on it, which throws
 * `cross-origin-copy-response` on an opaque body — the handler then
 * synthesizes a 503. The image fails in the browser while a direct curl of the
 * identical URL returns 200, and nothing in the app's own logs shows a cause.
 *
 * This is the same failure already documented for Supabase Storage in
 * app/sw.ts; see `supabaseStorageNetworkOnly` there.
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
