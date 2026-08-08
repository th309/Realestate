/**
 * Which routes wear the dark application chrome.
 *
 * The route groups do NOT map onto the marketing/tools split: `app/(app)/`
 * holds the homepage, the blog, about, and pricing alongside the five tools,
 * while `app/(public)/` holds the indexed SEO pages. So chrome is chosen by
 * path, not by route group — `AppChrome` reads this and renders the dark
 * `AppBar` for tools and authed account surfaces, and the light marketing
 * `Header` for everything else.
 */
export const APP_CHROME_ROUTES = [
  "/dashboard",
  "/map",
  "/analyzer",
  "/screener",
  "/reports",
  "/market",
  "/account",
  "/admin",
  "/alerts",
  "/org",
  "/team",
] as const;

/**
 * Segment-bounded match, deliberately not `startsWith`.
 *
 * `/markets` is the public SEO route group and `/market` is the authed tool.
 * A bare prefix test would hand every indexed `/markets/<slug>` page the dark
 * application bar, so a route matches only on an exact hit or a full segment
 * boundary.
 */
export function isAppChromeRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return APP_CHROME_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
