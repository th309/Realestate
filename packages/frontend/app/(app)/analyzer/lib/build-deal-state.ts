import { DEAL_STATE_VERSION, type DealStateV2 } from "./deal-state-types";

export type BuildDealStateArgs = Omit<DealStateV2, "v">;

/**
 * Compose a `DealStateV2` for persistence into `input_snapshot`.
 *
 * Deliberately a plain mapping with no derivation: everything here is a
 * value the user authored or a snapshot we are choosing to restore rather
 * than refetch. If you find yourself computing something in this function,
 * it probably belongs in the recompute path instead.
 */
export function buildDealState(args: BuildDealStateArgs): DealStateV2 {
  return { v: DEAL_STATE_VERSION, ...args };
}
