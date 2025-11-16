# Get Correct Supabase Connection String

## The Issue
The hostname `db.pysflbhpnqwoczyuaaif.supabase.co` is not resolving. We need to get the exact connection details from your Supabase Dashboard.

## Steps to Get Correct Connection Details

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/settings/database

2. **Find Connection String:**
   - Look for "Connection string" or "Connection parameters"
   - You'll see something like:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
     ```
   - OR individual parameters:
     - Host
     - Port
     - Database name
     - Username
     - Password

3. **Check Connection Pooling:**
   - Sometimes the hostname is different for pooled connections
   - Look for "Connection pooling" section
   - It might use a different port (like 6543) or hostname

4. **Verify Project Status:**
   - Make sure your Supabase project is not paused
   - Check project status in the dashboard

## What to Look For

The connection string format is usually:
```
postgresql://postgres:PASSWORD@HOST:PORT/postgres
```

Or for connection pooling:
```
postgresql://postgres:PASSWORD@HOST:6543/postgres?pgbouncer=true
```

## For QGIS

Once you have the connection string, extract:
- **Host**: The part after `@` and before `:`
- **Port**: Usually `5432` (direct) or `6543` (pooled)
- **Database**: Usually `postgres`
- **Username**: Usually `postgres`
- **Password**: Your database password

## Alternative: Use Connection Pooling

If direct connection doesn't work, try connection pooling:
- Port: `6543` instead of `5432`
- Add `?pgbouncer=true` to connection string
- Hostname might be different

## Quick Check

1. Open: https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/settings/database
2. Copy the exact connection string shown
3. Update QGIS connection with those exact values








