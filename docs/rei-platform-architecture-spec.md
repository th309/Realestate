# Real Estate Investment Analysis Platform

A comprehensive real estate investment analysis platform that aggregates data from multiple authoritative sources (Zillow, Redfin, FRED, Census) and leverages AI to provide investment insights across multiple geographic levels.

## Features

### Core Features
- **Interactive Map Visualization**: Explore markets on a Mapbox-powered map with true choropleth state boundaries
- **Multi-Geographic Analysis**: View data at National, State, Metro, City, and ZIP code levels
- **Market Rankings**: Sortable tables showing top and bottom performing markets
- **Historical Trends**: 24 months of price, inventory, and economic indicator history
- **Data Export**: CSV and JSON export of market data

### AI-Powered Assessments
- **Property Valuation Predictions**: AI-generated value estimates with confidence intervals
- **Investment Risk Scoring**: Risk grades (A-F) with key factors and mitigations
- **Market Trend Analysis**: Market phase detection and 12-month forecasts
- **Rental Yield Forecasting**: Cap rates, cash flow projections, expense breakdowns
- **Neighborhood Appreciation Predictions**: Area scores with category breakdowns

### User Features
- **Watchlists**: Save and monitor properties of interest
- **Saved Searches**: Store search criteria with optional alerts
- **Usage Tracking**: Monitor AI assessments and export quotas

### Subscription Tiers
- **Free**: 5 AI assessments/month, 10 exports/month, 3 watchlists
- **Professional ($49/mo)**: Unlimited AI, exports, watchlists, premium features
- **Enterprise**: Custom pricing with API access

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Material UI (MUI) v5
- Mapbox GL JS for mapping
- TanStack Query (React Query) for server state
- Zustand for client state
- React Router v6
- Recharts for data visualization
- Vitest for unit testing
- Playwright for E2E testing

### Backend
- NestJS with TypeScript
- PostgreSQL with PostGIS and TimescaleDB
- Prisma ORM
- Redis for caching
- Passport.js with JWT authentication
- Swagger/OpenAPI documentation
- Stripe for payments

### Data Sources
- **FRED API**: Economic indicators (mortgage rates, unemployment, CPI)
- **Census API**: Demographics (population, income, education)
- **Redfin**: Market statistics (median price, inventory, days on market)
- **RapidAPI/Zillow**: Property listings

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Mapbox account (for map token)

### Quick Setup

```bash
# Clone and install
git clone <repository-url>
cd rei-platform
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys (see Environment Variables section)

# Start infrastructure and seed database
npm run setup
```

### Manual Installation

1. **Clone the repository**:
```bash
git clone <repository-url>
cd rei-platform
```

2. **Copy environment variables**:
```bash
cp .env.example .env
```

