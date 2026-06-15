# PIQ Validation Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sequential `piq-validation-report` self-review with an end-to-end multi-agent Workflow (`compute → draft → adversarial verify → synthesize`) that cannot ship a report with an unflagged rule violation.

**Architecture:** A reusable named Workflow script at `.claude/workflows/piq-validation.js` runs 4 barrier-separated phases. Two of the five verifier lenses (editorial, structure) are backed by a deterministic, unit-tested `scripts/analysis/report-lint.js`; the three judgment lenses (number-tracing, benchmark-horizon, dollar-derivation) are LLM verifier agents. A fix→re-verify loop runs until clean or 3 rounds, then ships with an explicit `## UNRESOLVED VIOLATIONS` section rather than a false all-clean.

**Tech Stack:** Workflow tool (JS, restricted sandbox — no fs/require of local modules inside the script; agents do file I/O via Read/Bash), Node 20 for the linter + its tests, Python backtest pipeline (`scripts/analysis/*.py`), the existing `piq-validation-report` skill references.

**Spec:** `docs/superpowers/specs/2026-06-14-piq-validation-workflow-design.md`

**Pre-req (read before starting):**

- `.claude/skills/piq-validation-report/SKILL.md` — the Five Absolute Rules, Prohibited Content, post-gen checklist, section order.
- `.claude/skills/piq-validation-report/references/report-template.md` and `references/data-dictionary.md` — the draft agent reads these at runtime.
- The Workflow tool description (meta/phase/agent/parallel/schema) — how a workflow script is authored.

---

## File Structure

- `scripts/analysis/report-lint.js` — **new.** Deterministic regex linter for the mechanical editorial + structure rules. Pure: reads a markdown file path, prints JSON findings, exits 0 (clean) or 1 (violations). Runnable: `node scripts/analysis/report-lint.js <report.md>`.
- `scripts/analysis/__tests__/report-lint.test.js` — **new.** Node assertion suite (same pattern as `.claude/hooks/__tests__/run-tests.js`).
- `scripts/analysis/__fixtures__/known-bad-report.md` — **new.** A report seeded with planted violations, used by both the linter tests and the workflow gate-proof.
- `.claude/workflows/piq-validation.js` — **new.** The workflow script (meta + 4 phases + schemas + loop).
- `.claude/skills/piq-validation-report/SKILL.md` — **modify.** Add a "Run as a Workflow" section that offers to launch the workflow.

---

## Task 1: Deterministic report linter — editorial rules

**Files:**

- Create: `scripts/analysis/report-lint.js`
- Test: `scripts/analysis/__tests__/report-lint.test.js`

- [ ] **Step 1: Write the failing test**

```js
// scripts/analysis/__tests__/report-lint.test.js
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const LINT = path.join(__dirname, "..", "report-lint.js");

function lint(markdown) {
  const tmp = path.join(
    os.tmpdir(),
    `lint-${process.pid}-${Math.floor(performance.now())}.md`,
  );
  fs.writeFileSync(tmp, markdown);
  let out = "";
  try {
    out = execFileSync("node", [LINT, tmp], { encoding: "utf8" });
  } catch (e) {
    out = e.stdout || ""; // exit 1 when violations found
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return JSON.parse(out);
}

let pass = 0;
const fails = [];
const ok = (label, cond) => (cond ? pass++ : fails.push(label));

// EDITORIAL
ok(
  "flags superlative 'strongest'",
  lint("The strongest market led.").violations.some(
    (v) => v.rule === "editorial",
  ),
);
ok(
  "flags forward-looking 'will outperform'",
  lint("Q5 will outperform Q1.").violations.some((v) => v.rule === "editorial"),
);
ok(
  "flags ROE language",
  lint("Returns on $50,000 down payment.").violations.some(
    (v) => v.rule === "editorial",
  ),
);
ok(
  "clean editorial prose passes",
  lint("Q5 realized a 4.2% excess return vs state.").violations.every(
    (v) => v.rule !== "editorial",
  ),
);

console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log("FAILURES:\n  " + fails.join("\n  "));
  process.exit(1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/analysis/__tests__/report-lint.test.js`
