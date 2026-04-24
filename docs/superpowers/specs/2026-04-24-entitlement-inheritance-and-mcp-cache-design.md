# Entitlement Inheritance + MCP Cache Invalidation — Design

**Date:** 2026-04-24
**Status:** Draft (pre-implementation)
**Author:** Claude (session w/ th309)
**Related:** `packages/mcp-server/src/lib/oauth/entitlements-cache.ts`, `packages/backend/src/entitlements/entitlements.service.ts`, `packages/backend/src/org-billing/`, `packages/backend/src/organizations/`

---

## 1. Summary

Two connected problems, one PR:

- **Problem 1 — Org tier does not propagate to members.** Enterprise org members do not currently inherit `feature:mcp_access` (or any other paid entitlement) from their org. The entitlements resolver reads only `user_profiles.subscription_tier`, and nothing writes that column on invite-accept/member-add paths. Paid org → free members.
- **Problem 2 — mcp-server caches entitlement decisions for 60 min.** When a user's entitlement changes (upgrade, seat assignment, org plan change), the mcp-server keeps serving the stale decision for up to an hour. Free user upgrades to Pro → 403s for the next 60 minutes because the server still has `allowed=false` cached in-process.

Both get fixed together because (a) the invalidation signal from Problem 2 only becomes meaningful once Problem 1 is fixed (today's org-based mutations don't affect any member's effective entitlement, so there's nothing to invalidate), and (b) the architectural choice for Problem 1 (read-through resolver) directly shapes which mutation sites need invalidation wiring.

## 2. Out of scope

- Stripe webhook → backend sync is assumed correct. This design doesn't change how personal `user_profiles.subscription_tier` gets updated.
- Multi-org membership: current DB-level constraint (`idx_org_members_single_org`) keeps a user in at most one org at a time. No change.
- Admin UI for tier inheritance, analytics around it, billing reconciliation: separate.
- More than one paid org plan: today's product is Free → Pro (personal) + Enterprise (org). When a second paid org plan appears, the `organizations.tier` column is the extension point; no structural rework needed.

## 3. Problem 1 — Org-tier entitlement inheritance (P2-Y)

### 3.1 Approach

**Read-through resolver.** The entitlements service computes effective tier at request time. The resolution order matches current behavior with one new step inserted:

1. If an active row exists in `user_trials` → use `trial.tier` (unchanged).
2. Else: resolve `personal_tier` from `user_profiles.subscription_tier` + `subscription_status` (unchanged).
3. **New:** resolve `org_tier` from an active membership in an org with active billing (see 3.3). Effective tier becomes `max(personal_tier, org_tier)` under the precedence `enterprise > pro > free`.
4. If effective tier is still `'free'` after (1)–(3), consult the `admin_users` fallback as today — any row with role `admin` or `super_admin` bumps to `'admin'`. This preserves the existing semantic that `admin_users` is a staff-access fallback for users who don't have a paid tier through any other path, not a top-of-stack override.

No write-through. No new columns on `user_profiles`. Joining an org does not mutate the member's personal tier; leaving an org does not mutate it either.

### 3.2 `organizations.tier` column

Migration adds a single column:

```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'enterprise'
  CHECK (tier IN ('enterprise'));
-- Backfill is a no-op because DEFAULT 'enterprise' covers all existing rows
-- on add-column, and the CHECK enforces the current single-tier reality.
-- When a second paid org tier is introduced, relax the CHECK and update writers.
```

**Rationale:** `organizations` has no `tier` column today. Org "enterprise-ness" is currently derived from `billing_status = 'active'` + the owner's personal tier at create time. Adding a dedicated column makes the resolver query clean and makes multi-tier expansion a one-line change later.

### 3.3 Resolver query

In `entitlements.service.ts checkAccess`, alongside the existing tier resolution, add:

```ts
const { data: orgMembership } = await this.supabase
  .getClient()
  .from("organization_members")
  .select("organizations!inner(tier, billing_status)")
  .eq("user_id", userId)
  .eq("status", "active")
  .eq("organizations.billing_status", "active")
  .maybeSingle();

const orgTier = (orgMembership?.organizations as any)?.tier ?? null;
```

Then compute `effectiveTier = max(trialTier, personalTier, orgTier, adminTier)` by precedence. The existing Redis cache key (`entitlements:tier:{tier}:{resourceKey}`) is unaffected because it's keyed on the _resolved_ tier.

### 3.4 Writer for `organizations.tier`

Two sites:

