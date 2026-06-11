# Environment Variables Reference

This document is the authoritative source for all environment variables required
to run PropertyIQ. Sections are grouped by service and deployment target.

**Rule:** Never commit real credentials. Use `.env.local` (gitignored) locally,
and Railway Variables for both backend and frontend (both services are on Railway).

---

## Backend (NestJS — Railway)

### Supabase

| Variable                    | Required | Description                                                      |
| --------------------------- | -------- | ---------------------------------------------------------------- |
| `SUPABASE_URL`              | ✅       | Project URL (e.g. `https://abc.supabase.co`)                     |
| `SUPABASE_SERVICE_KEY`      | ✅       | Service role key — bypasses RLS. Keep out of frontend.           |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅       | Alias for `SUPABASE_SERVICE_KEY` — some scripts expect this name |

### Anthropic / AI

| Variable            | Required    | Description                                                                      |
| ------------------- | ----------- | -------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | ✅          | Used by narrative generation                                                     |
| `AI_PROVIDER`       | ⚠️ Optional | `anthropic` (default) or `openai` — controls the AI model provider               |
| `AI_MODEL`          | ⚠️ Optional | Model override (e.g. `claude-sonnet-4-5`). See approved model table in AGENTS.md |
| `AI_BASE_URL`       | ⚠️ Optional | Custom base URL for AI API (for proxies/testing)                                 |
| `OPENAI_API_KEY`    | ⚠️ Optional | Only needed when `AI_PROVIDER=openai`                                            |
| `DEEPSEEK_API_KEY`  | ⚠️ Optional | Only needed when `AI_PROVIDER=deepseek`                                          |

### Redis

| Variable    | Required    | Description                                                                                                      |
| ----------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `REDIS_URL` | ⚠️ Optional | Full Redis connection URL (e.g. `redis://default:password@host:6379`). If absent, falls back to in-memory cache. |

### Data APIs

| Variable         | Required | Description                                             |
| ---------------- | -------- | ------------------------------------------------------- |
| `CENSUS_API_KEY` | ✅       | U.S. Census Bureau API — used in demographics ingestion |
| `FRED_API_KEY`   | ✅       | Federal Reserve Economic Data API                       |

### Billing

| Variable            | Required | Description                                        |
| ------------------- | -------- | -------------------------------------------------- |
| `STRIPE_SECRET_KEY` | ✅       | Stripe secret key (`sk_live_...` or `sk_test_...`) |

### Email

| Variable                         | Required    | Description                                             |
| -------------------------------- | ----------- | ------------------------------------------------------- |
| `RESEND_API_KEY`                 | ✅          | Resend.com API key for transactional email              |
| `RESEND_LEAD_MAGNET_AUDIENCE_ID` | ⚠️ Optional | Resend audience ID for lead magnet subscribers          |
| `RESEND_SEGMENT_ID`              | ⚠️ Optional | Resend segment ID for marketing segments                |
| `EMAIL_FROM`                     | ⚠️ Optional | From address override (default: `hello@propertyiq.app`) |

### GitHub Integration (data pipeline notifications)

| Variable       | Required    | Description                                                            |
| -------------- | ----------- | ---------------------------------------------------------------------- |
| `GITHUB_TOKEN` | ⚠️ Optional | PAT or Actions token — used by import scripts to create failure issues |
| `GITHUB_REPO`  | ⚠️ Optional | `owner/repo` format (e.g. `th309/Realestate`)                          |

### Observability

| Variable     | Required  | Description                            |
| ------------ | --------- | -------------------------------------- |
| `SENTRY_DSN` | ✅ (prod) | Sentry DSN for backend error reporting |

### Internal

| Variable           | Required    | Description                                                                                                             |
| ------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `PIPELINE_API_KEY` | ✅          | Shared secret used by import scripts to POST to `/api/health/pipeline-status`. Generate with `openssl rand -base64 32`. |
| `PORT`             | ⚠️ Optional | HTTP port (default: `3001`). Railway injects this automatically.                                                        |

---

## Frontend (Next.js — Railway)

Both frontend and backend are deployed as Docker containers on Railway.
All `NEXT_PUBLIC_*` variables are bundled into the client at build time by Next.js — set them in the **frontend Railway service's Variables tab**, never in the backend service.

### Supabase

| Variable                        | Required              | Description                                                           |
| ------------------------------- | --------------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✅                    | Same as backend `SUPABASE_URL`                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅                    | Supabase anon/public key — safe to expose                             |
| `SUPABASE_SERVICE_KEY`          | ✅ (server-side only) | Used in Next.js API routes / server components. Never in client code. |
| `SUPABASE_ANON_KEY`             | ⚠️ Optional           | Server-side alias for anon key                                        |

