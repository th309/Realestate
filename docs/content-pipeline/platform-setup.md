# Platform OAuth Setup

How to register PropertyIQ as an OAuth app on each of the 5 social platforms and wire the credentials into the backend.

These steps are one-time per platform (and per environment — staging vs prod). Once a platform's app credentials are set as env vars, the **Connect** button in `/admin/content-pipeline/platforms` walks an operator through authorizing PropertyIQ to publish on behalf of a specific account.

> **Important:** The OAuth code is already wired (Task 2.22). Setting these env vars is the only remaining step to make Connect work for each platform.

---

## Common: callback redirect URI

Every platform needs the same callback registered:

```
https://backend-production-ee4d.up.railway.app/api/admin/content-pipeline/platforms/<platform>/oauth-callback
```

Replace `<platform>` per platform: `youtube_shorts`, `tiktok`, `instagram_reels`, `facebook_reels`, `linkedin`.

For local dev, use `http://localhost:3001/api/admin/content-pipeline/platforms/<platform>/oauth-callback`.

`APP_BASE_URL` env var on the backend MUST match (without the path), e.g. `APP_BASE_URL=https://backend-production-ee4d.up.railway.app`.

---

## YouTube Shorts (already live in P1)

Already documented in P1 setup. Required env vars: `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`.

---

## TikTok

1. Go to [TikTok for Developers](https://developers.tiktok.com/) → **Manage apps** → **Connect an app**.
2. Pick **Login Kit + Content Posting API** as required products.
3. Under **App details**, set Web platform with callback URL = the canonical callback (above).
4. Submit for review — TikTok requires app review for `video.publish` scope before posts go public. (You can test in sandbox mode against your own dev account immediately, no review needed.)
5. Copy **Client Key** and **Client Secret** into Railway env:
   ```
   TIKTOK_OAUTH_CLIENT_KEY=aw...
   TIKTOK_OAUTH_CLIENT_SECRET=...
   TIKTOK_OAUTH_REDIRECT_URI=https://backend-production-ee4d.up.railway.app/api/admin/content-pipeline/platforms/tiktok/oauth-callback
   ```
6. Click **Connect** in `/admin/content-pipeline/platforms` → authorize as the @PropertyIQ account → done. The connection stores the @username in `accountLabel` and the refresh token (encrypted) in DB.

---

## Instagram Reels

Instagram publishing is via **Meta Graph API** with **Facebook Login** — IG itself doesn't issue tokens directly for business accounts. PropertyIQ needs an Instagram **Business** account linked to a Facebook **Page**.

1. Go to [Meta for Developers](https://developers.facebook.com/) → **My Apps** → **Create App** (type: Business).
2. Add the **Facebook Login for Business** product. Configure redirect URI = the canonical callback for `instagram_reels`.
3. Add the **Instagram Graph API** product.
4. Under **App Review** request these scopes (you'll need to submit for each):
   - `instagram_basic`
   - `instagram_content_publish` ← critical
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`
5. While in dev mode, only test users can authorize — add your own FB account as a tester.
6. Verify your IG Business account is linked to a Facebook Page (Meta Business Suite → Settings → Accounts → Instagram).
7. Copy **App ID** and **App Secret** into Railway env (these are shared with Facebook below):
   ```
   META_GRAPH_APP_ID=...
   META_GRAPH_APP_SECRET=...
   ```
8. Click **Connect** for Instagram → the OAuth handler fetches your Pages, finds the one with an `instagram_business_account`, stores the IG user ID (numeric) in `accountLabel` and the Page Access Token in the credential row.

**Common gotchas:**

- "No Instagram Business account found" → your IG account is Personal/Creator, not Business. Convert it via the IG app: Settings → Account → Switch to Professional Account → Business.
- The IG account MUST be linked to a Page you administer.

---

## Facebook Reels

Same Meta app as Instagram (the App ID + Secret are shared). Different scopes.

1. In the same Meta app you used for IG, ensure these scopes are approved:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `pages_manage_engagement`
   - `publish_video` ← critical
   - `business_management`
2. Add the canonical callback URL for `facebook_reels` to the OAuth redirect list.
3. Click **Connect** for Facebook → handler picks the first Page you manage and stores its ID in `accountLabel` + Page Access Token.

**Page selection caveat:** if you administer multiple Pages, the handler picks the first one returned by `/me/accounts`. To target a specific Page, temporarily downgrade your other Page roles or contact the dev team to add a page-picker UI (out of P2 scope).

---

## LinkedIn

LinkedIn publishing requires a **Company Page** the operator administers — personal-profile posts use a different (more limited) API surface.

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/) → **Create app**.
2. Associate the app with your LinkedIn **Company Page** (e.g. "PropertyIQ").
3. Under **Products**, request access to:
   - **Sign In with LinkedIn using OpenID Connect**
   - **Marketing Developer Platform** (for `w_organization_social`) ← may require approval; LinkedIn reviews within ~5 business days.
   - **Share on LinkedIn** if available
4. Under **Auth**, set redirect URL = the canonical callback for `linkedin`.
5. Note the **Client ID** and **Client Secret**:
   ```
   LINKEDIN_OAUTH_CLIENT_ID=...
   LINKEDIN_OAUTH_CLIENT_SECRET=...
   ```
6. Click **Connect** → handler exchanges the code, queries `/v2/organizationAcls?role=ADMINISTRATOR` to find your Company Page's URN, stores `urn:li:organization:NNN` in `accountLabel` + access token in the credential row.

**Common gotchas:**

- "no LinkedIn organization with ADMINISTRATOR role" → you authenticated with a personal LinkedIn account that doesn't admin a Company Page. Either create a Company Page or assign your account as admin on an existing one.
- LinkedIn access tokens are 60 days. The system stores them in the same `refreshToken` slot as other platforms; LinkedIn supports refresh tokens only for approved partners. For now, expect to re-authorize every 60 days until approved.

---

## Verifying a connection

After clicking Connect and being redirected back:

1. The `/admin/content-pipeline/platforms` page should show the platform with a **green configured** indicator and the account label.
2. Trigger a test run (`/admin/content-pipeline/new`, pick the platform in `selectedPlatforms`, set `approval_mode=draft`).
3. After the run reaches `published` (with draft mode), check the platform-side admin/composer for the draft post:
   - **TikTok:** drafts appear in the user's app inbox under "Posted by you"
   - **Instagram:** the container is unpublished — visit `https://graph.facebook.com/<container_id>?fields=status_code&access_token=<token>` to confirm
   - **Facebook:** Page → Publishing Tools → Drafts
   - **LinkedIn:** Company Page admin → Activity → Drafts
   - **YouTube:** Studio → Content → Drafts (or `private` videos depending on mode)

---

## Disconnecting

`/admin/content-pipeline/platforms` → **Disconnect** button on any connected row marks the credential as `disconnected_at = now()`. Future publishes will fail with "X not connected" until reconnected. Existing posts on the platform are not affected.
