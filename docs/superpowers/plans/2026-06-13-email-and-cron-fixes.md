# Email & Cron Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop non-production environments from running scheduled jobs against the production database (fixes duplicate emails + dev-site links + all dev↔prod cron collisions), and correct + centralize the stale PropertyIQ-Score email copy.

**Architecture:** A single global env flag `RUN_CRONS` gates the one `ScheduleModule.forRoot()` registration in `app.module.ts`, so only the one prod service with `RUN_CRONS=true` runs any `@Cron`. Separately, the canonical score-explainer copy moves into a single `email-copy.ts` in `@propertyiq/emails`, is corrected to the current 4-input methodology, and links to `/scores/accuracy` instead of hardcoding volatile stats.

**Tech Stack:** NestJS 11 (`@nestjs/schedule`), React Email (`@propertyiq/emails`, builds to `dist/` via `tsc`), Jest, Resend.

**Spec:** `docs/superpowers/specs/2026-06-13-email-fixes-design.md`

**Branch:** `develop` (commits land in `D:\projects\rei-platform`; do not push without explicit ask).

---

## Phase 1 — Global cron gate (Item A)

### Task 1: `cronScheduleImports()` helper

**Files:**

- Create: `packages/backend/src/config/cron-schedule.imports.ts`
- Test: `packages/backend/src/config/cron-schedule.imports.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/config/cron-schedule.imports.spec.ts
import { cronScheduleImports } from "./cron-schedule.imports";

describe("cronScheduleImports", () => {
  const original = process.env.RUN_CRONS;
  afterEach(() => {
    if (original === undefined) delete process.env.RUN_CRONS;
    else process.env.RUN_CRONS = original;
  });

  it("returns no schedule module when RUN_CRONS is unset", () => {
    delete process.env.RUN_CRONS;
    expect(cronScheduleImports()).toHaveLength(0);
  });

  it('returns no schedule module when RUN_CRONS is not exactly "true"', () => {
    process.env.RUN_CRONS = "false";
    expect(cronScheduleImports()).toHaveLength(0);
    process.env.RUN_CRONS = "1";
    expect(cronScheduleImports()).toHaveLength(0);
    process.env.RUN_CRONS = "TRUE";
    expect(cronScheduleImports()).toHaveLength(0);
  });

  it("registers exactly one schedule module when RUN_CRONS=true", () => {
    process.env.RUN_CRONS = "true";
    expect(cronScheduleImports()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/config/cron-schedule.imports.spec.ts`
Expected: FAIL — `Cannot find module './cron-schedule.imports'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/backend/src/config/cron-schedule.imports.ts
import type { DynamicModule } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

/**
 * Schedule-module registration, gated on the RUN_CRONS env flag.
 *
 * The dev Railway service AND local dev both run the production build
 * (NODE_ENV=production) and point at the production Supabase DB, so NODE_ENV
 * cannot distinguish the single instance that should own scheduled jobs.
 * RUN_CRONS, set on exactly ONE prod service, makes cron ownership explicit.
 * When it is not exactly "true", `@Cron` handlers are never registered and no
 * scheduled job runs anywhere in this process.
 *
 * Read at module-evaluation time, so it must be a process.env check (ConfigService
 * is not yet available when the AppModule imports array is built).
 */
export function cronScheduleImports(): DynamicModule[] {
  return process.env.RUN_CRONS === "true" ? [ScheduleModule.forRoot()] : [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/config/cron-schedule.imports.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/config/cron-schedule.imports.ts packages/backend/src/config/cron-schedule.imports.spec.ts
git commit -m "feat(cron): RUN_CRONS-gated schedule module helper"
```

---

### Task 2: Wire the gate into AppModule + bootstrap log + .env.example

**Files:**

- Modify: `packages/backend/src/app.module.ts:5` (import) and `:77` (imports array entry)
- Modify: `packages/backend/src/main.ts` (after the listen log, ~line 100)
- Modify: `packages/backend/.env.example`

- [ ] **Step 1: Replace the `ScheduleModule` import with the helper import**

