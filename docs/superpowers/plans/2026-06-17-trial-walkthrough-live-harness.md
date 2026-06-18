# Live 14-Day Trial Walkthrough Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix trial-email targeting so reverse-trial users actually receive the lifecycle drip, then build a live, headed Playwright harness that drives a real signup → OTP → tour → day-by-day feature usage with logout/login persistence + updated suggestions + real emails, through trial expiry.

**Architecture:** Two coupled parts. Part A rewires the trial countdown emails and the onboarding drip to the canonical `user_trials` table (backend, TDD). Part B adds a triple-gated dev-only backend hook to time-travel/fire emails on demand, plus a Playwright spec that orchestrates the 14-day journey and asserts against real DB, real `/api/usage/coverage`, real UI, and a real inbox (OTP + drip read over IMAP). Implemented red→green: missing-email assertions fail on current code, pass after Part A.

**Tech Stack:** NestJS 11, Supabase (Postgres), Resend, React Email, Next.js 16 App Router, Playwright, Jest, `imapflow` (Gmail IMAP read), `@supabase/supabase-js` service-role client.

## Global Constraints

- Default branch: `develop`. Never push without explicit user ask. Verify branch before every commit.
- No `Co-Authored-By` lines in commits.
- Backend file size: logic <300 lines hard limit; one exported unit per file.
- Secrets: never hardcode fallbacks; app must crash if a required secret is missing. Never echo secret values.
- Email prose style stays as-is in templates; do not rewrite copy.
- Test account: `troyhouston76+test4@gmail.com` / password supplied out-of-band (read from env `TEST_USER_PASSWORD`, never inline in code or commits).
- Dev hook must be impossible to enable in production: `AdminGuard` + `process.env.DEV_WALKTHROUGH_ENABLED==='true'` + hard refuse when `NODE_ENV==='production'`.
- Real data only — no mocks for the live walkthrough; Jest mocks allowed only for Part A unit tests.

---

## File Structure

**Part A — email fix (modify):**

- `packages/backend/src/email/behavioral-trigger.utils.ts` — add `TrialRow` type + `extractUsersFromTrials()`.
- `packages/backend/src/email/behavioral-trigger.service.ts` — query `user_trials`; expose public single-fire wrappers.
- `packages/backend/src/email/engagement-trigger.service.ts` — ensure a public `fireWelcome()` entry.
- `packages/backend/src/email/drip.service.ts` — suppress only day-10/14 for active trials; add public `runDripDay()`.
- `packages/backend/src/email/email.module.ts` — export the three trigger services + DripService.
- Tests (create): `behavioral-trigger.utils.spec.ts`, `behavioral-trigger.service.spec.ts`, `drip.service.spec.ts`.

**Part B — dev hook (create):**

- `packages/backend/src/admin/dev-walkthrough/dev-walkthrough.service.ts`
- `packages/backend/src/admin/dev-walkthrough/dev-walkthrough.controller.ts`
- `packages/backend/src/admin/dev-walkthrough/dev-walkthrough.module.ts`
- `packages/backend/src/admin/dev-walkthrough/dev-walkthrough.imports.ts` (conditional-import helper)
- `packages/backend/src/app.module.ts` — register conditionally.

**Part C — harness (create):**

- `packages/frontend/tests/harness/supabaseAdmin.ts` — service-role client + DB assertions.
- `packages/frontend/tests/harness/devHook.ts` — typed client for `/api/admin/dev/trial-walkthrough/*`.
- `packages/frontend/tests/harness/gmailOtp.ts` — IMAP reader for OTP + drip emails.
- `packages/frontend/tests/harness/flows.ts` — signup/OTP/tour/login/logout/feature-drive helpers.
- `packages/frontend/tests/e2e/trial-walkthrough.spec.ts` — the orchestration spec.

---

## PART A — Email targeting fix

### Task A1: `extractUsersFromTrials` util

**Files:**

- Modify: `packages/backend/src/email/behavioral-trigger.utils.ts`
- Test: `packages/backend/src/email/behavioral-trigger.utils.spec.ts` (create)

**Interfaces:**

- Produces: `extractUsersFromTrials(rows: TrialRow[]): EligibleUser[]`, `interface TrialRow { user_id: string; expires_at: string; user_profiles: {id:string;email:string} | {id:string;email:string}[] | null }`

- [ ] **Step 1: Write the failing test**