Expected: FAIL — `Cannot find module '.../report-lint.js'` (file does not exist yet).

- [ ] **Step 3: Write minimal implementation (editorial rules only)**

```js
// scripts/analysis/report-lint.js
// Deterministic linter for the mechanical PIQ validation-report rules.
// Reads a markdown report, prints {violations:[{rule,line,match,detail}]} to
// stdout. Exit 1 if any violation, else 0. The editorial + structure verifier
// agents run this as their deterministic backbone.
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  process.stderr.write("usage: node report-lint.js <report.md>\n");
  process.exit(2);
}
const text = fs.readFileSync(file, "utf8");
const lines = text.split("\n");
const violations = [];
const add = (rule, lineIdx, match, detail) =>
  violations.push({
    rule,
    line: lineIdx + 1,
    match: String(match).slice(0, 80),
    detail,
  });

// --- EDITORIAL (Rule 5 + Prohibited 3,6,7) ---
const EDITORIAL = [
  {
    re: /\b(strongest|best|most powerful|exceptional|weakest|unmatched|outstanding)\b/i,
    detail: "superlative",
  },
  {
    re: /\b(will outperform|expected to|poised to|going to outperform)\b/i,
    detail: "forward-looking",
  },
  {
    re: /\b(concerning|alarming|impressive|remarkable)\b/i,
    detail: "emotional framing",
  },
  {
    re: /\bROE\b|return on equity|leveraged return|on \$[\d,]+ down/i,
    detail: "ROE/leverage",
  },
];
lines.forEach((l, i) => {
  if (l.trim().startsWith(">")) return; // skip blockquotes/notes
  for (const { re, detail } of EDITORIAL) {
    const m = l.match(re);
    if (m) add("editorial", i, m[0], detail);
  }
});

process.stdout.write(JSON.stringify({ violations }, null, 2));
process.exit(violations.length ? 1 : 0);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/analysis/__tests__/report-lint.test.js`
Expected: `4 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add scripts/analysis/report-lint.js scripts/analysis/__tests__/report-lint.test.js
git commit -m "feat(piq-validation): deterministic editorial linter for validation report"
```

---

## Task 2: Linter — structure rules (section numbering, quintile labels, 1Y headlines)

**Files:**

- Modify: `scripts/analysis/report-lint.js`
- Modify: `scripts/analysis/__tests__/report-lint.test.js`

- [ ] **Step 1: Add failing tests for the structure rules**

Append to the test file, before the summary line (`console.log(...)`):

```js
// STRUCTURE
ok(
  "flags non-sequential section numbering",
  lint("## 1. A\n## 3. C").violations.some(
    (v) => v.rule === "structure" && /numbering/.test(v.detail),
  ),
);
ok(
  "flags unlabeled quintile 'Excess Return' header",
  lint("| Quintile | Excess Return |\n|---|---|").violations.some(
    (v) => v.rule === "structure" && /vs State/.test(v.detail),
  ),
);
ok(
  "accepts 'Excess Return (vs State)'",
  lint("| Quintile | Excess Return (vs State) |\n|---|---|").violations.every(
    (v) => v.rule !== "structure",
  ),
);
ok(
  "flags 1Y in executive summary",
  lint(
    "## 1. Executive Summary\nThe 1Y return was 5%.\n## 2. Next",
  ).violations.some((v) => v.rule === "structure" && /1Y/.test(v.detail)),
);
ok(
  "sequential numbering passes",
  lint("## 1. A\n## 2. B\n## 3. C").violations.every(
    (v) => v.rule !== "structure",
  ),
);
```

- [ ] **Step 2: Run to verify the new assertions fail**

Run: `node scripts/analysis/__tests__/report-lint.test.js`
Expected: FAIL — the 5 new structure assertions fail (structure rules not implemented), editorial ones still pass.

- [ ] **Step 3: Implement structure rules**

In `report-lint.js`, insert before the final `process.stdout.write(...)`:

