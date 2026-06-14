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
