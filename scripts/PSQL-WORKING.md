# PSQL Connection - WORKING ✅

## ✅ Working Solution

Use the simple script that works:

```powershell
# Execute a query
.\scripts\psql.ps1 "SELECT COUNT(*) FROM markets;"

# Interactive session
.\scripts\psql.ps1
```

## Connection Details

- **Host:** `aws-1-us-east-1.pooler.supabase.com` (Session Pooler)
- **Port:** `5432`
- **Database:** `postgres`
- **Username:** `postgres.pysflbhpnqwoczyuaaif`
- **Password:** `Ihatedoingpt$$12`

## Direct Command

You can also run directly:

```powershell
$env:PGPASSWORD = 'Ihatedoingpt$$12'
psql -h aws-1-us-east-1.pooler.supabase.com -p 5432 -d postgres -U postgres.pysflbhpnqwoczyuaaif -c "SELECT version();"
```

## Examples

```powershell
# List tables
.\scripts\psql.ps1 "\dt"

# Count records
.\scripts\psql.ps1 "SELECT COUNT(*) FROM markets;"
.\scripts\psql.ps1 "SELECT COUNT(*) FROM tiger_zcta;"

# Get schema
.\scripts\psql.ps1 "\d markets"

# Interactive session
.\scripts\psql.ps1
```

## All Scripts

1. ✅ **`scripts/psql.ps1`** - **USE THIS** (Simple, works perfectly)
2. `scripts/connect-supabase.ps1` - Full-featured (may have auth issues)
3. `scripts/psql-helper.ps1` - Helper functions (load with `. .\scripts\psql-helper.ps1`)

**The `psql.ps1` script works reliably!**

