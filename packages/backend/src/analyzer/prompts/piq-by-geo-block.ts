/**
 * Build the PIQ SCORE BY GEOGRAPHY block surfaced to the AI in assemblePrompt.
 *
 * The PropertyIQ score is a percentile rank within state, computed from
 * monthly real-estate signal data. The variance of that input is wildly
 * different across geo levels:
 *
 *   - Metro: thousands of monthly sales feed the signal. Very stable, the
 *     score changes slowly month to month.
 *   - County: hundreds. Moderate stability.
 *   - ZIP: anywhere from a handful to ~150. Noisy — a single ZIP can swing
 *     20-30 percentile points month to month on small-sample variance.
 *
 * If the AI sees only the ZIP score (which is what `payload.piq` resolves to
 * by default, because RentCast geocodes to ZIP) it confidently cites a noisy
 * number as the verdict on the market. That's misleading for both the
 * 'metro is hot but this ZIP is cold' and the 'metro is cold but this ZIP
 * is hot' cases — neither story comes through.
 *
 * This block surfaces every geo level that resolved, ranked by stability,
 * and tells the model to lead with the most stable available level and only
 * call out the ZIP when it diverges sharply (15+ percentile points). Rural
 * and unincorporated addresses naturally fall through — only levels with
 * data are listed.
 *
 * Returns the lines to spread into the assembled prompt. Returns an empty
 * array when no scores resolved at all so callers can spread it safely.
 */

interface PiqByGeo {
  zip?: number | null;
  county?: number | null;
  metro?: number | null;
}

export function buildPiqByGeoBlock(byGeo: PiqByGeo | undefined): string[] {
  if (!byGeo) return [];

  const lines: string[] = [];
  if (typeof byGeo.metro === 'number') {
    lines.push(
      `- Metro (most stable, thousands of monthly sales): ${byGeo.metro}`,
    );
  }
  if (typeof byGeo.county === 'number') {
    lines.push(`- County (moderate sample, fairly stable): ${byGeo.county}`);
  }
  if (typeof byGeo.zip === 'number') {
    lines.push(
      `- ZIP (small sample, monthly noise, can swing 20-30 points): ${byGeo.zip}`,
    );
  }
  if (lines.length === 0) return [];

  return [
    'PIQ SCORE BY GEOGRAPHY:',
    '- What it is: the PropertyIQ Score is a 1-99 percentile rank within state that predicts a market\'s excess return vs its state benchmark over the next 1-3 years. 50 equals the state average; 70 plus is good, 80 plus is great, 90 plus is excellent. It is NOT a national rank, it is "how does this market perform relative to its own state".',
    '- What drives it: three Redfin supply-demand signals combined as a z-score (percent of homes selling above list price, median days on market, months of supply). Walk-forward validated across 14 years (2012-2025) at metro / county / ZIP. Top-quintile (Score 80 plus) metros average roughly 3 percent excess return per year over their state.',
    '- Scores by geography for this property (only levels that resolved are listed):',
    ...lines,
    '- Lead the market verdict with the most stable level that resolved above (Metro > County > ZIP). Only call out the ZIP score explicitly if it diverges sharply (15 plus points) from the Metro or County score, because that gap is the interesting micro-market signal: "the metro is hot but this ZIP is cooler" or vice versa. Do not state the ZIP score as gospel on its own; it is a noisy signal built on a small monthly sample.',
    '',
  ];
}
