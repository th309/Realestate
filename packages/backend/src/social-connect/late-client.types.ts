/**
 * Shared types, platform maps, and error classes for the Late (getlate.dev /
 * Zernio) API client. Extracted from `late-client.service.ts` to keep that
 * logic file under the CLAUDE.md §1.3 line limit.
 */

/** Default Late API origin + version prefix. Overridable via LATE_API_BASE_URL. */
export const LATE_API_BASE_URL_DEFAULT = 'https://getlate.dev/api/v1';

/** Platforms PropertyIQ exposes through Late. YouTube is EXCLUDED — it keeps its
 *  own direct OAuth integration. */
export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'x';

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'x',
] as const;

/**
 * Map PropertyIQ platform ids to Late's own platform identifiers.
 * Note: X is `twitter` in Late's API — the only id that differs.
 */
export const LATE_PLATFORM_BY_SOCIAL: Record<SocialPlatform, string> = {
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  linkedin: 'linkedin',
  x: 'twitter',
};

/** Reverse lookup: Late platform id → PropertyIQ platform id. */
export const SOCIAL_BY_LATE_PLATFORM: Record<string, SocialPlatform> = {
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  linkedin: 'linkedin',
  twitter: 'x',
};

/** Thrown when LATE_API_KEY is not set. Callers surface a structured 503. */
export class LateNotConfiguredError extends Error {
  constructor() {
    super('LATE_API_KEY is not configured');
    this.name = 'LateNotConfiguredError';
  }
}

/** Thrown when Late returns a non-2xx response. Carries the HTTP status + raw body. */
export class LateApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Raw response body, so callers can inspect e.g. a 409 duplicate payload. */
    readonly body?: string,
  ) {
    super(message);
    this.name = 'LateApiError';
  }
}

export interface LateProfile {
  _id: string;
  name: string;
  color?: string;
  isDefault?: boolean;
}

export interface LateAccount {
  _id: string;
  platform: string;
  profileId?: { _id: string; name?: string; slug?: string } | string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
  profilePicture?: string;
  isActive?: boolean;
}

export interface LateConnectResponse {
  authUrl: string;
  state?: string;
}

/** Late-native publish parameters (already resolved to a Late account id). */
export interface LatePublishParams {
  /** Late account `_id` to publish to. */
  accountId: string;
  /** Late platform id (e.g. 'twitter' for X). */
  platform: string;
  /** Post copy/text. */
  copy: string;
  /** Public URLs of images/video to attach. */
  mediaUrls?: string[];
  /** ISO-8601 time to schedule for; when omitted the post publishes now. */
  scheduledAt?: string;
  /** IANA timezone for the schedule (defaults to UTC). */
  timezone?: string;
  /**
   * Stable idempotency key (our post id) sent as Late's `x-request-id`. Lets a
   * retried publish after a crash de-duplicate at Late instead of double-posting.
   */
  idempotencyKey?: string;
}

export interface LatePublishResult {
  postId?: string;
  platformPostUrl?: string;
  /** True when Late reported this as a duplicate of an already-published post. */
  duplicate?: boolean;
  raw: unknown;
}
