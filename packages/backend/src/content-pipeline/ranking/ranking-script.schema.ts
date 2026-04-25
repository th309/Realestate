import { z } from 'zod';

export const RankingHookSchema = z.object({
  id: z.enum(['data-led', 'surprise-led', 'warning-led', 'stakes-led']),
  intro_vo: z.string().min(10),
  subhead_text: z.string().min(2),
});

export const RankingRowSchema = z.object({
  rank: z.number().int().min(1).max(50),
  vo: z.string().min(5),
  emphasis: z.enum(['name', 'value']),
});

export const RankingScriptSchema = z.object({
  hooks: z.array(RankingHookSchema).length(2),
  rows: z.array(RankingRowSchema).min(5).max(50),
  outro_vo: z.string().min(5),
  outro_cta: z.literal('Learn more at propertyiq.app.'),
});

export type RankingScript = z.infer<typeof RankingScriptSchema>;

const STATE_ABBR_TO_FULL: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
};

/**
 * Stricter validation: script must match the resolved_markets context.
 * Returns array of error messages (empty if valid).
 */
export function validateScriptAgainstMarkets(
  script: RankingScript,
  markets: Array<{ rank: number; region_name: string; state: string }>,
): string[] {
  const errors: string[] = [];

  if (script.rows.length !== markets.length) {
    errors.push(
      `rows.length (${script.rows.length}) !== resolved_markets.length (${markets.length})`,
    );
  }

  const expectedRanks = markets.map((m) => m.rank).sort((a, b) => a - b);
  const actualRanks = script.rows.map((r) => r.rank).sort((a, b) => a - b);
  if (JSON.stringify(expectedRanks) !== JSON.stringify(actualRanks)) {
    errors.push(
      `row ranks ${JSON.stringify(actualRanks)} do not match resolved_markets ranks ${JSON.stringify(expectedRanks)}`,
    );
  }

  for (const market of markets) {
    const row = script.rows.find((r) => r.rank === market.rank);
    if (!row) continue;
    if (!row.vo.includes(market.region_name)) {
      errors.push(
        `rank ${market.rank} VO does not contain region_name "${market.region_name}"`,
      );
    }
    const stateFull = STATE_ABBR_TO_FULL[market.state] ?? market.state;
    if (!row.vo.includes(market.state) && !row.vo.includes(stateFull)) {
      errors.push(
        `rank ${market.rank} VO does not contain state "${market.state}" or "${stateFull}"`,
      );
    }
  }

  return errors;
}
