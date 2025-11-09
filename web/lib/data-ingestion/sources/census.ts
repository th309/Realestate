import axios from 'axios'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const CENSUS_API_BASE = 'https://api.census.gov/data'

interface TimeSeriesRecord {
  region_id: string
  date: string
  metric_name: string
  metric_value: number
  data_source: string
  attributes?: Record<string, any>
}

interface CensusResponse {
  [index: number]: string[]
}

const CENSUS_VARIABLES = {
  population: {
    variable: 'B01001_001E',
    metric_name: 'population',
    description: 'Total Population'
  },
  median_household_income: {
    variable: 'B19013_001E',
    metric_name: 'median_household_income',
    description: 'Median Household Income'
  },
  poverty_population: {
    variable: 'B17001_002E',
    metric_name: 'poverty_population',
    description: 'Population Below Poverty Level'
  },
  median_gross_rent: {
    variable: 'B25064_001E',
    metric_name: 'median_gross_rent',
    description: 'Median Gross Rent'
  }
}

export async function importCensusData(
  variables: string[] = ['population', 'median_household_income'],
  year: number = 2022,
  geoLevel: 'state' | 'metropolitan statistical area/micropolitan statistical area' | 'place' | 'zip code tabulation area' = 'metropolitan statistical area/micropolitan statistical area',
  apiKey?: string
) {
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

  const geoVariable = geoLevel === 'state' ? 'state' :
                      geoLevel === 'metropolitan statistical area/micropolitan statistical area' ? 'metropolitan statistical area/micropolitan statistical area' :
                      geoLevel === 'place' ? 'place' :
                      'zip code tabulation area'

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
        headers.forEach((header, index) => {
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

async function mapCensusGeoToRegionId(
  name: string,
  geoCode: string,
  geoLevel: string,
  record: Record<string, string>
): Promise<string | null> {
  const supabase = createSupabaseAdminClient()

  if (geoLevel === 'state') {
    const stateCode = geoCode.padStart(2, '0')
    const stateName = name.replace(' State', '').trim()

    const { data } = await supabase
      .from('markets')
      .select('region_id')
      .eq('region_type', 'state')
      .or(`region_name.ilike.%${stateName}%,state_code.eq.${stateCode}`)
      .limit(1)
      .single()

    return data?.region_id || null
  }

  if (geoLevel === 'metropolitan statistical area/micropolitan statistical area') {
    const metroName = name.split(',')[0].trim()
    const stateCode = record['state'] ? record['state'].padStart(2, '0') : null

    const query = supabase
      .from('markets')
      .select('region_id')
      .eq('region_type', 'msa')
      .ilike('region_name', `%${metroName}%`)

    if (stateCode) {
      query.eq('state_code', stateCode)
    }

    const { data } = await query.limit(1).single()

    return data?.region_id || null
  }

  if (geoLevel === 'place') {
    const cityName = name.split(',')[0].trim()
    const stateCode = record['state'] ? record['state'].padStart(2, '0') : null

    const query = supabase
      .from('markets')
      .select('region_id')
      .eq('region_type', 'city')
      .ilike('region_name', `%${cityName}%`)

    if (stateCode) {
      query.eq('state_code', stateCode)
    }

    const { data } = await query.limit(1).single()

    return data?.region_id || null
  }

  if (geoLevel === 'zip code tabulation area') {
    const zipCode = geoCode.padStart(5, '0')

    const { data } = await supabase
      .from('markets')
      .select('region_id')
      .eq('region_type', 'zip')
      .ilike('region_name', `%${zipCode}%`)
      .limit(1)
      .single()

    return data?.region_id || null
  }

  return null
}

async function createMarketFromCensusGeo(
  name: string,
  geoCode: string,
  geoLevel: string,
  record: Record<string, string>
): Promise<string | null> {
  const supabase = createSupabaseAdminClient()

  if (geoLevel === 'metropolitan statistical area/micropolitan statistical area') {
    const metroName = name.split(',')[0].trim()
    const stateParts = name.split(',')
    const stateName = stateParts.length > 1 ? stateParts[1].trim() : null
    const stateCode = record['state'] ? getStateCodeFromFIPS(record['state']) : null

    const regionId = `CENSUS-MSA-${geoCode.padStart(5, '0')}`

    const marketData = {
      region_id: regionId,
      region_name: name,
      region_type: 'msa',
      state_name: stateName || undefined,
      state_code: stateCode || undefined,
      metro_name: metroName
    }

    const { error } = await supabase
      .from('markets')
      .upsert(marketData, {
        onConflict: 'region_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`❌ Error creating market for ${name}:`, error.message)
      return null
    }

    console.log(`✅ Created market: ${name} (${regionId})`)
    return regionId
  }

  if (geoLevel === 'state') {
    const stateCode = getStateCodeFromFIPS(geoCode)
    const stateName = name.replace(' State', '').trim()
    const regionId = `CENSUS-STATE-${geoCode.padStart(2, '0')}`

    const marketData = {
      region_id: regionId,
      region_name: stateName,
      region_type: 'state',
      state_name: stateName,
      state_code: stateCode
    }

    const { error } = await supabase
      .from('markets')
      .upsert(marketData, {
        onConflict: 'region_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`❌ Error creating market for ${name}:`, error.message)
      return null
    }

    return regionId
  }

  if (geoLevel === 'place') {
    const cityName = name.split(',')[0].trim()
    const stateName = name.split(',')[1]?.trim() || null
    const stateCode = record['state'] ? getStateCodeFromFIPS(record['state']) : null
    const regionId = `CENSUS-PLACE-${geoCode.padStart(7, '0')}`

    const marketData = {
      region_id: regionId,
      region_name: name,
      region_type: 'city',
      state_name: stateName || undefined,
      state_code: stateCode || undefined
    }

    const { error } = await supabase
      .from('markets')
      .upsert(marketData, {
        onConflict: 'region_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`❌ Error creating market for ${name}:`, error.message)
      return null
    }

    return regionId
  }

  if (geoLevel === 'zip code tabulation area') {
    const zipCode = geoCode.padStart(5, '0')
    const regionId = `CENSUS-ZIP-${zipCode}`

    const marketData = {
      region_id: regionId,
      region_name: `ZIP Code ${zipCode}`,
      region_type: 'zip',
      state_code: record['state'] ? getStateCodeFromFIPS(record['state']) : undefined
    }

    const { error } = await supabase
      .from('markets')
      .upsert(marketData, {
        onConflict: 'region_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`❌ Error creating market for ZIP ${zipCode}:`, error.message)
      return null
    }

    return regionId
  }

  return null
}

function getStateCodeFromFIPS(fipsCode: string): string | null {
  const stateFipsToCode: Record<string, string> = {
    '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
    '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
    '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
    '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
    '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
    '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
    '54': 'WV', '55': 'WI', '56': 'WY'
  }

  const fips = fipsCode.padStart(2, '0')
  return stateFipsToCode[fips] || null
}