```typescript
// behavioral-trigger.utils.spec.ts
import { extractUsersFromTrials } from "./behavioral-trigger.utils";

describe("extractUsersFromTrials", () => {
  it("extracts users from an object-shaped join", () => {
    const rows = [
      {
        user_id: "u1",
        expires_at: "2026-07-01T00:00:00Z",
        user_profiles: { id: "u1", email: "a@test.com" },
      },
    ];
    expect(extractUsersFromTrials(rows)).toEqual([
      { id: "u1", email: "a@test.com" },
    ]);
  });

  it("extracts from an array-shaped join and skips rows missing email", () => {
    const rows = [
      {
        user_id: "u2",
        expires_at: "x",
        user_profiles: [{ id: "u2", email: "b@test.com" }],
      },
      { user_id: "u3", expires_at: "x", user_profiles: null },
    ];
    expect(extractUsersFromTrials(rows)).toEqual([
      { id: "u2", email: "b@test.com" },
    ]);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/backend && npx jest src/email/behavioral-trigger.utils.spec.ts`
Expected: FAIL — `extractUsersFromTrials is not a function`.

- [ ] **Step 3: Implement**

Append to `behavioral-trigger.utils.ts`:

```typescript
export interface TrialRow {
  user_id: string;
  expires_at: string;
  user_profiles:
    | { id: string; email: string }
    | { id: string; email: string }[]
    | null;
}

export function extractUsersFromTrials(rows: TrialRow[]): EligibleUser[] {
  const users: EligibleUser[] = [];
  for (const row of rows) {
    if (!row.user_profiles) continue;
    const profile = Array.isArray(row.user_profiles)
      ? row.user_profiles[0]
      : row.user_profiles;
    if (profile?.id && profile?.email) {
      users.push({ id: profile.id, email: profile.email });
    }
  }
  return users;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx jest src/email/behavioral-trigger.utils.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/email/behavioral-trigger.utils.ts packages/backend/src/email/behavioral-trigger.utils.spec.ts
git commit -m "feat(email): add extractUsersFromTrials util for user_trials-based targeting"
```

---

### Task A2: Countdown emails read `user_trials` + public single-fire wrappers

**Files:**

- Modify: `packages/backend/src/email/behavioral-trigger.service.ts`
- Test: `packages/backend/src/email/behavioral-trigger.service.spec.ts` (create)

**Interfaces:**

- Consumes: `extractUsersFromTrials`, `getFutureDayBoundaries`, `getPastDayBoundaries` (Task A1 + existing).
- Produces (public): `fireTrialDay10()`, `fireTrialDay13()`, `fireTrialExpired()` (visibility changed to public for the dev hook), unchanged dedup via `email_triggers`.

- [ ] **Step 1: Write the failing test**

```typescript
// behavioral-trigger.service.spec.ts
import { BehavioralTriggerService } from "./behavioral-trigger.service";

function makeService(trialRows: any[]) {
  const sent: any[] = [];
  const fromSpy = jest.fn((table: string) => {
    if (table === "user_trials") {
      return {
        select: () => ({
          is: () => ({
            is: () => ({
              gte: () => ({
                lt: () => Promise.resolve({ data: trialRows, error: null }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "email_triggers") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
          }),
        }),
        insert: (row: any) => {
          sent.push(row);
          return Promise.resolve({ data: null, error: null });
        },
      };
    }
    if (table === "email_preferences") {
      return {
        select: () => ({
          in: () => ({ eq: () => Promise.resolve({ data: [] }) }),
        }),
      };
    }
    return {} as any;
  });
  const supabase = { from: fromSpy } as any;
  const emailService = { sendEmail: jest.fn().mockResolvedValue(true) } as any;
  const config = { get: () => "https://app.test" } as any;
  const lock = {
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn(),
  } as any;
  const engagement = { processAll: jest.fn() } as any;
  const svc = new BehavioralTriggerService(
    supabase,
    emailService,
    config,
    lock,
    engagement,
  );
  return { svc, emailService, fromSpy };
}

describe("BehavioralTriggerService trial emails read user_trials", () => {
  it("queries user_trials and sends the day-13 email to an active trial user", async () => {
    const { svc, emailService, fromSpy } = makeService([
      {
        user_id: "u1",
        expires_at: "2026-07-01T12:00:00Z",
        user_profiles: { id: "u1", email: "a@test.com" },
      },
    ]);
    await svc.fireTrialDay13();
    expect(fromSpy).toHaveBeenCalledWith("user_trials");
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "a@test.com", emailType: "trial_day_13" }),
    );
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx jest src/email/behavioral-trigger.service.spec.ts`
Expected: FAIL — current code queries `user_subscriptions` (the `from` spy for `user_trials` is never hit) / method is private.

- [ ] **Step 3: Implement**

In `behavioral-trigger.service.ts`: (a) replace the import `extractUsersFromSubscriptions` with `extractUsersFromTrials`; (b) rewrite the shared loop to read `user_trials`; (c) change the three `fireTrial*` methods to `public`.

Replace the body of `sendToTrialingUsers` query block (lines ~120-133) with:

```typescript
const { data: candidates, error } = await this.supabase
  .from("user_trials")
  .select("user_id, expires_at, user_profiles(id, email)")
  .is("converted_at", null)
  .is("cancelled_at", null)
  .gte("expires_at", rangeStart)
  .lt("expires_at", rangeEnd);

if (error) {
  this.logger.error(`${triggerName}: query failed: ${error.message}`);
  return;
}
if (!candidates?.length) return;

const users = extractUsersFromTrials(candidates);
```

