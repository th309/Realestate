import { migrateDealState } from "../migrate-snapshot";
import type { DealStateV2 } from "../deal-state-types";

/**
 * A complete, fully-defaulted `DealStateV2` for tests, plus overrides.
 *
 * Built through `migrateDealState({})` rather than hand-written so the
 * fixture cannot drift from the type: when `DealStateV2` grows a field, the
 * migration's defaults supply it here too, and a test that was silently
 * relying on the field's absence starts exercising its real default instead.
 */
export function makeDealState(
  overrides: Partial<DealStateV2> = {},
): DealStateV2 {
  return { ...migrateDealState({}), ...overrides };
}
