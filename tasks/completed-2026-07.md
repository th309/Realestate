# Completed work — July 2026

Sections moved out of `tasks/todo.md` once every item in them was done. Kept
rather than deleted because the *reasoning* is the useful part — several of
these record why an approach was rejected, which is the thing a future reader
cannot reconstruct from the diff.

Anything with outstanding work stays in `todo.md`.

---

# Google OAuth consent screen: show PropertyIQ, not the Supabase host (2026-07-28)

**Problem:** Users signing in with Google see `Sign in to pysflbhpnqwoczyuaaif.supabase.co`.

**Cause:** Google renders the consent identity from the OAuth client's _verified brand_. With no
brand verification it falls back to printing the raw `redirect_uri` host — today
`https://pysflbhpnqwoczyuaaif.supabase.co/auth/v1/callback`. Brand verification requires proving
ownership of the authorized domain, and nobody but Supabase can prove ownership of `supabase.co`.
So the callback host must move onto `propertyiq.app` **before** branding can ever take effect.
Setting the App name alone is a dead end.

**Chosen fix (Troy, 2026-07-28):** Supabase Custom Domain (`auth.propertyiq.app`) + Google brand
verification. Rejected alternative: Google Identity Services + `signInWithIdToken` — free, but
re-plumbs the signup path just repaired in `6885741e`, and still needs brand verification anyway.

**Why this is low-risk:** no local JWT verification anywhere — every auth check goes through
`supabase.auth.getUser(token)` (`packages/backend/src/common/guards/jwt-auth.guard.ts:53`,
`optional-jwt-auth.guard.ts:34`, `packages/backend/src/analyzer/grade.controller.ts:71`). No pinned
issuer, so the issuer change from `*.supabase.co` to `auth.propertyiq.app` is inert.

## Sequence (order is load-bearing)

- [x] **1. Enable the Custom Domain add-on** — _Troy_ — DONE 2026-07-28
      https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/settings/addons
      Variant `cd_default`, $10/mo fixed, prorated. Reversible via
      `DELETE /v1/projects/{ref}/billing/addons/cd_default`.
      (Claude is blocked from billing mutations by the permission classifier.)

- [x] **2. Register the hostname** — _Claude_ — DONE 2026-07-28
      `supabase domains create --project-ref pysflbhpnqwoczyuaaif --custom-hostname auth.propertyiq.app`
      then `domains reverify` to mint the DCV record. Cert is `dv`/`txt` from the Google CA; origin
      bound to `pysflbhpnqwoczyuaaif.supabase.co`. State: `2_initiated` / ssl `pending_validation`.

- [x] **3. Add DNS records in Cloudflare** — _Troy_ — DONE 2026-07-28, both resolve publicly.
      Grey-cloud confirmed: the DoH answer exposes the CNAME target rather than masking it behind
      proxy IPs. (Local nslookup returned nothing — the VPN resolver at 103.86.96.100 lies; always
      verify DNS here via `cloudflare-dns.com/dns-query`, not the system resolver.)

      | Type  | Name                   | Value                               | Proxy |
      | ----- | ---------------------- | ----------------------------------- | ----- |
      | CNAME | `auth`                 | `pysflbhpnqwoczyuaaif.supabase.co.` | **DNS only (grey cloud)** |
      | TXT   | `_acme-challenge.auth` | `TAeaA1ZAwRSNUlWArO1pjUsdJrK-2sBMUMsmdXLuxEA` | n/a |

      ⚠️ **Grey cloud, not orange.** Proxying makes Cloudflare terminate TLS with its own cert, so
      Supabase's managed cert is never presented and the hostname health check can fail. Not stated
      in Supabase's docs — this is the standard Cloudflare + managed-cert interaction, so confirm
      empirically at step 4 rather than trusting it blind.
      ⚠️ Cloudflare appends the zone automatically — enter `auth`, not `auth.propertyiq.app`.
      `auth.propertyiq.app` currently returns no address records, so no conflict expected.

- [~] **4. Verify DNS + cert issuance** — _Claude_ — DNS verified; cert issuing.
  `supabase domains reverify --project-ref pysflbhpnqwoczyuaaif`
  Cloudflare hostname `active` (DNS satisfied); ssl `pending_validation` with the DCV record at
  `processing` — Google CA has picked up the challenge. No `verification_errors`, no
  `validation_errors`, and **no CAA record** on the apex to block Google Trust Services, so
  there is nothing to fix — it just needs time. Do not re-`create` the hostname to "retry"; that
  re-mints the TXT value and invalidates the record already in DNS.

