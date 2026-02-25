---
name: railway-deploy
description: Deploy to Railway with pre-flight checks (build, lint, test). Use when the user says deploy, push to production, go live, or ship it.
disable-model-invocation: true
---

# Railway Deploy

Deploy the PropertyIQ platform to Railway with pre-flight validation.

## Deployment Targets

| Package        | Railway Service      | URL                                      |
| -------------- | -------------------- | ---------------------------------------- |
| Frontend (web) | propertyiq           | propertyiq.up.railway.app                |
| Backend        | backend-production   | backend-production-ee4d.up.railway.app   |
| Analytics      | analytics-production | analytics-production-af35.up.railway.app |

## Pre-Flight Checks

Run ALL checks before deploying. Abort if any fail.

### 1. Git Status

```bash
git status
```

- Ensure working tree is clean (all changes committed)
- Confirm you're on the correct branch

### 2. Build Check

```bash
# For frontend
npm run build:frontend

# For backend
npm run build:backend

# Or both
npm run build
```

### 3. Lint Check

```bash
npm run lint
```

### 4. Test Check

```bash
# Backend tests
npm run test

# Frontend unit tests (if applicable)
npm run test:frontend
```

### 5. Environment Variable Reminder

- **IMPORTANT:** Code changes do NOT affect production env vars
- Production/staging variables must be updated in the **Railway dashboard**
- Verify any new env vars have been added to Railway before deploying

## Deploy

After all checks pass:

```bash
# Deploy specific service
railway up --service <service-name>

# Or deploy from Railway dashboard for more control
```

## Post-Deploy Verification

1. Check Railway deployment logs:

   ```bash
   railway logs --service <service-name>
   ```

2. Verify the deployment is healthy by hitting the health endpoint:

   ```bash
   curl https://backend-production-ee4d.up.railway.app/health
   ```

3. Spot-check key pages:
   - Homepage: https://propertyiq.up.railway.app
   - Map: https://propertyiq.up.railway.app/map
   - API: https://backend-production-ee4d.up.railway.app/api

## Rollback

If issues are found after deploy:

```bash
# Railway supports instant rollback from the dashboard
# Or redeploy a previous commit
railway up --commit <previous-commit-hash>
```
