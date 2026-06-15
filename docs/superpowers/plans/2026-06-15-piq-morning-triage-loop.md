# PIQ Morning Triage Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a read-only, locally-scheduled morning triage that reads four signal sources, ranks candidate work by blast radius, and writes a dated checklist — the loop-engineering v0.1 layer over PIQ's existing harness.

**Architecture:** Three independent units — a `piq-morning-triage` skill (the brain: read→rank→write), a PowerShell invoker (`scripts/loops/morning-triage.ps1`, the trigger), and a Windows Task Scheduler entry (the clock). The skill does all reading through existing tools (gh CLI, Supabase MCP, filesystem). State is the dated markdown output file. Read-only: it never writes code, opens PRs, or touches anything but the triage file.

**Tech Stack:** Claude Code skill (Markdown), PowerShell 7, Windows Task Scheduler (`schtasks`), gh CLI, Supabase MCP (`mcp__supabase-db__execute_sql`).

**Spec:** `docs/superpowers/specs/2026-06-15-piq-morning-triage-loop-design.md`

---

## File Structure

| File                                              | Responsibility                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `.claude/skills/piq-morning-triage/SKILL.md`      | The brain: procedure, the four source-read recipes, the ranking policy, the output template        |
| `scripts/loops/morning-triage.ps1`                | The trigger: invoke `claude -p` headless, log the run + exit code, fail loudly if no file produced |
| `scripts/loops/logs/.gitkeep`                     | Keep the log dir tracked; logs themselves are git-ignored                                          |
| `tasks/triage/.gitkeep`                           | Keep the output dir tracked; dated triage files are git-ignored                                    |
| `.gitignore` (modify)                             | Ignore `tasks/triage/*.md` and `scripts/loops/logs/*.log`                                          |
| Windows Task Scheduler entry "PIQ Morning Triage" | The clock: fire the wrapper daily at 07:00 local                                                   |

---

## Task 1: Create directories + git-ignore the ephemeral outputs

**Files:**

- Create: `tasks/triage/.gitkeep`
- Create: `scripts/loops/logs/.gitkeep`
- Modify: `.gitignore` (append a new block)

- [ ] **Step 1: Create the two keep-files (creates the dirs)**

Create `tasks/triage/.gitkeep` with content:

```
# Keeps tasks/triage/ tracked. Dated triage-*.md files are git-ignored (ephemeral).
```

Create `scripts/loops/logs/.gitkeep` with content:

```
# Keeps scripts/loops/logs/ tracked. *.log run logs are git-ignored.
```

- [ ] **Step 2: Append the ignore block to `.gitignore`**

Append exactly:

```
# PIQ morning-triage loop (loop-engineering v0.1) — ephemeral outputs
tasks/triage/*.md
scripts/loops/logs/*.log
```

- [ ] **Step 3: Verify the ignore rules work**

Run:

```bash
touch tasks/triage/triage-test.md scripts/loops/logs/test.log
git status --short tasks/triage scripts/loops
```

Expected: only the two `.gitkeep` files show as untracked (`??`); the `triage-test.md` and `test.log` do NOT appear. Then clean up:

```bash
rm tasks/triage/triage-test.md scripts/loops/logs/test.log
```

- [ ] **Step 4: Commit**

```bash
git add tasks/triage/.gitkeep scripts/loops/logs/.gitkeep .gitignore
git -c commit.gpgsign=false commit -m "chore(loop): scaffold triage output + log dirs, ignore ephemeral files"
```

---

## Task 2: Write the `piq-morning-triage` skill (the brain)

**Files:**

- Create: `.claude/skills/piq-morning-triage/SKILL.md`

> **LEARNING-MODE / ENGINEER-OWNED:** Step 1 includes a default **Ranking policy** block. When you reach it, pause and make it yours — it is the single highest-leverage decision in the loop (it encodes "a wrong score reaching a paying customer outranks a red CI check"). The default below is a starting point, not a mandate. Tune the tier keywords and the effort heuristic to your judgment before committing.

- [ ] **Step 1: Write the SKILL.md**

Create `.claude/skills/piq-morning-triage/SKILL.md` with exactly this content:

````markdown
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

## Ranking policy [ENGINEER-OWNED — tune to taste]

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
````

- [ ] **Step 2: Verify the skill is well-formed and discoverable**

Run:

```bash
test -f .claude/skills/piq-morning-triage/SKILL.md && head -4 .claude/skills/piq-morning-triage/SKILL.md
```