- [x] **5. Pre-authorize the new callback in Google** — _Troy_ — DONE 2026-07-28, **via a client migration**

      **Unplanned but mandatory detour.** The OAuth client Supabase was using
      (`777921019984-fv6iocd…`) lives in a Google Cloud project Troy has **no access to**
      (`resourcemanager.projects.get` missing; owning account unknown/unrecoverable). That blocks
      far more than this step: brand verification is configured on the consent screen of the project
      that **owns the client**, so branding could never have been submitted for it. The client had
      to move, or the whole plan dead-ends at the bare domain.

      **Migration performed:** new Web client `PropertyIQ Auth (Supabase)` =
      `1036757309323-tt88facqimuin1rqf0c98unihcd613tp.apps.googleusercontent.com` created in
      `propertyiq-488415` (a project Troy owns), with **both** callbacks registered up front:
      `https://pysflbhpnqwoczyuaaif.supabase.co/auth/v1/callback` and
      `https://auth.propertyiq.app/auth/v1/callback`. Credentials set via the Supabase dashboard by
      Troy (secret never entered the transcript).

      **Why this was safe for existing users:** Google's `sub` claim is unique per *Google Account*
      and never reused — it is NOT scoped per OAuth client or per Cloud project
      (developers.google.com/identity/openid-connect/openid-connect). So all 12 existing
      `auth.identities` google rows re-match on the new client; no orphans, no duplicates.
      (Counts at migration: 12 google identities, 24 email, first google link 2026-04-06.)

      **Verified live, not assumed:** `GET /auth/v1/authorize?provider=google` now emits the new
      `client_id` with the old `redirect_uri`, and Google returns its normal sign-in page rather than
      `redirect_uri_mismatch` / `invalid_client` — i.e. production sign-in never broke during the swap.

      ⚠️ **DO NOT strip the YouTube scopes.** (This corrects earlier guidance written here before the
      client was traced.) `propertyiq-488415` also holds the `Youtube test` client
      `1036757309323-8iib4bn3…` — which is **live production**, not an abandoned experiment: it is
      `YOUTUBE_OAUTH_CLIENT_ID` for `content-pipeline/drivers/youtube-longform-publisher.ts`, with
      `youtube.upload` + `youtube.readonly` and a working `YOUTUBE_OAUTH_REFRESH_TOKEN` deployed on
      Railway backend. Removing those scopes breaks long-form publishing. Same project number as the
      auth client, so they share one consent screen — unavoidable, not a mess to clean up.

      The "Your app requires verification" banner on the Audience page is **expected and harmless**:
      restricted scopes are granted only by Troy authorizing his own channel (OAuth user cap reads
      1/100 and will not move), while sign-in users request only `email` + `profile` and get the
      brand-verified screen. Verification would only be required if CUSTOMERS ever connected their
      own YouTube accounts — multi-tenant restricted-scope use, which triggers a third-party
      security assessment.

      🚨 **Never click "Back to testing" on the Audience page.** Testing mode expires refresh tokens
      after 7 days, silently killing `YOUTUBE_OAUTH_REFRESH_TOKEN` and breaking long-form publishing.
      "In production" is load-bearing for that token, not cosmetic.

- [x] **6. Activate** — _Claude_ — DONE 2026-07-28, status `5_services_reconfigured`.

      **The stall and how it cleared.** `ssl` sat at `pending_validation` / record `processing` for
      ~45 min. Ruled out, with evidence, before touching anything: no CAA on the apex OR on the
      CNAME target (RFC 8659 makes the CA follow the alias, so `supabase.co` mattered too); TXT
      byte-identical and visible from BOTH `dns.google` and `cloudflare-dns.com`; zone on Cloudflare
      NS. Nothing was misconfigured — it was pure Cloudflare/Google queue latency, and a repeat
      `domains reverify` cleared it. **Do not "fix" this by re-running `domains create`** — that
      re-mints the TXT value and invalidates the record already in DNS, resetting the clock.

      ⚠️ **Norton MITM makes local TLS checks lie here.** `openssl s_client` against the custom
      domain returns a cert issued by "Norton Web/Mail Shield Root", not the real one, so a local
      handshake proves nothing about public validity. Use `WebFetch` (fetches server-side, outside
      this machine) as the independent check — it returned HTTP 400 with no TLS error, proving the
      cert was publicly valid while Supabase's API still reported `pending_validation`.

      **Pre-flight before activating** (worth repeating on any future cutover): built the Google
      authorize URL by hand for BOTH redirect URIs and confirmed each returned the normal sign-in
      page rather than `redirect_uri_mismatch`. Proves the new callback is registered instead of
      trusting that it was saved.

