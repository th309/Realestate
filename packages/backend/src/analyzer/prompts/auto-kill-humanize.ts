/**
 * Auto-kill code humanization. The grading engine emits machine-readable
 * codes like `REFI_NOT_FINANCEABLE` for hard disqualifications; this maps
 * each to a plain-English sentence so the AI prompt never has to ask the
 * LLM to translate raw identifiers. When the LLM is given pre-humanized
 * text in its context, the output prose stays clean (no `REFI_NOT_FINANCEABLE`
 * leaking into the user-facing analysis, which was a real defect).
 *
 * Unknown codes fall back to a lowercased, underscore-replaced form so the
 * model has something readable to work with rather than the raw identifier.
 */
const AUTO_KILL_HUMAN: Record<string, string> = {
  REFI_NOT_FINANCEABLE:
    "the refinance can't be financed at the projected ARV and LTV",
  NEGATIVE_CASHFLOW_SEVERE: 'monthly cashflow is deeply negative',
  DSCR_BELOW_FLOOR: 'debt service coverage is below lender minimums',
  DSCR_BELOW_1:
    'debt service coverage is below 1.0, so rent does not cover the mortgage',
  LTV_TOO_HIGH: 'the loan-to-value exceeds policy limits',
  REHAB_BUDGET_BLOWN: 'the rehab budget consumes too much of the deal margin',
  ARV_BELOW_ALL_IN:
    'the after-repair value comes in below the all-in basis (you would lose money on resale)',
};

export function humanizeAutoKill(code: string): string {
  if (AUTO_KILL_HUMAN[code]) return AUTO_KILL_HUMAN[code];
  return code.toLowerCase().replace(/_/g, ' ');
}
