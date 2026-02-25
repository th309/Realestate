---
name: local-dev-servers
description: Use when starting, restarting, or troubleshooting local development servers, when ports 3000 or 3001 are blocked or unresponsive, or after .env/config/dependency changes that require a server restart
---

# Local Dev Server Management

Manages frontend (Next.js, port 3000) and backend (NestJS, port 3001) lifecycle on Windows. Handles port conflicts, process cleanup, and crash recovery automatically.

## When to Use

- User says "start servers", "restart", "dev servers", "spin up local", "start dev"
- User reports frontend or backend is down, unresponsive, or erroring
- Port 3000 or 3001 is blocked or in-use
- After changes to `.env`, `package.json`, `next.config.mjs`, `nest-cli.json`, or `tsconfig.json`
- After installing or removing dependencies

## Quick Reference

| Service | Port | Start Command | Watch Mode |
|---------|------|--------------|------------|
| Frontend (Next.js) | 3000 | `npm run dev -w web` | Built-in webpack HMR |
| Backend (NestJS) | 3001 | `npm run start:dev -w backend` | `nest start --watch` |
| Both | 3000+3001 | `npm run dev` (root) | Both watched |
| Both (fresh + crash recovery) | 3000+3001 | `npm run dev:fresh` | Clears ports, auto-restarts |

## Startup Procedure

### Recommended: Fresh Start with Crash Recovery

Clears ports, kills stale processes, starts both servers, auto-restarts on crash (5 retries, 3s delay):

```bash
cd D:/projects/rei-platform && npm run dev:fresh
```

Run with `run_in_background: true` — this is a long-running process.

### Manual: Restart a Single Server

**Clear one port and restart:**

```bash
# Backend only
for pid in $(netstat -ano 2>/dev/null | grep ':3001 ' | grep LISTENING | awk '{print $5}' | sort -u); do
  [ -n "$pid" ] && [ "$pid" != "0" ] && taskkill //PID "$pid" //F 2>/dev/null
done
sleep 1 && cd D:/projects/rei-platform && npm run start:dev -w backend

# Frontend only
for pid in $(netstat -ano 2>/dev/null | grep ':3000 ' | grep LISTENING | awk '{print $5}' | sort -u); do
  [ -n "$pid" ] && [ "$pid" != "0" ] && taskkill //PID "$pid" //F 2>/dev/null
done
sleep 1 && cd D:/projects/rei-platform && npm run dev -w web
```

### Nuclear Option (kills ALL node processes)

Use when ports refuse to free or zombie processes persist:

```bash
taskkill //IM node.exe //F 2>/dev/null; sleep 2; cd D:/projects/rei-platform && npm run dev:fresh
```

### Verify Servers Are Running

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null && echo " Frontend OK" || echo " Frontend DOWN"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/docs 2>/dev/null && echo " Backend OK" || echo " Backend DOWN"
```

## When Restart Is Needed

| Change Type | Auto-Reloads? | Action |
|-------------|---------------|--------|
| Component/page/service code | Yes (HMR/watch) | None |
| Middleware, new NestJS module | Yes (watch) | None |
| `.env` / `.env.local` | **No** | Full restart |
| `package.json` (deps change) | **No** | `npm install` then restart |
| `next.config.mjs` | **No** | Restart frontend |
| `nest-cli.json` / `tsconfig.json` | **No** | Restart backend |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Port already in use" / EADDRINUSE | Run `npm run dev:fresh` (clears ports first) |
| Backend on wrong port (3005) | Check `packages/backend/.env` has `PORT=3001` |
| Frontend can't reach backend | Verify `NEXT_PUBLIC_API_URL=http://localhost:3001` in frontend `.env.local` |
| Server crashes immediately | Check compile: `npm run build -w backend` or `npm run build -w web` |
| Zombie processes after Ctrl+C | `taskkill //IM node.exe //F` then restart |

## Port Config Files

| File | Key | Value |
|------|-----|-------|
| `packages/frontend/.env.local` | `PORT` | `3000` |
| `packages/frontend/.env.local` | `NEXT_PUBLIC_API_URL` | `http://localhost:3001` |
| `packages/backend/.env` | `PORT` | `3001` |
| `packages/backend/src/main.ts` | fallback | `process.env.PORT \|\| 3001` |
