import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * Test API route to verify database connection
 * GET /api/test-db
 */
export async function GET() {
  try {
    // Verify environment variables are set
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { success: false, error: 'NEXT_PUBLIC_SUPABASE_URL is not set' },
        { status: 500 }
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { success: false, error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set' },
        { status: 500 }
      )
    }

    const supabase = createSupabaseAdminClient()

    // Test 1: Query tier_configs (should have 4 rows)
    const { data: tiers, error: tiersError } = await supabase
      .from('tier_configs')
      .select('tier_name, price')
      .limit(10)

    if (tiersError) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to query tier_configs: ${tiersError.message}`,
          details: tiersError
        },
        { status: 500 }
      )
    }

    // Test 2: Query markets (should be empty initially)
    const { data: geoData, error: geoError } = await supabase
      .from('markets')
      .select('region_id')
      .limit(1)

    if (geoError) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to query markets: ${geoError.message}`,
          details: geoError
        },
        { status: 500 }
      )
    }

    // Test 3: Verify current_scores table exists
    const { data: scores, error: scoresError } = await supabase
      .from('current_scores')
      .select('geo_code')  // Note: current_scores still uses geo_code column name
      .limit(1)

    if (scoresError) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to query current_scores: ${scoresError.message}`,
          details: scoresError
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Database connection successful!',
      details: {
        tierConfigsFound: tiers?.length || 0,
        geoDataCount: geoData?.length || 0,
        scoresCount: scores?.length || 0,
        environment: {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set ✓' : 'Missing ✗',
          anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set ✓' : 'Missing ✗',
          serviceKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY) ? 'Set ✓' : 'Missing ✗',
          serviceKeyName: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : (process.env.SUPABASE_SERVICE_KEY ? 'SUPABASE_SERVICE_KEY' : 'Neither set')
        }
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Connection failed: ${error.message}`,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

