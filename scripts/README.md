# Database Scripts

## Files

- `database-schema.sql` - Complete database schema with all tables, indexes, and RLS policies
- `SUPABASE-SETUP.md` - Step-by-step guide to set up Supabase

## Usage

1. Follow `SUPABASE-SETUP.md` to create your Supabase project
2. Run `database-schema.sql` in Supabase SQL Editor
3. Verify tables are created
4. Update `.env.local` with your credentials

## Database Schema Overview

### Core Tables
- `geo_data` - 120,000+ markets (states, metros, cities, zip codes)
- `time_series_data` - Historical data (partitioned by year)
- `current_scores` - Investment scores for all markets

### User Tables
- `user_subscriptions` - Subscription tiers and usage
- `user_favorites` - Saved markets
- `price_alerts` - User alerts

### System Tables
- `tier_configs` - Admin-editable tier settings
- `ai_cache` - Cached AI responses
- `admin_users` - Admin access control
- `user_activity_logs` - User activity tracking
- `data_ingestion_logs` - ETL job tracking

## Performance Optimizations

- **Partitioning:** Time series data partitioned by year
- **Indexes:** Strategic indexes on all frequently queried columns
- **RLS:** Row Level Security for user data protection
- **PostGIS:** Geographic queries and spatial indexing

