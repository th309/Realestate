-- Redfin Data Center: cash_loan (financing trends) dashboard (add-only).
-- Metro-only coverage (country + available metros). No state/county/zip.
CREATE TABLE IF NOT EXISTS redfin_dc_cash_loan_country (
  region_id TEXT NOT NULL, region_name TEXT, period_begin DATE, period_end DATE NOT NULL,
  frequency TEXT, last_updated DATE,
  percent_all_cash NUMERIC, percent_all_cash_yoy NUMERIC,
  median_down_payment NUMERIC, median_down_payment_yoy NUMERIC,
  median_down_payment_pct NUMERIC, median_down_payment_pct_yoy NUMERIC,
  percent_fha_loan NUMERIC, percent_fha_loan_yoy NUMERIC,
  percent_va_loan NUMERIC, percent_va_loan_yoy NUMERIC,
  percent_conventional_loan NUMERIC, percent_conventional_loan_yoy NUMERIC,
  percent_conventional_conforming_loan NUMERIC, percent_conventional_conforming_loan_yoy NUMERIC,
  percent_conventional_jumbo_loan NUMERIC, percent_conventional_jumbo_loan_yoy NUMERIC,
  PRIMARY KEY (period_end, region_id)
);
CREATE INDEX IF NOT EXISTS idx_redfin_dc_cash_loan_country_period ON redfin_dc_cash_loan_country (period_end DESC);
GRANT ALL ON redfin_dc_cash_loan_country TO service_role, authenticated;

CREATE TABLE IF NOT EXISTS redfin_dc_cash_loan_metro (
  region_id TEXT NOT NULL, region_name TEXT NOT NULL, period_begin DATE, period_end DATE NOT NULL,
  frequency TEXT, last_updated DATE,
  percent_all_cash NUMERIC, percent_all_cash_yoy NUMERIC,
  median_down_payment NUMERIC, median_down_payment_yoy NUMERIC,
  median_down_payment_pct NUMERIC, median_down_payment_pct_yoy NUMERIC,
  percent_fha_loan NUMERIC, percent_fha_loan_yoy NUMERIC,
  percent_va_loan NUMERIC, percent_va_loan_yoy NUMERIC,
  percent_conventional_loan NUMERIC, percent_conventional_loan_yoy NUMERIC,
  percent_conventional_conforming_loan NUMERIC, percent_conventional_conforming_loan_yoy NUMERIC,
  percent_conventional_jumbo_loan NUMERIC, percent_conventional_jumbo_loan_yoy NUMERIC,
  PRIMARY KEY (period_end, region_id, region_name)
);
CREATE INDEX IF NOT EXISTS idx_redfin_dc_cash_loan_metro_period ON redfin_dc_cash_loan_metro (period_end DESC);
GRANT ALL ON redfin_dc_cash_loan_metro TO service_role, authenticated;
