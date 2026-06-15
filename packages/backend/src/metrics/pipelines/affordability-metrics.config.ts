export const AFF = {
  DOWN_PAYMENT_PCT: 0.2,
  DEFAULT_MORTGAGE_RATE: 0.07,
  MORTGAGE_TERM_MONTHS: 360,
  PROPERTY_TAX_RATE: 0.011,
  INSURANCE_RATE: 0.0035,
  FRONT_END_DTI: 0.28,
  SAVINGS_RATE: 0.1,
  DOWN_PAYMENT_RATE: 0.2,
  BATCH_SIZE: 100,
  PAGE_SIZE: 1000,
  FRED_MORTGAGE_SERIES: 'MORTGAGE30US',
} as const;

export const AFF_REALTOR_GEOS = [
  {
    tableName: 'realtor_national',
    geoType: 'national',
    idField: 'region_id',
    nameField: 'region_name',
  },
  {
    tableName: 'realtor_state',
    geoType: 'state',
    idField: 'state_id',
    nameField: 'state_name',
  },
  {
    tableName: 'realtor_metro',
    geoType: 'metro',
    idField: 'cbsa_code',
    nameField: 'cbsa_title',
  },
  {
    tableName: 'realtor_county',
    geoType: 'county',
    idField: 'county_fips',
    nameField: 'county_name',
  },
  {
    tableName: 'realtor_zip',
    geoType: 'zip',
    idField: 'postal_code',
    nameField: 'postal_code',
  },
];

export const AFF_CENSUS_GEOS = [
  {
    tableName: 'census_national',
    geoType: 'national',
    idField: 'id',
    nameField: 'id',
  },
  {
    tableName: 'census_state',
    geoType: 'state',
    idField: 'state_fips',
    nameField: 'state_name',
  },
  {
    tableName: 'census_metro',
    geoType: 'metro',
    idField: 'cbsa_code',
    nameField: 'cbsa_title',
  },
  {
    tableName: 'census_county',
    geoType: 'county',
    idField: 'fips_code',
    nameField: 'county_name',
  },
  {
    tableName: 'census_zip',
    geoType: 'zip',
    idField: 'zcta',
    nameField: 'zcta',
  },
];

export const AFF_CENSUS_BY_GEO: Record<
  string,
  { tableName: string; idField: string }
> = {
  national: { tableName: 'census_national', idField: 'id' },
  state: { tableName: 'census_state', idField: 'state_fips' },
  metro: { tableName: 'census_metro', idField: 'cbsa_code' },
  county: { tableName: 'census_county', idField: 'fips_code' },
  zip: { tableName: 'census_zip', idField: 'zcta' },
};
