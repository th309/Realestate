# Direct Supabase PostgreSQL Connection Guide

This guide shows you how to connect directly to Supabase using `psql` (PostgreSQL command-line client) instead of the MCP tool.

## Prerequisites

- PostgreSQL client (`psql`) installed
  - Windows: Usually comes with PostgreSQL installation
  - Check: `psql --version`

## Connection Details

- **Host:** `db.pysflbhpnqwoczyuaaif.supabase.co`
- **Port:** `5432` (direct connection) or `6543` (connection pooling)
- **Database:** `postgres`
- **Username:** `postgres`
- **Password:** (stored in environment or .env.local)
- **SSL Mode:** `require`

## Quick Start

### Method 1: Using the Connection Script (Recommended)

#### PowerShell (Windows):
```powershell
# Execute a single query
.\scripts\connect-supabase.ps1 "SELECT COUNT(*) FROM markets;"

# Start interactive session
.\scripts\connect-supabase.ps1 -Interactive

# Or just run without parameters for interactive mode
.\scripts\connect-supabase.ps1
```

#### Bash (Linux/Mac):
```bash
# Execute a single query
./scripts/connect-supabase.sh "SELECT COUNT(*) FROM markets;"

# Start interactive session
./scripts/connect-supabase.sh
```

### Method 2: Using Helper Functions (PowerShell)

Load the helper functions:
```powershell
. .\scripts\psql-helper.ps1
```

Then use the convenient functions:
```powershell
# Execute a query
supabase-query "SELECT * FROM markets LIMIT 5;"

# List all tables
supabase-tables

# Get schema for a specific table
supabase-schema "markets"

# Get schema for all tables
supabase-schema

# Start interactive session
supabase-connect
```

### Method 3: Direct psql Command

Set the password in environment and connect:
```powershell
# PowerShell
$env:PGPASSWORD = "your-password-here"
psql -h db.pysflbhpnqwoczyuaaif.supabase.co -p 5432 -U postgres -d postgres -c "SELECT version();"
```

```bash
# Bash
export PGPASSWORD="your-password-here"
psql -h db.pysflbhpnqwoczyuaaif.supabase.co -p 5432 -U postgres -d postgres -c "SELECT version();"
```

### Method 4: Using Connection String

```powershell
psql "postgresql://postgres:your-password@db.pysflbhpnqwoczyuaaif.supabase.co:5432/postgres?sslmode=require"
```

## Password Configuration

The scripts will try to get the password from:

1. Environment variable: `SUPABASE_DB_PASSWORD`
2. `.env.local` file in the `web/` directory
3. Prompt you to enter it if not found

To set the environment variable:
```powershell
# PowerShell (current session)
$env:SUPABASE_DB_PASSWORD = "your-password"

# PowerShell (permanent - user level)
[System.Environment]::SetEnvironmentVariable('SUPABASE_DB_PASSWORD', 'your-password', 'User')
```

```bash
# Bash (current session)
export SUPABASE_DB_PASSWORD="your-password"

# Bash (permanent - add to ~/.bashrc or ~/.zshrc)
echo 'export SUPABASE_DB_PASSWORD="your-password"' >> ~/.bashrc
```

## Common Queries

### Check Connection
```sql
SELECT version();
```

### List All Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Get Table Schema
```sql
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'markets'
ORDER BY ordinal_position;
```

### Count Records
```sql
SELECT COUNT(*) FROM markets;
SELECT COUNT(*) FROM tiger_zcta;
SELECT COUNT(*) FROM tiger_county;
```

### View Recent Data
```sql
SELECT * FROM markets ORDER BY created_at DESC LIMIT 10;
```

## Troubleshooting

### Connection Timeout
- Try using port `6543` (connection pooling) instead of `5432`
- Check your firewall settings
- Verify the host address is correct

### SSL Error
- Make sure `sslmode=require` is set
- Some clients may need `sslmode=prefer`

### Authentication Failed
- Verify the password is correct
- Check if the password has special characters that need escaping
- Try resetting the database password in Supabase dashboard

### psql Not Found
- Install PostgreSQL client tools
- Windows: Download from https://www.postgresql.org/download/windows/
- Linux: `sudo apt-get install postgresql-client` (Ubuntu/Debian)
- Mac: `brew install postgresql`

## Useful psql Commands

Once connected interactively:
- `\dt` - List all tables
- `\d table_name` - Describe a table
- `\l` - List all databases
- `\c database_name` - Connect to a different database
- `\q` - Quit
- `\?` - Show help
- `\timing` - Toggle query timing
- `\x` - Toggle expanded display

## Security Notes

⚠️ **Important:**
- Never commit passwords to git
- Use environment variables or `.env.local` (which is gitignored)
- The password is stored in memory only during the session
- Consider using Supabase connection pooling for production

## Getting Your Database Password

1. Go to: https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/settings/database
2. Under "Connection parameters", find the **Database password**
3. If you don't see it, click "Reset database password" to generate a new one
4. Copy the password and store it securely