- [x] **7. Point the frontend at the custom domain** — _Claude_ — DONE 2026-07-28. Shipped as
      `8abffe89`, released `1f0b3571` (§2.6 sync check = 0). Railway `frontend`
      `NEXT_PUBLIC_SUPABASE_URL` = `https://auth.propertyiq.app`; prod 200 in 0.85s after redeploy.
      **Gate used before flipping the var:** polled the LIVE `Content-Security-Policy` response
      header on `www.propertyiq.app` until it actually contained `auth.propertyiq.app` (9 checks,
      ~4 min) rather than assuming the deploy had finished. Reuse that gate for any env change with
      a code prerequisite. Adding the host rather than replacing `*.supabase.co` is also what made
      the rollout safe mid-flight — both origins were permitted the whole time.

      🚨 **HARD ORDERING: the CSP change must be DEPLOYED before the Railway var flips.**
      `packages/frontend/next.config.mjs:327` allowlists `https://*.supabase.co` +
      `wss://*.supabase.co` in `connect-src` / `img-src` / `media-src`. `auth.propertyiq.app` is NOT
      covered by that wildcard, so flipping `NEXT_PUBLIC_SUPABASE_URL` first would have had the
      browser block EVERY Supabase REST/auth/Realtime call — a total production outage, not just
      sign-in, and visible only in prod since the header is set at the edge. The wildcard is what
      hid the dependency: it silently covered every project ref, so it never read as hardcoded.
      Custom domain ADDED alongside `*.supabase.co` (not replacing it) because backend + mcp-server
      deliberately stay on the original host and may still mint storage URLs there.

      Also fixed: `packages/frontend/app/sw.ts` storage matcher keyed on
      `hostname.endsWith(".supabase.co")`. A custom domain moves storage off that suffix entirely,
      dropping those requests into `defaultCache` and resurrecting the documented opaque-response →
      `copyResponse` throw → synthesized 503 → offline-banner bug. Now derived from
      `NEXT_PUBLIC_SUPABASE_URL`, wrapped in try/catch because a throw at SW module scope aborts
      service-worker installation outright.

      Railway `frontend` → `NEXT_PUBLIC_SUPABASE_URL` = `https://auth.propertyiq.app`, redeploy.
      Leave `backend` (`SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`) and `mcp-server` (`SUPABASE_URL`)
      on the original host: server-to-server, never user-visible, and pinning them limits blast
      radius if the custom domain has a cert hiccup. Both hosts are interchangeable per docs —
      confirm cross-host token validation at step 9.
      `SUPABASE_DB_URL` is the direct Postgres host (`db.*.supabase.co`); custom domains do not
      cover it. Do not touch.

- [x] **8. Branding + brand verification** — _Troy_ — DONE 2026-07-28, **already verified**.
      App name `PropertyIQ`, PIQ logo, support email set on `propertyiq-488415`; Google reports
      "Your branding has been verified and is being shown to users." The expected multi-day
      verification wait never materialised — an accidental payoff of the step-5 client migration,
      since the destination project was already brand-verified. This is why the fix landed the same
      night rather than days later, and it also moots the YouTube-scope warning above (verification
      already cleared, nothing to strip).

      **PRIMARY GOAL ACHIEVED — verified on Google's live response, not inferred:**
      consent HTML went from `pysflbhpnqwoczyuaaif.supabase.co` ×10 / `auth.propertyiq.app` ×0
      to `auth.propertyiq.app` ×10 / `pysflbhpnqwoczyuaaif.supabase.co` ×0, with `PropertyIQ` ×4
      throughout. Both entry hosts emit `redirect_uri: https://auth.propertyiq.app/auth/v1/callback`.
      Note this needed NO frontend deploy: GoTrue derives the callback from the project's external
      URL, so activation alone flipped it. Step 7 is polish, not the fix.

- [x] **8b. Remove the stale redirect URI** — _Troy_ — DONE 2026-07-29. Verified by probing BOTH URIs
      directly against Google: `auth.propertyiq.app` → normal sign-in page; the old
      `pysflbhpnqwoczyuaaif.supabase.co` → `redirect_uri_mismatch` / Error 400. Inverted results
      would have meant the wrong row was deleted, so probe both, never just the survivor. Live flow
      unaffected. **The rollback is now gone** — a custom-domain revert would additionally require
      re-adding the old URI in Google first.
      Drop `https://pysflbhpnqwoczyuaaif.supabase.co/auth/v1/callback` from the Google client. Kept
      deliberately until now: it is the rollback path, and it must be gone before any FUTURE
      verification submission because Google requires every redirect URI to sit under an authorized
      domain you can prove ownership of — which `supabase.co` never can be.

