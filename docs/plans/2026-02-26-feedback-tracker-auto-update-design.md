# Design: Automatic Feedback Tracker Status Updates

**Date:** 2026-02-26
**Status:** Approved
**Scope:** `.claude/skills/beta-testing-propertyiq/SKILL.md` (skill instructions only)

## Problem

When the beta-testing skill discovers issues and submits them to the feedback tracker, then the systematic-debugging skill fixes them, the tracker status stays at `submitted`. The user must manually update each item on `/admin/feedback`. This is tedious and error-prone.

## Solution

Enrich the beta-testing skill's auto-remediation phase with API calls that update feedback status at the right lifecycle moments. Add a "Fix from Tracker" mode for standalone debugging sessions. Add fuzzy matching for cases where feedback IDs aren't available.

## Design

### 1. Auto-Remediation Feedback Lifecycle

Three integration points in the existing auto-remediation steps:

| Existing Step                        | New Behavior                                                      | API Call                                                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Step 1 (Build Findings Manifest)     | Retain `feedback_id` from the original POST response              | None — just store the ID                                                                                                           |
| Step 3 (Invoke Systematic Debugging) | Before debugging starts, update matched feedback to `in_progress` | `PATCH /api/admin/feedback/{id}` with `{ "status": "in_progress" }`                                                                |
| Step 5 (Remediation Report)          | After fix verified, update to `fixed` with commit SHA             | `PATCH /api/admin/feedback/{id}` with `{ "status": "fixed", "fix_reference": "<sha>", "admin_notes": "Auto-fixed: <root cause>" }` |

Deferred or unfixable findings leave the feedback status unchanged.

Curl pattern:

```bash
# Mark in_progress
curl -s -X PATCH http://localhost:${TEST_PORT}/api/admin/feedback/{feedback_id} \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'

# Mark fixed with reference
curl -s -X PATCH http://localhost:${TEST_PORT}/api/admin/feedback/{feedback_id} \
  -H "Content-Type: application/json" \
  -d '{"status": "fixed", "fix_reference": "<commit_sha>", "admin_notes": "Auto-fixed: <one-line root cause>"}'
```

### 2. Fuzzy Matching for Standalone Fixes

When systematic-debugging is invoked outside the auto-remediation flow (no feedback ID available):

1. Fetch all open feedback: `GET /api/admin/feedback`
2. Filter to actionable statuses: `submitted`, `triaged`, `in_progress`
3. Score each item against the bug description using keyword overlap on `title` + `description` + `page_url` + `affected_component`
4. Pick the highest-scoring match
5. Announce: "Matched to feedback: [title] (id: [id], status: [current_status])"
6. Proceed with the same `in_progress` -> `fixed` lifecycle

If no match scores above threshold: skip silently. If multiple items score equally: pick the oldest `created_at`.

### 3. "Fix from Tracker" Mode

New mode for working through open feedback items directly:

1. Fetch all feedback with actionable status (`submitted`, `triaged`, `in_progress`)
2. Sort by severity (critical -> high -> medium -> low), then `created_at` ascending
3. Present summary: "Found X open feedback items: Y critical, Z high, ..."
4. Work through in priority order:
   - PATCH to `in_progress`
   - Invoke systematic-debugging with full context (title, description, steps_to_reproduce, page_url, affected_component)
   - On fix verified: PATCH to `fixed` with commit SHA
   - On deferred/unfixable: leave status unchanged
5. Output remediation report

Same safety gates apply — `needs_confirmation` items pause for approval.

### 4. Extended Remediation Report

New section appended to the existing report:

```
=== Feedback Tracker Updates ===
Updated to in_progress: X
Updated to fixed: X
  - [feedback_id]: [title] -> fixed (ref: abc1234)
Unmatched (no tracker item found): X
Unchanged (deferred/unfixable): X
```

## Scope

### What changes

| File                                              | Change                                                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/skills/beta-testing-propertyiq/SKILL.md` | Add feedback lifecycle to auto-remediation Steps 1/3/5, add fuzzy matching procedure, add "Fix from Tracker" mode, extend remediation report |

### What does NOT change

- No API changes — `PATCH /api/admin/feedback/{id}` already accepts `status`, `fix_reference`, `admin_notes`
- No database changes — schema supports the full lifecycle
- No frontend changes — admin page renders all statuses
- No changes to systematic-debugging skill (shared plugin)

The entire design is skill instructions only. The infrastructure is already in place.