In `packages/backend/src/app.module.ts`, change line 5 from:

```ts
import { ScheduleModule } from "@nestjs/schedule";
```

to:

```ts
import { cronScheduleImports } from "./config/cron-schedule.imports";
```

- [ ] **Step 2: Replace the unconditional registration with the gated spread**

In the same file, in the `imports: [` array, change:

```ts
    ScheduleModule.forRoot(),
```

to:

```ts
    ...cronScheduleImports(),
```

- [ ] **Step 3: Add an observable startup log**

In `packages/backend/src/main.ts`, immediately after the existing `console.log(\`🚀 API running on http://localhost:${port}\`);` (~line 100), add:

```ts
log.log(
  `Scheduled jobs (cron): ${
    process.env.RUN_CRONS === "true"
      ? "ENABLED"
      : "DISABLED (set RUN_CRONS=true to enable — production only)"
  }`,
);
```

(`log` is the `Logger('Bootstrap')` already defined at `main.ts:18`.)

- [ ] **Step 4: Document the flag in `.env.example`**

In `packages/backend/.env.example`, add:

```bash
# Scheduled jobs (cron) master switch. Set to "true" on EXACTLY ONE production
# backend service (backend-production-ee4d). Leave UNSET on dev, local, preview,
# and any other service — they share the production Supabase DB, so running crons
# there double-sends emails and corrupts prod data. Unset = no @Cron runs.
RUN_CRONS=
```

- [ ] **Step 5: Verify build + existing tests still pass**

Run: `cd packages/backend && npx tsc --noEmit && npx jest src/config/cron-schedule.imports.spec.ts`
Expected: tsc clean (no unused-import error for `ScheduleModule`); tests PASS.

- [ ] **Step 6: Verify the gate behavior by booting locally both ways**

Run (gate OFF): `cd packages/backend && npx ts-node -e "process.env.RUN_CRONS='';" ` is not sufficient — instead start the server:

- `cd packages/backend && npm run start:dev` with `RUN_CRONS` unset → startup log shows `Scheduled jobs (cron): DISABLED`. Confirm no drip/digest cron log lines appear.
- Stop, set `RUN_CRONS=true` in `.env.local`, restart → startup log shows `ENABLED`.
- Restore `.env.local` to NOT set `RUN_CRONS` (local must stay disabled).

Expected: the log line flips with the flag.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/app.module.ts packages/backend/src/main.ts packages/backend/.env.example
git commit -m "feat(cron): gate all scheduled jobs behind RUN_CRONS in AppModule"
```

---

## Phase 2 — Correct + centralize the score copy (Items B + C foundation)

### Task 3: Create `email-copy.ts`, export it, rebuild, guard with a test

**Files:**

- Create: `packages/emails/copy/email-copy.ts`
- Modify: `packages/emails/index.ts` (barrel export)
- Test: `packages/backend/src/email/__tests__/email-copy.spec.ts`

- [ ] **Step 1: Create the copy module**

```ts
// packages/emails/copy/email-copy.ts
/**
 * Single source of truth for PropertyIQ marketing/lifecycle email copy.
 * Edit wording HERE; React templates and backend HTML builders import from this file.
 *
 * RULE: never hardcode validation statistics (dollar impact, hit rate, year counts)
 * in email copy — they change every time the score is re-tuned and have already gone
 * stale three times. Link to the live /scores/accuracy page instead.
 */

/**
 * The current PropertyIQ Score methodology in one sentence (CLAUDE.md §9):
 * four demand-signal inputs from Zillow (home-value momentum) + Realtor (DOM, price cuts).
 * No Redfin. No "% sold above list" / "months of supply" (those were the retired v4 formula).
 */
export const SCORE_DESCRIPTION =
  "The PropertyIQ Score blends four demand signals: home-value momentum over the last 12 and 3 months (from Zillow), how fast homes are selling (median days on market), and the share of listings with price cuts (from Realtor).";

