# Weekly Data Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the six silently-broken monthly/annual import crons with ONE weekly (Tuesday) data pipeline that polls every product-feeding source, upserts new data idempotently, and triggers the post-import refresh **only when `MAX(period_date)` actually advances** — a quiet week is a green no-op, not a failure.

**Architecture:** A single `weekly-data-pipeline.yml` orchestrator runs the canonical consolidated importers (`scripts/sources/zillow/import-zillow.ts` + `scripts/import-all-non-zillow.ts --only=…`) under `set -euo pipefail`, with a freshness probe before/after to decide whether to dispatch `post-import-refresh.yml`. The five broken individual import workflows are deleted; their manual-run ability moves to the orchestrator's `source` dispatch input.

**Tech Stack:** GitHub Actions, Node 20 + tsx, Supabase service-key SQL (freshness probe), existing consolidated import scripts.

**Background:** All six import workflows called top-level `scripts/import-*.ts` files deleted 2026-02-20 (`2bf168b6`), and masked the crash via `… | tee` (no `pipefail`) + a `grep "COMPLETED WITH ERRORS"` gate the crash never trips → green-but-imported-nothing every month since February. Confirmed via the 2026-06-15 12:08 run (`ERR_MODULE_NOT_FOUND` ×5 → `success`) and all `realtor_*`/`zillow_*` tables stuck at April. Root-cause writeup is in this session's triage.

---

## Decisions (locked)

- **Cadence/day:** Tuesday 04:00 UTC (`0 4 * * 2`). Tuesday = peak B2B email open/click; 04:00 UTC start lets import→refresh→score finish before a Tue ~10–11am ET "scores updated" send.
- **Scope:** zillow, realtor, economic, census, permits, hud. Redfin Market Tracker excluded (PIQ is Redfin-free; it has its own weekly workflow). qcew/irs/redfin-migration left to manual/`import-all-non-zillow` for now.
- **Conditional refresh** via freshness probe (max-period advanced?), NOT row-count (incremental re-upsert inflates row-count every week).
- **No-new-data = green no-op.** Importer crash = red (pipefail).

---

## File Structure

| File                                            | Action | Responsibility                                                                                        |
| ----------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `scripts/lib/latest-periods.ts`                 | Create | Print compact JSON of `MAX(period_date)`/`MAX(score_date)` per key table. The honest new-data signal. |
| `.github/workflows/weekly-data-pipeline.yml`    | Create | The Tuesday orchestrator: probe→import→probe→conditional dispatch.                                    |
| `.github/workflows/post-import-refresh.yml`     | Modify | Remove standalone `schedule:` cron; keep `workflow_dispatch` (now orchestrator-triggered).            |
| `.github/workflows/zillow-monthly-import.yml`   | Delete | Broken; replaced by orchestrator.                                                                     |
| `.github/workflows/realtor-monthly-import.yml`  | Delete | Broken; replaced.                                                                                     |
| `.github/workflows/permits-monthly-import.yml`  | Delete | Broken; replaced.                                                                                     |
| `.github/workflows/economic-monthly-import.yml` | Delete | Broken; replaced.                                                                                     |
| `.github/workflows/hud-fmr-annual-import.yml`   | Delete | Broken; folded into weekly poll (no-ops most weeks, which is fine now).                               |

---

## Task 1: Freshness probe script (the new-data signal)

**Files:**

- Create: `scripts/lib/latest-periods.ts`
- Test: manual run + a one-shot assertion against live DB

- [ ] **Step 1: Write the probe**

Create `scripts/lib/latest-periods.ts`:

```ts
#!/usr/bin/env npx tsx
/**
 * Prints a compact JSON map of the latest data period per key source table.
 * Used by the weekly pipeline to decide whether new data actually landed
 * (incremental upserts make row-counts unreliable; the period date is the
 * only honest signal). Read-only. Requires SUPABASE_URL + SUPABASE_SERVICE_KEY.
 */
import { getSupabaseClient } from "./supabase-client";

// table -> date column
const TABLES: Record<string, string> = {
  zillow_metro: "period_date",
  zillow_county: "period_date",
  zillow_zip: "period_date",
  realtor_metro: "period_date",
  realtor_county: "period_date",
  realtor_zip: "period_date",
  calculated_metrics: "period_date",
  propertyiq_scores_v2: "score_date",
};

async function main(): Promise<void> {
  const supabase = getSupabaseClient();
  const out: Record<string, string | null> = {};
  for (const [table, col] of Object.entries(TABLES)) {
    const { data, error } = await supabase
      .from(table)
      .select(col)
      .order(col, { ascending: false })
      .limit(1)
      .maybeSingle();
    out[table] = error ? null : ((data as any)?.[col] ?? null);
  }
  // Single-line JSON so the workflow can capture it as a step output.
  console.log(JSON.stringify(out));
}

main().catch((e) => {
  console.error("latest-periods probe failed:", e?.message ?? e);
  process.exit(1);
});
```

