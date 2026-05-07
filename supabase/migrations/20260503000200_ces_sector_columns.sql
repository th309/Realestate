-- 20260503000200_ces_sector_columns.sql
-- CES sector employment for metro and state. Prefixed ces_ to disambiguate
-- from QCEW columns sharing the economic_metro table. ces_period_date tracks
-- CES "as-of" independent of QCEW (CES updates monthly; QCEW quarterly).

ALTER TABLE economic_metro
  ADD COLUMN IF NOT EXISTS ces_total_nonfarm_employment BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_natural_resources_mining BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_construction BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_manufacturing BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_trade_transport_utilities BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_information BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_financial_activities BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_professional_business_services BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_education_health_services BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_leisure_hospitality BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_other_services BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_public_administration BIGINT,
  ADD COLUMN IF NOT EXISTS ces_period_date DATE;

ALTER TABLE economic_state
  ADD COLUMN IF NOT EXISTS ces_total_nonfarm_employment BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_natural_resources_mining BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_construction BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_manufacturing BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_trade_transport_utilities BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_information BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_financial_activities BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_professional_business_services BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_education_health_services BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_leisure_hospitality BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_other_services BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_public_administration BIGINT,
  ADD COLUMN IF NOT EXISTS ces_period_date DATE;
