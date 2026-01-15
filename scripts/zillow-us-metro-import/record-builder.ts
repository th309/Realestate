/**
 * Record Builder for Zillow Tables
 */

/**
 * Map dataset type to metric name for long-format tables
 */
function getMetricNameForDataset(datasetType: string): string {
  const metricMap: Record<string, string> = {
    'market_temp_index': 'market_heat',
    'zhvi': 'zhvi',
    'zori': 'zori',
    'invt_fs': 'inventory',
    'sales_count_now': 'sales_count',
    'median_sale_price': 'sale_price',
    'mean_doz_pending': 'dom',
  };
  return metricMap[datasetType] || datasetType;
}

/**
 * Build a database record based on table and dataset type
 */
export function buildRecord(
  regionId: string,
  date: string,
  value: number,
  datasetType: string,
  tableName: string,
  propertyType: string,
  geography: string,
  tier?: string,
  options?: { cbsaCode?: string; regionName?: string; stateCode?: string }
): any {
  const record: any = {
    region_id: regionId,
    date: date,
    property_type: propertyType,
    geography: geography
  };

  switch (tableName) {
    case 'zillow_zhvi':
      record.value = value;
      if (tier) record.tier = tier;
      break;

    case 'zillow_zori':
      record.value = value;
      break;

    case 'zillow_inventory':
      record.inventory_count = Math.round(value);
      break;

    case 'zillow_sales_count':
      record.sales_count = Math.round(value);
      break;

    case 'zillow_sales_price':
      if (datasetType === 'mean_sale_price') {
        record.mean_price = value;
      } else {
        record.median_price = value;
      }
      break;

    case 'zillow_days_to_pending':
      record.days = value;
      break;

    case 'zillow_market_heat_index':
      record.heat_index = value;
      break;

    case 'zillow_metro':
      // Long-format table - use metric_name and value columns
      record.metric_name = getMetricNameForDataset(datasetType);
      record.value = value;
      record.period_date = record.date;
      // Add optional fields for zillow_metro
      if (options?.cbsaCode) record.cbsa_code = options.cbsaCode;
      if (options?.regionName) record.region_name = options.regionName;
      if (options?.stateCode) record.state_code = options.stateCode;
      delete record.date;
      delete record.property_type;
      delete record.geography;
      break;

    case 'zillow_new_construction_sales_count':
      record.sales_count = Math.round(value);
      break;

    case 'zillow_new_construction_sale_price':
      record.median_price = value;
      break;

    case 'zillow_affordability':
      buildAffordabilityRecord(record, datasetType, value);
      break;

    case 'zillow_new_listings':
      record.new_listings_count = Math.round(value);
      break;

    case 'zillow_list_price':
      record.median_list_price = value;
      break;

    case 'zillow_sale_to_list_ratio':
      record.mean_ratio = value;
      break;

    case 'zillow_days_to_close':
      record.mean_days = value;
      break;

    case 'zillow_total_transaction_value':
      record.total_value = value;
      break;
  }

  return record;
}

function buildAffordabilityRecord(record: any, datasetType: string, value: number): void {
  switch (datasetType) {
    case 'new_homeowner_income_needed':
      record.homeowner_income_needed = value;
      record.down_payment_percent = 20.0;
      break;
    case 'new_renter_income_needed':
      record.renter_income_needed = value;
      break;
    case 'affordable_home_price':
      record.affordable_home_price = value;
      record.down_payment_percent = 20.0;
      break;
    case 'years_to_save':
      record.years_to_save = value;
      record.down_payment_percent = 20.0;
      break;
    case 'new_homeowner_affordability':
      record.homeowner_affordability_percent = value;
      record.down_payment_percent = 20.0;
      break;
    case 'new_renter_affordability':
      record.renter_affordability_percent = value;
      break;
  }
}

/**
 * Get conflict columns for upsert
 */
export function getConflictColumns(tableName: string, datasetType?: string): string {
  if (tableName === 'zillow_metro') {
    return 'region_id,period_date,metric_name';
  } else if (tableName === 'zillow_zhvi') {
    return 'region_id,date,property_type,tier';
  } else if (tableName === 'zillow_affordability') {
    return 'region_id,date,property_type,down_payment_percent';
  } else if (tableName === 'zillow_sales_price' && datasetType === 'mean_sale_price') {
    return 'region_id,date,property_type';
  } else {
    return 'region_id,date,property_type';
  }
}

/**
 * Determine property type based on dataset type
 */
export function getPropertyType(datasetType: string): string {
  const renterDatasets = ['zori', 'new_renter_income_needed', 'new_renter_affordability'];
  return renterDatasets.includes(datasetType) ? 'sfrcondomfr' : 'sfrcondo';
}

/**
 * Determine if dataset requires tier
 */
export function requiresTier(datasetType: string): boolean {
  const tieredDatasets = [
    'zhvi',
    'new_homeowner_income_needed',
    'affordable_home_price',
    'years_to_save',
    'new_homeowner_affordability'
  ];
  return tieredDatasets.includes(datasetType);
}
