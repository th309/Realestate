/** Matches `@MaxLength(120)` on `AnalysisSnapshotDto.label`. */
const LABEL_MAX_LENGTH = 120;

/**
 * Project the deal's name out of a `DealStateV2` blob and onto the
 * `deal_analyses.label` column.
 *
 * The name lives inside the state blob, but `label` is also its own column —
 * it is what the saved-deals list renders, and that list never opens the
 * blob. Autosave (`patchState`) writes only `input_snapshot`, so without
 * this projection a rename would update the analyzer header and the stored
 * state while the list showed the old name forever.
 *
 * Deliberately a projection of state rather than a widening of
 * `PatchDealStateDto`. That DTO's narrowness is about the PUBLISHED artifact
 * (`result_snapshot`, `market_context`): a keystroke must not mutate a link
 * already in a client's hands. A label is not published — it is deal state,
 * and it already arrived inside the payload the DTO does accept.
 *
 * Returns `{}` for anything that is not a recognisable name, so a legacy
 * bare-`DealInput` snapshot (which carries no `label` key at all) can never
 * NULL out a name the row already holds.
 */
export function projectDealLabel(inputSnapshot: Record<string, unknown>): {
  label?: string | null;
} {
  if (!('label' in inputSnapshot)) return {};
  const label = inputSnapshot.label;
  // `null` is a real value here — it is how an unnamed deal, or a name the
  // user cleared, is represented — so it must reach the column.
  if (label === null) return { label: null };
  if (typeof label !== 'string') return {};
  return { label: label.slice(0, LABEL_MAX_LENGTH) };
}
