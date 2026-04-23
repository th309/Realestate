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

**Important:** Steps 3 and 4 must be done BEFORE Step 2 in Google's current UI. Google refuses to let you create an OAuth client until the consent screen is configured. Do Steps 3, 4, then 2.

Store the client ID and secret from Step 2 in your password manager. Never commit them to git.

## Step 3: Configure the OAuth consent screen (renamed to "Auth platform" in late 2025)

Google split the old single-page consent screen into four tabs. You fill out all four.

1. In your Cloud project, go to **APIs & Services → OAuth consent screen** (sidebar). In the new UI, this page now shows as **APIs & Services → Auth platform** with a left sub-nav.

2. **Audience** tab
   - Click "Audience" in the left sub-nav.
   - User type: **External**. Save.
   - Scroll to "Test users" and add the email of your test YouTube channel's owner (and your own email if different). Save.
   - Keep "Publishing status" as **Testing**. Do not click "Publish app".

3. **Branding** tab
   - App name: `PropertyIQ Content Pipeline`
   - User support email: your email
   - Authorized domains: add `propertyiq.app`
   - Developer contact information: your email
   - Save.

4. **Data access** tab (where scopes live now)
   - Click "Add or remove scopes".
   - In the scope picker, search for `youtube`.
   - Check these two scopes:
     - `.../auth/youtube.upload` (Manage your YouTube videos)
     - `.../auth/youtube.readonly` (View your YouTube account)
   - Click "Update", then **Save** at the bottom of the Data access page.

5. **Clients** tab
   - Leave empty for now. You'll create the client in Step 2 below.

## Step 2: Create the OAuth client

Now that the consent screen is configured, Google will let you create the client.

1. Still under **APIs & Services → Auth platform**, click the **Clients** tab.
2. Click **Create client**.
3. Application type: **Web application**.
4. Name: `content-pipeline-youtube` (anything, just a label).
5. Authorized redirect URIs: click **Add URI** and paste exactly: `https://developers.google.com/oauthplayground`
   - This single URI lets you get the refresh token via OAuth Playground in Step 4. You do NOT need to add your backend's callback URL because the backend never runs the interactive OAuth flow; it only uses the refresh token saved in env vars.
6. Click **Create**.
7. A dialog shows "Client ID" and "Client secret". Copy both immediately — you can revisit them later but only the client secret stays hidden unless you click a show-icon.

**Fill in below then clear/redact before committing:**

```
Client ID:      <paste>.apps.googleusercontent.com
Client secret:  GOCSPX-<paste>
```

## Step 4: Exchange for a refresh token via OAuth Playground

OAuth Playground is Google's browser tool for getting tokens out of an OAuth app without spinning up your own redirect server.

1. Open https://developers.google.com/oauthplayground/
2. Click the **gear icon** (top right).
3. Check the box: **Use your own OAuth credentials**. **This is not optional.** If you skip this step, OAuth Playground uses its shared credentials and auto-revokes the refresh token after 24 hours — the pipeline will start 502ing YouTube uploads with `invalid_grant` the next day. With your own credentials entered, the refresh token persists until you revoke it manually.
4. Paste the Client ID and Client secret from Step 2. Do NOT close the gear panel yet.
5. Confirm "OAuth flow" is **Server-side** and "Access type" is **Offline** (this is what triggers a refresh token being returned). Then close the panel.
6. In the **left panel "Step 1 Select & authorize APIs"**:
   - Do NOT paste scope URLs into the box at the top. Scroll the list of services below instead.
   - Find "YouTube Data API v3" in the list. Click it to expand.
   - Check both scopes:
     - `https://www.googleapis.com/auth/youtube.readonly`
     - `https://www.googleapis.com/auth/youtube.upload`
   - Click the blue **Authorize APIs** button.
7. Google opens a consent page. Sign in with the **test YouTube channel owner's account** (not any other Google account — it must be one of the Test users you added in Step 3).
8. You'll see a yellow warning: "Google hasn't verified this app". Click **Advanced**, then **Go to PropertyIQ Content Pipeline (unsafe)**. This is normal because your app is in Testing mode. Only Test users can click through this warning.
9. Grant the two scopes.
10. You're redirected back to OAuth Playground at "Step 2 Exchange authorization code for tokens". Click the blue **Exchange authorization code for tokens** button.
11. A panel shows `access_token`, `refresh_token`, and other fields. **Copy the `refresh_token` value** (starts with `1//`). This is the long-lived credential the backend will use.

**Troubleshooting**

- "Error 400: redirect_uri_mismatch" → the redirect URI on your OAuth client doesn't match `https://developers.google.com/oauthplayground`. Go back to Step 2.5 and verify it's set exactly, no trailing slash.
- "Error 403: access_denied" → the Google account you signed in with isn't in the Test users list. Add it in Step 3.2 and retry.
- No `refresh_token` field in the response → Access type wasn't "Offline" in the gear panel. Redo from Step 4.2.
- Accidentally clicked "Publish app" in the Audience tab → roll it back to Testing; or complete Google's app verification (takes weeks). For a single-operator pipeline, always stay in Testing.

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
- **OAuth Playground 24h revocation (trap):** if you generate the refresh token without entering your own OAuth credentials in the Playground's gear panel, Playground uses _its_ shared client — which auto-revokes refresh tokens 24 hours after issue. The pipeline's first day works; day 2 every publish fails with `{"error":"invalid_grant"}`. Fix: redo Step 4 with your own `client_id` + `client_secret` pasted into the gear panel before clicking Authorize APIs. Tokens generated that way persist indefinitely.
- Shorts detection: YouTube auto-detects Shorts by aspect ratio plus the `#Shorts` hashtag in title or description. Our publisher appends `#Shorts` automatically to descriptions; ensure videos are rendered at 9x16 (1080x1920).
- Category ID: we use `22` (People and Blogs) by default; Shorts does not require category to match specific videos.
