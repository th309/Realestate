# Content Pipeline Platform OAuth — Design Spec

**Date:** 2026-04-23
**Author:** th309
**Status:** Draft — pending user review before implementation planning
**Related:** `docs/content-pipeline/implementation-plan.md` (Task 1.25), `docs/content-pipeline/platform-setup/youtube.md`, `docs/content-pipeline/deploy-state.md`

---

## Problem

The content-pipeline's YouTube Shorts publisher reads `YOUTUBE_OAUTH_*` env vars at runtime. The refresh token was generated via OAuth Playground _without_ entering the project's own OAuth client credentials — so Google's Playground service auto-revoked it 24 hours after issue. Today (2026-04-23), three approved runs failed at the publish step with `{"error":"invalid_grant"}`. No video has ever successfully published to YouTube through this pipeline.

Regenerating via Playground buys another 24 hours. It's not a real solution. We need the operator to click a **Connect** button in the admin UI, complete Google's OAuth consent against the project's own OAuth client, and have the resulting refresh token persist indefinitely in an encrypted DB row.

The target channel is **@propertyIQ_app** (Google account managing that channel is not necessarily th309's personal account).

## Goals

- Operator connects YouTube Shorts from the admin UI without touching env vars or OAuth Playground.
- Refresh token stored encrypted in Supabase Postgres, not scattered across `.env.local` + Railway dashboards.
- Single source of truth: env-var fallback is removed. If no DB credential exists for a platform, `isConfigured()` returns false and the publisher refuses to run with a clear error.
- Pre-wire `/admin/content-pipeline/platforms` with all six platform rows; disable Connect for the five P2/P3 platforms that don't yet have publishers.

## Non-goals

- Multi-account support per platform. One connected credential per platform, enforced by unique index.
- Automated token-health probe cron (deferred to P4 per `implementation-plan.md` Task 4.10).
- OAuth flows for TikTok / Instagram Reels / Facebook Reels / LinkedIn / YouTube Long — those land with their publishers in P2/P3.
- Multi-tenant user ownership of credentials. Single-admin system.

## Success criteria

1. Migration `20260423000200_platform_credentials.sql` applies cleanly to the shared Supabase project.
2. Operator opens `/admin/content-pipeline/platforms`, clicks Connect on YouTube Shorts, completes Google consent with the @propertyIQ_app channel, lands back on `/platforms` with a snackbar "Connected · @propertyIQ_app".
3. The failed Miami or Bloomington run is retried and publishes successfully to @propertyIQ_app.
4. Operator clicks Disconnect (with confirmation), DB row's `disconnected_at` is populated, `isConfigured()` returns false, publisher throws a clear error on the next publish attempt.
5. After cutover, `YOUTUBE_OAUTH_REFRESH_TOKEN` env var is removed from Railway prod + dev + local `.env.local` with no impact on operation.

---

## Approach

**Backend-hosted OAuth callback with stateless HMAC-signed state parameter.** (Chosen over frontend-hosted callback for simpler routing and no JS hop.)

### Flow

```
1. Operator clicks Connect on /admin/content-pipeline/platforms
   → Frontend POST /api/admin/content-pipeline/platforms/youtube_shorts/oauth-start
   ← Backend returns { authUrl } containing signed state
   → Frontend window.location.assign(authUrl)

2. Google consent screen (operator picks @propertyIQ_app channel, grants scopes)
   → Google 302 to backend callback:
     GET /api/admin/content-pipeline/platforms/youtube_shorts/oauth-callback?code=<X>&state=<Y>

3. Backend callback
   - Verify state: split on '.', recompute HMAC, check exp > now, check platform matches URL
   - Exchange code for tokens: googleapis OAuth2.getToken(code) → { refresh_token, access_token }
   - Fetch channel handle: youtube.channels.list({ mine: true }) → snippet.customUrl
   - Upsert DB: platform_credentials row (platform, account_label, refresh_token_enc)
   - 302 redirect to ${FRONTEND_URL}/admin/content-pipeline/platforms?connected=youtube_shorts&label=@propertyIQ_app

4. Platforms page on mount
   - Reads ?connected / ?error / ?label from URL
   - Shows M3 snackbar, refetches statuses, router.replace to clean URL
```

### Publisher auth

`YouTubeShortsPublisher.getAuth()` reads `refresh_token_enc` from `platform_credentials` via `PlatformCredentialsService`, decrypts it with `CredentialCrypto`, instantiates `google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET)` with the decrypted refresh token. No env-var fallback. `isConfigured()` returns `true` iff an active (non-disconnected) row exists for the platform.

Client ID and client secret remain as env vars — they are app-level credentials that do not rotate per user.

---

## Schema

### Migration: `supabase/migrations/20260423000200_platform_credentials.sql`

```sql
CREATE TABLE IF NOT EXISTS platform_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  account_label text,
  refresh_token_enc text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_credentials_platform_active_uniq
  ON platform_credentials (platform)
  WHERE disconnected_at IS NULL;

CREATE INDEX IF NOT EXISTS platform_credentials_platform_idx
  ON platform_credentials (platform);

GRANT SELECT, INSERT, UPDATE, DELETE ON platform_credentials TO service_role, authenticated;

COMMENT ON TABLE platform_credentials IS
  'Encrypted OAuth refresh tokens for content-pipeline platform publishers. One active row per platform; re-connects upsert. Soft-deletes via disconnected_at for audit history.';
COMMENT ON COLUMN platform_credentials.refresh_token_enc IS
  'CredentialCrypto.encrypt(refresh_token) — AES-256-GCM with PLATFORM_CREDENTIALS_ENCRYPTION_KEY.';
COMMENT ON COLUMN platform_credentials.account_label IS
  'Human-readable account identifier. For YouTube: channel customUrl (e.g. @propertyIQ_app).';
```

### Deliberate omissions

- **`access_token_enc` / `token_expires_at`:** `googleapis.OAuth2` refreshes access tokens on demand from the refresh token. Storing access tokens is dead weight for our publish cadence and adds a consistency problem (stored access token can expire between fetch and use).
- **`scopes` column:** scopes are constants at our call site (`platform-manager.service.ts:41-43`). If we ever request variable scopes per run we add a JSONB column then.
- **`user_id` / ownership column:** single-admin system, enforced at AdminGuard. Multi-tenant is a much larger change; out of scope.

### Soft-delete rationale

`disconnected_at` lets the callback upsert cleanly on re-connect (update an existing row rather than DELETE-then-INSERT) and preserves an audit trail of when a platform was disconnected and why. The unique partial index ensures only one _active_ row per platform at a time.

---

## Backend

### New service: `platform-credentials.service.ts` (<200 lines)

Three public methods:

```ts
class PlatformCredentialsService {
  async getActive(platform: string): Promise<{
    refreshToken: string;
    accountLabel: string | null;
    connectedAt: Date;
  } | null>;

  async upsertActive(
    platform: string,
    accountLabel: string,
    refreshToken: string,
  ): Promise<void>;

  async disconnect(platform: string): Promise<void>;
}
```

`upsertActive` updates the active row (`disconnected_at IS NULL`) if one exists, else inserts a new row; re-sets `disconnected_at = null` if the row was previously disconnected. `disconnect` sets `disconnected_at = now()` on the active row. `getActive` decrypts and returns the active row, or null if none.

Dependencies: `SupabaseService`, `CredentialCrypto` (already exists at `drivers/credential-crypto.ts`).

### Controller additions: `content-pipeline.controller.ts`

```ts
@Post('platforms/:platform/oauth-start')
@UseGuards(AdminGuard)
async oauthStart(@Param('platform') platform: string)
  → { data: { authUrl: string } }

@Get('platforms/:platform/oauth-callback')
async oauthCallback(
  @Param('platform') platform: string,
  @Query('code') code: string,
  @Query('state') state: string,
  @Query('error') error: string | undefined,
  @Res() res: Response,
) → 302 redirect

@Delete('platforms/:platform/credentials')
@UseGuards(AdminGuard)
async disconnect(@Param('platform') platform: string)
  → { data: { success: true } }
```

### State parameter

`PlatformManagerService.startOAuth(platform)` generates the state alongside the authUrl:

```ts
const payload = {
  platform,
  nonce: randomUUID(),
  exp: Math.floor(Date.now() / 1000) + 600,
}; // 10 min
const payloadB64 = base64url(JSON.stringify(payload));
const sig = hmacSha256(
  payloadB64,
  PLATFORM_CREDENTIALS_ENCRYPTION_KEY,
).toString("base64url");
const state = `${payloadB64}.${sig}`;
```

The encryption key doubles as the HMAC secret (32 bytes, already provisioned, loaded at boot, per the `boot-time fail-fast providers` pattern).

`oauthCallback` verifies: split on `.`, recompute HMAC via constant-time compare, decode payload, verify `payload.platform === req.params.platform`, verify `payload.exp > now`. Reject with 302 to `${FRONTEND_URL}/admin/content-pipeline/platforms?error=state_invalid` on any failure.

### Publisher rewrite: `youtube-shorts-publisher.ts`

```ts
@Injectable()
export class YouTubeShortsPublisher implements PlatformPublisher {
  readonly platform: Platform = "youtube_shorts";
  private cachedAuth: { refreshToken: string; client: OAuth2Client } | null =
    null;

  constructor(private readonly creds: PlatformCredentialsService) {}

  async isConfigured(): Promise<boolean> {
    return (await this.creds.getActive("youtube_shorts")) !== null;
  }

  private async getAuth(): Promise<OAuth2Client> {
    const row = await this.creds.getActive("youtube_shorts");
    if (!row) {
      throw new Error(
        "YouTube not connected. Visit /admin/content-pipeline/platforms and click Connect.",
      );
    }
    if (!this.cachedAuth || this.cachedAuth.refreshToken !== row.refreshToken) {
      const client = new google.auth.OAuth2(
        process.env.YOUTUBE_OAUTH_CLIENT_ID,
        process.env.YOUTUBE_OAUTH_CLIENT_SECRET,
      );
      client.setCredentials({ refresh_token: row.refreshToken });
      this.cachedAuth = { refreshToken: row.refreshToken, client };
    }
    return this.cachedAuth.client;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    /* unchanged after getAuth swap */
  }
}
```

The `PlatformPublisher.isConfigured` interface signature changes from `boolean` to `Promise<boolean>`. Impact is small (2 callsites in `PlatformManagerService.getPlatformStatuses` — switches to `Promise.all`).

---

## Frontend

### Platforms page (`platforms/page.tsx`)

On mount, read URL params:

```
?connected=<platform>&label=<account_label>   → success snackbar, refetch, replace URL
?error=<code>                                   → error snackbar, refetch, replace URL
```

Error codes: `state_invalid`, `state_expired`, `code_exchange_failed`, `channel_lookup_failed`, `access_denied` (Google's own), `unknown`.

### `PlatformRow` component

Three visual states:

1. **Supported + disconnected** — "Connect" button (primary indigo). Click handler: `await startPlatformOAuth(platform)`, then `window.location.assign(authUrl)`.
2. **Supported + connected** — "Connected · {account_label}" chip + muted "Disconnect" button. Disconnect click → confirmation modal ("Disconnecting will stop publishing to {account_label} until you reconnect.") → `await disconnectPlatform(platform)` → refetch.
3. **Unsupported (P2/P3)** — greyed-out "Connect" button with tooltip "Available in P2/P3".

The backend's `PlatformManagerService.getPlatformStatuses` returns one row per _canonical_ platform (all 6), with `supported: boolean` indicating whether a publisher is registered. Today it emits rows for registered publishers only; expand to emit all 6 canonical platforms.

### API helpers: `lib/content-pipeline-api.ts`

```ts
export async function startPlatformOAuth(
  platform: string,
): Promise<{ authUrl: string }>;
export async function disconnectPlatform(
  platform: string,
): Promise<{ success: true }>;
// fetchPlatforms: widen return type to include account_label, connected_at for connected rows.
```

No callback page is needed — the backend handles Google's redirect directly.

---

## Deployment

### Env vars

**New:** `FRONTEND_URL` — where the backend 302s after callback. Already set in Railway prod (`https://www.propertyiq.app`). Add to dev Railway if missing. Set to `http://localhost:3000` in local `.env.local`.

**Unchanged:** `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET` (app-level; no rotation planned).

**Removed post-cutover:** `YOUTUBE_OAUTH_REFRESH_TOKEN` (local `.env.local` + Railway prod + Railway dev). Explicit task post-smoke.

### Google Cloud Console (operator, 5 min)

Under the existing OAuth client's Authorized redirect URIs, remove the Playground URI and add the three backend URIs:

```
http://localhost:3001/api/admin/content-pipeline/platforms/youtube_shorts/oauth-callback
https://backend-dev-d9ca.up.railway.app/api/admin/content-pipeline/platforms/youtube_shorts/oauth-callback
https://backend-production-ee4d.up.railway.app/api/admin/content-pipeline/platforms/youtube_shorts/oauth-callback
```

### Deployment sequence

1. Local: implement A (migration + service), B (endpoints + state + publisher), C (frontend).
2. Local smoke: `dev:fresh` up, click Connect, verify DB row, retry a run.
3. Commit + merge `feat/activation-funnel-remediation` → develop → main.
4. Apply migration to shared Supabase via `apply-content-pipeline-migrations.js`.
5. Set `FRONTEND_URL` on Railway dev if missing.
6. Update Google Console redirect URIs.
7. Railway redeploys both envs. Verify `/api/health` healthy.
8. Prod smoke: click Connect on `https://www.propertyiq.app/admin/content-pipeline/platforms`, verify DB row, retry a prod run.
9. Remove `YOUTUBE_OAUTH_REFRESH_TOKEN` from Railway prod + dev + local `.env.local`.
10. Update `docs/content-pipeline/deploy-state.md`.

### Rollback

If the new code blocks publishing, `git revert` the feat commit and re-provision a valid `YOUTUBE_OAUTH_REFRESH_TOKEN` env var via OAuth Playground (with own credentials, to avoid the 24h revocation trap — see `docs/content-pipeline/platform-setup/youtube.md`). The broken refresh token currently in Railway is already non-functional; revert leaves us no worse off.

---

## Testing

### Unit (jest)

- `platform-credentials.service.spec.ts` — encrypt/decrypt round-trip, upsert behavior on re-connect (clears `disconnected_at`), unique constraint enforcement, `getActive` returns null for missing.
- `youtube-shorts-publisher.spec.ts` update — mocks `PlatformCredentialsService.getActive`, covers: configured path, missing-creds throws, cache invalidates when refresh token changes.
- `platform-manager.service.spec.ts` — `startOAuth` state generation round-trips through verify; `getPlatformStatuses` returns all 6 canonical platforms with correct `supported` flags.
- State verifier — explicit tests for: good state, expired state, tampered signature, wrong platform in payload, malformed format.

### E2E (jest + real Supabase)

- Extend `content-pipeline-p1-happy-path.e2e-spec.ts` to seed a `platform_credentials` row, run happy path, assert publish step does not throw due to missing creds. (The test already sets `selected_platforms: []` to skip real publishing — this just prevents regressions in the publisher-init path.)

### Manual

- Connect flow on local with @propertyIQ_app.
- Disconnect → confirm publisher `isConfigured()` returns false.
- Connect flow on prod.

---

## Open questions (deferred, not blocking)

1. Token-health indicator on the PlatformRow (last successful-publish timestamp, warning if >30 days stale)? Deferred to P4 per the implementation plan's credential-health-probe cron task.
2. When the user re-connects after disconnecting, should we preserve old rows or hard-delete? Plan says preserve — aligns with future audit needs.
3. Handling of channels.list returning multiple items (e.g., a default channel + a brand channel). The `mine: true` filter usually returns only the authenticated channel; we log a warning if items.length > 1 and pick the first.

---

## Risks

| Risk                                                   | Mitigation                                                                                                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redirect URI mismatch (most common OAuth error)        | Deployment sequence step 6 is explicit; smoke test will fail loudly if wrong                                                                                                                   |
| `FRONTEND_URL` not set on dev Railway                  | Deployment sequence step 5 + code throws at boot if missing (fail-fast pattern)                                                                                                                |
| Cutover breaks in-flight runs                          | The publisher now throws cleanly on missing creds. Any run that reaches publishing before Connect is completed lands in `failed` with a clear message; operator clicks Connect and retries     |
| Stale cached OAuth2 client across publisher injections | `cachedAuth` is keyed on the stored refresh token — re-connects with a different token invalidate the cache                                                                                    |
| HMAC state forgery                                     | Constant-time comparison, 10-min expiry, key rotation requires re-triggering Connect (same as rotating `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` would require re-entering all stored credentials) |

---

## Files created

- `supabase/migrations/20260423000200_platform_credentials.sql`
- `packages/backend/src/content-pipeline/platform-credentials.service.ts`
- `packages/backend/src/content-pipeline/platform-credentials.service.spec.ts`

## Files modified

- `packages/backend/src/content-pipeline/content-pipeline.controller.ts` (oauth-callback + disconnect endpoints)
- `packages/backend/src/content-pipeline/platform-manager.service.ts` (state signing; widen getPlatformStatuses)
- `packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.ts` (DB-first auth, no env fallback)
- `packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.spec.ts`
- `packages/backend/src/content-pipeline/drivers/platform-publisher.interface.ts` (isConfigured → Promise<boolean>)
- `packages/backend/src/content-pipeline/content-pipeline.module.ts` (register new service)
- `packages/frontend/app/admin/content-pipeline/platforms/page.tsx` (URL param handling, snackbar)
- `packages/frontend/app/admin/content-pipeline/platforms/platform-row.tsx` (connect/disconnect UI + three states)
- `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts` (three new helpers)
- `scripts/apply-content-pipeline-migrations.js` (add new migration)
- `docs/content-pipeline/platform-setup/youtube.md` (document in-app flow; deprecate Playground instructions)
- `docs/content-pipeline/deploy-state.md` (post-cutover state)

## Estimated implementation effort

~2 hours across 6 phases (A schema + service, B backend endpoints, C frontend, D Google Console, E testing, F deployment). Verification gate after each phase per CLAUDE.md §2.3.
