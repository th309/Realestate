/**
 * Canonical public site URL resolution.
 *
 * Any URL that is emailed or handed to an EXTERNAL user (beta invites, signup
 * links, etc.) MUST point to the live site — never to a developer's localhost.
 *
 * `NEXT_PUBLIC_APP_URL` is `http://localhost:3000` in local dev, and because the
 * admin/feedback "Add Tester" flow can run from a local dev server with a live
 * RESEND_API_KEY, a real invite email once went out with a localhost link that
 * the recipient could not open ("can't access the site", 2026-06-15). We ignore
 * the env var whenever it resolves to localhost and fall back to the production
 * host, so external-facing links are always reachable.
 */

const CANONICAL_SITE_URL = "https://www.propertyiq.app";

const LOCALHOST_PATTERN = /(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i;

export function isLocalhostUrl(url: string): boolean {
  return LOCALHOST_PATTERN.test(url);
}

/**
 * The canonical public site URL, with any trailing slash stripped.
 * Returns the configured `NEXT_PUBLIC_APP_URL` unless it points at localhost,
 * in which case the production host is used.
 */
export function getPublicSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(
    /\/+$/,
    "",
  );
  if (configured && !isLocalhostUrl(configured)) {
    return configured;
  }
  return CANONICAL_SITE_URL;
}
