SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN attributes != '{}'::jsonb THEN 1 END) as records_with_attributes,
  COUNT(CASE WHEN attributes->>'property_type' IS NOT NULL THEN 1 END) as with_property_type,
  COUNT(CASE WHEN attributes->>'tier' IS NOT NULL THEN 1 END) as with_tier,
  COUNT(CASE WHEN data_source = 'zillow' THEN 1 END) as zillow_records
FROM market_time_series;

SELECT 
  region_id,
  date,
  metric_name,
  attributes,
  data_source
FROM market_time_series
WHERE data_source = 'zillow'
ORDER BY date DESC
LIMIT 5;