- [x] **9. Verify end-to-end** — _Claude_ — DONE 2026-07-28. **Real user, not synthetic:** the same
      person whose screenshot opened this task re-ran sign-in and saw "Sign in to PropertyIQ" with
      the PIQ logo and zero Supabase hash. Server side, `auth.users` shows a NEW google user with
      `created_at = last_sign_in_at = identity.last_sign_in_at = 2026-07-28 22:57:31Z` — full round
      trip (consent → callback → user row → identity link → session).
      **GA4 confirms the analytics path:** `sign_up` ×3 on 2026-07-28, ALL with
      `customEvent:method = oauth` — the `6885741e` repair survived the client migration, which was
      the single largest regression risk in this change.

## Verification checkpoints

| After step | Must be true                                                  |
| ---------- | ------------------------------------------------------------- |
| 4          | `supabase domains get` reports the hostname verified          |
| 6          | Consent screen shows `auth.propertyiq.app`; sign-in completes |
| 7          | Frontend sign-in works; backend API calls still authorize     |
| 8          | Consent screen shows `PropertyIQ` + logo                      |
| 9          | `signup_complete` / `method=oauth` present in analytics       |

## Rollback

Steps 2–4 are inert until activation. After step 6, `supabase domains delete` reverts to the
`*.supabase.co` host; the Google client still carries the old redirect URI (step 5 keeps it), so
sign-in survives the revert. Step 7 reverts by restoring the Railway var and redeploying.

---


---

# Remotion Composition Upgrade — Motion, Tokens, Audio Mix (2026-07-28)

Directive: upgrade all active Remotion compositions (Reels/Shorts pipeline) to the brand
motion language + a real audio mix, as shared reusable utilities (not per-composition
fixes), then document the standards in the video pipeline SKILL.md. Branch `develop`
(commit locally; never push without ask).

## Plan

### Phase 0 — Discovery

- [x] Locate Remotion project root, all active compositions, current animation patterns (`packages/video-template`, 9 compositions, 13 bespoke springs + ~30 raw linear interpolates)
- [x] Locate Edge TTS narration path, audio insertion, existing assets, SKILL.md (backend driver chain, one-blob synthesis, zero mix assets, `Skills/youtube-production/SKILL.md`)

### Phase 1 — Shared motion system

- [x] Motion utility module `src/motion/` (SPRINGS presets, M3 EASINGS, STAGGER_FRAMES=4, hooks)
- [x] `<AnimatedEntrance>` wrapper: spring-in + 1.05→1.0 settle + index-based stagger
- [x] Signature motif: `ScoreRing` dial spin-up (counter spring + endpoint glow pulse) adopted by ScoreReveal, Comparison, BrandOutroCard
- [x] Audit complete: no raw linear interpolate remains on visible motion; surviving interpolates all carry EASINGS curves
- [x] Stagger applied wherever siblings animate (stat cards, ranking rows, comparison columns, farm grid)

### Phase 2 — Brand token enforcement

- [x] `src/styles/tokens.ts` (PALETTE, 1.75px borders, 8% fills, tabular-nums, chart rules); COLORS + style-variants rewired onto it; zero hex literals in components
- [x] Fonts self-hosted (`public/fonts/` variable woff2 + `loadBrandFonts()` with delayRender) — Railway render container has no Roboto
- [x] Asymmetric layout pass (ScoreReveal off-center dial + overlapping momentum pill, StatCards hero mosaic, Intro lower-third) + MeshBackground depth (blooms + grain) mounted per-layout
- [x] TrendChart rebuilt to Robinhood spec: line draw-in with exact tip tracking, endpoint glow pulse, range pills, scripted scrub, no gridlines (dashed 50 baseline only)

### Phase 3 — Audio production

- [x] `src/audio/` — AudioMix (music bed + room tone + narration + SFX), sidechain duck from captionWords (attack 8f / release 20f / hold 600ms)
- [x] SFX cues frame-locked to layout beat tables (`sfx-cues.ts` imports the same beats layouts render from); deterministic WAV asset generator (replace with licensed files, same names)
- [x] Loudness: narration loudnorm'd backend-side to -16 LUFS; all in-comp gains from AUDIO_LEVELS
- [x] TTS segmentation (backend): sentence-split clips + 200-500ms pauses + ffmpeg concat + loudnorm; per-segment word-timing offsets (drift resets each boundary); ffmpeg-absent → exact legacy fallback. 690 content-pipeline tests green, tsc clean.

