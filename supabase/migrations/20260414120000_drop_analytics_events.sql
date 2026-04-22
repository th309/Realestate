-- Migration: drop_analytics_events
-- Purpose: Remove the deprecated analytics_events table. Real events land in user_events
-- via UserAnalyticsModule. AnalyticsEventsModule is being removed in the same ship.
-- Verified 2026-04-14: 0 rows, 0 dependent objects.

DROP TABLE IF EXISTS public.analytics_events;
