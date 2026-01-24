---
description: How to run queries and perform operations on the Supabase PostgreSQL database
---

# Supabase Database Operations Workflow

This workflow describes how to interact with the Supabase PostgreSQL database for this project.

## 🔧 Connection Details

- **Project Reference**: `pysflbhpnqwoczyuaaif`
- **Supabase URL**: `https://pysflbhpnqwoczyuaaif.supabase.co`
- **Connection Method**: Transaction Pooler via `aws-1-us-east-1.pooler.supabase.com:6543`
- **Database**: `postgres`
- **Username**: `postgres.pysflbhpnqwoczyuaaif`
- **Password**: Set via `SUPABASE_DB_PASSWORD` env var or hardcoded in scripts

---

## 📝 Running SQL Queries

Use the PowerShell script `scripts/connect-supabase.ps1` to execute SQL queries.

### Basic Syntax

```powershell
.\scripts\connect-supabase.ps1 "YOUR_SQL_QUERY_HERE"
```

### Examples

// turbo
1. **Count tables in the database:**
```powershell
.\scripts\connect-supabase.ps1 "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

// turbo
2. **List all tables:**
```powershell
.\scripts\connect-supabase.ps1 "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
```

// turbo
3. **View table structure:**
```powershell
.\scripts\connect-supabase.ps1 "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'markets';"
```

4. **Insert data:**
```powershell
.\scripts\connect-supabase.ps1 "INSERT INTO your_table (column1, column2) VALUES ('value1', 'value2');"
```

5. **Update data:**
```powershell
.\scripts\connect-supabase.ps1 "UPDATE your_table SET column1 = 'new_value' WHERE id = 1;"
```

6. **Delete data:**
```powershell
.\scripts\connect-supabase.ps1 "DELETE FROM your_table WHERE id = 1;"
```

---

## 🚀 Running Migrations

Use the PowerShell script `scripts/run-migration.ps1` to run database migrations.

### Migration Runner Syntax

```powershell
# Run a specific migration by file name
.\scripts\run-migration.ps1 -MigrationFile "057-create-building-permits-tables.sql"

# Run a specific migration by number
.\scripts\run-migration.ps1 -MigrationNumber 57

# Preview all migrations (dry run)
.\scripts\run-migration.ps1 -All -DryRun

# Run ALL migrations
.\scripts\run-migration.ps1 -All
```

### Examples

// turbo
1. **Dry run to see what would be executed:**
```powershell
.\scripts\run-migration.ps1 -MigrationNumber 57 -DryRun
```

// turbo
2. **Run a specific migration:**
```powershell
.\scripts\run-migration.ps1 -MigrationNumber 57
```

// turbo
3. **Run migration by file name:**
```powershell
.\scripts\run-migration.ps1 -MigrationFile "057-create-building-permits-tables.sql"
```

### Migration File Location

All migrations are stored in: `scripts/migrations/`

Naming convention: `NNN-description.sql` (e.g., `057-create-building-permits-tables.sql`)

---

## 📊 Database Overview

### Key Tables (138+ total)

| Table | Description |
|-------|-------------|
| `markets` | Market geography data |
| `zillow_metro` | Zillow metro-level housing data (~2.37M rows) |
| `census_housing` | Census housing statistics |
| `geo_*` tables | Geographic mapping tables |
| `realtor_*` tables | Realtor.com data by geography |
| `redfin_*` tables | Redfin data by geography |

### Capabilities

| Operation | Supported |
|-----------|-----------|
| **SELECT** - Query data | ✅ |
| **INSERT** - Add records | ✅ |
| **UPDATE** - Modify records | ✅ |
| **DELETE** - Remove records | ✅ |
| **CREATE TABLE** | ✅ |
| **DROP TABLE** | ✅ |
| **ALTER TABLE** | ✅ |
| **Migrations** | ✅ |

---

## 🔐 Environment Variables

Defined in `.env.local`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymous key (client-side) |
| `SUPABASE_SERVICE_KEY` | Service role key (backend/admin) |

---

## 📋 Notes

- The connection uses the **transaction pooler** for better connection management
- Password is stored in the script or via `SUPABASE_DB_PASSWORD` environment variable
- For large operations, use the Supabase JavaScript client in `packages/backend/src/supabase/`
- MCP servers provide the most seamless AI-powered database interaction
