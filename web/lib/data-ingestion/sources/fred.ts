import axios from 'axios'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const FRED_API_BASE = 'https://api.stlouisfed.org/fred/series/observations'

interface FREDObservation {
  date: string
  value: string
}

interface FREDResponse {
  observations: FREDObservation[]
  realtime_start: string
  realtime_end: string
}

interface TimeSeriesRecord {
  region_id: string
  date: string
  metric_name: string
  metric_value: number
  data_source: string
  attributes?: Record<string, any>
}

const FRED_SERIES = {
  mortgage_rate_30yr: {
    series_id: 'MORTGAGE30US',
    metric_name: 'mortgage_rate_30yr',
    description: '30-Year Fixed Rate Mortgage Average'
  },
  mortgage_rate_15yr: {
    series_id: 'MORTGAGE15US',
    metric_name: 'mortgage_rate_15yr',
    description: '15-Year Fixed Rate Mortgage Average'
  },
  unemployment_rate: {
    series_id: 'UNRATE',
    metric_name: 'unemployment_rate',
    description: 'Unemployment Rate'
  }
}

const UNITED_STATES_REGION_ID = '102001'

export async function importFREDData(
  seriesKeys: string[] = ['mortgage_rate_30yr'],
  apiKey?: string
) {
  const supabase = createSupabaseAdminClient()
  const fredApiKey = apiKey || process.env.FRED_API_KEY

  if (!fredApiKey) {
    throw new Error('FRED API key is required. Set FRED_API_KEY environment variable or pass as parameter.')
  }

  console.log(`\n📊 Starting FRED import for: ${seriesKeys.join(', ')}`)
  console.log('================================================')

  // Ensure United States region exists
  const { error: marketError } = await supabase
    .from('markets')
    .upsert({
      region_id: UNITED_STATES_REGION_ID,
      region_name: 'United States',
      region_type: 'country'
    }, {
      onConflict: 'region_id',
      ignoreDuplicates: false
    })

  if (marketError) {
    console.warn(`⚠️ Warning: Could not ensure United States region exists: ${marketError.message}`)
  } else {
    console.log('✅ United States region verified')
  }

  let totalRecordsInserted = 0
  const errors: any[] = []

  for (const seriesKey of seriesKeys) {
    const series = FRED_SERIES[seriesKey as keyof typeof FRED_SERIES]
    
    if (!series) {
      console.warn(`⚠️ Unknown series: ${seriesKey}`)
      continue
    }

    try {
      console.log(`\n📥 Fetching ${series.description} (${series.series_id})...`)

      const url = `${FRED_API_BASE}?series_id=${series.series_id}&api_key=${fredApiKey}&file_type=json&observation_start=2000-01-01`
      
      const response = await axios.get<FREDResponse>(url, {
        timeout: 30000
      })

      const observations = response.data.observations || []
      console.log(`✅ Fetched ${observations.length} observations`)

      const timeSeriesData: TimeSeriesRecord[] = []

      for (const obs of observations) {
        const value = parseFloat(obs.value)
        
        if (!isNaN(value) && obs.value !== '.') {
          timeSeriesData.push({
            region_id: UNITED_STATES_REGION_ID,
            date: obs.date,
            metric_name: series.metric_name,
            metric_value: value,
            data_source: 'fred',
            attributes: {
              series_id: series.series_id
            }
          })
        }
      }

      console.log(`📋 Prepared ${timeSeriesData.length} records for insertion`)

      if (timeSeriesData.length > 0) {
        const batchSize = 100
        let inserted = 0

        for (let i = 0; i < timeSeriesData.length; i += batchSize) {
          const batch = timeSeriesData.slice(i, i + batchSize)

          try {
            const { data, error } = await supabase
              .from('market_time_series')
              .upsert(batch, {
                onConflict: 'region_id,date,metric_name,data_source,attributes',
                ignoreDuplicates: false
              })
              .select()

            if (error) {
              console.error(`❌ Error upserting batch:`, error)
              errors.push({
                series: seriesKey,
                error: error.message,
                code: error.code
              })
            } else {
              inserted += batch.length
              console.log(`✅ Upserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`)
            }
          } catch (err: any) {
            console.error(`❌ Exception during upsert:`, err)
            errors.push({
              series: seriesKey,
              error: err.message
            })
          }
        }

        totalRecordsInserted += inserted
        console.log(`✅ Successfully imported ${inserted} records for ${series.description}`)
      }

      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error: any) {
      console.error(`❌ Error fetching ${series.description}:`, error.message)
      errors.push({
        series: seriesKey,
        error: error.message
      })
    }
  }

  console.log('\n📊 FRED Import Summary')
  console.log('================')
  console.log(`✅ Total records inserted: ${totalRecordsInserted}`)
  if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length}`)
  }

  return {
    success: errors.length === 0,
    recordsInserted: totalRecordsInserted,
    errors,
    message: `Imported FRED data: ${totalRecordsInserted} records`
  }
}

