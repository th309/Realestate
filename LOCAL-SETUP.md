# Local Development Setup

## Quick Start

📖 **New to this project?** Start with [CONNECTION-SETUP.md](./CONNECTION-SETUP.md) for detailed setup instructions.

## Project Repository
- **Remote:** https://github.com/th309/Realestate
- **Branch:** main
- **Supabase Project:** https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif

## Environment Configuration

### Required Setup Files

1. **Root-level** `.env.local` (for scripts and database access)
   ```bash
   cp .env.example .env.local
   ```

2. **Web application** `web/.env.local` (for Next.js app)
   ```bash
   cd web
   cp .env.example .env.local
   ```

### Minimum Required Variables

At minimum, you need these Supabase credentials:

```env
# Get from: https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://pysflbhpnqwoczyuaaif.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Get from: https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/settings/database
SUPABASE_DB_PASSWORD=your_database_password
```

### Optional API Keys (for data ingestion)

```env
# U.S. Census Bureau - https://api.census.gov/data/key_signup.html
CENSUS_API_KEY=your_census_key

# Federal Reserve (FRED) - https://fredaccount.stlouisfed.org/apikeys
FRED_API_KEY=your_fred_key

# Bureau of Labor Statistics - https://www.bls.gov/developers/home.htm
BLS_API_KEY=your_bls_key

# Mapbox - https://account.mapbox.com/access-tokens/
MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

## Database Connection

### Supabase Project Details
- **Project ID:** pysflbhpnqwoczyuaaif
- **Host:** db.pysflbhpnqwoczyuaaif.supabase.co
- **Port:** 5432 (direct) or 6543 (pooled)
- **Database:** postgres
- **Username:** postgres

### Test Connection

```bash
# Linux/Mac
./scripts/connect-supabase.sh "SELECT version();"

# Windows PowerShell
.\scripts\connect-supabase.ps1 "SELECT version();"
```

See [scripts/PSQL-CONNECTION-GUIDE.md](./scripts/PSQL-CONNECTION-GUIDE.md) for more connection options.

## Installation

```bash
# Install root-level dependencies (for scripts)
npm install

# Install web application dependencies
cd web
npm install
cd ..
```

## Development

```bash
# Start web development server
cd web
npm run dev
# Visit http://localhost:3000

# Run database scripts (from root)
npm run load-shapefiles
npm run convert-shapefiles
```

## Database Operations

```bash
# Execute a single query
./scripts/connect-supabase.sh "SELECT COUNT(*) FROM markets;"

# Start interactive psql session
./scripts/connect-supabase.sh

# List all tables
./scripts/connect-supabase.sh "\dt"

# View table schema
./scripts/connect-supabase.sh "\d markets"
```

## Git Workflow

```bash
# Check status
git status

# Pull latest changes
git pull origin main

# Create a feature branch
git checkout -b feature/your-feature-name

# Commit changes
git add .
git commit -m "Your descriptive message"

# Push to remote
git push origin feature/your-feature-name
```

## Project Structure

```
Realestate/
├── .env.example              # Template for environment variables
├── CONNECTION-SETUP.md       # Detailed setup instructions
├── LOCAL-SETUP.md           # This file
├── data/                    # Geographic data files
│   └── tiger/              # Census TIGER shapefiles
├── scripts/                 # Database and data processing scripts
│   ├── connect-supabase.sh # Database connection script
│   └── *.ps1               # PowerShell scripts for Windows
└── web/                     # Next.js web application
    ├── .env.example        # Web app environment template
    ├── app/                # Next.js app directory
    └── lib/                # Shared libraries
```

## Troubleshooting

### Connection Issues
See [CONNECTION-SETUP.md](./CONNECTION-SETUP.md#troubleshooting) for detailed troubleshooting steps.

### Common Issues

**"Missing environment variables"**
- Make sure you created `.env.local` from `.env.example`
- Verify all required variables are set
- Restart your dev server

**"Authentication failed"**
- Check your Supabase credentials
- Verify database password is correct
- Try resetting password in Supabase dashboard

**"psql: command not found"**
- Install PostgreSQL client tools
- See [CONNECTION-SETUP.md](./CONNECTION-SETUP.md#psql-not-found)

## Resources

- **Connection Setup:** [CONNECTION-SETUP.md](./CONNECTION-SETUP.md)
- **Database Schema:** [scripts/DATABASE-SCHEMA-COMPLETE.md](./scripts/DATABASE-SCHEMA-COMPLETE.md)
- **psql Guide:** [scripts/PSQL-CONNECTION-GUIDE.md](./scripts/PSQL-CONNECTION-GUIDE.md)
- **Data Loading:** [data/tiger/LOADING-INSTRUCTIONS.md](./data/tiger/LOADING-INSTRUCTIONS.md)
- **Project Plan:** [FULL-STACK-PLAN.md](./FULL-STACK-PLAN.md)

---
*Last updated: 2025-11-16*

