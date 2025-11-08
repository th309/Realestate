-- Add missing partitions for market_time_series table
-- Zillow data goes back to 2000, so we need partitions from 2000-2025

-- Create partitions for years 2000-2019 (missing years)
CREATE TABLE IF NOT EXISTS market_time_series_2000 PARTITION OF market_time_series
    FOR VALUES FROM ('2000-01-01') TO ('2001-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2001 PARTITION OF market_time_series
    FOR VALUES FROM ('2001-01-01') TO ('2002-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2002 PARTITION OF market_time_series
    FOR VALUES FROM ('2002-01-01') TO ('2003-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2003 PARTITION OF market_time_series
    FOR VALUES FROM ('2003-01-01') TO ('2004-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2004 PARTITION OF market_time_series
    FOR VALUES FROM ('2004-01-01') TO ('2005-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2005 PARTITION OF market_time_series
    FOR VALUES FROM ('2005-01-01') TO ('2006-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2006 PARTITION OF market_time_series
    FOR VALUES FROM ('2006-01-01') TO ('2007-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2007 PARTITION OF market_time_series
    FOR VALUES FROM ('2007-01-01') TO ('2008-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2008 PARTITION OF market_time_series
    FOR VALUES FROM ('2008-01-01') TO ('2009-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2009 PARTITION OF market_time_series
    FOR VALUES FROM ('2009-01-01') TO ('2010-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2010 PARTITION OF market_time_series
    FOR VALUES FROM ('2010-01-01') TO ('2011-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2011 PARTITION OF market_time_series
    FOR VALUES FROM ('2011-01-01') TO ('2012-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2012 PARTITION OF market_time_series
    FOR VALUES FROM ('2012-01-01') TO ('2013-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2013 PARTITION OF market_time_series
    FOR VALUES FROM ('2013-01-01') TO ('2014-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2014 PARTITION OF market_time_series
    FOR VALUES FROM ('2014-01-01') TO ('2015-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2015 PARTITION OF market_time_series
    FOR VALUES FROM ('2015-01-01') TO ('2016-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2016 PARTITION OF market_time_series
    FOR VALUES FROM ('2016-01-01') TO ('2017-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2017 PARTITION OF market_time_series
    FOR VALUES FROM ('2017-01-01') TO ('2018-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2018 PARTITION OF market_time_series
    FOR VALUES FROM ('2018-01-01') TO ('2019-01-01');

CREATE TABLE IF NOT EXISTS market_time_series_2019 PARTITION OF market_time_series
    FOR VALUES FROM ('2019-01-01') TO ('2020-01-01');

-- Add future partition for 2026 (for any forward-looking data)
CREATE TABLE IF NOT EXISTS market_time_series_2026 PARTITION OF market_time_series
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Verify partitions were created
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE tablename LIKE 'market_time_series_%' 
ORDER BY tablename;
