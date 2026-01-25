/**
 * Normalize state, county, and CBSA/metro identifiers so the API accepts
 * FIPS codes, abbreviations, or names interchangeably (like ZIP with normalizeZipKey).
 *
 * Use when: parsing regionId from API params (timeseries, realtor, scoring) so
 * "12" | "FL" | "Florida" all resolve to the correct state; county FIPS padding;
 * CBSA code padding.
 */

// ---------------------------------------------------------------------------
// State: FIPS (2-digit) <-> Code (2-letter) <-> Full name
// ---------------------------------------------------------------------------

export const STATE_FIPS_TO_CODE: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY', '72': 'PR',
};

export const STATE_CODE_TO_FIPS: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_FIPS_TO_CODE).map(([k, v]) => [v, k])
);

export const STATE_FIPS_TO_NAME: Record<string, string> = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas', '06': 'California',
  '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware', '11': 'District of Columbia', '12': 'Florida',
  '13': 'Georgia', '15': 'Hawaii', '16': 'Idaho', '17': 'Illinois', '18': 'Indiana',
  '19': 'Iowa', '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
  '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota', '28': 'Mississippi',
  '29': 'Missouri', '30': 'Montana', '31': 'Nebraska', '32': 'Nevada', '33': 'New Hampshire',
  '34': 'New Jersey', '35': 'New Mexico', '36': 'New York', '37': 'North Carolina', '38': 'North Dakota',
  '39': 'Ohio', '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
  '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas', '49': 'Utah',
  '50': 'Vermont', '51': 'Virginia', '53': 'Washington', '54': 'West Virginia', '55': 'Wisconsin',
  '56': 'Wyoming', '72': 'Puerto Rico',
};

/** State full name (any case) -> 2-letter code */
const STATE_NAME_TO_CODE_MAP = ((): Record<string, string> => {
  const m: Record<string, string> = {};
  for (const [fips, name] of Object.entries(STATE_FIPS_TO_NAME)) {
    m[name.toLowerCase()] = STATE_FIPS_TO_CODE[fips];
  }
  return m;
})();

export interface NormalizedState {
  stateCode: string;
  stateFips: string;
  stateName: string;
}

/**
 * Resolve a state identifier (FIPS, 2-letter code, or full name) to canonical forms.
 * Realtor/Zillow use state_id/state_code and state_name; Census/Economic use state_fips.
 */
export function normalizeStateRegionId(regionId: string): NormalizedState | null {
  const s = regionId.trim();
  if (!s) return null;

  // 2-letter code (e.g. FL)
  if (s.length === 2 && /^[A-Za-z]{2}$/.test(s)) {
    const code = s.toUpperCase();
    const fips = STATE_CODE_TO_FIPS[code];
    const name = fips ? STATE_FIPS_TO_NAME[fips] : code;
    return { stateCode: code, stateFips: fips || s.padStart(2, '0'), stateName: name };
  }

  // 1–2 digit FIPS (e.g. 12 or 6)
  if (/^\d{1,2}$/.test(s)) {
    const fips = s.padStart(2, '0');
    const code = STATE_FIPS_TO_CODE[fips];
    const name = STATE_FIPS_TO_NAME[fips];
    return { stateCode: code || fips, stateFips: fips, stateName: name || fips };
  }

  // Full name (e.g. Florida)
  const code = STATE_NAME_TO_CODE_MAP[s.toLowerCase()];
  if (code) {
    const fips = STATE_CODE_TO_FIPS[code];
    const name = STATE_FIPS_TO_NAME[fips];
    return { stateCode: code, stateFips: fips, stateName: name || s };
  }

  return null;
}

/** Prefer state code (for Realtor state_id); fallback to original. */
export function normalizeStateToCode(regionId: string): string {
  const n = normalizeStateRegionId(regionId);
  return n ? n.stateCode : regionId.trim();
}

/** Prefer state FIPS 2-digit (for Census/Economic state_fips); fallback to original. */
export function normalizeStateToFips(regionId: string): string {
  const n = normalizeStateRegionId(regionId);
  return n ? n.stateFips : regionId.trim().padStart(2, '0');
}

/** Prefer state full name (for Zillow region_name at state level); fallback to original. */
export function normalizeStateToName(regionId: string): string {
  const n = normalizeStateRegionId(regionId);
  return n ? n.stateName : regionId.trim();
}

// ---------------------------------------------------------------------------
// County: 5-digit FIPS (state 2 + county 3); pad when numeric
// ---------------------------------------------------------------------------

/**
 * Normalize county FIPS so "1731" → "01731", "17031" unchanged.
 * Non-numeric (e.g. "Cook, IL") returned trimmed for name-based lookup.
 */
export function normalizeCountyFips(regionId: string): string {
  const s = regionId.trim();
  if (/^\d{1,5}$/.test(s)) {
    return s.padStart(5, '0');
  }
  return s;
}

// ---------------------------------------------------------------------------
// Metro / CBSA: 5-digit CBSA code; pad when numeric
// ---------------------------------------------------------------------------

/**
 * Normalize CBSA code so "16980" and "6980" both become "16980".
 * Non-numeric (metro name) returned trimmed for title/name lookup.
 */
export function normalizeCbsaCode(regionId: string): string {
  const s = regionId.trim();
  if (/^\d+$/.test(s)) {
    return s.padStart(5, '0');
  }
  return s;
}
