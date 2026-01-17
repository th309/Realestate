---
description: How to run queries and perform operations on the Supabase PostgreSQL database
---

# Supabase Database Operations Workflow

This workflow describes how to interact with the Supabase PostgreSQL database for this project.

## 🔌 MCP Server Setup (Recommended)

The project is configured with Supabase MCP servers for seamless AI-powered database access.

### Configuration Files

**Gemini Configuration** (`.gemini/settings.json`):
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token", "YOUR_TOKEN"]
    },
    "supabase-postgrest": {
      "command": "npx", 
      "args": ["-y", "@supabase/mcp-server-postgrest@latest", "--apiUrl", "https://pysflbhpnqwoczyuaaif.supabase.co/rest/v1", "--apiKey", "YOUR_SERVICE_KEY"]
    }
  }
}
```

### Available MCP Servers

1. **`@supabase/mcp-server-supabase`** - Project Management
   - Create/manage database tables and migrations
   - Run SQL queries directly
   - Database branching for development
   - Fetch project configurations
   - Retrieve logs for debugging
   - Generate TypeScript types from schema

2. **`@supabase/mcp-server-postgrest`** - Data Operations
   - CRUD operations via REST API
   - Respects Row-Level Security (RLS) policies
   - Safe, secure data access

### Setup Steps

1. **Get a Personal Access Token (PAT):**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard/account/tokens)
   - Click "Generate new token"
   - Name it (e.g., "Gemini MCP Server")
   - Copy the token immediately (shown only once)

2. **Update the configuration file** at `.gemini/settings.json` with your token

3. **Restart your IDE/Agent** to load the MCP servers

### Security Notes
- ⚠️ MCP servers are for **development/testing only**, not production
- Use read-only mode for sensitive data when possible
- Review all AI-generated queries before execution on production data

---

## 📝 Manual SQL Access (Alternative)

### Connection Details

- **Project Reference**: `pysflbhpnqwoczyuaaif`
- **Supabase URL**: `https://pysflbhpnqwoczyuaaif.supabase.co`
- **Connection Method**: Transaction Pooler via `aws-1-us-east-1.pooler.supabase.com:6543`
- **Database**: `postgres`
- **Username**: `postgres.pysflbhpnqwoczyuaaif`

### Running SQL Queries via PowerShell

Use the PowerShell script `scripts/connect-supabase.ps1` to execute SQL queries.

#### Basic Syntax

```powershell
.\scripts\connect-supabase.ps1 "YOUR_SQL_QUERY_HERE"
```

#### Examples

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

## 📊 Database Overview

### Key Tables (109 total)

| Table | Description |
|-------|-------------|
| `markets` | Market geography data |
| `zillow_metro` | Zillow metro-level housing data (~2.37M rows) |
| `census_housing` | Census housing statistics |
| `geo_*` tables | Geographic mapping tables |

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
