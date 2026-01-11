/**
 * CSV processor for Zillow datasets
 */

import { parse as parseSync } from 'csv-parse/sync';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CSVImportResult, DatasetConfig } from './types';
import { getTableName, getConflictColumns } from './db-client';

/**
 * Build time series record based on table type
 */
function buildTimeSeriesRecord(
  tableName: string,
  regionId: string,
  dateCol: string,
  value: number,
  datasetConfig: DatasetConfig,
  metricName: string
): any {
  const recordData: any = {
    region_id: regionId,
    date: dateCol,
    property_type: datasetConfig.propertyType || 'sfrcondo',
    geography: datasetConfig.geography
  };

  if (tableName === 'zillow_zhvi') {
    recordData.value = value;
    recordData.tier = datasetConfig.tier || 'middle';
  } else if (tableName === 'zillow_zori') {
    recordData.value = value;
  } else if (tableName === 'zillow_inventory') {
    recordData.inventory_count = Math.round(value);
  } else if (tableName === 'zillow_sales_count') {
    recordData.sales_count = Math.round(value);
  } else if (tableName === 'zillow_sales_price') {
    recordData.median_price = value;
  } else if (tableName === 'zillow_days_to_pending') {
    recordData.days = value;
  } else {
    recordData.metric_name = metricName;
    recordData.metric_value = value;
    recordData.data_source = 'zillow';
    recordData.attributes = {
      property_type: datasetConfig.propertyType || 'sfrcondo',
      tier: datasetConfig.tier || 'middle',
      geography: datasetConfig.geography,
      dataset_type: datasetConfig.datasetType
    };
  }

  return recordData;
}

/**
 * Import CSV data into database
 */
export async function importCSV(
  supabase: SupabaseClient,
  csvContent: string,
  metricName: string,
  datasetConfig: DatasetConfig
): Promise<CSVImportResult> {
  const records: any[] = parseSync(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  let marketsCreated = 0;
  let timeSeriesInserted = 0;
  let errors = 0;

  const tableName = getTableName(datasetConfig.datasetType);

  for (const record of records) {
    try {
      const regionId = record.RegionID;
      const regionName = record.RegionName;
      const regionType = record.RegionType === 'msa' ? 'msa' : record.RegionType;
      const stateName = record.StateName || null;
      const sizeRank = record.SizeRank ? parseInt(record.SizeRank) : null;

      if (!regionId || !regionName) {
        continue;
      }

      // Upsert market
      const marketData = {
        region_id: regionId,
        region_name: regionName,
        region_type: regionType,
        state_name: stateName || undefined,
        state_code: stateName ? stateName.substring(0, 2).toUpperCase() : undefined,
        size_rank: sizeRank || undefined
      };

      const { error: marketError } = await supabase
        .from('markets')
        .upsert(marketData, { onConflict: 'region_id' });

      if (marketError) {
        errors++;
        continue;
      }

      marketsCreated++;

      // Extract time series data
      const dateColumns = Object.keys(record).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
      const timeSeriesData: any[] = [];

      for (const dateCol of dateColumns) {
        const value = parseFloat(record[dateCol]);
        if (!isNaN(value) && value !== null && value !== 0) {
          const recordData = buildTimeSeriesRecord(
            tableName,
            regionId,
            dateCol,
            value,
            datasetConfig,
            metricName
          );
          timeSeriesData.push(recordData);
        }
      }

      // Insert time series in batches
      if (timeSeriesData.length > 0) {
        const batchSize = 100;
        const conflictColumns = getConflictColumns(tableName);

        for (let i = 0; i < timeSeriesData.length; i += batchSize) {
          const batch = timeSeriesData.slice(i, i + batchSize);

          const { error: tsError } = await supabase
            .from(tableName)
            .upsert(batch, { onConflict: conflictColumns });

          if (tsError) {
            errors++;
          } else {
            timeSeriesInserted += batch.length;
          }
        }
      }

    } catch (error: any) {
      errors++;
    }
  }

  return { marketsCreated, timeSeriesInserted, errors };
}
