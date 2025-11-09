SELECT 
    region_id,
    date,
    metric_name,
    data_source,
    attributes,
    COUNT(*) as count
FROM market_time_series
WHERE region_id = '102001'
AND date IN ('2000-01-31', '2008-05-31', '2016-09-30')
GROUP BY region_id, date, metric_name, data_source, attributes
ORDER BY date;

