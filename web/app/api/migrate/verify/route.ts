import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * Verify migration system setup
 * GET /api/migrate/verify
 * 
 * Checks if the exec_sql helper function exists
 */
export async function GET() {
  try {
    const supabase = createSupabaseAdminClient()
    
    // Try to call the function with a simple, safe query
    // Using a SELECT that does nothing but validates the function exists
    const { error: testError } = await supabase.rpc('exec_sql', { 
      query: 'SELECT 1 WHERE 1=1' 
    })

    if (testError) {
      // Check if it's a "function not found" error
      const isFunctionNotFound = testError.message?.includes('Could not find the function') ||
                                 testError.message?.includes('does not exist') ||
                                 testError.code === 'PGRST202'
      
      if (isFunctionNotFound) {
        return NextResponse.json({
          success: false,
          setup: false,
          error: testError.message,
          message: 'The exec_sql function is not set up. Please run the SQL from scripts/create-sql-helper-function.sql in Supabase SQL Editor.',
          instructions: {
            step1: 'Open Supabase Dashboard → SQL Editor',
            step2: 'Copy and paste the SQL from scripts/create-sql-helper-function.sql',
            step3: 'Click "Run" to execute',
            step4: 'Call this endpoint again to verify'
          },
          sqlFile: 'scripts/create-sql-helper-function.sql'
        })
      } else {
        // Function exists but there was another error
        return NextResponse.json({
          success: false,
          setup: true,
          error: testError.message,
          message: 'The exec_sql function exists but encountered an error. This might be a permissions issue.'
        })
      }
    }

    // Function exists and works!
    return NextResponse.json({
      success: true,
      setup: true,
      message: 'Migration system is ready! You can now use /api/migrate to make schema changes.',
      function: {
        name: 'exec_sql',
        status: 'available',
        tested: true
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      setup: false,
      error: error.message,
      message: 'Could not verify migration system setup.'
    })
  }
}