> NOTE: confirm the real import client helper name/path before finalizing — the realtor importer imports `getSupabaseClient` from `../../lib` (`scripts/lib/index.ts`). Use the same export. If the helper lives at a different path, fix the import line to match.

- [ ] **Step 2: Verify against live DB**

Run (with prod creds in env):

```bash
npx tsx scripts/lib/latest-periods.ts
```

Expected: one JSON line, e.g. `{"zillow_metro":"2026-04-30",...,"realtor_metro":"2026-04-01",...,"propertyiq_scores_v2":"2026-04-30"}`. Cross-check 1–2 values against a direct Supabase query (we already know realtor\_\*=2026-04-01, zillow/calc/scores≈2026-04-30).

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/latest-periods.ts
git -c commit.gpgsign=false commit -m "feat(pipeline): latest-periods freshness probe (honest new-data signal)"
```

---

## Task 2: The weekly orchestrator workflow

**Files:**

- Create: `.github/workflows/weekly-data-pipeline.yml`

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/weekly-data-pipeline.yml`:

```yaml
name: Weekly Data Pipeline

on:
  schedule:
    - cron: "0 4 * * 2" # Tuesdays 04:00 UTC — pre-empts the Tue-AM "scores updated" send
  workflow_dispatch:
    inputs:
      source:
        description: "Which source(s) to import"
        required: false
        default: "all"
        type: choice
        options: [all, zillow, realtor, economic, permits, hud]
      force_refresh:
        description: "Run post-import refresh even if no new data"
        required: false
        default: false
        type: boolean

jobs:
  import:
    runs-on: ubuntu-latest
    timeout-minutes: 360
    outputs:
      has_new_data: ${{ steps.decide.outputs.has_new_data }}
    env:
      SUPABASE_URL: "${{ secrets.SUPABASE_URL }}"
      SUPABASE_SERVICE_KEY: "${{ secrets.SUPABASE_SERVICE_KEY }}"
      NEXT_PUBLIC_SUPABASE_URL: "${{ secrets.SUPABASE_URL }}"
      SUPABASE_SERVICE_ROLE_KEY: "${{ secrets.SUPABASE_SERVICE_KEY }}"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm" }
      - run: npm ci

      - name: Snapshot freshness BEFORE
        id: before
        run: echo "periods=$(npx tsx scripts/lib/latest-periods.ts)" >> "$GITHUB_OUTPUT"

      - name: Import Zillow
        if: ${{ inputs.source == '' || inputs.source == 'all' || inputs.source == 'zillow' }}
        run: |
          set -euo pipefail
          npx tsx scripts/sources/zillow/import-zillow.ts

      - name: Import non-Zillow (selected)
        if: ${{ inputs.source != 'zillow' }}
        run: |
          set -euo pipefail
          case "${{ inputs.source || 'all' }}" in
            all)      ONLY="realtor,economic,census,permits,hud" ;;
            realtor)  ONLY="realtor" ;;
            economic) ONLY="economic,census" ;;
            permits)  ONLY="permits" ;;
            hud)      ONLY="hud" ;;
            *)        ONLY="realtor,economic,census,permits,hud" ;;
          esac
          npx tsx scripts/import-all-non-zillow.ts --only="$ONLY"

      - name: Snapshot freshness AFTER
        id: after
        run: echo "periods=$(npx tsx scripts/lib/latest-periods.ts)" >> "$GITHUB_OUTPUT"

      - name: Decide whether new data landed
        id: decide
        run: |
          set -euo pipefail
          if [ "${{ inputs.force_refresh }}" = "true" ]; then
            echo "force refresh requested"; echo "has_new_data=true" >> "$GITHUB_OUTPUT"; exit 0
          fi
          if [ "${{ steps.before.outputs.periods }}" != "${{ steps.after.outputs.periods }}" ]; then
            echo "new data detected"; echo "has_new_data=true" >> "$GITHUB_OUTPUT"
          else
            echo "no new data this week — green no-op, skipping refresh"
            echo "has_new_data=false" >> "$GITHUB_OUTPUT"
          fi

  trigger-refresh:
    needs: import
    if: ${{ needs.import.outputs.has_new_data == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            await github.rest.actions.createWorkflowDispatch({
              owner: context.repo.owner,
              repo: context.repo.repo,
              workflow_id: 'post-import-refresh.yml',
              ref: 'main',
              inputs: { trigger_source: 'weekly-data-pipeline' }
            });
            console.log('Dispatched post-import-refresh (new data detected).');
```

