# PIQ Morning Triage Loop — Design Spec

**Date:** 2026-06-15
**Status:** Design approved (pending spec review)
**Author:** brainstormed with Claude (loop-engineering v0.1)

## Context & Motivation

PropertyIQ already has a mature _agent harness_ (durable state, file-based
memory, the `lessons.md` ratchet, skills, sub-agents, enforcement hooks, MCP
connectors, worktree support). What it lacks is the **loop layer** described in
Addy Osmani's loop-engineering writing: scheduled automations that do discovery
and triage on a cadence and surface work to a human, instead of the human
hand-driving every turn.

This spec defines the **v0.1 of that loop layer**: a _read-only_ morning triage.
It is deliberately the smallest thing that is genuinely "loop engineering" — it
has all the muscle (scheduled, tool-using, state-writing, resumable-by-date) and
**zero production blast radius** (it only reads and ranks; it never writes code,
opens PRs, or touches prod).

The ordering is intentional and inverts the articles: we build the read-only
loop _first_ to prove the pattern cheaply, before any loop is ever allowed to
write code. This matches PIQ's hard-won verification rules (verify with live
data, HTTP 200 ≠ healthy, acceptance criteria are gates).

## Goals

- A scheduled, local, read-only triage that each morning reads four signal
  sources, ranks candidate work by blast radius, and writes a dated markdown
  checklist for the engineer to review.
- Prove the loop-engineering pattern (skill-as-procedure + headless invoker +
  scheduler + dated state file) end-to-end with no risk.
- Establish the **ranking policy** as a codified, owned artifact — the
  "stay the engineer" judgment line.

## Non-Goals (YAGNI for v0.1)

- No code writing, no auto-fixing, no PRs, no worktrees.
- No Slack/email/notification fan-out.
- No cloud or GitHub-Actions execution (local only).
- No multi-agent Workflow fan-out (that is the Stage-2+ graduation, not v0.1).

## Approach

**Approach A — Skill + headless invocation.** A `piq-morning-triage` skill
encodes the read→rank→write procedure and the ranking policy. A small PowerShell
wrapper invokes Claude Code headless (`claude -p "/piq-morning-triage"`); Windows
Task Scheduler fires the wrapper each morning. Claude performs the reads through
its existing tools (gh CLI, Supabase MCP, filesystem). State is the dated
markdown output file.

Rejected alternatives:

- **B (deterministic gather script + thin summarizer):** re-implements data
  access the MCP/tools already provide; more code to maintain.
- **C (Workflow-tool fan-out):** overkill for a daily read-only triage and
  awkward to cron headlessly. Reserved as the Stage-2+ graduation path once
  triage earns more sources.

## Architecture

Three independent units, each understandable and replaceable on its own:

| Unit                                                                      | Responsibility                                                                                                     | Depends on                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `piq-morning-triage` skill (`.claude/skills/piq-morning-triage/SKILL.md`) | The read→rank→write procedure + the ranking policy. The brain.                                                     | gh CLI, Supabase MCP, filesystem |
| `scripts/loops/morning-triage.ps1`                                        | Headless invoker: runs `claude -p`, logs the run + exit code, never throws on partial-source failure. The trigger. | Claude CLI                       |
| Windows Task Scheduler entry                                              | Fires the wrapper daily at a chosen local time. The clock.                                                         | the wrapper                      |

The clean seam: the skill knows nothing about _how_ it's invoked, and the
invoker knows nothing about _what_ the triage does. Graduating to cloud or
GitHub-Actions later swaps only the bottom two rows — the skill is untouched.

## Data Flow

```
Task Scheduler (daily, ~07:00 local)
  → scripts/loops/morning-triage.ps1
      → claude -p "/piq-morning-triage"
          → skill reads 4 sources (via tools):
              1. CI / build health        (gh run list on develop)
              2. Data-pipeline freshness  (Supabase MCP: latest period_date
                                           + row counts for zillow_*,
                                           propertyiq_scores_v2,
                                           calculated_metrics)
              3. GitHub issues/PRs/commits (gh issue/pr list, recent commits)
              4. Local backlog & lessons   (tasks/todo.md, tasks/lessons.md,
                                           open docs/superpowers specs+plans)
          → applies tiered-by-blast-radius ranking (effort-adjusted within tier)
          → writes tasks/triage/triage-YYYY-MM-DD.md
          → exits
  → wrapper logs run to scripts/loops/logs/morning-triage-YYYY-MM-DD.log
```

