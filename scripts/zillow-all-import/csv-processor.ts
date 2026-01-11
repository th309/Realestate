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
  metricName: string,
  extraData?: any
): any {
  const recordData: any = {
    region_id: regionId,
    date: dateCol,
    property_type: datasetConfig.propertyType || 'sfrcondo',
    geography: datasetConfig.geography
  };

  // ZHVI - Home Values
  if (tableName === 'zillow_zhvi') {
    recordData.value = value;
    recordData.tier = datasetConfig.tier || '0.33_0.67';
  }
  // ZORI - Rent Index
  else if (tableName === 'zillow_zori') {
    recordData.value = value;
  }
  // ZORDI - Renter Demand Index
  else if (tableName === 'zillow_zordi') {
    recordData.value = value;
  }
  // Inventory
  else if (tableName === 'zillow_inventory') {
    recordData.inventory_count = Math.round(value);
  }
  // New Listings
  else if (tableName === 'zillow_new_listings') {
    recordData.value = Math.round(value);
  }
  // Pending Listings
  else if (tableName === 'zillow_pending_listings') {
    recordData.value = Math.round(value);
  }
  // Median List Price
  else if (tableName === 'zillow_median_list_price') {
    recordData.value = value;
  }
  // Sales Count
  else if (tableName === 'zillow_sales_count') {
    recordData.sales_count = Math.round(value);
  }
  // Sales Price
  else if (tableName === 'zillow_sales_price') {
    recordData.median_price = value;
  }
  // Sale-to-List Ratio
  else if (tableName === 'zillow_sale_to_list') {
    recordData.value = value;
  }
  // Days to Pending
  else if (tableName === 'zillow_days_to_pending') {
    recordData.days = value;
  }
  // Days to Close
  else if (tableName === 'zillow_days_to_close') {
    recordData.value = value;
  }
  // Price Cut Share
  else if (tableName === 'zillow_price_cut_share') {
    recordData.value = value;
  }
  // Price Cut Amount
  else if (tableName === 'zillow_price_cut_amt') {
    recordData.value = value;
  }
  // Price Cut Percent
  else if (tableName === 'zillow_price_cut_pct') {
    recordData.value = value;
  }
  // Market Heat Index
  else if (tableName === 'zillow_market_heat_index') {
    recordData.heat_index = value;
  }
  // New Construction Sales Count
  else if (tableName === 'zillow_new_construction_sales_count') {
    recordData.sales_count = Math.round(value);
  }
  // New Construction Sale Price
  else if (tableName === 'zillow_new_construction_sale_price') {
    // This table has multiple value types based on dataset
    if (datasetConfig.datasetType === 'new_con_median_sale_price_per_sqft') {
      recordData.price_per_sqft = value;
    } else {
      recordData.median_price = value;
    }
  }
  // Fallback to generic structure
  else {
    recordData.metric_name = metricName;
    recordData.metric_value = value;
    recordData.data_source = 'zillow';
    recordData.attributes = {
      property_type: datasetConfig.propertyType || 'sfrcondo',
      tier: datasetConfig.tier || '0.33_0.67',
      geography: datasetConfig.geography,
      dataset_type: datasetConfig.datasetType
    };
  }

  return recordData;
}

/**
 * Build ZHVF (forecast) record - special handling for multiple columns
 */
function buildForecastRecord(
  regionId: string,
  dateCol: string,
  record: any,
  datasetConfig: DatasetConfig
): any {
  // ZHVF has columns like: BaseDate, 1MonthForecast, 3MonthForecast, 12MonthForecast
  // or: 2024-01-31 (date), 2024-02-29 (1m), 2024-04-30 (3m), 2025-01-31 (12m)
  return {
    region_id: regionId,
    date: dateCol,
    forecast_1m: record['1MonthForecast'] ?? record['MoMForecast'] ?? null,
    forecast_3m: record['3MonthForecast'] ?? record['QoQForecast'] ?? null,
    forecast_12m: record['12MonthForecast'] ?? record['YoYForecast'] ?? null,
    geography: datasetConfig.geography
  };
}

/**
 * Build affordability record - maps to specific columns
 */
