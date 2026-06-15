---
name: piq-morning-triage
description: Read-only morning triage loop for PIQ. Reads CI/build health, data-pipeline freshness, GitHub issues/PRs/commits, and local backlog, then writes a blast-radius-ranked checklist to tasks/triage/triage-YYYY-MM-DD.md. Use for the daily morning triage run (manual or scheduled). Never writes code, opens PRs, or modifies anything except the dated triage file.
---

# PIQ Morning Triage (read-only loop v0.1)

## What this does
Reads four signal sources, ranks candidate work by blast radius, and writes ONE
file: `tasks/triage/triage-<today>.md`. It does NOT write code, open PRs, run
migrations, or change any other file. Read-only. If you are tempted to fix
something you find, STOP and just record it as an item.

## Procedure
1. Compute `today` = system date as YYYY-MM-DD.
2. Read each of the four sources below. If a source errors (not authed, timeout),
   record it in the source-health line and continue — a partial triage is valid.
3. Apply the ranking policy.
4. Write `tasks/triage/triage-<today>.md` using the output template.
5. Print a one-line summary (count per tier) and stop.

## Sources

### 1. CI / build health
Run: `gh run list --branch develop --limit 15 --json status,conclusion,name,createdAt,url`
Surface any run with conclusion `failure` / `cancelled` / `timed_out` in the last ~24h.

### 2. Data-pipeline freshness (Supabase MCP, read-only SELECT)
For each of `zillow_metro`, `zillow_county`, `zillow_zip`, `propertyiq_scores_v2`,
`calculated_metrics`: query latest period and row count via
`mcp__supabase-db__execute_sql` (SELECT only — never write). Example:
`select 'propertyiq_scores_v2' t, max(period_date) latest, count(*) n from propertyiq_scores_v2;`
Surface any table whose latest `period_date` is stale for its cadence (monthly
tables should be within ~5 weeks) or whose count dropped vs. expectation.

### 3. GitHub issues / PRs / commits
Run: `gh pr list --state open --json number,title,updatedAt,isDraft,url`
Run: `gh issue list --state open --limit 20 --json number,title,updatedAt,labels,url`
Run: `git log --oneline --since="24 hours ago" develop`
Surface open/stale PRs (>3 days no update), issues labelled urgent/bug, notable commits.

### 4. Local backlog & lessons
Read: `tasks/todo.md`, `tasks/piq-improvement-backlog-2026-06-10.md`, and the newest
5 files in `docs/superpowers/plans/` and `docs/superpowers/specs/`.
Surface plans with unchecked acceptance items and todos marked blocked/urgent.

## Ranking policy  [ENGINEER-OWNED — tune to taste]
Assign each item to a tier by WORST-CASE HARM IF IGNORED TODAY, not by how
alarming it sounds:
- **Tier 1 — data integrity / prod-facing:** stale pipeline, wrong/missing
  scores, billing, signup, entitlements. (Silent user-facing harm.)
- **Tier 2 — broken CI / build:** anything blocking shipping.
- **Tier 3 — review + backlog debt:** stale PRs, unfinished plans, aging todos.
Within a tier, order by rough impact ÷ effort (small high-leverage first).
Effort NEVER promotes an item across tiers.

## Output template
Write this exact shape to `tasks/triage/triage-<today>.md`:

```
# PIQ Triage — <today>
_Run <ISO timestamp> · Sources: CI <✓|✗> · Pipeline <✓|✗> · GitHub <✓|✗> · Backlog <✓|✗>_

## Tier 1 — Data integrity / prod-facing
1. **<what>** — <why it surfaced (which signal)>. Next: <suggested action>.
_None_   ← use this line if the tier is empty

## Tier 2 — CI / build
1. **<what>** — <why>. Next: <action>.

## Tier 3 — Review / backlog debt
1. **<what>** — <why>. Next: <action>.
```

Cap each tier at the top 5 items. Never silently drop — if a tier has more than
5, end it with a `+N more` line.
