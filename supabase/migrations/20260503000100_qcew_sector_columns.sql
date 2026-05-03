-- 20260503000100_qcew_sector_columns.sql
-- Adds 11 NAICS supersector employment columns + wage/establishment counts to
-- economic_county and economic_metro. QCEW source.

ALTER TABLE economic_county
  ADD COLUMN IF NOT EXISTS employment_natural_resources_mining BIGINT,
  ADD COLUMN IF NOT EXISTS employment_construction BIGINT,
  ADD COLUMN IF NOT EXISTS employment_manufacturing BIGINT,
  ADD COLUMN IF NOT EXISTS employment_trade_transport_utilities BIGINT,
  ADD COLUMN IF NOT EXISTS employment_information BIGINT,
  ADD COLUMN IF NOT EXISTS employment_financial_activities BIGINT,
  ADD COLUMN IF NOT EXISTS employment_professional_business_services BIGINT,
  ADD COLUMN IF NOT EXISTS employment_education_health_services BIGINT,
  ADD COLUMN IF NOT EXISTS employment_leisure_hospitality BIGINT,
  ADD COLUMN IF NOT EXISTS employment_other_services BIGINT,
  ADD COLUMN IF NOT EXISTS employment_public_administration BIGINT,
  ADD COLUMN IF NOT EXISTS qcew_avg_weekly_wage NUMERIC,
  ADD COLUMN IF NOT EXISTS qcew_total_establishments INT;

ALTER TABLE economic_metro
  ADD COLUMN IF NOT EXISTS employment_natural_resources_mining BIGINT,
  ADD COLUMN IF NOT EXISTS employment_construction BIGINT,
  ADD COLUMN IF NOT EXISTS employment_manufacturing BIGINT,
  ADD COLUMN IF NOT EXISTS employment_trade_transport_utilities BIGINT,
  ADD COLUMN IF NOT EXISTS employment_information BIGINT,
  ADD COLUMN IF NOT EXISTS employment_financial_activities BIGINT,
  ADD COLUMN IF NOT EXISTS employment_professional_business_services BIGINT,
  ADD COLUMN IF NOT EXISTS employment_education_health_services BIGINT,
  ADD COLUMN IF NOT EXISTS employment_leisure_hospitality BIGINT,
  ADD COLUMN IF NOT EXISTS employment_other_services BIGINT,
  ADD COLUMN IF NOT EXISTS employment_public_administration BIGINT,
  ADD COLUMN IF NOT EXISTS qcew_avg_weekly_wage NUMERIC,
  ADD COLUMN IF NOT EXISTS qcew_total_establishments INT;
