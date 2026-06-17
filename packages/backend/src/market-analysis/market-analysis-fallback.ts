/**
 * Deterministic, data-driven market-analysis fallback.
 *
 * Used when AI generation is unavailable or fails. Produces the same
 * homebuyer/investor section shapes as the AI path, built purely from the
 * supplied metrics and scores (no external calls). The frontend has a mirror
 * of this in app/(app)/market/[id]/market-analysis-template.ts.
 *
 * Extracted from market-analysis.service.ts to keep that service under the
 * file-size limit (CLAUDE.md Section 1.3).
 */

import type {
  AnalysisRequest,
  AnalysisSection,
} from './market-analysis.service';

export function generateFallback(
  request: AnalysisRequest,
  viewType: 'homebuyer' | 'investor',
): AnalysisSection[] {
  const { geoName, metrics, scores } = request;

  const val = (key: string) => metrics[key]?.value ?? null;
  const fmt = (key: string) => metrics[key]?.formatted ?? null;
  const chg = (key: string) => metrics[key]?.change ?? null;

  if (viewType === 'homebuyer') {
    const hs = scores.propertyiq;
    const scoreDesc =
      hs.score >= 70
        ? 'favorable'
        : hs.score >= 50
          ? 'moderate'
          : 'challenging';

    const affordParts = [
      `${geoName} shows ${scoreDesc} conditions for homebuyers (PropertyIQ score: ${hs.score}).`,
    ];
    if (fmt('listing_price'))
      affordParts.push(`The median listing price is ${fmt('listing_price')}.`);
    if (fmt('income_to_buy'))
      affordParts.push(
        `You'd need roughly ${fmt('income_to_buy')} in annual income to afford a home here.`,
      );
    const yts = val('years_to_save');
    if (yts != null)
      affordParts.push(
        `At current savings rates, expect about ${yts.toFixed(1)} years to save for a down payment.`,
      );

    const speedParts: string[] = [];
    const dom = val('days_on_market');
    if (dom != null)
      speedParts.push(
        `Homes in ${geoName} average ${Math.round(dom)} days on market.`,
      );
    const invChg = chg('for_sale_inventory');
    if (invChg != null)
      speedParts.push(
        `Inventory is ${invChg > 0 ? 'up' : 'down'} ${Math.abs(invChg).toFixed(1)}% year-over-year.`,
      );
    const pr = val('pending_ratio');
    if (pr != null)
      speedParts.push(
        `The pending ratio sits at ${(pr * 100).toFixed(0)}%, indicating ${pr > 0.4 ? 'strong' : 'moderate'} buyer activity.`,
      );
    if (speedParts.length === 0)
      speedParts.push(`Market pace data for ${geoName} is currently limited.`);

    const priceParts: string[] = [];
    if (fmt('home_value'))
      priceParts.push(`Current median home value: ${fmt('home_value')}.`);
    const hvYoy = val('home_value_yoy');
    if (hvYoy != null)
      priceParts.push(
        `Values are ${hvYoy >= 0 ? 'up' : 'down'} ${Math.abs(hvYoy).toFixed(1)}% year-over-year.`,
      );
    const hv5yr = val('home_value_5yr');
    if (hv5yr != null)
      priceParts.push(
        `The 5-year annualized growth rate is ${hv5yr.toFixed(1)}%.`,
      );
    const pcPct = val('price_cut_pct');
    if (pcPct != null)
      priceParts.push(
        `${pcPct.toFixed(0)}% of listings have price reductions.`,
      );
    if (priceParts.length === 0)
      priceParts.push(`Price trend data for ${geoName} is currently limited.`);

    return [
      { title: 'Affordability', analysis: affordParts.join(' ') },
      { title: 'Market Speed', analysis: speedParts.join(' ') },
      { title: 'Price Trajectory', analysis: priceParts.join(' ') },
    ];
  }

  // Investor fallback
  const is = scores.propertyiq;
  const scoreDesc =
    is.score >= 70 ? 'strong' : is.score >= 50 ? 'moderate' : 'limited';

  const cfParts = [
    `${geoName} shows ${scoreDesc} investment potential (PropertyIQ score: ${is.score}).`,
  ];
  const cr = val('cap_rate');
  if (cr != null)
    cfParts.push(
      `Cap rates are around ${cr.toFixed(1)}%, indicating ${cr >= 6 ? 'solid cash flow' : cr >= 4 ? 'moderate returns' : 'appreciation-focused'} potential.`,
    );
  if (fmt('rent_index'))
    cfParts.push(`Median rents at ${fmt('rent_index')}/month.`);
  const gy = val('gross_yield');
  if (gy != null) cfParts.push(`Gross yield: ${gy.toFixed(1)}%.`);

  const growParts: string[] = [];
  const hvYoy = val('home_value_yoy');
  if (hvYoy != null)
    growParts.push(
      `Property values are ${hvYoy >= 0 ? 'up' : 'down'} ${Math.abs(hvYoy).toFixed(1)}% year-over-year.`,
    );
  const hv5yr = val('home_value_5yr');
  if (hv5yr != null)
    growParts.push(`5-year annualized growth: ${hv5yr.toFixed(1)}%.`);
  const popG = val('population_growth');
  if (popG != null)
    growParts.push(`Population growth of ${popG.toFixed(1)}% supports demand.`);
  const jobG = val('job_growth');
  if (jobG != null) growParts.push(`Job growth: ${jobG.toFixed(1)}%.`);
  if (growParts.length === 0)
    growParts.push(`Growth data for ${geoName} is currently limited.`);

  const liqParts: string[] = [];
  const dom = val('days_on_market');
  if (dom != null)
    liqParts.push(`Homes sell in an average of ${Math.round(dom)} days.`);
  const invChg = chg('for_sale_inventory');
  if (invChg != null)
    liqParts.push(
      `Inventory ${invChg > 0 ? 'rising' : 'falling'} at ${Math.abs(invChg).toFixed(1)}% YoY.`,
    );
  const pr = val('pending_ratio');
  if (pr != null)
    liqParts.push(
      `Pending ratio of ${(pr * 100).toFixed(0)}% suggests ${pr > 0.4 ? 'healthy' : 'softer'} demand.`,
    );
  liqParts.push(`PropertyIQ score: ${scores.propertyiq.score}/100.`);

  return [
    { title: 'Cash Flow Potential', analysis: cfParts.join(' ') },
    { title: 'Value Growth', analysis: growParts.join(' ') },
    { title: 'Liquidity & Demand', analysis: liqParts.join(' ') },
  ];
}