### Phase 4 — Documentation + verification

- [x] SKILL.md updated: Step 6 (segmented pipeline TTS), Step 7b (template exists + REQUIRED composition standards), coverage-copy fix
- [x] Verification: build:cli clean; backend plain tsc clean; content-pipeline jest 690 passed / 1 pre-existing skip; snapshot baselines regenerated (55 PNGs, 8 suites / 60 tests) and determinism proven on a second full run
- [x] Review section below

### Pre-existing bugs found & fixed along the way

- Brokerage/recruitment narration desync: beats scaled the 2s bumper to 5-6s while narration always starts at frame 60 — bumper now fixed at 60f (`NARRATION_START_FRAME`), content beats stretch to fill
- Intro/Outro exit fades anchored to unscaled frames → scenes went invisible mid-slot in scaled formats + HeadToHead (`durationInFrames` props added)
- Outro "Explore 400+ scored markets" retired raw coverage count → countless copy; SKILL.md "40,000 markets" → sanctioned 900+/3,000+/29,000+ phrasing
- ScoreReveal/Comparison badges rendered legacy quality-word `grade` from the bundle → momentum ladder (CLAUDE.md §9)
- Edge TTS Windows cmdline-length latent bug sidestepped by short per-segment texts
- Dead code deleted: RankingRow, MetricValue, DeltaDisplay, compositions/factory.ts; package.json render script ids fixed (grade_reveal → grade-reveal)

## Review

Shipped on `develop` (local only, NOT pushed): `89b18147` (video-template) +
`4d93313b` (backend TTS) + docs commit. Four §1.6 review passes ran; every
CRITICAL/WARNING was fixed and re-verified (narration-over-bumper desync in
scaled formats; audio-vs-wall-clock bitrate domain mix; DOM.Iterable tsconfig
lib for FontFaceSet).

Architecture notes for future sessions:

- One timing source per family: layouts AND sfx cues read the same beat
  tables (`grade-reveal-beats.ts`, `SCORE_MOVER_BEATS`, `FARM_AREA_BEATS`,
  `computeRankingTiming`) — never hardcode a cue frame.
- `NARRATION_START_FRAME` (60) is a backend contract (audio budget =
  duration − 2s buffer). Opening bumpers must stay 60 frames in every format.
- Audio assets are generated (deterministic script); drop licensed
  replacements onto the same filenames in `public/audio/`.
- Snapshot baselines re-mint automatically when deleted; always run the
  suite twice (mint + determinism) after motion changes.
- Standards documented as REQUIRED in `Skills/youtube-production/SKILL.md`
  Step 7b — point future composition work there first.

Known limits (deliberate): head_to_head/long-form/rankings get bespoke cue
plans only where their beat tables allowed; other formats fall back to
scene-change bookends. Inserted TTS pauses (~0.3s/sentence) count against
the audio budget — `silence_ms` in `synthesize_audio_done` makes overflow
attributable; `SENTENCE_BREAK_MS` is the single tuning knob if repair-loop
rates rise. A real rendered-video listen/watch on a live run is the one
check no test covers — do it on the next pipeline run.

---


---

# GEO Top-5 Fixes — 2026-07-08 (from GEO-ANALYSIS.md)

Branch `develop` (commit locally; never push without ask).

## Plan

