# YouTube Shorts Platform Setup

This document walks through the one-time OAuth setup for the YouTube Shorts publisher in the PropertyIQ Content Pipeline.

## Prerequisites

- A test YouTube channel, separate from your production PropertyIQ channel. If you publish tests to your main channel, your audience sees them.
- A Google Cloud project with the YouTube Data API v3 enabled.
- Owner access to both.

## Step 1: Create a Google Cloud project

1. Go to https://console.cloud.google.com/ and create a new project (e.g. `piq-content-pipeline`).
2. Navigate to APIs and Services, Library.
3. Search for "YouTube Data API v3" and enable it.
4. Search for "YouTube Analytics API" and enable it (for P1 24h metrics).

## Step 2: Create OAuth client

1. In the same project, go to APIs and Services, Credentials.
2. Click "Create credentials", "OAuth client ID".
3. Application type: "Web application".
4. Authorized redirect URIs: add your backend's callback URL.
   - Local development: `http://localhost:3001/api/admin/content-pipeline/platforms/youtube_shorts/oauth-callback`
   - Staging: `https://<staging-domain>/api/admin/content-pipeline/platforms/youtube_shorts/oauth-callback`
5. Save. Copy the client ID and client secret.

## Step 3: OAuth consent screen

1. Navigate to APIs and Services, OAuth consent screen.
2. User type: External.
3. Fill in app name, user support email, developer contact. App domain: `propertyiq.app`.
4. Scopes: add `https://www.googleapis.com/auth/youtube.upload` and `https://www.googleapis.com/auth/youtube.readonly`.
5. Test users: add the email of the test YouTube channel's owner.
6. Save. Do not publish (keeps us in test mode; we do not need public OAuth consent for a single-operator pipeline).

## Step 4: Exchange for a refresh token

Either use the Connect button in the admin UI (Platforms page, YouTube Shorts row), or use the OAuth Playground:

1. Go to https://developers.google.com/oauthplayground/
2. In the gear icon, "Use your own OAuth credentials", paste client ID and secret.
3. In the left panel, find YouTube Data API v3, select the two scopes.
4. Click "Authorize APIs", sign in with the test channel owner, grant access.
5. Click "Exchange authorization code for tokens". Copy the refresh token.

## Step 5: Configure environment variables

Set in Railway dashboard (production/staging) or `packages/backend/.env` (local):

```
YOUTUBE_OAUTH_CLIENT_ID=<client-id>.apps.googleusercontent.com
YOUTUBE_OAUTH_CLIENT_SECRET=<secret>
YOUTUBE_OAUTH_REFRESH_TOKEN=1//<refresh-token>
APP_BASE_URL=https://<staging-or-local-host>
```

Per project rules, `.env` edits affect LOCAL ONLY. Set production and staging values in the Railway dashboard.

## Step 6: Smoke-test with curl

```bash
# Get a fresh access token
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=$YOUTUBE_OAUTH_CLIENT_ID" \
  -d "client_secret=$YOUTUBE_OAUTH_CLIENT_SECRET" \
  -d "refresh_token=$YOUTUBE_OAUTH_REFRESH_TOKEN" \
  -d "grant_type=refresh_token"

# Use the access_token from the response to verify the channel
curl -H "Authorization: Bearer <access_token>" \
  "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true"
```

Expected: a JSON response with your test channel's snippet.

## Rate limits

YouTube Data API v3 has a default quota of 10,000 units per day. An upload costs 1,600 units. This gives roughly 6 uploads per day before quota exhaustion. For higher volumes, request a quota increase through the Google Cloud console.

## Known issues

- OAuth token refresh: Google rotates refresh tokens when the consent screen is in production mode but not in test mode. We stay in test mode for simplicity.
- Shorts detection: YouTube auto-detects Shorts by aspect ratio plus the `#Shorts` hashtag in title or description. Our publisher appends `#Shorts` automatically to descriptions; ensure videos are rendered at 9x16 (1080x1920).
- Category ID: we use `22` (People and Blogs) by default; Shorts does not require category to match specific videos.