```js
// --- STRUCTURE (Rule 4 + checklist) ---
// Section numbering: top-level "## N. Title" must be sequential 1..N, no gaps/dupes.
const sectionNums = [];
lines.forEach((l, i) => {
  const m = l.match(/^##\s+(\d+)\.\s/);
  if (m) sectionNums.push({ n: Number(m[1]), line: i });
});
sectionNums.forEach((s, idx) => {
  if (s.n !== idx + 1)
    add(
      "structure",
      s.line,
      `## ${s.n}.`,
      `section numbering: expected ${idx + 1}, got ${s.n}`,
    );
});

// Quintile tables: a header cell containing "Excess Return" must read
// "Excess Return (vs State)" or "Total Excess Return (vs State)".
lines.forEach((l, i) => {
  if (!l.includes("|")) return;
  for (const cell of l.split("|")) {
    if (
      /excess return/i.test(cell) &&
      !/excess return \(vs state\)/i.test(cell)
    ) {
      add(
        "structure",
        i,
        cell.trim(),
        'quintile column must say "Excess Return (vs State)"',
      );
    }
  }
});

// 1Y returns inside the Executive Summary (§1) — headline metric prohibition.
const execStart = lines.findIndex((l) =>
  /^##\s+1\.\s.*executive summary/i.test(l),
);
if (execStart !== -1) {
  let end = lines.findIndex((l, i) => i > execStart && /^##\s+\d+\./.test(l));
  if (end === -1) end = lines.length;
  for (let i = execStart; i < end; i++) {
    const m = lines[i].match(/\b1[\s-]?(?:Y|yr|year)\b/i);
    if (m)
      add(
        "structure",
        i,
        m[0],
        "1Y return in Executive Summary (headline prohibition)",
      );
  }
}
```

- [ ] **Step 4: Run to verify all pass**

Run: `node scripts/analysis/__tests__/report-lint.test.js`
Expected: `9 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add scripts/analysis/report-lint.js scripts/analysis/__tests__/report-lint.test.js
git commit -m "feat(piq-validation): linter structure rules (numbering, quintile labels, 1Y headlines)"
```

---

## Task 3: Known-bad-report fixture + gate-proof test

**Files:**

- Create: `scripts/analysis/__fixtures__/known-bad-report.md`
- Modify: `scripts/analysis/__tests__/report-lint.test.js`

- [ ] **Step 1: Create the seeded fixture (4 planted, mechanically-detectable violations)**

```markdown
<!-- scripts/analysis/__fixtures__/known-bad-report.md -->

## 1. Executive Summary

The strongest markets in Q5 delivered the 1Y return shown below.

## 2. What the Scores Predict

| Quintile | Excess Return |
| -------- | ------------- |
| Q5       | 4.2%          |

## 4. Out-of-Sample Results

Excess spread of 3.1% vs state.
```

This intentionally contains: a superlative ("strongest"), a 1Y return in §1, an unlabeled "Excess Return" column, and a section-numbering gap (1, 2, 4 — no 3).

- [ ] **Step 2: Add a failing test asserting all four are caught**

Append before the summary line in the test file:

```js
// GATE PROOF against the committed fixture
const fixturePath = path.join(
  __dirname,
  "..",
  "__fixtures__",
  "known-bad-report.md",
);
const fixtureFindings = (() => {
  let out = "";
  try {
    out = execFileSync("node", [LINT, fixturePath], { encoding: "utf8" });
  } catch (e) {
    out = e.stdout || "";
  }
  return JSON.parse(out).violations;
})();
ok(
  "fixture: superlative caught",
  fixtureFindings.some((v) => v.detail === "superlative"),
);
ok(
  "fixture: 1Y headline caught",
  fixtureFindings.some((v) => /1Y/.test(v.detail)),
);
ok(
  "fixture: unlabeled quintile caught",
  fixtureFindings.some((v) => /vs State/.test(v.detail)),
);
ok(
  "fixture: numbering gap caught",
  fixtureFindings.some((v) => /numbering/.test(v.detail)),
);
```

- [ ] **Step 3: Run — verify the four gate-proof assertions pass**

Run: `node scripts/analysis/__tests__/report-lint.test.js`
Expected: `13 passed, 0 failed` (the linter already implements all four rules; this proves it against a realistic seeded report).

- [ ] **Step 4: Commit**

```bash
git add scripts/analysis/__fixtures__/known-bad-report.md scripts/analysis/__tests__/report-lint.test.js
git commit -m "test(piq-validation): known-bad fixture proves linter catches planted violations"
```

---

## Task 4: Workflow scaffold — meta, schemas, compute phase (with hard abort)

**Files:**

- Create: `.claude/workflows/piq-validation.js`

- [ ] **Step 1: Write the workflow header, schemas, and Phase 0 (Compute)**

```js
// .claude/workflows/piq-validation.js
export const meta = {
  name: "piq-validation",
  description:
    "End-to-end PropertyIQ monthly validation: run the backtest, draft the report, adversarially verify it against the Five Absolute Rules, and synthesize the final validation_report.md.",
  phases: [
    { title: "Compute" },
    { title: "Draft" },
    { title: "Verify" },
    { title: "Synthesize" },
  ],
};

const OUT = "scripts/analysis/output";
const SKILL = ".claude/skills/piq-validation-report";
const REQUIRED = [
  `${OUT}/optimized_weights.json`,
  `${OUT}/optimized_weights_county.json`,
  `${OUT}/optimized_weights_zip.json`,
  `${OUT}/validation_results_state.json`,
  `${OUT}/validation_results_division.json`,
];
const DRAFT = `${OUT}/validation_report.draft.md`;
const FINAL = `${OUT}/validation_report.md`;

const COMPUTE_SCHEMA = {
  type: "object",
  required: ["allFilesPresent", "missing"],
  properties: {
    allFilesPresent: { type: "boolean" },
    missing: { type: "array", items: { type: "string" } },
    pipelineErrors: { type: "array", items: { type: "string" } },
  },
};

// ---- Phase 0: Compute ----
phase("Compute");
await parallel([
  () =>
    agent(
      "Run exactly this from the repo root and report exit status + stderr tail: `python scripts/analysis/optimize_weights.py --score-type both --output-dir scripts/analysis/output`",
      { label: "optimize_weights", model: "haiku" },
    ),
  () =>
    agent(
      "Run exactly this from the repo root and report exit status + stderr tail: `python scripts/analysis/validate_scores.py --benchmark both --output-dir scripts/analysis/output`",
      { label: "validate_scores", model: "haiku" },
    ),
]);

const fileCheck = await agent(
  `Check that EACH of these files exists and is non-empty JSON: ${REQUIRED.join(", ")}. ` +
    `Return allFilesPresent, the list of any missing/empty ones, and any pipeline error strings you can find in recent output.`,
  { label: "verify-json-outputs", model: "haiku", schema: COMPUTE_SCHEMA },
);

if (!fileCheck || !fileCheck.allFilesPresent) {
  const missing = (fileCheck && fileCheck.missing) || REQUIRED;
  log(
    `ABORT: backtest outputs missing: ${missing.join(", ")}. No report produced.`,
  );
  return {
    aborted: true,
    missing,
    pipelineErrors: fileCheck?.pipelineErrors || [],
  };
}
log("Compute complete — all 5 JSON outputs present.");
```

- [ ] **Step 2: Structural sanity check (no runner available pre-execution)**

The Workflow JS runs only inside the Workflow tool, so it cannot be `node`-executed standalone. Instead verify the literal `meta` block is well-formed and the file has balanced braces:

Run: `node -e "const s=require('fs').readFileSync('.claude/workflows/piq-validation.js','utf8'); const m=s.match(/export const meta = (\{[\s\S]*?\n\})/); console.log('meta found:', !!m); const o=(s.match(/\{/g)||[]).length, c=(s.match(/\}/g)||[]).length; console.log('braces balanced:', o===c, o, c);"`
Expected: `meta found: true` and `braces balanced: true`.

- [ ] **Step 3: Commit**

```bash
git add .claude/workflows/piq-validation.js
git commit -m "feat(piq-validation): workflow scaffold + compute phase with hard abort on missing JSON"
```

---

## Task 5: Draft phase (single coherent agent)

**Files:**

- Modify: `.claude/workflows/piq-validation.js`

- [ ] **Step 1: Add the draft schema + Phase 1**

Insert after the `log("Compute complete ...")` line:

```js
const DRAFT_SCHEMA = {
  type: "object",
  required: ["draftPath", "homeValueSource"],
  properties: {
    draftPath: { type: "string" },
    homeValueSource: { type: "string" },
    headlineNumbers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          jsonPath: { type: "string" },
        },
      },
    },
  },
};

