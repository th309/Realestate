# Lessons Learned

## Build Verification Must Fix ALL Errors Before Pushing

**Date:** 2026-02-26
**Context:** Ran `nest build` to verify a billing fix, saw 7 pre-existing errors in other files, dismissed them as "not my problem," and pushed. The deploy failed because those same errors broke the production build.

**Rule:** When verifying a build, if it fails, fix EVERY error before pushing — not just the ones from your change. A broken build is a broken build. "Pre-existing" doesn't matter; if it fails locally, it fails in CI/production. Never push code that doesn't build clean.

**Wrong behavior:**

- Run build, see errors in unrelated files
- Say "those are pre-existing, not from my change"
- Push anyway

**Correct behavior:**

- Run build, see ANY errors
- Fix all of them
- Verify build passes with zero errors
- Then push

## Never Hardcode Fallback Values for Config/Secrets

**Date:** 2026-02-26
**Context:** In stripe.service.ts portal configuration, wrote `this.config.get('FRONTEND_URL') || 'https://propertyiq.app'` — a hardcoded fallback for a config value. CLAUDE.md Section 1.2 explicitly forbids this: "NEVER hardcode fallback values for secrets (e.g., `process.env.KEY || 'default'`). The app MUST crash if a secret is missing."

**Rule:** When a config/env value is required, throw an error if it's missing. Never provide a default URL, key, or secret. This applies to ALL config reads, not just obvious secrets like API keys.

**Wrong behavior:**

- `config.get('FRONTEND_URL') || 'https://propertyiq.app'`
- `process.env.KEY || 'fallback'`

**Correct behavior:**

- Check for the value, throw `ServiceUnavailableException` if missing
- Or use a guard method like `getFrontendUrl()` that throws on null

## Read CLAUDE.md and lessons.md at Session Start — Every Time

**Date:** 2026-02-26
**Context:** Continued from a compacted session and jumped straight into implementation without re-reading CLAUDE.md or lessons.md. This led to violating the hardcoded fallback rule and pushing without full verification — mistakes that were explicitly documented in both files.

**Rule:** At the start of EVERY session (including continuations from compacted context), read `tasks/lessons.md` and re-familiarize with CLAUDE.md critical sections before writing any code. The compacted summary does not substitute for reading the actual rules.

## Barrel index.ts Files Are Exempt From the Line-Count Hard Limit

**Date:** 2026-02-26
**Context:** The PostToolUse lint hook flagged `lib/data/index.ts` at 343 lines as exceeding the 300-line hard limit for logic files. The file contains zero logic — every line is a re-export statement.

**Rule:** The CLAUDE.md Section 1.3 size limits apply to **logic files** (hooks, utils, helpers, services, types). A pure barrel `index.ts` whose entire content is `export { ... } from '...'` statements is exempt. Splitting it into sub-barrels adds indirection with no benefit. Do not act on the lint warning for pure barrel files.

**How to identify a pure barrel:** If deleting all the export lines would leave only comments and whitespace, it is a pure barrel.

## Dispatch Background Validation Agents After Implementing Features

**Date:** 2026-02-26
**Context:** Implemented billing portal plan switching (touched payments code), committed and pushed without dispatching the security-reviewer agent. CLAUDE.md Section 1.6 requires automatic background dispatch of security-reviewer when touching auth, payments, or secrets.

**Rule:** After implementing any feature, dispatch the relevant validation agents in the background BEFORE committing. Don't wait for the user to ask. Check the trigger table in CLAUDE.md Section 1.6.

## Never Leave Planned Work Incomplete — Especially Tests and Wiring

**Date:** 2026-02-27
**Context:** Built 95% of the analytics suite (all backend services, all sub-components, all fetchers) but left the Journeys and Retention tabs as "Coming Soon" EmptyState shells despite all sub-components being complete and ready to wire. Also skipped all 7 planned unit tests. The plan explicitly called for TDD — zero tests were written. The old duplicate analytics page was not cleaned up.

