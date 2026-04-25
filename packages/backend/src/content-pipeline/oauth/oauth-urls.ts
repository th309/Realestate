import { signState } from '../oauth-state';

const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

const TIKTOK_SCOPES = ['user.info.basic', 'video.publish', 'video.upload'];

// Instagram publishing requires Facebook Login + the Instagram Graph API
// scopes — IG itself doesn't issue tokens directly for business accounts.
const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
];

const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_manage_engagement',
  'publish_video',
  'business_management',
];

const LINKEDIN_SCOPES = [
  'r_liteprofile',
  'r_organization_social',
  'rw_organization_admin',
  'w_member_social',
  'w_organization_social',
];

function redirectUri(platform: string): string {
  const base = process.env.APP_BASE_URL;
  if (!base) throw new Error('APP_BASE_URL not configured');
  return `${base}/api/admin/content-pipeline/platforms/${platform}/oauth-callback`;
}

/**
 * Per-platform "start OAuth" URL builders. Each builder requires its
 * respective env var(s) to be set; they throw a descriptive error
 * otherwise so the operator sees which env var is missing.
 *
 * All callbacks land on the same controller route — see
 * `oauth-handlers.ts` for the per-platform code-exchange dispatch.
 */
export function buildOAuthUrl(platform: string): string {
  const state = encodeURIComponent(signState(platform));
  switch (platform) {
    case 'youtube_shorts': {
      const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
      if (!clientId) throw new Error('YOUTUBE_OAUTH_CLIENT_ID not configured');
      return (
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri(platform))}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(YOUTUBE_SCOPES.join(' '))}` +
        `&access_type=offline&prompt=consent` +
        `&state=${state}`
      );
    }
    case 'tiktok': {
      const clientKey = process.env.TIKTOK_OAUTH_CLIENT_KEY;
      if (!clientKey) throw new Error('TIKTOK_OAUTH_CLIENT_KEY not configured');
      return (
        `https://www.tiktok.com/v2/auth/authorize/` +
        `?client_key=${clientKey}` +
        `&scope=${encodeURIComponent(TIKTOK_SCOPES.join(','))}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri(platform))}` +
        `&state=${state}`
      );
    }
    case 'instagram_reels': {
      const appId = process.env.META_GRAPH_APP_ID;
      if (!appId) throw new Error('META_GRAPH_APP_ID not configured');
      return (
        `https://www.facebook.com/v21.0/dialog/oauth` +
        `?client_id=${appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri(platform))}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(INSTAGRAM_SCOPES.join(','))}` +
        `&state=${state}`
      );
    }
    case 'facebook_reels': {
      const appId = process.env.META_GRAPH_APP_ID;
      if (!appId) throw new Error('META_GRAPH_APP_ID not configured');
      return (
        `https://www.facebook.com/v21.0/dialog/oauth` +
        `?client_id=${appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri(platform))}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(FACEBOOK_SCOPES.join(','))}` +
        `&state=${state}`
      );
    }
    case 'linkedin': {
      const clientId = process.env.LINKEDIN_OAUTH_CLIENT_ID;
      if (!clientId) throw new Error('LINKEDIN_OAUTH_CLIENT_ID not configured');
      return (
        `https://www.linkedin.com/oauth/v2/authorization` +
        `?response_type=code` +
        `&client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri(platform))}` +
        `&scope=${encodeURIComponent(LINKEDIN_SCOPES.join(' '))}` +
        `&state=${state}`
      );
    }
    default:
      throw new Error(`OAuth start URL not implemented for ${platform}`);
  }
}

export function platformRedirectUri(platform: string): string {
  return redirectUri(platform);
}
