# Supabase Database Setup Guide

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name:** Real Estate Intelligence
   - **Database Password:** (Generate strong password - save it!)
   - **Region:** Choose closest to your users
   - **Pricing Plan:** Free tier is fine to start
5. Click "Create new project"
6. Wait 2-3 minutes for project to initialize

## Step 2: Get Your Credentials

1. Go to Project Settings (gear icon)
2. Click "API" in the left sidebar
3. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`) - Keep this SECRET!

## Step 3: Run Database Schema

1. Go to SQL Editor in Supabase dashboard
2. Click "New query"
3. Copy the entire contents of `database-schema.sql`
4. Paste into the SQL editor
5. Click "Run" (or press Ctrl+Enter)
6. Verify success - you should see "Success. No rows returned"

## Step 4: Enable PostGIS Extension

**Option A: Using SQL Editor (Recommended)**
1. In Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"** button (top right)
3. In the SQL editor text area, paste this command:
```sql
CREATE EXTENSION IF NOT EXISTS "postgis";
```
4. Click the **"Run"** button (or press `Ctrl+Enter`)
5. You should see: "Success. No rows returned"

**Option B: Using Extensions UI**
1. In Supabase dashboard, click **"Database"** in left sidebar
2. Click **"Extensions"** submenu
3. Find **"postgis"** in the list
4. Click the toggle switch to enable it

**Note:** The SQL command includes `IF NOT EXISTS`, so it's safe to run even if PostGIS is already enabled.

## Step 5: Verify Tables Created

1. Go to "Table Editor" in Supabase dashboard
2. You should see these tables:
   - `geo_data`
   - `time_series_data` (with partitions)
   - `current_scores`
   - `user_subscriptions`
   - `tier_configs`
   - `user_favorites`
   - `price_alerts`
   - `ai_cache`
   - `admin_users`
   - `user_activity_logs`
   - `data_ingestion_logs`

## Step 6: Set Up Environment Variables

1. Create `.env.local` in `web/` directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

2. **IMPORTANT:** Add `.env.local` to `.gitignore` (already done)

## Step 7: Test Connection

Run this in SQL Editor to verify:
```sql
SELECT COUNT(*) FROM geo_data; -- Should return 0 (empty)
SELECT COUNT(*) FROM tier_configs; -- Should return 4 (default tiers)
```

## Step 8: Create First Admin User ⏭️ (DO THIS LATER)

**⚠️ SKIP THIS STEP FOR NOW - Do this after Phase 5 (Authentication) is complete**

This step requires:
1. Authentication system built (Phase 5)
2. User sign-up functionality working
3. You've created your first account in the app

**When ready (after Phase 5):**
1. Sign up for an account using the app's registration page
2. Note your email address
3. In Supabase SQL Editor, run:
```sql
-- Replace 'your-email@example.com' with the email you used to sign up
INSERT INTO admin_users (user_id, email, role)
SELECT id, email, 'super_admin'
FROM auth.users
WHERE email = 'your-email@example.com';
```
4. Verify admin access by checking:
```sql
SELECT * FROM admin_users WHERE email = 'your-email@example.com';
```

## Troubleshooting

### "Extension postgis does not exist"
- Go to Database → Extensions
- Enable "postgis" extension
- Or contact Supabase support

### "Permission denied"
- Make sure you're using the SQL Editor (not API)
- Check you're logged in as project owner

### Tables not showing
- Refresh the Table Editor
- Check SQL Editor for error messages
- Verify schema.sql ran completely

## Next Steps

After database is set up:
1. Update `.env.local` with your credentials
2. Test database connection in Next.js app
3. Proceed to Phase 1.3: Environment Configuration

