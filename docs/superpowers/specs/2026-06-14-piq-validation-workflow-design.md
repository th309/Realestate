# PIQ Validation Workflow — Design Spec

**Date:** 2026-06-14
**Status:** Approved (design) — pending implementation plan
**Topic:** Convert the monthly `piq-validation-report` skill from a single-session sequential pipeline into a multi-agent Workflow with an adversarial verification gate.

## Context

The `piq-validation-report` skill (`.claude/skills/piq-validation-report/`) generates the monthly PropertyIQ Score validation report. Today it runs as one Claude session: run two Python scripts → read five JSON files → fill a multi-section template → self-review against an 11-item checklist. Its entire stated purpose is "preventing fabrication and inconsistency," yet the same session that writes the report also grades it — weak self-review.

This spec designs an **end-to-end Workflow** (`compute → draft → verify → synthesize`) where the verification is performed by **independent adversarial agents**, each trying to _catch_ a rule violation against the raw JSON, with a fix→re-verify loop. It mirrors the "fan out and synthesize" + "adversarial verify" patterns.

Authoritative inputs the workflow depends on (already in the repo):

- `.claude/skills/piq-validation-report/references/report-template.md` — exact report structure + placeholders.
- `.claude/skills/piq-validation-report/references/data-dictionary.md` — every metric and its JSON source path.
- `scripts/analysis/optimize_weights.py`, `scripts/analysis/validate_scores.py` — the backtest pipeline.
- The skill's "Five Absolute Rules," "Prohibited Content," and post-generation checklist — the contract the verifiers enforce.

## Goals

- Independent, adversarial verification of the report against the Five Absolute Rules + Prohibited Content + checklist, before publish.
- End-to-end: run compute, draft, verify, synthesize the final `validation_report.md`.
- Never ship a false "all clean" — unresolved violations are surfaced explicitly.
- Keep the report's cross-section numbers coherent (single drafting agent).

## Non-Goals

- Speeding up the Python compute (it is deterministic single-process work).
- Changing the report's structure, rules, or the backtest methodology.
- Auto-running on a schedule — invocation is explicit and user-triggered (see Invocation).

## Architecture (Approach A — single-draft, fan-out verify)

Four barrier-separated phases. Barriers are correct here because each phase needs the _complete_ output of the prior (you cannot verify a partial report).

### Phase 0 — Compute

`parallel()` two runner agents (Haiku):

- `python scripts/analysis/optimize_weights.py --score-type both --output-dir scripts/analysis/output`
- `python scripts/analysis/validate_scores.py --benchmark both --output-dir scripts/analysis/output`

Then assert all five files exist:
`optimized_weights.json`, `optimized_weights_county.json`, `optimized_weights_zip.json`, `validation_results_state.json`, `validation_results_division.json`.

