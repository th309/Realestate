# PropertyIQ Analytics

FastAPI microservice for ML scoring and backtesting in the PropertyIQ real estate analytics platform.

## Overview

This service provides:
- **HomeReady Scoring**: Evaluates locations for homebuyer suitability
- **InvestorEdge Scoring**: Analyzes investment potential with ROI projections
- **Backtesting**: Validates scoring model accuracy against historical data

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/score/homeready` | Calculate HomeReady score |
| POST | `/api/v1/score/investor-edge` | Calculate InvestorEdge score |
| POST | `/api/v1/backtest/run` | Run backtest analysis |

## Local Development

### Prerequisites
- Python 3.11+
- pip

### Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your settings

# Run development server
uvicorn app.main:app --reload --port 8000
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 8000 | Server port |
| `DEBUG` | No | false | Enable debug mode |
| `SUPABASE_URL` | Yes | - | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | - | Supabase service key |
| `ALLOWED_ORIGINS` | No | localhost | Comma-separated CORS origins |

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Example Requests

### HomeReady Score

```bash
curl -X POST http://localhost:8000/api/v1/score/homeready \
  -H "Content-Type: application/json" \
  -d '{
    "property_data": {
      "zip_code": "90210",
      "state": "CA",
      "median_price": 1500000,
      "price_yoy_change": 5.2,
      "days_on_market": 45,
      "median_income": 125000,
      "unemployment_rate": 3.2
    },
    "affordability_index": 85,
    "price_to_income_ratio": 12
  }'
```

### InvestorEdge Score

```bash
curl -X POST http://localhost:8000/api/v1/score/investor-edge \
  -H "Content-Type: application/json" \
  -d '{
    "property_data": {
      "zip_code": "78701",
      "state": "TX",
      "median_price": 450000,
      "price_yoy_change": 8.5,
      "median_income": 75000,
      "unemployment_rate": 2.8
    },
    "median_rent": 2200,
    "rent_yoy_change": 6.2,
    "cap_rate": 5.8,
    "gross_yield": 5.9,
    "vacancy_rate": 4.2
  }'
```

### Run Backtest

```bash
curl -X POST http://localhost:8000/api/v1/backtest/run \
  -H "Content-Type: application/json" \
  -d '{
    "score_type": "investor-edge",
    "start_date": "2022-01-01",
    "end_date": "2024-01-01",
    "states": ["TX", "FL"],
    "holding_period_months": 12,
    "score_threshold": 70
  }'
```

## Deployment

### Railway

This service is designed to deploy on Railway:

1. Create new service in Railway project
2. Connect to repo with path `packages/propertyiq-analytics`
3. Railway will auto-detect Dockerfile
4. Set environment variables in Railway dashboard
5. Deploy

### Docker

```bash
# Build
docker build -t propertyiq-analytics .

# Run
docker run -p 8000:8000 \
  -e SUPABASE_URL=your-url \
  -e SUPABASE_SERVICE_KEY=your-key \
  propertyiq-analytics
```

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌──────────┐
│  NestJS Backend │────>│ PropertyIQ Analytics │────>│ Supabase │
│   (port 3001)   │     │     (port 8000)      │     │    DB    │
└─────────────────┘     └──────────────────────┘     └──────────┘
```

The NestJS backend calls this service for:
- Scoring calculations (when user requests property scores)
- Backtesting (admin ML workflow)

## Future Enhancements

- [ ] Migrate actual ML models from existing code
- [ ] Add caching layer (Redis)
- [ ] Batch scoring endpoint
- [ ] Real-time model retraining triggers
- [ ] A/B testing for scoring algorithms
