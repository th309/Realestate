import type { SecondaryTile } from "./strategy-secondary-mappers";
import type { TileContext } from "./strategy-tile-mappers";

/**
 * Commercial MF (5+ units) "All metrics" expander content. Surfaces the
 * commercial underwriting outputs that don't have a home in the primary tiles:
 *   - Implied value at market cap (NOI / cap)
 *   - Max-LTV vs Max-DSCR loan sizing + which one is binding
 *   - Balloon balance due at the loan's term date
 *   - Capex reserve actually applied
 */
export function getCommercialSecondary(ctx: TileContext): SecondaryTile[] {
  const { input, rental, projection } = ctx;
  const c = rental.commercial;
  const rentAnnual = (input.rentMonthly ?? 0) * 12;
  const price = input.price ?? 0;
  const grm = rentAnnual > 0 ? price / rentAnnual : null;
  const bindingLabel =
    c?.bindingConstraint === "dscr"
      ? "DSCR-limited"
      : c?.bindingConstraint === "ltv"
        ? "LTV-limited"
        : c?.bindingConstraint === "neither"
          ? "Both at cap"
          : "—";
  return [
    { label: "GRM", value: grm, format: "ratio" },
    {
      label: "Implied value @ market cap",
      value: c?.impliedValueAtMarketCap ?? null,
      format: "currency",
    },
    {
      label: "Max loan (LTV)",
      value: c?.maxLtvLoan ?? null,
      format: "currency",
    },
    {
      label: "Max loan (DSCR)",
      value: c?.maxDscrLoan ?? null,
      format: "currency",
    },
    {
      label: "Effective loan",
      value: c?.effectiveLoan ?? null,
      format: "currency",
    },
    { label: "Binding constraint", value: bindingLabel, format: "raw" },
    {
      label: "Balloon balance (at term)",
      value: c?.balloonBalance ?? null,
      format: "currency",
    },
    {
      label: "Capex reserve (annual)",
      value: c?.capexReserveAnnual ?? null,
      format: "currency",
    },
    {
      label: "IRR (10y)",
      value:
        projection.horizons.y10?.irr != null
          ? projection.horizons.y10.irr * 100
          : null,
      format: "percent",
    },
  ];
}
