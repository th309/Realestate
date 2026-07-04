-- Backfill entitlement gating for 23 registry metrics that had no feature_definitions row.
--
-- Without a feature_definitions row, entitlement resolution returns level:'none' for EVERY
-- tier (including admin) — because resolution is purely data-driven (no admin wildcard) — so a
-- paying Pro/Enterprise/Admin user sees the metric locked behind a Pro upsell. This was confirmed
-- live on /map for `months_of_supply` (a selectable map metric). The other 22 were latent (not yet
-- on the map metric selector) but would lock for all tiers the moment they were surfaced.
--
-- Gating mirrors the existing metric_* templates: Free = false ; Pro / Enterprise / Admin = true.
-- Idempotent: ON CONFLICT DO NOTHING on both unique constraints (feature_definitions.slug,
-- tier_features(tier_id, feature_id)) — safe to re-run.
-- Beta-test findings F8 (P1 months_of_supply) + F9 (P2 22 latent orphans), 2026-07-04.

-- Statement 1: feature_definitions (unique on slug)
WITH orphan_metrics(slug, name) AS (
  VALUES
    ('metric_months_of_supply', 'Months of Supply'),
    ('metric_employment_natural_resources_mining', 'Natural Resources & Mining Employment'),
    ('metric_employment_construction', 'Construction Employment'),
    ('metric_employment_manufacturing', 'Manufacturing Employment'),
    ('metric_employment_trade_transport_utilities', 'Trade, Transportation & Utilities Employment'),
    ('metric_employment_information', 'Information Employment'),
    ('metric_employment_financial_activities', 'Financial Activities Employment'),
    ('metric_employment_professional_business_services', 'Professional & Business Services Employment'),
    ('metric_employment_education_health_services', 'Education & Health Services Employment'),
    ('metric_employment_leisure_hospitality', 'Leisure & Hospitality Employment'),
    ('metric_employment_other_services', 'Other Services Employment'),
    ('metric_employment_public_administration', 'Public Administration Employment'),
    ('metric_qcew_avg_weekly_wage', 'Average Weekly Wage'),
    ('metric_qcew_total_establishments', 'Total Establishments'),
    ('metric_irs_migration_in_returns', 'IRS Migration In (Returns)'),
    ('metric_irs_migration_out_returns', 'IRS Migration Out (Returns)'),
    ('metric_irs_migration_net_returns', 'IRS Net Migration (Returns)'),
    ('metric_irs_migration_in_avg_agi', 'IRS Inbound Migration Avg AGI'),
    ('metric_irs_migration_out_avg_agi', 'IRS Outbound Migration Avg AGI'),
    ('metric_irs_migration_in_exemptions', 'IRS Migration In (Exemptions)'),
    ('metric_irs_migration_out_exemptions', 'IRS Migration Out (Exemptions)'),
    ('metric_redfin_migration_net_inflow', 'Redfin Net Inflow'),
    ('metric_redfin_migration_inflow_share', 'Redfin Inflow Share')
)
INSERT INTO feature_definitions
  (id, slug, name, description, category, value_type, default_value, is_active, is_enforced, created_at, updated_at)
SELECT gen_random_uuid(), om.slug, om.name, NULL, 'metrics', 'boolean', 'false'::jsonb, true, true, now(), now()
FROM orphan_metrics om
ON CONFLICT (slug) DO NOTHING;

-- Statement 2: tier_features (unique on tier_id, feature_id). Joins feature_definitions by slug so
-- it reconciles rows created above OR in any prior partial run.
WITH orphan_slugs(slug) AS (
  VALUES
    ('metric_months_of_supply'),('metric_employment_natural_resources_mining'),('metric_employment_construction'),
    ('metric_employment_manufacturing'),('metric_employment_trade_transport_utilities'),('metric_employment_information'),
    ('metric_employment_financial_activities'),('metric_employment_professional_business_services'),
    ('metric_employment_education_health_services'),('metric_employment_leisure_hospitality'),
    ('metric_employment_other_services'),('metric_employment_public_administration'),('metric_qcew_avg_weekly_wage'),
    ('metric_qcew_total_establishments'),('metric_irs_migration_in_returns'),('metric_irs_migration_out_returns'),
    ('metric_irs_migration_net_returns'),('metric_irs_migration_in_avg_agi'),('metric_irs_migration_out_avg_agi'),
    ('metric_irs_migration_in_exemptions'),('metric_irs_migration_out_exemptions'),('metric_redfin_migration_net_inflow'),
    ('metric_redfin_migration_inflow_share')
),
tier_gating(tier_id, value) AS (
  VALUES
    ('84e96da6-c749-44c7-93fb-5ef072d71c5c'::uuid, 'false'::jsonb),  -- Free
    ('5558b259-f1ea-4b0d-9d62-5d4235b924de'::uuid, 'true'::jsonb),   -- Pro
    ('54fe85a2-2a1f-4752-a68c-1d297a832ec7'::uuid, 'true'::jsonb),   -- Enterprise
    ('99e0ee4d-a077-42fa-88ac-787693b49574'::uuid, 'true'::jsonb)    -- Admin
)
INSERT INTO tier_features (id, tier_id, feature_id, value, created_at, updated_at)
SELECT gen_random_uuid(), tg.tier_id, fd.id, tg.value, now(), now()
FROM orphan_slugs os
JOIN feature_definitions fd ON fd.slug = os.slug
CROSS JOIN tier_gating tg
ON CONFLICT (tier_id, feature_id) DO NOTHING;
