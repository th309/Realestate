# Trial Churn Reason Survey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic day-14 win-back email with a cohort-aware "why did you leave" flow (zero-session / tried-once / engaged-then-quiet), capture the reason via one-click buttons, and surface it on the Trial Settings admin page — fixing that page's underlying data bugs along the way.

**Architecture:** A new `drip-churn-why.helper.ts` runs three cohort checks under one cron (replacing `drip-winback.helper.ts`), sending a shared `ChurnWhyAsk` email template parameterized per cohort. Responses land in a new `churn_survey_responses` table via a signed-token endpoint (mirrors the existing NPS survey pattern). `TrialService` is fixed to actually join user identity, real paywall-hit counts, and the new churn reason onto each trial row; the admin page is split into focused components and its stats/table now render real data.

**Tech Stack:** NestJS backend (Supabase via `@supabase/supabase-js`), Next.js App Router frontend, `@react-email/components` templates in the `packages/emails` workspace package, Jest (backend unit tests).

## Global Constraints

- File size: logic files (hooks/utils) target <200 lines, hard limit 300; React components target <300 lines, hard limit 400 — split at the limit (CLAUDE.md §1.3).
- One exported component per file; 2+ exports in one file must split regardless of line count (CLAUDE.md §1.3).
- Every name must be descriptive and self-explanatory (CLAUDE.md §1.4).
- Never hardcode fallback values for secrets/config — throw if a required value is missing (CLAUDE.md §1.2).
- Never fabricate data to fill a UI field — if there's no real source, don't display it as if there were (project convention confirmed via `getPaywallCountsForUsers` investigation this session).
- No `Co-Authored-By` in commits (user preference).
- Verify every task live (build/test, and for the frontend page, actually load it in a browser) before calling it done — this codebase's standing instruction is "no mock UI verification."

---

### Task 1: Migration — `churn_survey_responses` table

**Files:**

- Create: `supabase/migrations/20260719120000_create_churn_survey_responses.sql`

**Interfaces:**

- Produces: table `churn_survey_responses(id uuid, user_id uuid, cohort text, email_type text, reason_code text, detail text, created_at timestamptz)`, unique on `(user_id, email_type)`.

- [ ] **Step 1: Write the migration**

```sql
-- Churn reason responses: captures the "why did you leave" signal from the
-- cohort-aware churn-why email drip (zero_session / tried_once / engaged_quiet).
-- Written server-side via a signed-token endpoint (POST /api/surveys/churn) —
-- users never query this table directly, matching the user_surveys pattern.

CREATE TABLE IF NOT EXISTS churn_survey_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cohort       TEXT NOT NULL CHECK (cohort IN ('zero_session', 'tried_once', 'engaged_quiet')),
  email_type   TEXT NOT NULL,
  reason_code  TEXT NOT NULL,
  detail       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One response per user per email variant (matches user_surveys' upsert pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_churn_survey_responses_user_email_type
  ON churn_survey_responses (user_id, email_type);

CREATE INDEX IF NOT EXISTS idx_churn_survey_responses_user
  ON churn_survey_responses (user_id);

ALTER TABLE churn_survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS churn_survey_responses_service_role ON churn_survey_responses;
CREATE POLICY churn_survey_responses_service_role ON churn_survey_responses
  FOR ALL USING (auth.role() = 'service_role');

-- GRANT required for new Supabase API keys (sb_secret_ / sb_publishable_) —
-- without it, even service_role JWTs hit permission-denied.
GRANT ALL ON churn_survey_responses TO service_role;
```

- [ ] **Step 2: Apply the migration to the project's Supabase instance**

Use the `mcp__supabase-db__apply_migration` tool (project_id `pysflbhpnqwoczyuaaif`) with name `create_churn_survey_responses` and the SQL above, or `supabase db push` if working via the CLI against a linked local/dev project.

- [ ] **Step 3: Verify the table exists**

Run (via the Supabase SQL tool): `select column_name, data_type from information_schema.columns where table_name = 'churn_survey_responses' order by ordinal_position;`
Expected: 7 rows — `id, user_id, cohort, email_type, reason_code, detail, created_at`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260719120000_create_churn_survey_responses.sql
git commit -m "feat(db): add churn_survey_responses table"
```

---

### Task 2: Pure cohort-eligibility rules

**Files:**

- Create: `packages/backend/src/email/churn-cohort-rules.ts`
- Test: `packages/backend/src/email/churn-cohort-rules.spec.ts`

**Interfaces:**

- Produces: `isZeroSessionEligible(sessionCount: number): boolean`, `isTriedOnceEligible(sessionCount: number): boolean`, `isEngagedThenQuietEligible(sessionCount: number): boolean` — pure functions, no I/O. Consumed by Task 8 (`drip-churn-why.helper.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/email/churn-cohort-rules.spec.ts
import {
  isZeroSessionEligible,
  isTriedOnceEligible,
  isEngagedThenQuietEligible,
} from "./churn-cohort-rules";

