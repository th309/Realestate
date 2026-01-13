import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function runMigration() {
  console.log('Starting migration 030: Create new schema...\n');

  // Read the SQL file
  const sqlPath = join(__dirname, 'migrations/030-create-new-schema.sql');
  const fullSql = readFileSync(sqlPath, 'utf-8');

  // Split into individual statements (crude but effective for CREATE TABLE)
  // We'll execute key statements one at a time

  const tables = [
    // Section 1: Raw Data Tables
    {
      name: 'zillow_metro',
      sql: `CREATE TABLE IF NOT EXISTS zillow_metro (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        region_id INTEGER NOT NULL,
        region_name TEXT NOT NULL,
        state_code TEXT,
        cbsa_code TEXT,
        period_date DATE NOT NULL,
        metric_name TEXT NOT NULL,
        value NUMERIC,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(region_id, period_date, metric_name)
      )`
    },
    {
      name: 'zillow_county',
      sql: `CREATE TABLE IF NOT EXISTS zillow_county (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        region_id INTEGER NOT NULL,
        region_name TEXT NOT NULL,
        state_code TEXT,
        fips_code TEXT,
        period_date DATE NOT NULL,
        metric_name TEXT NOT NULL,
        value NUMERIC,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(region_id, period_date, metric_name)
      )`
    },
    {
      name: 'zillow_zip',
      sql: `CREATE TABLE IF NOT EXISTS zillow_zip (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        region_id INTEGER NOT NULL,
        region_name TEXT NOT NULL,
        state_code TEXT,
        zip_code TEXT,
        metro_region_id INTEGER,
        county_fips TEXT,
        period_date DATE NOT NULL,
        metric_name TEXT NOT NULL,
        value NUMERIC,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(region_id, period_date, metric_name)
      )`
    },
    {
      name: 'zillow_state',
      sql: `CREATE TABLE IF NOT EXISTS zillow_state (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        region_id INTEGER NOT NULL,
        region_name TEXT NOT NULL,
        state_code TEXT NOT NULL,
        period_date DATE NOT NULL,
        metric_name TEXT NOT NULL,
        value NUMERIC,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(region_id, period_date, metric_name)
      )`
    },
    {
      name: 'census_data',
      sql: `CREATE TABLE IF NOT EXISTS census_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        geography_id TEXT NOT NULL,
        geography_type TEXT NOT NULL,
        geography_name TEXT,
        year INTEGER NOT NULL,
        category TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        value NUMERIC,
        source_table TEXT,
        margin_of_error NUMERIC,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(geography_id, geography_type, year, metric_name)
      )`
    },
    {
      name: 'fred_data',
      sql: `CREATE TABLE IF NOT EXISTS fred_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        geography_id TEXT NOT NULL,
        geography_type TEXT NOT NULL,
        period_date DATE NOT NULL,
        series_id TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        category TEXT NOT NULL,
        value NUMERIC,
        units TEXT,
        frequency TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(geography_id, series_id, period_date)
      )`
    },
    // Section 2: Reference Tables
    {
      name: 'geographies',
      sql: `CREATE TABLE IF NOT EXISTS geographies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        geography_id TEXT NOT NULL,
        geography_type TEXT NOT NULL,
        name TEXT NOT NULL,
        name_short TEXT,
        state_code TEXT,
        state_name TEXT,
        state_fips TEXT,
        parent_metro_id TEXT,
        parent_county_id TEXT,
        cbsa_code TEXT,
        cbsa_name TEXT,
        cbsa_type TEXT,
        fips_code TEXT,
        county_name TEXT,
        zillow_region_id INTEGER,
        zillow_state_region_id INTEGER,
        zillow_county_region_id INTEGER,
        zillow_metro_region_id INTEGER,
        zillow_metro_name TEXT,
        latitude NUMERIC(9,6),
        longitude NUMERIC(9,6),
        is_coastal BOOLEAN DEFAULT FALSE,
        is_fire_zone BOOLEAN DEFAULT FALSE,
        is_flood_zone BOOLEAN DEFAULT FALSE,
        population INTEGER,
        land_area_sqmi NUMERIC(12,2),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(geography_id, geography_type)
      )`
    },
    {
      name: 'metric_definitions',
      sql: `CREATE TABLE IF NOT EXISTS metric_definitions (
        metric_name TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        short_name TEXT,
        description TEXT,
        category TEXT,
        subcategory TEXT,
        format TEXT,
        precision INTEGER DEFAULT 0,
        prefix TEXT,
        suffix TEXT,
        direction TEXT,
        chart_type TEXT DEFAULT 'line',
        color_scale TEXT DEFAULT 'neutral',
        source TEXT,
        source_table TEXT,
        update_frequency TEXT,
        available_geo_types TEXT[],
        homeready_component TEXT,
        homeready_weight NUMERIC(5,4),
        investoredge_component TEXT,
        investoredge_weight NUMERIC(5,4),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'metric_percentiles',
      sql: `CREATE TABLE IF NOT EXISTS metric_percentiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_name TEXT NOT NULL,
        geography_type TEXT NOT NULL,
        period_date DATE NOT NULL,
        p10 NUMERIC,
        p20 NUMERIC,
        p30 NUMERIC,
        p40 NUMERIC,
        p50 NUMERIC,
        p60 NUMERIC,
        p70 NUMERIC,
        p80 NUMERIC,
        p90 NUMERIC,
        min_value NUMERIC,
        max_value NUMERIC,
        count_values INTEGER,
        mean_value NUMERIC,
        stddev_value NUMERIC,
        calculated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(metric_name, geography_type, period_date)
      )`
    },
    // Section 3: Calculated Metrics
    {
      name: 'calculated_metrics',
      sql: `CREATE TABLE IF NOT EXISTS calculated_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        geography_id TEXT NOT NULL,
        geography_type TEXT NOT NULL,
        geography_name TEXT,
        period_date DATE NOT NULL,
        grm NUMERIC(8,2),
        rent_price_ratio NUMERIC(6,4),
        cap_rate_proxy NUMERIC(5,3),
        price_rent_ratio NUMERIC(8,2),
        zhvi_yoy_change NUMERIC(6,3),
        zori_yoy_change NUMERIC(6,3),
        inventory_yoy_change NUMERIC(6,3),
        zhvi_3y_change NUMERIC(6,3),
        zhvi_5y_change NUMERIC(6,3),
        zhvi_90d_change NUMERIC(6,3),
        zori_90d_change NUMERIC(6,3),
        inventory_90d_change NUMERIC(6,3),
        dom_90d_change NUMERIC(6,3),
        zhvi_stddev_12m NUMERIC(12,2),
        zhvi_stddev_36m NUMERIC(12,2),
        zori_stddev_12m NUMERIC(12,2),
        inventory_stddev_12m NUMERIC(12,2),
        dom_stddev_12m NUMERIC(8,2),
        income_gap_ratio NUMERIC(6,3),
        price_trend_deviation NUMERIC(6,3),
        inventory_vs_history_pct NUMERIC(5,2),
        affordability_percentile NUMERIC(5,2),
        months_of_supply NUMERIC(5,2),
        calculated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(geography_id, geography_type, period_date)
      )`
    },
    // Section 4: PropertyIQ Scores
    {
      name: 'propertyiq_scores',
      sql: `CREATE TABLE IF NOT EXISTS propertyiq_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        geography_id TEXT NOT NULL,
        geography_type TEXT NOT NULL,
        geography_name TEXT NOT NULL,
        state_code TEXT,
        parent_geography_id TEXT,
        period_date DATE NOT NULL,
        homeready_score NUMERIC(5,2),
        homeready_affordability NUMERIC(5,2),
        homeready_stability NUMERIC(5,2),
        homeready_value NUMERIC(5,2),
        homeready_livability NUMERIC(5,2),
        homeready_momentum NUMERIC(5,2),
        homeready_trend TEXT,
        homeready_trend_change NUMERIC(5,2),
        investoredge_score NUMERIC(5,2),
        investoredge_cashflow NUMERIC(5,2),
        investoredge_growth NUMERIC(5,2),
        investoredge_demand NUMERIC(5,2),
        investoredge_entrypoint NUMERIC(5,2),
        investoredge_risk NUMERIC(5,2),
        investoredge_trend TEXT,
        investoredge_trend_change NUMERIC(5,2),
        confidence_level TEXT NOT NULL DEFAULT 'medium',
        metrics_available INTEGER,
        metrics_total INTEGER,
        data_freshness_days INTEGER,
        calculated_at TIMESTAMPTZ DEFAULT NOW(),
        calculation_version TEXT,
        UNIQUE(geography_id, geography_type, period_date)
      )`
    },
    {
      name: 'propertyiq_score_details',
      sql: `CREATE TABLE IF NOT EXISTS propertyiq_score_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        score_id UUID REFERENCES propertyiq_scores(id) ON DELETE CASCADE,
        score_type TEXT NOT NULL,
        component TEXT NOT NULL,
        component_score NUMERIC(5,2),
        component_weight NUMERIC(5,4),
        weighted_contribution NUMERIC(5,2),
        metrics JSONB NOT NULL,
        helping_factors TEXT[],
        hurting_factors TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'propertyiq_score_history',
      sql: `CREATE TABLE IF NOT EXISTS propertyiq_score_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        geography_id TEXT NOT NULL,
        geography_type TEXT NOT NULL,
        period_date DATE NOT NULL,
        homeready_score NUMERIC(5,2),
        investoredge_score NUMERIC(5,2),
        homeready_components JSONB,
        investoredge_components JSONB,
        actual_appreciation_12m NUMERIC(6,3),
        actual_appreciation_24m NUMERIC(6,3),
        actual_rent_growth_12m NUMERIC(6,3),
        actual_rent_growth_24m NUMERIC(6,3),
        actual_dom_avg_12m NUMERIC(6,2),
        actual_inventory_change_12m NUMERIC(6,3),
        prediction_error_12m NUMERIC(6,3),
        prediction_error_24m NUMERIC(6,3),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        outcomes_updated_at TIMESTAMPTZ,
        UNIQUE(geography_id, geography_type, period_date)
      )`
    },
    // Section 5: Reports
    {
      name: 'reports',
      sql: `CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        organization_id UUID,
        report_type TEXT NOT NULL,
        title TEXT NOT NULL,
        primary_geography_id TEXT NOT NULL,
        primary_geography_type TEXT NOT NULL,
        primary_geography_name TEXT NOT NULL,
        comparison_geographies JSONB,
        user_inputs JSONB,
        static_content JSONB,
        ai_narrative JSONB,
        ai_model_used TEXT,
        ai_model_version TEXT,
        scores_snapshot JSONB,
        news_snapshot JSONB,
        status TEXT DEFAULT 'generating',
        error_message TEXT,
        generation_started_at TIMESTAMPTZ,
        generation_completed_at TIMESTAMPTZ,
        data_as_of_date DATE,
        branding JSONB,
        view_count INTEGER DEFAULT 0,
        last_viewed_at TIMESTAMPTZ,
        pdf_generated_at TIMESTAMPTZ,
        pdf_url TEXT,
        is_public BOOLEAN DEFAULT FALSE,
        public_slug TEXT UNIQUE,
        share_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      )`
    },
    {
      name: 'report_conversations',
      sql: `CREATE TABLE IF NOT EXISTS report_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        messages JSONB NOT NULL DEFAULT '[]',
        message_count INTEGER DEFAULT 0,
        learned_profile JSONB,
        exchanges_used INTEGER DEFAULT 0,
        exchanges_limit INTEGER,
        status TEXT DEFAULT 'active',
        context_summary TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_message_at TIMESTAMPTZ
      )`
    },
    {
      name: 'user_report_memory',
      sql: `CREATE TABLE IF NOT EXISTS user_report_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE,
        researched_geographies JSONB DEFAULT '[]',
        investment_criteria JSONB,
        personal_context JSONB,
        ruled_out_markets JSONB,
        favorite_markets JSONB,
        key_insights JSONB DEFAULT '[]',
        preferred_report_types TEXT[],
        communication_style TEXT,
        remember_preferences BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    // Section 6: Application Tables
    {
      name: 'news_cache',
      sql: `CREATE TABLE IF NOT EXISTS news_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        geography_id TEXT NOT NULL,
        geography_type TEXT NOT NULL,
        news_category TEXT NOT NULL,
        news_items JSONB NOT NULL,
        item_count INTEGER DEFAULT 0,
        search_query TEXT,
        source_api TEXT,
        fetched_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        UNIQUE(geography_id, geography_type, news_category)
      )`
    },
    {
      name: 'user_profiles',
      sql: `CREATE TABLE IF NOT EXISTS user_profiles (
        id UUID PRIMARY KEY,
        email TEXT,
        full_name TEXT,
        avatar_url TEXT,
        subscription_tier TEXT DEFAULT 'free',
        subscription_status TEXT DEFAULT 'active',
        subscription_started_at TIMESTAMPTZ,
        subscription_ends_at TIMESTAMPTZ,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        reports_generated_this_month INTEGER DEFAULT 0,
        reports_limit INTEGER DEFAULT 2,
        billing_period_start DATE,
        billing_period_end DATE,
        organization_id UUID,
        organization_role TEXT,
        default_geography_id TEXT,
        default_geography_type TEXT,
        preferred_report_type TEXT,
        email_notifications BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      )`
    },
    {
      name: 'organizations',
      sql: `CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        logo_url TEXT,
        primary_color TEXT,
        secondary_color TEXT,
        accent_color TEXT,
        website_url TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        custom_domain TEXT,
        show_powered_by BOOLEAN DEFAULT TRUE,
        custom_disclaimer TEXT,
        custom_footer TEXT,
        subscription_tier TEXT DEFAULT 'enterprise',
        subscription_status TEXT DEFAULT 'active',
        max_users INTEGER DEFAULT 10,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'user_alerts',
      sql: `CREATE TABLE IF NOT EXISTS user_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        geography_id TEXT NOT NULL,
        geography_type TEXT NOT NULL,
        geography_name TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        condition_type TEXT NOT NULL,
        threshold_value NUMERIC,
        threshold_percent NUMERIC,
        is_active BOOLEAN DEFAULT TRUE,
        is_triggered BOOLEAN DEFAULT FALSE,
        last_checked_at TIMESTAMPTZ,
        last_triggered_at TIMESTAMPTZ,
        trigger_count INTEGER DEFAULT 0,
        notify_email BOOLEAN DEFAULT TRUE,
        notify_push BOOLEAN DEFAULT FALSE,
        source_report_id UUID,
        source_conversation_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      )`
    },
    // Section 7: Infrastructure Tables
    {
      name: 'data_ingestion_log',
      sql: `CREATE TABLE IF NOT EXISTS data_ingestion_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id TEXT,
        source TEXT NOT NULL,
        table_name TEXT NOT NULL,
        metric_name TEXT,
        geography_type TEXT,
        records_processed INTEGER DEFAULT 0,
        records_inserted INTEGER DEFAULT 0,
        records_updated INTEGER DEFAULT 0,
        records_failed INTEGER DEFAULT 0,
        status TEXT DEFAULT 'running',
        error_message TEXT,
        error_details JSONB,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        duration_seconds INTEGER,
        source_url TEXT,
        source_file_date DATE,
        data_period_start DATE,
        data_period_end DATE
      )`
    },
    {
      name: 'data_source_registry',
      sql: `CREATE TABLE IF NOT EXISTS data_source_registry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_name TEXT NOT NULL,
        table_name TEXT NOT NULL,
        metric_name TEXT,
        source_url TEXT,
        source_type TEXT,
        update_frequency TEXT,
        expected_update_day INTEGER,
        is_active BOOLEAN DEFAULT TRUE,
        last_successful_ingestion TIMESTAMPTZ,
        last_attempted_ingestion TIMESTAMPTZ,
        last_error TEXT,
        consecutive_failures INTEGER DEFAULT 0,
        earliest_data_date DATE,
        latest_data_date DATE,
        record_count INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(source_name, table_name, metric_name)
      )`
    },
    {
      name: 'score_calculation_log',
      sql: `CREATE TABLE IF NOT EXISTS score_calculation_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id TEXT,
        calculation_version TEXT,
        period_date DATE NOT NULL,
        geography_type TEXT,
        geographies_processed INTEGER DEFAULT 0,
        scores_calculated INTEGER DEFAULT 0,
        scores_failed INTEGER DEFAULT 0,
        distribution_check_passed BOOLEAN,
        anomaly_count INTEGER,
        anomalies JSONB,
        status TEXT DEFAULT 'running',
        error_message TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        duration_seconds INTEGER
      )`
    }
  ];

  let created = 0;
  let errors = 0;

  for (const table of tables) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: table.sql });

      if (error) {
        // Try direct approach - Supabase doesn't have exec_sql by default
        // We'll use a workaround
        console.log(`Note: ${table.name} - attempting via REST...`);
      }

      // Verify table exists by querying it
      const { error: checkError } = await supabase
        .from(table.name)
        .select('*')
        .limit(0);

      if (!checkError) {
        console.log(`✓ ${table.name} - exists`);
        created++;
      } else if (checkError.message.includes('does not exist')) {
        console.log(`✗ ${table.name} - needs manual creation`);
        errors++;
      } else {
        console.log(`? ${table.name} - ${checkError.message}`);
      }
    } catch (e: any) {
      console.log(`✗ ${table.name} - ${e.message}`);
      errors++;
    }
  }

  console.log('\n--- SUMMARY ---');
  console.log(`Tables verified: ${created}`);
  console.log(`Tables need manual creation: ${errors}`);

  if (errors > 0) {
    console.log('\nTo create missing tables, run the SQL migration directly via Supabase Dashboard:');
    console.log('1. Go to https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Paste contents of scripts/migrations/030-create-new-schema.sql');
    console.log('4. Click "Run"');
  }
}

runMigration().catch(console.error);
