SELECT 
    COUNT(*) as total_metro_areas,
    COUNT(DISTINCT state_code) as states_with_metros,
    MIN(region_name) as first_metro,
    MAX(region_name) as last_metro
FROM markets
WHERE region_type = 'msa';

SELECT 
    region_id,
    region_name,
    state_code,
    state_name
FROM markets
WHERE region_type = 'msa'
ORDER BY region_name
LIMIT 20;

