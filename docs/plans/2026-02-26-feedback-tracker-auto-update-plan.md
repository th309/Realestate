# Feedback Tracker Auto-Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enrich the beta-testing skill's auto-remediation phase to automatically update feedback tracker status when fixing issues.

**Architecture:** Skill-only changes to `.claude/skills/beta-testing-propertyiq/SKILL.md`. Three additions: (1) feedback lifecycle updates wired into existing auto-remediation steps, (2) fuzzy matching procedure for standalone fixes, (3) a new "Fix from Tracker" mode. No API, DB, or frontend changes needed.

**Tech Stack:** Markdown skill file, existing REST API (`PATCH /api/admin/feedback/{id}`)

---

### Task 1: Add `feedback_id` field to Findings Manifest (Step 1)

**Files:**

- Modify: `.claude/skills/beta-testing-propertyiq/SKILL.md` — Auto-Remediation Step 1 (lines ~759-770)

**Step 1: Read the current Step 1 table**

Read the findings manifest table in the skill file at the "Step 1: Build the Findings Manifest" section.

**Step 2: Add `feedback_id` to the manifest field table**

In the table under "For each finding, capture:", add a new row after `id`:

```markdown
| `feedback_id` | The UUID returned by the POST /api/betatest/feedback response during submission. Store this when submitting issues in earlier phases. If not available (e.g., standalone fix), set to `null` — fuzzy matching will resolve it later. |
```

**Step 3: Add instruction to retain feedback IDs during submission**

After the existing "Submitting Issues During Testing" curl example (around line 137), add a note:

```markdown
**IMPORTANT:** Store the `feedback.id` from each successful POST response. This ID is used by the Auto-Remediation phase to update tracker status automatically. Keep a mapping of `{ finding_title → feedback_id }` throughout the session.
```

**Step 4: Verify the edit**

Read the modified sections and confirm the new field and note are in the right places.

**Step 5: Commit**

```bash
git add .claude/skills/beta-testing-propertyiq/SKILL.md
git commit -m "feat(skill): add feedback_id tracking to findings manifest"
```

---

### Task 2: Add `in_progress` status update to Step 3

**Files:**

- Modify: `.claude/skills/beta-testing-propertyiq/SKILL.md` — Auto-Remediation Step 3 (lines ~802-820)

**Step 1: Read the current Step 3 section**

Read the "Step 3: Invoke Systematic Debugging" section.

**Step 2: Add feedback status update before debugging starts**

Insert a new paragraph at the beginning of Step 3, before the existing "For each finding..." text:

````markdown
**Update Feedback Tracker:** Before invoking systematic debugging for each finding, update its feedback status to `in_progress`. This signals on `/admin/feedback` that the item is actively being worked on.

```bash
# If feedback_id is known (from session submission):
curl -s -X PATCH http://localhost:${TEST_PORT}/api/admin/feedback/{feedback_id} \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'

# If feedback_id is null (standalone fix), run fuzzy matching first (see "Fuzzy Matching" section below).
```
````

If the PATCH fails (404, 500), log the error and continue — do NOT block the fix on a tracker update failure.

````

**Step 3: Verify the edit**

Read the modified section and confirm it reads naturally before the existing debugging workflow.

**Step 4: Commit**

```bash
git add .claude/skills/beta-testing-propertyiq/SKILL.md
git commit -m "feat(skill): update feedback to in_progress before debugging"
````

---

### Task 3: Add `fixed` status update to Step 5

**Files:**

- Modify: `.claude/skills/beta-testing-propertyiq/SKILL.md` — Auto-Remediation Step 5 (lines ~833-857)

**Step 1: Read the current Step 5 section**

Read the "Step 5: Remediation Report" section.

**Step 2: Add feedback status update after fix verification**

Insert a new paragraph before the existing report template, after the "After all findings have been processed" line:

````markdown
**Update Feedback Tracker:** For each successfully fixed finding, update its feedback status to `fixed` with a commit reference and admin note:

```bash
curl -s -X PATCH http://localhost:${TEST_PORT}/api/admin/feedback/{feedback_id} \
  -H "Content-Type: application/json" \
  -d '{
    "status": "fixed",
    "fix_reference": "{commit_sha}",
    "admin_notes": "Auto-fixed: {one-line root cause summary}"
  }'
```
````

**Status update rules:**
| Finding Outcome | Tracker Update |
|---|---|
| Fixed automatically | `status: "fixed"`, `fix_reference: "<sha>"`, `admin_notes: "Auto-fixed: <root cause>"` |
| Fixed after confirmation | Same as above |
| Deferred (user declined) | No update — leave current status |
| Unfixable (needs design decision) | No update — leave current status |

Get the commit SHA via `git rev-parse --short HEAD` after the fix is committed.

````

**Step 3: Add the Feedback Tracker Updates section to the report template**

Append the following to the existing report template (after the "Batched" section):

```markdown

=== Feedback Tracker Updates ===
Updated to in_progress: X
Updated to fixed: X
  - [feedback_id]: [title] → fixed (ref: abc1234)
  - [feedback_id]: [title] → fixed (ref: def5678)
Unmatched (no tracker item found): X
Unchanged (deferred/unfixable): X
````

**Step 4: Verify the edit**

Read the modified section and confirm both the update instructions and report template look correct.

**Step 5: Commit**

```bash
git add .claude/skills/beta-testing-propertyiq/SKILL.md
git commit -m "feat(skill): update feedback to fixed after successful remediation"
```

