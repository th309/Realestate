/**
 * Configuration for HUD Fair Market Rent (FMR) data imports.
 *
 * Defines HUD API URL patterns, fiscal year logic, state FIPS-to-name
 * mapping, database table schema, and the column mapping function that
 * transforms raw XLSX rows into hud_fmr database records.
 *
 * Data source: https://www.huduser.gov/portal/datasets/fmr.html
 * Schedule: Published annually (Sept/Oct) for the next federal fiscal year.
 */

// ---------------------------------------------------------------------------
// HUD FMR download URL patterns
// ---------------------------------------------------------------------------

/**
 * HUD publishes FMR Excel files at varying URL patterns per fiscal year.
 * We try each pattern in order until one succeeds.
 * Placeholders: {FY} = full year (2025), {FY_SHORT} = 2-digit year (25).
 */
export const FMR_URL_PATTERNS = [
  'https://www.huduser.gov/portal/datasets/fmr/fmr{FY}/FY{FY_SHORT}_FMRs.xlsx',
  'https://www.huduser.gov/portal/datasets/fmr/fmr{FY}/FY{FY_SHORT}_FMRs_revised.xlsx',
  'https://www.huduser.gov/portal/datasets/fmr/fmr{FY}/fy{FY}_safmrs.xlsx',
] as const;

/** Local file path pattern relative to the project `data/` directory. */
export const FMR_LOCAL_PATH_PATTERN = 'hud/FY{FY_SHORT}_FMRs.xlsx';

// ---------------------------------------------------------------------------
// Database table configuration
// ---------------------------------------------------------------------------

export const HUD_FMR_TABLE = 'hud_fmr';
export const HUD_FMR_CONFLICT_KEYS = ['year', 'fips_code'];
export const HUD_FMR_BATCH_SIZE = 5000;

// ---------------------------------------------------------------------------
// Fiscal year utilities
// ---------------------------------------------------------------------------

/**
 * Determine the current federal fiscal year.
 * Federal FY starts October 1 — if we are in Oct-Dec of year N,
 * the fiscal year is N+1 (e.g., Oct 2024 = FY2025).
 */
export function getCurrentFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed: 0=Jan, 9=Oct
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year;
}

/**
 * Build all candidate download URLs for a given fiscal year,
 * substituting {FY} and {FY_SHORT} placeholders.
 */
export function buildFmrDownloadUrls(fiscalYear: number): string[] {
  const fyShort = String(fiscalYear).slice(2);
  return FMR_URL_PATTERNS.map((pattern) =>
    pattern
      .replace('{FY}', String(fiscalYear))
      .replace('{FY_SHORT}', fyShort),
  );
}

/**
 * Build the local file path for a given fiscal year.
 */
export function buildFmrLocalPath(fiscalYear: number): string {
  const fyShort = String(fiscalYear).slice(2);
  return FMR_LOCAL_PATH_PATTERN.replace('{FY_SHORT}', fyShort);
}

// ---------------------------------------------------------------------------
// State FIPS to name mapping
// ---------------------------------------------------------------------------

export const STATE_FIPS_TO_NAME: Record<string, string> = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
  '06': 'California', '08': 'Colorado', '09': 'Connecticut',
  '10': 'Delaware', '11': 'District of Columbia', '12': 'Florida',
  '13': 'Georgia', '15': 'Hawaii', '16': 'Idaho', '17': 'Illinois',
  '18': 'Indiana', '19': 'Iowa', '20': 'Kansas', '21': 'Kentucky',
  '22': 'Louisiana', '23': 'Maine', '24': 'Maryland', '25': 'Massachusetts',
  '26': 'Michigan', '27': 'Minnesota', '28': 'Mississippi', '29': 'Missouri',
  '30': 'Montana', '31': 'Nebraska', '32': 'Nevada', '33': 'New Hampshire',
  '34': 'New Jersey', '35': 'New Mexico', '36': 'New York',
  '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
  '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania',
  '44': 'Rhode Island', '45': 'South Carolina', '46': 'South Dakota',
  '47': 'Tennessee', '48': 'Texas', '49': 'Utah', '50': 'Vermont',
  '51': 'Virginia', '53': 'Washington', '54': 'West Virginia',
  '55': 'Wisconsin', '56': 'Wyoming', '72': 'Puerto Rico',
  '78': 'Virgin Islands',
};

// ---------------------------------------------------------------------------
// Column mapping: raw XLSX row -> hud_fmr database record
// ---------------------------------------------------------------------------

/** Shape of the database record written to hud_fmr. */
export interface HudFmrRecord {
  [key: string]: string | number | null;
  year: number;
  fips_code: string;
  county_name: string;
  state_fips: string;
  state_name: string;
  metro_code: string | null;
  metro_name: string | null;
  fmr_0br: number | null;
  fmr_1br: number | null;
  fmr_2br: number | null;
  fmr_3br: number | null;
  fmr_4br: number | null;
}

/**
 * Parse a raw XLSX row into an HudFmrRecord.
 *
 * HUD XLSX rows have columns like `fips` (10-digit), `fmr_0`..`fmr_4`,
 * `countyname`, `stusps`, `metro`, `hud_area_code`, `hud_area_name`.
 *
 * Returns null to skip rows without required data.
 */
export function mapFmrRow(
  row: Record<string, string>,
  fiscalYear: number,
): HudFmrRecord | null {
  // Skip rows without a FIPS code or 2BR FMR value (core data)
  if (!row.fips || !row.fmr_2) return null;

  // Extract 5-digit county FIPS from 10-digit HUD format
  const fipsRaw = String(row.fips).padStart(10, '0');
  const fips5 = fipsRaw.slice(0, 5);
  const stateFips = fips5.slice(0, 2);

  // Extract metro CBSA code from hud_area_code (format: METRO33860M33860)
  let metroCode: string | null = null;
  if (row.hud_area_code && String(row.hud_area_code).startsWith('METRO')) {
    const match = String(row.hud_area_code).match(/METRO(\d+)/);
    if (match) metroCode = match[1];
  }

  // Parse FMR values — the XLSX library may return them as numbers or strings
  const parseFmrValue = (val: unknown): number | null => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  return {
    year: fiscalYear,
    fips_code: fips5,
    county_name: row.countyname || '',
    state_fips: stateFips,
    state_name: STATE_FIPS_TO_NAME[stateFips] || row.stusps || '',
    metro_code: metroCode,
    metro_name: row.metro === '1' ? (row.hud_area_name || null) : null,
    fmr_0br: parseFmrValue(row.fmr_0),
    fmr_1br: parseFmrValue(row.fmr_1),
    fmr_2br: parseFmrValue(row.fmr_2),
    fmr_3br: parseFmrValue(row.fmr_3),
    fmr_4br: parseFmrValue(row.fmr_4),
  };
}
