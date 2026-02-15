/**
 * GEO REGIONS - Census region mapping and simplified US map paths
 *
 * Provides:
 * - Census region definitions (Northeast, Midwest, South, West)
 * - State abbreviation to full name mapping
 * - Helper functions for region lookups
 * - Simplified SVG region paths for the ScopeMiniMap component
 *
 * Re-uses the canonical STATE_TO_CENSUS_REGION from ../constants.ts to avoid
 * duplication. This module adds region-oriented lookups and map visuals.
 */

import { STATE_TO_CENSUS_REGION, type CensusRegion, getRegionStates } from '../constants';

// ── Census Regions ──────────────────────────────────────────────────────────

export interface RegionInfo {
  label: string;
  states: string[];
}

/** Census regions keyed by lowercase slug */
export const CENSUS_REGIONS: Record<string, RegionInfo> = {
  northeast: {
    label: 'Northeast',
    states: ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'],
  },
  midwest: {
    label: 'Midwest',
    states: ['IL', 'IN', 'MI', 'OH', 'WI', 'IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD'],
  },
  south: {
    label: 'South',
    states: [
      'DE', 'FL', 'GA', 'MD', 'NC', 'SC', 'VA', 'DC', 'WV',
      'AL', 'KY', 'MS', 'TN', 'AR', 'LA', 'OK', 'TX',
    ],
  },
  west: {
    label: 'West',
    states: ['AZ', 'CO', 'ID', 'MT', 'NV', 'NM', 'UT', 'WY', 'AK', 'CA', 'HI', 'OR', 'WA'],
  },
};

/** Map from CensusRegion display name to lowercase slug */
const REGION_NAME_TO_SLUG: Record<CensusRegion, string> = {
  Northeast: 'northeast',
  Midwest: 'midwest',
  South: 'south',
  West: 'west',
};

/**
 * Get the lowercase region slug for a state abbreviation.
 * Returns null if the state is not found.
 */
export function getRegionForState(stateAbbr: string): string | null {
  const region = STATE_TO_CENSUS_REGION[stateAbbr];
  if (!region) return null;
  return REGION_NAME_TO_SLUG[region] ?? null;
}

/**
 * Get the human-readable region label for a state abbreviation.
 * Returns 'Unknown' if the state is not found.
 */
export function getRegionLabel(stateAbbr: string): string {
  const region = STATE_TO_CENSUS_REGION[stateAbbr];
  return region ?? 'Unknown';
}

/**
 * Get all state abbreviations in the same census region as the given state.
 * Delegates to the canonical getRegionStates from constants.ts.
 */
export function getStatesInRegion(stateAbbr: string): string[] {
  return getRegionStates(stateAbbr);
}

// ── State Names ─────────────────────────────────────────────────────────────

/** State abbreviation to full name (all 50 states + DC) */
export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
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
};

// ── Simplified US Map Paths ─────────────────────────────────────────────────
// These are rough region outlines for a 120x80 SVG viewport.
// At mini-map scale (~120x80px) individual state boundaries aren't visible,
// so we use four simplified region polygons for visual effect.

export const REGION_PATHS: Record<string, string> = {
  northeast: 'M85,8 L98,6 L102,12 L100,20 L93,24 L84,22 L82,14 Z',
  midwest:   'M42,6 L82,6 L84,14 L84,28 L78,32 L42,32 L40,18 Z',
  south:     'M38,32 L93,32 L100,28 L102,38 L98,58 L80,62 L60,60 L38,58 L34,44 Z',
  west:      'M2,4 L38,4 L40,18 L42,32 L38,32 L34,44 L38,58 L30,62 L8,58 L2,40 Z',
};

/** US continental outline for the mini-map border (120x80 viewport) */
export const US_OUTLINE_PATH =
  'M2,4 L38,4 L42,6 L82,6 L85,8 L98,6 L102,12 L100,20 L102,38 L98,58 L80,62 L60,60 L38,58 L30,62 L8,58 L2,40 Z';

/**
 * Approximate center points for each region within the 120x80 viewport.
 * Used to place a marker dot when scope is "state".
 */
export const REGION_CENTERS: Record<string, { x: number; y: number }> = {
  northeast: { x: 92, y: 15 },
  midwest:   { x: 62, y: 19 },
  south:     { x: 68, y: 46 },
  west:      { x: 20, y: 30 },
};

/**
 * Approximate positions for state markers within the 120x80 viewport.
 * Only includes a representative sample -- for the mini-map, we show
 * the state dot within the correct region. These positions are rough
 * since the map is only ~120px wide.
 */
export const STATE_POSITIONS: Record<string, { x: number; y: number }> = {
  // Northeast
  CT: { x: 96, y: 16 }, ME: { x: 100, y: 8 }, MA: { x: 98, y: 14 },
  NH: { x: 98, y: 10 }, RI: { x: 98, y: 16 }, VT: { x: 95, y: 10 },
  NJ: { x: 95, y: 19 }, NY: { x: 92, y: 13 }, PA: { x: 89, y: 18 },
  // Midwest
  IL: { x: 65, y: 26 }, IN: { x: 69, y: 25 }, MI: { x: 72, y: 16 },
  OH: { x: 74, y: 22 }, WI: { x: 63, y: 14 }, IA: { x: 58, y: 20 },
  KS: { x: 52, y: 28 }, MN: { x: 56, y: 12 }, MO: { x: 60, y: 30 },
  NE: { x: 50, y: 22 }, ND: { x: 50, y: 10 }, SD: { x: 50, y: 16 },
  // South
  DE: { x: 92, y: 24 }, FL: { x: 80, y: 56 }, GA: { x: 78, y: 46 },
  MD: { x: 90, y: 26 }, NC: { x: 84, y: 38 }, SC: { x: 82, y: 42 },
  VA: { x: 86, y: 32 }, DC: { x: 90, y: 28 }, WV: { x: 82, y: 28 },
  AL: { x: 72, y: 46 }, KY: { x: 74, y: 34 }, MS: { x: 66, y: 48 },
  TN: { x: 72, y: 38 }, AR: { x: 60, y: 42 }, LA: { x: 62, y: 52 },
  OK: { x: 52, y: 40 }, TX: { x: 48, y: 52 },
  // West
  AZ: { x: 18, y: 44 }, CO: { x: 28, y: 30 }, ID: { x: 16, y: 16 },
  MT: { x: 22, y: 10 }, NV: { x: 12, y: 28 }, NM: { x: 24, y: 44 },
  UT: { x: 18, y: 28 }, WY: { x: 26, y: 20 }, AK: { x: 6, y: 56 },
  CA: { x: 6, y: 36 }, HI: { x: 14, y: 58 }, OR: { x: 8, y: 14 },
  WA: { x: 10, y: 8 },
};