- [x] **G1** Claim contradictions FIXED: ValuePropsSection body → transparent 4-signal formula copy; /about ×5 ML-claim rewrites + "production data systems"; milestone "models trained"→"formula built"; JsonLd featureList → COVERAGE_COPY.sentence; layout.tsx root meta description → COVERAGE_COPY.sentence (was raw 935/3,137/29,417).
- [x] **G2** llms.txt: new `scripts/generate-llms-txt.ts` + `scripts/lib/llms-txt-template.ts` (fail-closed, COVERAGE_COPY-sourced, live pricing); `seo:generate-llms` npm script chained into `seo:rebuild-slugs`; post-import-refresh.yml commits the files; both files regenerated ($39 Pro / $149 Enterprise from live API — "Team $99" never existed in DB). BONUS stale-$29 fixes: PersonalizedPaywall CTA (price dropped), PlanComparisonCards (wired usePricingTiers), account-page e2e assertions. Homepage JsonLd offers now pricing-live via new `fetchPaidTierOffers` (ISR 1h, tag piq-pricing) — omits paid offers on fetch failure.
- [x] **G3** Market FAQ: `build-market-faqs.ts` (5 momentum-framed Q&As, 128-162 words, null-gated) + `MarketFaqSection.tsx` (FAQPage JSON-LD, ≥3 gate) on metro/county/zip pages; score labels extracted to `score-labels.ts` (re-exported from ScoreDisplay, 33/33 tests pass).
- [x] **G4** SSR narrative: backend `getCachedInsight` + `cachedOnly` param (never generates — cost guardrail verified by review); frontend `fetchCachedInsight` (ISR, null-safe) → metro page → `initialInsight` prop; client fetch disabled when server-provided. + DTO-audit fixes: geoLevel/type/archetype/blog-type allowlist validation on ALL insights endpoints (2 pre-existing CRITICALs closed).
- [x] **G5** Entity: sameAs → real LinkedIn (`/company/propertyiq-app/`) + YouTube + Facebook (user-provided); removed uncontrolled `@propertyiq` twitter creator handle; safeJsonLdString escape helper (JsonLd + OrganizationJsonLd). MANUAL follow-ups for user: Wikidata item, Reddit presence, Search Console reindex of stale snippets, claim FB vanity URL.
- [~] **G6** Verify: backend tsc ✓; frontend tsc ✓ (×2); frontend vitest score-labels ✓; production build: Turbopack (Next 16.1.6) fails locally resolving `@propertyiq/analyzer-core` (Windows/Turbopack quirk — Node resolves it fine, dist rebuilt, Railway Linux builds unaffected); webpack build running as cross-check; then no-JS HTML render check on :3100.

## Review

All 5 GEO issues implemented; ~14 code-review/security/DTO/data-layer validation passes across the surface, all findings fixed (dangling import, raw counts in root meta, ML phrasing, 2 pre-existing controller CRITICALs, JSON-LD `</script>` escape). Coupling note (user to confirm): `seo:generate-llms` appended to `seo:rebuild-slugs` chain means a pricing-API outage fail-closes the monthly slug rebuild step.

---


---

# Mobile + cross-platform tour/reports fixes — 2026-06-20

Root causes confirmed via parallel Explore agents + direct file reads. Six bugs.
Branch `develop` (commit locally; never push without ask). All UI follows M3 brand
(CLAUDE.md §8): semantic tokens only, no hardcoded hex; Roboto / Roboto Mono /
Source Serif 4. Verify each LIVE at mobile viewport 375×812 (no mocks).

## Bug inventory & root cause

1. **(mobile) Persona boxes too big, text unreadable, must scroll, stray "For you" badge**
   - `tour/components/PersonaCard.tsx`, `PersonaCards.tsx` — `p-5`, `text-xs` tag/bullets, low-contrast `text-on-surface-variant`; tall vertical cards w/ bullets+button → 3 don't fit one mobile screen. `priority` renders a tertiary "For you" badge on the agent card.
2. **(mobile, CRITICAL) Homebuyer shown agent "listing presentation / farming" finale**
   - `backend/.../listing-presentation-narrative.service.ts:20` SYSTEM_PROMPT hardcoded "for a real estate agent"; persona only in user prompt. Finale + sections identical for all personas. **DECISION (user): build 3 fully distinct finales.**
3. **(mobile) Typed text in inputs unreadable (should be black/on-surface)**
   - `tour/components/InlineSignupForm.tsx:101,111` + `MarketPickerStep.tsx:73` missing `text-on-surface`; MarketPicker also hardcodes `bg-white`. `onboarding/QuizStep.tsx:284` already correct (reference).
4. **(mobile) Finale "compare vs peers" shows 3 cards but no numbers**
   - `backend/markets/peers.service.ts` returns only `{name, score, householdCount}` — no price/growth/DOM/sold-above. `tour/.../listing-sections/adapt-sections.ts:116,193` passes raw through; `Peers.tsx:54-57` reads non-existent fields → blank.
5. **(mobile + web) Tour finale re-runs on browser Back**
   - `tour/components/Step4Aha.tsx:42-54` fires a React Query _mutation_ every mount when `isIdle && persona && market`; `mutation.data` never persisted → regenerates on back-nav.
6. **(mobile + web) /reports comparison: hard to read on mobile + collapses to first market**
   - `ReportViewer.tsx:239-244` routes non-v2 comparisons to `ComparisonHeroShowdown.tsx` which `.slice(0,2)`, hardcodes a 2-up `VS` grid, and reads DEAD legacy scores (`homeready_score`/`investoredge`) → comparison markets show "No Score". User: even 2 is unreadable on mobile. Needs live PropertyIQ score + N markets + mobile-first layout. (`comparison_v2`/`ComparisonHero.tsx` already handles 3+ — evaluate routing all comparisons there.)

