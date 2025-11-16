# Real Estate Analytics Platform

A comprehensive real estate analytics platform powered by Supabase, Next.js, and various data sources including Census Bureau, FRED, and geographic data.

## Quick Start

### First Time Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/th309/Realestate.git
   cd Realestate
   ```

2. **Follow the connection setup guide**

   📖 **[CONNECTION-SETUP.md](./CONNECTION-SETUP.md)** - Complete guide for establishing your connection and configuring the environment

3. **Install dependencies**
   ```bash
   npm install
   cd web && npm install && cd ..
   ```

4. **Configure environment**
   ```bash
   # Copy environment templates
   cp .env.example .env.local
   cp web/.env.example web/.env.local

   # Edit both files and add your credentials
   ```

5. **Test your connection**
   ```bash
   ./scripts/connect-supabase.sh "SELECT version();"
   ```

## Documentation

- 📚 **[CONNECTION-SETUP.md](./CONNECTION-SETUP.md)** - Complete setup and connection guide
- 💻 **[LOCAL-SETUP.md](./LOCAL-SETUP.md)** - Local development reference
- 🗄️ **[scripts/DATABASE-SCHEMA-COMPLETE.md](./scripts/DATABASE-SCHEMA-COMPLETE.md)** - Database schema documentation
- 🔌 **[scripts/PSQL-CONNECTION-GUIDE.md](./scripts/PSQL-CONNECTION-GUIDE.md)** - PostgreSQL connection guide
- 🌍 **[data/tiger/LOADING-INSTRUCTIONS.md](./data/tiger/LOADING-INSTRUCTIONS.md)** - Geographic data loading
- 📋 **[FULL-STACK-PLAN.md](./FULL-STACK-PLAN.md)** - Project architecture and plan

## Project Structure

```
Realestate/
├── web/                    # Next.js web application
│   ├── app/               # Next.js app router pages
│   ├── lib/               # Shared libraries and utilities
│   └── public/            # Static assets
├── scripts/               # Database and data processing scripts
│   ├── connect-supabase.sh   # Database connection script
│   └── migrations/        # Database migrations
├── data/                  # Data files
│   └── tiger/            # Census TIGER geographic data
└── redfin_downloads/     # Redfin data files
```

## Features

- 🏘️ Real estate market analytics
- 📊 Economic indicators integration (Census, FRED, BLS)
- 🗺️ Geographic data visualization with Mapbox
- 📈 Time-series data tracking
- 🔍 Advanced search and filtering

## Technology Stack

- **Frontend:** Next.js 14, React, TypeScript
- **Database:** Supabase (PostgreSQL with PostGIS)
- **Data Sources:** U.S. Census Bureau, FRED, BLS
- **Maps:** Mapbox GL JS
- **Styling:** Tailwind CSS

## Development

```bash
# Start development server
cd web
npm run dev
# Visit http://localhost:3000

# Run database operations
./scripts/connect-supabase.sh

# Load geographic data
npm run load-shapefiles
```

## Environment Variables

Required environment variables (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `SUPABASE_DB_PASSWORD` - Database password

Optional API keys for data ingestion:
- `CENSUS_API_KEY` - U.S. Census Bureau API
- `FRED_API_KEY` - Federal Reserve Economic Data
- `BLS_API_KEY` - Bureau of Labor Statistics
- `MAPBOX_ACCESS_TOKEN` - Mapbox mapping

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Test thoroughly
4. Commit: `git commit -m "Description of changes"`
5. Push: `git push origin feature/your-feature`
6. Create a pull request

## License

ISC

## Support

For setup issues, see:
- [CONNECTION-SETUP.md](./CONNECTION-SETUP.md#troubleshooting)
- [LOCAL-SETUP.md](./LOCAL-SETUP.md#troubleshooting)