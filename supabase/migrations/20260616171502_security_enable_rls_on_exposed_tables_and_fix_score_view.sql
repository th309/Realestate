-- Security remediation (2026-06-16): clears the 41 ERROR-level advisors.
-- Applied live to prod via execute_sql on 2026-06-16; this file tracks it in git.
--
-- ERROR security_definer_view: propertyiq_scores ran as its creator and bypassed the caller's RLS.
-- Switch to security_invoker. Backend reads/writes via service_role (bypasses RLS), so transparent.
-- Verified: SET ROLE service_role; SELECT count(*) FROM propertyiq_scores = 13,798,769 rows after the change.
ALTER VIEW public.propertyiq_scores SET (security_invoker = true);

-- ERROR rls_disabled_in_public x39: these API-exposed public tables had RLS OFF, so anon/authenticated
-- could read (and in most cases DELETE/UPDATE) every row via the Data API. Verified (Explore agent) that
-- the frontend never reads them with the publishable key; all access is backend via the sb_secret key
-- (service_role), which bypasses RLS. Enabling RLS with no policy => anon/authenticated default-deny.
-- NOTE: spatial_ref_sys is a PostGIS system table we do not own; its RLS warning is an unfixable false-positive.
ALTER TABLE public.irs_county_migration_flows                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irs_migration_county_aggregates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_credentials                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propertyiq_quintile_summary               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_geo_state_map                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screener_snapshot                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zhvi_forward_returns                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_migration_metro                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_migration_flows_metro              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_buyers_sellers_census_region    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_buyers_sellers_country          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_buyers_sellers_metro            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_cash_loan_country               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_cash_loan_metro                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_contract_cancellations_country  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_contract_cancellations_county   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_contract_cancellations_metro    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_contract_cancellations_state    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_contract_cancellations_zip      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_delistings_relistings_country   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_delistings_relistings_county    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_delistings_relistings_metro     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_delistings_relistings_state     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_delistings_relistings_zip       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_housing_market_country          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_housing_market_county           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_housing_market_metro            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_housing_market_state            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_housing_market_zip              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_investors_by_category           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_investors_country               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_investors_metro                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_price_drops_country             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_price_drops_county              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_price_drops_metro               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_price_drops_state               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_price_drops_zip                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_rhpi_country                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redfin_dc_rhpi_metro                      ENABLE ROW LEVEL SECURITY;
