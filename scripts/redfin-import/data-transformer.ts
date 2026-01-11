/**
 * Data transformation utilities for Redfin import
 */

import type { ParsedRow, RedfinMetricsRecord } from './types'

/**
 * Convert parsed rows to redfin_metrics format (wide format)
 */
export function convertToRedfinMetricsFormat(rows: ParsedRow[]): RedfinMetricsRecord[] {
  const records: RedfinMetricsRecord[] = []

  rows.forEach(row => {
    const record: RedfinMetricsRecord = {
      geoid: '', // Will be filled later
      metric_date: row.periodEnd || row.periodBegin
    }

    // Map metrics to redfin_metrics column names
    Object.entries(row.metrics).forEach(([metricName, metricData]) => {
      const normalizedName = metricName.toLowerCase()

      if (normalizedName.includes('median_sale_price') && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.median_sale_price = metricData.value ?? undefined
        if (metricData.yoy !== null && metricData.yoy !== undefined) {
          record.median_sale_price_yoy = metricData.yoy
        }
      } else if (normalizedName.includes('median_list_price') && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.median_list_price = metricData.value ?? undefined
      } else if ((normalizedName.includes('median_ppsf') || normalizedName.includes('price_per_square_foot')) && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.median_ppsf = metricData.value ?? undefined
      } else if (normalizedName.includes('homes_sold') && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.homes_sold = metricData.value ?? undefined
        if (metricData.yoy !== null && metricData.yoy !== undefined) {
          record.homes_sold_yoy = metricData.yoy
        }
      } else if (normalizedName.includes('new_listings') && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.new_listings = metricData.value ?? undefined
      } else if (normalizedName.includes('inventory') && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.inventory = metricData.value ?? undefined
      } else if (normalizedName.includes('months_of_supply') && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.months_of_supply = metricData.value ?? undefined
      } else if ((normalizedName.includes('median_dom') || normalizedName.includes('days_on_market')) && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.median_days_on_market = metricData.value ?? undefined
      } else if (normalizedName.includes('sale_to_list') || normalizedName.includes('sale_to_list_ratio')) {
        record.average_sale_to_list = metricData.value ?? undefined
      } else if (normalizedName.includes('compete_score')) {
        record.compete_score = metricData.value ?? undefined
      } else if (normalizedName.includes('bidding_war') || normalizedName.includes('sold_above_list')) {
        record.bidding_war_percentage = metricData.value ?? undefined
      } else if (normalizedName.includes('price_drops') || normalizedName.includes('price_drop')) {
        record.price_drops_percentage = metricData.value ?? undefined
      }
    })

    // Store region info for later geoid lookup
    record._regionName = row.region
    record._regionType = row.regionType
    record._stateCode = row.stateCode
    record._city = row.city

    records.push(record)
  })

  return records
}

/**
 * Assign geoids to records using region map
 */
export function assignGeoids(
  records: RedfinMetricsRecord[],
  regionMap: Map<string, string>
): RedfinMetricsRecord[] {
  return records.map(record => {
    const regionKey = `${record._regionType}|${record._stateCode || ''}|${record._regionName}`
    const geoid = regionMap.get(regionKey) || record._regionName || 'UNKNOWN'

    // Remove internal fields
    delete record._regionName
    delete record._regionType
    delete record._stateCode
    delete record._city

    return { ...record, geoid }
  })
}

/**
 * Filter records to only those with valid metrics
 */
export function filterValidRecords(records: RedfinMetricsRecord[]): RedfinMetricsRecord[] {
  return records.filter(record => {
    const hasMetrics = Object.keys(record).some(key =>
      key !== 'geoid' &&
      key !== 'metric_date' &&
      record[key] != null &&
      record[key] !== undefined &&
      record[key] !== ''
    )
    return hasMetrics && record.geoid && record.metric_date
  })
}

/**
 * Group records by target table based on date
 */
export function groupByTable(records: RedfinMetricsRecord[]): Map<string, RedfinMetricsRecord[]> {
  const recordsByTable = new Map<string, RedfinMetricsRecord[]>()

  records.forEach(record => {
    try {
      const date = new Date(record.metric_date)
      if (isNaN(date.getTime())) return

      const year = date.getFullYear()
      const tableName = year === 2024 ? 'redfin_metrics_2024'
                      : year === 2025 ? 'redfin_metrics_2025'
                      : 'redfin_metrics'

      if (!recordsByTable.has(tableName)) {
        recordsByTable.set(tableName, [])
      }
      recordsByTable.get(tableName)!.push(record)
    } catch {
      // Skip records with invalid dates
    }
  })

  return recordsByTable
}
