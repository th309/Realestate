/**
 * Resolve the flat `DealInput` a read-only render needs, from a saved row
 * whose `input_snapshot` may be either shape.
 *
 * Two shapes have lived in that column:
 *  - **v1**: the bare `DealInput` — `{ price, rentMonthly, financing, … }`.
 *  - **v2**: a versioned `DealStateV2` envelope that NESTS the `DealInput`
 *    under `.input` alongside the rest of the resumable deal state.
 *
 * Everything downstream (`InputsTable`, the projection and sensitivity
 * charts) reads `price` / `rentMonthly` / `financing` off the top level, so
 * handing it a v2 envelope renders a client-facing report full of blanks
 * and zeros — not a crash, which is exactly why it needs pinning here.
 *
 * `result_snapshot.input` is still the preferred source: it is the frozen
 * artifact the link was published from, and it is always flat. This is the
 * fallback for rows saved before that field existed, or saved but never
 * shared.
 */

import { DEAL_STATE_VERSION } from "@/app/analyzer/lib/deal-state-types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function resolveRenderInput(
  snapshotInput: Record<string, unknown> | undefined,
  rowInputSnapshot: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (snapshotInput) return snapshotInput;

  const saved = asRecord(rowInputSnapshot);
  if (!saved) return null;

  // Unwrap the versioned envelope. A v2 row whose `.input` is missing or
  // malformed resolves to null rather than to the envelope itself — the
  // sections that take `input` all hide on null, which is honest, whereas
  // the envelope would render every figure as a blank or a zero.
  if (saved.v === DEAL_STATE_VERSION) return asRecord(saved.input);

  return saved;
}
