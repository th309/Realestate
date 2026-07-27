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

## Mocked Unit Tests Hide Backend↔Frontend Contract Gaps — Verify Render With Real Data

**Date:** 2026-06-16
**Context:** Fixing the tour aha-finale (`Step4Aha`) authed path. The four-part fix (authed JWT endpoint + fetcher/hook + name-clobber fix + E2E un-skip) was correct and the new endpoint returned a valid 201 report (confirmed via curl AND the Playwright trace). But the E2E still failed: the report **render** crashed with `Cannot read properties of undefined (reading 'map')` in `ExecutiveSummary.tsx`. Root cause was pre-existing and totally independent of the fix: the backend `ListingPresentationService` emits section `data` shapes that DO NOT match what the `listing-sections/*` components expect (`ExecutiveSummary` needs `thesisParagraphs: string[]` + a mapped `score`; backend sends `{ score: <raw ScoreResult>, thesis: <string> }`). 9 of 10 section components hard-crash on real data; 4 backend sections emit `data: {}` with `limitedData:false` so their guards never fire. This was invisible because (a) every section's unit test mocked the _ideal_ prop shape (`ListingPresentation.test.tsx`'s `makeReport` fabricates `thesisParagraphs`/`recommendation` the backend never sends), and (b) the only test that used real data — the E2E — was `.skip`ped.

