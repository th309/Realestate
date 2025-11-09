SELECT 
    region_id,
    date,
    metric_name,
    metric_value,
    data_source,
    attributes
FROM market_time_series
WHERE data_source = 'fred'
ORDER BY date DESC
LIMIT 10;

SELECT 
    metric_name,
    COUNT(*) as record_count,
    MIN(date) as earliest_date,
    MAX(date) as latest_date,
    MIN(metric_value) as min_value,
    MAX(metric_value) as max_value,
    AVG(metric_value) as avg_value
FROM market_time_series
WHERE data_source = 'fred'
GROUP BY metric_name
ORDER BY metric_name;

