import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * Check schema of dim_geography_geometry table
 * GET /api/check-schema?table=dim_geography_geometry
 */
export async function GET(request: Request) {
  try {
    const supabase = createSupabaseAdminClient()
    const url = new URL(request.url)
    const tableName = url.searchParams.get('table') || 'dim_geography_geometry'
    
    // Query information_schema to get column names
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = '${tableName}'
        ORDER BY ordinal_position
      `
    })
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      })
    }
    
    return NextResponse.json({
      success: true,
      table: tableName,
      columns: data || []
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}

