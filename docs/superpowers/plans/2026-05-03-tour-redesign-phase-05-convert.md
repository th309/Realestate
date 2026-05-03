# Activation Tour Redesign — Phase 05: Convert

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the rendered listing presentation into a paid signup. Inline signup form below the report, claim handler in the auth callback that promotes the anonymous artifact to a real `reports` row tied to the new user, the post-signup celebrate screen, and the floating "60-sec tour for [persona]" CTA on programmatic SEO city pages.

**Architecture:** Inline signup form posts to a new `POST /api/anonymous/sign-up-with-tour` endpoint that (1) creates the Supabase auth user via service-role admin API, (2) atomically claims the `tour:<sessionId>` Redis row into the `reports` table, (3) sets `onboarding_market` on `user_profiles`, (4) returns an auth session that the frontend installs. The auth-callback page (used by email-confirm flow) gets a parallel claim path for users who confirm via email link. The celebrate screen is a single-screen `phase=celebrate` render. SEO floating CTA is a small client component injected into the programmatic-blog MDX layout.

**Tech Stack:** NestJS 11, Supabase admin SDK (service role), `@tanstack/react-query`, Tailwind 4, framer-motion (already present).

**Spec:** [../specs/2026-05-03-activation-tour-redesign-design.md](../specs/2026-05-03-activation-tour-redesign-design.md), sections 4-5 + the Re-tour for existing users + entry points.

**Depends on:** Phase 01 (Redis cache, anon API), Phase 02 (`/tour` route, state), Phase 04 (listing presentation rendered).

---

## File structure

**New (backend):**

- `packages/backend/src/anonymous/listing-presentation-claim.service.ts`
- `packages/backend/src/anonymous/dto/sign-up-with-tour.dto.ts`
- `packages/backend/src/anonymous/__tests__/listing-presentation-claim.service.spec.ts`

**Modify (backend):**

- `packages/backend/src/anonymous/anonymous.controller.ts` — add `POST /api/anonymous/sign-up-with-tour` and `POST /api/anonymous/claim`

**New (frontend):**

- `packages/frontend/app/tour/components/InlineSignupForm.tsx`
- `packages/frontend/app/tour/components/PostSignupCelebrate.tsx`
- `packages/frontend/components/tour/SeoTourCta.tsx`
- `packages/frontend/lib/data/fetchers/tour-signup.ts`
- `packages/frontend/lib/data/hooks/useTourSignup.ts`

**Modify (frontend):**

- `packages/frontend/app/tour/components/Step4Aha.tsx` — render `<InlineSignupForm />` below the report
- `packages/frontend/app/tour/page.tsx` — wire `phase=celebrate` to `<PostSignupCelebrate />`
- `packages/frontend/app/auth/callback/page.tsx` — claim path for email-confirm flow
- `packages/frontend/content/layouts/blog-layout.tsx` (or equivalent — locate the MDX shell) — inject `<SeoTourCta />` floating button

---

### Task 1: ListingPresentationClaimService — Redis → reports table

**Files:**

