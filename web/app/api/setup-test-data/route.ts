import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * API route to insert test data into database
 * POST /api/setup-test-data
 * 
 * This inserts 10 test markets for development
 */
export async function POST() {
  try {
    const supabase = createSupabaseAdminClient()

    // Insert test markets into geo_data
    const { error: geoError } = await supabase
      .from('geo_data')
      .upsert([
        // States
        {
          geo_code: 'US-CA',
          geo_name: 'California',
          state_code: 'CA',
          geo_type: 'state',
          bounds: { north: 42.0095, south: 32.5288, east: -114.1315, west: -124.4096 }
        },
        {
          geo_code: 'US-TX',
          geo_name: 'Texas',
          state_code: 'TX',
          geo_type: 'state',
          bounds: { north: 36.5007, south: 25.8371, east: -93.5083, west: -106.6456 }
        },
        // Metros
        {
          geo_code: 'US-MSA-31080',
          geo_name: 'Los Angeles-Long Beach-Anaheim, CA',
          state_code: 'CA',
          geo_type: 'metro',
          bounds: { north: 34.8233, south: 33.3487, east: -117.6464, west: -118.6682 }
        },
        {
          geo_code: 'US-MSA-26420',
          geo_name: 'Houston-The Woodlands-Sugar Land, TX',
          state_code: 'TX',
          geo_type: 'metro',
          bounds: { north: 30.3072, south: 29.4241, east: -94.9777, west: -95.8099 }
        },
        {
          geo_code: 'US-MSA-12420',
          geo_name: 'Austin-Round Rock, TX',
          state_code: 'TX',
          geo_type: 'metro',
          bounds: { north: 30.5169, south: 30.0987, east: -97.5625, west: -98.1039 }
        },
        {
          geo_code: 'US-MSA-19100',
          geo_name: 'Dallas-Fort Worth-Arlington, TX',
          state_code: 'TX',
          geo_type: 'metro',
          bounds: { north: 33.3475, south: 32.6171, east: -96.4636, west: -97.5144 }
        },
        {
          geo_code: 'US-MSA-14460',
          geo_name: 'Boston-Cambridge-Newton, MA-NH',
          state_code: 'MA',
          geo_type: 'metro',
          bounds: { north: 42.8864, south: 42.0629, east: -70.6109, west: -71.1912 }
        },
        // Cities
        {
          geo_code: 'US-CITY-06037',
          geo_name: 'Los Angeles, CA',
          state_code: 'CA',
          geo_type: 'city',
          bounds: { north: 34.3373, south: 33.7037, east: -118.1553, west: -118.6682 }
        },
        {
          geo_code: 'US-CITY-48201',
          geo_name: 'Houston, TX',
          state_code: 'TX',
          geo_type: 'city',
          bounds: { north: 30.1104, south: 29.5213, east: -95.0908, west: -95.8099 }
        },
        // Zip Code
        {
          geo_code: 'US-ZIP-78701',
          geo_name: 'Austin, TX 78701',
          state_code: 'TX',
          geo_type: 'zipcode',
          bounds: { north: 30.2747, south: 30.2682, east: -97.7392, west: -97.7476 }
        }
      ], {
        onConflict: 'geo_code'
      })

    if (geoError) {
      return NextResponse.json(
        { success: false, error: `Failed to insert geo_data: ${geoError.message}` },
        { status: 500 }
      )
    }

    // Insert time series data for Austin metro (last 6 months)
    const timeSeriesData = [
      { geo_code: 'US-MSA-12420', date: '2024-06-01', home_value: 450000, home_value_growth_rate: 5.2, days_on_market: 28, total_active_inventory: 3500, rent_for_apartments: 1800, rent_for_houses: 2200, population: 2300000, median_household_income: 85000, mortgage_rate_30yr: 6.75, data_source: 'test' },
      { geo_code: 'US-MSA-12420', date: '2024-07-01', home_value: 455000, home_value_growth_rate: 5.5, days_on_market: 26, total_active_inventory: 3400, rent_for_apartments: 1820, rent_for_houses: 2220, population: 2310000, median_household_income: 85200, mortgage_rate_30yr: 6.80, data_source: 'test' },
      { geo_code: 'US-MSA-12420', date: '2024-08-01', home_value: 460000, home_value_growth_rate: 5.8, days_on_market: 25, total_active_inventory: 3300, rent_for_apartments: 1840, rent_for_houses: 2240, population: 2320000, median_household_income: 85400, mortgage_rate_30yr: 6.85, data_source: 'test' },
      { geo_code: 'US-MSA-12420', date: '2024-09-01', home_value: 465000, home_value_growth_rate: 6.0, days_on_market: 24, total_active_inventory: 3200, rent_for_apartments: 1860, rent_for_houses: 2260, population: 2330000, median_household_income: 85600, mortgage_rate_30yr: 6.90, data_source: 'test' },
      { geo_code: 'US-MSA-12420', date: '2024-10-01', home_value: 470000, home_value_growth_rate: 6.2, days_on_market: 23, total_active_inventory: 3100, rent_for_apartments: 1880, rent_for_houses: 2280, population: 2340000, median_household_income: 85800, mortgage_rate_30yr: 6.95, data_source: 'test' },
      { geo_code: 'US-MSA-12420', date: '2024-11-01', home_value: 475000, home_value_growth_rate: 6.5, days_on_market: 22, total_active_inventory: 3000, rent_for_apartments: 1900, rent_for_houses: 2300, population: 2350000, median_household_income: 86000, mortgage_rate_30yr: 7.00, data_source: 'test' }
    ]

    const { error: timeSeriesError } = await supabase
      .from('time_series_data')
      .upsert(timeSeriesData, {
        onConflict: 'geo_code,date'
      })

    if (timeSeriesError) {
      return NextResponse.json(
        { success: false, error: `Failed to insert time_series_data: ${timeSeriesError.message}` },
        { status: 500 }
      )
    }

    // Insert scores for Austin metro
    const { error: scoresError } = await supabase
      .from('current_scores')
      .upsert({
        geo_code: 'US-MSA-12420',
        calculated_date: new Date().toISOString().split('T')[0],
        home_price_momentum_score: 75.5,
        recent_appreciation_score: 80.0,
        days_on_market_score: 72.0,
        mortgage_rates_score: 45.0,
        inventory_levels_score: 78.0,
        price_cuts_score: 70.0,
        long_term_appreciation_percentile: 85.0,
        poverty_rate_percentile: 60.0,
        median_household_income_percentile: 75.0,
        demographic_growth_percentile: 90.0,
        overvaluation_percentile: 50.0,
        value_income_ratio_percentile: 65.0,
        wealth_income_percentile: 70.0,
        cap_rate_percentile: 68.0,
        rent_percentile: 72.0,
        home_buyer_score: 68.5,
        investor_score: 72.0
      }, {
        onConflict: 'geo_code'
      })

    if (scoresError) {
      return NextResponse.json(
        { success: false, error: `Failed to insert current_scores: ${scoresError.message}` },
        { status: 500 }
      )
    }

    // Verify inserts
    const { data: geoData } = await supabase
      .from('geo_data')
      .select('geo_code, geo_name, geo_type')
      .order('geo_type')

    const { data: timeSeries } = await supabase
      .from('time_series_data')
      .select('geo_code, date')
      .order('date')

    const { data: scores } = await supabase
      .from('current_scores')
      .select('geo_code, home_buyer_score, investor_score')

    return NextResponse.json({
      success: true,
      message: 'Test data inserted successfully!',
      summary: {
        geoDataCount: geoData?.length || 0,
        timeSeriesCount: timeSeries?.length || 0,
        scoresCount: scores?.length || 0
      },
      data: {
        geoData: geoData,
        timeSeries: timeSeries,
        scores: scores
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to setup test data: ${error.message}`,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

