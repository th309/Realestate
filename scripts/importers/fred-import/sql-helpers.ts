/**
 * SQL Helper Utilities
 */

import { createFredImportClient } from './db-client';

/**
 * Escape value for SQL
 */
export function escapeSQL(value: any): string {
  if (value === null || value === undefined) return 'NULL';

  if (typeof value === 'number') {
    if (!isFinite(value) || isNaN(value)) return 'NULL';
    const maxSafe = 999999999999;
    const minSafe = -999999999999;
    let safeValue = value;
    if (value > maxSafe) safeValue = maxSafe;
    else if (value < minSafe) safeValue = minSafe;
    if (Math.abs(safeValue) < 0.000001 && safeValue !== 0) return '0';
    if (Number.isInteger(safeValue)) {
      return safeValue.toString();
    } else {
      const fixed = safeValue.toFixed(10);
      return parseFloat(fixed).toString();
    }
  }

  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';

  if (value instanceof Date) {
    return `'${value.toISOString().split('T')[0]}'`;
  }

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

  const supabase = createFredImportClient();

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

    const { error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      return { inserted: 0, error: error.message };
    }

    return { inserted: records.length };
  } catch (err: any) {
    return { inserted: 0, error: err.message };
  }
}

/**
 * Ensure geographic unit exists
 */
export async function ensureGeographicUnitExists(
  geoid: string,
  level: string,
  name: string
): Promise<void> {
  const supabase = createFredImportClient();

  const { data: existing } = await supabase
    .from('geographic_units')
    .select('geoid')
    .eq('geoid', geoid)
    .maybeSingle();

  if (!existing) {
    await batchUpsertSQL('geographic_units', [{ geoid, level, name }], 'geoid');
    await batchUpsertSQL('markets', [{
      region_id: geoid,
      region_name: name,
      region_type: level,
      geoid
    }], 'region_id');
  }
}

/**
 * Get geographic units by level
 */
export async function getGeographicUnits(
  geography: 'state' | 'county' | 'msa'
): Promise<Array<{ geoid: string;[key: string]: any }>> {
  const supabase = createFredImportClient();

  const levelMap: Record<string, string> = {
    state: 'state',
    county: 'county',
    msa: 'cbsa'
  };

  const { data, error } = await supabase
    .from('geographic_units')
    .select('*')
    .eq('level', levelMap[geography]);

  if (error) {
    console.warn(`   ⚠️  Could not fetch ${geography} GEOIDs: ${error.message}`);
    return [];
  }

  return (data || []).map(row => ({ geoid: row.geoid, ...row }));
}