- Create: `packages/backend/src/anonymous/listing-presentation-claim.service.ts`
- Create: `packages/backend/src/anonymous/__tests__/listing-presentation-claim.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/anonymous/__tests__/listing-presentation-claim.service.spec.ts
import { Test } from "@nestjs/testing";
import { ListingPresentationClaimService } from "../listing-presentation-claim.service";
import { RedisTourCacheService } from "../redis-tour-cache.service";
import { SupabaseService } from "../../supabase/supabase.service";

describe("ListingPresentationClaimService", () => {
  let service: ListingPresentationClaimService;
  let cache: jest.Mocked<RedisTourCacheService>;
  let supabase: any;

  beforeEach(async () => {
    const insertMock = jest.fn().mockReturnThis();
    const upsertMock = jest.fn().mockResolvedValue({ data: null, error: null });
    const selectMock = jest
      .fn()
      .mockResolvedValue({ data: [{ id: "rpt-row-1" }], error: null });
    supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "reports")
          return { insert: insertMock, select: selectMock };
        if (table === "user_profiles") return { upsert: upsertMock };
        return {};
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        ListingPresentationClaimService,
        {
          provide: RedisTourCacheService,
          useValue: {
            get: jest.fn(),
            markClaimed: jest.fn(),
          },
        },
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();

    service = module.get(ListingPresentationClaimService);
    cache = module.get(RedisTourCacheService);
  });

  it("claims a session: inserts report row, sets onboarding_market, marks Redis claimed", async () => {
    cache.get.mockResolvedValue({
      sessionId: "sess-1",
      reportId: "anon-rpt-1",
      persona: "agent",
      market: { geoLevel: "city", geoId: "cary-nc", name: "Cary, NC" },
      reportPayload: { sections: [] },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
      claimedBy: null,
    } as any);

    const result = await service.claim({
      sessionId: "sess-1",
      userId: "user-99",
    });

    expect(result.reportId).toBeTruthy();
    expect(supabase.from).toHaveBeenCalledWith("reports");
    expect(supabase.from).toHaveBeenCalledWith("user_profiles");
    expect(cache.markClaimed).toHaveBeenCalledWith("sess-1", "user-99");
  });

  it("returns null when sessionId not found in Redis", async () => {
    cache.get.mockResolvedValue(null);
    const result = await service.claim({
      sessionId: "absent",
      userId: "user-99",
    });
    expect(result).toBeNull();
  });

  it("throws if session is already claimed by a different user", async () => {
    cache.get.mockResolvedValue({
      sessionId: "sess-1",
      reportId: "r",
      persona: "agent",
      market: { geoLevel: "city", geoId: "cary-nc", name: "Cary, NC" },
      reportPayload: {},
      createdAt: "",
      expiresAt: "",
      claimedBy: "user-other",
    } as any);
    await expect(
      service.claim({ sessionId: "sess-1", userId: "user-99" }),
    ).rejects.toThrow(/already claimed/i);
  });
});
```

- [ ] **Step 2: Run test, verify fails**

Run: `npx nx test backend --testPathPattern=listing-presentation-claim`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement claim service**

```typescript
// packages/backend/src/anonymous/listing-presentation-claim.service.ts
import { Injectable, ConflictException, Logger } from "@nestjs/common";
import { RedisTourCacheService } from "./redis-tour-cache.service";
import { SupabaseService } from "../supabase/supabase.service";

export interface ClaimInput {
  sessionId: string;
  userId: string;
}
export interface ClaimResult {
  reportId: string;
}

@Injectable()
export class ListingPresentationClaimService {
  private logger = new Logger(ListingPresentationClaimService.name);
  constructor(
    private cache: RedisTourCacheService,
    private supabase: SupabaseService,
  ) {}

  async claim(input: ClaimInput): Promise<ClaimResult | null> {
    const session = await this.cache.get(input.sessionId);
    if (!session) return null;
    if (session.claimedBy && session.claimedBy !== input.userId) {
      throw new ConflictException(
        "Tour session already claimed by another user",
      );
    }

    const { data, error } = await this.supabase
      .from("reports")
      .insert({
        user_id: input.userId,
        report_type: "listing_presentation",
        market_geo_level: session.market.geoLevel,
        market_geo_id: session.market.geoId,
        market_name: session.market.name,
        payload: session.reportPayload,
        is_demo: false,
        source: "tour_anonymous_claim",
        anon_session_id: session.sessionId,
      })
      .select("id");
    if (error || !data?.[0]) {
      this.logger.error(`Failed to insert claimed report: ${error?.message}`);
      throw new Error(
        `Failed to insert report: ${error?.message ?? "unknown"}`,
      );
    }

    // Set onboarding_market for activation-funnel + dashboard
    await this.supabase
      .from("user_profiles")
      .upsert(
        { id: input.userId, onboarding_market: session.market },
        { onConflict: "id" },
      );

    await this.cache.markClaimed(session.sessionId, input.userId);

    return { reportId: data[0].id };
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx nx test backend --testPathPattern=listing-presentation-claim`
Expected: PASS (3 tests).

- [ ] **Step 5: Database migration for reports table fields**

Create `supabase/migrations/<YYYYMMDDHHmmss>_add_anon_tour_fields_to_reports.sql`:

```sql
-- Add fields needed by tour anon-claim flow.
-- Existing reports table is reused for claimed anon reports.

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS anon_session_id TEXT,
  ADD COLUMN IF NOT EXISTS market_geo_level TEXT,
  ADD COLUMN IF NOT EXISTS market_geo_id TEXT,
  ADD COLUMN IF NOT EXISTS market_name TEXT,
  ADD COLUMN IF NOT EXISTS report_type TEXT DEFAULT 'listing_presentation',
  ADD COLUMN IF NOT EXISTS payload JSONB;

CREATE INDEX IF NOT EXISTS idx_reports_anon_session_id ON reports(anon_session_id) WHERE anon_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_user_market ON reports(user_id, market_geo_level, market_geo_id);

GRANT ALL ON reports TO service_role;
GRANT ALL ON reports TO authenticated;
```

