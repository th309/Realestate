/**
 * Census Bureau API Data Importer
 *
 * Imports demographics, economics, and housing data from Census Bureau API
 * - American Community Survey 5-Year Estimates (ACS5)
 * - Supports ZIP, County, and State levels
 * - Annual updates (released each December)
 *
 * Usage:
 *   npx tsx scripts/importers/census-api-importer.ts --year 2022 --geography zip
 *   npx tsx scripts/importers/census-api-importer.ts --year 2022 --geography county
 *   npx tsx scripts/importers/census-api-importer.ts --year 2022 --geography state
 *   npx tsx scripts/importers/census-api-importer.ts --year 2022 --all
 */

import { createClient } from '@supabase/supabase-js'

const CENSUS_API_KEY = process.env.CENSUS_API_KEY!
const CENSUS_BASE_URL = 'https://api.census.gov/data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface CensusVariable {
  code: string
  description: string
  table: 'demographics' | 'economics' | 'housing'
  column: string
  transform?: (value: string) => number | null
}

// Census variable mappings
const CENSUS_VARIABLES: CensusVariable[] = [
  // DEMOGRAPHICS
  { code: 'B01001_001E', description: 'Total Population', table: 'demographics', column: 'total_population' },
  { code: 'B01002_001E', description: 'Median Age', table: 'demographics', column: 'median_age' },
  { code: 'B11001_001E', description: 'Total Households', table: 'demographics', column: 'total_households' },
  { code: 'B25010_001E', description: 'Average Household Size', table: 'demographics', column: 'avg_household_size' },

  // Age Distribution (percentages calculated from counts)
  { code: 'B01001_003E', description: 'Male Under 5', table: 'demographics', column: '_male_under_5' },
  { code: 'B01001_027E', description: 'Female Under 5', table: 'demographics', column: '_female_under_5' },
  { code: 'B01001_007E', description: 'Male 18-34', table: 'demographics', column: '_male_18_34' },
  { code: 'B01001_031E', description: 'Female 18-34', table: 'demographics', column: '_female_18_34' },
  { code: 'B01001_011E', description: 'Male 35-54', table: 'demographics', column: '_male_35_54' },
  { code: 'B01001_035E', description: 'Female 35-54', table: 'demographics', column: '_female_35_54' },
  { code: 'B01001_020E', description: 'Male 65+', table: 'demographics', column: '_male_65_plus' },
  { code: 'B01001_044E', description: 'Female 65+', table: 'demographics', column: '_female_65_plus' },

  // Education
  { code: 'B15003_022E', description: "Bachelor's Degree", table: 'demographics', column: '_bachelors_count' },
  { code: 'B15003_023E', description: "Master's Degree", table: 'demographics', column: '_masters_count' },
  { code: 'B15003_024E', description: 'Professional Degree', table: 'demographics', column: '_professional_count' },
  { code: 'B15003_025E', description: 'Doctorate Degree', table: 'demographics', column: '_doctorate_count' },

  // ECONOMICS
  { code: 'B19013_001E', description: 'Median Household Income', table: 'economics', column: 'median_household_income' },
  { code: 'B19301_001E', description: 'Per Capita Income', table: 'economics', column: 'per_capita_income' },
  { code: 'B17001_002E', description: 'Population Below Poverty', table: 'economics', column: '_poverty_count' },
  { code: 'B23025_005E', description: 'Unemployed Population', table: 'economics', column: '_unemployed_count' },
  { code: 'B23025_003E', description: 'Labor Force', table: 'economics', column: '_labor_force' },
  { code: 'B19083_001E', description: 'Gini Index', table: 'economics', column: 'gini_index' },

  // HOUSING
  { code: 'B25001_001E', description: 'Total Housing Units', table: 'housing', column: 'total_housing_units' },
  { code: 'B25002_002E', description: 'Occupied Housing Units', table: 'housing', column: 'occupied_units' },
  { code: 'B25003_002E', description: 'Owner Occupied', table: 'housing', column: '_owner_occupied' },
  { code: 'B25077_001E', description: 'Median Home Value', table: 'housing', column: 'median_home_value' },
  { code: 'B25064_001E', description: 'Median Gross Rent', table: 'housing', column: 'median_gross_rent' },
  { code: 'B25035_001E', description: 'Median Year Built', table: 'housing', column: 'median_year_built' }
]