---

### Task 4: Add Fuzzy Matching procedure

**Files:**

- Modify: `.claude/skills/beta-testing-propertyiq/SKILL.md` — New section between Step 2 and Step 3

**Step 1: Read the area between Step 2 and Step 3**

Identify the exact insertion point — after the Safety Gates classification table and before "Step 3: Invoke Systematic Debugging".

**Step 2: Insert the Fuzzy Matching section**

Add a new section between Step 2 and Step 3:

````markdown
### Feedback Tracker: Fuzzy Matching

When a finding has `feedback_id: null` (e.g., standalone debugging outside a full testing session), resolve it before updating the tracker:

1. **Fetch open feedback:**
   ```bash
   curl -s http://localhost:${TEST_PORT}/api/admin/feedback
   ```
````

2. **Filter to actionable statuses:** Keep only items where `status` is `submitted`, `triaged`, or `in_progress`. Exclude `fixed`, `deployed`, `wont_fix`, `duplicate`.

3. **Score each item** against the finding's title + description using keyword overlap on these fields:
   - `title` (highest weight)
   - `description`
   - `page_url`
   - `affected_component`

4. **Pick the best match.** If multiple items score equally, pick the one with the oldest `created_at` (first reported = canonical entry).

5. **Announce the match:** Output: _"Matched to feedback: [title] (id: [id], status: [current_status])"_

6. **If no match scores above threshold:** Skip the tracker update silently. The fix isn't feedback-related — proceed with debugging normally.

7. **Assign the resolved `feedback_id`** to the finding and proceed with the `in_progress` → `fixed` lifecycle.

````

**Step 3: Verify the edit**

Read the modified section and confirm it sits cleanly between Step 2 and Step 3.

**Step 4: Commit**

```bash
git add .claude/skills/beta-testing-propertyiq/SKILL.md
git commit -m "feat(skill): add fuzzy matching for standalone feedback resolution"
````

---

### Task 5: Add "Fix from Tracker" mode

**Files:**

- Modify: `.claude/skills/beta-testing-propertyiq/SKILL.md` — New section after the Auto-Remediation section (after Step 6)

**Step 1: Read the end of the Auto-Remediation section**

Read Step 6 (Verification Pass) to identify where the new section goes — immediately after it, before the end of the file.

**Step 2: Insert the Fix from Tracker section**

Add after Step 6:

````markdown
---

## Fix from Tracker Mode

**Use when:** You want to work through open feedback items from `/admin/feedback` without running a full testing session. Invoke by saying "fix the open feedback items", "work through the tracker", or similar.

### Procedure

1. **Fetch all open feedback:**
   ```bash
   curl -s http://localhost:${TEST_PORT}/api/admin/feedback
   ```
````

Filter to actionable statuses: `submitted`, `triaged`, `in_progress`.

2. **Sort by priority:**
   - Severity: `critical` → `high` → `medium` → `low`
   - Within same severity: oldest `created_at` first

3. **Present summary:**
   Output: _"Found X open feedback items: Y critical, Z high, W medium, V low"_

4. **Work through items in priority order.** For each item:
   a. PATCH status to `in_progress`:

   ```bash
   curl -s -X PATCH http://localhost:${TEST_PORT}/api/admin/feedback/{id} \
     -H "Content-Type: application/json" \
     -d '{"status": "in_progress"}'
   ```

   b. Invoke `superpowers:systematic-debugging` with full context from the feedback item:
   - Title as the bug description
   - `steps_to_reproduce` as reproduction steps
   - `page_url` as where to look
   - `affected_component` as starting point for code investigation
   - `description` as full context
     c. Apply the same Safety Gates from Step 2 above (`safe` vs `needs_confirmation`)
     d. On fix verified:

   ```bash
   curl -s -X PATCH http://localhost:${TEST_PORT}/api/admin/feedback/{id} \
     -H "Content-Type: application/json" \
     -d '{
       "status": "fixed",
       "fix_reference": "{commit_sha}",
       "admin_notes": "Auto-fixed: {root cause summary}"
     }'
   ```

   e. On deferred or unfixable: leave status unchanged (still `in_progress` — admin can triage)

5. **Output remediation report** using the same format from Step 5 above, including the Feedback Tracker Updates section.

### Batching

Same rule as auto-remediation: if multiple feedback items share a root cause, investigate once and fix the root cause. Update ALL matched items to `fixed` with the same `fix_reference`.

````

**Step 3: Verify the edit**

Read the newly added section and confirm it's complete and well-placed.

**Step 4: Commit**

```bash
git add .claude/skills/beta-testing-propertyiq/SKILL.md
git commit -m "feat(skill): add Fix from Tracker mode for standalone feedback fixing"
````

---

### Task 6: Final verification — read the full modified skill

**Files:**

- Read: `.claude/skills/beta-testing-propertyiq/SKILL.md` (full file)

**Step 1: Read the complete file**

Read the entire skill file end-to-end.

**Step 2: Verify structural integrity**

Check that:

- The feedback_id field is in the findings manifest table
- The "Store the feedback.id" note is in the submission section
- The fuzzy matching section sits between Step 2 and Step 3
- Step 3 has the `in_progress` update before debugging
- Step 5 has the `fixed` update and the extended report template
- Fix from Tracker mode is after Step 6
- No duplicate sections, no broken markdown, no orphaned references

**Step 3: Commit (if any cleanup needed)**

Only if verification reveals formatting issues. Otherwise, skip.
