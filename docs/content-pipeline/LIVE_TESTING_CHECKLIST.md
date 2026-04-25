# Content Pipeline P2 — Live Testing Checklist

P2 build is complete (38 of 38 tasks shipped on `feat/content-pipeline-p2`). Everything below is the live-testing work that requires real credentials, real platform accounts, and operator eyes — none of which can be done from inside the build session.

Branch state at handoff: `feat/content-pipeline-p2` ahead of `main` by ~40 commits. Backend Jest: 80 suites / 1009 unit tests passing. Frontend tsc clean for everything in `app/admin/content-pipeline/`.

---

## 1. Apply migrations (5 minutes)

The new P2 archetypes migration is in the apply script's MIGRATIONS array.

```bash
cd /d/Projects/rei-platform
node scripts/apply-content-pipeline-migrations.js
```

Verify the four new tables exist (`transcript_cache`, `archetype_clusters`, `script_archetypes`, `archetype_refresh_runs`).

Expected output: "MIGRATIONS APPLIED 13/13".

---

## 2. Set environment variables (Railway dashboard)

| Var                            | Where   | Required for                                                                                                                    |
| ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `META_GRAPH_APP_ID`            | backend | Instagram + Facebook OAuth                                                                                                      |
| `META_GRAPH_APP_SECRET`        | backend | Instagram + Facebook OAuth                                                                                                      |
| `TIKTOK_OAUTH_CLIENT_KEY`      | backend | TikTok OAuth                                                                                                                    |
| `TIKTOK_OAUTH_CLIENT_SECRET`   | backend | TikTok OAuth                                                                                                                    |
| `TIKTOK_OAUTH_REDIRECT_URI`    | backend | TikTok OAuth (canonical callback)                                                                                               |
| `LINKEDIN_OAUTH_CLIENT_ID`     | backend | LinkedIn OAuth                                                                                                                  |
| `LINKEDIN_OAUTH_CLIENT_SECRET` | backend | LinkedIn OAuth                                                                                                                  |
| `YOUTUBE_DATA_API_KEY`         | backend | Archetype discovery (optional, can defer)                                                                                       |
| `ARCHETYPE_REFRESH_ENABLED`    | backend | Set to `true` to enable the weekly Sunday 03:00 UTC archetype refresh cron                                                      |
| `OPENAI_API_KEY`               | backend | OpenAI TTS fallback, Whisper captions, Vision style extraction, archetype embeddings + promotion (already set per the TTS work) |

Existing env vars that should already be set: `APP_BASE_URL`, `FRONTEND_URL`, `SUPABASE_DB_URL`, `EDGE_TTS_PYTHON`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`, all storage + service-role keys.

---

## 3. Register OAuth apps (one-time per platform)

Walk through `docs/content-pipeline/platform-setup.md` for each platform you want to publish to:

- [ ] **TikTok** — Create app at developers.tiktok.com, request `video.publish` scope, set callback. ~30 min, ~1 week for app review before posts go public (sandbox testing works immediately).
- [ ] **Instagram** (via Meta) — Create Meta Business app, request `instagram_content_publish` scope, ensure your IG account is **Business** and linked to a FB Page.
- [ ] **Facebook** (same Meta app as IG) — Request `publish_video` scope.
- [ ] **LinkedIn** — Create app at linkedin.com/developers, associate with a Company Page, request Marketing Developer Platform access (~5 day review).

For each: copy client ID + secret to Railway env, then click **Connect** in `/admin/content-pipeline/platforms`.

---

## 4. Verify Connect flow per platform

For each newly registered platform:

1. Navigate to `https://propertyiq.up.railway.app/admin/content-pipeline/platforms`
2. Click **Connect** on the platform's row
3. Complete the platform's auth screen
4. Verify you land back on the platforms page with a green "configured" indicator and the correct account label (TikTok @username, IG user ID, FB Page ID, LinkedIn org URN)
5. If the page shows an error toast, the message includes the underlying reason — fix and retry

---

## 5. Run a draft-mode end-to-end test per platform

Goal: produce one real draft post on each platform without it going public. Use `approval_mode=draft` so the publishers honor the platform's draft state.