// ---- Phase 1: Draft ----
phase("Draft");
const draft = await agent(
  [
    `Write the PropertyIQ monthly validation report draft to ${DRAFT}.`,
    `Read these first and follow them EXACTLY:`,
    `- ${SKILL}/references/report-template.md (exact section order + placeholders)`,
    `- ${SKILL}/references/data-dictionary.md (every metric -> JSON source path)`,
    `- ${SKILL}/SKILL.md (the Five Absolute Rules, Prohibited Content, section order, edge cases)`,
    `Data sources: the 5 JSON files in ${OUT}. For dollar conversions, query the latest median home values from the DB (cite source month/year); if the DB is unavailable, write "N/A" and flag it — never fabricate.`,
    `Adapt any legacy 3-score (HomeReady/InvestorEdge) template language to the single PropertyIQ Score.`,
    `Every number must trace to a JSON path or a cited external source. Keep cross-section numbers consistent (the Executive Summary must match Section 3).`,
    `Return draftPath, the homeValueSource string, and headlineNumbers (label/value/jsonPath) for the key figures you used.`,
  ].join("\n"),
  { label: "draft-report", model: "opus", schema: DRAFT_SCHEMA },
);
log(
  `Draft written to ${draft.draftPath} (home values: ${draft.homeValueSource}).`,
);
```

- [ ] **Step 2: Structural check**

Run: `node -e "const s=require('fs').readFileSync('.claude/workflows/piq-validation.js','utf8'); const o=(s.match(/\{/g)||[]).length,c=(s.match(/\}/g)||[]).length; console.log('balanced:', o===c);"`
Expected: `balanced: true`

- [ ] **Step 3: Commit**

```bash
git add .claude/workflows/piq-validation.js
git commit -m "feat(piq-validation): draft phase — single coherent Opus drafting agent"
```

---

## Task 6: Verify + synthesize phases with loop-until-clean

**Files:**

- Modify: `.claude/workflows/piq-validation.js`

- [ ] **Step 1: Add the verify lenses, findings schema, and the fix→re-verify loop**

Insert after the `log("Draft written ...")` line:

```js
const FINDINGS_SCHEMA = {
  type: "object",
  required: ["verifier", "violations"],
  properties: {
    verifier: { type: "string" },
    violations: {
      type: "array",
      items: {
        type: "object",
        required: ["rule", "location", "found"],
        properties: {
          rule: { type: "string" },
          location: { type: "string" },
          expected: { type: "string" },
          found: { type: "string" },
          severity: { type: "string", enum: ["blocker", "warn"] },
        },
      },
    },
  },
};

