/**
 * Validate Geographic Data Import
 *
 * Checks that all CSV data was imported correctly
 *
 * Usage: npx tsx scripts/validate-geo-import.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

interface ValidationResult {
  check: string
  expected: number | string
  actual: number | string
  passed: boolean
  details?: string
}

const results: ValidationResult[] = []

async function validateRowCounts() {
  console.log('📊 Validating Row Counts...\n')

  const checks = [
    { table: 'tiger_states', expected: 60, description: 'States' },
    { table: 'tiger_cbsa', expected: 936, description: 'Metro Areas' },
    { table: 'tiger_counties', expected: 3244, description: 'Counties' },
    { table: 'tiger_zcta', expected: 39494, description: 'ZIP Codes' },
    { table: 'geo_zip_county', expected: 54554, description: 'ZIP-County Relationships' },
    { table: 'geo_zip_cbsa', expected: 35988, description: 'ZIP-Metro Relationships' },
    { table: 'geo_county_state', expected: 3244, description: 'County-State Relationships' }
  ]

  for (const check of checks) {
    const { count, error } = await supabase
      .from(check.table)
      .select('*', { count: 'exact', head: true })

    const actual = count || 0
    const passed = actual === check.expected

    results.push({
      check: `${check.description} count`,
      expected: check.expected,
      actual,
      passed
    })

    const status = passed ? '✅' : '❌'
    console.log(`${status} ${check.description}: ${actual.toLocaleString()} / ${check.expected.toLocaleString()}`)

    if (error) {
      console.error(`   Error: ${error.message}`)
    }
  }
}

async function validatePopulationData() {
  console.log('\n👥 Validating Population Data...\n')

  // Check states have population
  const { count: statesWithPop } = await supabase
    .from('tiger_states')
    .select('*', { count: 'exact', head: true })
    .not('population', 'is', null)

  const statesPassed = statesWithPop! >= 50 // At least 50 states should have population
  results.push({
    check: 'States with population',
    expected: '≥50',
    actual: statesWithPop!,
    passed: statesPassed
  })

  console.log(`${statesPassed ? '✅' : '❌'} States with population: ${statesWithPop}/60`)

  // Check counties have population
  const { count: countiesWithPop } = await supabase
    .from('tiger_counties')
    .select('*', { count: 'exact', head: true })
    .not('population', 'is', null)

  const countiesPassed = countiesWithPop! >= 3200
  results.push({
    check: 'Counties with population',
    expected: '≥3200',
    actual: countiesWithPop!,
    passed: countiesPassed
  })

  console.log(`${countiesPassed ? '✅' : '❌'} Counties with population: ${countiesWithPop}/3244`)

  // Check ZIPs have population
  const { count: zipsWithPop } = await supabase
    .from('tiger_zcta')
    .select('*', { count: 'exact', head: true })
    .not('population', 'is', null)

  const zipsPassed = zipsWithPop! >= 30000
  results.push({
    check: 'ZIPs with population',
    expected: '≥30000',
    actual: zipsWithPop!,
    passed: zipsPassed
  })

  console.log(`${zipsPassed ? '✅' : '❌'} ZIPs with population: ${zipsWithPop}/39494`)
}

async function validateRelationships() {
  console.log('\n🔗 Validating Relationships...\n')

  // Check primary relationships are set correctly
  const { count: primaryZipCounty } = await supabase
    .from('geo_zip_county')
    .select('*', { count: 'exact', head: true })
    .eq('is_primary', true)

  const zipCountyPassed = primaryZipCounty! > 0
  results.push({
    check: 'Primary ZIP-County relationships',
    expected: '>0',
    actual: primaryZipCounty!,
    passed: zipCountyPassed
  })

  console.log(`${zipCountyPassed ? '✅' : '❌'} Primary ZIP-County: ${primaryZipCounty?.toLocaleString()}`)

  const { count: primaryZipCBSA } = await supabase
    .from('geo_zip_cbsa')
    .select('*', { count: 'exact', head: true })
    .eq('is_primary', true)

  const zipCBSAPassed = primaryZipCBSA! > 0
  results.push({
    check: 'Primary ZIP-Metro relationships',
    expected: '>0',
    actual: primaryZipCBSA!,
    passed: zipCBSAPassed
  })

  console.log(`${zipCBSAPassed ? '✅' : '❌'} Primary ZIP-Metro: ${primaryZipCBSA?.toLocaleString()}`)
}

async function validateSampleData() {
  console.log('\n🔍 Validating Sample Data...\n')

  // Test a known ZIP code (Beverly Hills 90210)
  const { data: zip, error: zipError } = await supabase
    .from('tiger_zcta')
    .select('*')
    .eq('geoid', '90210')
    .single()

  const zip90210Passed = zip !== null && !zipError
  results.push({
    check: 'Sample ZIP (90210) exists',
    expected: 'true',
    actual: zip90210Passed.toString(),
    passed: zip90210Passed
  })

  console.log(`${zip90210Passed ? '✅' : '❌'} ZIP 90210 exists: ${zip90210Passed}`)
  if (zip) {
    console.log(`   City: ${zip.default_city}, State: ${zip.default_state}, Pop: ${zip.population?.toLocaleString()}`)
  }

  // Test a known state (California)
  const { data: state, error: stateError } = await supabase
    .from('tiger_states')
    .select('*')
    .eq('state_abbreviation', 'CA')
    .single()

  const caPassed = state !== null && !stateError
  results.push({
    check: 'Sample State (CA) exists',
    expected: 'true',
    actual: caPassed.toString(),
    passed: caPassed
  })

  console.log(`${caPassed ? '✅' : '❌'} California exists: ${caPassed}`)
  if (state) {
    console.log(`   Name: ${state.name}, Pop: ${state.population?.toLocaleString()}`)
  }

  // Test hierarchical query (ZIP → County → State)
  const { data: hierarchy, error: hierError } = await supabase
    .from('tiger_zcta')
    .select(`
      geoid,
      default_city,
      geo_zip_county!inner (
        county_geoid,
        tiger_counties!inner (
          name,
          geo_county_state!inner (
            tiger_states!inner (
              name,
              state_abbreviation
            )
          )
        )
      )
    `)
    .eq('geoid', '60601') // Chicago Loop
    .limit(1)

  const hierarchyPassed = hierarchy && hierarchy.length > 0 && !hierError
  results.push({
    check: 'Hierarchical query works',
    expected: 'true',
    actual: hierarchyPassed.toString(),
    passed: hierarchyPassed
  })

  console.log(`${hierarchyPassed ? '✅' : '❌'} Hierarchical query (ZIP→County→State): ${hierarchyPassed}`)
}

async function main() {
  console.log('🔍 Geographic Data Import Validation\n')
  console.log('='.repeat(60) + '\n')

  try {
    await validateRowCounts()
    await validatePopulationData()
    await validateRelationships()
    await validateSampleData()

    console.log('\n' + '='.repeat(60))
    console.log('📋 VALIDATION SUMMARY')
    console.log('='.repeat(60))

    const totalChecks = results.length
    const passedChecks = results.filter(r => r.passed).length
    const failedChecks = totalChecks - passedChecks

    console.log(`\nTotal Checks: ${totalChecks}`)
    console.log(`Passed: ${passedChecks} ✅`)
    console.log(`Failed: ${failedChecks} ${failedChecks > 0 ? '❌' : ''}`)

    if (failedChecks > 0) {
      console.log('\n⚠️  Failed Checks:')
      results.filter(r => !r.passed).forEach(r => {
        console.log(`   ❌ ${r.check}: Expected ${r.expected}, got ${r.actual}`)
        if (r.details) console.log(`      ${r.details}`)
      })
    }

    console.log('='.repeat(60))

    if (failedChecks === 0) {
      console.log('\n✅ All validation checks passed!')
      console.log('🎉 Geographic data is ready for use.\n')
      process.exit(0)
    } else {
      console.log('\n❌ Some validation checks failed.')
      console.log('⚠️  Review the import process and re-run if needed.\n')
      process.exit(1)
    }

  } catch (err: any) {
    console.error('\n❌ Fatal error during validation:', err.message)
    process.exit(1)
  }
}

main()
