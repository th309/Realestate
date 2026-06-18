# Trial Walkthrough — Feedback Fixes (2026-06-18)

Source: user's manual 14-day trial walk. Branch: `develop` (commit locally; never push without ask).
Standards: production-ready, no workarounds; verify LIVE in browser (no mocks).

## Decisions (locked)

- **D1 Score movers** → quick repoint now (emails → `/screener` current-score sort); full movers feature DEFERRED to a follow-up phase.
- **D2 Feature guidance** → lightweight checklist nudges (reuse `updateChecklistTask` / onboarding checklist); keep anti-haunting fix intact.
- **D3 Day-7 reframe** → trial-aware framing (what your Pro trial unlocks + what reverts to free).
- **Unsubscribe** → build FULL compliant flow now (public one-click + List-Unsubscribe headers + physical address).
- **T1 dev email escape** → skip.
- **Physical address (from ToS):** `Republic Registered Agent LLC, 20 S Charles St, Ste 403, Baltimore, MD 21201`.

## DONE (verified compile; ready to commit)

- [x] **B2a** day-3 copy: "filter on the map" → Screener (`scoreMin=70`); template CTA + fallback → `screenerUrl`.
- [x] **B2b** day-5 movers links → `/screener?sortBy=score&sortOrder=desc`; copy reworded to "Open the Screener / current rankings".
- [x] **B2c** day-7 reframed trial-aware: new heading/intro, `trialNote`, CTA "Keep Pro Access", benefit emoji 🔒→✓.
- [x] **B1 (part b)** standalone signup redirect → `/tour?resume=fresh` (wipes stale `piq_tour`; callback `?phase=celebrate` left untouched). Emails package `tsc --noEmit` = clean.

## IN PROGRESS (parallel implementation)

- [ ] **Unsubscribe vertical (full compliant)** — backend token util + public GET/POST controller; `email.service` `headers` support + `List-Unsubscribe`/`List-Unsubscribe-Post`; wire lifecycle/marketing senders; register controller; frontend public `/unsubscribed` confirmation page; `layout.tsx` footer = unsubscribe link (tokenized) + physical address.
- [ ] **B3 entitlement cold-load retry** — `api.ts` + `EntitlementsContext.tsx`: bounded backoff retry on transient fetch failure so an authed user is never stranded on `free`. (Backend proven correct: returns `pro` for active trial, cache-bypassed.)
- [ ] **B1 (part a)** tour user-scoping — `useTourSession.ts`: tag stored session with userId; clear/reset when authed user differs (robust beyond the signup-redirect fix).

## TODO (next phase)

- [ ] **D2 feature-discovery nudges** — frontend-design skill; dismissible nudges for un-tried Pro features via existing onboarding checklist.
- [ ] **Movers feature (deferred)** — Screener score-delta over 1mo/90d/120d/180d/1yr/3yr (up & down). Separate phase.

## Verification gate (per task, before commit)

Build (affected packages) + live browser check against running stack (no mocks): tour fresh signup → persona picker; entitlements show Pro for active trial; unsubscribe one-click sets `email_preferences.marketing=false` without login; emails render correct links.

## Review

(to be filled in after execution)