```
POST /api/admin/content-pipeline/runs
{
  "format": "grade_reveal",
  "marketQuery": "Cleveland, OH",
  "idempotencyKey": "<random-uuid>",
  "approvalMode": "draft",
  "selectedPlatforms": ["youtube_shorts"]
}
```

Repeat with `selectedPlatforms = ["tiktok"]`, `["instagram_reels"]`, `["facebook_reels"]`, `["linkedin"]` (or batch them all in one run).

Wait ~10-15 min for the run to reach `published`. Then check each platform's draft area:

- [ ] **YouTube** — Studio → Content → filter by Private. Should be a private (draft-equivalent) Shorts upload.
- [ ] **TikTok** — App → Profile → Drafts. Should be a draft titled with the market name.
- [ ] **Instagram** — `https://graph.facebook.com/<container_id>?fields=status_code&access_token=<page_token>` → expect `FINISHED`. Container is unpublished (no public URL).
- [ ] **Facebook** — Page → Publishing Tools → Drafts. Should be a draft Reel.
- [ ] **LinkedIn** — Company Page admin → Activity → Drafts. Should be a draft post with the rendered video.

Failure modes to watch:

- "X not connected" → re-run Connect flow
- TikTok "post_mode mismatch" → app not yet approved for `video.publish` scope; sandbox-only until approval
- IG "video_url not reachable" → check the Supabase signed URL TTL is long enough (we use 1h; should be fine)
- LinkedIn "scope insufficient" → confirm Marketing Developer Platform was granted

---

## 6. Run the staging integration suites

Two suites I shipped this build, both gated on `E2E_ADMIN_JWT`:

```bash
# Approval-modes suite (~36 min total: 12 min auto + 5 min review + 12 min draft + ~7 min misc)
cd packages/backend && \
  API_URL=https://backend-production-ee4d.up.railway.app \
  E2E_ADMIN_JWT=<your jwt> \
  npm run test:integration -- approval-modes

# P2 acceptance suite (~5-15 min, longer if YOUTUBE_DATA_API_KEY + OPENAI_API_KEY set for archetype refresh test)
cd packages/backend && \
  API_URL=https://backend-production-ee4d.up.railway.app \
  E2E_ADMIN_JWT=<your jwt> \
  YOUTUBE_DATA_API_KEY=<key> \
  OPENAI_API_KEY=<key> \
  npm run test:integration -- p2-acceptance
```

To get an admin JWT: log in as the admin user, open DevTools → Application → Cookies, copy the Supabase session JWT.

The `E2E_TEST_MARKET` env var (default: "Cleveland, OH") tags the test runs so you can identify and clean them up after — set to something unmistakably test-y like "Test Market 12345" before running.

---

## 7. Manual QA the new admin surfaces

For each, navigate, click around, confirm there are no console errors:

- [ ] `/admin/content-pipeline` — dashboard with hover overlays (Review/Retry/Delete on RunCards)
- [ ] `/admin/content-pipeline/review` — review queue with bigger video, queue ribbon, prev/next nav, ? cheatsheet
  - Press `?` to see all shortcuts
  - Press `T` to open the thumbnail editor; scrub the timeline, pick a frame, click "Use frame N"
  - Switch tabs (Script / Gates / Thumbnail) on the right pane
  - Try Reject (`J`) — should open the dialog with reason chips
  - Try Delete (`X`) — should open the destructive dialog with state-aware copy
- [ ] `/admin/content-pipeline/settings` — gate strictness + Format Defaults expand-rows + pause/resume
  - Click any format row to expand
  - Change voice via the popover; click ▶ to preview
  - Toggle a platform chip; verify the master row platform strip updates
  - Flip the enabled switch
- [ ] `/admin/content-pipeline/platforms` — 5 platform rows, Connect/Disconnect on each
- [ ] `/admin/content-pipeline/lead-magnets` — magnet cards + bindings table
  - Edit a magnet, Bind a new format → magnet row, Remove a binding (destructive confirm)
- [ ] `/admin/content-pipeline/style-references` — empty state, Add reference dialog
  - Submit a real PNG/JPG URL with `OPENAI_API_KEY` set; verify palette swatches appear under the card