// Five lenses. editorial + structure run the deterministic linter; the other
// three are pure LLM judgment. All are prompted adversarially.
const LENSES = [
  {
    key: "number-tracing",
    prompt: `Adversarially verify ${FINAL}: every numeric value must trace to a JSON path in ${SKILL}/references/data-dictionary.md (read the 5 JSON in ${OUT}) or a cited external source. Flag any value you cannot trace. If unsure, flag it.`,
  },
  {
    key: "benchmark-horizon",
    prompt: `Adversarially verify ${FINAL}: the model must be described as "3Y excess return vs state" everywhere; NO 1Y returns in headline metrics/exec summary; Census Division may appear ONLY in Section 5. Flag any violation.`,
  },
  {
    key: "dollar-derivation",
    prompt: `Adversarially verify ${FINAL}: dollar values must derive from 3Y excess spreads (Q5_excess - Q1_excess), NOT raw returns; no ROE/leverage/"on $X down"; the median home value source + date must be cited. Flag any violation.`,
  },
  {
    key: "editorial",
    prompt: `Run \`node scripts/analysis/report-lint.js ${FINAL}\` and report every editorial finding it returns. THEN read ${FINAL} for any superlative/forward-looking/emotional framing the regex missed. Return all as violations.`,
  },
  {
    key: "structure",
    prompt: `Run \`node scripts/analysis/report-lint.js ${FINAL}\` and report every structure finding. THEN verify section order matches ${SKILL}/SKILL.md, degradation uses the same benchmark in both columns, and the Executive Summary numbers match Section 3. Return all as violations.`,
  },
];

