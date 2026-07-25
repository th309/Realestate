// packages/backend/src/content-pipeline/social-platforms.ts
//
// Allow-list of social platforms used by the content feed + brand kit DTOs.
//
// NOTE: the social-connect module (another agent, packages/backend/src/social-connect/)
// owns the canonical `SOCIAL_PLATFORMS` / `SocialPlatform` used by its
// PublishViaConnectionDto. That module is not in this checkout yet, so importing
// from it would break the build (TS2307). This constant mirrors the Late-publishable
// set and MUST be reconciled with social-connect/late-client.types.ts once it lands
// (unify to a single source, likely re-exporting from social-connect).

/** Platforms publishable through the Late aggregator. */
export const SOCIAL_PLATFORMS = [
  'linkedin',
  'facebook',
  'instagram',
  'tiktok',
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/**
 * All platforms a brand can target / a post can be produced for. YouTube is
 * included here but is deliberately NOT a SocialPlatform: it publishes via the
 * direct YouTube integration (Phase 5), never through Late.
 */
export const PUBLISH_PLATFORMS = [...SOCIAL_PLATFORMS, 'youtube'] as const;
export type PublishPlatform = (typeof PUBLISH_PLATFORMS)[number];