describe("churn cohort eligibility rules", () => {
  it("zero-session: eligible at 0 or 1 sessions, not at 2+", () => {
    expect(isZeroSessionEligible(0)).toBe(true);
    expect(isZeroSessionEligible(1)).toBe(true);
    expect(isZeroSessionEligible(2)).toBe(false);
  });

  it("tried-once: eligible only at exactly 2 sessions", () => {
    expect(isTriedOnceEligible(1)).toBe(false);
    expect(isTriedOnceEligible(2)).toBe(true);
    expect(isTriedOnceEligible(3)).toBe(false);
  });

  it("engaged-then-quiet: eligible at 3+ sessions", () => {
    expect(isEngagedThenQuietEligible(2)).toBe(false);
    expect(isEngagedThenQuietEligible(3)).toBe(true);
    expect(isEngagedThenQuietEligible(10)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/backend`): `npm test -- churn-cohort-rules.spec.ts`
Expected: FAIL with "Cannot find module './churn-cohort-rules'"

- [ ] **Step 3: Write the implementation**

```typescript
// packages/backend/src/email/churn-cohort-rules.ts

/** ≤1 lifetime session — never really returned after signup. */
export function isZeroSessionEligible(sessionCount: number): boolean {
  return sessionCount <= 1;
}

/** Exactly 2 lifetime sessions — came back once, then stopped. */
export function isTriedOnceEligible(sessionCount: number): boolean {
  return sessionCount === 2;
}

/** 3+ sessions — was genuinely using it before going quiet. */
export function isEngagedThenQuietEligible(sessionCount: number): boolean {
  return sessionCount >= 3;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- churn-cohort-rules.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/email/churn-cohort-rules.ts packages/backend/src/email/churn-cohort-rules.spec.ts
git commit -m "test(email): add pure churn-cohort eligibility rules"
```

---

### Task 3: Shared session-count helper

**Files:**

- Create: `packages/backend/src/common/user-sessions-count.util.ts`

**Interfaces:**

- Produces: `getSessionCountsForUsers(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, number>>` — counts rows in `user_sessions` per `user_id`. Consumed by Task 8 (`drip-churn-why.helper.ts`) and Task 12 (`trial.service.ts`).

- [ ] **Step 1: Write the implementation** (no meaningful pure logic to unit test in isolation — this is a thin, single-purpose Supabase query identical in shape to the existing `getPaywallCountsForUsers` in `users-batch-fetch.helper.ts`; correctness is verified by the E2E pass in Task 14)

```typescript
// packages/backend/src/common/user-sessions-count.util.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/** Lifetime session count per user_id, from user_sessions. */
export async function getSessionCountsForUsers(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const { data } = await supabase
    .from("user_sessions")
    .select("user_id")
    .in("user_id", userIds)
    .not("user_id", "is", null);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }
  return counts;
}
```

- [ ] **Step 2: Typecheck**

Run (from `packages/backend`): `npx tsc --noEmit`
Expected: no new errors referencing `user-sessions-count.util.ts`

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/common/user-sessions-count.util.ts
git commit -m "feat(backend): add shared per-user session count helper"
```

---

### Task 4: Email copy — reason labels and per-cohort content

**Files:**

- Modify: `packages/emails/copy/email-copy.ts`

**Interfaces:**

- Produces: `CHURN_REASON_LABELS: Record<string, string>`, `ChurnWhyCopy` type, `CHURN_WHY_ZERO_SESSION`, `CHURN_WHY_TRIED_ONCE`, `CHURN_WHY_ENGAGED_QUIET` (each a `ChurnWhyCopy`). Consumed by Task 5 (template), Task 8 (drip helper), Task 12 (`trial.service.ts`, for `reason_label`).

- [ ] **Step 1: Add the copy blocks**

Append to `packages/emails/copy/email-copy.ts` (after the existing `WINBACK_DAY14` block):

```typescript
/** Canonical reason_code → human label. Shared by the email template, the
 * churn-why drip, and the admin Trial Settings page (via TrialService). */
export const CHURN_REASON_LABELS: Record<string, string> = {
  busy: "Got busy",
  unsure: "Wasn't sure what to do next",
  curious: "Just curious, not actively looking",
  missing_market: "Couldn't find my market",
  not_found: "Didn't find what I needed",
  confusing: "Confusing or unclear",
  too_expensive: "Too expensive",
  got_what_needed: "Found what I needed, done for now",
  switched_tools: "Switched to another tool",
  not_enough_new: "Not enough new information to keep checking",
  other: "Other",
};

export interface ChurnWhyCopy {
  heading: string;
  preview: string;
  greeting: (name: string) => string;
  body: string;
  reasonCodes: string[];
}

export const CHURN_WHY_ZERO_SESSION: ChurnWhyCopy = {
  heading: "Quick question — what happened?",
  preview: "One click, no hard feelings",
  greeting: (name: string) => `Hey ${name},`,
  body: "You signed up for PropertyIQ but I don't think you've been back yet. No hard feelings — I'd love to know why. One click:",
  reasonCodes: ["busy", "unsure", "curious", "missing_market", "other"],
};

export const CHURN_WHY_TRIED_ONCE: ChurnWhyCopy = {
  heading: "Quick question — what happened?",
  preview: "One click, no hard feelings",
  greeting: (name: string) => `Hey ${name},`,
  body: "You checked out PropertyIQ once but haven't been back since. Mind sharing why? One click:",
  reasonCodes: [
    "not_found",
    "confusing",
    "too_expensive",
    "missing_market",
    "other",
  ],
};

export const CHURN_WHY_ENGAGED_QUIET: ChurnWhyCopy = {
  heading: "Quick question — what happened?",
  preview: "One click, no hard feelings",
  greeting: (name: string) => `Hey ${name},`,
  body: "You were checking PropertyIQ regularly, then stopped. I'd love to know why. One click:",
  reasonCodes: [
    "got_what_needed",
    "switched_tools",
    "not_enough_new",
    "busy",
    "other",
  ],
};
```

- [ ] **Step 2: Typecheck**

Run (from `packages/emails`): `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/emails/copy/email-copy.ts
git commit -m "feat(emails): add churn-why reason labels and per-cohort copy"
```

---

### Task 5: `ChurnWhyAsk` email template

**Files:**

- Create: `packages/emails/emails/churn-why-ask.tsx`
- Modify: `packages/emails/index.ts`

**Interfaces:**

- Consumes: `ChurnWhyCopy`, `CHURN_REASON_LABELS`, `CHURN_WHY_ZERO_SESSION` from Task 4.
- Produces: default-exported `ChurnWhyAsk` component with `ChurnWhyAskProps = { name: string; copy: ChurnWhyCopy; whyDidYouLeaveUrl: string; token: string; unsubscribeUrl?: string }`, re-exported from `@propertyiq/emails`. Consumed by Task 8.

- [ ] **Step 1: Write the template**

```tsx
// packages/emails/emails/churn-why-ask.tsx
import { Text, Section, Row, Column } from "@react-email/components";
import Layout from "./components/layout";
import EmailHeading from "./components/email-heading";
import {
  CHURN_REASON_LABELS,
  CHURN_WHY_ZERO_SESSION,
  type ChurnWhyCopy,
} from "../copy/email-copy";

export interface ChurnWhyAskProps {
  name: string;
  copy: ChurnWhyCopy;
  whyDidYouLeaveUrl: string;
  token: string;
  unsubscribeUrl?: string;
}

export default function ChurnWhyAsk({
  name,
  copy,
  whyDidYouLeaveUrl,
  token,
  unsubscribeUrl,
}: ChurnWhyAskProps) {
  return (
    <Layout preview={copy.preview} unsubscribeUrl={unsubscribeUrl}>
      <EmailHeading>{copy.heading}</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        {copy.greeting(name)}
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-5">
        {copy.body}
      </Text>
      <Section className="mb-2">
        <Row>
          {copy.reasonCodes.map((code) => (
            <Column key={code} className="pb-2 pr-2">
              <a
                href={`${whyDidYouLeaveUrl}?token=${token}&reason=${code}`}
                className="inline-block bg-brand-light text-brand text-sm font-medium px-4 py-2 rounded-full no-underline"
                style={{ textDecoration: "none" }}
              >
                {CHURN_REASON_LABELS[code]}
              </a>
            </Column>
          ))}
        </Row>
      </Section>
    </Layout>
  );
}

ChurnWhyAsk.PreviewProps = {
  name: "Troy",
  copy: CHURN_WHY_ZERO_SESSION,
  whyDidYouLeaveUrl: "https://propertyiq.app/why-did-you-leave",
  token: "preview-token",
} satisfies ChurnWhyAskProps;
```

- [ ] **Step 2: Export it from the package barrel**

In `packages/emails/index.ts`, add alongside the other template exports:

```typescript
export { default as ChurnWhyAsk } from "./emails/churn-why-ask";
```

And alongside the type exports:

```typescript
export type { ChurnWhyAskProps } from "./emails/churn-why-ask";
```

And alongside the copy exports (extend the existing copy export line rather than duplicating it):

```typescript
export {
  SCORE_DESCRIPTION,
  SCORES_ACCURACY_PATH,
  CHURN_REASON_LABELS,
  CHURN_WHY_ZERO_SESSION,
  CHURN_WHY_TRIED_ONCE,
  CHURN_WHY_ENGAGED_QUIET,
} from "./copy/email-copy";
export type { ChurnWhyCopy } from "./copy/email-copy";
```

- [ ] **Step 3: Preview it renders**

Run (from `packages/emails`, if the package has a react-email dev script — check `package.json`; otherwise typecheck is sufficient signal): `npx tsc --noEmit`
Expected: no errors. If a preview server script exists (e.g. `npm run dev` / `email dev`), load `ChurnWhyAsk` in it and visually confirm the reason buttons render with the zero-session copy (5 pill buttons: Got busy / Wasn't sure what to do next / Just curious, not actively looking / Couldn't find my market / Other).

- [ ] **Step 4: Commit**

```bash
git add packages/emails/emails/churn-why-ask.tsx packages/emails/index.ts
git commit -m "feat(emails): add ChurnWhyAsk template"
```

---

### Task 6: Churn survey submission endpoint

**Files:**

- Modify: `packages/backend/src/surveys/surveys.service.ts`
- Modify: `packages/backend/src/surveys/surveys.controller.ts`
- Test: `packages/backend/src/surveys/surveys.service.spec.ts`

**Interfaces:**

- Consumes: `verifyNpsToken` from `./nps-token.util` (existing, reused as-is — it's already generic over `surveyType`).
- Produces: `SurveysService.submitChurnSurvey(dto: SubmitChurnSurveyDto): Promise<{ok: boolean; error?: string}>`, route `POST /api/surveys/churn`. Consumed by Task 7 (frontend landing page).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/surveys/surveys.service.spec.ts
import { SurveysService } from "./surveys.service";
import * as npsToken from "./nps-token.util";

describe("SurveysService.submitChurnSurvey", () => {
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn().mockReturnValue({ upsert });
  const supabase = { from } as any;
  const config = {
    get: jest.fn().mockReturnValue("test-secret"),
  } as any;

  beforeEach(() => {
    upsert.mockClear();
    from.mockClear();
  });

  it("rejects an invalid token", async () => {
    jest.spyOn(npsToken, "verifyNpsToken").mockReturnValueOnce(null);
    const service = new SurveysService(supabase, config);

    const result = await service.submitChurnSurvey({
      token: "bad-token",
      reasonCode: "busy",
    });

    expect(result.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a missing reasonCode", async () => {
    jest.spyOn(npsToken, "verifyNpsToken").mockReturnValueOnce({
      userId: "user-1",
      surveyType: "churn_why_zero_session",
      exp: Date.now() + 10000,
    });
    const service = new SurveysService(supabase, config);

    const result = await service.submitChurnSurvey({
      token: "good-token",
      reasonCode: "",
    });

    expect(result.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("upserts a valid response, deriving cohort from the token surveyType", async () => {
    jest.spyOn(npsToken, "verifyNpsToken").mockReturnValueOnce({
      userId: "user-1",
      surveyType: "churn_why_tried_once",
      exp: Date.now() + 10000,
    });
    const service = new SurveysService(supabase, config);

    const result = await service.submitChurnSurvey({
      token: "good-token",
      reasonCode: "too_expensive",
      detail: "pricing was unclear",
    });

    expect(result.ok).toBe(true);
    expect(from).toHaveBeenCalledWith("churn_survey_responses");
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        cohort: "tried_once",
        email_type: "churn_why_tried_once",
        reason_code: "too_expensive",
        detail: "pricing was unclear",
      },
      { onConflict: "user_id,email_type" },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/backend`): `npm test -- surveys.service.spec.ts`
Expected: FAIL — `submitChurnSurvey` is not a function

- [ ] **Step 3: Implement `submitChurnSurvey`**

Add to `packages/backend/src/surveys/surveys.service.ts` (alongside the existing `submitNpsSurvey`):

```typescript
const EMAIL_TYPE_TO_COHORT: Record<string, string> = {
  churn_why_zero_session: "zero_session",
  churn_why_tried_once: "tried_once",
  churn_why_engaged_quiet: "engaged_quiet",
};

export interface SubmitChurnSurveyDto {
  token: string;
  reasonCode: string;
  detail?: string;
}
```

(place this above the `SurveysService` class, next to `SubmitSurveyDto`)

```typescript
  async submitChurnSurvey(
    dto: SubmitChurnSurveyDto,
  ): Promise<{ ok: boolean; error?: string }> {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      this.logger.error('JWT_SECRET not configured');
      return { ok: false, error: 'Server misconfiguration' };
    }

    const payload = verifyNpsToken(dto.token, secret);
    if (!payload) {
      return { ok: false, error: 'Invalid or expired survey token' };
    }

    if (!dto.reasonCode || typeof dto.reasonCode !== 'string') {
      return { ok: false, error: 'reasonCode is required' };
    }

    const cohort = EMAIL_TYPE_TO_COHORT[payload.surveyType];
    if (!cohort) {
      return { ok: false, error: 'Unrecognized survey type' };
    }

    const { error } = await this.supabase.from('churn_survey_responses').upsert(
      {
        user_id: payload.userId,
        cohort,
        email_type: payload.surveyType,
        reason_code: dto.reasonCode,
        detail: dto.detail ?? null,
      },
      { onConflict: 'user_id,email_type' },
    );

    if (error) {
      this.logger.error(
        `Failed to save churn survey response: ${error.message}`,
      );
      return { ok: false, error: 'Failed to save response' };
    }

    return { ok: true };
  }
```

(add this method inside the `SurveysService` class, after `submitNpsSurvey`)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- surveys.service.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Add the controller route**

In `packages/backend/src/surveys/surveys.controller.ts`, add alongside `SubmitNpsSurveyBody`:

```typescript
class SubmitChurnSurveyBody {
  token!: string;
  reasonCode!: string;
  detail?: string;
}
```

And add this method inside `SurveysController`, after `submitSurvey`:

```typescript
  /**
   * POST /api/surveys/churn
   *
   * Records a churn-why survey response. No session auth required — the
   * `token` in the body is a signed short-lived token from the churn-why
   * email link, same pattern as the NPS endpoint above.
   */
  @Post('churn')
  @HttpCode(HttpStatus.OK)
  async submitChurnSurvey(@Body() body: SubmitChurnSurveyBody) {
    if (!body.token || !body.reasonCode) {
      throw new BadRequestException('token and reasonCode are required');
    }

    const result = await this.surveysService.submitChurnSurvey({
      token: body.token,
      reasonCode: body.reasonCode,
      detail: body.detail,
    });

    if (!result.ok) {
      throw new BadRequestException(result.error);
    }

    return { success: true };
  }
```

- [ ] **Step 6: Build check**

Run (from `packages/backend`): `npm run build`
Expected: no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/surveys/surveys.service.ts packages/backend/src/surveys/surveys.controller.ts packages/backend/src/surveys/surveys.service.spec.ts
git commit -m "feat(surveys): add churn-why survey submission endpoint"
```

---

### Task 7: `/why-did-you-leave` landing page

**Files:**

- Create: `packages/frontend/app/(app)/why-did-you-leave/page.tsx`

**Interfaces:**

- Consumes: `POST /api/surveys/churn` from Task 6 (`{token, reasonCode, detail?}` → `{success: true}` or a 4xx with `{message}`).

- [ ] **Step 1: Write the page**

Mirror the existing `packages/frontend/app/(app)/survey/page.tsx` pattern exactly (pre-select from URL, no auto-submit, `Suspense` wrapper for `useSearchParams`):

```tsx
"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
// Same-origin in the browser (→ `/backend`) so ad blockers don't block it.
import { API_URL } from "@/lib/data";

const REASON_LABELS: Record<string, string> = {
  busy: "Got busy",
  unsure: "Wasn't sure what to do next",
  curious: "Just curious, not actively looking",
  missing_market: "Couldn't find my market",
  not_found: "Didn't find what I needed",
  confusing: "Confusing or unclear",
  too_expensive: "Too expensive",
  got_what_needed: "Found what I needed, done for now",
  switched_tools: "Switched to another tool",
  not_enough_new: "Not enough new information to keep checking",
  other: "Other",
};
const REASON_CODES = Object.keys(REASON_LABELS);

function WhyDidYouLeaveContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const preselectedReason = searchParams.get("reason");

  const [reasonCode, setReasonCode] = useState<string | null>(
    preselectedReason && REASON_LABELS[preselectedReason]
      ? preselectedReason
      : null,
  );
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  if (!token) {
    return (
      <div className="text-center py-16">
        <p className="text-on-surface-variant">
          Invalid link. Please use the link from your email.
        </p>
      </div>
    );
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!reasonCode) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`${API_URL}/api/surveys/churn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          reasonCode,
          detail: detail || undefined,
        }),
      });
      if (res.ok) {
        setStatus("done");
      } else {
        const data = (await res.json()) as { message?: string };
        setErrorMsg(data.message ?? "Something went wrong.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="text-center py-16 max-w-md mx-auto">
        <div className="text-5xl mb-4">🙏</div>
        <h1 className="text-2xl font-bold text-on-surface mb-3">
          Thanks for letting us know
        </h1>
        <p className="text-on-surface-variant">
          Your feedback helps us build a better product.
        </p>
        <a
          href="/"
          className="inline-block mt-8 px-6 py-3 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          Back to PropertyIQ
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-on-surface mb-2 text-center">
        What happened?
      </h1>
      <p className="text-on-surface-variant text-center mb-8 text-sm">
        No hard feelings — pick the closest reason, add detail if you'd like.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-wrap gap-2 justify-center">
          {REASON_CODES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setReasonCode(code)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                reasonCode === code
                  ? "bg-primary text-on-primary ring-2 ring-offset-2 ring-primary"
                  : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
              }`}
            >
              {REASON_LABELS[code]}
            </button>
          ))}
        </div>

        {reasonCode && (
          <div>
            <label
              htmlFor="churn-detail"
              className="block text-sm font-medium text-on-surface mb-1"
            >
              Anything else?{" "}
              <span className="text-on-surface-variant font-normal">
                (optional)
              </span>
            </label>
            <textarea
              id="churn-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              placeholder="Tell us more..."
              className="w-full px-4 py-3 rounded-xl bg-surface border border-outline text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        )}

        {status === "error" && (
          <p className="text-error text-sm text-center">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={!reasonCode || status === "loading"}
          className="w-full px-6 py-3 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {status === "loading" ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}

export default function WhyDidYouLeavePage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-16 text-on-surface-variant">
          Loading...
        </div>
      }
    >
      <WhyDidYouLeaveContent />
    </Suspense>
  );
}
```

Note: the reason labels are intentionally duplicated (not imported from `@propertyiq/emails`) — this page runs in the Next.js frontend bundle, `@propertyiq/emails` is a backend/email-rendering dependency, and 11 short label strings aren't worth a new shared package boundary. If the list changes, update both `email-copy.ts` (Task 4) and this file.

- [ ] **Step 2: Typecheck**

Run (from `packages/frontend`): `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Verify live in browser**

Start the dev servers (or use the already-running local stack). Visit `http://localhost:3000/why-did-you-leave?token=invalid&reason=busy` — confirm "Got busy" is pre-highlighted, submitting shows an error (invalid token), and the page never auto-submits on load (check the Network tab: no POST fires until you click Submit).

- [ ] **Step 4: Commit**

```bash
git add "packages/frontend/app/(app)/why-did-you-leave/page.tsx"
git commit -m "feat(frontend): add why-did-you-leave churn survey landing page"
```

---

### Task 8: `drip-churn-why.helper.ts` — the three cohort checks

**Files:**

- Create: `packages/backend/src/email/drip-churn-why.helper.ts`

**Interfaces:**

- Consumes: `isZeroSessionEligible`/`isTriedOnceEligible`/`isEngagedThenQuietEligible` (Task 2), `getSessionCountsForUsers` (Task 3), `CHURN_WHY_ZERO_SESSION`/`CHURN_WHY_TRIED_ONCE`/`CHURN_WHY_ENGAGED_QUIET`/`ChurnWhyAsk`/`ChurnWhyCopy` (Tasks 4-5), `getDayBoundariesUTC`, `getAlreadySentUserIds`, `getMarketingOptOutIds`, `buildUnsubscribe`, `signNpsToken` (all existing), `DripDeps` (existing, from `./drip.types`).
- Produces: `runChurnWhyDrip(deps: DripDeps): Promise<void>` (cron entry, consumed by Task 9), `runChurnWhyCohort(deps: DripDeps, emailType: string, onlyUserId?: string): Promise<{sent: number; skipped: number; failed: number}>` (dev/test entry, consumed by Task 10).

- [ ] **Step 1: Write the implementation**

```typescript
// packages/backend/src/email/drip-churn-why.helper.ts
import React from "react";
import {
  ChurnWhyAsk,
  CHURN_WHY_ZERO_SESSION,
  CHURN_WHY_TRIED_ONCE,
  CHURN_WHY_ENGAGED_QUIET,
  type ChurnWhyCopy,
} from "@propertyiq/emails";
import { signNpsToken } from "../surveys/nps-token.util";
import { buildUnsubscribe } from "./unsubscribe-link.util";
import { getDayBoundariesUTC } from "./drip-date.helper";
import {
  getAlreadySentUserIds,
  getMarketingOptOutIds,
} from "./drip-suppression.helper";
import { getSessionCountsForUsers } from "../common/user-sessions-count.util";
import {
  isZeroSessionEligible,
  isTriedOnceEligible,
  isEngagedThenQuietEligible,
} from "./churn-cohort-rules";
import type { DripDeps } from "./drip.types";

type EmailUser = { id: string; email: string | null };
type DripResult = { sent: number; skipped: number; failed: number };

const EMAIL_TYPES = {
  zero_session: "churn_why_zero_session",
  tried_once: "churn_why_tried_once",
  engaged_quiet: "churn_why_engaged_quiet",
} as const;

/** Cron body: all three churn-why cohorts, replacing the old win-back email. */
export async function runChurnWhyDrip(deps: DripDeps): Promise<void> {
  const locked = await deps.redis.acquireLock("cron:churn-why-drip", 300);
  if (!locked) {
    deps.logger.log("Another instance is processing churn-why drip, skipping");
    return;
  }

  try {
    deps.logger.log("Starting churn-why drip processing...");

    const results = await Promise.all([
      runChurnWhyCohort(deps, EMAIL_TYPES.zero_session),
      runChurnWhyCohort(deps, EMAIL_TYPES.tried_once),
      runChurnWhyCohort(deps, EMAIL_TYPES.engaged_quiet),
    ]);

    const totals = results.reduce(
      (acc, r) => ({
        sent: acc.sent + r.sent,
        skipped: acc.skipped + r.skipped,
        failed: acc.failed + r.failed,
      }),
      { sent: 0, skipped: 0, failed: 0 },
    );

    deps.logger.log(
      `Churn-why drip complete. Sent: ${totals.sent}, Skipped: ${totals.skipped}, Failed: ${totals.failed}`,
    );
  } finally {
    await deps.redis.releaseLock("cron:churn-why-drip");
  }
}

/** Dev/test entry: run one cohort by its email_type, optionally scoped to one user. */
export async function runChurnWhyCohort(
  deps: DripDeps,
  emailType: string,
  onlyUserId?: string,
): Promise<DripResult> {
  if (emailType === EMAIL_TYPES.zero_session) {
    return runSnapshotCohort(deps, {
      day: 4,
      emailType: EMAIL_TYPES.zero_session,
      copy: CHURN_WHY_ZERO_SESSION,
      isEligible: isZeroSessionEligible,
      onlyUserId,
    });
  }
  if (emailType === EMAIL_TYPES.tried_once) {
    return runSnapshotCohort(deps, {
      day: 7,
      emailType: EMAIL_TYPES.tried_once,
      copy: CHURN_WHY_TRIED_ONCE,
      isEligible: isTriedOnceEligible,
      onlyUserId,
    });
  }
  if (emailType === EMAIL_TYPES.engaged_quiet) {
    return runEngagedQuietCohort(deps, onlyUserId);
  }
  throw new Error(`Unknown churn-why cohort email type: ${emailType}`);
}

/** Zero-session and tried-once: a day-since-signup snapshot, same pattern as
 * the onboarding drip's getDayBoundariesUTC(day) — not a rolling window. */
async function runSnapshotCohort(
  deps: DripDeps,
  config: {
    day: number;
    emailType: string;
    copy: ChurnWhyCopy;
    isEligible: (sessionCount: number) => boolean;
    onlyUserId?: string;
  },
): Promise<DripResult> {
  const { startOfDay, endOfDay } = getDayBoundariesUTC(config.day);

  let query = deps.supabase
    .from("user_profiles")
    .select("id, email")
    .gte("created_at", startOfDay)
    .lt("created_at", endOfDay);
  if (config.onlyUserId) query = query.eq("id", config.onlyUserId);

  const { data: candidates, error } = await query;
  if (error) {
    deps.logger.error(
      `Churn-why (${config.emailType}): candidate query failed: ${error.message}`,
    );
    return { sent: 0, skipped: 0, failed: 0 };
  }
  if (!candidates?.length) return { sent: 0, skipped: 0, failed: 0 };

  const userIds = candidates.map((u) => u.id);
  const sessionCounts = await getSessionCountsForUsers(deps.supabase, userIds);
  const eligible = candidates.filter((u) =>
    config.isEligible(sessionCounts.get(u.id) ?? 0),
  );
  if (!eligible.length) return { sent: 0, skipped: 0, failed: 0 };

  return sendChurnWhyEmails(deps, eligible, config.emailType, config.copy);
}

/** Engaged-then-quiet: 3+ sessions in a specific day 14-15 days ago (the same
 * rolling-dormancy query the old win-back email used), then silent since. */
async function runEngagedQuietCohort(
  deps: DripDeps,
  onlyUserId?: string,
): Promise<DripResult> {
  const churnCutoffStart = new Date(
    Date.now() - 15 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const churnCutoffEnd = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000,
  ).toISOString();

  let sessionQuery = deps.supabase
    .from("user_sessions")
    .select("user_id, last_activity_at")
    .not("user_id", "is", null)
    .gte("last_activity_at", churnCutoffStart)
    .lt("last_activity_at", churnCutoffEnd);
  if (onlyUserId) sessionQuery = sessionQuery.eq("user_id", onlyUserId);

  const { data: sessions, error } = await sessionQuery;
  if (error) {
    deps.logger.error(
      `Churn-why (engaged_quiet): session query failed: ${error.message}`,
    );
    return { sent: 0, skipped: 0, failed: 0 };
  }
  if (!sessions?.length) return { sent: 0, skipped: 0, failed: 0 };

  const sessionCountByUser = new Map<string, number>();
  for (const row of sessions) {
    sessionCountByUser.set(
      row.user_id,
      (sessionCountByUser.get(row.user_id) ?? 0) + 1,
    );
  }

  const eligibleUserIds = Array.from(sessionCountByUser.entries())
    .filter(([, count]) => isEngagedThenQuietEligible(count))
    .map(([userId]) => userId);
  if (!eligibleUserIds.length) return { sent: 0, skipped: 0, failed: 0 };

  const { data: profiles } = await deps.supabase
    .from("user_profiles")
    .select("id, email")
    .in("id", eligibleUserIds);
  if (!profiles?.length) return { sent: 0, skipped: 0, failed: 0 };

  return sendChurnWhyEmails(
    deps,
    profiles,
    EMAIL_TYPES.engaged_quiet,
    CHURN_WHY_ENGAGED_QUIET,
  );
}

/** Shared send loop: suppression, token, template, EmailService — used by all
 * three cohorts so the send/skip/fail accounting stays in one place. */
async function sendChurnWhyEmails(
  deps: DripDeps,
  users: EmailUser[],
  emailType: string,
  copy: ChurnWhyCopy,
): Promise<DripResult> {
  const userIds = users.map((u) => u.id);
  const alreadySentIds = await getAlreadySentUserIds(
    deps.supabase,
    userIds,
    emailType,
  );
  const optedOutIds = await getMarketingOptOutIds(deps.supabase, userIds);

  const jwtSecret = deps.config.get<string>("JWT_SECRET");
  if (!jwtSecret) {
    deps.logger.error(`Churn-why (${emailType}): JWT_SECRET not configured`);
    return { sent: 0, skipped: 0, failed: users.length };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    if (
      !user.email ||
      alreadySentIds.has(user.id) ||
      optedOutIds.has(user.id)
    ) {
      skipped++;
      continue;
    }

    try {
      const displayName = user.email.split("@")[0];
      const token = signNpsToken(user.id, emailType, jwtSecret);
      const unsub = buildUnsubscribe(deps.config, user.id);
      const react = React.createElement(ChurnWhyAsk, {
        name: displayName,
        copy,
        whyDidYouLeaveUrl: `${deps.appUrl}/why-did-you-leave`,
        token,
        unsubscribeUrl: unsub?.url ?? `${deps.appUrl}/account/notifications`,
      });

      const success = await deps.emailService.sendEmail({
        to: user.email,
        subject: copy.heading,
        react,
        userId: user.id,
        emailType,
        replyTo: deps.replyTo,
        headers: unsub?.headers,
      });

      if (success) sent++;
      else failed++;
    } catch (err) {
      deps.logger.error(`Churn-why (${emailType}) failed for ${user.id}:`, err);
      failed++;
    }
  }

  return { sent, skipped, failed };
}
```

- [ ] **Step 2: Build check**

Run (from `packages/backend`): `npm run build`
Expected: no TypeScript errors (confirms the `@propertyiq/emails` exports from Task 5 resolve correctly)

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/email/drip-churn-why.helper.ts
git commit -m "feat(email): add cohort-aware churn-why drip helper"
```

---

### Task 9: Wire the cron, retire the win-back email

**Files:**

- Modify: `packages/backend/src/email/drip.service.ts`
- Delete: `packages/backend/src/email/drip-winback.helper.ts`

**Interfaces:**

- Consumes: `runChurnWhyDrip`, `runChurnWhyCohort` (Task 8).
- Produces: `DripService.runChurnWhyCohort(emailType: string, onlyUserId?: string)` (dev entry, consumed by Task 10), cron `processChurnWhyDrip`.

- [ ] **Step 1: Update `drip.service.ts`**

Replace the winback import and cron. Current content to change:

```typescript
import { processDripDay, runOnboardingDrip } from "./drip-onboarding.helper";
import { runWinbackDrip } from "./drip-winback.helper";
import { runNpsDrip } from "./drip-nps.helper";
```

becomes:

```typescript
import { processDripDay, runOnboardingDrip } from "./drip-onboarding.helper";
import { runChurnWhyDrip, runChurnWhyCohort } from "./drip-churn-why.helper";
import { runNpsDrip } from "./drip-nps.helper";
```

And:

```typescript
  @Cron('0 9 * * *')
  async processWinbackDrip() {
    await runWinbackDrip(this.deps());
  }
```

becomes:

```typescript
  @Cron('0 9 * * *')
  async processChurnWhyDrip() {
    await runChurnWhyDrip(this.deps());
  }
```

And add this dev/test entry method (alongside `runDripDay`, before the `@Cron` methods):

```typescript
  /** Dev/test entry: run a single churn-why cohort deterministically (no cron lock). */
  async runChurnWhyCohort(emailType: string, onlyUserId?: string) {
    return runChurnWhyCohort(this.deps(), emailType, onlyUserId);
  }
```

- [ ] **Step 2: Delete the old helper**

```bash
git rm packages/backend/src/email/drip-winback.helper.ts
```

- [ ] **Step 3: Run the existing drip service test**

Run (from `packages/backend`): `npm test -- drip.service.spec.ts`
Expected: PASS (unaffected — it only checks `runDripDay` exists)

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: no TypeScript errors, and no remaining references to `drip-winback.helper` or `runWinbackDrip` anywhere in `packages/backend/src`

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/email/drip.service.ts
git commit -m "feat(email): replace win-back cron with churn-why drip"
```

---

### Task 10: Dev-walkthrough hook for manual testing

**Files:**

- Modify: `packages/backend/src/admin/dev-walkthrough/dev-walkthrough.service.ts`

**Interfaces:**

- Consumes: `DripService.runChurnWhyCohort` (Task 9).
- Produces: `fireJob('churn_why_zero_session' | 'churn_why_tried_once' | 'churn_why_engaged_quiet', userId)` support, so a single real test account can be used to trigger any of the three cohort emails on demand (mirrors the existing `drip{N}` job pattern), used in Task 14's manual verification.

- [ ] **Step 1: Extend `fireJob`**

Current:

```typescript
  async fireJob(job: string, userId: string): Promise<void> {
    if (job === 'welcome')
      return void (await this.engagement.fireWelcome(userId));
    if (job.startsWith('drip'))
      return void (await this.drip.runDripDay(Number(job.slice(4)), userId));
    if (job === 'trial_day_10')
      return void (await this.trialLifecycle.fireTrialDay10(userId));
    if (job === 'trial_day_13')
      return void (await this.trialLifecycle.fireTrialDay13(userId));
    if (job === 'trial_expired')
      return void (await this.trialLifecycle.fireTrialExpired(userId));
    throw new Error(`Unknown job: ${job}`);
  }
```

becomes:

```typescript
  async fireJob(job: string, userId: string): Promise<void> {
    if (job === 'welcome')
      return void (await this.engagement.fireWelcome(userId));
    if (job.startsWith('drip'))
      return void (await this.drip.runDripDay(Number(job.slice(4)), userId));
    if (job.startsWith('churn_why_'))
      return void (await this.drip.runChurnWhyCohort(job, userId));
    if (job === 'trial_day_10')
      return void (await this.trialLifecycle.fireTrialDay10(userId));
    if (job === 'trial_day_13')
      return void (await this.trialLifecycle.fireTrialDay13(userId));
    if (job === 'trial_expired')
      return void (await this.trialLifecycle.fireTrialExpired(userId));
    throw new Error(`Unknown job: ${job}`);
  }
```

- [ ] **Step 2: Build check**

Run (from `packages/backend`): `npm run build`
Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/admin/dev-walkthrough/dev-walkthrough.service.ts
git commit -m "feat(dev-walkthrough): support firing churn-why cohort emails by name"
```

---

### Task 11: Pure trial hydration and stats functions

**Files:**

- Create: `packages/backend/src/admin/trial/trial-hydration.util.ts`
- Test: `packages/backend/src/admin/trial/trial-hydration.util.spec.ts`

**Interfaces:**

- Consumes: `CHURN_REASON_LABELS` from `@propertyiq/emails` (Task 4).
- Produces: `hydrateTrialRecords(trials, profiles, paywallCounts, churnResponses, now?): UserTrial[]`, `computeTrialStats(counts, sessionCounts): TrialStatsResult` — both pure, no I/O. Consumed by Task 12 (`trial.service.ts`).

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/backend/src/admin/trial/trial-hydration.util.spec.ts
import { hydrateTrialRecords, computeTrialStats } from "./trial-hydration.util";

describe("hydrateTrialRecords", () => {
  const baseTrial = {
    id: "t1",
    user_id: "u1",
    tier: "pro",
    started_at: "2026-07-01T00:00:00Z",
    expires_at: "2026-07-01T00:00:00Z", // overridden per test via `now`
    converted_at: null,
    cancelled_at: null,
    created_at: "2026-07-01T00:00:00Z",
  };

  it("joins profile email/name, paywall count, and the latest churn response", () => {
    const now = new Date("2026-07-05T00:00:00Z").getTime();
    const trials = [{ ...baseTrial, expires_at: "2026-07-15T00:00:00Z" }];
    const profiles = [{ id: "u1", email: "jane@x.com", full_name: "Jane Doe" }];
    const paywallCounts = new Map([["u1", 3]]);
    const churnResponses = [
      {
        user_id: "u1",
        reason_code: "too_expensive",
        detail: "pricing was unclear",
        created_at: "2026-07-04T00:00:00Z",
      },
    ];

    const [result] = hydrateTrialRecords(
      trials,
      profiles,
      paywallCounts,
      churnResponses,
      now,
    );

    expect(result.user_email).toBe("jane@x.com");
    expect(result.user_name).toBe("Jane Doe");
    expect(result.paywall_hits).toBe(3);
    expect(result.reason_code).toBe("too_expensive");
    expect(result.reason_label).toBe("Too expensive");
    expect(result.detail).toBe("pricing was unclear");
    expect(result.days_remaining).toBe(10);
  });

  it("takes only the most recent churn response per user when multiple exist", () => {
    const now = new Date("2026-07-05T00:00:00Z").getTime();
    const trials = [{ ...baseTrial, expires_at: "2026-07-10T00:00:00Z" }];
    const churnResponses = [
      {
        user_id: "u1",
        reason_code: "busy",
        detail: null,
        created_at: "2026-07-04T00:00:00Z",
      },
      {
        user_id: "u1",
        reason_code: "unsure",
        detail: null,
        created_at: "2026-07-02T00:00:00Z",
      },
    ];

    const [result] = hydrateTrialRecords(
      trials,
      [],
      new Map(),
      churnResponses,
      now,
    );

    expect(result.reason_code).toBe("busy");
  });

  it("defaults missing joins to null/zero rather than throwing", () => {
    const now = new Date("2026-07-05T00:00:00Z").getTime();
    const trials = [{ ...baseTrial, expires_at: "2026-07-06T00:00:00Z" }];

    const [result] = hydrateTrialRecords(trials, [], new Map(), [], now);

    expect(result.user_email).toBeUndefined();
    expect(result.paywall_hits).toBe(0);
    expect(result.reason_code).toBeNull();
    expect(result.reason_label).toBeNull();
  });
});

describe("computeTrialStats", () => {
  it("computes conversion rate and average sessions", () => {
    const stats = computeTrialStats(
      { active: 5, expired: 13, converted: 0, cancelled: 0, expiringSoon: 2 },
      [1, 3, 2, 0, 4],
    );

    expect(stats.active_count).toBe(5);
    expect(stats.expired_count).toBe(13);
    expect(stats.expiring_soon_count).toBe(2);
    expect(stats.conversion_rate).toBe(0);
    expect(stats.avg_sessions).toBe(2);
  });

  it("returns 0 conversion rate and 0 avg sessions when there is no data", () => {
    const stats = computeTrialStats(
      { active: 0, expired: 0, converted: 0, cancelled: 0, expiringSoon: 0 },
      [],
    );

    expect(stats.conversion_rate).toBe(0);
    expect(stats.avg_sessions).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `packages/backend`): `npm test -- trial-hydration.util.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/backend/src/admin/trial/trial-hydration.util.ts
import { CHURN_REASON_LABELS } from "@propertyiq/emails";
import type { UserTrial } from "./trial.service";

interface TrialProfile {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface ChurnResponseRow {
  user_id: string;
  reason_code: string;
  detail: string | null;
  created_at: string;
}

/** Left-joins profile identity, paywall-hit count, and the latest churn
 * response onto each trial row. Pure — callers fetch the inputs. */
export function hydrateTrialRecords(
  trials: UserTrial[],
  profiles: TrialProfile[],
  paywallCounts: Map<string, number>,
  churnResponses: ChurnResponseRow[],
  now: number,
): UserTrial[] {
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // churnResponses may contain multiple rows per user (one per email_type);
  // keep only the most recent per user_id.
  const latestChurnByUser = new Map<string, ChurnResponseRow>();
  for (const row of churnResponses) {
    const existing = latestChurnByUser.get(row.user_id);
    if (!existing || row.created_at > existing.created_at) {
      latestChurnByUser.set(row.user_id, row);
    }
  }

  return trials.map((trial) => {
    const profile = profileById.get(trial.user_id);
    const churn = latestChurnByUser.get(trial.user_id);
    const daysRemaining = Math.ceil(
      (new Date(trial.expires_at).getTime() - now) / (24 * 60 * 60 * 1000),
    );

    return {
      ...trial,
      user_email: profile?.email ?? undefined,
      user_name: profile?.full_name ?? undefined,
      days_remaining: daysRemaining,
      paywall_hits: paywallCounts.get(trial.user_id) ?? 0,
      reason_code: churn?.reason_code ?? null,
      reason_label: churn
        ? (CHURN_REASON_LABELS[churn.reason_code] ?? churn.reason_code)
        : null,
      detail: churn?.detail ?? null,
    };
  });
}

interface TrialStatusCounts {
  active: number;
  expired: number;
  converted: number;
  cancelled: number;
  expiringSoon: number;
}

export interface TrialStatsResult {
  active_count: number;
  expired_count: number;
  converted_count: number;
  cancelled_count: number;
  expiring_soon_count: number;
  conversion_rate: number;
  avg_sessions: number;
}

/** Derives conversion rate and average session count from raw counts. Pure —
 * callers fetch the counts and the per-active-user session-count list. */
export function computeTrialStats(
  counts: TrialStatusCounts,
  activeUserSessionCounts: number[],
): TrialStatsResult {
  const totalCompleted = counts.expired + counts.converted + counts.cancelled;
  const conversionRate =
    totalCompleted > 0 ? (counts.converted / totalCompleted) * 100 : 0;

  const avgSessions =
    activeUserSessionCounts.length > 0
      ? activeUserSessionCounts.reduce((sum, n) => sum + n, 0) /
        activeUserSessionCounts.length
      : 0;

  return {
    active_count: counts.active,
    expired_count: counts.expired,
    converted_count: counts.converted,
    cancelled_count: counts.cancelled,
    expiring_soon_count: counts.expiringSoon,
    conversion_rate: Math.round(conversionRate * 10) / 10,
    avg_sessions: Math.round(avgSessions * 10) / 10,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- trial-hydration.util.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/admin/trial/trial-hydration.util.ts packages/backend/src/admin/trial/trial-hydration.util.spec.ts
git commit -m "test(admin): add pure trial hydration and stats functions"
```

---

### Task 12: Fix `TrialService` — real identity, paywall hits, churn reason

**Files:**

- Modify: `packages/backend/src/admin/trial/trial.service.ts`

**Interfaces:**

- Consumes: `hydrateTrialRecords`, `computeTrialStats` (Task 11), `getSessionCountsForUsers` (Task 3), `getPaywallCountsForUsers` (existing, from `../users/users-batch-fetch.helper`).
- Produces: `UserTrial` gains `user_name?`, `days_remaining?`, `paywall_hits?`, `reason_code?`, `reason_label?`, `detail?`; `getStats()` return type changes to `TrialStatsResult` (Task 11) — this is the exact shape `TrialController.getStats()` passes straight through, so no controller change is needed.

- [ ] **Step 1: Update the `UserTrial` interface**

Current:

```typescript
export interface UserTrial {
  id: string;
  user_id: string;
  tier: string;
  started_at: string;
  expires_at: string;
  converted_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  // Joined user info
  user_email?: string;
}
```

becomes:

```typescript
export interface UserTrial {
  id: string;
  user_id: string;
  tier: string;
  started_at: string;
  expires_at: string;
  converted_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  // Joined/computed fields — populated by hydrateTrialRecords()
  user_email?: string;
  user_name?: string;
  days_remaining?: number;
  paywall_hits?: number;
  reason_code?: string | null;
  reason_label?: string | null;
  detail?: string | null;
}
```

- [ ] **Step 2: Add imports**

At the top of `trial.service.ts`, add:

```typescript
import { getPaywallCountsForUsers } from "../users/users-batch-fetch.helper";
import { getSessionCountsForUsers } from "../../common/user-sessions-count.util";
import {
  hydrateTrialRecords,
  computeTrialStats,
  type TrialStatsResult,
} from "./trial-hydration.util";
```

- [ ] **Step 3: Hydrate `getAllTrials()`**

Current tail of `getAllTrials`:

```typescript
    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`Failed to get trials: ${error.message}`);
      throw new Error(error.message);
    }

    return { trials: data || [], total: count || 0 };
  }
```

becomes:

```typescript
    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`Failed to get trials: ${error.message}`);
      throw new Error(error.message);
    }

    const trials = await this.hydrate(data || []);
    return { trials, total: count || 0 };
  }

  /** Joins profile identity, real paywall-hit counts, and the latest churn
   * reason onto raw user_trials rows. */
  private async hydrate(trials: UserTrial[]): Promise<UserTrial[]> {
    if (!trials.length) return [];

    const client = this.supabase.getClient();
    const userIds = trials.map((t) => t.user_id);

    const [profilesResult, paywallCounts, churnResult] = await Promise.all([
      client
        .from('user_profiles')
        .select('id, email, full_name')
        .in('id', userIds),
      getPaywallCountsForUsers(client, userIds),
      client
        .from('churn_survey_responses')
        .select('user_id, reason_code, detail, created_at')
        .in('user_id', userIds),
    ]);

    return hydrateTrialRecords(
      trials,
      profilesResult.data || [],
      paywallCounts,
      churnResult.data || [],
      Date.now(),
    );
  }
```

- [ ] **Step 4: Rewrite `getStats()`**

Current `getStats()` body (everything between the method signature's opening brace and its closing brace) is replaced with:

```typescript
  async getStats(): Promise<TrialStatsResult> {
    const client = this.supabase.getClient();
    const now = new Date().toISOString();
    const soonCutoff = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [
      activeResult,
      expiredResult,
      convertedResult,
      cancelledResult,
      expiringSoonResult,
      activeUsersResult,
    ] = await Promise.all([
      client
        .from('user_trials')
        .select('*', { count: 'exact', head: true })
        .is('converted_at', null)
        .is('cancelled_at', null)
        .gt('expires_at', now),
      client
        .from('user_trials')
        .select('*', { count: 'exact', head: true })
        .is('converted_at', null)
        .is('cancelled_at', null)
        .lt('expires_at', now),
      client
        .from('user_trials')
        .select('*', { count: 'exact', head: true })
        .not('converted_at', 'is', null),
      client
        .from('user_trials')
        .select('*', { count: 'exact', head: true })
        .not('cancelled_at', 'is', null),
      client
        .from('user_trials')
        .select('*', { count: 'exact', head: true })
        .is('converted_at', null)
        .is('cancelled_at', null)
        .gt('expires_at', now)
        .lte('expires_at', soonCutoff),
      client
        .from('user_trials')
        .select('user_id')
        .is('converted_at', null)
        .is('cancelled_at', null)
        .gt('expires_at', now),
    ]);

    const activeUserIds = (activeUsersResult.data || []).map((t) => t.user_id);
    const sessionCounts = await getSessionCountsForUsers(client, activeUserIds);
    const activeUserSessionCounts = activeUserIds.map(
      (id) => sessionCounts.get(id) ?? 0,
    );

    return computeTrialStats(
      {
        active: activeResult.count || 0,
        expired: expiredResult.count || 0,
        converted: convertedResult.count || 0,
        cancelled: cancelledResult.count || 0,
        expiringSoon: expiringSoonResult.count || 0,
      },
      activeUserSessionCounts,
    );
  }
```

- [ ] **Step 5: Build check**

Run (from `packages/backend`): `npm run build`
Expected: no TypeScript errors

- [ ] **Step 6: Verify against the real dataset**

Use the Supabase SQL tool (or the app once Task 13 is done) to confirm the shape — or, faster, temporarily log the result of `getAllTrials()`/`getStats()` by hitting `GET /api/admin/trial/users` and `GET /api/admin/trial/stats` against the local backend with an admin session. Expected: `stats.active_count === 5`, `stats.expired_count === 13` (matching the confirmed real counts), and at least one trial row shows a real `user_email`/`user_name` instead of blank/"Unknown".

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/admin/trial/trial.service.ts
git commit -m "fix(admin): hydrate trial rows with real identity, paywall hits, and churn reason"
```

---

### Task 13: Split and fix the Trial Settings admin page

**Files:**

- Create: `packages/frontend/app/(app)/admin/entitlements/trial/components/ToggleSwitch.tsx`
- Create: `packages/frontend/app/(app)/admin/entitlements/trial/components/StatCard.tsx`
- Create: `packages/frontend/app/(app)/admin/entitlements/trial/components/TrialStatusBadge.tsx`
- Create: `packages/frontend/app/(app)/admin/entitlements/trial/components/TrialsTable.tsx`
- Modify: `packages/frontend/app/(app)/admin/entitlements/trial/page.tsx`

**Interfaces:**

- Consumes: `GET /api/admin/trial/stats` (now returns `TrialStatsResult` shape from Task 12), `GET /api/admin/trial/users` (rows now include `user_name`, `user_email`, `days_remaining`, `paywall_hits`, `reason_code`, `reason_label`, `detail`, `converted_at`, `cancelled_at`).
- Produces: `ActiveTrial` (extended), `TrialStats` (extended) types in `page.tsx`; `TrialsTable` component consumed only by `page.tsx`.

This file is 608 lines today — over the 400-line hard limit for React components (CLAUDE.md §1.3) even before this change, and it already has 4 component definitions in one file (`ToggleSwitch`, `StatCard`, `TrialStatusBadge`, `TrialSettingsPage`), violating the one-exported-component-per-file rule. Since this task touches the file substantially anyway, split it now.

- [ ] **Step 1: Extract `ToggleSwitch`**

```tsx
// packages/frontend/app/(app)/admin/entitlements/trial/components/ToggleSwitch.tsx
import { ToggleLeft, ToggleRight } from "lucide-react";

export function ToggleSwitch({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-on-surface">{label}</div>
        {description && (
          <div className="text-xs text-on-surface-variant mt-0.5">
            {description}
          </div>
        )}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className="flex-shrink-0"
        aria-label={`Toggle ${label}`}
      >
        {enabled ? (
          <ToggleRight className="w-10 h-6 text-primary" />
        ) : (
          <ToggleLeft className="w-10 h-6 text-on-surface-variant" />
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Extract `StatCard`**

```tsx
// packages/frontend/app/(app)/admin/entitlements/trial/components/StatCard.tsx
export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
}) {
  return (
    <div className="bg-surface-container rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        {trend && (
          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold text-on-surface">{value}</div>
      <div className="text-sm text-on-surface-variant">{label}</div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `TrialStatusBadge` to handle all statuses**

The original only bucketed by `daysRemaining`, which would mislabel an already-expired, converted, or cancelled trial. It now needs those three fields:

```tsx
// packages/frontend/app/(app)/admin/entitlements/trial/components/TrialStatusBadge.tsx
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";

export function TrialStatusBadge({
  daysRemaining,
  convertedAt,
  cancelledAt,
}: {
  daysRemaining: number;
  convertedAt: string | null;
  cancelledAt: string | null;
}) {
  if (convertedAt) {
    return (
      <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
        <CheckCircle className="w-3 h-3" />
        Converted
      </span>
    );
  }
  if (cancelledAt) {
    return (
      <span className="flex items-center gap-1 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
        <XCircle className="w-3 h-3" />
        Cancelled
      </span>
    );
  }
  if (daysRemaining <= 0) {
    return (
      <span className="flex items-center gap-1 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
        <XCircle className="w-3 h-3" />
        Expired
      </span>
    );
  }
  if (daysRemaining <= 1) {
    return (
      <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
        <AlertCircle className="w-3 h-3" />
        Expiring
      </span>
    );
  }
  if (daysRemaining <= 3) {
    return (
      <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" />
        {daysRemaining} days left
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
      <CheckCircle className="w-3 h-3" />
      {daysRemaining} days left
    </span>
  );
}
```

- [ ] **Step 4: Create `TrialsTable`, including the new "Why they left" column**

```tsx
// packages/frontend/app/(app)/admin/entitlements/trial/components/TrialsTable.tsx
import { useState } from "react";
import { Gift } from "lucide-react";
import { TrialStatusBadge } from "./TrialStatusBadge";

export interface ActiveTrial {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  tier: string;
  startedAt: string;
  expiresAt: string;
  daysRemaining: number;
  convertedAt: string | null;
  cancelledAt: string | null;
  paywallHits: number;
  reasonCode: string | null;
  reasonLabel: string | null;
  detail: string | null;
}

export function TrialsTable({
  trials,
  onExtend,
  onCancel,
}: {
  trials: ActiveTrial[];
  onExtend: (userId: string) => void;
  onCancel: (userId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (trials.length === 0) {
    return (
      <div className="text-center py-8">
        <Gift className="w-12 h-12 text-on-surface-variant mx-auto mb-3" />
        <p className="text-on-surface-variant">No trials yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left border-b border-outline-variant">
            <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              User
            </th>
            <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              Status
            </th>
            <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              Why they left
            </th>
            <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider text-right">
              Usage
            </th>
            <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {trials.map((trial) => (
            <tr
              key={trial.id}
              className="border-b border-outline-variant last:border-0"
            >
              <td className="py-3">
                <div>
                  <div className="text-sm font-medium text-on-surface">
                    {trial.userName}
                  </div>
                  <div className="text-xs text-on-surface-variant">
                    {trial.userEmail}
                  </div>
                </div>
              </td>
              <td className="py-3">
                <TrialStatusBadge
                  daysRemaining={trial.daysRemaining}
                  convertedAt={trial.convertedAt}
                  cancelledAt={trial.cancelledAt}
                />
              </td>
              <td className="py-3 max-w-xs">
                {trial.reasonLabel ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expandedId === trial.id ? null : trial.id)
                    }
                    className="text-left"
                  >
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      {trial.reasonLabel}
                    </span>
                    {trial.detail && expandedId === trial.id && (
                      <div className="text-xs text-on-surface-variant mt-1 italic">
                        &ldquo;{trial.detail}&rdquo;
                      </div>
                    )}
                  </button>
                ) : (
                  <span className="text-xs text-on-surface-variant">—</span>
                )}
              </td>
              <td className="py-3 text-right text-sm text-on-surface-variant">
                {trial.paywallHits} features used
              </td>
              <td className="py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onExtend(trial.userId)}
                    className="text-xs text-primary hover:underline"
                  >
                    Extend
                  </button>
                  <button
                    onClick={() => onCancel(trial.userId)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite `page.tsx` as the orchestrator**

Replace the full file content with:

```tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Users,
  TrendingUp,
  Calendar,
  AlertCircle,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { fetchAPIRaw } from "@/lib/data";
import { ToggleSwitch } from "./components/ToggleSwitch";
import { StatCard } from "./components/StatCard";
import { TrialsTable, type ActiveTrial } from "./components/TrialsTable";

interface TrialConfig {
  isEnabled: boolean;
  durationDays: number;
  trialTier: string;
  showBanner: boolean;
  autoConvertEnabled: boolean;
  reminderDays: number[];
}

interface TrialStats {
  activeCount: number;
  expiringSoonCount: number;
  conversionRate: number;
  avgSessions: number;
}

const DEFAULT_CONFIG: TrialConfig = {
  isEnabled: false,
  durationDays: 14,
  trialTier: "pro",
  showBanner: true,
  autoConvertEnabled: false,
  reminderDays: [7, 3, 1],
};

export default function TrialSettingsPage() {
  const [config, setConfig] = useState<TrialConfig>(DEFAULT_CONFIG);
  const [stats, setStats] = useState<TrialStats | null>(null);
  const [trials, setTrials] = useState<ActiveTrial[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [configRes, statsRes, trialsRes] = await Promise.all([
        fetchAPIRaw("/api/admin/trial/config"),
        fetchAPIRaw("/api/admin/trial/stats"),
        fetchAPIRaw("/api/admin/trial/users"),
      ]);

      const failures: string[] = [];

      if (configRes.ok) {
        const configResponse = await configRes.json();
        const configData = configResponse.data || configResponse;
        setConfig({
          isEnabled: configData.is_enabled ?? false,
          durationDays: configData.duration_days ?? 14,
          trialTier: configData.trial_tier ?? "pro",
          showBanner: configData.show_banner ?? true,
          autoConvertEnabled: configData.auto_convert_enabled ?? false,
          reminderDays: configData.reminder_days ?? [7, 3, 1],
        });
      } else {
        failures.push(`config (${configRes.status})`);
      }

      if (statsRes.ok) {
        const statsResponse = await statsRes.json();
        const statsData = statsResponse.data || statsResponse;
        setStats({
          activeCount: statsData.active_count ?? 0,
          expiringSoonCount: statsData.expiring_soon_count ?? 0,
          conversionRate: statsData.conversion_rate ?? 0,
          avgSessions: statsData.avg_sessions ?? 0,
        });
      } else {
        failures.push(`stats (${statsRes.status})`);
      }

      if (trialsRes.ok) {
        const trialsResponse = await trialsRes.json();
        const trialsData = trialsResponse.data || [];
        setTrials(
          trialsData.map((t: Record<string, unknown>) => ({
            id: t.id,
            userId: t.user_id,
            userName: t.user_name || "Unknown",
            userEmail: t.user_email || "",
            tier: t.tier || "pro",
            startedAt: t.started_at,
            expiresAt: t.expires_at,
            daysRemaining: t.days_remaining ?? 0,
            convertedAt: (t.converted_at as string | null) ?? null,
            cancelledAt: (t.cancelled_at as string | null) ?? null,
            paywallHits: t.paywall_hits ?? 0,
            reasonCode: (t.reason_code as string | null) ?? null,
            reasonLabel: (t.reason_label as string | null) ?? null,
            detail: (t.detail as string | null) ?? null,
          })),
        );
      } else {
        failures.push(`trials (${trialsRes.status})`);
      }

      if (failures.length) {
        setError(`Failed to load: ${failures.join(", ")}`);
      }
    } catch (err) {
      console.error("Failed to fetch trial data:", err);
      setError("Failed to load trial data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateConfig = (updates: Partial<TrialConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetchAPIRaw("/api/admin/trial/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_enabled: config.isEnabled,
          duration_days: config.durationDays,
          trial_tier: config.trialTier,
          show_banner: config.showBanner,
          auto_convert_enabled: config.autoConvertEnabled,
          reminder_days: config.reminderDays,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save trial config:", err);
      setError("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleExtendTrial = async (userId: string) => {
    try {
      const res = await fetchAPIRaw(`/api/admin/trial/users/${userId}/extend`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 7 }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to extend trial:", err);
    }
  };

  const handleCancelTrial = async (userId: string) => {
    try {
      const res = await fetchAPIRaw(`/api/admin/trial/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to cancel trial:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">
            Trial Settings
          </h1>
          <p className="text-on-surface-variant">
            Configure trial periods and manage trials
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 rounded-lg hover:bg-surface-container-high transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4 text-on-surface-variant" />
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
              ${
                hasChanges && !saving
                  ? "bg-primary text-on-primary hover:bg-primary/90"
                  : "bg-surface-container-high text-on-surface-variant cursor-not-allowed"
              }
            `}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Trials"
          value={stats?.activeCount ?? trials.length}
          icon={Users}
        />
        <StatCard
          label="Expiring Soon"
          value={stats?.expiringSoonCount ?? 0}
          icon={AlertCircle}
        />
        <StatCard
          label="Conversion Rate"
          value={
            stats?.conversionRate != null ? `${stats.conversionRate}%` : "-"
          }
          icon={TrendingUp}
        />
        <StatCard
          label="Avg Sessions"
          value={stats?.avgSessions ?? "-"}
          icon={Clock}
        />
      </div>

      <div className="bg-surface-container rounded-xl p-6 mb-8">
        <h2 className="text-lg font-medium text-on-surface mb-6">
          Trial Configuration
        </h2>

        <div className="space-y-6">
          <div className="pb-6 border-b border-outline-variant">
            <ToggleSwitch
              enabled={config.isEnabled}
              onChange={(value) => updateConfig({ isEnabled: value })}
              label="Enable Trial Sign-ups"
              description="Allow new users to start a free trial"
            />
          </div>

          <div className="flex items-center justify-between gap-4 pb-6 border-b border-outline-variant">
            <div>
              <div className="text-sm font-medium text-on-surface">
                Trial Duration
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                How long users can try premium features
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={config.durationDays}
                onChange={(e) =>
                  updateConfig({ durationDays: parseInt(e.target.value) || 14 })
                }
                min={1}
                max={90}
                className="w-20 px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm text-center"
              />
              <span className="text-sm text-on-surface-variant">days</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pb-6 border-b border-outline-variant">
            <div>
              <div className="text-sm font-medium text-on-surface">
                Trial Tier
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                Which tier users get during trial
              </div>
            </div>
            <select
              value={config.trialTier}
              onChange={(e) => updateConfig({ trialTier: e.target.value })}
              className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
            >
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div className="pb-6 border-b border-outline-variant">
            <ToggleSwitch
              enabled={config.showBanner}
              onChange={(value) => updateConfig({ showBanner: value })}
              label="Show Trial Banner"
              description="Display a banner showing trial status and days remaining"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-on-surface">
                Reminder Emails
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                Send reminders before trial expires
              </div>
            </div>
            <div className="flex items-center gap-2">
              {[7, 3, 1].map((day) => (
                <button
                  key={day}
                  onClick={() => {
                    const newDays = config.reminderDays.includes(day)
                      ? config.reminderDays.filter((d) => d !== day)
                      : [...config.reminderDays, day].sort((a, b) => b - a);
                    updateConfig({ reminderDays: newDays });
                  }}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm transition-colors
                    ${
                      config.reminderDays.includes(day)
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-high text-on-surface-variant"
                    }
                  `}
                >
                  {day}d
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-6">
        <h2 className="text-lg font-medium text-on-surface mb-6">Trials</h2>
        <TrialsTable
          trials={trials}
          onExtend={handleExtendTrial}
          onCancel={handleCancelTrial}
        />
      </div>
    </div>
  );
}
```

Note what changed versus the original: `activeTrials`/`ActiveTrial` state renamed to `trials` (the table now shows all statuses, not just active, since the backend query was already unfiltered — only the label and badge logic were wrong); the "Trial Best Practices" hardcoded static tips block is dropped (it was fabricated marketing copy with no data behind it, e.g. "14-day trials have 30% higher conversion" — not something this task should perpetuate); non-2xx fetches now populate `error` instead of silently defaulting (this was Finding #3 from the bug diagnosis).

- [ ] **Step 6: Typecheck**

Run (from `packages/frontend`): `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Verify live in browser**

Load `/admin/entitlements/trial` as an admin user. Expected, against the real dataset (18 trials, 5 active/13 expired): the stat cards show real numbers (not all "0"/"-"), the table lists real user emails/names (not "Unknown"), status badges correctly distinguish Expired vs Active vs Converted vs Cancelled, and any user with a `churn_survey_responses` row shows a "Why they left" badge (there won't be any yet until Task 14 seeds one — confirm the column renders `—` cleanly for everyone until then).

- [ ] **Step 8: Commit**

```bash
git add "packages/frontend/app/(app)/admin/entitlements/trial/"
git commit -m "fix(admin): split Trial Settings page, render real data, add churn-reason column"
```

---

### Task 14: End-to-end verification pass

**Files:** none (verification only, against the real local/dev DB — no mocks)

- [ ] **Step 1: Confirm cron wiring**

Run (from `packages/backend`): `npm run build`
Expected: succeeds; grep the built output or source for `runWinbackDrip`/`drip-winback` to confirm zero remaining references:

```bash
grep -rn "runWinbackDrip\|drip-winback" packages/backend/src
```

Expected: no output.

- [ ] **Step 2: Manually fire each cohort against one real test account**

Using the same dev-walkthrough flow `scripts/trial-walkthrough.sh` already uses (requires local backend running with `DEV_WALKTHROUGH_ENABLED=true` and a real signed-up test account):

```bash
scripts/trial-walkthrough.sh email <test-email> churn_why_zero_session
scripts/trial-walkthrough.sh email <test-email> churn_why_tried_once
scripts/trial-walkthrough.sh email <test-email> churn_why_engaged_quiet
```

Expected: three emails arrive at `<test-email>`, each with the cohort-appropriate heading/body/reason buttons, and each recorded in `email_log` (verify via `scripts/trial-walkthrough.sh status <test-email>`).

- [ ] **Step 3: Submit a response and confirm it lands**

Click one reason button from the received email (or copy its URL) — confirm the `/why-did-you-leave` page loads with that reason pre-highlighted, submit it with an optional detail comment. Then query:

```sql
select user_id, cohort, email_type, reason_code, detail, created_at
from churn_survey_responses
order by created_at desc
limit 5;
```

Expected: one row matching the submission.

- [ ] **Step 4: Confirm it shows on the admin page**

Reload `/admin/entitlements/trial` as an admin. Expected: the test account's row now shows the submitted reason badge, and clicking it expands the optional detail text if one was provided.

- [ ] **Step 5: Clean up the test account**

```bash
scripts/trial-walkthrough.sh reset <test-email>
```

- [ ] **Step 6: Final commit (if any fixes were needed during verification)**

```bash
git status
```

If verification surfaced no further changes, this task ends with no commit — the plan is complete.

---

## Out of Scope (confirmed during brainstorming)

- Redesigning the Trial Settings config panel or extend/cancel actions beyond what's needed to render real data.
- A dedicated analytics dashboard for churn reasons beyond the admin table — revisit if volume grows.
- A full Playwright/Gmail-OTP E2E spec for this specific flow (the existing `trial-walkthrough.spec.ts` harness is heavy and built for the 14-day onboarding walkthrough; Task 14's lighter dev-walkthrough-based verification is the right scope here — consider folding churn-why into that Playwright suite as a future follow-up if this flow needs regression protection beyond manual verification).