**Rule:** When a plan specifies tasks (wiring, tests, cleanup), complete ALL of them before moving on. The "last mile" (connecting components, writing tests, removing duplicates) is not optional — it's the difference between 80% done and actually done. Specifically:

1. **If sub-components are built, wire them up.** A "Coming Soon" placeholder next to fully-built sub-components is unfinished work, not a feature.
2. **If the plan says write tests, write tests.** "Tests" is not a nice-to-have that gets dropped when time runs short.
3. **If something is superseded, remove the old version.** Duplicate pages/components violate CLAUDE.md Section 1.1 and create confusion.
4. **Check the plan against the deliverables before declaring done.** Walk through every checkbox item and verify it actually exists and works.

## Verify Deploys Holistically Before Pushing — Not One Fix at a Time

**Date:** 2026-02-27
**Context:** Backend Railway deploy was blocked by a `next@15.1.2` CVE. Fixed it, pushed. Then it failed because `@propertyiq/emails` workspace package couldn't resolve. Fixed it, pushed. Then it failed because the emails package wasn't built. Fixed it, pushed. Then it crashed because `STRIPE_WEBHOOK_SECRET` was missing in the dev environment. Four separate deploy cycles, each taking 15+ minutes, when all four issues could have been caught in one local investigation.

**Rule:** When fixing a deploy failure, don't just fix the immediate error and push. Trace the FULL deploy path locally before pushing:

1. **Simulate the build environment.** Read the Dockerfile/Railpack config. Mentally walk through each step. What gets copied? What gets installed? What gets built?
2. **Check all workspace dependencies.** If a package depends on another workspace package, verify that package is included in the build AND gets built first.
3. **Check runtime requirements.** After build succeeds, check what the app needs at startup — env vars, secrets, connections. Use Railway MCP tools to verify env vars exist in the TARGET environment (not just production).
4. **Compare environments.** When deploying to dev/staging, compare its env vars against production. Missing vars in non-production environments are a common failure mode.
5. **One push, not four.** Batch all fixes into a single commit. The user should never have to wait for multiple deploy cycles for issues that were all discoverable upfront.

**Wrong behavior:**

- Fix error #1, push, wait 15 min, see error #2, fix, push, wait 15 min...

**Correct behavior:**

- Fix error #1, then ask: "What ELSE will break?" Check Dockerfile, workspace deps, build order, env vars across environments. Fix everything. Push once.

## Check Actual Runtime Data Before Reading Code — Use Your Tools

**Date:** 2026-02-27
**Context:** Backend crashed with `Base64Coder: incorrect characters for decoding` in the `standardwebhooks` Webhook constructor. Instead of immediately checking the actual `SUPABASE_WEBHOOK_SECRET` value in Railway (one MCP tool call), spent time reading source code, theorizing about base64 encoding, and building elaborate try/catch fallback logic. The root cause was that Supabase formats secrets as `v1,whsec_<base64>` — the `v1,` prefix contains a comma which is invalid base64. This was visible in the env var value the entire time.

**Rule:** When an error involves config, secrets, or environment variables, the FIRST action is to check the actual value in the deployed environment using available tools (Railway MCP, Supabase MCP, etc.). Don't read code and theorize — look at the data. The error message said "incorrect characters for decoding" — the immediate question should have been "what characters?" not "how should we handle various formats?"

**Wrong behavior:**

- Read controller source code
- Theorize about what format the secret might be in
- Build defensive code to handle multiple formats
- Eventually check the env var after multiple rounds

**Correct behavior:**

- Error says "incorrect characters for decoding" in Webhook constructor
- Immediately check: what is the actual value of `SUPABASE_WEBHOOK_SECRET` in Railway?
- See `v1,whsec_...` — comma is the invalid character
- Fix: strip the `v1,` prefix. Done.

## Railway Monorepo Deployment: railway.json Overrides Dashboard Settings