**Rule:** A green unit suite that mocks the data contract proves NOTHING about real integration. When a component renders server-produced data, verify the render against the ACTUAL backend payload (live call, trace, or curl the endpoint and diff the JSON shape against the component's prop interface) BEFORE declaring the feature works. If the only real-data test is skipped, the contract is unverified by definition — treat a skipped E2E as a red flag that the happy path may never have run end-to-end. When un-skipping such a test surfaces a large pre-existing gap (here: a 10-section adapter + 4 unpopulated backend sections), STOP and report NEEDS_CONTEXT with the precise crash + scope rather than silently inventing transforms.

## `next build` Can No Longer Clobber the Dev Server — Dev Lives in `.next-dev`

**Date:** 2026-06-27

**Context:** "Several errors after a build" was the frontend `next dev` wedged (port LISTENING but HTTP 000 — accepts the socket, never answers) because a `next build` had written into the dev server's `.next` dir. All four browser errors were `Failed to fetch` whose stack top was the ad blocker's `injectScriptAdjust.js` `window.fetch` wrapper — but they were downstream of that one wedge; the extension frames were _surfacing_ a real outage (same-origin RSC `<Link>` nav, `/backend` proxy, entitlements), not causing it. ~2 hours were lost because the symptom looked like ignorable ad-blocker noise even though the fix was already documented.

**Rule (structural fix, now in place):** `next dev` (NODE_ENV=development) writes to `.next-dev`; `next build`/`next start` (production) write to `.next`. So a default `npm run build` can never wedge a running dev server, no matter who runs it or from which terminal (a hook only gates Claude's own commands, not yours). Set in `packages/frontend/next.config.mjs` (`distDir` branches on NODE_ENV); `scripts/dev-start.sh` wipes `.next-dev`; gitignore/tsconfig/eslint follow. The `.claude/hooks/guard-bash.js` build guard is defense-in-depth: still ASKs on plain builds, hard-DENIES any build aimed at `.next-dev`. For a throwaway verification build, `NEXT_DIST_DIR=.next-verify npm run build -w web` still works.

**Rule (diagnostic discipline):** A `Failed to fetch` whose stack top is `chrome-extension://…/injectScriptAdjust.js` wrapping `window.fetch` can be ad-blocker noise OR a real outage the extension is merely surfacing. NEVER dismiss it on sight — curl the endpoint **server-side** (browser bypassed) first. `LISTENING` ≠ healthy: a curl `000` on a live listener = wedged; a `200` with a ~21-byte body, or one that flips to 500 on re-hit, = broken. Re-hit routes 3–5× before declaring green (the first 200 can be a pre-failure/stale compile).

## Never `git stash push -- <pathspec>` with an untracked path, and never blind `git stash pop`

**Date:** 2026-07-01
**Context:** To confirm a test failure was pre-existing, I ran `git stash push -m msg -- fileA fileB newFile.ts` where `newFile.ts` was **untracked**. Git aborted the whole stash ("pathspec did not match") — so my edits were NOT stashed. I then ran `git stash pop` anyway, which popped the **user's** unrelated stash@{0} onto my tree and left a merge conflict (`scripts/dev-start.sh` UU + a staged `package.json`). Recovery took several careful steps.

**Rule:**

- `git stash push -- <pathspec>` silently aborts if ANY listed path is untracked. To stash new files you must `git add` them first, or don't include them. Verify with `git stash list` that YOUR stash was actually created (check the message) before assuming it worked.
- NEVER run a bare `git stash pop` in a repo you don't own the stash state of — it pops `stash@{0}`, which may be the user's. Always `git stash list` first and pop by explicit ref only if it's yours.
- To A/B a pre-existing failure without stash risk: copy the file aside, `git checkout HEAD -- file`, run the test, then restore the copy. Or just reason from the diff (`git diff --stat` proving you never touched the failing code path).
- Recovery when a stash-pop conflicts on files you didn't touch: the popped stash is KEPT; restore each conflicted/staged file to HEAD (`git restore --staged --worktree <f>` / `git checkout HEAD -- <f>`) — the content stays safe in the stash for its owner to re-apply.

## Interactive SQL Validation Does Not Validate the Same SQL as a Function

**Date:** 2026-07-11
**Context:** Planned a Postgres RPC (`get_metro_score_heatmap`) by running the packing query interactively against production — it returned in seconds, so the plan declared the SQL "verified." Wrapped in a `LANGUAGE sql` function, the identical query hung indefinitely: the planner re-evaluated an expensive CTE (`ST_PointOnSurface` over 935 geometries) once per cross-join row (285k GEOS calls) instead of once. One `AS MATERIALIZED` keyword fixed it with zero semantic change.

**Rule:** Testing a raw query interactively does NOT validate it as a function/RPC. CTE inlining and plan choices differ inside function bodies and across parameterization. Before declaring RPC SQL "verified," CREATE the function (in a scratch schema if needed) and CALL it. For any CTE containing an expensive per-row function referenced inside a join/cross-join, default to `AS MATERIALIZED`.

**Debugging tip that worked:** a hanging RPC through PostgREST/MCP surfaces as generic `fetch failed`; force `SET statement_timeout = '15s'` first so Postgres returns the REAL error (here: `GEOS InterruptedException` inside `lwgeom_pointonsurface`), which names the guilty function immediately.

## Responsive Fix ≠ No Overflow — Key Data Must Be Visible and Scroll Must Be Discoverable

**Date:** 2026-07-12
**Context:** Fixed the screener's mobile width blowout (flex `mx-auto` container disabling stretch → page laid out at the table's 941px intrinsic width, clipped by `overflow-x-clip`). Verified "no overflow" geometrically and declared it good. User immediately flagged two misses: the Δ score-change column — a core signal — sat just off-screen behind the in-card scroll, and nothing indicated more columns existed (mobile hides scrollbars).

**Rule:** For any mobile/responsive fix on data-dense UI, "nothing overflows the viewport" is only the first gate. Also verify: (1) the decision-critical columns/fields fit in the initial viewport without scrolling, and (2) any intentional horizontal scroll region has a visible affordance (edge fade, chevron, or peeking column) that appears/disappears with scroll position. Judge the result as a user seeing the screen, not as a bounding-box measurement.

**Wrong behavior:**

- Measure `scrollWidth <= clientWidth`, declare mobile fixed
- Leave key data one invisible swipe away with no cue it exists

**Correct behavior:**

- Rank the table's columns by decision value; make the top ones fit the phone viewport (tighter padding, responsive min-widths)
- Add a scroll affordance for the rest (ScrollShadowContainer pattern: fade + chevron, driven by scrollLeft/scrollWidth)
- Screenshot at real device widths and read it as a user would before claiming done

## Parallel Agents Sharing One Git Worktree Race on the Index

**Date:** 2026-07-12
**Context:** Two parallel implementers in the same worktree: agent A ran `git add -- <its files>` then `git commit` as separate commands; between them agent B's staged files entered the shared index and were swept into A's commit (d376dff5 carried two tasks' work). No data loss, but per-task review diffs broke and had to be reconstructed by file subsets.

**Rule:** In a shared worktree with concurrent committers, staging and committing must be atomic per agent: use `git commit -m "..." -- <explicit paths>` as ONE command (pathspec commit ignores other staged entries), never `git add` + bare `git commit` as separate steps. Reviewers must verify each commit's `--stat` matches the task's ownership list.

**Also observed same session:** stop-hooks attribute the user's parallel main-checkout WIP to the session (verify with `git status` on the flagged paths before dispatching validators); piping a long-running dev server through `head` wedges it when the pipe closes (redirect to a file instead).

## Verification and Review Fan Out in Parallel — Even Mid-Fix

**Date:** 2026-07-12
**Context:** Finishing a handoff's in-flight fix, I ran lint → build → tests → tsc → live curl serially in the main context, one tool call after another. User interrupted: "dude...use multiple agents." The implementation edits were genuinely sequential (each shaped the next), but everything after the last edit — vitest suites, tsc, live render checks, code-reviewer, data-layer-reviewer — was independent and should have been one parallel dispatch.

**Rule:** The moment the last edit lands, STOP running verification serially. Batch all independent checks (test suites, typecheck, live E2E, §1.6 reviewers) into a single multi-Agent dispatch. "I'm almost done, one more quick check" is the tell — that's when to fan out, not grind on.

**Wrong behavior:** edit → run lint → wait → run build → wait → run tests → wait → curl → wait → then dispatch reviewers.

**Correct behavior:** edit → one message dispatching verify-tests, verify-live, code-reviewer, data-layer-reviewer in parallel → integrate results.

## Shared-Trunk Restructures Must Land the Final Safe Shape in the FIRST Commit

**Date:** 2026-07-12
**Context:** A file-tree split created `components/ui/skeleton/` next to `Skeleton.tsx` — a Windows case-collision landmine (TS1261). It was "temporary" (renamed to `skeleton-parts/` 4.5 minutes later), but within that window a concurrent agent wrote the natural bare import `@/components/ui/skeleton` against it, producing a 31-error typecheck storm. A reviewer watched it happen live.

**Rule:** On a trunk being edited by multiple concurrent agents, an intermediate hazardous state is NOT temporary — someone will build against it within minutes. Any restructure with a known collision risk (case-insensitive dir/file overlap, renamed exports, moved barrels) must land the final safe name/shape in its first commit. Never sequence "create hazardous state → fix → clean up" as separate commits on a live shared branch.

**Related pipeline gap (ticket):** `ignoreBuildErrors: true` in next.config + eslint-only frontend CI + Linux CI runners = NO pipeline stage catches TypeScript errors at all (including case collisions). Only local tsc/IDE does.

## One Owner Per Module; Only the Lead Assigns Tasks

**Date:** 2026-07-25
**Context:** During the content-pipeline completion round, task #13 was assigned by one agent (backend-foundation-2) to another (backend-foundation) — and then the delegating agent ALSO built the entire task itself in parallel. Both agents edited the same content-pipeline files in the shared working tree, clobbering each other's edits. Separately, an agent-to-agent assignment of task #14 landed in the wrong agent's inbox and stalled work until ownership was resolved. This also explains why ordered fixes (e.g. the getBrowser launch-race guard) repeatedly appeared "not landed" on disk after being reported complete — parallel same-file edits were overwriting each other.

**Rules:**

- Only the team lead assigns, transfers, or reassigns tasks. Agents who think work should move propose it to the lead; they never task each other directly.
- One owner per backend module per round. Parallelism runs ACROSS modules (content-pipeline vs social-connect vs frontend), never within one module's files.
- A delegating agent must never also build the delegated work. Delegate OR build, never both.
- Lead verifies "complete" reports against disk (grep the actual fix) before accepting — completion messages routinely cross in-flight fix orders.

## Deliverables Beat Ceremony — Review Post-Hoc on Sample/Demo Work

**Date:** 2026-07-26
**Context:** User waited over an hour for 5 sample images while the lead ran a per-batch review-relay loop (every stop-hook → reviewer → findings → relay → fix → re-verify) on a SAMPLES pipeline. Reviews caught real bugs (fabricated as-of date, missing timeouts) but most findings were polish (doc comments, consolidation, style) that gated pixels the user was actively waiting for. User: "what in the ever loving fuck are you doing?"

**Rule:** When the user is waiting on a visible artifact (samples, demos, previews — anything not shipping to production), the ONLY pre-ship gates are factual correctness (real data, no wrong-subject media, no fabricated numbers/dates/claims). Everything else — style, dedup, docs, hygiene — accumulates into ONE post-hoc cleanup pass after the artifact is in the user's hands. Per-batch review relays are for production-bound code only. Ship increments the moment they exist; never batch deliverables behind polish.

## Waiting Is Work to Delegate — One Agent Per Independent Artifact

**Date:** 2026-07-26
**Context:** Five NotebookLM infographics were generating concurrently. The lead sat in a foreground PowerShell poll loop watching all five statuses. User interrupted: "USE multiple agents whenever practical." The 2026-07-12 fan-out lesson covered parallel verification after edits; this extends it to waits: polling, downloading, delivering, and fact-checking N independent artifacts is N independent pipelines, not one loop.

**Rule:** Whenever 2+ independent work items exist — including "just waiting" chores like polling generation jobs, downloading artifacts, or per-file checks — dispatch one agent per item in a single message, each owning its item's full chain (poll → download → deliver → verify). The main session orchestrates and does other useful work (memory, docs, next steps) while they run. Verify each agent's "done" report against disk before accepting.

**Wrong behavior:** foreground `Start-Sleep` poll loop over five artifact ids, then serial download + fact-check of each.

**Correct behavior:** five parallel agents, each polling only its artifact and carrying it through delivery and fact-check; lead integrates verdicts and spot-checks the files on disk.

## Generated Media Must Match the User's Approved Reference Styles — a Style Flag Is Not a Style

**Date:** 2026-07-26
**Context:** Generated six NotebookLM infographics with `--style editorial` and no visual descriptor. NotebookLM freestyled steampunk/Victorian sketch scenes. Troy: "WHY ARE YOU IGNORING THE SAMPLE INFOGRAPHIC STYLES I have give? you are making up your own style." He maintains specific approved reference samples (cartoon-mascot explainer, sketch-note, flat editorial cream/slate/rust, clean modern flat, flat editorial with map, glassmorphic bento).

**Rule:** For any generated visual media, the prompt must pin the approved reference style explicitly: a VISUAL STYLE paragraph (background, palette, illustration mode, typography feel) plus a NO-list of failure modes (no steampunk, no cartoon unless mascot style, no photorealism), paired with the closest generator style flag (`sketch_note`, `editorial`, `professional`, `bento_grid`, `instructional`). The fact-check pass gets a STYLE GATE: verify the render matches the descriptor, not just the facts. Reference styles live with Troy's samples; the memory file `feedback_use-approved-infographic-styles.md` carries the six descriptors.

**Wrong behavior:** `--style editorial` alone, then fact-checking only text content.

**Correct behavior:** style flag + explicit descriptor + NO-list in every generation prompt; style compliance verified alongside facts before delivery.

## A Component Existing Is Not a Component Shipping — Check Who Imports It

**Date:** 2026-07-26
**Context:** Two of five infographic topic docs documented dead code as live features: how-to-reports.md described the five-template picker (`TEMPLATE_INFO` + wizard steps — referenced only by other dead wizard code) and how-to-map.md described "benchmark position" (`BenchmarkPanel` — exported from a barrel, rendered nowhere). Both components exist, compile, and grep fine; neither is reachable by a user. Fixed in a0643fe1.

**Rule:** Before documenting (or building on) a UI feature, verify REACHABILITY, not existence: "who imports this, outside its own folder?" A definition + barrel re-export proves nothing — trace to a rendered page/route. This is the inverse of the audit-follows-composition rule (don't claim a feature is MISSING without reading child components); together: presence in the tree ≠ presence in the product, in both directions. Frontends with dead-code tolerance (this repo has wizard remnants, dead panels, unmounted selectors) make this check mandatory for docs, marketing copy, and topic docs that feed generated content.

## A Test That Cannot Fail Is Worse Than No Test — Prove It Can Go Red

**Date:** 2026-07-26
**Context:** Guarding a payload-key rename (`params` → `infographicParams`), an agent wrote a runtime spec asserting the wire key — and it PASSED against the broken code. `createRun` does `JSON.stringify(payload)` and forwards whatever keys the caller supplies, so no assertion inside the helper can ever fail on a caller's key choice. The real guard is TypeScript's excess-property check on the object literal at the call site. The agent verified this by reverting the caller and watching tsc reject it, then deleted the un-failable assertion and kept only what types can't see (endpoint string, error propagation).

**Rule:** Before trusting a new test, make it fail once — revert the fix, introduce the bug, or mutate the code — and watch it go red. A test that stays green against the defect it claims to guard is a false safety signal that actively misleads future readers. Corollary: know WHICH layer actually enforces a contract (compiler vs runtime vs review) and put the guard there; runtime tests cannot police what serialization forwards transparently, and type-level guards need a call-site literal to bite.

## Never Build a Text Excerpt by Joining Global-Regex Matches — They Do Not Tile the String

**Date:** 2026-07-26
**Context:** Rendered post images silently dropped an interior run of body copy and resumed mid-number, so a graphic stated a different statistic than its own caption ("The median home value dropped 22.6% year over year" rendered as "6% year over year"). Root cause in `post-images/post-image-shared.ts` `leadingSentences()`: the excerpt was assembled by iterating `t.match(/[^.!?]+[.!?]+(?:\s|$)/g)` and concatenating the matches. `String.match` with `/g` returns only what the pattern matched — anything the engine skips is discarded, and the join makes the gap invisible. The pattern was CORRECT (it refuses to treat the "." in "22.6" as a terminator because a digit follows), which is exactly why no match could begin at index 0: the engine advanced until it could, starting at "6%". Fixed by finding the last sentence-boundary INDEX within budget and `slice(0, end)` — a prefix by construction.

**Rule:** Never reconstruct a substring by concatenating global-match results. A global regex is a finder, not a partition — the matched spans need not be contiguous or start at 0, so a join silently deletes whatever fell between them. To extract a leading portion, compute an INDEX and slice; the result is then provably a prefix. This class of bug is invisible in code review (the regex looks right, and it IS right) and only surfaces in output, so any "excerpt/summary/truncate" helper deserves a test asserting the invariant `output is a prefix of input` (modulo an explicit ellipsis) rather than testing sample strings.

**Wider rule for anything rendering numbers:** silent shortening is never acceptable where a figure can be cut mid-value — refusing to render (and leaving a draft for a human) always beats emitting a wrong number. Prefer making the bad state unrepresentable (prefix-by-construction) over adding a runtime guard that can itself be bypassed.

## When a Server Won't Boot, READ ITS LOG First — Never Infer From CPU/Process Counters

**Date:** 2026-07-26
**Context:** Backend wouldn't bind `:3001` across ~6 nuclear restarts. I inferred "AV-throttled slow cold compile" from a slowly-climbing `nest` CPU counter and `dist/main.js` being absent, and kept restarting. Wrong on every axis: the backend compiled in **19s with 0 errors**, then crash-looped at bootstrap on an ENOENT the log stated verbatim. The instant I captured `nest`'s stdout to a file and read it (`npm run start:dev -w backend > /tmp/piq-backend.log 2>&1` — the `scripts/watchdog.sh` pattern), the cause was obvious. User: "look at the logs and identify the problem… that's what the local-dev-server skill is supposed to do."

**Rule:** A won't-bind server's FIRST diagnostic is reading its actual stdout/stderr, not restarting. Process CPU, working-set, `dist/` file counts, and `netstat` prove a process exists — never why it isn't serving. The `dev:fresh` console lives in an unreadable detached window, so run the failing server alone with a redirect and read the file. `tsc`/`nest build` exiting 0 proves types compile, NOT that the app boots — Nest runs constructors + DI at runtime, so a bad path/missing provider crashes boot with a clean compile (distinguish by whether `dist/main.js` emitted and what the log's last lines say). Two blind restarts is already too many.

## A `.ts` File Outside `packages/backend/src/` Silently Corrupts the App's dist Layout

**Date:** 2026-07-26
**Context:** The ENOENT above was `dist/src/content-pipeline/prompts/_system.md`. `tsconfig.build.json` had no `rootDir`/`include`, so TS auto-computes `rootDir` as the common ancestor of all compiled `.ts`. Someone added `.ts` under `packages/backend/scripts/` (infographic worker), pulling the root from `src/` up to the package root — shifting ALL output from `dist/content-pipeline/...` to `dist/src/content-pipeline/...`, while `nest-cli.json` assets still copy to `dist/content-pipeline/...`. Every `join(__dirname, '..', 'prompts'|'data'|'assets')` read then missed by exactly the `src/` segment → boot ENOENT. Compiles clean; crashes in DI. Breaks production/Railway identically.

**Rule:** Keep the app build pinned to `src/` — `tsconfig.build.json` → `"compilerOptions": { "rootDir": "./src" }`, `"include": ["src/**/*"]`. Standalone scripts under `packages/backend/scripts/` run via `npx ts-node --transpile-only` and must NEVER enter the nest build (nothing in `src/` imports them). Tell-tale of the regression: `dist/src/` and `dist/scripts/` exist alongside `dist/content-pipeline/`. Verify after: compiled JS lands in `dist/content-pipeline/...` (not `dist/src/...`) and `dist/src` is absent.

## A New Provider Registered in the Wrong Module Is a `tsc`-Clean, Test-Suite-Green Runtime Crash

**Date:** 2026-07-26
**Context:** Built the content auto-scheduler. `PostAutoSchedulerService` was registered in `ContentPipelineModule`'s providers, then injected into `PostsController` — which actually lives in `PostsBrandKitModule`, a sibling module that `ContentPipelineModule` merely _imports_. `npx tsc --noEmit` was clean (TypeScript only checks the constructor's parameter TYPE matches, not which Nest module can supply it) and all 653 existing content-pipeline unit tests passed (every one of them instantiates the class under test directly with hand-built fake dependencies — none of them go through Nest's actual DI container). Only a real `Test.createTestingModule({ imports: [AppModule] }).compile()` surfaced it: `"Nest can't resolve dependencies of PostsController (PostsService, ?). Please make sure PostAutoSchedulerService is available in the PostsBrandKitModule context."` Nest's module encapsulation is directional — a module that imports another does NOT hand its own providers down to it; a provider must be registered (or exported-and-imported) in the SAME module as anything that injects it.

**Rule:** After registering a new provider AND injecting it somewhere, ask "which `@Module` decorator's `providers` array is this class actually listed in, and is that the SAME module (or an ancestor via imports+exports) as every class that injects it?" — don't just add the import statement and the providers-array line and assume it resolves. This is invisible to `tsc` and invisible to unit tests that construct classes by hand (this repo's near-universal pattern per `feedback_no-mock-tests-use-live-data.md`'s sibling concern). Confirm wiring on any multi-module DI change with an actual `Test.createTestingModule({ imports: [AppModule] }).compile()` (or the smallest module that contains everything touched) — load real env vars via `dotenv` from `.env.local`/`.env` first, since constructors that fail-fast on a missing secret (correctly, per §1.2) will otherwise mask the DI question behind an unrelated env error. Delete the scratch spec file afterward rather than committing it — it depends on real local secrets being present, which would make it flaky in CI. The fix, once found, is usually to move the provider to the module the injecting class actually lives in and export it, not to add more imports to the wrong module.
