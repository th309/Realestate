# Enterprise Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guide enterprise users through org creation via a 3-step wizard, with a persistent banner for users who skip it.

**Architecture:** State-driven detection (`useMyOrg` hook + `EnterpriseOnboardingGate` provider) triggers a first-visit redirect to `/team/setup` wizard, then falls back to a persistent banner. Wizard creates org (Step 1), invites team (Step 2), shows feature tour (Step 3). All backend endpoints already exist.

**Tech Stack:** Next.js App Router, React Query, existing fetchers (`fetchMyOrg`, `createOrganization`, `inviteOrgMember`), M3 design system (Tailwind), existing `SeatUsageBar` component.

**Spec:** `docs/superpowers/specs/2026-03-24-enterprise-onboarding-wizard-design.md`

---

## File Map

| Action | Path (relative to `packages/frontend/`)                | Responsibility                                       |
| ------ | ------------------------------------------------------ | ---------------------------------------------------- |
| Create | `lib/data/hooks/useMyOrg.ts`                           | React Query hook wrapping `fetchMyOrg()`             |
| Create | `components/entitlements/EnterpriseOnboardingGate.tsx` | Provider: redirect on first visit, banner after      |
| Create | `components/entitlements/OrgSetupBanner.tsx`           | Full-width amber banner below header                 |
| Create | `app/team/setup/page.tsx`                              | Wizard container with step state machine             |
| Create | `app/team/setup/components/OrgNameStep.tsx`            | Step 1: org name + live slug preview                 |
| Create | `app/team/setup/components/InviteTeamStep.tsx`         | Step 2: email invites + seat counter                 |
| Create | `app/team/setup/components/FeatureTourStep.tsx`        | Step 3: 4 feature cards + dashboard CTA              |
| Modify | `app/layout.tsx:177`                                   | Insert `EnterpriseOnboardingGate` after `BetaBanner` |
| Modify | `lib/data/index.ts`                                    | Export `useMyOrg` hook                               |

---

### Task 1: useMyOrg Hook

**Files:**

- Create: `packages/frontend/lib/data/hooks/useMyOrg.ts`
- Modify: `packages/frontend/lib/data/index.ts`

- [ ] **Step 1: Create the hook**

```typescript
// packages/frontend/lib/data/hooks/useMyOrg.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMyOrg } from "@/lib/data";

interface MyOrgResult {
  slug: string | null;
  name: string | null;
  role: string | null;
}

export function useMyOrg() {
  const { data, isLoading, error } = useQuery<MyOrgResult>({
    queryKey: ["my-org"],
    queryFn: fetchMyOrg,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  return {
    org: data?.slug ? data : null,
    hasOrg: !!data?.slug,
    isLoading,
    error,
  };
}
```

- [ ] **Step 2: Export from data layer barrel**

Add to `packages/frontend/lib/data/index.ts`:

```typescript
export { useMyOrg } from "./hooks/useMyOrg";
```

- [ ] **Step 3: Verify import resolves**

Run: `cd packages/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```
git add packages/frontend/lib/data/hooks/useMyOrg.ts packages/frontend/lib/data/index.ts
git commit -m "feat: add useMyOrg hook for enterprise org detection"
```

---

### Task 2: OrgSetupBanner

**Files:**

- Create: `packages/frontend/components/entitlements/OrgSetupBanner.tsx`

- [ ] **Step 1: Create the banner component**

Follow `BetaBanner` pattern at `packages/frontend/app/components/BetaBanner.tsx` for positioning/z-index. Key differences: amber color, not dismissible, links to `/team/setup`.

```typescript
// packages/frontend/components/entitlements/OrgSetupBanner.tsx
"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * Persistent banner for enterprise users without an organization.
 * Not dismissible — disappears only when user creates an org.
 * Positioned below the header, same pattern as BetaBanner.
 */
