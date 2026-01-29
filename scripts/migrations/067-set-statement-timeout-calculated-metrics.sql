-- Migration 067: Raise statement_timeout so populate-calculated-metrics (and other batch jobs) complete.
-- Task: full historical cap rate data without "canceling statement due to statement timeout".
-- 600000 ms = 10 minutes. If your Supabase plan rejects ALTER DATABASE, set statement_timeout in Dashboard → Project Settings → Database instead.

ALTER DATABASE postgres SET statement_timeout = '600000';