> NOTE before finalizing: confirm `scripts/sources/zillow/import-zillow.ts` runs incrementally by default (it parses incremental flags like realtor; default monthly cutoff). If it full-loads by default, add the incremental flag the lib expects. Also confirm `post-import-refresh.yml` accepts a `trigger_source` input (realtor-monthly-import.yml dispatched it with that input).

- [ ] **Step 2: Lint the YAML**

Run:

```bash
npx --yes js-yaml .github/workflows/weekly-data-pipeline.yml >/dev/null && echo YAML_OK
```

Expected: `YAML_OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/weekly-data-pipeline.yml
git -c commit.gpgsign=false commit -m "feat(pipeline): weekly Tuesday data pipeline (conditional refresh, green no-op on no-data)"
```

---

## Task 3: Remove the standalone post-import cron + delete the broken workflows

**Files:**

- Modify: `.github/workflows/post-import-refresh.yml` (drop `schedule:`)
- Delete: the five broken import workflows

- [ ] **Step 1: Remove the standalone cron from post-import-refresh.yml**

Open `.github/workflows/post-import-refresh.yml`, delete the `schedule:` block (the `- cron: '0 6 25 * *'` line and its `schedule:` key) under `on:`. Keep `workflow_dispatch`. Verify `on:` still has `workflow_dispatch`.

- [ ] **Step 2: Delete the five broken workflows**

```bash
git rm .github/workflows/zillow-monthly-import.yml \
       .github/workflows/realtor-monthly-import.yml \
       .github/workflows/permits-monthly-import.yml \
       .github/workflows/economic-monthly-import.yml \
       .github/workflows/hud-fmr-annual-import.yml
```

- [ ] **Step 3: Confirm no other workflow references the deleted files**

Run:

```bash
grep -rEn "zillow-monthly-import|realtor-monthly-import|permits-monthly-import|economic-monthly-import|hud-fmr-annual-import" .github/ || echo "no dangling references"
```

Expected: `no dangling references` (or only matches inside the files being deleted).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/post-import-refresh.yml
git -c commit.gpgsign=false commit -m "chore(pipeline): retire monthly import crons + standalone post-import cron (replaced by weekly pipeline)"
```

---

## Task 4: Verify (no merge to main until these pass)

- [ ] **Step 1: Dry-run the importers locally (real DB), targeted + incremental**

Run realtor only, confirm it advances realtor\_\* to May:

```bash
npx tsx scripts/sources/realtor/import-realtor.ts --geo metro
npx tsx scripts/lib/latest-periods.ts   # realtor_metro should now show 2026-05-01
```

Expected: realtor_metro latest moves April→May (Realtor posted May on 2026-06-11).

- [ ] **Step 2: After merge to main — manual smoke via dispatch**

Once merged to `main`, dispatch the orchestrator scoped to realtor:

```bash
gh workflow run "Weekly Data Pipeline" -f source=realtor
```

Then confirm: the import job is green, the `decide` step logs new-or-no-new correctly, and (if new) `post-import-refresh` was dispatched. Check `gh run list --workflow "Weekly Data Pipeline"`.

- [ ] **Step 3: Confirm the no-op path**

Dispatch again immediately (`-f source=realtor`). Second run should detect no new data → `has_new_data=false` → green, no refresh dispatched. Proves "quiet week = green no-op."

---

## Self-Review

**Spec coverage:** weekly once-a-week ✓ (Task 2 cron); I pick the day → Tuesday ✓; refresh after upsert ✓ (trigger-refresh needs:import); no new data ≠ failure ✓ (decide step → green no-op). **Placeholders:** two explicit NOTE callouts flag assumptions to confirm at implementation (supabase client export path; zillow default-incremental; post-import `trigger_source` input) — verify, don't guess. **Consistency:** `has_new_data` output name, `latest-periods.ts` path, and `--only` ids match across tasks.
