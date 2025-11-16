import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Verify CBSA geography presence
 * GET /api/verify-cbsa-geography
 * 
 * Checks for:
 * 1. CBSA entries in dim_geography (level = 'cbsa')
 * 2. CBSA geometries in dim_geography_geometry
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const results: any = {
      success: true,
      checks: {}
    }

    // Check 1: Count CBSA entries in dim_geography
    try {
      const { count: cbsaCount, error: cbsaError } = await supabase
        .from('dim_geography')
        .select('*', { count: 'exact', head: true })
        .eq('level', 'cbsa')

      if (cbsaError) {
        results.checks.cbsaEntries = {
          success: false,
          error: cbsaError.message,
          count: 0
        }
      } else {
        results.checks.cbsaEntries = {
          success: true,
          count: cbsaCount || 0,
          status: (cbsaCount || 0) > 0 ? 'present' : 'missing'
        }
      }
    } catch (error: any) {
      results.checks.cbsaEntries = {
        success: false,
        error: error.message,
        count: 0
      }
    }

    // Check 2: Count CBSA geometries
    try {
      // First get CBSA geoids
      const { data: cbsaGeoids, error: geoidError } = await supabase
        .from('dim_geography')
        .select('geoid')
        .eq('level', 'cbsa')
        .limit(10000) // Reasonable limit

      if (geoidError) {
        results.checks.cbsaGeometries = {
          success: false,
          error: geoidError.message,
          count: 0
        }
      } else if (!cbsaGeoids || cbsaGeoids.length === 0) {
        results.checks.cbsaGeometries = {
          success: true,
          count: 0,
          status: 'no_cbsa_entries',
          note: 'No CBSA entries found, so no geometries to check'
        }
      } else {
        const geoids = cbsaGeoids.map(g => g.geoid)
        
        // Count geometries for these CBSAs
        const { count: geomCount, error: geomError } = await supabase
          .from('dim_geography_geometry')
          .select('*', { count: 'exact', head: true })
          .in('geoid', geoids)

        if (geomError) {
          results.checks.cbsaGeometries = {
            success: false,
            error: geomError.message,
            count: 0
          }
        } else {
          const count = geomCount || 0
          const expectedCount = cbsaGeoids.length
          results.checks.cbsaGeometries = {
            success: true,
            count,
            expectedCount,
            coverage: expectedCount > 0 ? Math.round((count / expectedCount) * 100) : 0,
            status: count === expectedCount ? 'complete' : count > 0 ? 'partial' : 'missing'
          }
        }
      }
    } catch (error: any) {
      results.checks.cbsaGeometries = {
        success: false,
        error: error.message,
        count: 0
      }
    }

    // Check 3: Sample CBSA entries to verify structure
    try {
      const { data: sampleCbsas, error: sampleError } = await supabase
        .from('dim_geography')
        .select('geoid, name, level')
        .eq('level', 'cbsa')
        .limit(5)

      if (sampleError) {
        results.checks.sampleCbsas = {
          success: false,
          error: sampleError.message
        }
      } else {
        results.checks.sampleCbsas = {
          success: true,
          samples: sampleCbsas || [],
          count: sampleCbsas?.length || 0
        }
      }
    } catch (error: any) {
      results.checks.sampleCbsas = {
        success: false,
        error: error.message
      }
    }

    // Overall assessment
    const cbsaCount = results.checks.cbsaEntries?.count || 0
    const geomCount = results.checks.cbsaGeometries?.count || 0
    const hasCbsas = cbsaCount > 0
    const hasGeometries = geomCount > 0

    results.summary = {
      hasCbsaEntries: hasCbsas,
      hasCbsaGeometries: hasGeometries,
      readyForMapbox: hasCbsas && hasGeometries,
      recommendation: !hasCbsas
        ? 'Load CBSA data from TIGER 2024'
        : !hasGeometries
        ? 'Load CBSA geometries from TIGER 2024'
        : 'CBSA data is ready for Mapbox choropleths'
    }

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Error verifying CBSA geography:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to verify CBSA geography'
      },
      { status: 500 }
    )
  }
}

