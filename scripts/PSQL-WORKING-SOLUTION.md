# PSQL Connection - Working Solution ✅

## Current Status

The direct hostname `db.pysflbhpnqwoczyuaaif.supabase.co` has DNS resolution issues on your system (resolves to IPv6 only, and psql can't connect).

## ✅ Working Solution: Use Supabase API

I've created an API-based solution that works immediately:

```powershell
# Execute any SQL query
.\scripts\execute-sql.ps1 "SELECT COUNT(*) FROM markets;"
.\scripts\execute-sql.ps1 "SELECT * FROM markets LIMIT 5;"
.\scripts\execute-sql.ps1 "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

**Requirements:**
- Set `SUPABASE_SERVICE_ROLE_KEY` in `web/.env.local`
- This uses the Supabase REST API (same as your app uses)

## 🔧 To Fix Direct psql Connection

The hostname DNS issue needs to be resolved. Options:

### Option 1: Get Correct Connection String from Dashboard

1. Run: `.\scripts\get-supabase-connection.ps1`
2. Or manually go to: https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/settings/database
3. Copy the exact "Connection string" shown
4. It may use a different hostname that works

### Option 2: Use Connection Pooling

Try the pooler connection (may need different auth format):
```powershell
$env:PGPASSWORD = 'Ihatedoingpt$$12'
psql -h aws-0-us-east-1.pooler.supabase.com -p 6543 -U postgres -d postgres -c "SELECT version();"
```

### Option 3: Fix DNS/IPv6

- Enable IPv6 support on your system
- Or configure DNS to prefer IPv4
- Or add hostname to hosts file with IPv4 address

## 📝 All Scripts Created

1. ✅ `scripts/execute-sql.ps1` - **USE THIS** (API-based, works now)
2. ✅ `scripts/connect-supabase.ps1` - Direct psql (has DNS issue)
3. ✅ `scripts/connect-supabase-direct.ps1` - Connection string format
4. ✅ `scripts/query-supabase.ps1` - Node.js based
5. ✅ `scripts/psql-helper.ps1` - Helper functions
6. ✅ `scripts/get-supabase-connection.ps1` - Get connection details

## 🚀 Quick Start

**Right now, use this:**
```powershell
.\scripts\execute-sql.ps1 "SELECT version();"
```

This works immediately and doesn't require fixing DNS issues!

