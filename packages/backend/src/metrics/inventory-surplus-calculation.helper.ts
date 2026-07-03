/**
 * Calculate 5-year average inventory for a specific month
 * Uses same month across 5 previous years for seasonality adjustment
 */
export function calculate5YearAverage(values: number[]): number | null {
  if (!values || values.length === 0) return null;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Transform database rows to API format
 */
export function transformToApiFormat(
  rows: any[],
  geographyType: string,
): any[] {
  return rows.map((row) => ({
    region_id: row.geography_id,
    region_name: row.geography_name,
    value: row.inventory_surplus_pct,
    inventory_surplus: row.inventory_surplus_pct,
    date: row.period_date,
    // Add geo-specific fields for key matching
    ...(geographyType === 'metro' ? { cbsa_code: row.geography_id } : {}),
    ...(geographyType === 'county' ? { county_fips: row.geography_id } : {}),
    ...(geographyType === 'zip' ? { postal_code: row.geography_id } : {}),
  }));
}
