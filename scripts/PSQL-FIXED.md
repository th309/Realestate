# PSQL Connection - Fixed Solution ✅

## The Problem
The direct hostname `db.pysflbhpnqwoczyuaaif.supabase.co` has DNS/IPv6 resolution issues on some systems.

## Solution: Use Supabase API Instead

Since direct psql connection has network issues, I've created an alternative that uses the Supabase Admin API (which we know works):

### Method 1: Use execute-sql.ps1 (Recommended)

```powershell
.\scripts\execute-sql.ps1 "SELECT COUNT(*) FROM markets;"
.\scripts\execute-sql.ps1 "SELECT * FROM markets LIMIT 5;"
```

This uses the Supabase REST API with your service role key.

### Method 2: Use query-supabase.ps1

```powershell
.\scripts\query-supabase.ps1 "SELECT COUNT(*) FROM markets;"
```

This uses the Supabase JavaScript client via Node.js.

## For Direct psql Connection

If you need direct psql access, you'll need to:

1. **Get the correct connection string from Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/settings/database
   - Copy the exact "Connection string" shown
   - It might use a different hostname format

2. **Or use the pooler connection:**
   ```powershell
   $env:PGPASSWORD = 'Ihatedoingpt$$12'
   psql -h aws-0-us-east-1.pooler.supabase.com -p 6543 -U postgres -d postgres -c "SELECT version();"
   ```
   (Note: Pooler authentication format may need adjustment)

3. **Or fix DNS/IPv6 on your system:**
   - Enable IPv6 support
   - Or configure DNS to resolve to IPv4

## Quick Reference

**Working Solution (API-based):**
```powershell
.\scripts\execute-sql.ps1 "YOUR SQL QUERY HERE"
```

**Connection Details:**
- Project: `pysflbhpnqwoczyuaaif`
- Password: `Ihatedoingpt$$12`
- Service Role Key: (in web/.env.local)

All scripts are ready and the API-based solution works reliably!

