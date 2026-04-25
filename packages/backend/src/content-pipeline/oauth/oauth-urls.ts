import { signState } from '../oauth-state';
import type { PlatformAppCredentialsService } from '../platform-app-credentials.service';

const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

const TIKTOK_SCOPES = ['user.info.basic', 'video.publish', 'video.upload'];

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
  // Trim trailing slash so APP_BASE_URL=http://localhost:3001/ and
  // APP_BASE_URL=http://localhost:3001 produce the same redirect URI.
  // LinkedIn (and most providers) compare the registered value
  // byte-for-byte; a stray // would fail the match.
  return `${base.replace(/\/$/, '')}/api/admin/content-pipeline/platforms/${platform}/oauth-callback`;
}

/**
 * Per-platform "start OAuth" URL builders. Resolves app credentials via
 * PlatformAppCredentialsService (DB-first then env). Throws a descriptive
 * "App credentials not configured" error when neither path has been set
 * up — the frontend uses that to prompt the operator to enter credentials
 * via the Configure dialog.
 */
export async function buildOAuthUrl(
  platform: string,
  appCreds: PlatformAppCredentialsService,
): Promise<string> {
  const state = encodeURIComponent(signState(platform));
  const creds = await appCreds.resolve(platform);
  if (!creds) {
    throw new Error(
      `app credentials not configured for ${platform} — open the Configure dialog`,
    );
  }
  switch (platform) {
    case 'youtube_shorts':
      return (
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${creds.clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri(platform))}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(YOUTUBE_SCOPES.join(' '))}` +
        `&access_type=offline&prompt=consent` +
        `&state=${state}`
      );
    case 'tiktok':
      return (
        `https://www.tiktok.com/v2/auth/authorize/` +
        `?client_key=${creds.clientId}` +
        `&scope=${encodeURIComponent(TIKTOK_SCOPES.join(','))}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri(platform))}` +
        `&state=${state}`
      );
    case 'instagram_reels':
      return (
        `https://www.facebook.com/v21.0/dialog/oauth` +
        `?client_id=${creds.clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri(platform))}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(INSTAGRAM_SCOPES.join(','))}` +
        `&state=${state}`
      );
    case 'facebook_reels':
      return (
        `https://www.facebook.com/v21.0/dialog/oauth` +
        `?client_id=${creds.clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri(platform))}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(FACEBOOK_SCOPES.join(','))}` +
        `&state=${state}`
      );
    case 'linkedin':
      return (
        `https://www.linkedin.com/oauth/v2/authorization` +
        `?response_type=code` +
        `&client_id=${creds.clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri(platform))}` +
        `&scope=${encodeURIComponent(LINKEDIN_SCOPES.join(' '))}` +
        `&state=${state}`
      );
    default:
      throw new Error(`OAuth start URL not implemented for ${platform}`);
  }
}

export function platformRedirectUri(platform: string): string {
  return redirectUri(platform);
}