- [ ] `/admin/content-pipeline/archetypes` — list + filter chips + Refresh now button
  - Click Refresh; check `/api/admin/content-pipeline/archetypes/refresh-runs` for the row going `running` → `succeeded` (5-15 min if YOUTUBE_DATA_API_KEY is set)

---

## 8. Public landing pages

Open each in an incognito window:

- [ ] `https://propertyiq.up.railway.app/grade-reveal-signup` (P1)
- [ ] `https://propertyiq.up.railway.app/top-cashflow-report`
- [ ] `https://propertyiq.up.railway.app/movers-report`
- [ ] `https://propertyiq.up.railway.app/market-comparison`
- [ ] `https://propertyiq.up.railway.app/farm-area-audit`

Verify:

- Title + bullets render
- Form submits to `/api/auth/signup` with the right `magnetKind` hidden field
- Mobile-responsive (resize the window)

---

## 9. Cron sanity

After 5 minutes of backend uptime:

```bash
# Railway logs — look for these boot lines
railway logs --service backend | grep -E "BOOT|cron"
```

Expected:

- `[BOOT] AZURE_SPEECH_KEY.len=… AZURE_SPEECH_REGION=… EDGE_TTS_PYTHON=… OPENAI_API_KEY.len=…`
- `[BOOT] ARCHETYPE_REFRESH_ENABLED=true` (or `false` if you didn't enable it yet)
- `[BOOT] DISABLE_CONTENT_PIPELINE_WORKERS=undefined` (workers ARE running)

The archetype refresh fires Sunday 03:00 UTC. If you want to test before then, hit the manual button in `/admin/content-pipeline/archetypes` → **Refresh now**.

---

## 10. Cleanup test runs after live testing

The integration suites and your manual QA produce real DB rows + real social posts. To clean up:

```sql
-- find test runs (Cleveland or whatever E2E_TEST_MARKET you used)
SELECT id, market_query, status FROM content_runs
WHERE market_query LIKE '%Cleveland%' OR market_query LIKE '%Test Market%';

-- delete via the admin API so storage cleanup runs and platform_posts cascade
-- (the Delete dialog in the dashboard is the easy path)
```

Already-published posts on social platforms will REMAIN LIVE — see the destructive-dialog copy. Take them down via each platform's own admin tools.

---

## What's NOT in this checklist (deferred)

- **Bulk operations** (multi-select runs in dashboard, bulk approve/delete) — out for v1
- **Mobile-responsive admin** — desktop-first explicitly per design brief
- **Voice preview waveform** — just play/stop is enough
- **Format-defaults audit log** — could go in `content_run_events` later
- **Per-platform per-format opt-in matrix** — `default_platforms` is a single list per format
- **Archetype router production logic** — `ArchetypeRouter` (Task 2.33) is a stub by design; the routing algorithm is open editorial work for Troy

---

## Status summary

| Tier                        | Status                                                              |
| --------------------------- | ------------------------------------------------------------------- |
| Code complete               | ✅ all 38 P2 tasks shipped                                          |
| Backend tests               | ✅ 80 suites / 1009 unit tests pass                                 |
| Backend tsc                 | ✅ zero new errors vs P1 baseline                                   |
| Frontend tsc                | ✅ zero errors in `content-pipeline/`                               |
| Migrations                  | ⏳ run `node scripts/apply-content-pipeline-migrations.js`          |
| OAuth apps                  | ⏳ register 4 apps (TikTok, Meta, LinkedIn)                         |
| Env vars                    | ⏳ set in Railway                                                   |
| Connect each platform       | ⏳ via `/admin/content-pipeline/platforms`                          |
| Draft-mode E2E per platform | ⏳ one test run per platform                                        |
| Integration suites          | ⏳ run with real `E2E_ADMIN_JWT`                                    |
| Manual admin QA             | ⏳ click through each new page                                      |
| Public landing pages        | ⏳ smoke test each in incognito                                     |
| Archetype refresh           | ⏳ optional — fire `Refresh now` once `YOUTUBE_DATA_API_KEY` is set |
