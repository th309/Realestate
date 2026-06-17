# Behavior-Aware Drip & Claude/MCP Email — Implementation Plan (P3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the existing onboarding email drip serve **trial** users (who are currently skipped), make it **behavior-aware** (skip a day's email if the user already used the feature it teaches), and add a dedicated **Claude/MCP** email — the differentiator send.

**Architecture:** The mature `DripService` already runs a Day 0/1/3/5/7/10/14 sequence (Resend + React Email, `@Cron`, Redis-locked, `email_log` dedup, `email_preferences.marketing` opt-out). Two surgical changes: (1) **remove the skip-active-trial guard** so trial users receive the feature-education sequence; (2) before each send, read the user's coverage and **skip feature-specific emails for features already used**. Plus a new `ConnectClaude` template added to the day configs. Coverage is the same signal as P2.

**Tech Stack:** NestJS + Jest, Resend, `@react-email/components`, Supabase. Backend cmds from `packages/backend`; emails package builds from `packages/emails`.

**Dependencies:** P0 Part 2 (trial rows exist — otherwise the guard never fired anyway), P2 (the `feature.*` events + the coverage tables this reads). **Critical interaction:** enabling trials (P0 Part 2) makes every new signup a trial user; without Task 1 here, the existing drip would silently stop sending Day 0–14 to all new users (the guard skips them). Task 1 must land with/after P0 Part 2.

---

## Task 1: Let trial users receive the feature-education drip

**Files:**

- Modify: `packages/backend/src/email/drip.service.ts` (remove the active-trial skip, lines ~185–198)

- [ ] **Step 1: Remove the skip-active-trial guard**

In the onboarding-drip per-user loop, delete the block that queries `user_trials` and `continue`s on an active trial (the block whose comment reads "Skip users with active reverse trial — they get behavioral emails instead"). Trial users now receive the sequence. (The end-of-trial urgency emails in `BehavioralTriggerService` — day-10/13/14 — continue to fire independently; that overlap is intended: feature education during the trial + urgency at the end.)

- [ ] **Step 2: Build + run existing drip tests, commit**

```bash
cd packages/backend && npm run build && npx jest drip
git add -A
git commit -m "fix(drip): deliver the onboarding sequence to trial users (was silently skipped)"
```