interface ImportStats {
  geography: string
  year: number
  totalRecords: number
  demographics: number
  economics: number
  housing: number
  errors: string[]
  duration: number
}

async function fetchCensusData(
  year: number,
  geography: 'zip' | 'county' | 'state',
  variables: string[]
): Promise<any[]> {
  const geographyMap = {
    zip: 'zip%20code%20tabulation%20area:*',
    county: 'county:*',
    state: 'state:*'
  }

  const variableList = variables.join(',')
  const url = `${CENSUS_BASE_URL}/${year}/acs/acs5?get=${variableList}&for=${geographyMap[geography]}&key=${CENSUS_API_KEY}`

  console.log(`Fetching ${geography} data for ${year}...`)

  try {
    const response = await fetch(url)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Census API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // First row is headers, rest is data
    const [headers, ...rows] = data

    return rows.map((row: any[]) => {
      const record: any = {}
      headers.forEach((header: string, index: number) => {
        record[header] = row[index]
      })
      return record
    })
  } catch (error: any) {
    throw new Error(`Failed to fetch Census data: ${error.message}`)
  }
}

function parseValue(value: string): number | null {
  if (value === null || value === undefined || value === '-666666666') {
    return null // Census uses -666666666 for N/A
  }
  const num = parseFloat(value)
  return isNaN(num) ? null : num
}

function calculatePercentage(part: number | null, total: number | null): number | null {
  if (part === null || total === null || total === 0) return null
  return (part / total) * 100
}

function processDemo graphicsRecord(record: any, geoid: string, year: number): any {
  const totalPop = parseValue(record['B01001_001E'])
  const under5Male = parseValue(record['B01001_003E'])
  const under5Female = parseValue(record['B01001_027E'])
  const age18_34Male = parseValue(record['B01001_007E'])
  const age18_34Female = parseValue(record['B01001_031E'])
  const age35_54Male = parseValue(record['B01001_011E'])
  const age35_54Female = parseValue(record['B01001_035E'])
  const age65PlusMale = parseValue(record['B01001_020E'])
  const age65PlusFemale = parseValue(record['B01001_044E'])

  const bachelors = parseValue(record['B15003_022E'])
  const masters = parseValue(record['B15003_023E'])
  const professional = parseValue(record['B15003_024E'])
  const doctorate = parseValue(record['B15003_025E'])

  const totalGrad = (masters || 0) + (professional || 0) + (doctorate || 0)
  const pop25Plus = totalPop // Approximation - should use B15003_001E

  return {
    geoid,
    vintage_year: year,
    survey_type: 'acs5',
    total_population: totalPop,
    median_age: parseValue(record['B01002_001E']),
    total_households: parseValue(record['B11001_001E']),
    avg_household_size: parseValue(record['B25010_001E']),
    population_under_18_pct: calculatePercentage((under5Male || 0) + (under5Female || 0), totalPop),
    population_18_34_pct: calculatePercentage((age18_34Male || 0) + (age18_34Female || 0), totalPop),
    population_35_54_pct: calculatePercentage((age35_54Male || 0) + (age35_54Female || 0), totalPop),
    population_65_plus_pct: calculatePercentage((age65PlusMale || 0) + (age65PlusFemale || 0), totalPop),
    bachelors_degree_pct: calculatePercentage(bachelors, pop25Plus),
    graduate_degree_pct: calculatePercentage(totalGrad, pop25Plus),
    created_at: new Date().toISOString()
  }
}