// The synthesizer needs the draft promoted to FINAL before the first verify pass.
await agent(
  `Copy ${DRAFT} to ${FINAL} verbatim (the verify/fix loop edits ${FINAL}).`,
  { label: "promote-draft", model: "haiku" },
);

let round = 0;
let unresolved = [];
let totalFixed = 0;
while (round < 3) {
  round++;
  phase("Verify");
  const findings = (
    await parallel(
      LENSES.map(
        (lens) => () =>
          agent(lens.prompt, {
            label: `verify:${lens.key}`,
            phase: "Verify",
            model:
              lens.key === "editorial" || lens.key === "structure"
                ? "sonnet"
                : "sonnet",
            schema: FINDINGS_SCHEMA,
          }),
      ),
    )
  ).filter(Boolean);

  const open = findings.flatMap((f) =>
    (f.violations || []).map((v) => ({ ...v, verifier: f.verifier })),
  );
  log(`Round ${round}: ${open.length} violation(s) found.`);
  if (open.length === 0) {
    unresolved = [];
    break;
  }

  phase("Synthesize");
  await agent(
    `Fix these violations in ${FINAL} without introducing new ones (re-read ${SKILL}/SKILL.md rules). Violations:\n` +
      JSON.stringify(open, null, 2),
    { label: `synthesize:round-${round}`, phase: "Synthesize", model: "opus" },
  );
  totalFixed += open.length;
  unresolved = open; // carried forward; cleared if next round is clean
}

if (unresolved.length) {
  await agent(
    `The verify loop did not converge after 3 rounds. Append a section titled exactly "## UNRESOLVED VIOLATIONS" to ${FINAL} listing each of these, then STOP. Do not delete content to make them disappear.\n` +
      JSON.stringify(unresolved, null, 2),
    { label: "mark-unresolved", model: "sonnet" },
  );
}

return {
  reportPath: FINAL,
  rounds: round,
  totalViolationsFixed: totalFixed,
  clean: unresolved.length === 0,
  unresolved,
};
```

- [ ] **Step 2: Structural check + lens count**

Run: `node -e "const s=require('fs').readFileSync('.claude/workflows/piq-validation.js','utf8'); const o=(s.match(/\{/g)||[]).length,c=(s.match(/\}/g)||[]).length; console.log('balanced:',o===c); console.log('lenses:',(s.match(/key: \"/g)||[]).length);"`
Expected: `balanced: true` and `lenses: 5`.

- [ ] **Step 3: Commit**

```bash
git add .claude/workflows/piq-validation.js
git commit -m "feat(piq-validation): verify lenses + synthesize loop-until-clean (3-round cap, unresolved section)"
```

---

## Task 7: Wire the skill to offer the workflow

**Files:**

- Modify: `.claude/skills/piq-validation-report/SKILL.md`

- [ ] **Step 1: Add a "Run as a Workflow" section after "What This Skill Does"**

Insert this block immediately after the `## What This Skill Does` section:

