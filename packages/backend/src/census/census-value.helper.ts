// State abbreviation to FIPS code mapping
export const STATE_ABBREV_TO_FIPS: Record<string, string> = {
  AL: '01',
  AK: '02',
  AZ: '04',
  AR: '05',
  CA: '06',
  CO: '08',
  CT: '09',
  DE: '10',
  DC: '11',
  FL: '12',
  GA: '13',
  HI: '15',
  ID: '16',
  IL: '17',
  IN: '18',
  IA: '19',
  KS: '20',
  KY: '21',
  LA: '22',
  ME: '23',
  MD: '24',
  MA: '25',
  MI: '26',
  MN: '27',
  MS: '28',
  MO: '29',
  MT: '30',
  NE: '31',
  NV: '32',
  NH: '33',
  NJ: '34',
  NM: '35',
  NY: '36',
  NC: '37',
  ND: '38',
  OH: '39',
  OK: '40',
  OR: '41',
  PA: '42',
  RI: '44',
  SC: '45',
  SD: '46',
  TN: '47',
  TX: '48',
  UT: '49',
  VT: '50',
  VA: '51',
  WA: '53',
  WV: '54',
  WI: '55',
  WY: '56',
  PR: '72',
  VI: '78',
  GU: '66',
  AS: '60',
  MP: '69',
};

/**
 * Convert state parameter to FIPS code
 * Accepts either state abbreviation (CA) or FIPS code (06)
 */
export function toStateFips(state: string): string {
  const upper = state.toUpperCase();
  // If it's a 2-letter abbreviation, convert to FIPS
  if (STATE_ABBREV_TO_FIPS[upper]) {
    return STATE_ABBREV_TO_FIPS[upper];
  }
  // Otherwise assume it's already a FIPS code, pad to 2 digits
  return state.padStart(2, '0');
}

/**
 * Safely convert a metric value to number, returning null for missing data.
 * Unlike `Number(x) || 0`, this preserves the distinction between:
 * - 0 (actual zero value, e.g., 0% growth)
 * - null (no data available)
 *
 * Filters out Census placeholder values like -666666666 (data not available)
 */
export function toMetricValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  if (isNaN(num)) {
    return null;
  }
  // Census uses -666666666 as placeholder for "data not available"
  if (num === -666666666) {
    return null;
  }
  return num;
}