- **`organizations.service.ts create`** — explicitly set `tier: 'enterprise'` on insert.
- **`org-billing-webhook.service.ts`** — no writes today; the column is constant while only Enterprise exists. Future: write from Stripe price metadata when a second plan appears.

### 3.5 Downgrade-handler bug fix (in scope)

`org-downgrade-handler.service.ts handleDowngrade` currently writes `subscription_tier` for members and owner alike (lines 69–95). This clobbers personal subscriptions for anyone who had one before joining, and is the wrong mental model under P2-Y. With read-through, member tiers are computed dynamically from (personal, org) — the handler does not need to touch personal tier at all.

Fix: **remove `subscription_tier` writes from the downgrade handler.** Keep:

- Revoke `api_enabled`, `embed_enabled` on the org
- Flip `billing_status` to `'canceled'` (or `'active'` on partial downgrade)
- Clear `organization_id`, `organization_role` on non-owner members
- Delete non-owner membership rows
- Audit log
- Notification emails

Dropping the `subscription_tier` writes means that (a) members who had personal Pro before joining keep it, (b) the owner's personal tier is untouched by org state — those are separately managed by `billing-webhook.service.ts` events. The resolver recomputes effective tier on the next entitlement check.

## 4. Problem 2 — mcp-server cache invalidation (P1)

### 4.1 TTL split

In `packages/mcp-server/src/lib/oauth/entitlements-cache.ts`:

```ts
const POSITIVE_TTL_MS = 5 * 60 * 1000; // 5 min
const NEGATIVE_TTL_MS = 30 * 1000; // 30 s
```

Cache entries are stamped with the appropriate TTL based on the `allowed` value. Correctness floor without any invalidation: worst-case 30 s stale denial after upgrade. Backend load: at most one entitlement check per Pro user per 5 minutes.

### 4.2 Invalidation endpoint

New route mounted in `http.ts`:

```
POST https://mcp.propertyiq.app/internal/entitlements/invalidate
Authorization: Bearer ${MCP_INTERNAL_SECRET}
Content-Type: application/json

{"userIds": ["uuid", ...]}

→ 200 {"invalidated": N}
→ 401 if secret missing/mismatched
→ 400 if body.userIds is not an array
```

Auth: shared-secret bearer (new env var `MCP_INTERNAL_SECRET`, set identically on `backend` and `mcp-server` in each environment). HTTPS + shared secret is sufficient because the action is idempotent, the payload is non-sensitive (just userIds), and failure is non-destructive (30 s TTL absorbs it).

Backed by a new cache helper:

```ts
export function invalidateMany(userIds: string[]): number {
  let count = 0;
  for (const id of userIds) if (cache.delete(id)) count++;
  return count;
}
```

The route is registered inline in `http.ts` alongside the existing `mountOAuthRoutes(app)` / `mountApiRoutes(app)` calls (not via either of those helpers). It uses its own constant-time secret check and does NOT participate in `extractAuth` (which is for user-level OAuth). The existing host-allowlist guard already admits `mcp.propertyiq.app`; no additional exemption needed.

### 4.3 Backend invalidation client

New: `packages/backend/src/entitlements/mcp-entitlements-invalidator.service.ts`.