Expected: prints the YAML frontmatter (`---`, `name: piq-morning-triage`, `description: ...`, `---`). Confirms the file exists and the frontmatter delimiters are intact.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/piq-morning-triage/SKILL.md
git -c commit.gpgsign=false commit -m "feat(loop): add piq-morning-triage skill (read-only triage brain)"
```

---

## Task 3: Write the PowerShell invoker (the trigger)

**Files:**

- Create: `scripts/loops/morning-triage.ps1`

- [ ] **Step 1: Write the wrapper script**

Create `scripts/loops/morning-triage.ps1` with exactly this content:

```powershell
# PIQ morning-triage loop invoker (read-only).
# Spec: docs/superpowers/specs/2026-06-15-piq-morning-triage-loop-design.md
# Runs the piq-morning-triage skill headless and logs the run. Fails loudly if
# no triage file is produced (guards against silent scheduler no-op).

$ErrorActionPreference = 'Stop'

# scripts/loops/morning-triage.ps1 -> repo root is two levels up.
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

$today   = Get-Date -Format 'yyyy-MM-dd'
$logDir  = Join-Path $repoRoot 'scripts/loops/logs'
$logFile = Join-Path $logDir "morning-triage-$today.log"
$outFile = Join-Path $repoRoot "tasks/triage/triage-$today.md"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
"=== morning-triage run $(Get-Date -Format o) ===" | Out-File -FilePath $logFile -Append -Encoding utf8

try {
    claude -p "/piq-morning-triage" --permission-mode acceptEdits *>> $logFile
    $exitCode = $LASTEXITCODE
} catch {
    $exitCode = 1
    ($_ | Out-String) | Out-File -FilePath $logFile -Append -Encoding utf8
}

$produced = Test-Path $outFile
"result: exit=$exitCode produced=$produced out=$outFile" | Out-File -FilePath $logFile -Append -Encoding utf8

if (-not $produced) {
    Write-Error "Triage produced no file at $outFile (exit=$exitCode). See $logFile"
    exit 1
}
exit $exitCode
```

- [ ] **Step 2: Verify the script parses (no syntax errors)**

Run:

```bash
pwsh -NoProfile -Command "[void][System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw scripts/loops/morning-triage.ps1), [ref]\$null); Write-Output 'PARSE_OK'"
```

Expected: prints `PARSE_OK` with no parser errors. (This only checks syntax — it does not invoke Claude.)

- [ ] **Step 3: Commit**

```bash
git add scripts/loops/morning-triage.ps1
git -c commit.gpgsign=false commit -m "feat(loop): add headless invoker for morning-triage"
```

---

## Task 4: Validate the brain against LIVE data (no mocks)

This is the spec's "manual-run-first" gate. We exercise the _skill_ interactively, with full visibility, before any headless/scheduled run. Per PIQ rules: live gh + live Supabase, no mocks.

**Files:** none created — this is a validation task. (Edit the SKILL.md only if validation surfaces a problem.)

- [ ] **Step 1: Confirm prerequisites are authed**

Run:

```bash
gh auth status
```

Expected: shows a logged-in GitHub account with repo scope. If not, run `gh auth login` first. (Supabase MCP availability is confirmed by the next step actually returning rows.)

- [ ] **Step 2: Invoke the skill interactively in this session**

Invoke the skill: `/piq-morning-triage`

Watch that it: reads all four sources (or cleanly notes any that error in the source-health line), assigns items to the correct tier, and writes `tasks/triage/triage-<today>.md`.

- [ ] **Step 3: Verify the output is real and correctly shaped**

Run:

```bash
cat "tasks/triage/triage-$(date +%F).md"
```

Expected: a file with the `# PIQ Triage — <today>` header, a source-health line with four ✓/✗ marks, and three tier sections. Sanity-check the _content_: items in Tier 1 are genuinely data-integrity/prod-facing, the pipeline-freshness numbers match reality (cross-check one table with a direct `mcp__supabase-db__execute_sql` query), and no tier exceeds 5 items without a `+N more` line.

- [ ] **Step 4: If validation found a problem, fix the skill and re-run**

If tiering was wrong, a source silently failed instead of being noted, or the freshness check misread a table: edit `.claude/skills/piq-morning-triage/SKILL.md`, then repeat Steps 2–3 until the output is correct against live data. Commit any skill fix:

```bash
git add .claude/skills/piq-morning-triage/SKILL.md
git -c commit.gpgsign=false commit -m "fix(loop): correct triage skill after live-data validation"
```

---

## Task 5: Validate the trigger (headless wrapper)