export function OrgSetupBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center">
      <p className="text-sm text-amber-900">
        <span className="inline-flex items-center gap-2 flex-wrap justify-center">
          <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
            Enterprise
          </span>
          <span>
            Set up your organization to unlock team features, API access, and
            embeddable widgets.
          </span>
          <Link
            href="/team/setup"
            className="inline-flex items-center gap-1 text-amber-700 font-semibold hover:text-amber-900 underline underline-offset-2"
          >
            Set Up Organization
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </span>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add packages/frontend/components/entitlements/OrgSetupBanner.tsx
git commit -m "feat: add OrgSetupBanner for enterprise users without an org"
```

---

### Task 3: EnterpriseOnboardingGate Provider

**Files:**

- Create: `packages/frontend/components/entitlements/EnterpriseOnboardingGate.tsx`
- Modify: `packages/frontend/app/layout.tsx:177`

- [ ] **Step 1: Create the gate provider**

Logic:

- If not enterprise tier or has org → render children only
- If enterprise + no org + no sessionStorage flag → redirect to `/team/setup` + set flag
- If enterprise + no org + flag set → render `OrgSetupBanner` + children
- If `useMyOrg` is loading or errored → fail open (render children only)

```typescript
// packages/frontend/components/entitlements/EnterpriseOnboardingGate.tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useEntitlements } from "@/lib/entitlements";
import { useMyOrg } from "@/lib/data";
import { OrgSetupBanner } from "./OrgSetupBanner";

const SEEN_KEY = "piq-org-setup-seen";
const SETUP_PATH = "/team/setup";
const SKIP_PATHS = ["/team", "/auth", "/admin", "/org"];

export function EnterpriseOnboardingGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tier } = useEntitlements();
  const { hasOrg, isLoading, error } = useMyOrg();
  const router = useRouter();
  const pathname = usePathname();
  const redirected = useRef(false);

  const isEnterprise = tier === "enterprise";
  const needsOnboarding = isEnterprise && !hasOrg && !isLoading && !error;
  const isOnSkipPath = SKIP_PATHS.some((p) => pathname.startsWith(p));

  // First-visit redirect (once per session)
  useEffect(() => {
    if (!needsOnboarding || isOnSkipPath || redirected.current) return;

    const seen = sessionStorage.getItem(SEEN_KEY);
    if (!seen) {
      redirected.current = true;
      sessionStorage.setItem(SEEN_KEY, "1");
      router.replace(SETUP_PATH);
    }
  }, [needsOnboarding, isOnSkipPath, router]);

  // Show banner on subsequent visits (not on setup/auth/admin/org pages)
  const showBanner = needsOnboarding && !isOnSkipPath;

  return (
    <>
      {showBanner && <OrgSetupBanner />}
      {children}
    </>
  );
}
```

- [ ] **Step 2: Add to root layout**

In `packages/frontend/app/layout.tsx`, insert after `<BetaBanner />` (line 177):

```diff
          <BetaBanner />
+         <EnterpriseOnboardingGate>
          <AnalyticsProvider>
            <main id="main-content" className="flex-1 min-h-0 flex flex-col relative">
              {children}
            </main>
          </AnalyticsProvider>
          <AppFooter />
          <DevToolbarLoader />
+         </EnterpriseOnboardingGate>
```

Add the import at the top of layout.tsx:

```typescript
import { EnterpriseOnboardingGate } from "@/components/entitlements/EnterpriseOnboardingGate";
```

Note: `EnterpriseOnboardingGate` is a client component but the root layout is a server component. Wrap the import — Next.js handles this via automatic client boundary. The gate wraps everything below the banner so it can conditionally insert the `OrgSetupBanner` above the main content.

- [ ] **Step 3: Verify dev server loads without errors**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
Expected: 200

- [ ] **Step 4: Commit**

```
git add packages/frontend/components/entitlements/EnterpriseOnboardingGate.tsx packages/frontend/app/layout.tsx
git commit -m "feat: add EnterpriseOnboardingGate with redirect + persistent banner"
```

---

### Task 4: Wizard Container — `/team/setup`

**Files:**

- Create: `packages/frontend/app/team/setup/page.tsx`

- [ ] **Step 1: Create the wizard page**

Step state machine: 1 (name) → 2 (invite) → 3 (tour). Resume logic checks if org already exists.

```typescript
// packages/frontend/app/team/setup/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useMyOrg } from "@/lib/data";
import { Loader2 } from "lucide-react";
import { OrgNameStep } from "./components/OrgNameStep";
import { InviteTeamStep } from "./components/InviteTeamStep";
import { FeatureTourStep } from "./components/FeatureTourStep";