(If no `drip.service.spec.ts` exists, `npm run build` is the gate; the behavior is covered by Task 2's test + integration.)

---

## Task 2: Behavior-aware — skip emails for features already used

**Files:**

- Create: `packages/backend/src/email/drip-coverage.ts`
- Create: `packages/backend/src/email/__tests__/drip-coverage.spec.ts`
- Modify: `packages/backend/src/email/drip.service.ts` (fetch coverage + skip in the send loop)

- [ ] **Step 1: Write the failing pure-logic test**

```ts
import { dripEmailFeatureUsed } from "../drip-coverage";

describe("dripEmailFeatureUsed", () => {
  const empty = { usedFeatures: [], checklist: [], stats: null };
  it("never skips the generic welcome email", () => {
    expect(dripEmailFeatureUsed("onboarding_day0", empty)).toBe(false);
  });
  it("skips the compare email when compare is already done", () => {
    expect(
      dripEmailFeatureUsed("onboarding_day3", {
        usedFeatures: [],
        checklist: ["compare_markets"],
        stats: null,
      }),
    ).toBe(true);
  });
  it("skips the report email when a report was generated", () => {
    expect(
      dripEmailFeatureUsed("onboarding_day14", {
        usedFeatures: [],
        checklist: [],
        stats: { markets_viewed: 0, scores_checked: 0, reports_generated: 1 },
      }),
    ).toBe(true);
  });
  it("skips the Claude email once MCP is connected", () => {
    expect(
      dripEmailFeatureUsed("onboarding_claude_connect", {
        usedFeatures: ["mcp_connected"],
        checklist: [],
        stats: null,
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run it (fails)**

```bash
cd packages/backend && npx jest drip-coverage
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement the pure mapper**

```ts
export interface DripCoverage {
  usedFeatures: string[]; // event_actions from user_events (category=feature)
  checklist: string[]; // user_profiles.onboarding_checklist
  stats: {
    markets_viewed: number;
    scores_checked: number;
    reports_generated: number;
  } | null;
}

// Only feature-specific emails are skippable; generic ones always send.
const SKIP_WHEN: Record<string, (c: DripCoverage) => boolean> = {
  onboarding_day1: (c) =>
    (c.stats?.scores_checked ?? 0) > 0 || c.checklist.includes("view_score"),
  onboarding_day3: (c) =>
    c.checklist.includes("compare_markets") ||
    c.usedFeatures.includes("compare") ||
    (c.stats?.markets_viewed ?? 0) >= 2,
  onboarding_day14: (c) =>
    (c.stats?.reports_generated ?? 0) > 0 ||
    c.checklist.includes("generate_report") ||
    c.checklist.includes("read_report"),
  onboarding_claude_connect: (c) => c.usedFeatures.includes("mcp_connected"),
};

export function dripEmailFeatureUsed(
  emailType: string,
  c: DripCoverage,
): boolean {
  const fn = SKIP_WHEN[emailType];
  return fn ? fn(c) : false;
}
```

- [ ] **Step 4: Run it (passes)**

```bash
cd packages/backend && npx jest drip-coverage
```

Expected: PASS.

- [ ] **Step 5: Wire coverage into the send loop**

In `drip.service.ts`, add a private method to read coverage and call the skip before sending. Add near the other private helpers:

```ts
private async getDripCoverage(userId: string): Promise<import("./drip-coverage").DripCoverage> {
  const [{ data: events }, { data: profile }] = await Promise.all([
    this.supabase.from("user_events").select("event_action").eq("user_id", userId).eq("event_category", "feature"),
    this.supabase.from("user_profiles").select("onboarding_checklist, usage_stats").eq("id", userId).single(),
  ]);
  return {
    usedFeatures: [...new Set((events ?? []).map((e: { event_action: string }) => e.event_action))],
    checklist: (profile?.onboarding_checklist as string[]) ?? [],
    stats: (profile?.usage_stats as DripCoverage["stats"]) ?? null,
  };
}
```

Import the helper at the top: `import { dripEmailFeatureUsed, type DripCoverage } from "./drip-coverage";`

In the per-user send loop, just before building/sending the email:

```ts
const coverage = await this.getDripCoverage(user.id);
if (dripEmailFeatureUsed(dayConfig.emailType, coverage)) {
  skipped++;
  continue;
}
```

- [ ] **Step 6: Build + commit**

```bash
cd packages/backend && npm run build
git add -A
git commit -m "feat(drip): skip a day's email when the user already used that feature"
```

---

## Task 3: The Claude/MCP email template

**Files:**

- Create: `packages/emails/emails/connect-claude.tsx`
- Modify: `packages/emails/index.ts` (export it)

- [ ] **Step 1: Create the template (mirrors `onboarding-day7-profile.tsx`, copy inlined)**

```tsx
import { Text, Section } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface ConnectClaudeProps {
  name: string;
  loginUrl: string;
  unsubscribeUrl?: string;
}

export default function ConnectClaude({
  name,
  loginUrl,
  unsubscribeUrl,
}: ConnectClaudeProps) {
  const docsUrl = `${loginUrl}/docs/mcp?from=email_claude`;
  return (
    <Layout
      preview="The one thing no other real-estate platform does"
      unsubscribeUrl={unsubscribeUrl}
    >
      <EmailHeading>Use PropertyIQ inside Claude</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hi {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Here&apos;s something no other real-estate platform offers: connect
        PropertyIQ to Claude and ask about any market, score, or deal in plain
        English — with live data, on your Pro trial.
      </Text>
      <Section className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <Text className="text-sm text-gray-700 leading-5 m-0">
          &ldquo;What&apos;s the PropertyIQ score for Boise, and is it a better
          buy than Spokane?&rdquo; — and Claude answers, using your PropertyIQ
          tools.
        </Text>
      </Section>
      <Section className="text-center mb-5">
        <BrandedButton href={docsUrl}>
          Connect Claude in 2 minutes
        </BrandedButton>
      </Section>
    </Layout>
  );
}

ConnectClaude.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app",
} satisfies ConnectClaudeProps;
```

- [ ] **Step 2: Export from the package index**

Add to `packages/emails/index.ts`:

```ts
export { default as ConnectClaude } from "./emails/connect-claude";
export type { ConnectClaudeProps } from "./emails/connect-claude";
```

- [ ] **Step 3: Build the emails package + commit**

```bash
cd packages/emails && npm run build
git add -A
git commit -m "feat(emails): add ConnectClaude (MCP differentiator) template"
```

(Preview it with the React Email dev server if available; the `.PreviewProps` are set.)

---

## Task 4: Register the Claude email in the drip sequence

**Files:**

- Modify: `packages/backend/src/email/drip.service.ts` (import + `DripDayConfig` union + `DRIP_DAY_CONFIGS`)

- [ ] **Step 1: Import + add to the template union type**

At the top imports, add `ConnectClaude` to the `@propertyiq/emails` import. In the `DripDayConfig.template` union type, add `| typeof ConnectClaude`.

- [ ] **Step 2: Add the day config**

Add to `DRIP_DAY_CONFIGS` (day 4 — between compare and movers):

```ts
{
  day: 4,
  emailType: "onboarding_claude_connect",
  subject: "The one thing only PropertyIQ does",
  template: ConnectClaude,
},
```

Dedup (`email_log` on `email_type = 'onboarding_claude_connect'`), marketing opt-out, and the Task 2 skip-used (skips if `mcp_connected`) all apply automatically because they key off `emailType`.

- [ ] **Step 3: Build + commit**

```bash
cd packages/backend && npm run build
git add -A
git commit -m "feat(drip): send the Claude/MCP email on trial day 4 (skips if already connected)"
```

---

## Task 5: Verify it's actually sending + metrics

**Files:** none (operational verification).

- [ ] **Step 1: Confirm `RUN_CRONS=true` on exactly one prod backend instance**

The drip only runs where `RUN_CRONS === 'true'` (`config/cron-schedule.imports.ts`). Verify the prod backend service has it set (Railway variables). If not, the drip has never sent — set it on one instance.

- [ ] **Step 2: Integration check (real DB, no mocks)**

In a test env with `RUN_CRONS=true`: create a user dated N days ago with an active trial, run the drip cron (or call the public method), and confirm: (a) a row appears in `email_log` with the right `email_type`; (b) a user who already used a feature does NOT get that day's email; (c) the `ConnectClaude` email fires on day 4 and is suppressed once `mcp_connected` is present.

- [ ] **Step 3: Metrics**

Add the success measure to the team dashboard: drip → feature-adoption rate, and trial→paid conversion correlated with `mcp_connected`. (Tracked via `user_events` + `user_trials.converted_at`; no new code required for v1 — query in the analytics module.)

---

## Self-Review

**Spec coverage (§5.10):** trial users receive the drip → Task 1 ✓; behavior-aware skip-used → Task 2 ✓; Claude/MCP email → Tasks 3–4 ✓; keyed to trial + dedup + opt-out (all reused, automatic) ✓; verify `RUN_CRONS` + metrics → Task 5 ✓.

**Placeholder scan:** none. Copy is inlined in the template (working, not a TODO); Task 5 is operational verification with concrete checks.

**Type consistency:** `DripCoverage` defined in Task 2 is used by `getDripCoverage` (Task 2 Step 5) and the pure helper; `ConnectClaudeProps` (`name`, `loginUrl`, `unsubscribeUrl?`) matches the `React.createElement(template, { name, loginUrl, unsubscribeUrl })` call already in the drip send path; `emailType` strings (`onboarding_day1/3/14`, `onboarding_claude_connect`) are identical across `DRIP_DAY_CONFIGS`, `SKIP_WHEN`, and the tests.

**Critical sequencing:** Task 1 must ship with/after P0 Part 2 — enabling trials without it would suppress the drip for all new signups. The feature events that Task 2 reads come from P2 Task 1–2.
