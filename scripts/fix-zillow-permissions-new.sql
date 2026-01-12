
-- Grant permissions on new Zillow tables

GRANT ALL ON TABLE zillow_state TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_metro TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_county TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_zip TO postgres, service_role, dashboard_user, anon, authenticated;

-- Legacy/Other tables
GRANT ALL ON TABLE zillow_zhvi TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_zori TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_zhvf TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_zordi TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_new_listings TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_pending_listings TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_median_list_price TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_sale_to_list TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_days_to_close TO postgres, service_role, dashboard_user, anon, authenticated;
GRANT ALL ON TABLE zillow_price_cut_share TO postgres, service_role, dashboard_user, anon, authenticated;

-- Grant usage on sequences if there are any (though these tables use integer IDs from source, usually)
-- Just in case they have auto-increment primary keys
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, dashboard_user, anon, authenticated;