Apply via Supabase MCP or `npx supabase db push`.

- [ ] **Step 6: Wire into AnonymousModule**

Modify `packages/backend/src/anonymous/anonymous.module.ts`:

- Add `ListingPresentationClaimService` to `providers` and `exports`.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/anonymous/listing-presentation-claim.service.ts \
  packages/backend/src/anonymous/__tests__/listing-presentation-claim.service.spec.ts \
  packages/backend/src/anonymous/anonymous.module.ts \
  supabase/migrations/*_add_anon_tour_fields_to_reports.sql
git commit -m "feat(anonymous): add ListingPresentationClaimService + reports schema"
```

---

### Task 2: SignUpWithTourDto + endpoints

**Files:**

- Create: `packages/backend/src/anonymous/dto/sign-up-with-tour.dto.ts`
- Modify: `packages/backend/src/anonymous/anonymous.controller.ts`

- [ ] **Step 1: DTOs**

```typescript
// packages/backend/src/anonymous/dto/sign-up-with-tour.dto.ts
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class SignUpWithTourDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsString() @MinLength(8) @MaxLength(128) tourSessionId!: string;
}

export class ClaimDto {
  @IsString() @MinLength(8) @MaxLength(128) tourSessionId!: string;
}
```

- [ ] **Step 2: Add `sign-up-with-tour` endpoint**

In `packages/backend/src/anonymous/anonymous.controller.ts`, add (will need `SupabaseService`, `ListingPresentationClaimService`, `JwtAuthGuard` only on the `claim` endpoint):

```typescript
import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { SignUpWithTourDto, ClaimDto } from './dto/sign-up-with-tour.dto';
import { ListingPresentationClaimService } from './listing-presentation-claim.service';
import { SupabaseService } from '../supabase/supabase.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

// ... existing class declaration ...

constructor(
  private listing: ListingPresentationService,
  private cache: RedisTourCacheService,
  private claimService: ListingPresentationClaimService,
  private supabaseService: SupabaseService,
) {}

@Post('sign-up-with-tour')
async signUpWithTour(@Body() dto: SignUpWithTourDto) {
  // Use service-role admin API to create the user atomically with the claim.
  const admin = this.supabaseService.adminClient();

  const { data: created, error: signUpErr } = await admin.auth.admin.createUser({
    email: dto.email,
    password: dto.password,
    email_confirm: process.env.NODE_ENV !== 'production', // auto-confirm in dev
  });
  if (signUpErr || !created?.user) {
    throw new UnauthorizedException(signUpErr?.message ?? 'Sign-up failed');
  }

  const userId = created.user.id;
  const claim = await this.claimService.claim({ sessionId: dto.tourSessionId, userId });

  // Issue a session for the new user (for auto-confirmed dev path).
  const { data: session, error: sessErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: dto.email,
  });
  // For prod email-confirm flow: don't return tokens; the user clicks the email link.
  return {
    userId,
    reportId: claim?.reportId ?? null,
    needsEmailConfirmation: process.env.NODE_ENV === 'production',
    magicLink: process.env.NODE_ENV !== 'production' ? session?.properties?.action_link : null,
  };
}

@Post('claim')
@UseGuards(JwtAuthGuard)
async claim(@Body() dto: ClaimDto, @Req() req: any) {
  const userId = req.userId; // set by JwtAuthGuard
  if (!userId) throw new UnauthorizedException('Authentication required');
  const result = await this.claimService.claim({ sessionId: dto.tourSessionId, userId });
  return { claimed: !!result, reportId: result?.reportId ?? null };
}
```

- [ ] **Step 3: Add `adminClient()` to SupabaseService if missing**

Verify `packages/backend/src/supabase/supabase.service.ts` exposes `adminClient()` returning a service-role client. If not, add it (using `process.env.SUPABASE_SERVICE_ROLE_KEY`).

- [ ] **Step 4: Smoke test**

```bash
# Generate a session via the existing endpoint first
curl -X POST http://localhost:3001/api/anonymous/listing-presentation \
  -H 'content-type: application/json' \
  -d '{"sessionId":"test-sess-99","persona":"agent","market":{"geoLevel":"city","geoId":"cary-nc","name":"Cary, NC"}}'

# Then claim with signup
curl -X POST http://localhost:3001/api/anonymous/sign-up-with-tour \
  -H 'content-type: application/json' \
  -d '{"email":"newuser@test.local","password":"hunter2hunter2","tourSessionId":"test-sess-99"}'
# Expected: { userId: "...", reportId: "...", needsEmailConfirmation: ..., magicLink: ... in dev }
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/anonymous/dto/sign-up-with-tour.dto.ts \
  packages/backend/src/anonymous/anonymous.controller.ts \
  packages/backend/src/supabase/supabase.service.ts
git commit -m "feat(anonymous): add sign-up-with-tour + claim endpoints"
```

---

### Task 3: Frontend tour-signup fetcher + hook

**Files:**

- Create: `packages/frontend/lib/data/fetchers/tour-signup.ts`
- Create: `packages/frontend/lib/data/hooks/useTourSignup.ts`
- Modify: `packages/frontend/lib/data/fetchers/index.ts`, `hooks/index.ts`, `index.ts` — re-export

- [ ] **Step 1: Fetcher**

```typescript
// packages/frontend/lib/data/fetchers/tour-signup.ts
import { API_URL } from "./base";

export interface SignUpWithTourInput {
  email: string;
  password: string;
  tourSessionId: string;
}
export interface SignUpWithTourResult {
  userId: string;
  reportId: string | null;
  needsEmailConfirmation: boolean;
  magicLink: string | null;
}

export async function signUpWithTour(
  input: SignUpWithTourInput,
): Promise<SignUpWithTourResult> {
  const res = await fetch(`${API_URL}/api/anonymous/sign-up-with-tour`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Sign-up failed: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 2: Hook**

```typescript
// packages/frontend/lib/data/hooks/useTourSignup.ts
import { useMutation } from "@tanstack/react-query";
import {
  signUpWithTour,
  type SignUpWithTourInput,
  type SignUpWithTourResult,
} from "../fetchers/tour-signup";

export function useTourSignup() {
  return useMutation<SignUpWithTourResult, Error, SignUpWithTourInput>({
    mutationFn: signUpWithTour,
  });
}
```

- [ ] **Step 3: Re-export + commit**

```bash
git add packages/frontend/lib/data/fetchers/tour-signup.ts \
  packages/frontend/lib/data/hooks/useTourSignup.ts \
  packages/frontend/lib/data/fetchers/index.ts \
  packages/frontend/lib/data/hooks/index.ts \
  packages/frontend/lib/data/index.ts
git commit -m "feat(data): add useTourSignup mutation hook"
```

---

### Task 4: InlineSignupForm

**Files:**

- Create: `packages/frontend/app/tour/components/InlineSignupForm.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/frontend/app/tour/components/InlineSignupForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTourSignup } from "@/lib/data";
import { useTour } from "../TourStateProvider";

export function InlineSignupForm() {
  const { session } = useTour();
  const router = useRouter();
  const signup = useTourSignup();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed right-4 top-4 z-40 rounded-full bg-primary-dark px-4 py-2 text-xs font-medium text-white shadow-lg"
      >
        Sign up to save →
      </button>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session.sessionId) return;
    try {
      const result = await signup.mutateAsync({
        email,
        password,
        tourSessionId: session.sessionId,
      });
      // Auto-confirmed dev path → land on celebrate immediately
      if (!result.needsEmailConfirmation) {
        const params = new URLSearchParams();
        params.set("phase", "celebrate");
        params.set("sessionId", session.sessionId);
        router.replace(`/tour?${params}`);
      }
    } catch {
      // error rendered below; nothing else needed here
    }
  };

  if (signup.isSuccess && signup.data?.needsEmailConfirmation) {
    return (
      <div
        id="signup-cta"
        className="mt-4 rounded-2xl border border-primary-light bg-gradient-to-b from-[#f8f9ff] to-white p-7"
      >
        <h3 className="text-xl font-semibold text-on-surface">
          Almost done — check your email
        </h3>
        <p className="mt-2 text-sm text-on-surface-variant">
          We sent a confirmation link to <strong>{email}</strong>. Click it to
          finish setting up your account. Your report is already saved and
          waiting for you.
        </p>
      </div>
    );
  }

  return (
    <form
      id="signup-cta"
      onSubmit={onSubmit}
      className="mt-4 rounded-2xl border border-primary-light bg-gradient-to-b from-[#f8f9ff] to-white p-7"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-on-surface">
            Save {session.market?.name?.split(",")[0] ?? "your market"}. Make
            another. Share with your client.
          </h3>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            Sign up free — keeps your demo report, removes the watermark,
            unlocks unlimited markets.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Dismiss signup"
          className="text-on-surface-variant/60 hover:text-on-surface-variant"
        >
          ✕
        </button>
      </header>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@brokerage.com"
          required
          autoComplete="email"
          className="min-w-[220px] flex-1 rounded-full border border-outline-variant bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a password"
          required
          autoComplete="new-password"
          minLength={8}
          className="min-w-[180px] flex-1 rounded-full border border-outline-variant bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={signup.isPending}
          className="rounded-full bg-primary-dark px-6 py-3 text-sm font-medium text-white transition hover:bg-primary disabled:opacity-60"
        >
          {signup.isPending ? "Saving…" : "Save my report →"}
        </button>
      </div>

      <ul className="mt-3.5 flex flex-wrap gap-4 text-xs text-on-surface-variant">
        {[
          "14-day Pro trial",
          "No credit card",
          "Unlimited markets",
          "Branded shareable links",
        ].map((b) => (
          <li
            key={b}
            className="flex items-center gap-1.5 before:font-bold before:text-[#00C853] before:content-['✓']"
          >
            {b}
          </li>
        ))}
      </ul>

      {signup.isError && (
        <p className="mt-3 text-xs text-[#B3261E]">{signup.error.message}</p>
      )}

      <p className="mt-3 text-[11px] text-on-surface-variant">
        By signing up you accept our{" "}
        <a href="/terms" className="text-primary">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-primary">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Mount in Step4Aha**

In `packages/frontend/app/tour/components/Step4Aha.tsx`, replace the `<div id="signup-cta" />` placeholder with `<InlineSignupForm />` (and import).

- [ ] **Step 3: Smoke test**

Walk the full flow. At step 4, fill email + password, submit. In dev (auto-confirm), expect redirect to `/tour?phase=celebrate&sessionId=…`. In prod-mode (`NODE_ENV=production` simulated), expect "check your email" message.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/tour/components/InlineSignupForm.tsx \
  packages/frontend/app/tour/components/Step4Aha.tsx
git commit -m "feat(tour): add InlineSignupForm with collapse + claim flow"
```

---

### Task 5: PostSignupCelebrate screen

**Files:**

- Create: `packages/frontend/app/tour/components/PostSignupCelebrate.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/frontend/app/tour/components/PostSignupCelebrate.tsx
"use client";

import Link from "next/link";
import { useTour } from "../TourStateProvider";

export function PostSignupCelebrate() {
  const { session, reset } = useTour();
  const marketShort = session.market?.name?.split(",")[0] ?? "your market";

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-dark to-primary p-9 text-center text-white">
        <div
          className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full bg-white/8 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-12 -bottom-12 h-48 w-48 rounded-full bg-[#00C853]/12 blur-2xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#00C853] text-2xl font-bold">
          ✓
        </div>
        <h1 className="relative mt-4 text-[26px] font-semibold leading-tight">
          Your {marketShort} report is saved
        </h1>
        <p className="relative mt-1.5 text-sm text-white/85">
          14-day Pro trial active. No watermark. Branded link ready to share.
        </p>

        <div className="relative mx-auto mt-5 flex max-w-sm items-center gap-3 rounded-xl bg-white px-4 py-3.5 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary-container text-lg">
            📄
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-on-surface">
              {session.market?.name ?? marketShort} · Listing Presentation
            </p>
            <p className="text-[11px] text-on-surface-variant">
              Saved to your account just now
            </p>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap justify-center gap-2.5">
          <Link
            href="/dashboard?openReport=latest"
            className="rounded-full bg-[#00C853] px-5 py-2.5 text-sm font-medium text-white"
          >
            Open my report →
          </Link>
          <Link
            href="/tour?resume=fresh"
            onClick={reset}
            className="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium"
          >
            Try another market
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into /tour page**

In `packages/frontend/app/tour/page.tsx`, replace the placeholder for `case 'celebrate'` with:

```tsx
case 'celebrate':
  return <PostSignupCelebrate />;
```

Add the import.

- [ ] **Step 3: Smoke test**

After signup completes, expect the celebrate screen with three CTAs. Click "Try another market" → tour resets and persona cards appear.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/tour/components/PostSignupCelebrate.tsx \
  packages/frontend/app/tour/page.tsx
git commit -m "feat(tour): add PostSignupCelebrate single-screen post-signup transition"
```

---

### Task 6: Auth callback claim path (email-confirm flow)

**Files:**

- Modify: `packages/frontend/app/auth/callback/page.tsx`

- [ ] **Step 1: Add claim hook into the existing callback**

Find the block in `app/auth/callback/page.tsx` around lines 130-160 (the `needsOnboarding` destination logic). Add the claim attempt BEFORE the destination computation:

```typescript
// Reuse a tour session if the user signed up via the inline form before
// confirming their email. The piq_tour_session cookie carries the sessionId.
let claimedReportId: string | null = null;
const tourSessionId = getCookie("piq_tour_session");
if (tourSessionId) {
  try {
    const claimRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/anonymous/claim`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tourSessionId }),
      },
    );
    if (claimRes.ok) {
      const body = await claimRes.json();
      claimedReportId = body.reportId ?? null;
      // Best-effort: refresh onboarding state so dashboard shows the saved report.
      debugLog("tour_claim", { tourSessionId, reportId: claimedReportId });
    }
  } catch (err) {
    debugLog("tour_claim_failed", { error: String(err) });
  }
}
```

Then update the destination to route to `/tour?phase=celebrate&sessionId=<id>` if a claim succeeded:

```typescript
const destination = claimedReportId
  ? `/tour?phase=celebrate&sessionId=${encodeURIComponent(tourSessionId!)}`
  : needsOnboarding
    ? explicitNext
      ? `/tour?next=${encodeURIComponent(explicitNext)}`
      : "/tour"
    : next;
```

- [ ] **Step 2: Smoke test**

Test in production-mode (set `NODE_ENV=production` env on the frontend dev process so signup requires email confirmation, OR just simulate by toggling Supabase project setting): generate report → submit signup → "check email" message → click email link → callback runs → claim succeeds → land on `/tour?phase=celebrate`.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/auth/callback/page.tsx
git commit -m "feat(auth): callback claims tour session on email-confirm flow"
```

---

### Task 7: SeoTourCta floating button

**Files:**

- Create: `packages/frontend/components/tour/SeoTourCta.tsx`
- Modify: blog/programmatic-SEO MDX layout (locate `app/blog/layout.tsx` or `content/layouts/`)

- [ ] **Step 1: Implement the CTA**

```tsx
// packages/frontend/components/tour/SeoTourCta.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Props {
  /** geoId of the market this page is about, e.g. "16740" */
  marketGeoId: string;
  marketGeoLevel: "metro" | "county" | "city" | "zip";
  marketName: string;
}

