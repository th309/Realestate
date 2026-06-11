# Purge Quinn (analytics-chat assistant) — for good, for now

Root cause of "keeps coming back": Quinn saturates the repo's _discoverable surface_ (live code, agent-instruction files, ~30 docs, lessons.md, memory), so every Claude/Cursor session re-surfaces it. Fix = remove the surface, not just runtime files. Scope: everything incl. white-label. Land: commit on `develop`.

## Pre-flight (done)

- [x] Map all 163 matches -> delete/edit/keep manifest (3 Explore agents)
- [x] Verify `useWatchlist` is a SURVIVING feature (5 importers) -- extract, don't delete
- [x] Verify briefing generation survives (Quinn->market-intelligence, not reverse)
- [x] Verify `TTL_MAP.default` must stay; `CacheRefreshJob` only registered in app.module

## 1. Extract surviving code

- [ ] Create `lib/data/hooks/useWatchlist.ts` (hook + inlined `WatchlistItem` type), behavior identical
- [ ] Repoint 5 importers: account/SubscriptionTab, account/ActivityTab, app/account/page, dashboard/WatchlistUpdates, map/RightDetailPanel/QuickActions

## 2. Delete whole-file Quinn artifacts (git rm)

Backend: `src/analytics-chat/`, `QUINN_AI_PROVIDERS.md`, `market-intelligence/integration-quinn-prompt-gate.spec.ts`, `jobs/cache-refresh.job.ts`
Frontend: `app/components/quinn/`, `components/analytics-assistant/`, `app/api/analytics/chat/`, `graphs/.../QuinnInsight.tsx`, `org/.../branding/QuinnCustomizationSection.tsx`, `app/dev/test/components/AnalyticsAssistantSection.tsx`
Agent/docs/root: `.cursor/rules/quinn-iterative-test.mdc`, `.cursor/skills/quinn-optimizer.md`, `.agent/skills/quinn-optimizer.md`, `.agent/skills/quinn_deepseek_optimization/`, root `*QUINN*`/`*Quinn*` md + `opt-output.txt`, `docs/QUINN-*`, `docs/quinn-*`, `docs/plans/2026-02-22-quinn-v2-*`, `experiments/quinn-widget/`, `scripts/quinn-test/`

## 3. Surgical edits (remove Quinn refs, keep the file)

Backend: app.module.ts, org-branding dto+service, redis-ttl-config.ts (6 tool TTLs), redis-cache-key.ts + redis.service.ts (quinn: prefix), .env.example, scripts/backfill-historical-scores.ts, surveys/milestones.controller.ts, admin/analytics/site-context.ts, ai/anthropic.service.ts (comment)
Frontend: layout.tsx, ExplorationSidebar index+tsx, org branding page+useBrandingForm, lib/data/fetchers/org-branding.ts, lib/hooks/useMilestone.ts, admin/intelligence (3 files), dev/test/page.tsx, reports AIRecommendation.tsx
Meta: package.json (quinn:test), tasks/lessons.md (quinn-widget Railway section), docs/environment-variables.md, docs/data-lineage.md

## 4. Verify (gate before commit) -- DONE

- [x] Backend typecheck: Quinn changes clean (0 errors). Only errors = pre-existing merge-conflict markers in content-pipeline.controller.ts (UU, NOT Quinn).
- [x] Frontend typecheck: Quinn changes clean (0 errors). 4 pre-existing errors in untouched files (DirectionalBarsTooltip, newsletter/page, embeds/page, app/page unused @ts-expect-error).

## 5. Commit on develop + memory -- BLOCKED, awaiting user

- [ ] BLOCKED: content-pipeline.controller.ts unresolved merge conflict (UU) from a mid-session pull blocks `git commit`. User resolves it first, then I commit ONLY Quinn-purge files (excluding shadow-mode WIP).
- [ ] After commit: update memory quinn-not-live -> purged; update lessons.md

## Deferred -- flag to user (NOT auto-edited)

- Marketing/legal copy naming "Quinn": 4 blog `.mdx`, 2 lifecycle emails, `about/terms/TermsSectionsIntro.tsx` (legal ToS). Product/legal decision, doesn't cause resurfacing.
- Leave `QUINN_*` env reads in `market-intelligence-cron.ts` (configure surviving briefings).
- DB columns `org_branding.quinn_*` + analytics_chat tables left in place (non-destructive; "for now").
