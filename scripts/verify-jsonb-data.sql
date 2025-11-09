SELECT 
    region_id,
    date,
    metric_name,
    data_source,
    attributes,
    metric_value
FROM market_time_series
WHERE data_source = 'zillow'
AND attributes != '{}'::jsonb
ORDER BY date DESC
LIMIT 10;

SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN attributes->>'property_type' IS NOT NULL THEN 1 END) as with_property_type,
    COUNT(CASE WHEN attributes->>'tier IS NOT NULL THEN 1 END) as with_tier
FROM market_time_series
WHERE data_source = 'zillow';