```markdown
## Run as a Workflow (recommended)

This report can be produced end-to-end by the `piq-validation` Workflow
(`.claude/workflows/piq-validation.js`), which runs the compute, drafts the
report, then verifies it with five independent adversarial agents
(loop-until-clean, 3-round cap) before writing `validation_report.md`.

The Workflow requires explicit opt-in and is billed (it can spawn ~20 agents).
**Offer it, do not auto-run it:** when asked to generate the monthly report,
ask the user whether to launch the `piq-validation` workflow or to run the
manual steps below. The workflow never fires on its own.

The deterministic editorial/structure checks live in
`scripts/analysis/report-lint.js` (`node scripts/analysis/report-lint.js <report.md>`)
and can be run by hand against any draft.
```

- [ ] **Step 2: Verify the section was added and the skill still parses its frontmatter**

Run: `node -e "const s=require('fs').readFileSync('.claude/skills/piq-validation-report/SKILL.md','utf8'); console.log('has workflow section:', s.includes('Run as a Workflow')); console.log('frontmatter intact:', s.startsWith('---'));"`
Expected: both `true`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/piq-validation-report/SKILL.md
git commit -m "docs(piq-validation): skill offers the piq-validation workflow"
```

---

## Task 8: End-to-end verification (user-invoked, opt-in)

**Files:** none (verification only).

> The Workflow tool requires explicit user opt-in to run, so this task is a
> guided manual verification, not an automated test. Do NOT launch the workflow
> without the user's go-ahead.

- [ ] **Step 1: Gate proof against the known-bad fixture**

Ask the user to launch the workflow's verify phase against `scripts/analysis/__fixtures__/known-bad-report.md` (copy it to `${OUT}/validation_report.md` first). Expected: the editorial + structure verifiers report the 4 planted violations (superlative, 1Y headline, unlabeled quintile, numbering gap), and the synthesizer removes them. Confirms the gate catches real violations.

- [ ] **Step 2: Real end-to-end run**

With user opt-in, run the full `piq-validation` workflow against the live pipeline. Expected result object: `{ reportPath, rounds (1–3), clean: true | unresolved: [...] }`.

- [ ] **Step 3: Spot-check (the "real DB" gate)**

Manually verify ≥5 headline numbers in the produced `validation_report.md` against the raw JSON via `data-dictionary.md`, and confirm the report passes the skill's own post-generation checklist. If `clean: false`, confirm the `## UNRESOLVED VIOLATIONS` section is present and accurate.

- [ ] **Step 4: No commit** (verification only; the produced report lives in `scripts/analysis/output/` and follows the existing report's commit conventions).

---

## Self-Review

**Spec coverage:**

- Compute phase + 5-file hard abort → Task 4. ✓
- Single-draft (Approach A) → Task 5. ✓
- 5 verifier lenses mapped to the rules → Tasks 1–2 (editorial/structure via linter) + Task 6 (3 LLM lenses). ✓
- Loop-until-clean, 3-round cap, UNRESOLVED section, never false all-clean → Task 6. ✓
- Model tiers (Opus draft/synth, Sonnet verify, Haiku compute) → Tasks 4–6. ✓
- Schemas (compute/draft/findings/result) → Tasks 4–6. ✓
- Reusable named workflow at `.claude/workflows/piq-validation.js` → Task 4. ✓
- Testing: known-bad fixture (Task 3) + real E2E (Task 8). ✓
- Invocation: skill offers, never auto-runs → Task 7. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code; agent prompts are literal. The workflow JS cannot be unit-run standalone (tool-sandbox reality) — this is handled honestly with structural checks + a user-invoked E2E task rather than a fake unit test.

**Type/name consistency:** `COMPUTE_SCHEMA`/`DRAFT_SCHEMA`/`FINDINGS_SCHEMA`, constants `OUT`/`SKILL`/`REQUIRED`/`DRAFT`/`FINAL`, and the `report-lint.js` rule keys (`editorial`, `structure`) are consistent across tasks. Linter exit codes (0 clean / 1 violations) match how the test harness reads stdout.

**Known deviation from spec (flag for review):** editorial + structure verifier lenses are implemented as the deterministic `report-lint.js` (unit-tested) backing an LLM agent, rather than pure LLM. This makes ~40% of the gate testable and cheaper, at the cost of one extra small module.
