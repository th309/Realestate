/**
 * Client-side market-analysis template generator.
 *
 * Produces the deterministic, data-driven homebuyer/investor sections shown
 * when AI insights are not enabled (no API call). Mirrors the backend
 * generateFallback() logic in market-analysis.service.ts.
 *
 * Extracted from AIMarketAnalysis.tsx to keep that component under the
 * file-size limit (CLAUDE.md Section 1.3).
 */

import type { MarketAnalysisSection } from "@/lib/data";

type MetricMap = Record<
  string,
  {
    value: number | null;
    formattedValue: string;
    percentChange: number | null;
  }
>;

type ScoreMap = {
  propertyiq: { score: number; grade: string } | null;
};

export function generateTemplateAnalysis(
  marketName: string,
  view: "homebuyer" | "investor",
  metrics: MetricMap,
  scores: ScoreMap,
): MarketAnalysisSection[] {
  const val = (key: string): number | null => metrics[key]?.value ?? null;
  const fmt = (key: string): string | null =>
    metrics[key]?.formattedValue ?? null;
  const chg = (key: string): number | null =>
    metrics[key]?.percentChange ?? null;

  if (view === "homebuyer") {
    const piq = scores.propertyiq;
    const scoreDesc = piq
      ? piq.score >= 70
        ? "favorable"
        : piq.score >= 50
          ? "moderate"
          : "challenging"
      : "unknown";

    const affordParts = piq
      ? [
          `${marketName} shows ${scoreDesc} conditions for homebuyers (PropertyIQ score: ${piq.score}).`,
        ]
      : [
          `${marketName} conditions for homebuyers. Score data is currently unavailable.`,
        ];
    if (fmt("listing_price"))
      affordParts.push(`The median listing price is ${fmt("listing_price")}.`);
    if (fmt("income_to_buy"))
      affordParts.push(
        `You'd need roughly ${fmt("income_to_buy")} in annual income to afford a home here.`,
      );
    const yts = val("years_to_save");
    if (yts != null)
      affordParts.push(
        `At current savings rates, expect about ${yts.toFixed(1)} years to save for a down payment.`,
      );

    const speedParts: string[] = [];
    const dom = val("days_on_market");
    if (dom != null)
      speedParts.push(
        `Homes in ${marketName} average ${Math.round(dom)} days on market.`,
      );
    const invChg = chg("for_sale_inventory");
    if (invChg != null)
      speedParts.push(
        `Inventory is ${invChg > 0 ? "up" : "down"} ${Math.abs(invChg).toFixed(1)}% year-over-year.`,
      );
    const pr = val("pending_ratio");
    if (pr != null)
      speedParts.push(
        `The pending ratio sits at ${(pr * 100).toFixed(0)}%, indicating ${pr > 0.4 ? "strong" : "moderate"} buyer activity.`,
      );
    if (speedParts.length === 0)
      speedParts.push(
        `Market pace data for ${marketName} is currently limited.`,
      );

    const priceParts: string[] = [];
    if (fmt("home_value"))
      priceParts.push(`Current median home value: ${fmt("home_value")}.`);
    const hvYoy = val("home_value_yoy");
    if (hvYoy != null)
      priceParts.push(
        `Values are ${hvYoy >= 0 ? "up" : "down"} ${Math.abs(hvYoy).toFixed(1)}% year-over-year.`,
      );
    const hv5yr = val("home_value_5yr");
    if (hv5yr != null)
      priceParts.push(
        `The 5-year annualized growth rate is ${hv5yr.toFixed(1)}%.`,
      );
    const pcPct = val("price_cut_pct");
    if (pcPct != null)
      priceParts.push(
        `${pcPct.toFixed(0)}% of listings have price reductions.`,
      );
    if (priceParts.length === 0)
      priceParts.push(
        `Price trend data for ${marketName} is currently limited.`,
      );

    return [
      { title: "Affordability", analysis: affordParts.join(" ") },
      { title: "Market Speed", analysis: speedParts.join(" ") },
      { title: "Price Trajectory", analysis: priceParts.join(" ") },
    ];
  }

  // Investor
  const piq = scores.propertyiq;
  const scoreDesc = piq
    ? piq.score >= 70
      ? "strong"
      : piq.score >= 50
        ? "moderate"
        : "limited"
    : "unknown";

  const cfParts = piq
    ? [
        `${marketName} shows ${scoreDesc} investment potential (PropertyIQ score: ${piq.score}).`,
      ]
    : [
        `${marketName} investment potential. Score data is currently unavailable.`,
      ];
  const cr = val("cap_rate");
  if (cr != null)
    cfParts.push(
      `Cap rates are around ${cr.toFixed(1)}%, indicating ${cr >= 6 ? "solid cash flow" : cr >= 4 ? "moderate returns" : "appreciation-focused"} potential.`,
    );
  if (fmt("rent_index"))
    cfParts.push(`Median rents at ${fmt("rent_index")}/month.`);
  const gy = val("gross_yield");
  if (gy != null) cfParts.push(`Gross yield: ${gy.toFixed(1)}%.`);

  const growParts: string[] = [];
  const hvYoy = val("home_value_yoy");
  if (hvYoy != null)
    growParts.push(
      `Property values are ${hvYoy >= 0 ? "up" : "down"} ${Math.abs(hvYoy).toFixed(1)}% year-over-year.`,
    );
  const hv5yr = val("home_value_5yr");
  if (hv5yr != null)
    growParts.push(`5-year annualized growth: ${hv5yr.toFixed(1)}%.`);
  const popG = val("population_growth");
  if (popG != null)
    growParts.push(`Population growth of ${popG.toFixed(1)}% supports demand.`);
  const jobG = val("job_growth");
  if (jobG != null) growParts.push(`Job growth: ${jobG.toFixed(1)}%.`);
  if (growParts.length === 0)
    growParts.push(`Growth data for ${marketName} is currently limited.`);

  const liqParts: string[] = [];
  const domVal = val("days_on_market");
  if (domVal != null)
    liqParts.push(`Homes sell in an average of ${Math.round(domVal)} days.`);
  const invChg = chg("for_sale_inventory");
  if (invChg != null)
    liqParts.push(
      `Inventory ${invChg > 0 ? "rising" : "falling"} at ${Math.abs(invChg).toFixed(1)}% YoY.`,
    );
  const pr = val("pending_ratio");
  if (pr != null)
    liqParts.push(
      `Pending ratio of ${(pr * 100).toFixed(0)}% suggests ${pr > 0.4 ? "healthy" : "softer"} demand.`,
    );
  if (scores.propertyiq) {
    liqParts.push(`PropertyIQ score: ${scores.propertyiq.score}/100.`);
  }

  return [
    { title: "Cash Flow Potential", analysis: cfParts.join(" ") },
    { title: "Value Growth", analysis: growParts.join(" ") },
    { title: "Liquidity & Demand", analysis: liqParts.join(" ") },
  ];
}
