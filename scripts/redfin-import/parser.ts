/**
 * TSV parser utilities for Redfin import
 */

import type { MetricColumn, ParsedRow } from './types'

// Columns to skip when identifying metrics
const SKIP_COLUMNS = [
  'PERIOD_BEGIN', 'PERIOD_END', 'PERIOD_DURATION',
  'REGION_TYPE', 'REGION_TYPE_ID', 'TABLE_ID', 'IS_SEASONALLY_ADJUSTED',
  'REGION', 'CITY', 'STATE', 'STATE_CODE',
  'PROPERTY_TYPE', 'PROPERTY_TYPE_ID',
  'PARENT_METRO_REGION', 'PARENT_METRO_REGION_METRO_CODE', 'LAST_UPDATED'
]

/**
 * Identify metric columns from the header row
 */
export function identifyMetricColumns(headers: string[]): MetricColumn[] {
  const metricColumns: MetricColumn[] = []
  const metricMap = new Map<string, { base: string; index: number; type: 'value' | 'mom' | 'yoy' }>()

  headers.forEach((header, index) => {
    const cleanHeader = header.trim().replace(/^"|"$/g, '')

    if (SKIP_COLUMNS.includes(cleanHeader)) {
      return
    }

    let baseMetric = cleanHeader
    let type: 'value' | 'mom' | 'yoy' = 'value'

    if (cleanHeader.endsWith('_MOM')) {
      baseMetric = cleanHeader.replace(/_MOM$/, '')
      type = 'mom'
    } else if (cleanHeader.endsWith('_YOY')) {
      baseMetric = cleanHeader.replace(/_YOY$/, '')
      type = 'yoy'
    }

    const normalizedMetric = baseMetric
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    if (!metricMap.has(normalizedMetric)) {
      metricMap.set(normalizedMetric, { base: baseMetric, index: -1, type: 'value' })
    }

    const metric = metricMap.get(normalizedMetric)!
    if (type === 'value') {
      metric.index = index
    } else if (type === 'mom') {
      metricMap.set(`${normalizedMetric}_mom`, { base: baseMetric, index, type: 'mom' })
    } else if (type === 'yoy') {
      metricMap.set(`${normalizedMetric}_yoy`, { base: baseMetric, index, type: 'yoy' })
    }
  })

  // Build metric columns array
  metricMap.forEach((info, normalizedMetric) => {
    if (info.type === 'value' && info.index >= 0) {
      metricColumns.push({
        name: normalizedMetric,
        index: info.index,
        isMoM: false,
        isYoY: false,
        baseMetric: info.base
      })

      const momKey = `${normalizedMetric}_mom`
      const yoyKey = `${normalizedMetric}_yoy`

      if (metricMap.has(momKey)) {
        metricColumns.push({
          name: normalizedMetric,
          index: metricMap.get(momKey)!.index,
          isMoM: true,
          isYoY: false,
          baseMetric: info.base
        })
      }

      if (metricMap.has(yoyKey)) {
        metricColumns.push({
          name: normalizedMetric,
          index: metricMap.get(yoyKey)!.index,
          isMoM: false,
          isYoY: true,
          baseMetric: info.base
        })
      }
    }
  })

  return metricColumns
}

/**
 * Parse a single data row into ParsedRow structure
 */
export function parseDataRow(
  recordArray: string[],
  headers: string[],
  metricColumns: MetricColumn[]
): ParsedRow | null {
  const periodBeginIdx = headers.indexOf('PERIOD_BEGIN')
  const periodEndIdx = headers.indexOf('PERIOD_END')
  const regionIdx = headers.indexOf('REGION')
  const regionTypeIdx = headers.indexOf('REGION_TYPE')

  const row: ParsedRow = {
    periodBegin: recordArray[periodBeginIdx]?.replace(/^"|"$/g, '') || '',
    periodEnd: recordArray[periodEndIdx]?.replace(/^"|"$/g, '') || '',
    region: recordArray[regionIdx]?.replace(/^"|"$/g, '').trim() || '',
    regionType: recordArray[regionTypeIdx]?.replace(/^"|"$/g, '').toLowerCase() || '',
    city: recordArray[headers.indexOf('CITY')]?.replace(/^"|"$/g, '') || undefined,
    state: recordArray[headers.indexOf('STATE')]?.replace(/^"|"$/g, '') || undefined,
    stateCode: recordArray[headers.indexOf('STATE_CODE')]?.replace(/^"|"$/g, '') || undefined,
    propertyType: recordArray[headers.indexOf('PROPERTY_TYPE')]?.replace(/^"|"$/g, '') || undefined,
    metrics: {}
  }

  // Extract all metrics
  metricColumns.forEach(col => {
    if (!col.isMoM && !col.isYoY) {
      const valueStr = recordArray[col.index]?.replace(/^"|"$/g, '') || ''
      const value = valueStr && valueStr !== 'NA' && valueStr !== '' ? parseFloat(valueStr) : null
      if (value !== null && !isNaN(value)) {
        if (!row.metrics[col.name]) {
          row.metrics[col.name] = { value: null }
        }
        row.metrics[col.name].value = value
      }
    } else if (col.isMoM) {
      const momStr = recordArray[col.index]?.replace(/^"|"$/g, '') || ''
      const mom = momStr && momStr !== 'NA' && momStr !== '' ? parseFloat(momStr) : null
      if (mom !== null && !isNaN(mom) && row.metrics[col.name]) {
        row.metrics[col.name].mom = mom
      }
    } else if (col.isYoY) {
      const yoyStr = recordArray[col.index]?.replace(/^"|"$/g, '') || ''
      const yoy = yoyStr && yoyStr !== 'NA' && yoyStr !== '' ? parseFloat(yoyStr) : null
      if (yoy !== null && !isNaN(yoy) && row.metrics[col.name]) {
        row.metrics[col.name].yoy = yoy
      }
    }
  })

  return row
}
