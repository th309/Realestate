# Runs once daily via Windows Task Scheduler (task: PropertyIQ-Daily-Funnel-Check).
# Pulls fresh GA4 activation-funnel numbers and appends a dated entry to
# docs/analytics/funnel-tracking.md. Read-only against GA4; only writes to
# that one tracking file.

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location "D:\projects\rei-platform"

$logFile = "D:\projects\rei-platform\logs\ga-funnel-check.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "----- $timestamp : starting daily funnel check -----"

$prompt = @'
You are running unattended (Windows Task Scheduler, no human watching). Your one job:
pull today's GA4 activation-funnel numbers for PropertyIQ and append a dated entry to the
tracking file, then stop. Do not touch any other file. Do not run git commands. Do not commit.

GA4 property: `525864470` (PropertyIQ, account `96898187`).
Tracking file: `D:\projects\rei-platform\docs\analytics\funnel-tracking.md`

Steps:
1. Load the GA4 tools: ToolSearch with query
   "select:mcp__google-analytics__run_report,mcp__google-analytics__run_funnel_report".
2. Read the tracking file. Find the most recent dated entry (the file lists newest first,
   right below the header) — that is your comparison baseline. If the file is missing or
   has no entries yet, note that and treat this as a first data point.
3. Run `run_report` for the last 30 days: dimensions=["eventName"], metrics=["eventCount","totalUsers"],
   ordered by eventCount desc, limit 30. Pull out: session_start, form_start, sign_up,
   trial_start, purchase.
4. Run `run_funnel_report` for the last 8 days (start_date "8daysAgo", end_date "today") with
   steps: {name:"Visited site", event:"session_start"}, {name:"Started sign-up form",
   event:"form_start"}, {name:"Completed sign-up", event:"sign_up"}, {name:"Started trial",
   event:"trial_start"}. This 8-day window avoids the Jun 10-23 bot-storm skew — always use
   a trailing 8-day window here, not 30 days, so entries are comparable day over day.
5. Compare every number above against the prior entry. Compute deltas.
6. Append a new section immediately below the header (so newest is always on top, right
   after the intro paragraphs and before the first "## " dated entry) titled
   "## YYYY-MM-DD" (today's actual date). Contents:
   - One-line verdict: "No meaningful change" / "Improved" / "Regressed" / "Needs a look".
   - A compact table: step, users today, users last entry, delta.
   - 2-4 sentences of plain-English interpretation aimed at a human skimming once a day —
     what's working, what's not, and call out anything that crosses a real threshold
     (e.g., purchase gets its first-ever real event, visits drop/spike sharply, sign-up
     completion rate shifts meaningfully). Do not repeat the file's standing header context
     (bot storm, known weak links) unless it's specifically relevant to interpreting today's
     number — the person reading this already has that context from prior days.
   - If nothing changed meaningfully, say so briefly. Do not manufacture false urgency out
     of single-digit noise — this funnel runs at ~5-30 users/day, so day-to-day swings of a
     few users are normal, not a signal.
7. If there are more than 30 dated ("## ") entries after appending, delete the oldest ones
   so the file stays bounded.
8. Write the file with the Write tool (or Edit if you prefer — either is fine, just make the
   one change described above). Do not modify the intro/header section.

Be terse. Nobody re-summarizes this file with another AI — it's read directly by a person.
'@

& claude -p $prompt `
  --allowedTools "ToolSearch,Read,Write,Edit,mcp__google-analytics__run_report,mcp__google-analytics__run_funnel_report" `
  --model sonnet `
  --max-budget-usd 2 `
  --no-session-persistence `
  --output-format text 2>&1 | Add-Content -Path $logFile

Add-Content -Path $logFile -Value "----- $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') : done -----`n"
