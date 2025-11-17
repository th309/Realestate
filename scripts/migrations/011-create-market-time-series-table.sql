-- Migration: Create market_time_series table
-- Purpose: Create table for storing time series data from Zillow and other sources
-- Date: 2025-11-16

-- Create the market_time_series table
CREATE TABLE IF NOT EXISTS market_time_series (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Core fields
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20, 4),
    data_source VARCHAR(50) NOT NULL,
    
    -- Flexible attributes for source-specific metadata
    attributes JSONB DEFAULT '{}',
    
    -- Data quality
    confidence_score DECIMAL(3, 2),
    is_estimated BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (id, date)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_market_time_series_region_date 
    ON market_time_series(region_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_market_time_series_metric 
    ON market_time_series(metric_name, date DESC);

CREATE INDEX IF NOT EXISTS idx_market_time_series_source 
    ON market_time_series(data_source, date DESC);

CREATE INDEX IF NOT EXISTS idx_market_time_series_region_metric 
    ON market_time_series(region_id, metric_name, date DESC);

-- Create unique constraint to prevent duplicates
-- This allows upsert operations based on region_id, date, metric_name, data_source, and attributes
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_time_series_unique 
    ON market_time_series(region_id, date, metric_name, data_source, attributes);

-- Grant permissions (already done in migration 010, but included for completeness)
GRANT SELECT, INSERT, UPDATE ON TABLE market_time_series TO service_role;
GRANT SELECT ON TABLE market_time_series TO anon;
GRANT SELECT ON TABLE market_time_series TO authenticated;

-- Disable RLS (already done in migration 010, but included for completeness)
ALTER TABLE market_time_series DISABLE ROW LEVEL SECURITY;