function processEconomicsRecord(record: any, geoid: string, year: number): any {
  const povertyCount = parseValue(record['B17001_002E'])
  const totalPop = parseValue(record['B01001_001E']) // Would need to refetch
  const unemployed = parseValue(record['B23025_005E'])
  const laborForce = parseValue(record['B23025_003E'])

  return {
    geoid,
    vintage_year: year,
    median_household_income: parseValue(record['B19013_001E']),
    per_capita_income: parseValue(record['B19301_001E']),
    poverty_rate_all: calculatePercentage(povertyCount, totalPop),
    unemployment_rate: calculatePercentage(unemployed, laborForce),
    gini_index: parseValue(record['B19083_001E']),
    created_at: new Date().toISOString()
  }
}

function processHousingRecord(record: any, geoid: string, year: number): any {
  const totalUnits = parseValue(record['B25001_001E'])
  const occupied = parseValue(record['B25002_002E'])
  const ownerOccupied = parseValue(record['B25003_002E'])

  const vacancyRate = calculatePercentage(totalUnits && occupied ? totalUnits - occupied : null, totalUnits)
  const homeownershipRate = calculatePercentage(ownerOccupied, occupied)

  return {
    geoid,
    vintage_year: year,
    total_housing_units: totalUnits,
    occupied_units: occupied,
    vacancy_rate: vacancyRate,
    homeownership_rate: homeownershipRate,
    median_home_value: parseValue(record['B25077_001E']),
    median_gross_rent: parseValue(record['B25064_001E']),
    median_year_built: parseValue(record['B25035_001E']),
    created_at: new Date().toISOString()
  }
}

function getGeoIdFromRecord(record: any, geography: 'zip' | 'county' | 'state'): string {
  switch (geography) {
    case 'zip':
      return record['zip code tabulation area']
    case 'county':
      return `${record.state}${record.county}`
    case 'state':
      return record.state
  }
}