3. **Update `.env` with your API keys** (see [Environment Variables](#environment-variables))

4. **Install dependencies**:
```bash
npm install
```

5. **Start the infrastructure** (PostgreSQL, Redis):
```bash
docker-compose up -d postgres redis
```

6. **Run database migrations**:
```bash
npm run db:migrate
```

7. **Seed the database** (includes all 50 states, 30 metros, sample properties):
```bash
npm run db:seed
```

8. **Start the development servers**:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/api/docs

### Using Docker Compose (Full Stack)

```bash
# Start all services
docker-compose up

# Or in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## Project Structure

```
.
├── packages/
│   ├── frontend/                # React frontend application
│   │   ├── src/
│   │   │   ├── app/            # App setup, providers, routes
│   │   │   ├── features/       # Feature-based modules
│   │   │   │   ├── ai-insights/    # AI analysis components
│   │   │   │   ├── auth/           # Authentication
│   │   │   │   ├── dashboard/      # Dashboard components (unused)
│   │   │   │   ├── map/            # Map page and components
│   │   │   │   ├── markets/        # Market analysis pages
│   │   │   │   ├── properties/     # Property search/detail
│   │   │   │   ├── saved-searches/ # Saved searches feature
│   │   │   │   ├── subscription/   # Pricing and payments
│   │   │   │   └── watchlists/     # Watchlist management
│   │   │   ├── shared/         # Shared components and utilities
│   │   │   ├── lib/            # Library configurations
│   │   │   └── styles/         # Theme and global styles
│   │   ├── e2e/                # Playwright E2E tests
│   │   └── ...
│   └── backend/                # NestJS backend API
│       ├── src/
│       │   ├── ai/             # AI assessment endpoints
│       │   ├── alerts/         # Alert management
│       │   ├── auth/           # Authentication module
│       │   ├── cma/            # Comparative Market Analysis
│       │   ├── common/         # Shared utilities, guards, decorators
│       │   ├── data-ingestion/ # Data pipeline services
│       │   ├── markets/        # Market statistics
│       │   ├── notifications/  # Notification system
│       │   ├── payments/       # Stripe integration
│       │   ├── portfolios/     # Portfolio management
│       │   ├── properties/     # Property search and details
│       │   ├── reports/        # Report generation
│       │   ├── users/          # User management
│       │   └── watchlists/     # Watchlist management
│       └── prisma/             # Database schema and seeds
├── scripts/                    # Database init scripts
├── docker-compose.yml          # Docker orchestration
└── package.json                # Root workspace config
```

## Environment Variables

### Required Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for JWT access tokens (generate a secure random string) |
| `JWT_REFRESH_SECRET` | Secret for JWT refresh tokens |
| `MAPBOX_TOKEN` | Mapbox public access token |
| `VITE_MAPBOX_TOKEN` | Same Mapbox token (for frontend) |

### LLM Provider (choose one)

| Variable | Description |
|----------|-------------|
| `LLM_PROVIDER` | Active provider: `claude`, `openai`, or `gemini` |
| `ANTHROPIC_API_KEY` | Claude/Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_AI_API_KEY` | Google AI/Gemini API key |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_EXPIRATION` | Access token expiry | `15m` |
| `JWT_REFRESH_EXPIRATION` | Refresh token expiry | `7d` |
| `STRIPE_SECRET_KEY` | Stripe secret key (for payments) | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | - |
| `FRED_API_KEY` | FRED API key (economic data) | - |
| `CENSUS_API_KEY` | Census Bureau API key | - |
| `ZILLOW_API_KEY` | RapidAPI key for Zillow | - |
| `SENDGRID_API_KEY` | SendGrid key (for emails) | - |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |

### OAuth (optional)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth client secret |

## Available Scripts

### Development
```bash
npm run dev              # Start frontend and backend concurrently
npm run dev:frontend     # Start frontend only (http://localhost:3000)
npm run dev:backend      # Start backend only (http://localhost:3001)
```

### Build
```bash
npm run build            # Build all packages
npm run build:frontend   # Build frontend only
npm run build:backend    # Build backend only
```

### Database
```bash
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run database migrations
npm run db:push          # Push schema changes (dev only)
npm run db:seed          # Seed database with sample data
npm run db:studio        # Open Prisma Studio GUI
```

### Testing
```bash
npm run test             # Run all tests (Vitest)
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ui      # Run E2E tests with UI
npm run test:e2e:report  # Show E2E test report
npm run lint             # Run ESLint on all packages
npm run lint:fix         # Auto-fix lint issues
```

### Docker
```bash
npm run docker:up        # Start Docker services
npm run docker:down      # Stop Docker services
npm run docker:logs      # View Docker logs
```

### Utilities
```bash
npm run setup            # Full setup (install, docker, migrate, seed)
npm run clean            # Remove node_modules and dist folders
npm run geojson:download # Download GeoJSON boundary files
```

## API Documentation

### Interactive Documentation
- **Swagger UI**: http://localhost:3001/api/docs (when backend is running)

### API Endpoints Summary

#### Authentication (`/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout (requires auth) |
| GET | `/auth/me` | Get current user profile |

#### Markets (`/markets`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/markets/overview` | National market overview |
| GET | `/markets/states` | All states with statistics |
| GET | `/markets/heatmap` | Heat map data by metric |
| GET | `/markets/compare` | Compare multiple markets |
| GET | `/markets/:geoType/:geoId/summary` | Market summary |
| GET | `/markets/:geoType/:geoId/statistics` | Market statistics |
| GET | `/markets/:geoType/:geoId/trends` | Historical trends |
| GET | `/markets/:geoType/:geoId/demographics` | Demographics data |
| GET | `/markets/:geoType/:geoId/economic` | Economic indicators |
| GET | `/markets/:geoType/:geoId/export` | Export as JSON |
| GET | `/markets/:geoType/:geoId/export/csv` | Export as CSV |

#### Properties (`/properties`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/properties` | Search with filters |
| GET | `/properties/map` | Properties for map display |
| GET | `/properties/clusters` | Clustered properties |
| GET | `/properties/statistics` | Area statistics |
| GET | `/properties/:id` | Property details |
| GET | `/properties/:id/valuations` | Price history |
| GET | `/properties/:id/nearby` | Nearby properties |

#### AI Assessments (`/ai`) - Requires Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/property-valuation` | Property valuation |
| POST | `/ai/risk-assessment` | Risk assessment |
| POST | `/ai/rental-yield` | Rental yield analysis |
| POST | `/ai/market-trend` | Market trend analysis |
| POST | `/ai/neighborhood` | Neighborhood analysis |
| GET | `/ai/predictions/:id` | Get prediction by ID |
| GET | `/ai/predictions` | User's prediction history |

#### Watchlists (`/watchlists`) - Requires Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/watchlists` | Get all user watchlists |
| GET | `/watchlists/:id` | Get watchlist with properties |
| POST | `/watchlists` | Create watchlist |
| PUT | `/watchlists/:id` | Update watchlist |
| DELETE | `/watchlists/:id` | Delete watchlist |
| POST | `/watchlists/:id/properties` | Add property |
| DELETE | `/watchlists/:id/properties/:propertyId` | Remove property |

#### Subscriptions (`/users/subscription`) - Requires Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/subscription/plans` | Available plans |
| GET | `/users/subscription` | Current subscription |
| GET | `/users/usage` | Usage statistics |
| POST | `/users/subscription/checkout` | Create Stripe checkout |
| POST | `/users/subscription/portal` | Stripe customer portal |
| POST | `/users/subscription/update` | Change plan |
| DELETE | `/users/subscription` | Cancel subscription |
| POST | `/users/subscription/reactivate` | Reactivate |

#### Data Ingestion (`/data-ingestion`) - Admin Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/data-ingestion/status` | Pipeline status |
| POST | `/data-ingestion/refresh-all` | Trigger full refresh |
| GET | `/data-ingestion/fred/indicators` | List FRED indicators |
| POST | `/data-ingestion/fred/fetch` | Fetch FRED data |
| POST | `/data-ingestion/census/fetch/states` | Fetch state demographics |
| POST | `/data-ingestion/redfin/fetch/all` | Fetch Redfin data |
| POST | `/data-ingestion/aggregation/run` | Run aggregation |

## Testing

### Unit Tests
```bash
# Run frontend unit tests
npm run test -w @rei/frontend

# Run with coverage
npm run test -w @rei/frontend -- --coverage
```

### E2E Tests
```bash
# Install Playwright browsers first
npx playwright install

# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```

### Test Coverage
- **Unit Tests**: 48 tests covering ErrorBoundary, ErrorMessage, MarketStatsCard, useFeatureGating
- **E2E Tests**: Navigation, property search, and accessibility tests

## Accessibility

The application follows WCAG 2.1 guidelines:
- Skip link for keyboard navigation
- Proper landmark roles (main, navigation)
- ARIA labels on interactive elements
- Focus management in modals
- Color contrast compliant (MUI default theme)
- Form labels properly associated

## Known Limitations

1. **Data Freshness**: Seed data is static; live data requires API keys for FRED, Census, Redfin
2. **AI Assessments**: Require LLM API key (Claude, OpenAI, or Gemini)
3. **Payments**: Require Stripe keys for subscription features
4. **Map Features**: Require valid Mapbox token
5. **Email Alerts**: Require SendGrid API key

## Troubleshooting

### Database Connection Issues
```bash
# Ensure PostgreSQL is running
docker-compose up -d postgres

# Check connection
docker-compose logs postgres
```

### Missing Mapbox Token
If the map doesn't load, verify `VITE_MAPBOX_TOKEN` is set in `.env`

### AI Assessments Failing
1. Check that `LLM_PROVIDER` matches your available API key
2. Verify the API key is valid and has credits
3. Check backend logs for detailed error messages

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Private - All rights reserved
