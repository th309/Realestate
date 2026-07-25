import { BadRequestException, Logger } from '@nestjs/common';

/**
 * Redirect-safety helpers for the Late OAuth flow. Extracted from the service
 * (§1.3) and kept together because they are one concern: where Late may send
 * the user back, and rejecting anywhere PropertyIQ does not own (open-redirect
 * guard — AdminGuard is not enough on its own).
 */

const logger = new Logger('SocialConnectRedirect');

export function resolveAppBaseUrl(): string {
  return (process.env.APP_BASE_URL?.trim() || 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
}

/**
 * Default post-consent redirect. The `late_connected` marker lets the platforms
 * page reconcile even when the popup was blocked and a full-page redirect was
 * used instead — see the wall's on-mount sync.
 *
 * The `late_connected` param name is coordinated with the frontend's single
 * source of truth: platforms/redirect-params.ts (LATE_CONNECTED_PARAM). It must
 * not collide with the YouTube direct-OAuth callback's `connected`/`error`
 * params, which land on the same page.
 */
export function defaultRedirectUrl(): string {
  return `${resolveAppBaseUrl()}/admin/content-pipeline/platforms?late_connected=1`;
}

/** Origins a caller-supplied redirectUrl may point at. */
export function allowedRedirectOrigins(): Set<string> {
  const origins = new Set<string>();
  try {
    origins.add(new URL(resolveAppBaseUrl()).origin);
  } catch {
    /* resolveAppBaseUrl is always a valid origin, but stay defensive */
  }
  const extra = process.env.SOCIAL_CONNECT_ALLOWED_ORIGINS?.trim();
  if (extra) {
    for (const raw of extra.split(',')) {
      const candidate = raw.trim();
      if (!candidate) continue;
      try {
        origins.add(new URL(candidate).origin);
      } catch {
        logger.warn(`Ignoring invalid allowed origin: ${candidate}`);
      }
    }
  }
  return origins;
}

/** Reject any redirectUrl not on a PropertyIQ-owned origin. */
export function assertAllowedRedirect(url: string): void {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    throw new BadRequestException('redirectUrl is not a valid URL');
  }
  if (!allowedRedirectOrigins().has(origin)) {
    throw new BadRequestException(
      'redirectUrl must point at a PropertyIQ origin',
    );
  }
}