function buildAffordabilityRecord(
  regionId: string,
  dateCol: string,
  value: number,
  datasetConfig: DatasetConfig
): any {
  const record: any = {
    region_id: regionId,
    date: dateCol,
    property_type: datasetConfig.propertyType || 'sfrcondo',
    geography: datasetConfig.geography,
    down_payment_percent: 20.0
  };

  // Map value to appropriate column based on dataset type
  switch (datasetConfig.datasetType) {
    case 'new_homeowner_income_needed':
      record.homeowner_income_needed = value;
      break;
    case 'new_renter_income_needed':
      record.renter_income_needed = value;
      break;
    case 'affordable_home_price':
    case 'affordable_price':
      record.affordable_home_price = value;
      break;
    case 'years_to_save':
      record.years_to_save = value;
      break;
    case 'new_homeowner_affordability':
      record.homeowner_affordability_percent = value;
      break;
    case 'new_renter_affordability':
      record.renter_affordability_percent = value;
      break;
  }

  return record;
}

/**
 * Import CSV data into database
 * Optimized: Collects all data first, then batch inserts
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
  const isAffordability = tableName === 'zillow_affordability';
  const isForecast = tableName === 'zillow_zhvf';
  const batchSize = 10000;
  const conflictColumns = getConflictColumns(tableName);

  // Collect all markets and time series data first (memory efficient pass)
  const marketsMap = new Map<string, any>();
  const allTimeSeriesData: any[] = [];

  for (const record of records) {
    const regionId = record.RegionID;
    const regionName = record.RegionName;
    const regionType = record.RegionType === 'msa' ? 'msa' : record.RegionType;
    const stateName = record.StateName || null;
    const sizeRank = record.SizeRank ? parseInt(record.SizeRank) : null;

    if (!regionId || !regionName) {
      continue;
    }

    // Collect market data (deduplicated by region_id)
    if (!marketsMap.has(regionId)) {
      marketsMap.set(regionId, {
        region_id: regionId,
        region_name: regionName,
        region_type: regionType,
        state_name: stateName || undefined,
        state_code: stateName ? stateName.substring(0, 2).toUpperCase() : undefined,
        size_rank: sizeRank || undefined
      });
    }

    // Handle forecast datasets
    if (isForecast) {
      const forecastCols = ['MoMForecast', 'QoQForecast', 'YoYForecast', '1MonthForecast', '3MonthForecast', '12MonthForecast'];
      const hasForecasts = forecastCols.some(col => record[col] !== undefined);

      if (hasForecasts) {
        const dateColumns = Object.keys(record).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
        const baseDate = dateColumns[0] || new Date().toISOString().split('T')[0];

        allTimeSeriesData.push({
          region_id: regionId,
          date: baseDate,
          forecast_1m: parseFloat(record['MoMForecast'] || record['1MonthForecast']) || null,
          forecast_3m: parseFloat(record['QoQForecast'] || record['3MonthForecast']) || null,
          forecast_12m: parseFloat(record['YoYForecast'] || record['12MonthForecast']) || null,
          geography: datasetConfig.geography
        });
      }
      continue;
    }

    // Extract time series data
    const dateColumns = Object.keys(record).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));

    for (const dateCol of dateColumns) {
      const value = parseFloat(record[dateCol]);
      if (!isNaN(value) && value !== null && value !== 0) {
        let recordData;

        if (isAffordability) {
          recordData = buildAffordabilityRecord(regionId, dateCol, value, datasetConfig);
        } else {
          recordData = buildTimeSeriesRecord(
            tableName,
            regionId,
            dateCol,
            value,
            datasetConfig,
            metricName
          );
        }
        allTimeSeriesData.push(recordData);
      }
    }
  }

  // Batch upsert markets (one API call per batch instead of per record)
  const marketsArray = Array.from(marketsMap.values());
  for (let i = 0; i < marketsArray.length; i += batchSize) {
    const batch = marketsArray.slice(i, i + batchSize);
    const { error: marketError } = await supabase
      .from('markets')
      .upsert(batch, { onConflict: 'region_id' });

    if (marketError) {
      errors++;
    } else {
      marketsCreated += batch.length;
    }
  }

  // Batch upsert time series
  for (let i = 0; i < allTimeSeriesData.length; i += batchSize) {
    const batch = allTimeSeriesData.slice(i, i + batchSize);

    const { error: tsError } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict: conflictColumns });

    if (tsError) {
      errors++;
    } else {
      timeSeriesInserted += batch.length;
    }
  }

  return { marketsCreated, timeSeriesInserted, errors };
}