## Finale specs (#2 — user chose "fully distinct")

- **AgentFinale** = current listing-presentation (verdict + 10 sections + branded/share CTA). Keep.
- **HomebuyerFinale** — "Should you buy in {market}?" Hero: buyer verdict + affordability headline (median price, est. monthly payment). Sections: Can you afford it · 12-mo forecast (your equity) · Rent vs buy break-even · Lifestyle/jobs/who's moving in · Similar markets · How competitive (DOM, % over ask). CTA: get pre-approved / target neighborhoods / save.
- **InvestorFinale** — "Is {market} a good investment?" Hero: demand signal + investor verdict + cash-flow/appreciation snapshot. Sections: Cash flow (yield) · Appreciation forecast · Rent trends · Comparable cashflow markets · Demand drivers (migration/employment) · Deal analyzer. CTA: analyze an address / top cashflow markets / save.
- Backend: per-persona narrative SYSTEM_PROMPT. Frontend: route `Step4Aha` → finale by `session.persona`.

## T6 redesign (user spec 2026-06-20, REVISED after live review)

FINAL requirements (user was clear after seeing v1 fall short):

1. Like-geo restriction — DONE + verified live (first pick locks metro/county/zip).
2. SUMMARY at top must SYNTHESIZE the comparison in PROSE (AI: "Denver leads on
   momentum, Austin is most affordable, Phoenix…") — NOT a wall of metric cards.
3. Each market's TAB = a FULL report, as deep as an individual single-market
   report. Requires BACKEND change: fetch full data set + generate an AI narrative
   for EVERY comparison market (today comp markets only get score+metrics+history
   → shallow). Reversal of the earlier "data-driven, no backend" choice; user
   accepts longer/costlier generation (N full reports + 1 synthesis per report).
4. TABS: frozen/sticky (don't scroll away so switching is easy); SHORT labels
   (lead city, e.g. "Austin-Round Rock-San Marcos, TX" → "Austin") — NO overflow.
5. Mobile AND web (v1 was shallow on both).

STATUS 2026-06-21: Per-market FULL reports WORK (user confirmed full reports for
both Chicago + Austin in the tabs; Market Pulse shows news from both). Frontend
(synthetic per-market report → single-market template) + backend fork (per-market
narrative + data + per-comparison news) = DONE, tsc clean, NOT committed.
REMAINING = the cross-market SYNTHESIS only (report.ai_narrative): it's fed the
PRIMARY's data for the comparison slot, so the AI says "only one market / metrics
repeat the primary" and can't actually compare; news/indicators primary-only;
verdict_and_actions empty. Diagnosing now (agent), then fix + regenerate.

SYNTHESIS-QUALITY fixes (user, after seeing the rendered synthesis): 6. Head-to-head + economic indicators in the synthesis use ONLY the primary geo's
news/indicators → must incorporate ALL markets' news + economic indicators
(backend now fetches per-comparison news, so feed all markets into the
comparison narrative template vars + prompt). 7. The comparison "Verdict & actions" section must NEVER render "insufficient
data" — always produce a real verdict + actions (robust generation + a
deterministic non-stub fallback).
(These live in the comparison narrative path — buildNarrativeTemplateVars + the
comparison prompt + V2 verdict/actions section. Handle in the backend pass AFTER
the fork lands; do not edit that code in parallel with the fork.)

v1 (shipped to working tree, NOT committed): ComparisonReportV3 + summary cards +
thin data-driven deep-dive + marketBundles defensive score accessor. The score
accessor + geo-restriction + routing/wiring are KEEPERS; the summary + deep-dive
get rebuilt for depth + synthesis. Backend (reports-orchestrator/narrative) must
generate per-comparison-market full data+narrative + a comparison-summary.
Investigations running: frontend section reuse + data gaps; backend gen flow.

## Tasks (sequence: quick wins → big builds)

- [x] **T1** #1 Persona cards — DONE + verified @375: "For you" badge removed; mobile-compact horizontal cards (3 fit one screen, no scroll); bold high-contrast titles + chevron affordance; richer desktop card preserved; fixed pre-existing "Continue as an" grammar bug.
- [x] **T3** #3 Inputs — DONE + verified @375 (typed "Austin, TX" renders dark): `text-on-surface` added to InlineSignupForm ×2 + MarketPickerStep; MarketPicker `bg-white`→`bg-surface`. Both onboarding inputs already correct.
- [x] **T5** #5 Finale persistence — DONE + verified. New `tour/lib/reportCache.ts` (sessionStorage, keyed persona+geoId); `Step4Aha` restores on mount + persists on success, gated so it never races/re-fires; cache cleared on `?resume=fresh`/reset. 22 tour tests pass incl. new persistence test. Live: seeded cache → finale renders from cache, ZERO network POST. NOTE: live full-generation blocked by anon 1/IP/24h 429; restore mechanism verified live, write-on-success unit-tested.
- [x] **T4** #4 Peer numbers — DONE + verified live. New `ListingPresentationPeersService.buildPeers` enriches peers via MetricResolutionService; `adaptPeers` formats them; peer cards show name + scoreLabel + median price + 12-mo growth + days-on-market + sale-to-list. ROOT CAUSE also found+fixed: orchestrator used unregistered IDs `dom_median`/`pct_sold_above_list`/`sale_to_list_ratio` (always null) → corrected to `days_on_market`/`sale_to_list` in both peers AND source market-now (+ adapter METRIC_FORMAT + Peers "Sale-to-list" relabel). Added ref-guard in Step4Aha so the generation fires once (dev StrictMode was double-firing → 429). Backend tsc clean; 86 frontend tests pass. Live (Phoenix): all 4 peer metrics + market-now DOM/sale-to-list render real numbers.
- [~] **T6** #6 Comparison — BUILT + typechecks + logic-tested; authed LIVE render pending. (1) Like-geo restriction live in `MarketSelector` (page.tsx): first market locks the level via `filterByGeoLevel` + dropdown filter + add guard. (2) New comparison view replaces the dead-legacy-score sections: `ComparisonReportV3` = `ComparisonSummaryV3` (all markets compared, live PropertyIQ score + metrics + winner, mobile-first cards) + per-market `PillTabs` -> `MarketDeepDivePanel` (score + 3 drivers + trajectory sparkline + metrics grid). `marketBundles.ts` defensively reads the live score from BOTH nestings (primary `scores.propertyiq` cleaned vs comparison `scores.scores.propertyiq` raw) so no market shows "No Score". Wired via templates/index.ts (`comparison` template = single ComparisonReportV3) + ReportViewer routes all comparisons there. Frontend tsc clean (only pre-existing .next-verify artifact error); 4 ComparisonReportV3 tests pass (both nestings resolve, winner, tabs, fallback). PENDING: authed live /reports render @375 with 2 & 3 markets — blocked by Playwright profile lock (headed mobile-preview window) + auth. Pre-existing file-size debt noted: page.tsx 1104 / ReportViewer 477 (both over 400; not split here).

  (original scope notes:) SCOPE CLARIFIED via investigation. The active `comparison` template uses `ComparisonHero` (already handles N markets) — `ComparisonHeroShowdown`'s `.slice(0,2)` is DEAD CODE (not in any template; red herring). REAL root cause: ALL comparison sections (ComparisonHero, HeadToHeadScoreStory, ComponentShowdown, MarketStrengths, ComparisonVerdict) read DEAD legacy scores `report.homeready_score`/`investoredge_score` + `comp.scores.homeready/investoredge` → every market shows "No Score" (looks like only-first-market). LIVE score = `report.propertyiq_score` + `comparisons[geoId].scores.propertyiq.score`. FIX = migrate those reads to PropertyIQ + mobile-readability pass on the comparison sections (tables/gauges). Then verify @375 with 2 & 3 markets.

- [x] **T2** #2 Three distinct persona finales — DONE + verified live (Phoenix, all 3 personas, single 201 each). Shared `finale/FinaleScaffold.tsx` (config-driven: section order + hero eyebrow/label + AI-strategy voice); `ListingPresentation` refactored to a thin Agent config (tests still pass); new `HomebuyerFinale` (affordability/forecast-forward, "For Homebuyers", "Your buying strategy") + `InvestorFinale` (cash-flow/appreciation-forward, "For Investors", "Your investment strategy"); `ReportHero`/`AiStrategy` got optional persona props; `Step4Aha` routes by `session.persona`. Backend persona narrative confirmed: buyer verdict is buyer-voiced, investor verdict investor-voiced, NO agent/farming framing. 53 finale tests pass. NOTE: InlineSignupForm CTA copy ("share with your client") is still agent-leaning — minor follow-up, separate from the finale.

## Verification

- Build clean with `NEXT_DIST_DIR=.next-verify` (never clobber dev `.next`).
- Live render @375×812 for every UI task; real data, no mocks. Mobile + desktop for #5/#6.

## Review

(filled as tasks complete)

---

