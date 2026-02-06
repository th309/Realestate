/**
 * SQL Helper Utilities
 */

import { createCensusImportClient } from './db-client';

/**
 * Escape value for SQL with comprehensive validation
 */
export function escapeSQL(value: any): string {
  if (value === null || value === undefined) return 'NULL';

  if (typeof value === 'number') {
    if (!isFinite(value) || isNaN(value)) return 'NULL';

    const maxSafe = 999999999999;
    const minSafe = -999999999999;

    let safeValue = value;
    if (value > maxSafe) {
      safeValue = maxSafe;
    } else if (value < minSafe) {
      safeValue = minSafe;
    }

    if (Math.abs(safeValue) < 0.000001 && safeValue !== 0) {
      return '0';
    }

    if (Number.isInteger(safeValue)) {
      return safeValue.toString();
    } else {
      const fixed = safeValue.toFixed(10);
      return parseFloat(fixed).toString();
    }
  }

  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';

  return `'${value.toString().replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

/**
 * Batch upsert using exec_sql RPC
 */
export async function batchUpsertSQL(
  table: string,
  records: any[],
  conflictColumn: string
): Promise<{ inserted: number; error?: string }> {
  if (records.length === 0) {
    return { inserted: 0 };
  }

  const supabase = createCensusImportClient();

  try {
    const columns = Object.keys(records[0]);
    const values = records.map(record => {
      const vals = columns.map(col => escapeSQL(record[col]));
      return `(${vals.join(', ')})`;
    });

    const conflictCols = conflictColumn.split(',').map(c => c.trim());
    const conflictClause = conflictCols.length > 1
      ? conflictCols.join(', ')
      : conflictColumn;

    const updateColumns = columns.filter(col => !conflictCols.includes(col));
    const updateClause = updateColumns.length > 0
      ? `DO UPDATE SET ${updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ')}`
      : 'DO NOTHING';

    const sql = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${values.join(', ')}
      ON CONFLICT (${conflictClause}) ${updateClause}
    `;

    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      return { inserted: 0, error: error.message };
    }

    return { inserted: records.length };
  } catch (err: any) {
    return { inserted: 0, error: err.message };
  }
}

/**
 * Create market entries for geographic records
 */
export async function createMarketEntries(
  records: any[],
  geography: 'zip' | 'county' | 'state',
  getGeoId: (record: any) => string
): Promise<{ success: boolean; error?: string }> {
  const marketEntries: any[] = [];

  for (const record of records) {
    const geoid = getGeoId(record);
    let regionName = '';
    let regionType = '';

    switch (geography) {
      case 'state':
        regionName = `State ${geoid}`;
        regionType = 'state';
        break;
      case 'county':
        regionName = `County ${geoid}`;
        regionType = 'county';
        break;
      case 'zip':
        regionName = `ZIP ${geoid}`;
        regionType = 'zip';
        break;
    }

    marketEntries.push({
      region_id: geoid,
      region_name: regionName,
      region_type: regionType,
      geoid: geoid
    });
  }

  if (marketEntries.length > 0) {
    const result = await batchUpsertSQL('markets', marketEntries, 'region_id');
    if (result.error) {
      return { success: false, error: result.error };
    }
  }

  return { success: true };
}

/**
 * Create geographic unit entries
 */
export async function createGeoUnitEntries(
  records: any[],
  geography: 'zip' | 'county' | 'state',
  getGeoId: (record: any) => string
): Promise<{ success: boolean; error?: string }> {
  const geoUnitEntries: any[] = [];

  for (const record of records) {
    const geoid = getGeoId(record);
    let level = '';
    let name = '';

    switch (geography) {
      case 'state':
        level = 'state';
        name = `State ${geoid}`;
        break;
      case 'county':
        level = 'county';
        name = `County ${geoid}`;
        break;
      case 'zip':
        level = 'zip';
        name = `ZIP ${geoid}`;
        break;
    }

    geoUnitEntries.push({
      geoid: geoid,
      level: level,
      name: name
    });
  }

  if (geoUnitEntries.length > 0) {
    const result = await batchUpsertSQL('geographic_units', geoUnitEntries, 'geoid');
    if (result.error) {
      return { success: false, error: result.error };
    }
  }

  return { success: true };
}