**Date:** 2026-02-27
**Context:** Backend deploy failed with a `packages/<sibling-package>/package.json: not found` error. The Dockerfile's COPY command couldn't find a file that existed in git. Root cause: `packages/backend/railway.json` caused Railway to set `root directory as 'packages/backend'`, limiting the Docker build context to that subdirectory — sibling packages were invisible. Previous COPY steps succeeded only from stale Docker layer cache.

**The cascade:**

1. Removed railway.json's root directory override → Railway fell back to Railpack (auto-builder) instead of Dockerfile
2. Railpack tried to build entire monorepo, frontend OOM'd at 733MB
3. Set Dockerfile builder in dashboard → build succeeded but wrong start command
4. Railpack auto-detection had left `node dist/main.js` as custom start command, overriding Dockerfile's `CMD ["node", "packages/backend/dist/main.js"]`

**Rules:**

1. **Never put `railway.json` in a subdirectory for monorepo services.** It overrides the dashboard root directory setting, limiting Docker build context to that subdirectory.
2. **Set an explicit Custom Start Command for backend services in Railway.** Railway may not respect the Dockerfile's CMD if a previous Railpack build cached a start command. Backend needs `node packages/backend/dist/main.js`. Frontend works without a custom start command (Dockerfile CMD is respected).
3. **For monorepo Dockerfile builds, set ALL config in the Railway dashboard** — Builder: Dockerfile, Dockerfile Path, and Custom Start Command matching the Dockerfile's CMD.
4. **When debugging Docker COPY failures, check what the build context actually is.** The `root directory set as '...'` line in Railway build logs tells you exactly what Docker can see.

## Verify Table Names Against Actual Database Before Writing Backend Services

**Date:** 2026-03-27
**Context:** HealthSnapshotService queried a `data_source_registry` table that was never created in Supabase, resulting in 0 rows being recorded to `admin_health_snapshots` for the entire lifetime of the cron job. Additionally, `DATA_SOURCE_TABLE_MAP` referenced 7 nonexistent tables (`census_acs_metro`, `bls_metro`, `fred_national`, `hud_fmr_county`, `building_permits_metro`, `redfin_metro_sales`, `redfin_metro_rental`). The `UserSnapshotService` referenced `profiles` (doesn't exist, actual table is `user_profiles`) and `user_entitlements` (doesn't exist, tiers are on `user_profiles.subscription_tier`). Column types were also wrong (`days_since_update` sent as `null` but DB column is NOT NULL).

**Rule:** Before writing any backend service that reads from Supabase:

1. **Query `information_schema.tables` to verify the table exists.** Use the Supabase MCP tool. Don't assume table names from memory or from other services that may also be wrong.
2. **Query `information_schema.columns` to verify column names and nullability.** A NOT NULL column that receives null will cause silent insert failures.
3. **Cross-reference with working services.** If a health check endpoint already works (e.g., `DataSourcesHealthService`), its table names are proven correct -- use those, not guessed names.
4. **When a cron job produces 0 output, check the data source first.** The service was silently returning `[]` because the initial query failed -- the rest of the logic was irrelevant.

## One Data-Layer Path Per Admin API Surface (Hermeneutic Whole)

**Date:** 2026-04-27

**Context:** Fixing content-pipeline delete used `fetchAPIRaw` → same-origin Next proxy only. Dashboard still used `fetchAPI` → cross-origin Nest. Split behavior is invisible in isolation but breaks sibling features (CORS/env) and violates CLAUDE §1.0 re-evaluate-the-whole.

**Rule:** When introducing a proxy or alternate base URL for an API prefix (`/api/admin/content-pipeline/*`), update **every** fetch helper that serves that prefix (`fetchAPI`, `fetchAPIWithParams`, `fetchAPIRaw`) to share **one** URL resolver. Then grep consumers and smoke-test adjacent pages (dashboard + review + settings) in one pass.
