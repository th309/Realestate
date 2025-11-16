import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Get table structure
 * GET /api/get-table-structure?table=dim_geography_geometry
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const searchParams = request.nextUrl.searchParams
    const tableName = searchParams.get('table') || 'dim_geography_geometry'
    
    // Try to get a sample row to see what columns exist
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1)
    
    if (error) {
      // If table doesn't exist or we can't query, try SQL
      const { data: sqlData, error: sqlError } = await supabase.rpc('exec_sql', {
        query: `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = '${tableName}' 
          AND table_schema = 'public'
          ORDER BY ordinal_position
        `
      })
      
      if (sqlError) {
        return NextResponse.json({
          success: false,
          error: sqlError.message
        })
      }
      
      return NextResponse.json({
        success: true,
        table: tableName,
        columns: sqlData || []
      })
    }
    
    // If we got data, extract column names from the first row
    const columns = data && data.length > 0 ? Object.keys(data[0]) : []
    
    return NextResponse.json({
      success: true,
      table: tableName,
      columns: columns.map(col => ({ column_name: col })),
      sampleRow: data && data.length > 0 ? data[0] : null
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}