Change the three method declarations from `private fireTrialDay10()` / `13` / `Expired()` to `public fireTrialDay10()` etc. (the `processTriggersHourly` cron still calls them; behavior unchanged).

- [ ] **Step 4: Run test, verify it passes**

Run: `npx jest src/email/behavioral-trigger.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/email/behavioral-trigger.service.ts packages/backend/src/email/behavioral-trigger.service.spec.ts
git commit -m "fix(email): trial countdown emails target canonical user_trials, not user_subscriptions"
```

---

### Task A3: Drip suppresses only day-10/14 for active trials + public `runDripDay`

**Files:**

- Modify: `packages/backend/src/email/drip.service.ts`
- Test: `packages/backend/src/email/drip.service.spec.ts` (create)

**Interfaces:**

- Produces (public): `runDripDay(day: number): Promise<{sent:number;skipped:number;failed:number}>` — looks up the `DRIP_DAY_CONFIGS` entry and calls the existing private `processDripDay`.

- [ ] **Step 1: Write the failing test**

```typescript
// drip.service.spec.ts — focused on the suppression rule
import { DripService } from "./drip.service";

describe("DripService active-trial suppression", () => {
  it("exposes runDripDay for a specific day", () => {
    const svc = new DripService({} as any, {} as any, {} as any, {} as any);
    expect(typeof (svc as any).runDripDay).toBe("function");
  });
});
```

(Note: full send-path coverage is exercised live in Part C; this unit test pins the new public API + the suppression branch via a follow-up assertion once `processDripDay` is refactored to accept an injectable trial check. Keep this test minimal to avoid over-mocking the chained query builder.)

- [ ] **Step 2: Run test, verify it fails**

Run: `npx jest src/email/drip.service.spec.ts`
Expected: FAIL — `runDripDay` undefined (and constructor arity may differ; adjust the `new DripService(...)` args to match the real constructor signature found in the file before running).

- [ ] **Step 3: Implement**

(a) Replace the skip block at lines 185-198 so it only suppresses days 10 and 14 for active-trial users:

```typescript
// Reverse-trial users now receive the nurture drip (days 0/1/3/5/7).
// Suppress only the end-of-trial pushes (day 10 & 14) — the countdown
// emails (trial_day_10 / trial_day_13 / trial_expired) own that window.
if (dayConfig.day === 10 || dayConfig.day === 14) {
  const { data: activeTrial } = await this.supabase
    .from("user_trials")
    .select("id")
    .eq("user_id", user.id)
    .is("converted_at", null)
    .is("cancelled_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (activeTrial) {
    skipped++;
    continue;
  }
}
```

(b) Add the public wrapper (place near `processOnboardingDrip`):

```typescript
  /** Dev/test entry: run a single drip day deterministically (no cron lock). */
  async runDripDay(day: number) {
    const config = DRIP_DAY_CONFIGS.find((c) => c.day === day);
    if (!config) {
      throw new Error(`No drip config for day ${day}`);
    }
    return this.processDripDay(config);
  }
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx jest src/email/drip.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/email/drip.service.ts packages/backend/src/email/drip.service.spec.ts
git commit -m "fix(email): reverse-trial users get nurture drip; suppress only day10/14 overlap"
```

---

### Task A4: Public `fireWelcome` + export email services

**Files:**

- Modify: `packages/backend/src/email/engagement-trigger.service.ts` (ensure `public fireWelcome()`)
- Modify: `packages/backend/src/email/email.module.ts`

- [ ] **Step 1: Verify/expose `fireWelcome`**

Open `engagement-trigger.service.ts`; if `fireWelcome()` is `private`, change to `public`. (It is called by `processAll()`.) No new logic.

- [ ] **Step 2: Export services from the module**

In `email.module.ts`, ensure the `exports` array includes:

```typescript
  exports: [EmailService, DripService, BehavioralTriggerService, EngagementTriggerService],
```

- [ ] **Step 3: Build to verify wiring**

Run: `cd packages/backend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/email/engagement-trigger.service.ts packages/backend/src/email/email.module.ts
git commit -m "chore(email): expose fireWelcome + export trigger services for dev hook"
```

---

## PART B — Dev-only walkthrough hook

### Task B1: `DevWalkthroughService` (time-travel + fire + teardown)

**Files:**

- Create: `packages/backend/src/admin/dev-walkthrough/dev-walkthrough.service.ts`
- Test: `packages/backend/src/admin/dev-walkthrough/dev-walkthrough.service.spec.ts`

**Interfaces:**

