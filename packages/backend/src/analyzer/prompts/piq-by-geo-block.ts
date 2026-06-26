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
    '- What it is: the PropertyIQ Score is a 1-99 score that signals a market\'s chance of out-performing or under-performing its state benchmark over the next 1-3 years. 50 equals the state average; above 50 means a higher chance of out-performing the state, below 50 means a higher chance of under-performing. 70 plus is good, 80 plus is great, 90 plus is excellent. It is computed on a national cross-sectional basis (across all markets at the same geography level) and then calibrated so 50 maps to the state average, so it answers "how is this market positioned to perform relative to its own state".',
    '- What drives it: four demand signals combined as an equal-weight z-score (Zillow ZHVI 12-month and 3-month price momentum, Realtor.com median days on market, and the share of listings with price cuts). Walk-forward validated across 20+ years (2001-2023) at metro / county / ZIP.',
    '- Scores by geography for this property (only levels that resolved are listed):',
    ...lines,
    '- Lead the market verdict with the most stable level that resolved above (Metro > County > ZIP). Only call out the ZIP score explicitly if it diverges sharply (15 plus points) from the Metro or County score, because that gap is the interesting micro-market signal: "the metro is hot but this ZIP is cooler" or vice versa. Do not state the ZIP score as gospel on its own; it is a noisy signal built on a small monthly sample.',
    '- CRITICAL language rules when citing the PIQ Score in your output: NEVER state a specific percentage of over-performance or under-performance. NEVER write phrases like "outperforms the state by X%", "X percent excess return", "X percent above the state average", or "expect X% appreciation". The PIQ Score is a probability signal, not a return forecast. Phrase it as a HIGHER or LOWER CHANCE of out-performing or under-performing the state average. Examples of correct phrasing: "a strong chance of out-performing the state over the next 1-3 years", "leans toward under-performing its state benchmark", "tilted higher than the state average but not by a wide margin".',
    '',
  ];
}
