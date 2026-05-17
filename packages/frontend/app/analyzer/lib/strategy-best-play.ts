import type {
  RentalResult,
  FlipResult,
  BrrrrResult,
  ProjectionResult,
} from "@propertyiq/analyzer-core";
import { pickBestPlay } from "../components/StrategyCompare/BestPlayCallout";
import type { Strategy } from "./strategy-tile-mappers";

/**
 * Wraps the existing 3-strategy pickBestPlay() and widens the return type to
 * the 4-strategy Strategy union (Multifamily is never auto-picked in v1; users
 * select it manually via the chip group).
 */
export function computeBestPlay(
  rental: RentalResult,
  flip: FlipResult | null,
  brrrr: BrrrrResult | null,
  projection: ProjectionResult,
): Strategy {
  return pickBestPlay({
    buyAndHold: {
      irr10: projection.horizons.y10.irr,
      cashflowMonthly: rental.cashflowMonthly ?? 0,
    },
    flip: {
      roiPct: flip?.projectedRoiPct ?? 0,
      projectedProfit: flip?.projectedProfit ?? 0,
    },
    brrrr: {
      score: brrrr?.score ?? 0,
      postRefiCashflow: brrrr?.postRefiCashflowMonthly ?? 0,
    },
  }) as Strategy;
}