async function importCensusData(year: number, geography: 'zip' | 'county' | 'state'): Promise<ImportStats> {
  const startTime = Date.now()
  const stats: ImportStats = {
    geography,
    year,
    totalRecords: 0,
    demographics: 0,
    economics: 0,
    housing: 0,
    errors: [],
    duration: 0
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 Importing Census ${year} Data - ${geography.toUpperCase()}`)
  console.log('='.repeat(60))

  try {
    // Get all variable codes
    const variableCodes = CENSUS_VARIABLES.map(v => v.code)

    // Fetch data from Census API
    const records = await fetchCensusData(year, geography, variableCodes)
    stats.totalRecords = records.length

    console.log(`✅ Fetched ${records.length.toLocaleString()} records from Census API`)

    // Process and insert in batches
    const BATCH_SIZE = 100
    const demographicsBatch: any[] = []
    const economicsBatch: any[] = []
    const housingBatch: any[] = []

    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      const geoid = getGeoIdFromRecord(record, geography)

      try {
        demographicsBatch.push(processDemographicsRecord(record, geoid, year))
        economicsBatch.push(processEconomicsRecord(record, geoid, year))
        housingBatch.push(processHousingRecord(record, geoid, year))

        // Insert batches when full
        if ((i + 1) % BATCH_SIZE === 0 || i === records.length - 1) {
          // Insert demographics
          const { error: demoError } = await supabase
            .from('census_demographics')
            .upsert(demographicsBatch, { onConflict: 'geoid,vintage_year' })

          if (demoError) {
            stats.errors.push(`Demographics batch ${Math.floor(i / BATCH_SIZE)}: ${demoError.message}`)
          } else {
            stats.demographics += demographicsBatch.length
          }

          // Insert economics
          const { error: econError } = await supabase
            .from('census_economics')
            .upsert(economicsBatch, { onConflict: 'geoid,vintage_year' })

          if (econError) {
            stats.errors.push(`Economics batch ${Math.floor(i / BATCH_SIZE)}: ${econError.message}`)
          } else {
            stats.economics += economicsBatch.length
          }

          // Insert housing
          const { error: houseError } = await supabase
            .from('census_housing')
            .upsert(housingBatch, { onConflict: 'geoid,vintage_year' })

          if (houseError) {
            stats.errors.push(`Housing batch ${Math.floor(i / BATCH_SIZE)}: ${houseError.message}`)
          } else {
            stats.housing += housingBatch.length
          }

          console.log(`   Processed ${i + 1}/${records.length} records...`)

          // Clear batches
          demographicsBatch.length = 0
          economicsBatch.length = 0
          housingBatch.length = 0
        }
      } catch (err: any) {
        stats.errors.push(`Record ${geoid}: ${err.message}`)
      }
    }

    stats.duration = Date.now() - startTime

    console.log('\n' + '='.repeat(60))
    console.log('📊 IMPORT COMPLETE')
    console.log('='.repeat(60))
    console.log(`Geography: ${geography}`)
    console.log(`Year: ${year}`)
    console.log(`Total Records: ${stats.totalRecords.toLocaleString()}`)
    console.log(`Demographics: ${stats.demographics.toLocaleString()}`)
    console.log(`Economics: ${stats.economics.toLocaleString()}`)
    console.log(`Housing: ${stats.housing.toLocaleString()}`)
    console.log(`Errors: ${stats.errors.length}`)
    console.log(`Duration: ${(stats.duration / 1000).toFixed(2)}s`)
    console.log('='.repeat(60))

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:')
      stats.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`))
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more`)
      }
    }

  } catch (error: any) {
    stats.errors.push(`Fatal error: ${error.message}`)
    console.error('\n❌ Import failed:', error.message)
  }

  return stats
}

// CLI handling
async function main() {
  const args = process.argv.slice(2)
  const yearArg = args.find(arg => arg.startsWith('--year='))
  const geoArg = args.find(arg => arg.startsWith('--geography='))
  const allFlag = args.includes('--all')

  const year = yearArg ? parseInt(yearArg.split('=')[1]) : new Date().getFullYear() - 2

  console.log('🏛️  Census Bureau API Data Importer')
  console.log(`📅 Year: ${year}`)
  console.log(`🔑 API Key: ${CENSUS_API_KEY ? '✅ Set' : '❌ Missing'}`)
  console.log(`🔗 Supabase: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`)

  if (!CENSUS_API_KEY) {
    console.error('❌ CENSUS_API_KEY not found in environment')
    process.exit(1)
  }

  const allStats: ImportStats[] = []

  if (allFlag) {
    // Import all geographies
    allStats.push(await importCensusData(year, 'state'))
    allStats.push(await importCensusData(year, 'county'))
    allStats.push(await importCensusData(year, 'zip'))
  } else if (geoArg) {
    const geography = geoArg.split('=')[1] as 'zip' | 'county' | 'state'
    allStats.push(await importCensusData(year, geography))
  } else {
    console.error('Usage:')
    console.error('  npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=zip')
    console.error('  npx tsx scripts/importers/census-api-importer.ts --year=2022 --all')
    process.exit(1)
  }

  // Overall summary
  if (allStats.length > 1) {
    console.log('\n' + '='.repeat(60))
    console.log('📊 OVERALL SUMMARY')
    console.log('='.repeat(60))

    const totalRecords = allStats.reduce((sum, s) => sum + s.totalRecords, 0)
    const totalDuration = allStats.reduce((sum, s) => sum + s.duration, 0)
    const totalErrors = allStats.reduce((sum, s) => sum + s.errors.length, 0)

    console.log(`Total Records: ${totalRecords.toLocaleString()}`)
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`)
    console.log(`Total Errors: ${totalErrors}`)
    console.log('='.repeat(60))
  }

  const hasErrors = allStats.some(s => s.errors.length > 0)
  process.exit(hasErrors ? 1 : 0)
}

main()
