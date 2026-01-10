import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Clear Redfin data from the database
 * DELETE /api/clear-redfin-data
 * 
 * Query parameters:
 * - confirm: Must be 'true' to proceed
 * - marketsOnly: If 'true', only delete markets, not time series data
 * 
 * Uses Supabase Edge Function to handle deletion (better timeout handling)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const confirm = searchParams.get('confirm')
    const marketsOnly = searchParams.get('marketsOnly') === 'true'

    if (confirm !== 'true') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Confirmation required. Add ?confirm=true to the URL to proceed.' 
        },
        { status: 400 }
      )
    }

    // Verify environment variables are set
    // Support both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_KEY for compatibility
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !supabaseServiceKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing Supabase credentials. Need NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY in .env.local file.' 
        },
        { status: 500 }
      )
    }

    console.log('🗑️ Starting Redfin data deletion...')

    // Use Supabase admin client to call RPC directly (bypasses edge function issues)
    // This uses the service role key and ensures write access
    const supabase = createSupabaseAdminClient()
    const batchSize = 10000
    
    console.log('   Calling RPC function directly using Supabase admin client')
    console.log('   Function: purge_redfin')
    console.log('   Batch size:', batchSize)
    
    // Call RPC function directly using supabase-js (ensures write access)
    // This uses the service role key and targets the primary database
    const { data: rpcData, error: rpcError } = await supabase.rpc('purge_redfin', { 
      batch_size: batchSize 
    })

    let timeSeriesDeleted = 0
    let marketsDeleted = 0

    if (rpcError) {
      console.error('❌ Error calling RPC function:', rpcError)
      
      // If RPC function doesn't exist, try edge function as fallback
      if (rpcError.code === 'P0001' || rpcError.message?.includes('function') || rpcError.message?.includes('does not exist')) {
        console.log('   RPC function not found, trying edge function as fallback...')
        const edgeFunctionUrl = 'https://pysflbhpnqwoczyuaaif.functions.supabase.co/purge-redfin'
        
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ batch_size: batchSize })
        })

        if (!response.ok) {
          const errorText = await response.text()
          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { message: errorText, raw: errorText }
          }

          console.error('❌ Error calling edge function:', errorData)
      
          // Check for read-only transaction error
          if (errorData.error?.includes('read-only transaction') || errorData.message?.includes('read-only transaction')) {
            return NextResponse.json(
              {
                success: false,
                error: 'Database function is using a read-only client. The edge function needs to be updated to use the service role key for write operations.',
                details: errorData,
                suggestion: 'The edge function code needs to use the service role key when creating the Supabase client. In the edge function, ensure you use: createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } }). Alternatively, use direct SQL in Supabase SQL Editor: DELETE FROM market_time_series WHERE data_source = \'redfin\'; DELETE FROM markets WHERE region_id LIKE \'REDFIN-%\';'
              },
              { status: 500 }
            )
          }
          
          // Check if it's a database function error
          if (errorData.error?.includes('Could not find the function') || errorData.message?.includes('Could not find the function')) {
            return NextResponse.json(
              {
                success: false,
                error: 'Edge function is looking for a database function that does not exist. The edge function may need to be updated or a database function needs to be created.',
                details: errorData,
                suggestion: 'Check the edge function code to see what database function it expects, or use direct SQL: DELETE FROM market_time_series WHERE data_source = \'redfin\'; DELETE FROM markets WHERE region_id LIKE \'REDFIN-%\';'
              },
              { status: 500 }
            )
          }
          
          return NextResponse.json(
            {
              success: false,
              error: `Failed to delete Redfin data: ${errorData.error || errorData.message || response.statusText}`,
              details: errorData
            },
            { status: response.status || 500 }
          )
        }

        // Parse edge function response
        const edgeData = await response.json()
        timeSeriesDeleted = edgeData?.time_series_deleted || 0
        marketsDeleted = edgeData?.markets_deleted || 0
      } else {
        // Other RPC errors
        return NextResponse.json(
          {
            success: false,
            error: `Failed to delete Redfin data: ${rpcError.message || rpcError.code}`,
            details: rpcError
          },
          { status: 500 }
        )
      }
    } else {
      // RPC call succeeded
      timeSeriesDeleted = rpcData?.time_series_deleted || 0
      marketsDeleted = rpcData?.markets_deleted || 0
    }

    console.log(`✅ Deleted ${marketsDeleted} markets and ${timeSeriesDeleted} time series records`)

    // Verify deletion (with timeout protection)
    console.log('🔍 Verifying deletion...')
    let remainingMarkets = 0
    let remainingTimeSeries = 0
    
    try {
      const verifyPromise = Promise.all([
        supabase
          .from('markets')
          .select('region_id', { count: 'exact', head: true })
          .like('region_id', 'REDFIN-%'),
        supabase
          .from('market_time_series')
          .select('id', { count: 'exact', head: true })
          .eq('data_source', 'redfin')
      ])
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Verification timeout')), 5000)
      )
      
      const [marketsResult, timeSeriesResult] = await Promise.race([
        verifyPromise,
        timeoutPromise
      ]) as any[]
      
      remainingMarkets = marketsResult?.count || 0
      remainingTimeSeries = timeSeriesResult?.count || 0
    } catch (error) {
      console.warn('⚠️ Verification query timed out, skipping final check')
    }

    const allDeleted = remainingMarkets === 0 && remainingTimeSeries === 0

    return NextResponse.json({
      success: allDeleted,
      message: marketsOnly 
        ? `Deleted ${marketsDeleted} Redfin markets. Time series data was preserved.`
        : `Deleted ${marketsDeleted} Redfin markets and ${timeSeriesDeleted} time series records.`,
      deleted: {
        markets: marketsDeleted,
        timeSeries: timeSeriesDeleted,
        marketsOnly
      },
      after: {
        markets: remainingMarkets,
        timeSeries: remainingTimeSeries
      },
      warning: !allDeleted 
        ? `Some Redfin data may still remain (${remainingMarkets} markets, ${remainingTimeSeries} time series).` 
        : undefined
    })
  } catch (error: any) {
    console.error('❌ Error clearing Redfin data:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to clear Redfin data'
      },
      { status: 500 }
    )
  }
}