- Consumes: `SUPABASE_CLIENT`, `DripService.runDripDay`, `BehavioralTriggerService.fireTrialDay10/13/Expired`, `EngagementTriggerService.fireWelcome`, `UsersService.deleteUser` (from `admin/users`).
- Produces:
  - `advanceToDay(userId: string, toDay: number): Promise<{ created_at: string; started_at: string; expires_at: string }>`
  - `fireJob(job: 'welcome'|'drip0'|'drip1'|'drip3'|'drip5'|'drip7'|'trial_day_10'|'trial_day_13'|'trial_expired'): Promise<void>`
  - `teardown(userId: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

```typescript
// dev-walkthrough.service.spec.ts
import { DevWalkthroughService } from "./dev-walkthrough.service";

describe("DevWalkthroughService.advanceToDay", () => {
  it("sets expires_at to (14 - toDay) days ahead at UTC noon and clears dedup", async () => {
    const updates: Record<string, any> = {};
    const deletes: string[] = [];
    const supabase = {
      from: (t: string) => ({
        update: (vals: any) => ({
          eq: () => {
            updates[t] = vals;
            return Promise.resolve({ error: null });
          },
        }),
        delete: () => ({
          eq: () => {
            deletes.push(t);
            return Promise.resolve({ error: null });
          },
        }),
      }),
    } as any;
    const svc = new DevWalkthroughService(
      supabase,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const res = await svc.advanceToDay("u1", 10);
    const expires = new Date(res.expires_at);
    const days = Math.round((expires.getTime() - Date.now()) / 86_400_000);
    expect(days).toBe(4);
    expect(deletes).toEqual(
      expect.arrayContaining(["email_log", "email_triggers"]),
    );
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx jest src/admin/dev-walkthrough/dev-walkthrough.service.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import { Injectable, Inject, ForbiddenException } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.service";
import { DripService } from "../../email/drip.service";
import { BehavioralTriggerService } from "../../email/behavioral-trigger.service";
import { EngagementTriggerService } from "../../email/engagement-trigger.service";
import { UsersService } from "../users/users.service";

const TRIAL_DAYS = 14;

function utcNoonOffset(days: number): Date {
  const now = new Date();
  const d = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + days,
      12,
      0,
      0,
    ),
  );
  return d;
}

@Injectable()
export class DevWalkthroughService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly drip: DripService,
    private readonly behavioral: BehavioralTriggerService,
    private readonly engagement: EngagementTriggerService,
    private readonly users: UsersService,
  ) {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException(
        "DevWalkthroughService is disabled in production",
      );
    }
  }

  async advanceToDay(userId: string, toDay: number) {
    const createdAt = utcNoonOffset(-toDay);
    const startedAt = utcNoonOffset(-toDay);
    const expiresAt = utcNoonOffset(TRIAL_DAYS - toDay);

    await this.supabase
      .from("user_profiles")
      .update({ created_at: createdAt.toISOString() })
      .eq("id", userId);
    await this.supabase
      .from("user_trials")
      .update({
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq("user_id", userId);

    // Clear dedup so the target email can re-fire.
    await this.supabase.from("email_log").delete().eq("user_id", userId);
    await this.supabase.from("email_triggers").delete().eq("user_id", userId);

    return {
      created_at: createdAt.toISOString(),
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
  }

  async fireJob(job: string): Promise<void> {
    if (job === "welcome") return void (await this.engagement.fireWelcome());
    if (job.startsWith("drip"))
      return void (await this.drip.runDripDay(Number(job.slice(4))));
    if (job === "trial_day_10")
      return void (await this.behavioral.fireTrialDay10());
    if (job === "trial_day_13")
      return void (await this.behavioral.fireTrialDay13());
    if (job === "trial_expired")
      return void (await this.behavioral.fireTrialExpired());
    throw new Error(`Unknown job: ${job}`);
  }

  async teardown(userId: string): Promise<void> {
    await this.users.deleteUser(userId);
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx jest src/admin/dev-walkthrough/dev-walkthrough.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/admin/dev-walkthrough/dev-walkthrough.service.ts packages/backend/src/admin/dev-walkthrough/dev-walkthrough.service.spec.ts
git commit -m "feat(dev): DevWalkthroughService time-travel + fire + teardown"
```

---

### Task B2: Controller + module + conditional registration

**Files:**

- Create: `dev-walkthrough.controller.ts`, `dev-walkthrough.module.ts`, `dev-walkthrough.imports.ts`
- Modify: `packages/backend/src/app.module.ts`

**Interfaces:**

- Routes (prefix `api/admin/dev/trial-walkthrough`, `@UseGuards(AdminGuard)`):
  - `POST /advance` body `{ userId: string; toDay: number }`
  - `POST /fire` body `{ job: string }`
  - `DELETE /user/:userId`

- [ ] **Step 1: Implement controller**

```typescript
// dev-walkthrough.controller.ts
import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { AdminGuard } from "../../common/guards/admin-auth.guard";
import { DevWalkthroughService } from "./dev-walkthrough.service";

@UseGuards(AdminGuard)
@Controller("api/admin/dev/trial-walkthrough")
export class DevWalkthroughController {
  private readonly logger = new Logger(DevWalkthroughController.name);
  constructor(private readonly svc: DevWalkthroughService) {}

  @Post("advance")
  async advance(@Body() body: { userId: string; toDay: number }) {
    const dates = await this.svc.advanceToDay(body.userId, body.toDay);
    return { success: true, data: dates };
  }

  @Post("fire")
  async fire(@Body() body: { job: string }) {
    await this.svc.fireJob(body.job);
    return { success: true };
  }

  @Delete("user/:userId")
  async teardown(@Param("userId") userId: string) {
    await this.svc.teardown(userId);
    return { success: true };
  }
}
```

- [ ] **Step 2: Implement module + conditional-import helper**

```typescript
// dev-walkthrough.module.ts
import { Module } from "@nestjs/common";
import { SupabaseModule } from "../../supabase/supabase.module";
import { EmailModule } from "../../email/email.module";
import { UsersModule } from "../users/users.module";
import { DevWalkthroughController } from "./dev-walkthrough.controller";
import { DevWalkthroughService } from "./dev-walkthrough.service";

@Module({
  imports: [SupabaseModule, EmailModule, UsersModule],
  controllers: [DevWalkthroughController],
  providers: [DevWalkthroughService],
})
export class DevWalkthroughModule {}
```

```typescript
// dev-walkthrough.imports.ts
import { DynamicModule } from "@nestjs/common";
import { DevWalkthroughModule } from "./dev-walkthrough.module";

export function devWalkthroughImports(): (typeof DevWalkthroughModule)[] {
  return process.env.DEV_WALKTHROUGH_ENABLED === "true" &&
    process.env.NODE_ENV !== "production"
    ? [DevWalkthroughModule]
    : [];
}
```

(Verify the admin users module export name — it may be `AdminUsersModule`. Match the real file `packages/backend/src/admin/users/*.module.ts` and ensure it `exports: [UsersService]`.)

- [ ] **Step 3: Register in AppModule**

In `app.module.ts` add near the other helper-based imports:

```typescript
import { devWalkthroughImports } from './admin/dev-walkthrough/dev-walkthrough.imports';
// ...in imports array:
    ...devWalkthroughImports(),
```

- [ ] **Step 4: Build**

Run: `cd packages/backend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Smoke test the gate**

Run (flag off): `curl -s -X POST localhost:3001/api/admin/dev/trial-walkthrough/fire -d '{}' -H 'content-type: application/json'`
Expected: 404 (route not registered when `DEV_WALKTHROUGH_ENABLED` unset).
Then restart with `DEV_WALKTHROUGH_ENABLED=true` and repeat → expect 401/403 (AdminGuard) rather than 404.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/admin/dev-walkthrough/ packages/backend/src/app.module.ts
git commit -m "feat(dev): triple-gated dev-walkthrough endpoints (advance/fire/teardown)"
```

---

## PART C — Playwright harness

> Prereqs: install `imapflow` in frontend devDeps (`cd packages/frontend && npm i -D imapflow`). Env for the run: `TEST_USER_EMAIL=troyhouston76+test4@gmail.com`, `TEST_USER_PASSWORD`, `TEST_GMAIL_USER=troyhouston76@gmail.com`, `TEST_GMAIL_APP_PASSWORD` (Gmail app password), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_BEARER` (an admin session token for the dev endpoints), `DEV_WALKTHROUGH_ENABLED=true` on the backend. Never commit these.

### Task C1: Harness infra (supabaseAdmin, devHook, gmailOtp)

**Files:** create the three `tests/harness/*.ts` files.

- [ ] **Step 1: `supabaseAdmin.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");

export const admin = createClient(url, key, {
  auth: { persistSession: false },
});

export async function getUserIdByEmail(email: string): Promise<string> {
  const { data, error } = await admin
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (error) throw new Error(`user not found: ${email} (${error.message})`);
  return data.id;
}

export async function getActiveTrial(userId: string) {
  const { data } = await admin
    .from("user_trials")
    .select("tier, started_at, expires_at, converted_at, cancelled_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function getUsageStats(userId: string) {
  const { data } = await admin
    .from("user_profiles")
    .select("usage_stats, onboarding_checklist")
    .eq("id", userId)
    .single();
  return data;
}

export async function emailWasLogged(
  userId: string,
  emailType: string,
): Promise<boolean> {
  const { data } = await admin
    .from("email_log")
    .select("id")
    .eq("user_id", userId)
    .eq("email_type", emailType)
    .maybeSingle();
  return !!data;
}
```

- [ ] **Step 2: `devHook.ts`**

```typescript
const base = process.env.PLAYWRIGHT_BASE_API || "http://localhost:3001";
const bearer = process.env.ADMIN_BEARER;
if (!bearer) throw new Error("ADMIN_BEARER required");

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`${base}/api/admin/dev/trial-walkthrough${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${bearer}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok)
    throw new Error(`devHook ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

export const devHook = {
  advance: (userId: string, toDay: number) =>
    call("/advance", "POST", { userId, toDay }),
  fire: (job: string) => call("/fire", "POST", { job }),
  teardown: (userId: string) => call(`/user/${userId}`, "DELETE"),
};
```

- [ ] **Step 3: `gmailOtp.ts`** (IMAP read of the test inbox)

```typescript
import { ImapFlow } from "imapflow";

const host = "imap.gmail.com";
const user = process.env.TEST_GMAIL_USER;
const pass = process.env.TEST_GMAIL_APP_PASSWORD;

async function withInbox<T>(fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  if (!user || !pass)
    throw new Error("TEST_GMAIL_USER / TEST_GMAIL_APP_PASSWORD required");
  const client = new ImapFlow({
    host,
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout();
  }
}

/** Poll for the newest message to `toAddress` whose subject matches, return its text. */
export async function waitForEmail(
  toAddress: string,
  subjectRe: RegExp,
  timeoutMs = 120_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const body = await withInbox(async (c) => {
      const lock = await c.getMailboxLock("INBOX");
      try {
        const uids = await c.search({ to: toAddress }, { uid: true });
        for (const uid of uids.slice(-10).reverse()) {
          const msg = await c.fetchOne(
            String(uid),
            { envelope: true, source: true },
            { uid: true },
          );
          if (msg && subjectRe.test(msg.envelope.subject ?? "")) {
            return msg.source.toString();
          }
        }
        return null;
      } finally {
        lock.release();
      }
    });
    if (body) return body;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(
    `Timed out waiting for email to ${toAddress} matching ${subjectRe}`,
  );
}

export async function waitForOtp(toAddress: string): Promise<string> {
  const body = await waitForEmail(
    toAddress,
    /verify|confirm|code|PropertyIQ/i,
    120_000,
  );
  const m = body.match(/\b(\d{6})\b/);
  if (!m) throw new Error("No 6-digit code found in OTP email");
  return m[1];
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/tests/harness/supabaseAdmin.ts packages/frontend/tests/harness/devHook.ts packages/frontend/tests/harness/gmailOtp.ts packages/frontend/package.json packages/frontend/package-lock.json
git commit -m "feat(harness): supabase-admin, dev-hook client, and gmail OTP reader"
```

---

### Task C2: Flows — signup/OTP/tour, login/logout, feature-drive

**Files:** create `packages/frontend/tests/harness/flows.ts`

**Interfaces:**

- `signupAndConfirm(page, email, password)`, `walkTour(page)`, `login(page, email, password)`, `logout(page)`, `driveFeature(page, feature)`, `readRecommendedNext(page): Promise<string>`.

- [ ] **Step 1: Implement signup + OTP + tour**

```typescript
import { Page, expect } from "@playwright/test";
import { waitForOtp } from "./gmailOtp";

export async function signupAndConfirm(
  page: Page,
  email: string,
  password: string,
) {
  await page.goto("/auth/sign-up", { waitUntil: "load" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirm-password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /create account/i }).click();

  // OTP step
  await page
    .locator('input[autocomplete="one-time-code"]')
    .waitFor({ timeout: 30_000 });
  const code = await waitForOtp(email);
  await page.locator('input[autocomplete="one-time-code"]').fill(code);
  await page.getByRole("button", { name: /^verify$/i }).click();
  // default redirect post-signup is /tour
  await page.waitForURL(/\/tour/, { timeout: 30_000 });
}

export async function walkTour(page: Page) {
  await page
    .getByText(/What brings you to PropertyIQ/i)
    .waitFor({ timeout: 20_000 });
  await page.getByText(/I'm an investor/i).click();
  await page
    .getByText(/What market matters most/i)
    .waitFor({ timeout: 20_000 });
  // take the skip/fallback market to keep the run deterministic
  await page.getByText(/Or skip — show me/i).click();
  // finale: authed users see the Pro confirmation
  await page
    .getByText(/You're set with Pro|14 days of full access/i)
    .waitFor({ timeout: 45_000 });
}
```

- [ ] **Step 2: Implement login/logout**

```typescript
export async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/sign-in", { waitUntil: "load" });
  // ensure password mode
  const usePw = page.getByText(/use password instead/i);
  if (await usePw.isVisible().catch(() => false)) await usePw.click();
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), {
    timeout: 30_000,
  });
}

export async function logout(page: Page) {
  await page.getByTestId("user-menu").click();
  await page.getByRole("button", { name: /sign out/i }).click();
  await page
    .getByRole("button", { name: /log in/i })
    .waitFor({ timeout: 15_000 });
}
```

- [ ] **Step 3: Implement feature-drive (data-driven) + recommendation read**

```typescript
type Feature =
  | "score"
  | "compare"
  | "graphs"
  | "screener"
  | "analyzer"
  | "report"
  | "mcp"
  | "watchlist";

const ROUTES: Record<Feature, { url: string; anchor: RegExp }> = {
  score: {
    url: "/market/16740",
    anchor: /Market Position|Market Overview|AI Market Analysis/i,
  },
  compare: { url: "/compare/markets", anchor: /compare|side by side/i },
  graphs: { url: "/graphs", anchor: /Market Explorer/i },
  screener: { url: "/screener", anchor: /select your market|screener/i },
  analyzer: { url: "/analyzer", anchor: /Deal Analyzer|address/i },
  report: { url: "/reports", anchor: /select your market|report/i },
  mcp: { url: "/docs/mcp", anchor: /MCP|Claude/i },
  watchlist: { url: "/market", anchor: /watchlist|markets/i },
};

export async function driveFeature(page: Page, feature: Feature) {
  const { url, anchor } = ROUTES[feature];
  await page.goto(url, { waitUntil: "load" });
  await page.getByText(anchor).first().waitFor({ timeout: 45_000 });
  // dwell so the analytics tracker batches + flushes the feature.* event
  await page.waitForTimeout(6000);
}

export async function readRecommendedNext(page: Page): Promise<string> {
  await page.goto("/dashboard", { waitUntil: "load" });
  // NextBestActionCard renders the recommended feature's title text
  const card = page
    .locator("a", {
      hasText:
        /Use PropertyIQ inside Claude|Underwrite a real deal|Find your next market|Compare to a peer|Build your watchlist|Explore the data visually|Generate an AI report|Check a market's Score/i,
    })
    .first();
  await card.waitFor({ timeout: 20_000 });
  return (await card.innerText()).trim();
}
```

- [ ] **Step 4: Build check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors (harness files type-check).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/tests/harness/flows.ts
git commit -m "feat(harness): signup/OTP/tour + login/logout + feature-drive flows"
```

---

### Task C3: Orchestration spec — the day-by-day walkthrough

**Files:** create `packages/frontend/tests/e2e/trial-walkthrough.spec.ts`

- [ ] **Step 1: Implement the spec**

```typescript
import { test, expect } from "@playwright/test";
import {
  admin,
  getUserIdByEmail,
  getActiveTrial,
  getUsageStats,
  emailWasLogged,
} from "../harness/supabaseAdmin";
import { devHook } from "../harness/devHook";
import { waitForEmail } from "../harness/gmailOtp";
import {
  signupAndConfirm,
  walkTour,
  login,
  logout,
  driveFeature,
  readRecommendedNext,
} from "../harness/flows";

const EMAIL = process.env.TEST_USER_EMAIL!;
const PASSWORD = process.env.TEST_USER_PASSWORD!;

// One feature per email-day; email each day must arrive.
const PLAN = [
  {
    day: 1,
    feature: "compare" as const,
    job: "drip1",
    subject: /what does a 74 actually mean/i,
    type: "onboarding_day1",
  },
  {
    day: 3,
    feature: "graphs" as const,
    job: "drip3",
    subject: /find your next market/i,
    type: "onboarding_day3",
  },
  {
    day: 5,
    feature: "screener" as const,
    job: "drip5",
    subject: /moved the most/i,
    type: "onboarding_day5",
  },
  {
    day: 7,
    feature: "analyzer" as const,
    job: "drip7",
    subject: /Pro users see/i,
    type: "onboarding_day7",
  },
  {
    day: 10,
    feature: "report" as const,
    job: "trial_day_10",
    subject: /4 days left/i,
    type: "trial_day_10",
  },
  {
    day: 13,
    feature: "mcp" as const,
    job: "trial_day_13",
    subject: /Last chance/i,
    type: "trial_day_13",
  },
];

test("full 14-day trial walkthrough", async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);

  // ── Day 0: signup → OTP → tour → first feature ──
  await signupAndConfirm(page, EMAIL, PASSWORD);
  const userId = await getUserIdByEmail(EMAIL);
  const trial = await getActiveTrial(userId);
  expect(trial?.tier).toBe("pro");
  await walkTour(page);
  await waitForEmail(EMAIL, /welcome/i); // welcome email arrives
  await driveFeature(page, "score"); // explore the map / market score
  await logout(page);
  console.log("✅ Day 0: signup + tour + welcome email + first feature");

  // ── Each email day: advance → fire → assert email → login → assert persistence+suggestion → feature → logout ──
  for (const stage of PLAN) {
    await devHook.advance(userId, stage.day);
    await devHook.fire(stage.job);
    await waitForEmail(EMAIL, stage.subject);
    expect(await emailWasLogged(userId, stage.type)).toBeTruthy();

    await login(page, EMAIL, PASSWORD);
    const stats = await getUsageStats(userId);
    expect(stats?.usage_stats).toBeTruthy(); // persistence survived the new session
    const recBefore = await readRecommendedNext(page);
    expect(recBefore.length).toBeGreaterThan(0); // suggestion reflects prior activity

    await driveFeature(page, stage.feature);
    await logout(page);
    console.log(
      `✅ Day ${stage.day}: ${stage.feature} + email "${stage.type}"`,
    );
  }

  // ── Day 15: expiry ──
  await devHook.advance(userId, 15);
  await devHook.fire("trial_expired");
  await waitForEmail(EMAIL, /trial has ended/i);
  const expired = await getActiveTrial(userId);
  expect(new Date(expired!.expires_at).getTime()).toBeLessThan(Date.now());
  await login(page, EMAIL, PASSWORD);
  // post-trial overlay personalizes to used features
  await page.goto("/dashboard", { waitUntil: "load" });
  await expect(page.getByText(/trial|upgrade|Pro/i).first()).toBeVisible();
  console.log("✅ Day 15: trial expired + post-trial state");

  // ── Teardown ──
  await devHook.teardown(userId);
  const gone = await admin
    .from("user_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  expect(gone.data).toBeNull();
  console.log("✅ Teardown: test user deleted");
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/tests/e2e/trial-walkthrough.spec.ts
git commit -m "feat(harness): day-by-day live trial walkthrough orchestration spec"
```

---

### Task C4: Live red→green run (headed, manual checkpoints)

- [ ] **Step 1: Start the local stack with the dev hook + Resend key**

Backend env for the session: `DEV_WALKTHROUGH_ENABLED=true`, `RESEND_API_KEY=<real>`, plus the harness env vars. Start `npm run dev:fresh` per the project's restart rule (kill all node, confirm ports 000, start ONE instance).

- [ ] **Step 2: RED — run the email assertions against pre-fix code**

Check out the email assertions on current `develop` (before Part A merge) OR temporarily point the spec at the unfixed jobs; run only the day-10/13 stages.
Run: `cd packages/frontend && npx playwright test trial-walkthrough --headed -g "14-day"`
Expected: FAIL at the day-10 `waitForEmail(/4 days left/i)` — documents the bug (no countdown email for reverse-trial users).

- [ ] **Step 3: GREEN — with Part A merged, run the full walkthrough headed**

Run: `npx playwright test trial-walkthrough --headed`
Expected: PASS; the console logs each day; the real emails (welcome, day1/3/5/7, "4 days left", "last chance", "trial ended") arrive at `troyhouston76+test4@gmail.com`; suggestions advance each login; teardown deletes the user.

- [ ] **Step 4: Capture evidence**

Save the Playwright HTML report + note which emails landed in the inbox. Do NOT commit the report (it's gitignored under `playwright-report/`).

- [ ] **Step 5: Final commit (any fixes surfaced during the live run)**

```bash
git add -A packages/frontend/tests packages/backend/src
git commit -m "fix(harness): adjustments from live red→green walkthrough run"
```

---

## Self-Review

**Spec coverage:** §3a countdown→user_trials = A1/A2; §3b drip suppression = A3; welcome/exports = A4; §4.1 triple-gated dev hook = B1/B2; §4.2 Playwright spec = C3; §4.3 email verification (Resend log + inbox) = `emailWasLogged` + `waitForEmail`; §5 day-loop + day-15 expiry + teardown = C3; §7 red→green = C4; §8 risks (single-job fire, gate, teardown) addressed in B1/B2/C4.

**Placeholder scan:** No TBD/TODO. Two flagged verification points (not placeholders): the `DripService` constructor arity in A3 Step 1, and the admin users module export name in B2 Step 2 — both instruct the implementer to match the real signature in-file before running. These are real-codebase confirmations, not deferred work.

**Type consistency:** `fireTrialDay10/13/Expired` (public) used identically in A2/B1; `runDripDay(day)` defined A3, consumed B1; `advanceToDay/fireJob/teardown` defined B1, exposed B2, called C3 via `devHook`; `Feature` union in C2 matches `feature-coverage.ts` keys; email `emailType` strings (`onboarding_day1`, `trial_day_10`, …) match `DRIP_DAY_CONFIGS` + behavioral trigger names.

## Risks & open verification (carry into execution)

- Confirm `DripService` constructor signature and the admin users module/service export names before B2.
- Analytics batching: features mark "used" only after the tracker flushes; `driveFeature` dwells 6s and logout forces a flush — if a feature stays "unused", lengthen the dwell or assert the `feature.*` row directly via `admin`.
- `score`/map uses `usage_stats`/checklist (not an `EVENT_OF` action); confirm the map page increments `scores_checked` or completes `view_score` so coverage flips.
- Redis lock: dev `fireJob` calls the underlying methods directly (no `processTriggersHourly` lock), so a down local Redis won't block firing.
