import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Sanity checks for facts and periods
 * GET /api/sanity-checks
 * 
 * Runs three checks:
 * 1. Period format check (should be YYYY-MM-01)
 * 2. Facts by variable (HPI_MOM, HPI_YOY)
 * 3. Spot-check joined geographies
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const results: any = {
      success: true,
      checks: {}
    }

    // Check 1: Period format check from stg_redfin_hpi
    try {
      const { data: periodData, error: periodError } = await supabase
        .from('stg_redfin_hpi')
        .select('period')
        .order('period', { ascending: false })
        .limit(10)

      if (periodError) {
        results.checks.periodFormat = {
          success: false,
          error: periodError.message,
          note: 'Could not query stg_redfin_hpi table'
        }
      } else {
        // Group by period and count
        const periodCounts = new Map<string, number>()
        periodData?.forEach(row => {
          const period = row.period
          periodCounts.set(period, (periodCounts.get(period) || 0) + 1)
        })

        const periodSummary = Array.from(periodCounts.entries())
          .map(([period, count]) => ({ period, count }))
          .sort((a, b) => b.period.localeCompare(a.period))

        // Validate format (should be YYYY-MM-01)
        const formatValid = periodSummary.every(p => {
          const match = p.period.match(/^\d{4}-\d{2}-01$/)
          return match !== null
        })

        results.checks.periodFormat = {
          success: formatValid,
          periods: periodSummary,
          formatValid,
          expectedFormat: 'YYYY-MM-01',
          invalidPeriods: periodSummary.filter(p => !p.period.match(/^\d{4}-\d{2}-01$/))
        }
      }
    } catch (error: any) {
      results.checks.periodFormat = {
        success: false,
        error: error.message
      }
    }

    // Check 2: Facts by variable (HPI_MOM, HPI_YOY)
    try {
      // First get variable IDs for HPI_MOM and HPI_YOY
      const { data: variables, error: varError } = await supabase
        .from('dim_variable')
        .select('variable_id, var_code')
        .in('var_code', ['HPI_MOM', 'HPI_YOY'])

      if (varError) {
        results.checks.factsByVariable = {
          success: false,
          error: varError.message,
          note: 'Could not query dim_variable table'
        }
      } else if (!variables || variables.length === 0) {
        results.checks.factsByVariable = {
          success: false,
          error: 'Variables HPI_MOM and/or HPI_YOY not found in dim_variable',
          variables: []
        }
      } else {
        const variableIds = variables.map(v => v.variable_id)
        const varCodeMap = new Map(variables.map(v => [v.variable_id, v.var_code]))

        // Count facts by variable
        const { data: facts, error: factsError } = await supabase
          .from('fact_observation')
          .select('variable_id')
          .in('variable_id', variableIds)

        if (factsError) {
          results.checks.factsByVariable = {
            success: false,
            error: factsError.message,
            note: 'Could not query fact_observation table'
          }
        } else {
          // Group by variable
          const factCounts = new Map<number, number>()
          facts?.forEach(fact => {
            const varId = fact.variable_id
            factCounts.set(varId, (factCounts.get(varId) || 0) + 1)
          })

          const factsByVar = variables.map(v => ({
            var_code: v.var_code,
            variable_id: v.variable_id,
            row_count: factCounts.get(v.variable_id) || 0
          }))

          results.checks.factsByVariable = {
            success: true,
            variables: factsByVar,
            totalRows: facts?.length || 0
          }
        }
      }
    } catch (error: any) {
      results.checks.factsByVariable = {
        success: false,
        error: error.message
      }
    }

    // Check 3: Spot-check joined geographies
    try {
      // Get variable IDs for HPI_MOM and HPI_YOY
      const { data: variables, error: varError } = await supabase
        .from('dim_variable')
        .select('variable_id, var_code')
        .in('var_code', ['HPI_MOM', 'HPI_YOY'])

      if (varError || !variables || variables.length === 0) {
        results.checks.joinedGeographies = {
          success: false,
          error: varError?.message || 'Variables not found',
          note: 'Could not get variables for join check'
        }
      } else {
        const variableIds = variables.map(v => v.variable_id)
        const varCodeMap = new Map(variables.map(v => [v.variable_id, v.var_code]))

        // Get facts first
        const { data: facts, error: factsError } = await supabase
          .from('fact_observation')
          .select('period_start, variable_id, value_num, geoid')
          .in('variable_id', variableIds)
          .order('period_start', { ascending: false })
          .limit(10)

        if (factsError) {
          results.checks.joinedGeographies = {
            success: false,
            error: factsError.message,
            note: 'Could not query fact_observation table'
          }
        } else if (!facts || facts.length === 0) {
          results.checks.joinedGeographies = {
            success: true,
            spotChecks: [],
            count: 0,
            note: 'No facts found for HPI_MOM or HPI_YOY'
          }
        } else {
          // Get unique geoids and variable_ids
          const geoids = [...new Set(facts.map(f => f.geoid))]
          const varIds = [...new Set(facts.map(f => f.variable_id))]

          // Get geography details
          const { data: geographies, error: geoError } = await supabase
            .from('dim_geography')
            .select('geoid, name')
            .in('geoid', geoids)

          const geoMap = new Map(
            (geographies || []).map(g => [g.geoid, g])
          )

          // Build spot checks
          const spotChecks = facts.map(fact => ({
            period_start: fact.period_start,
            var_code: varCodeMap.get(fact.variable_id) || 'unknown',
            value_num: fact.value_num,
            geography: {
              name: geoMap.get(fact.geoid)?.name || null,
              geoid: fact.geoid
            }
          }))

          results.checks.joinedGeographies = {
            success: true,
            spotChecks,
            count: spotChecks.length
          }
        }
      }
    } catch (error: any) {
      results.checks.joinedGeographies = {
        success: false,
        error: error.message
      }
    }

    // Overall success
    const allChecksPassed = Object.values(results.checks).every(
      (check: any) => check.success !== false
    )
    results.allChecksPassed = allChecksPassed

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Error running sanity checks:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run sanity checks'
      },
      { status: 500 }
    )
  }
}

