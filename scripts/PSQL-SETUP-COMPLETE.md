# PSQL Connection Setup Complete ✅

I've set up direct PostgreSQL connection scripts for Supabase. The scripts are ready to use, but there's currently a DNS/IPv6 connectivity issue that needs to be resolved.

## Files Created

1. **`scripts/connect-supabase.ps1`** - Main connection script (PowerShell)
2. **`scripts/connect-supabase.sh`** - Main connection script (Bash)
3. **`scripts/psql-helper.ps1`** - Helper functions for PowerShell
4. **`scripts/test-psql-connection.ps1`** - Test connection script
5. **`scripts/PSQL-CONNECTION-GUIDE.md`** - Complete usage guide

## Connection Details

- **Host:** `db.pysflbhpnqwoczyuaaif.supabase.co`
- **Port:** `5432` (direct) or `6543` (connection pooling)
- **Database:** `postgres`
- **Username:** `postgres`
- **Password:** `Ihatedoingpt$$12` (configured in scripts)

## Current Issue

The hostname resolves to an IPv6 address, and psql may have connectivity issues. Try these solutions:

### Solution 1: Use Connection Pooling Port (6543)

```powershell
.\scripts\connect-supabase.ps1 -Port 6543 -Query "SELECT version();"
```

### Solution 2: Use IPv4 Address Directly

Get the IPv4 address:
```powershell
nslookup db.pysflbhpnqwoczyuaaif.supabase.co
```

Then connect using the IP address instead of hostname.

### Solution 3: Force IPv4 in psql

```powershell
$env:PGPASSWORD = 'Ihatedoingpt$$12'
psql -h db.pysflbhpnqwoczyuaaif.supabase.co -p 5432 -U postgres -d postgres --set=ipv4_only=on -c "SELECT version();"
```

### Solution 4: Use Supabase Connection String from Dashboard

1. Go to: https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/settings/database
2. Copy the "Connection string" (URI format)
3. Use it directly:
   ```powershell
   psql "postgresql://postgres:[PASSWORD]@db.pysflbhpnqwoczyuaaif.supabase.co:5432/postgres?sslmode=require"
   ```

## Quick Usage

Once connectivity is resolved:

```powershell
# Execute a query
.\scripts\connect-supabase.ps1 "SELECT COUNT(*) FROM markets;"

# Interactive session
.\scripts\connect-supabase.ps1 -Interactive

# Or use helper functions
. .\scripts\psql-helper.ps1
supabase-query "SELECT * FROM markets LIMIT 5;"
supabase-tables
supabase-schema "markets"
```

## Next Steps

1. Test the connection using one of the solutions above
2. Once working, you can use the scripts for direct database access
3. The scripts will automatically use the configured password

All scripts are ready and configured with your password. The only remaining issue is the network connectivity to the Supabase database host.