const STORAGE_KEY = "piq_tour_cta_dismissed";

export function SeoTourCta({ marketGeoId, marketGeoLevel, marketName }: Props) {
  const [persona, setPersona] = useState<"agent" | "investor" | "homebuyer">(
    "agent",
  );
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed && Number(dismissed) > Date.now() - 30 * 86400_000) {
      setHidden(true);
      return;
    }
    const t = setTimeout(() => setHidden(false), 1500); // appear after a beat to avoid feeling pushy
    return () => clearTimeout(t);
  }, []);

  if (hidden) return null;

  const params = new URLSearchParams({
    persona,
    market: `${marketGeoLevel}-${marketGeoId}`,
  });

  return (
    <aside
      className="fixed bottom-4 right-4 z-30 max-w-xs rounded-2xl border border-primary-light bg-white p-4 shadow-[0_12px_32px_rgba(57,73,171,0.18)]"
      role="complementary"
      aria-label="Take a 60-second tour"
    >
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, String(Date.now()));
          setHidden(true);
        }}
        aria-label="Dismiss"
        className="absolute right-2 top-2 text-on-surface-variant/60 hover:text-on-surface-variant"
      >
        ✕
      </button>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
        60-sec tour
      </p>
      <p className="mt-1 text-sm font-semibold text-on-surface">
        See what PropertyIQ shows you about {marketName}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["agent", "investor", "homebuyer"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPersona(p)}
            className={[
              "rounded-full border px-2.5 py-1 text-[11px] font-medium",
              persona === p
                ? "border-primary bg-primary text-white"
                : "border-outline-variant text-on-surface-variant",
            ].join(" ")}
          >
            {p === "agent"
              ? "Agent"
              : p === "investor"
                ? "Investor"
                : "Homebuyer"}
          </button>
        ))}
      </div>
      <Link
        href={`/tour?${params}`}
        className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-primary-dark px-4 py-2 text-xs font-medium text-white"
      >
        Start the tour →
      </Link>
    </aside>
  );
}
```

- [ ] **Step 2: Locate and update the SEO city-page layout**

Find the MDX layout that wraps programmatic SEO blog posts. Run:

```bash
ls packages/frontend/app/blog* packages/frontend/content/layouts/* 2>/dev/null
grep -rln 'content/blog\|MDXContent\|mdx-' packages/frontend/app | head -5
```

In whatever component renders an individual blog post (likely `app/blog/[slug]/page.tsx` or similar), inject `<SeoTourCta />` into the JSX. Pull `marketGeoId`, `marketGeoLevel`, `marketName` from the post frontmatter (most programmatic posts already have these — e.g., `geoId: "16740"`).

If the post doesn't carry market metadata, skip rendering the CTA on that post (gate via `if (post.market) {...}`).

- [ ] **Step 3: Smoke test**

Visit `http://localhost:3000/blog/charlotte-nc-real-estate-market-2026` (or whichever programmatic SEO URL exists). Wait ~1.5s. CTA appears bottom-right. Click "Investor" → "Start the tour" → lands on `/tour?persona=investor&market=metro-…`.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/components/tour/SeoTourCta.tsx \
  packages/frontend/app/blog/...   # whichever layout was modified
git commit -m "feat(seo): floating tour CTA on programmatic SEO city pages"
```

---

### Task 8: Manual end-to-end conversion test

- [ ] **Step 1: Restart dev cleanly**

```bash
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
npm run dev:fresh
```

- [ ] **Step 2: Walk the conversion path on desktop**

1. Visit a programmatic SEO blog post.
2. Wait for the floating CTA, click "Agent" → "Start the tour".
3. Land on `/tour?persona=agent&market=...`.
4. Either skip market picker (already pre-filled) or pick another.
5. Steps 1-3 spotlight tour → step 4.
6. Listing presentation renders. Inline signup form below.
7. Fill email + password (use dev mode so auto-confirm).
8. Submit → land on `/tour?phase=celebrate`.
9. Verify saved-report card visible. Click "Open my report" → dashboard with the report visible.

- [ ] **Step 3: Walk the conversion path on mobile**

Same flow, mobile viewport. Verify the inline signup form's bottom-fixed sticky behavior on small screens (this comes from CSS in InlineSignupForm — confirm it's not blocking content).

- [ ] **Step 4: Walk the dismissed-and-recovered path**

1. Generate report.
2. Click ✕ on the inline signup form.
3. Confirm form collapses to a "Sign up to save" pill button at top-right.
4. Click it → form reappears. Submit. Conversion completes.

- [ ] **Step 5: Commit any tweaks**

```bash
git add ...
git commit -m "fix(tour): <observation>"
```

---

## Acceptance criteria for Phase 05 done

- [ ] Inline signup form renders below the listing presentation at `#signup-cta`.
- [ ] Form submission in dev (auto-confirm) routes user to `/tour?phase=celebrate`.
- [ ] Form submission in prod-style (email confirmation) shows "check your email" message.
- [ ] Auth callback claims the tour session when `piq_tour_session` cookie is present.
- [ ] Claimed report appears in user's dashboard / `reports` table with `is_demo: false`.
- [ ] `onboarding_market` is set on the user_profiles row.
- [ ] Post-signup celebrate screen shows saved-report card + 3 CTAs.
- [ ] "Try another market" resets the tour and routes back to persona cards.
- [ ] SeoTourCta appears on programmatic SEO pages, persists dismissal for 30 days, and routes to `/tour` with persona+market pre-filled.
- [ ] Form dismiss → collapse → reopen path works.
- [ ] All Phase 05 jest + vitest specs pass.
- [ ] No new TypeScript errors in changed files.
