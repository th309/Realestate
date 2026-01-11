/**
 * Census Data Import
 *
 * Imports Census ACS data into market_time_series table.
 * Refactored to use modular components from ./census/
 */

import axios from 'axios'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { TimeSeriesRecord, CensusResponse, CensusGeoLevel, ImportResult } from './census/types'
import { CENSUS_API_BASE, CENSUS_VARIABLES } from './census/types'
import { mapCensusGeoToRegionId, createMarketFromCensusGeo } from './census/geo-mapping'

// Re-export for backward compatibility
export * from './census/types'
export * from './census/geo-mapping'

export async function importCensusData(
  variables: string[] = ['population', 'median_household_income'],
  year: number = 2022,
  geoLevel: CensusGeoLevel = 'metropolitan statistical area/micropolitan statistical area',
  apiKey?: string
): Promise<ImportResult> {
  const supabase = createSupabaseAdminClient()
  const censusApiKey = apiKey || process.env.CENSUS_API_KEY

  if (!censusApiKey) {
    throw new Error('Census API key is required. Set CENSUS_API_KEY environment variable or pass as parameter.')
  }

  console.log(`\n📊 Starting Census import for: ${variables.join(', ')}`)
  console.log(`Year: ${year}, Geographic Level: ${geoLevel}`)
  console.log('================================================')

  const dataset = 'acs/acs5'
  const variablesList = variables
    .map(v => CENSUS_VARIABLES[v as keyof typeof CENSUS_VARIABLES])
    .filter(Boolean)
    .map(v => v.variable)
    .join(',')

  const nameVariable = 'NAME'
  const geoVariable = geoLevel

  let totalRecordsInserted = 0
  const errors: any[] = []

  try {
    const url = `${CENSUS_API_BASE}/${year}/${dataset}?get=${variablesList},${nameVariable}&for=${geoVariable}:*&key=${censusApiKey}`

    console.log(`📥 Fetching Census data from: ${url.substring(0, 100)}...`)

    const response = await axios.get<CensusResponse>(url, {
      timeout: 60000
    })

    const data = response.data
    if (!Array.isArray(data) || data.length < 2) {
      throw new Error('Invalid Census API response format')
    }

    const headers = data[0]
    const rows = data.slice(1)

    console.log(`✅ Fetched ${rows.length} geographic areas`)

    const variableMetrics = variables
      .map(v => CENSUS_VARIABLES[v as keyof typeof CENSUS_VARIABLES])
      .filter(Boolean)

    for (const row of rows) {
      try {
        const record: Record<string, string> = {}
        headers.forEach((header: string, index: number) => {
          record[header] = row[index]
        })

        const name = record[nameVariable] || ''
        const geoCode = record[geoVariable] || ''

        if (!name || !geoCode) {
          continue
        }

        let regionId = await mapCensusGeoToRegionId(name, geoCode, geoLevel, record)

        if (!regionId) {
          regionId = await createMarketFromCensusGeo(name, geoCode, geoLevel, record)

          if (!regionId) {
            console.warn(`⚠️ Could not create or map Census geography: ${name} (${geoCode})`)
            continue
          }
        }

        for (const metric of variableMetrics) {
          const value = parseFloat(record[metric.variable])

          if (!isNaN(value) && value > 0) {
            const timeSeriesRecord: TimeSeriesRecord = {
              region_id: regionId,
              date: `${year}-01-01`,
              metric_name: metric.metric_name,
              metric_value: value,
              data_source: 'census',
              attributes: {
                survey_type: 'acs_5yr',
                year: year,
                variable: metric.variable,
                geo_level: geoLevel
              }
            }

            const { error } = await supabase
              .from('market_time_series')
              .upsert(timeSeriesRecord, {
                onConflict: 'region_id,date,metric_name,data_source,attributes',
                ignoreDuplicates: false
              })

            if (error) {
              console.error(`❌ Error upserting ${metric.metric_name} for ${name}:`, error.message)
              errors.push({
                geography: name,
                metric: metric.metric_name,
                error: error.message
              })
            } else {
              totalRecordsInserted++
            }
          }
        }

      } catch (error: any) {
        console.error(`❌ Error processing row:`, error.message)
        errors.push({
          error: error.message
        })
      }
    }

    console.log('\n📊 Census Import Summary')
    console.log('================')
    console.log(`✅ Total records inserted: ${totalRecordsInserted}`)
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`)
    }

    return {
      success: errors.length === 0,
      recordsInserted: totalRecordsInserted,
      errors,
      message: `Imported Census data: ${totalRecordsInserted} records`
    }

  } catch (error: any) {
    console.error(`❌ Error fetching Census data:`, error.message)
    throw error
  }
}