**If any file is missing → ABORT the workflow, produce no report** (the skill's hard rule). Surface which file is missing and the pipeline error.

> Note: the two scripts read the DB and write disjoint output files, so they are safe to run concurrently. If DB contention is observed, fall back to sequential in a single runner agent.

### Phase 1 — Draft (1 agent, Opus)

Reads `report-template.md`, `data-dictionary.md`, all five JSON files, and queries the DB for the latest median home values (citing source month/year). Writes `scripts/analysis/output/validation_report.draft.md` following the exact section order, the Five Absolute Rules, and Prohibited Content, adapting the legacy 3-score template language to the single PropertyIQ Score. Returns a structured summary `{draftPath, headlineNumbers[], homeValueSource}` so the orchestrator can label downstream work.

Single agent (not fan-out) because the report is numerically coupled across sections (exec summary must match §3; dollar values derive from quintile spreads).

### Phase 2 — Verify (5 agents, parallel, Sonnet)

Each verifier reads the current draft + the relevant JSON + the data-dictionary, is prompted **adversarially** ("find a violation; if you cannot determine, flag it"), and returns findings against a fixed schema. The five lenses:

| Verifier                | Owns                                                                                                              | Maps to                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `number-tracing`        | every numeric value traces to a JSON path or a cited external source                                              | Rule 2 + checklist spot-checks |
| `benchmark-horizon`     | "3Y excess return vs state" everywhere; no 1Y in headlines; Census Division only in §5                            | Rule 1, Prohibited 1·4         |
| `dollar-derivation`     | dollars from excess spreads not raw returns; no ROE/leverage; home-value source+date cited                        | Rule 3, Prohibited 3           |
| `editorial`             | no superlatives / forward-looking / emotional framing; facts + thresholds only                                    | Rule 5, Prohibited 6·7         |
| `structure-consistency` | section order + numbering, quintile column labels, same-benchmark degradation, exec-summary↔§3 number consistency | Rule 4 + checklist             |

### Phase 3 — Synthesize + loop (1 agent, Opus)

Consumes the union of verifier findings, applies fixes, rewrites `validation_report.md`. Then **re-run Phase 2** on the fixed report. Repeat until a fully clean pass **or 3 rounds**. If violations remain after 3 rounds, write the report with an explicit `## UNRESOLVED VIOLATIONS` section listing each, and the workflow returns a non-clean status — **never a false "all clean."**

## Data Flow & Schemas

Large artifacts live on disk; agents exchange **file paths + structured findings**, not full markdown through return values.

- Compute check (schema): `{ allFilesPresent: boolean, missing: string[], pipelineErrors: string[] }`
- Draft summary (schema): `{ draftPath: string, headlineNumbers: {label, value, jsonPath}[], homeValueSource: string }`
- Verifier findings (schema): `{ verifier: string, violations: { rule: string, location: string, expected: string, found: string, severity: "blocker"|"warn" }[] }`
- Final result: `{ reportPath, rounds, totalViolationsFixed, unresolved: [...] }`

## Error Handling

| Condition                                  | Behavior                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Any of 5 JSON files missing after compute  | Hard abort; no report; surface missing file + pipeline error                                                |
| DB unavailable for median home values      | Draft writes "N/A" + flags it; never fabricates a value                                                     |
| Verifier cannot determine a value's source | Counts as a violation (conservative)                                                                        |
| 3 rounds exhausted, violations remain      | Ship report + `## UNRESOLVED VIOLATIONS`; return non-clean status                                           |
| A verifier agent dies (terminal API error) | `.filter(Boolean)`; if a rule-family produced no result, treat that round as not-clean and re-run that lens |

## Model Tiers (cost)

- Draft + Synthesize: **Opus** (coherence, judgment, the strict rules).
- 5 Verifiers: **Sonnet** (focused JSON rule-checks, parallel, cheaper).
- Compute runners: **Haiku** (run bash, check files).
- Worst-case agent count: 2 (compute) + 1 (draft) + 5×3 (verify) + 1×3 (synth) ≈ 21 per monthly run.

## Testing (E2E + real DB)

1. **Known-bad-draft fixture (gate proof):** a draft seeded with planted violations — a 1Y figure in a headline, a superlative ("strongest"), a fabricated number with no JSON path, a quintile column mislabeled. Run Phase 2 against it; assert each verifier flags its planted violation and the synthesizer removes it. Proves the gate actually catches things (same discipline as the hook test suite).
2. **Real end-to-end run:** execute against the live pipeline JSON, human spot-check ≥5 headline numbers against the data-dictionary, confirm the report passes its own post-generation checklist.

## Invocation

- Monthly, **explicitly user-triggered**. The Workflow tool requires opt-in and cannot auto-run.
- The workflow script is saved as a reusable named workflow at `.claude/workflows/piq-validation.js`, so it can be re-invoked each month by name rather than re-authored. The implementation plan owns the exact filename.
- The `piq-validation-report` skill is updated to _offer_ to launch the workflow (and to document the manual fallback). It never fires on its own; no hook/cron triggers it.

## Acceptance Criteria

- [ ] Workflow runs all four phases end-to-end and writes `scripts/analysis/output/validation_report.md`.
- [ ] Missing-JSON abort verified (delete a file → workflow stops, no report).
- [ ] Known-bad-draft fixture: all 4 planted violations caught and fixed.
- [ ] Loop terminates (clean pass ≤3 rounds, or explicit UNRESOLVED section).
- [ ] Real run: report passes the skill's post-generation checklist; ≥5 numbers spot-checked to JSON.
- [ ] No false "all clean" — unresolved violations always surfaced.
