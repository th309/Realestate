/**
 * Batch Loading Utilities
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BatchResult } from './types';
import { executeSQL } from './db-client';

/**
 * Load a batch of features to Supabase
 */
export async function loadBatch(
  features: any[],
  tableName: string,
  geometryColumn: string,
  geoidField: string,
  supabase: SupabaseClient
): Promise<BatchResult> {
  const values: string[] = [];
  const geoids: string[] = [];

  for (const feature of features) {
    const geoid = extractGeoid(feature, geoidField);

    if (!geoid || !feature.geometry) {
      continue;
    }

    geoids.push(geoid);
    const valueString = buildInsertValue(feature, geoid, tableName);
    values.push(valueString);
  }

  if (values.length === 0) {
    return { loaded: 0, errors: 0, errorMessages: [] };
  }

  return executeBatchInsert(values, tableName, geometryColumn, geoids.length, supabase);
}

/**
 * Extract GEOID from feature properties
 */
function extractGeoid(feature: any, geoidField: string): string | null {
  return (
    feature.properties?.[geoidField] ||
    feature.properties?.GEOID ||
    feature.properties?.CBSAFP ||
    feature.properties?.GEOID20 ||
    null
  );
}

/**
 * Build INSERT value string for a feature
 */
function buildInsertValue(feature: any, geoid: string, tableName: string): string {
  const geoJsonStr = JSON.stringify(feature.geometry)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''");

  const name = tableName === 'tiger_zcta'
    ? null
    : (feature.properties?.NAME || feature.properties?.name || '');
  const nameEscaped = name ? name.replace(/'/g, "''") : '';

  if (name && tableName !== 'tiger_zcta') {
    return `('${geoid}', '${nameEscaped}', ST_Multi(ST_GeomFromGeoJSON('${geoJsonStr}')::geometry))`;
  }

  return `('${geoid}', ST_Multi(ST_GeomFromGeoJSON('${geoJsonStr}')::geometry))`;
}

/**
 * Execute batch INSERT with conflict handling
 */
async function executeBatchInsert(
  values: string[],
  tableName: string,
  geometryColumn: string,
  count: number,
  supabase: SupabaseClient
): Promise<BatchResult> {
  const firstValue = values[0] || '';
  const hasName = tableName !== 'tiger_zcta' && (firstValue.includes("', '") || firstValue.includes("', NULL"));

  if (hasName) {
    return executeWithNameColumn(values, tableName, geometryColumn, count, supabase);
  }

  return executeWithoutNameColumn(values, tableName, geometryColumn, count, supabase);
}

/**
 * Execute INSERT with name column
 */
async function executeWithNameColumn(
  values: string[],
  tableName: string,
  geometryColumn: string,
  count: number,
  supabase: SupabaseClient
): Promise<BatchResult> {
  const insertSql = `
    INSERT INTO ${tableName} (geoid, name, ${geometryColumn})
    VALUES ${values.join(', ')}
    ON CONFLICT (geoid)
    DO UPDATE SET
      name = EXCLUDED.name,
      ${geometryColumn} = EXCLUDED.${geometryColumn}
  `;

  try {
    const { error } = await executeSQL(supabase, insertSql);

    if (error) {
      // Fallback: try without name column
      const valuesWithoutName = values.map((v) => {
        const match = v.match(/\(([^,]+),\s*[^,]+,\s*([^)]+)\)/);
        if (match) {
          return `(${match[1]}, ${match[2]})`;
        }
        return v;
      });

      const insertSqlNoName = `
        INSERT INTO ${tableName} (geoid, ${geometryColumn})
        VALUES ${valuesWithoutName.join(', ')}
        ON CONFLICT (geoid)
        DO UPDATE SET ${geometryColumn} = EXCLUDED.${geometryColumn}
      `;

      const { error: error2 } = await executeSQL(supabase, insertSqlNoName);
      return handleSQLResult(error2, count);
    }

    return { loaded: count, errors: 0, errorMessages: [] };
  } catch (error: any) {
    return handleSQLResult(error, count);
  }
}

/**
 * Execute INSERT without name column
 */
async function executeWithoutNameColumn(
  values: string[],
  tableName: string,
  geometryColumn: string,
  count: number,
  supabase: SupabaseClient
): Promise<BatchResult> {
  const insertSql = `
    INSERT INTO ${tableName} (geoid, ${geometryColumn})
    VALUES ${values.join(', ')}
    ON CONFLICT (geoid)
    DO UPDATE SET ${geometryColumn} = EXCLUDED.${geometryColumn}
  `;

  try {
    const { error } = await executeSQL(supabase, insertSql);
    return handleSQLResult(error, count);
  } catch (error: any) {
    return handleSQLResult(error, count);
  }
}

/**
 * Handle SQL execution result
 */
function handleSQLResult(error: any, count: number): BatchResult {
  if (error) {
    const errorMsg = error.message || error.toString();
    console.error(`   SQL Error: ${errorMsg.substring(0, 200)}`);
    return {
      loaded: 0,
      errors: count,
      errorMessages: [errorMsg.substring(0, 200)]
    };
  }

  return {
    loaded: count,
    errors: 0,
    errorMessages: []
  };
}