/** Relative path (append to the app base URL) for the live methodology / track-record page. */
export const SCORES_ACCURACY_PATH = "/scores/accuracy";
```

- [ ] **Step 2: Export from the package barrel**

In `packages/emails/index.ts`, add at the end (after the type exports):

```ts
// Shared copy (single source of truth for marketing/lifecycle wording)
export { SCORE_DESCRIPTION, SCORES_ACCURACY_PATH } from "./copy/email-copy";
```

- [ ] **Step 3: Rebuild the emails package (REQUIRED — backend consumes `dist/`)**

Run: `cd packages/emails && npm run build`
Expected: `dist/index.js` + `dist/copy/email-copy.js` emitted, no TS errors.

> Without this rebuild the backend import in Step 4/Task 5 resolves to `undefined` at runtime.

- [ ] **Step 4: Write the guard test**

```ts
// packages/backend/src/email/__tests__/email-copy.spec.ts
import { SCORE_DESCRIPTION, SCORES_ACCURACY_PATH } from "@propertyiq/emails";

describe("SCORE_DESCRIPTION reflects the current PropertyIQ methodology", () => {
  it("describes four demand signals sourced from Zillow + Realtor", () => {
    expect(SCORE_DESCRIPTION).toMatch(/four/i);
    expect(SCORE_DESCRIPTION).toMatch(/Zillow/);
    expect(SCORE_DESCRIPTION).toMatch(/Realtor/);
  });

  it("does NOT reference the retired Redfin 3-metric formula", () => {
    expect(SCORE_DESCRIPTION).not.toMatch(/Redfin/i);
    expect(SCORE_DESCRIPTION).not.toMatch(/months of supply/i);
    expect(SCORE_DESCRIPTION).not.toMatch(/sold above list/i);
  });

  it("exposes the accuracy page path for linking instead of hardcoded stats", () => {
    expect(SCORES_ACCURACY_PATH).toBe("/scores/accuracy");
    expect(SCORE_DESCRIPTION).not.toMatch(/\$18,?100/);
    expect(SCORE_DESCRIPTION).not.toMatch(/100% (year )?hit rate/i);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `cd packages/backend && npx jest src/email/__tests__/email-copy.spec.ts`
Expected: PASS (3 tests). If it fails with a module-resolution error, re-run Step 3 (rebuild).

- [ ] **Step 6: Commit**

```bash
git add packages/emails/copy/email-copy.ts packages/emails/index.ts packages/emails/dist packages/backend/src/email/__tests__/email-copy.spec.ts
git commit -m "feat(emails): centralized SCORE_DESCRIPTION copy (4-input methodology, no hardcoded stats)"
```

---

### Task 4: Fix `onboarding-day1-scores.tsx`

**Files:**

- Modify: `packages/emails/emails/onboarding-day1-scores.tsx`

- [ ] **Step 1: Import the shared copy**

At the top of `onboarding-day1-scores.tsx`, after the existing imports, add:

```ts
import { SCORE_DESCRIPTION, SCORES_ACCURACY_PATH } from "../copy/email-copy";
```

- [ ] **Step 2: Derive the accuracy URL**

Inside the component, next to `const mapUrl = \`${loginUrl}/map\`;`, add:

```ts
const accuracyUrl = `${loginUrl}${SCORES_ACCURACY_PATH}`;
```

- [ ] **Step 3: Replace the two stale paragraphs**

Replace this block (the "3 demand-signal metrics…" paragraph and the "$18,100" paragraph):

```tsx
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        The score is built from 3 demand-signal metrics: % Sold Above List
        Price, Median Days on Market, and Months of Supply — validated across 13
        years with a 100% year hit rate.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Markets scoring 80+ have historically gained{" "}
        <strong>$18,100 more</strong> on a typical home over 3 years compared to
        bottom-scoring markets.
      </Text>
```

with:

```tsx
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        {SCORE_DESCRIPTION}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Want the receipts? See how the score has performed against real market
        outcomes:{" "}
        <Link href={accuracyUrl} className="text-brand underline">
          {accuracyUrl}
        </Link>
      </Text>
```

(`Link` is already imported in this file.)

- [ ] **Step 4: Verify the emails package builds**

Run: `cd packages/emails && npx tsc --skipLibCheck --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/emails/emails/onboarding-day1-scores.tsx
git commit -m "fix(emails): onboarding-day1 score copy to 4 inputs + /scores/accuracy link"
```

---

### Task 5: Fix `active_explorer` copy (`behavioral-trigger-emails.ts`)

**Files:**

- Modify: `packages/backend/src/email/behavioral-trigger-emails.ts` (top import + `buildActiveExplorerEmail`, ~line 176)

- [ ] **Step 1: Import the shared copy**

At the top of `behavioral-trigger-emails.ts`, add (with the other imports):

```ts
import { SCORE_DESCRIPTION } from "@propertyiq/emails";
```

- [ ] **Step 2: Replace the stale Redfin sentence**

In `buildActiveExplorerEmail`, replace:

```ts
    <p style="margin:0 0 24px; font-size:15px; color:#424242; line-height:1.6;">
      Scores are calculated from sold-above-list rate, days on market, and months of supply — updated monthly from Redfin data.
    </p>
```

with:

```ts
    <p style="margin:0 0 24px; font-size:15px; color:#424242; line-height:1.6;">
      ${SCORE_DESCRIPTION}
    </p>
```

- [ ] **Step 3: Verify backend build + the copy guard test**

Run: `cd packages/backend && npx tsc --noEmit && npx jest src/email/__tests__/email-copy.spec.ts`
Expected: tsc clean; tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/email/behavioral-trigger-emails.ts
git commit -m "fix(emails): active_explorer score copy to 4 inputs, drop Redfin reference"
```

---

### Task 6: Render-verify the two corrected emails

**Files:** none (verification only)

- [ ] **Step 1: Confirm no stale terms remain in any shipped copy**

Run: `git grep -nEi "months of supply|sold above list|from redfin data|3 demand-signal|\\$18,?100|100% year hit" -- packages/emails/emails packages/backend/src/email`
Expected: **no matches** (the only remaining "Redfin" references, if any, are in unrelated/transactional files out of scope — verify each hit is not a marketing email).

- [ ] **Step 2: Visually confirm the day1 email**

Run: `cd packages/emails && npm run dev` (opens the React Email preview on :3002). Open **Onboarding Day1 Scores**. Confirm: four demand signals named, Zillow + Realtor present, a working `/scores/accuracy` link, no dollar/hit-rate/years claims, no "Redfin"/"months of supply". Stop the dev server.

- [ ] **Step 3: No commit** (verification only). If issues found, fix in Task 4/5 and re-verify.

---

## Phase 3 — Centralize the remaining drip copy (Item C remainder)

> Mechanical refactor, lower urgency than Phases 1–2 (which resolve all three reported bugs). The strings already exist in each template; this moves them into `email-copy.ts` so future edits are one-liners. Do it template-by-template so each change is independently verifiable.

### Task 7: Move remaining marketing/lifecycle copy into `email-copy.ts`

**Files (one commit per template):**

- React templates: `onboarding-day0-welcome`, `onboarding-day3-compare`, `onboarding-day5-upgrade`, `onboarding-day7-profile`, `onboarding-day10-zillow`, `onboarding-day14-report`, `winback-day14` (all under `packages/emails/emails/`)
- Backend HTML builders in `packages/backend/src/email/behavioral-trigger-emails.ts`: `buildWelcomeEmail`, `buildReportGeneratedEmail`, `buildPaywallHitEmail`, `buildPostTrial7dEmail`, `buildInactive24hEmail`, `buildTrialDay10Email`, `buildTrialDay13Email`, `buildTrialExpiredEmail`

**Per-template recipe (repeat for each file above):**

- [ ] **Step 1:** In `packages/emails/copy/email-copy.ts`, add one exported `const` for that email — a typed object holding its `heading`, `body` paragraphs (string or `string[]` for bullet lists), and `cta` label. Example shape:

```ts
export const ONBOARDING_DAY0 = {
  heading: "Your free PropertyIQ Score is ready",
  body: [
    "First sentence exactly as it appears in the template today.",
    "Second paragraph, verbatim.",
  ],
  bullets: ["Bullet one, verbatim", "Bullet two, verbatim"],
  cta: "Get Started",
} as const;
```

Copy the **exact** current strings out of the template — do not reword (except the score sentence, which must use `SCORE_DESCRIPTION` if the template contains one).

- [ ] **Step 2:** For React templates, add `export { ONBOARDING_DAYx } from './copy/email-copy';` to `packages/emails/index.ts` only if a backend builder needs it; React templates import directly via `../copy/email-copy`.

- [ ] **Step 3:** Replace the inline JSX/HTML literal text in the template with references to the new constant (map `bullets` to `<li>`/`<ul>`; keep all markup, props, and `{name}`/URL interpolation unchanged).

- [ ] **Step 4:** Rebuild: `cd packages/emails && npm run build` (required before backend builders that import new exports).

- [ ] **Step 5:** Verify: `cd packages/emails && npx tsc --skipLibCheck --noEmit` (React templates) and/or `cd packages/backend && npx tsc --noEmit` (HTML builders). Then `npm run dev` preview the template and confirm it renders identically to before (same words, same links), except any intended score-copy correction.

- [ ] **Step 6:** Commit, e.g. `git commit -m "refactor(emails): centralize <template> copy into email-copy.ts"`.

- [ ] **Final step:** After all templates are migrated, rebuild the emails package once more and run the full backend email test suite:

Run: `cd packages/emails && npm run build && cd ../backend && npx jest src/email`
Expected: all email tests PASS.

```bash
git add packages/emails/dist
git commit -m "chore(emails): rebuild dist after copy centralization"
```

---

## Phase 4 — Rollout & post-deploy verification

### Task 8: Set `RUN_CRONS` on prod, deploy, verify

**Files:** none (operations). Requires the user (Railway dashboard + push) per project rules; do not push without explicit ask.

- [ ] **Step 1: Set the prod flag BEFORE/with the deploy**

On Railway, on the **canonical prod backend** service (`backend-production-ee4d`) only, add variable: `RUN_CRONS=true`. Do **not** set it on the dev backend, local, or `analytics-production`.

- [ ] **Step 2: Deploy `develop` → prod** (user-driven push/merge per normal process).

- [ ] **Step 3: Confirm the prod startup log**

In Railway prod backend logs, confirm: `Scheduled jobs (cron): ENABLED`. In dev backend logs, confirm: `DISABLED (set RUN_CRONS=true ...)`.

- [ ] **Step 4: Post-deploy duplicate + link check (real, via Resend)**

After the next scheduled drip window (09:00 UTC) — or by triggering a known cron path — check the Resend send log:

- Each recipient receives **exactly one** copy of each email (no same-second duplicates).
- All links use `https://www.propertyiq.app/...` (zero `devpropertyiq.up.railway.app`).
- The score-explainer email shows the four inputs + `/scores/accuracy` link, no "Redfin"/old stats.

- [ ] **Step 5: Confirm dev/local are silent**

Confirm the dev backend produced **zero** cron sends at the scheduled window, and no dev data-job writes occurred.

---

## Self-Review Notes

- **Spec coverage:** Item A → Tasks 1–2 + Task 8 (rollout). Item B → Tasks 3–6. Item C (foundation) → Task 3–4; (remainder, all drip copy) → Task 7. Verification → Tasks 6, 8. Rollout/risks → Task 8.
- **Order dependency:** Task 5 and Task 7 backend builders depend on Task 3's barrel export being rebuilt to `dist/` (`npm run build`) — each task that adds a new `@propertyiq/emails` export re-runs the build before the backend consumes it.
- **No hardcoded stats:** the corrected copy links to `/scores/accuracy`; the guard test (Task 3) fails if `$18,100`/hit-rate phrasing reappears in `SCORE_DESCRIPTION`.