```ts
@Injectable()
export class McpEntitlementsInvalidator {
  private readonly url =
    process.env.MCP_SERVER_URL ?? "https://mcp.propertyiq.app";
  private readonly secret = process.env.MCP_INTERNAL_SECRET;
  private readonly logger = new Logger(McpEntitlementsInvalidator.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async invalidate(userIds: string[]): Promise<void> {
    if (!this.secret || userIds.length === 0) return;
    try {
      await fetch(`${this.url}/internal/entitlements/invalidate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userIds }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (err) {
      this.logger.warn(
        `MCP invalidate failed (best-effort): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async invalidateOrgMembers(orgId: string): Promise<void> {
    const { data } = await this.supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("status", "active");
    await this.invalidate((data ?? []).map((m: any) => m.user_id));
  }
}
```

Registered in `entitlements.module.ts` and injectable into `BillingWebhookService`, `OrgBillingWebhookService`, `InvitesService`, `MembersService`.

### 4.4 Call sites

| File                             | Method                                                               | Call                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `billing-webhook.service.ts`     | `handleCheckoutComplete`                                             | `invalidate([userId])`                                                                                                       |
| `billing-webhook.service.ts`     | `handleSubscriptionUpdated`                                          | `invalidate([userId])`                                                                                                       |
| `billing-webhook.service.ts`     | `handleSubscriptionDeleted`                                          | `invalidate([userId])`                                                                                                       |
| `billing-webhook.service.ts`     | `handleInvoicePaid`                                                  | `invalidate([userId])`                                                                                                       |
| `billing-webhook.service.ts`     | `handlePaymentFailed`                                                | `invalidate([userId])`                                                                                                       |
| `org-billing-webhook.service.ts` | `handleCheckoutComplete`                                             | `invalidateOrgMembers(orgId)`                                                                                                |
| `org-billing-webhook.service.ts` | `handleSubscriptionUpdated`                                          | `invalidateOrgMembers(orgId)`                                                                                                |
| `org-billing-webhook.service.ts` | `handleSubscriptionDeleted`                                          | `invalidateOrgMembers(orgId)` — captured BEFORE the downgrade handler deletes membership rows, so the list is still complete |
| `org-billing-webhook.service.ts` | `handleInvoicePaid`                                                  | `invalidateOrgMembers(orgId)`                                                                                                |
| `org-billing-webhook.service.ts` | `handlePaymentFailed`                                                | `invalidateOrgMembers(orgId)`                                                                                                |
| `invites.service.ts`             | `acceptInvite` (after successful membership insert + profile update) | `invalidate([userId])`                                                                                                       |
| `members.service.ts`             | `removeMember` (after `organization_id` cleared)                     | `invalidate([userId])`                                                                                                       |

Each call is `await`-ed-with-catch: the Promise is awaited so tests observe its resolution, but any error is swallowed by `McpEntitlementsInvalidator.invalidate`'s internal try/catch. Webhook handlers always return 200 to Stripe.

**Deliberately not wired:**

- `members.service.ts changeRole` — role (`admin` ↔ `member`) does not affect effective tier under P2-Y.
- `organizations.service.ts create` — the creator already has personal Enterprise tier (gated by `organizations.service.ts:50-56`), so their effective tier doesn't change when they become the org's first member.

## 5. Implementation plan

### 5.1 Files

**Migration:**

- `scripts/migrations/<next-sequential>-add-organizations-tier.sql` — adds the `tier` column + check constraint. Pick the next available number at implementation time (latest observed at design time: 119). Idempotent via `IF NOT EXISTS` so re-runs are safe.

**mcp-server (no backend deps):**

- `packages/mcp-server/src/lib/oauth/entitlements-cache.ts` — TTL split, `invalidateMany`.
- `packages/mcp-server/src/http.ts` — mount `POST /internal/entitlements/invalidate` with shared-secret guard.

**Backend:**

- `packages/backend/src/entitlements/entitlements.service.ts` — add org-tier lookup + precedence max.
- `packages/backend/src/entitlements/mcp-entitlements-invalidator.service.ts` — new.
- `packages/backend/src/entitlements/entitlements.module.ts` — register invalidator; export for reuse.
- `packages/backend/src/organizations/organizations.service.ts` — set `tier: 'enterprise'` on create.
- `packages/backend/src/organizations/invites.service.ts` — call `invalidate([userId])` after successful accept.
- `packages/backend/src/organizations/members.service.ts` — call `invalidate([userId])` on remove.
- `packages/backend/src/billing/billing-webhook.service.ts` — 5 call-site edits.
- `packages/backend/src/org-billing/org-billing-webhook.service.ts` — 5 call-site edits; ensure member expansion happens before downgrade handler deletes membership rows.
- `packages/backend/src/org-billing/org-downgrade-handler.service.ts` — **remove** the `subscription_tier` writes (lines ~70–95), leaving `organization_id` clear + member deletion + feature-flag revoke.
- Modules that consume the invalidator need it in their providers list.

### 5.2 Environment variables (Railway — prod and dev)

- `MCP_INTERNAL_SECRET` — new, random 32-byte hex. Set identically on `backend` and `mcp-server` within each environment. Different values per environment (prod vs dev).
- `MCP_SERVER_URL` on `backend` — optional; defaults to `https://mcp.propertyiq.app` if absent. Set explicitly in dev if dev mcp-server runs under a different host.

### 5.3 Rollout order

1. **Migration.** Deploy the `organizations.tier` migration. Safe — adds a column with a sensible default, no existing code reads it yet.
2. **mcp-server.** Ship TTL split + invalidation endpoint + `MCP_INTERNAL_SECRET`. Endpoint is dormant until backend calls it. Visible user-facing effect: upgrade→access worst case drops from 60 min to 30 s.
3. **Backend.** Ship P2-Y resolver, invalidator, call sites, downgrade-handler fix, matching `MCP_INTERNAL_SECRET`. Behavior change on merge: Enterprise org members start resolving to their org's tier effective immediately. This is the intended behavior (fixing a latent bug), so no feature flag.

All three deploys are independent. Order matters only in that the backend PR depends on the mcp-server endpoint and the migration, so prefer `migration → mcp-server → backend` but the backend will not _crash_ if mcp-server hasn't shipped yet — it will just log warnings on each invalidate attempt.

## 6. Testing

### 6.1 mcp-server

- `entitlements-cache.spec.ts`: positive and negative TTLs applied correctly; `invalidateMany` deletes and returns count; missing entries are no-ops.
- `http.spec.ts` (integration): POST to `/internal/entitlements/invalidate` with no `Authorization` → 401. With wrong secret → 401. With correct secret but non-array body → 400. With valid payload → 200 + expected count. Confirm endpoint works _even when `extractAuth` would 401 on the same request_ (i.e., it does not participate in OAuth).

### 6.2 Backend entitlements resolver

- `entitlements.service.spec.ts`:
  - User with only personal `subscription_tier='free'` and no org membership → resolves `free`.
  - User in active-billing org (`tier='enterprise'`) with personal free → resolves `enterprise`.
  - User in `billing_status='past_due'` org → does NOT inherit (only `active` counts).
  - User in active org with personal Pro → resolves `enterprise` (max wins).
  - User with admin_users row + active org → resolves `admin` (still wins).
  - User in `status='pending'` membership → does NOT inherit.

### 6.3 Invalidator service

- `McpEntitlementsInvalidator` unit: `invalidate([])` no-ops silently; `invalidate([id])` POSTs with bearer; fetch rejection is caught, no re-throw; `invalidateOrgMembers` expands correctly against a mocked supabase response.

### 6.4 Webhook + service integrations

- For each of the 12 call sites: an integration test that triggers the event (mock Stripe event or service call) and asserts `invalidator.invalidate` / `invalidateOrgMembers` was called with the expected argument shape. `fetch` itself mocked.

### 6.5 Downgrade-handler fix

- `org-downgrade-handler.spec.ts`: after downgrade, non-owner member profiles retain their pre-existing `subscription_tier` (pro or otherwise), but `organization_id` and `organization_role` are cleared, and the membership row is gone. Owner profile is untouched in `subscription_tier`. Org flags (`api_enabled`, `embed_enabled`, `billing_status`) flip as before.

### 6.6 End-to-end smoke (manual, post-deploy)

- Free user triggers MCP call → 403.
- Free user upgrades to Pro via personal Stripe Checkout.
- Within 30 s (or instantly via invalidation): MCP call → 200, tools return.
- Enterprise org admin invites a free user; user accepts invite.
- Within 30 s: invited user's MCP call → 200 (inherited from org).
- Owner cancels org sub; non-owner member's personal Pro is retained; their MCP access drops to whatever their personal tier allows; effect visible within 30 s.

## 7. Observability

- mcp-server: existing `[Auth:Entitlements]` logs remain. Add `[MCP] Invalidate | count=N | status=<deleted|not_found>` on each endpoint call.
- Backend invalidator: one-line warn on every failure (`MCP invalidate failed`). No info-log on success to keep logs quiet — invalidation is the expected case.
- Counters on the backend for invalidation attempts/failures could come later; not needed for v1.

## 8. Risks and trade-offs

- **Fail-open on mcp-server entitlement check** remains (line 57–62 of `entitlements-cache.ts`, not changed by this design). If the backend entitlements endpoint is unreachable, mcp-server allows access. Acceptable for now; call out separately if auditors raise it.
- **Invalidation is best-effort.** If the backend → mcp-server HTTP call fails silently (dropped packet, timeout, mcp-server down), the 30 s TTL is the correctness floor. A user who upgrades during a momentary outage will experience up to 30 s of continued denial. Acceptable per the `B` choice we made for acceptable latency.
- **Read-through resolver cost.** Each uncached entitlement check now does one extra supabase query. The backend's tier-keyed Redis cache absorbs the vast majority of checks (any two Pro users asking for the same resources hit the same cached row). Worst case is a cache miss, which runs one additional simple indexed join. Not a concern at current scale and unlikely to be at any realistic scale.
- **Single-row org membership assumption.** If the `idx_org_members_single_org` constraint is ever relaxed to allow multi-org membership, the resolver's `.maybeSingle()` breaks. Callers and tests should document that this design depends on the single-org invariant.

## 9. Open questions at spec time

- None remaining. Org tier source resolved (new column), downgrade handler scope resolved (included). Proceed to implementation plan.