export default function TeamSetupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { org, hasOrg, isLoading: orgLoading } = useMyOrg();
  const [step, setStep] = useState(1);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/sign-in?redirect=%2Fteam%2Fsetup");
    }
  }, [user, authLoading, router]);

  // Resume: if org exists, skip to step 2
  useEffect(() => {
    if (hasOrg && org) {
      setOrgSlug(org.slug);
      setStep(2);
    }
  }, [hasOrg, org]);

  if (authLoading || orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Step indicator
  const steps = ["Organization", "Team", "Get Started"];

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {steps.map((label, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`w-8 h-px ${isDone ? "bg-primary" : "bg-outline-variant"}`}
                />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    isActive
                      ? "bg-primary text-on-primary"
                      : isDone
                        ? "bg-primary/20 text-primary"
                        : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {stepNum}
                </div>
                <span
                  className={`text-xs ${isActive ? "text-on-surface font-medium" : "text-on-surface-variant"}`}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {step === 1 && (
        <OrgNameStep
          onCreated={(slug) => {
            setOrgSlug(slug);
            setStep(2);
          }}
        />
      )}
      {step === 2 && orgSlug && (
        <InviteTeamStep
          orgSlug={orgSlug}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && orgSlug && (
        <FeatureTourStep orgSlug={orgSlug} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add packages/frontend/app/team/setup/page.tsx
git commit -m "feat: add wizard container for enterprise org setup"
```

---

### Task 5: Step 1 — OrgNameStep

**Files:**

- Create: `packages/frontend/app/team/setup/components/OrgNameStep.tsx`

- [ ] **Step 1: Create OrgNameStep component**

Org name input with live slug preview. Calls `createOrganization()` on submit.

```typescript
// packages/frontend/app/team/setup/components/OrgNameStep.tsx
"use client";

import { useState, useMemo } from "react";
import { Building2, Loader2, AlertCircle } from "lucide-react";
import { createOrganization } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface OrgNameStepProps {
  onCreated: (slug: string) => void;
}

export function OrgNameStep({ onCreated }: OrgNameStepProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const slug = useMemo(() => slugify(name), [name]);
  const isValid = name.trim().length >= 2 && slug.length >= 2;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || saving) return;

    setSaving(true);
    setError(null);

    try {
      await createOrganization(name.trim(), slug);
      // Invalidate the my-org query so the gate re-evaluates
      queryClient.invalidateQueries({ queryKey: ["my-org"] });
      onCreated(slug);
    } catch (err: any) {
      const msg = err?.message || "Failed to create organization";
      if (msg.includes("already taken") || msg.includes("conflict")) {
        setError(`"${slug}" is already taken. Try "${slug}-1" or a different name.`);
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface-container-low rounded-2xl p-8 shadow-sm">
      <div className="text-center mb-6">
        <Building2 className="h-10 w-10 text-primary mx-auto mb-3" />
        <h1 className="text-xl font-medium text-on-surface">
          Name Your Organization
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          This is how your team will identify your workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="org-name"
            className="block text-sm font-medium text-on-surface mb-1"
          >
            Organization Name
          </label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Real Estate Group"
            className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
            disabled={saving}
          />
        </div>

        {slug && (
          <p className="text-xs text-on-surface-variant">
            URL:{" "}
            <span className="font-mono text-primary">
              propertyiq.app/org/{slug}
            </span>
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || saving}
          className="w-full px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Create Organization
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add packages/frontend/app/team/setup/components/OrgNameStep.tsx
git commit -m "feat: add OrgNameStep — org name input with live slug preview"
```

---

### Task 6: Step 2 — InviteTeamStep

**Files:**

- Create: `packages/frontend/app/team/setup/components/InviteTeamStep.tsx`

- [ ] **Step 1: Create InviteTeamStep component**

Email inputs with seat counter. Calls `inviteOrgMember()` per email. Reuses `SeatUsageBar` pattern.

```typescript
// packages/frontend/app/team/setup/components/InviteTeamStep.tsx
"use client";

import { useState } from "react";
import {
  Mail,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { inviteOrgMember } from "@/lib/data";

const BASE_SEATS = 10;

interface InviteTeamStepProps {
  orgSlug: string;
  onNext: () => void;
  onBack: () => void;
}

interface EmailEntry {
  email: string;
  status: "pending" | "sending" | "sent" | "error";
  error?: string;
}

export function InviteTeamStep({ orgSlug, onNext, onBack }: InviteTeamStepProps) {
  const [emails, setEmails] = useState<EmailEntry[]>([
    { email: "", status: "pending" },
  ]);
  const [sending, setSending] = useState(false);

  const seatsUsed = 1; // Owner
  const inviteCount = emails.filter((e) => e.email.trim()).length;
  const totalUsed = seatsUsed + inviteCount;
  const atCapacity = totalUsed >= BASE_SEATS;

  function addEmail() {
    if (atCapacity) return;
    setEmails((prev) => [...prev, { email: "", status: "pending" }]);
  }

  function removeEmail(index: number) {
    setEmails((prev) => prev.filter((_, i) => i !== index));
  }

  function updateEmail(index: number, value: string) {
    setEmails((prev) =>
      prev.map((e, i) => (i === index ? { ...e, email: value, status: "pending" } : e)),
    );
  }

  async function handleSendInvites() {
    const valid = emails.filter((e) => e.email.trim() && e.status !== "sent");
    if (valid.length === 0) {
      onNext();
      return;
    }

    setSending(true);

    const updated = [...emails];
    for (let i = 0; i < updated.length; i++) {
      const entry = updated[i];
      if (!entry.email.trim() || entry.status === "sent") continue;

      updated[i] = { ...entry, status: "sending" };
      setEmails([...updated]);

      try {
        await inviteOrgMember(orgSlug, entry.email.trim(), "member");
        updated[i] = { ...entry, status: "sent" };
      } catch (err: any) {
        updated[i] = {
          ...entry,
          status: "error",
          error: err?.message || "Failed to send invite",
        };
      }
      setEmails([...updated]);
    }

    setSending(false);
    // Auto-advance after a brief pause to show results
    setTimeout(onNext, 1500);
  }

  const seatPercentage = Math.min((totalUsed / BASE_SEATS) * 100, 100);
  const barColor =
    seatPercentage > 95
      ? "bg-red-500"
      : seatPercentage >= 80
        ? "bg-amber-500"
        : "bg-green-500";

  return (
    <div className="bg-surface-container-low rounded-2xl p-8 shadow-sm">
      <div className="text-center mb-6">
        <Mail className="h-10 w-10 text-primary mx-auto mb-3" />
        <h1 className="text-xl font-medium text-on-surface">
          Invite Your Team
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Your plan includes {BASE_SEATS} seats. Add teammates now or do it later.
        </p>
      </div>

      {/* Seat usage bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-on-surface-variant mb-1">
          <span>{totalUsed} of {BASE_SEATS} seats used</span>
          <span>{BASE_SEATS - totalUsed} remaining</span>
        </div>
        <div className="h-2 w-full rounded-full bg-surface-container">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${seatPercentage}%` }}
          />
        </div>
      </div>

      {/* Email inputs */}
      <div className="space-y-3 mb-4">
        {emails.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="email"
              value={entry.email}
              onChange={(e) => updateEmail(i, e.target.value)}
              placeholder="teammate@company.com"
              disabled={sending || entry.status === "sent"}
              className="flex-1 px-3 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            {entry.status === "sent" && (
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            )}
            {entry.status === "sending" && (
              <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
            )}
            {entry.status === "error" && (
              <span title={entry.error}>
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              </span>
            )}
            {entry.status === "pending" && emails.length > 1 && (
              <button
                onClick={() => removeEmail(i)}
                className="p-1 text-on-surface-variant hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!atCapacity && (
        <button
          onClick={addEmail}
          disabled={sending}
          className="text-sm text-primary font-medium inline-flex items-center gap-1 hover:opacity-80 mb-6"
        >
          <Plus className="w-4 h-4" /> Add another
        </button>
      )}

      {atCapacity && (
        <p className="text-xs text-amber-600 mb-6">
          All seats filled — you can purchase additional seats in Billing.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/30">
        <button
          onClick={onBack}
          disabled={sending}
          className="text-sm text-on-surface-variant hover:text-on-surface inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex gap-3">
          <button
            onClick={onNext}
            disabled={sending}
            className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface"
          >
            Skip
          </button>
          <button
            onClick={handleSendInvites}
            disabled={sending || inviteCount === 0}
            className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
          >
            {sending && <Loader2 className="w-4 h-4 animate-spin" />}
            Send Invites
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add packages/frontend/app/team/setup/components/InviteTeamStep.tsx
git commit -m "feat: add InviteTeamStep — email invites with seat counter"
```

---

### Task 7: Step 3 — FeatureTourStep

**Files:**

- Create: `packages/frontend/app/team/setup/components/FeatureTourStep.tsx`

- [ ] **Step 1: Create FeatureTourStep component**

4 feature cards in a 2x2 grid + "Go to Dashboard" CTA.

```typescript
// packages/frontend/app/team/setup/components/FeatureTourStep.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Key,
  Code2,
  Palette,
  ArrowRight,
  PartyPopper,
} from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "Team Members",
    description: "Manage your team, assign roles, and control access",
    path: "members",
  },
  {
    icon: Key,
    title: "API Keys",
    description: "Integrate PropertyIQ data into your own tools and dashboards",
    path: "api-keys",
  },
  {
    icon: Code2,
    title: "Embeddable Widgets",
    description: "Embed scores, metrics, and maps on your website",
    path: "embeds",
  },
  {
    icon: Palette,
    title: "Custom Branding",
    description: "Add your logo and colors to reports and widgets",
    path: "branding",
  },
];

interface FeatureTourStepProps {
  orgSlug: string;
}

export function FeatureTourStep({ orgSlug }: FeatureTourStepProps) {
  const router = useRouter();

  return (
    <div className="text-center">
      <PartyPopper className="h-10 w-10 text-primary mx-auto mb-3" />
      <h1 className="text-xl font-medium text-on-surface mb-1">
        You&apos;re All Set!
      </h1>
      <p className="text-sm text-on-surface-variant mb-8">
        Here&apos;s what you can do with your Enterprise account.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {FEATURES.map((feat) => (
          <Link
            key={feat.path}
            href={`/org/${orgSlug}/admin/${feat.path}`}
            className="bg-surface-container-low rounded-xl p-5 text-left hover:bg-surface-container transition-colors group"
          >
            <feat.icon className="h-6 w-6 text-primary mb-2" />
            <h3 className="text-sm font-medium text-on-surface mb-1">
              {feat.title}
            </h3>
            <p className="text-xs text-on-surface-variant">{feat.description}</p>
            <span className="text-xs text-primary font-medium mt-2 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Set up <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        ))}
      </div>

      <button
        onClick={() => router.push(`/org/${orgSlug}/admin`)}
        className="px-8 py-3 bg-primary text-on-primary rounded-full text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2"
      >
        Go to Dashboard
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add packages/frontend/app/team/setup/components/FeatureTourStep.tsx
git commit -m "feat: add FeatureTourStep — enterprise feature tour cards"
```

---

### Task 8: Integration & Verification

- [ ] **Step 1: Verify all imports resolve**

Run: `cd packages/frontend && npx tsc --noEmit --pretty 2>&1 | grep -i error | head -20`
Expected: No errors related to the new files.

- [ ] **Step 2: Test the full flow manually**

1. Navigate to `http://localhost:3000/map?tier=enterprise` (simulate enterprise)
2. Verify: banner appears below header OR redirect to `/team/setup`
3. On `/team/setup`: enter org name → see slug preview → click Create
4. Step 2: add email → see seat counter → click Skip
5. Step 3: see 4 feature cards → click Go to Dashboard
6. Verify: banner disappears after org creation

- [ ] **Step 3: Final commit**

```
git add -A
git commit -m "feat: enterprise onboarding wizard — 3-step org setup with persistent banner"
git push origin develop
```