Now prove the wrapper produces the same result unattended, and shake out any tool-permission gaps that only appear headless.

**Files:** possibly `.claude/settings.json` (only if new tool allowances are needed).

- [ ] **Step 1: Remove today's file so we know the wrapper regenerated it**

Run:

```bash
rm -f "tasks/triage/triage-$(date +%F).md"
```

- [ ] **Step 2: Run the wrapper**

Run:

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/loops/morning-triage.ps1
```

Expected: exit code 0. The run log `scripts/loops/logs/morning-triage-<today>.log` ends with a `result: exit=0 produced=True ...` line, and `tasks/triage/triage-<today>.md` exists again.

- [ ] **Step 3: If the headless run stalled on permissions, allowlist the read tools**

If the log shows the run waiting on / denied a tool (e.g. `Bash(gh:*)` or `mcp__supabase-db__execute_sql`), add those tools to the project allowlist in `.claude/settings.json` so unattended runs don't block, then re-run Step 2. Commit the settings change:

```bash
git add .claude/settings.json
git -c commit.gpgsign=false commit -m "chore(loop): allowlist read-only tools for headless triage"
```

Expected after fix: Step 2 completes with exit 0 and a fresh triage file, no prompts.

---

## Task 6: Register and verify the scheduler (the clock)

**Files:** none in-repo — this creates a Windows Task Scheduler entry. (Commands assume repo at `D:\projects\rei-platform`; adjust if different.)

- [ ] **Step 1: Create the daily scheduled task**

Run (PowerShell):

```powershell
schtasks /Create /TN "PIQ Morning Triage" /TR "pwsh -NoProfile -ExecutionPolicy Bypass -File D:\projects\rei-platform\scripts\loops\morning-triage.ps1" /SC DAILY /ST 07:00 /F
```

Expected: `SUCCESS: The scheduled task "PIQ Morning Triage" has successfully been created.`

- [ ] **Step 2: Confirm it registered**

Run:

```powershell
schtasks /Query /TN "PIQ Morning Triage" /V /FO LIST
```

Expected: lists the task with `Schedule Type: Daily`, `Start Time: 7:00:00 AM`, and the correct `Task To Run` path.

- [ ] **Step 3: Run it on demand and confirm it fires end-to-end**

Run:

```powershell
rm -f "tasks/triage/triage-$(Get-Date -Format yyyy-MM-dd).md"
schtasks /Run /TN "PIQ Morning Triage"
```

Wait ~1–2 minutes (the headless Claude run takes time), then verify:

```powershell
Test-Path "tasks/triage/triage-$(Get-Date -Format yyyy-MM-dd).md"
Get-Content "scripts/loops/logs/morning-triage-$(Get-Date -Format yyyy-MM-dd).log" -Tail 3
```

Expected: `True`, and the log tail shows `result: exit=0 produced=True`.

- [ ] **Step 4: Done — record the win**

The loop is live. Tomorrow at 07:00 the first unattended run produces `tasks/triage/triage-<tomorrow>.md`. No commit needed (the scheduler entry lives in Windows, not the repo). Optionally note completion in `tasks/todo.md`.

---

## Self-Review

**Spec coverage:**

- Local scheduled run → Task 6 (schtasks). ✓
- Four sources → SKILL.md Sources section (Task 2), validated live in Task 4. ✓
- Tiered-by-blast-radius, effort-adjusted ranking → SKILL.md Ranking policy (Task 2, engineer-owned). ✓
- Output contract (header + source-health + 3 tiers + top-5 cap + `+N more`) → SKILL.md Output template (Task 2), verified Task 4 Step 3. ✓
- Error handling (partial source = note + continue; run logging) → SKILL.md procedure step 2 + wrapper logging (Tasks 2–3). ✓
- "v0.1 done" = manual run first, then schedule → Tasks 4→5→6 ordering. ✓
- Git-ignore dated outputs, keep dirs → Task 1. ✓
- Out-of-scope (no code/PRs/cloud) → enforced by SKILL.md "read-only" language; nothing in the plan writes code. ✓

**Placeholder scan:** The SKILL.md ranking block is marked ENGINEER-OWNED with a complete default provided — it is functional as written, not a blank. No "TBD/TODO/implement later" in any step. ✓

**Type/name consistency:** Output path `tasks/triage/triage-<today>.md`, log path `scripts/loops/logs/morning-triage-<today>.log`, skill name `piq-morning-triage`, and task name `"PIQ Morning Triage"` are used identically across the spec, SKILL.md, wrapper, and scheduler commands. ✓
