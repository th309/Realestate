/**
 * State slug data for /markets/state/[state] programmatic pages.
 *
 * Each entry maps a state abbreviation to a URL slug and full name.
 * Slug format: lowercase state name, spaces replaced with hyphens.
 * Special case: DC uses "district-of-columbia".
 *
 * Used by generateStaticParams in the state hub pages and the sitemap.
 */

export interface StateSlugEntry {
  abbrev: string;
  slug: string;
  name: string;
}

export const STATE_SLUG_DATA: StateSlugEntry[] = [
  { abbrev: 'AL', slug: 'alabama', name: 'Alabama' },
  { abbrev: 'AK', slug: 'alaska', name: 'Alaska' },
  { abbrev: 'AZ', slug: 'arizona', name: 'Arizona' },
  { abbrev: 'AR', slug: 'arkansas', name: 'Arkansas' },
  { abbrev: 'CA', slug: 'california', name: 'California' },
  { abbrev: 'CO', slug: 'colorado', name: 'Colorado' },
  { abbrev: 'CT', slug: 'connecticut', name: 'Connecticut' },
  { abbrev: 'DE', slug: 'delaware', name: 'Delaware' },
  { abbrev: 'DC', slug: 'district-of-columbia', name: 'District of Columbia' },
  { abbrev: 'FL', slug: 'florida', name: 'Florida' },
  { abbrev: 'GA', slug: 'georgia', name: 'Georgia' },
  { abbrev: 'HI', slug: 'hawaii', name: 'Hawaii' },
  { abbrev: 'ID', slug: 'idaho', name: 'Idaho' },
  { abbrev: 'IL', slug: 'illinois', name: 'Illinois' },
  { abbrev: 'IN', slug: 'indiana', name: 'Indiana' },
  { abbrev: 'IA', slug: 'iowa', name: 'Iowa' },
  { abbrev: 'KS', slug: 'kansas', name: 'Kansas' },
  { abbrev: 'KY', slug: 'kentucky', name: 'Kentucky' },
  { abbrev: 'LA', slug: 'louisiana', name: 'Louisiana' },
  { abbrev: 'ME', slug: 'maine', name: 'Maine' },
  { abbrev: 'MD', slug: 'maryland', name: 'Maryland' },
  { abbrev: 'MA', slug: 'massachusetts', name: 'Massachusetts' },
  { abbrev: 'MI', slug: 'michigan', name: 'Michigan' },
  { abbrev: 'MN', slug: 'minnesota', name: 'Minnesota' },
  { abbrev: 'MS', slug: 'mississippi', name: 'Mississippi' },
  { abbrev: 'MO', slug: 'missouri', name: 'Missouri' },
  { abbrev: 'MT', slug: 'montana', name: 'Montana' },
  { abbrev: 'NE', slug: 'nebraska', name: 'Nebraska' },
  { abbrev: 'NV', slug: 'nevada', name: 'Nevada' },
  { abbrev: 'NH', slug: 'new-hampshire', name: 'New Hampshire' },
  { abbrev: 'NJ', slug: 'new-jersey', name: 'New Jersey' },
  { abbrev: 'NM', slug: 'new-mexico', name: 'New Mexico' },
  { abbrev: 'NY', slug: 'new-york', name: 'New York' },
  { abbrev: 'NC', slug: 'north-carolina', name: 'North Carolina' },
  { abbrev: 'ND', slug: 'north-dakota', name: 'North Dakota' },
  { abbrev: 'OH', slug: 'ohio', name: 'Ohio' },
  { abbrev: 'OK', slug: 'oklahoma', name: 'Oklahoma' },
  { abbrev: 'OR', slug: 'oregon', name: 'Oregon' },
  { abbrev: 'PA', slug: 'pennsylvania', name: 'Pennsylvania' },
  { abbrev: 'RI', slug: 'rhode-island', name: 'Rhode Island' },
  { abbrev: 'SC', slug: 'south-carolina', name: 'South Carolina' },
  { abbrev: 'SD', slug: 'south-dakota', name: 'South Dakota' },
  { abbrev: 'TN', slug: 'tennessee', name: 'Tennessee' },
  { abbrev: 'TX', slug: 'texas', name: 'Texas' },
  { abbrev: 'UT', slug: 'utah', name: 'Utah' },
  { abbrev: 'VT', slug: 'vermont', name: 'Vermont' },
  { abbrev: 'VA', slug: 'virginia', name: 'Virginia' },
  { abbrev: 'WA', slug: 'washington', name: 'Washington' },
  { abbrev: 'WV', slug: 'west-virginia', name: 'West Virginia' },
  { abbrev: 'WI', slug: 'wisconsin', name: 'Wisconsin' },
  { abbrev: 'WY', slug: 'wyoming', name: 'Wyoming' },
  { abbrev: 'PR', slug: 'puerto-rico', name: 'Puerto Rico' },
];

/** Map from slug to state entry for O(1) lookup */
export const SLUG_TO_STATE = new Map<string, StateSlugEntry>(
  STATE_SLUG_DATA.map((e) => [e.slug, e]),
);

/** Map from abbreviation to state entry for O(1) lookup */
export const ABBREV_TO_STATE = new Map<string, StateSlugEntry>(
  STATE_SLUG_DATA.map((e) => [e.abbrev, e]),
);
