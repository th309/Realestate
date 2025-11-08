# Local Development Setup

## Project Location
`C:\Projects\Real Estate`

## Git Repository
- **Remote:** https://github.com/th309/Realestate
- **Branch:** main
- **Status:** Synced ✓

## Local Environment Variables

Create `.env.local` file with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# API Keys
CENSUS_API_KEY=your_census_key
FRED_API_KEY=your_fred_key
BLS_API_KEY=your_bls_key
MAPBOX_ACCESS_TOKEN=your_mapbox_token

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_key
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# OpenAI
OPENAI_API_KEY=your_openai_key

# Anthropic (for Phase 2)
ANTHROPIC_API_KEY=your_anthropic_key

# Admin
ADMIN_EMAIL=your_admin_email
```

## Local Development Notes

### Database Connection
- Supabase project: [Add your project name]
- Database URL: [Add connection string]

### Local Testing
- Test markets: 10 sample markets loaded
- Test user: [Add test credentials]

### Current Phase
- **Phase:** Not started yet
- **Next Step:** Phase 1.1 - Project Setup

## Useful Commands

```bash
# Start development
npm run dev

# Check git status
git status

# Pull latest changes
git pull origin main

# Push changes
git add .
git commit -m "Your message"
git push origin main
```

## Local File Paths
- Project root: `C:\Projects\Real Estate`
- Web app: `C:\Projects\Real Estate\web` (to be created)
- Database scripts: `C:\Projects\Real Estate\scripts` (to be created)

---
*Last updated: [Date]*

