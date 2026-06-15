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
const MAX_SYNTH_ROUNDS = 3;
// verify -> (clean? stop) -> (over cap? stop, reporting freshly-verified open) ->
// synth -> loop. A verify ALWAYS follows the last synth, so `unresolved` is never
// stale: it is always the result of a verify pass, never a pre-synth snapshot.
while (true) {
  round++;
  phase("Verify");
  const findings = (
    await parallel(
      LENSES.map(
        (lens) => () =>
          agent(lens.prompt, {
            label: `verify:${lens.key}`,
            phase: "Verify",
            model: "sonnet",
            schema: FINDINGS_SCHEMA,
          }).then((r) => (r ? { ...r, lensKey: lens.key } : null)),
      ),
    )
  ).filter(Boolean);

  // Stamp the lens key from the thunk closure (survives the .filter(Boolean)) so
  // every violation keeps its verifier attribution.
  const open = findings.flatMap((f) =>
    (f.violations || []).map((v) => ({ ...v, verifier: f.lensKey })),
  );
  log(`Round ${round}: ${open.length} violation(s) found.`);

  if (open.length === 0) {
    unresolved = []; // a clean verify pass -> genuinely clean
    break;
  }
  if (round > MAX_SYNTH_ROUNDS) {
    unresolved = open; // freshly verified after the final synth -> truly still-open
    break;
  }

  phase("Synthesize");
  await agent(
    `Fix these violations in ${FINAL} without introducing new ones (re-read ${SKILL}/SKILL.md rules). Violations:\n` +
      JSON.stringify(open, null, 2),
    { label: `synthesize:round-${round}`, phase: "Synthesize", model: "opus" },
  );
  totalFixed += open.length;
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