## Output Contract

File: `tasks/triage/triage-YYYY-MM-DD.md`

Structure:

1. **Header** — run timestamp + a one-line **source-health** summary noting which
   of the four sources read cleanly vs. errored (e.g. `Sources: CI ✓ · Pipeline ✓
· GitHub ✓ · Backlog ✓`). A partial triage is valid and expected.
2. **Tier 1 — Data integrity / prod-facing.** Stale pipeline, wrong/ missing
   scores, billing/signup/entitlement breakage. Silent user-facing harm.
3. **Tier 2 — Broken CI / build.** Blocks shipping.
4. **Tier 3 — Review + backlog debt.** Stale PRs, unfinished plans, aging todos.

Each tier: an **effort-adjusted** ranked list, **capped at top 5** so it stays a
checklist, not a dump. Every item carries: one-line _what_, _why it surfaced_
(which signal), and a _suggested next action_. Items beyond the cap roll into a
single "+N more" line so nothing is silently dropped (per "no silent caps").

## Ranking Policy (the owned artifact)

> **Implementation note:** this block is authored by the engineer at
> implementation time, not by the scaffolding. It is the highest-leverage
> decision in the loop and encodes domain judgment.

Policy: **tiered by blast radius, effort-adjusted within tier.**

- **Tier assignment** is by _worst-case harm if ignored today_, not by how
  alarming the item sounds:
  - Tier 1 = anything touching data integrity or a live user-facing surface
    (scores, pipeline freshness, billing, signup, entitlements).
  - Tier 2 = anything that blocks shipping (red CI, broken build/deploy).
  - Tier 3 = review and backlog debt.
- **Within a tier**, order by a rough impact ÷ effort so small high-leverage
  fixes surface above large speculative ones — but effort never promotes an
  item _across_ tiers.

The exact tier keywords and the effort heuristic live in `SKILL.md` and are the
~8-line block the engineer writes during implementation.

## Error Handling

Read-only ⇒ **success is silent, failures are verbose-but-logged**:

- A source that errors (gh not authed, Supabase timeout) is recorded in the
  source-health line; the triage continues with the remaining sources. Partial
  triage beats no triage.
- The wrapper logs every run (start, exit code, output path) to
  `scripts/loops/logs/`. This is the guard against the _exact_ failure mode that
  silently no-op'd the monthly pipeline for ~5 months: if the scheduler stops
  firing, the absence of fresh logs is the tell.

## Testing / Verification ("v0.1 done")

Per PIQ's "manual-run-first, verify on live data" rules:

1. Run `scripts/loops/morning-triage.ps1` **manually** once.
2. Confirm it produces a sane, correctly-tiered `tasks/triage/triage-<today>.md`
   against **live** data (real gh + real Supabase, no mocks).
3. Confirm the run log was written.
4. _Only then_ register the Windows Task Scheduler entry.
5. Confirm the scheduled task fires once and produces the next day's file.

## Graduation Path (post-v0.1, not built here)

- Stage 2: bounded _autonomous_ loop on one verifiable target (the monthly
  validation pipeline), worktree-isolated, writer sub-agent + adversarial
  verifier sub-agent, opens a PR, **never auto-merges**.
- Stage 3: template the loop (writer worktree + verifier + connector-opens-PR +
  state file) and point it at new targets.
- The verifier (`piq-loop-verifier` skill encoding the live-data / real-render /
  acceptance-as-gates rules) is the prerequisite for any writing loop and should
  be built before Stage 2.

## Open Questions

- Preferred local run time (default assumed ~07:00; confirm at implementation).
- Whether `tasks/triage/` outputs should be git-ignored (ephemeral) or committed
  (history). Default proposal: git-ignore the dated files, keep the directory.
