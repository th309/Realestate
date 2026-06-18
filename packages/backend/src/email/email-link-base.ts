import { ConfigService } from '@nestjs/config';

/** Canonical public app URL used when no real public URL is configured. */
const CANONICAL_PUBLIC_URL = 'https://propertyiq.app';

const NON_PUBLIC =
  /localhost|127\.0\.0\.1|0\.0\.0\.0|\.local(?::|\/|$)|^https?:\/\/192\.168\./i;

/**
 * Base URL for links embedded in emails.
 *
 * Emails are delivered to real inboxes regardless of which environment sends
 * them, so a link must NEVER point at localhost / a dev host — that is always
 * wrong. Resolution order:
 *   1. EMAIL_LINK_BASE_URL (explicit override),
 *   2. FRONTEND_URL — but only if it is a real public URL (local dev sets this
 *      to http://localhost:3000, which we reject),
 *   3. the canonical production URL.
 * Trailing slash is stripped so callers can append paths directly.
 */
export function getEmailLinkBaseUrl(config: ConfigService): string {
  const candidates = [
    config.get<string>('EMAIL_LINK_BASE_URL'),
    config.get<string>('FRONTEND_URL'),
  ];
  for (const url of candidates) {
    if (url && url.trim() && !NON_PUBLIC.test(url)) {
      return url.trim().replace(/\/+$/, '');
    }
  }
  return CANONICAL_PUBLIC_URL;
}
