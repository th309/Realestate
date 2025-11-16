# Connection Setup Guide

This guide will help you establish a new connection to the Realestate repository and configure your environment.

## Quick Start

1. **Clone the repository** (if you haven't already)
   ```bash
   git clone https://github.com/th309/Realestate.git
   cd Realestate
   ```

2. **Install dependencies**
   ```bash
   # Root level dependencies (for scripts)
   npm install

   # Web application dependencies
   cd web
   npm install
   cd ..
   ```

3. **Set up environment variables** (see detailed instructions below)

4. **Test your database connection**

---

## Environment Configuration

### Step 1: Get Your Supabase Credentials

You'll need credentials from your Supabase project dashboard:

1. **Go to Supabase Dashboard:**
   - Navigate to: https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif

2. **Get API Credentials:**
   - Go to: Settings → API
   - Copy these values:
     - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
     - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `service_role` key → `SUPABASE_SERVICE_KEY` (⚠️ Keep secret!)

3. **Get Database Password:**
   - Go to: Settings → Database
   - Under "Connection parameters", find your database password
   - If you don't have it, you can reset it here
   - Copy the password → `SUPABASE_DB_PASSWORD`

### Step 2: Create Environment Files

#### For Root-Level Scripts (Database Access)

```bash
# In the project root directory
cp .env.example .env.local
```

Edit `.env.local` and fill in at minimum:
```env
SUPABASE_DB_PASSWORD=your_actual_password
NEXT_PUBLIC_SUPABASE_URL=https://pysflbhpnqwoczyuaaif.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key
SUPABASE_SERVICE_KEY=your_actual_service_key
```

#### For Web Application

```bash
# In the web directory
cd web
cp .env.example .env.local
```

Edit `web/.env.local` with the same Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://pysflbhpnqwoczyuaaif.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key
SUPABASE_SERVICE_KEY=your_actual_service_key
SUPABASE_DB_PASSWORD=your_actual_password
```

### Step 3: (Optional) Add Data Source API Keys

These are only needed if you plan to use data ingestion features:

- **Census API**: https://api.census.gov/data/key_signup.html
- **FRED API**: https://fredaccount.stlouisfed.org/apikeys
- **BLS API**: https://www.bls.gov/developers/home.htm
- **Mapbox**: https://account.mapbox.com/access-tokens/

---

## Testing Your Connection

### Test Database Connection (Linux/Mac)

```bash
# Make the script executable
chmod +x scripts/connect-supabase.sh

# Test connection with a simple query
./scripts/connect-supabase.sh "SELECT version();"

# Or start an interactive session
./scripts/connect-supabase.sh
```

### Test Database Connection (Windows PowerShell)

```powershell
# Test connection with a simple query
.\scripts\connect-supabase.ps1 "SELECT version();"

# Or start an interactive session
.\scripts\connect-supabase.ps1
```

### Expected Output

If successful, you should see:
```
🔌 Connecting to Supabase PostgreSQL...
   Host: db.pysflbhpnqwoczyuaaif.supabase.co
   Port: 5432
   Database: postgres
   Username: postgres

Executing query...
Query: SELECT version();

                                              version
----------------------------------------------------------------------------------------------------
 PostgreSQL 15.x on x86_64-pc-linux-gnu, compiled by gcc (...)
(1 row)
```

### Test Web Application

```bash
cd web
npm run dev
```

Then visit http://localhost:3000 in your browser.

---

## Available Connection Tools

### Connection Scripts

- **`scripts/connect-supabase.sh`** (Linux/Mac)
  - Direct PostgreSQL connection via psql
  - Supports both query execution and interactive mode

- **`scripts/connect-supabase.ps1`** (Windows)
  - PowerShell version of the connection script

### Helper Functions (PowerShell)

Load helper functions:
```powershell
. .\scripts\psql-helper.ps1
```

Available commands:
- `supabase-query "SELECT * FROM markets LIMIT 5;"`
- `supabase-tables` - List all tables
- `supabase-schema "markets"` - Get schema for a table
- `supabase-connect` - Start interactive session

See `scripts/PSQL-CONNECTION-GUIDE.md` for more details.

---

## Troubleshooting

### Connection Refused / Timeout
- Check your internet connection
- Verify the host address is correct: `db.pysflbhpnqwoczyuaaif.supabase.co`
- Try using port `6543` (connection pooling) instead of `5432`
- Check firewall settings

### Authentication Failed
- Verify your password is correct (no extra spaces)
- Try resetting the database password in Supabase dashboard
- Check for special characters that might need escaping

### psql Not Found
Install PostgreSQL client tools:
- **Linux**: `sudo apt-get install postgresql-client` (Ubuntu/Debian)
- **Mac**: `brew install postgresql`
- **Windows**: Download from https://www.postgresql.org/download/windows/

### Environment Variables Not Loading
- Make sure you created `.env.local` (not just `.env`)
- Verify the file is in the correct directory (root or web/)
- Check that values don't have extra quotes or spaces
- Restart your development server after changing env files

### Missing Dependencies
```bash
# Install root dependencies
npm install

# Install web dependencies
cd web
npm install
```

---

## Security Best Practices

⚠️ **IMPORTANT:**

1. **Never commit** `.env.local` or `.env` files to git
2. **Keep service keys secret** - only use in server-side code
3. **Don't expose** database passwords in logs or client code
4. **Use environment variables** for all sensitive credentials
5. **Rotate keys regularly** if you suspect they've been exposed

The `.gitignore` file is already configured to exclude environment files.

---

## Next Steps

Once your connection is established:

1. **Explore the database schema**: `scripts/DATABASE-SCHEMA-COMPLETE.md`
2. **Review the project structure**: `FULL-STACK-PLAN.md`
3. **Check data loading guides**: `data/tiger/LOADING-INSTRUCTIONS.md`
4. **Start development**: `web/README.md`

---

## Getting Help

- **Connection issues**: See `scripts/PSQL-CONNECTION-GUIDE.md`
- **Database schema**: See `scripts/DATABASE-SCHEMA-COMPLETE.md`
- **Project setup**: See `LOCAL-SETUP.md`
- **Data loading**: See `data/tiger/LOADING-INSTRUCTIONS.md`

---

*Last updated: 2025-11-16*