### API

| Variable              | Required         | Description                                               |
| --------------------- | ---------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | ✅               | Backend URL (e.g. `https://api.propertyiq.app`)           |
| `BACKEND_URL`         | ✅ (server-side) | Backend URL used in server-side Next.js fetches           |
| `NEXT_PUBLIC_APP_URL` | ✅               | Frontend canonical URL (e.g. `https://propertyiq.app`)    |
| `FRONTEND_URL`        | ⚠️ Optional      | Server-side canonical URL — mirrors `NEXT_PUBLIC_APP_URL` |

### Maps

| Variable                   | Required | Description                            |
| -------------------------- | -------- | -------------------------------------- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ✅       | Mapbox public token for the market map |

### Billing

| Variable                             | Required | Description                                             |
| ------------------------------------ | -------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅       | Stripe publishable key (`pk_live_...` or `pk_test_...`) |

### Observability

| Variable                        | Required    | Description                                                                    |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SENTRY_DSN`        | ✅ (prod)   | Sentry DSN for frontend error reporting (same project as backend, or separate) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ⚠️ Optional | Google Analytics 4 measurement ID (e.g. `G-XXXXXXXXXX`)                        |

### MCP Server

| Variable               | Required    | Description                                                                    |
| ---------------------- | ----------- | ------------------------------------------------------------------------------ |
| `MCP_BASE_URL`         | ⚠️ Optional | Base URL for the PropertyIQ MCP server (default: `https://mcp.propertyiq.app`) |
| `MCP_OAUTH_JWT_SECRET` | ⚠️ Optional | JWT secret for MCP OAuth — server-side only                                    |
| `PROPERTYIQ_API_KEY`   | ⚠️ Optional | Internal API key used by the MCP server                                        |
| `PROPERTYIQ_API_URL`   | ⚠️ Optional | Internal API URL used by the MCP server                                        |

### Internal

| Variable                   | Required    | Description                                    |
| -------------------------- | ----------- | ---------------------------------------------- |
| `NEXT_PUBLIC_DEVTOOLS_KEY` | ⚠️ Optional | Enable internal devtools (leave unset in prod) |

---

## GitHub Actions (CI / import workflows)

These are GitHub repository secrets set under `Settings > Secrets and variables > Actions`.

| Secret                               | Used by                  | Description                            |
| ------------------------------------ | ------------------------ | -------------------------------------- |
| `SUPABASE_URL`                       | All import workflows     | Supabase project URL                   |
| `SUPABASE_SERVICE_KEY`               | All import workflows     | Supabase service role key              |
| `NEXT_PUBLIC_SUPABASE_URL`           | `ci.yml`                 | Frontend build placeholder             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | `ci.yml`                 | Frontend build placeholder             |
| `NEXT_PUBLIC_API_URL`                | `ci.yml`                 | Frontend build placeholder             |
| `NEXT_PUBLIC_SENTRY_DSN`             | `ci.yml`                 | Optional — empty string is safe        |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `ci.yml`                 | Frontend build placeholder             |
| `NEXT_PUBLIC_MAPBOX_TOKEN`           | `ci.yml`                 | Frontend build placeholder             |
| `SLACK_WEBHOOK_URL`                  | Import failure workflows | Slack incoming webhook for alerts      |
| `PIPELINE_API_KEY`                   | Import scripts           | Same key as backend `PIPELINE_API_KEY` |

---

## Local Development

Create `packages/backend/.env.local` and `packages/frontend/.env.local` (both are gitignored).

**Minimum backend `.env.local`:**

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=sk-ant-...
CENSUS_API_KEY=your_census_key
FRED_API_KEY=your_fred_key
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
PIPELINE_API_KEY=any-random-string-for-local
SENTRY_DSN=          # leave empty locally — Sentry will no-op
PORT=3001
```

**Minimum frontend `.env.local`:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SENTRY_DSN=          # leave empty locally
```

---

## Staging vs Production

| Variable                             | Local                      | Staging         | Production    |
| ------------------------------------ | -------------------------- | --------------- | ------------- |
| `SUPABASE_URL`                       | local project              | staging project | prod project  |
| `STRIPE_SECRET_KEY`                  | `sk_test_...`              | `sk_test_...`   | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...`              | `pk_test_...`   | `pk_live_...` |
| `SENTRY_DSN`                         | empty                      | staging DSN     | prod DSN      |
| `ANTHROPIC_API_KEY`                  | personal key               | shared team key | prod key      |
| `REDIS_URL`                          | empty (in-memory fallback) | Railway Redis   | Railway Redis |
| `NODE_ENV`                           | `development`              | `staging`       | `production`  |
