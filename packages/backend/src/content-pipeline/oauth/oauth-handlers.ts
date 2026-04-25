import { google } from 'googleapis';
import { platformRedirectUri } from './oauth-urls';

export interface ExchangedCredential {
  /** Stored in `accountLabel` — the per-account ID we need at publish time. */
  accountLabel: string;
  /** Stored in `refreshToken` slot — the long-lived (or refreshable) token. */
  refreshToken: string;
}

/**
 * Per-platform code-exchange functions. Each takes the OAuth `code`
 * returned by the platform's authorize redirect and returns the
 * (accountLabel, refreshToken) pair to persist via
 * PlatformCredentialsService.upsertActive.
 *
 * What lives in accountLabel per platform (the publishers depend on this):
 *   youtube_shorts   YT channel handle
 *   tiktok           TikTok @username (or open_id if username unavailable)
 *   instagram_reels  IG user ID (numeric, e.g. 17841405xxxxxx)
 *   facebook_reels   Facebook Page ID
 *   linkedin         organization URN (urn:li:organization:NNN)
 */

export async function exchangeYouTube(
  code: string,
): Promise<ExchangedCredential> {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error('YOUTUBE_OAUTH_* env vars missing');

  const oauth2 = new google.auth.OAuth2(
    clientId,
    clientSecret,
    platformRedirectUri('youtube_shorts'),
  );
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token)
    throw new Error('youtube returned no refresh_token');
  oauth2.setCredentials(tokens);
  const yt = google.youtube({ version: 'v3', auth: oauth2 });
  const channels = await yt.channels.list({ mine: true, part: ['snippet'] });
  const handle =
    channels.data.items?.[0]?.snippet?.customUrl ??
    channels.data.items?.[0]?.snippet?.title ??
    'unknown';
  return { accountLabel: handle, refreshToken: tokens.refresh_token };
}

export async function exchangeTikTok(
  code: string,
): Promise<ExchangedCredential> {
  const clientKey = process.env.TIKTOK_OAUTH_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_OAUTH_CLIENT_SECRET;
  if (!clientKey || !clientSecret)
    throw new Error('TIKTOK_OAUTH_* env vars missing');

  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: platformRedirectUri('tiktok'),
    }).toString(),
  });
  if (!tokenRes.ok) {
    throw new Error(`tiktok token exchange failed: ${await tokenRes.text()}`);
  }
  const tokenJson = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    open_id: string;
  };
  // Best-effort fetch of @username; fall back to open_id if user.info denied.
  let label = tokenJson.open_id;
  try {
    const infoRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=username',
      {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      },
    );
    if (infoRes.ok) {
      const info = (await infoRes.json()) as {
        data?: { user?: { username?: string } };
      };
      label = `@${info.data?.user?.username ?? tokenJson.open_id}`;
    }
  } catch {
    // ignore — open_id is fine
  }
  return { accountLabel: label, refreshToken: tokenJson.refresh_token };
}

interface MetaTokenResponse {
  access_token: string;
  expires_in?: number;
}

async function exchangeMetaCode(
  code: string,
  platform: 'instagram_reels' | 'facebook_reels',
): Promise<string> {
  const appId = process.env.META_GRAPH_APP_ID;
  const appSecret = process.env.META_GRAPH_APP_SECRET;
  if (!appId || !appSecret) throw new Error('META_GRAPH_* env vars missing');

  // 1. short-lived user token
  const shortRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token` +
      `?client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(platformRedirectUri(platform))}` +
      `&client_secret=${appSecret}` +
      `&code=${encodeURIComponent(code)}`,
  );
  if (!shortRes.ok)
    throw new Error(
      `meta short-token exchange failed: ${await shortRes.text()}`,
    );
  const shortJson = (await shortRes.json()) as MetaTokenResponse;

  // 2. exchange for long-lived (60 day) user token
  const longRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&fb_exchange_token=${shortJson.access_token}`,
  );
  if (!longRes.ok)
    throw new Error(`meta long-token exchange failed: ${await longRes.text()}`);
  const longJson = (await longRes.json()) as MetaTokenResponse;
  return longJson.access_token;
}

export async function exchangeInstagram(
  code: string,
): Promise<ExchangedCredential> {
  const userToken = await exchangeMetaCode(code, 'instagram_reels');
  // Find the user's pages, then the IG business account linked to one.
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${userToken}`,
  );
  if (!pagesRes.ok)
    throw new Error(`meta pages list failed: ${await pagesRes.text()}`);
  const pagesJson = (await pagesRes.json()) as {
    data: Array<{ id: string; access_token: string; name: string }>;
  };
  for (const page of pagesJson.data) {
    const igRes = await fetch(
      `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`,
    );
    if (!igRes.ok) continue;
    const igJson = (await igRes.json()) as {
      instagram_business_account?: { id: string };
    };
    if (igJson.instagram_business_account?.id) {
      return {
        accountLabel: igJson.instagram_business_account.id,
        // IG publishing uses the linked Page's access token, not the user token.
        refreshToken: page.access_token,
      };
    }
  }
  throw new Error(
    "no Instagram Business account found on any of the user's Pages",
  );
}

export async function exchangeFacebook(
  code: string,
): Promise<ExchangedCredential> {
  const userToken = await exchangeMetaCode(code, 'facebook_reels');
  // Pick the first Page the user manages. If multiple, the operator will
  // need to manually re-authorize after picking the right page in the UI.
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${userToken}`,
  );
  if (!pagesRes.ok)
    throw new Error(`meta pages list failed: ${await pagesRes.text()}`);
  const pagesJson = (await pagesRes.json()) as {
    data: Array<{ id: string; access_token: string; name: string }>;
  };
  const page = pagesJson.data[0];
  if (!page) throw new Error('no Pages found on the authorized FB account');
  return { accountLabel: page.id, refreshToken: page.access_token };
}

export async function exchangeLinkedIn(
  code: string,
): Promise<ExchangedCredential> {
  const clientId = process.env.LINKEDIN_OAUTH_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error('LINKEDIN_OAUTH_* env vars missing');

  const tokenRes = await fetch(
    'https://www.linkedin.com/oauth/v2/accessToken',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: platformRedirectUri('linkedin'),
      }).toString(),
    },
  );
  if (!tokenRes.ok)
    throw new Error(`linkedin token exchange failed: ${await tokenRes.text()}`);
  const tokenJson = (await tokenRes.json()) as { access_token: string };

  // Discover the first organization the user can administer.
  const orgsRes = await fetch(
    'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization))',
    {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    },
  );
  if (!orgsRes.ok) {
    throw new Error(`linkedin orgs lookup failed: ${await orgsRes.text()}`);
  }
  const orgsJson = (await orgsRes.json()) as {
    elements?: Array<{ organization: string }>;
  };
  const orgUrn = orgsJson.elements?.[0]?.organization;
  if (!orgUrn) {
    throw new Error(
      'no LinkedIn organization with ADMINISTRATOR role found for this user',
    );
  }
  return { accountLabel: orgUrn, refreshToken: tokenJson.access_token };
}

export async function exchangeForPlatform(
  platform: string,
  code: string,
): Promise<ExchangedCredential> {
  switch (platform) {
    case 'youtube_shorts':
      return exchangeYouTube(code);
    case 'tiktok':
      return exchangeTikTok(code);
    case 'instagram_reels':
      return exchangeInstagram(code);
    case 'facebook_reels':
      return exchangeFacebook(code);
    case 'linkedin':
      return exchangeLinkedIn(code);
    default:
      throw new Error(`OAuth exchange not implemented for ${platform}`);
  }
}
