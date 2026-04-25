---
name: local-dev-servers
description: Use when starting, restarting, monitoring, or troubleshooting local development servers, when ports 3000 or 3001 are blocked or unresponsive, or after .env/config/dependency changes that require a server restart
---

# Local Dev Server Management

Manages Redis (Docker, port 6379), frontend (Next.js, port 3000), and backend (NestJS, port 3001) lifecycle on Windows. Handles port conflicts, process cleanup, Redis container management, and crash recovery automatically.

## When to Use

- User says "start servers", "restart", "dev servers", "spin up local", "start dev"
- User reports frontend or backend is down, unresponsive, or erroring
- Port 3000, 3001, or 6379 is blocked or in-use
- After changes to `.env`, `package.json`, `next.config.mjs`, `nest-cli.json`, or `tsconfig.json`
- After installing or removing dependencies

## Quick Reference

| Service                            | Port           | Start Command                  | Watch Mode                                |
| ---------------------------------- | -------------- | ------------------------------ | ----------------------------------------- |
| Redis (Docker)                     | 6379           | Auto-started by `dev:fresh`    | Docker container `rei-redis`              |
| Frontend (Next.js)                 | 3000           | `npm run dev -w web`           | Built-in webpack HMR                      |
| Backend (NestJS)                   | 3001           | `npm run start:dev -w backend` | `nest start --watch`                      |
| All three (fresh + crash recovery) | 6379+3000+3001 | `npm run dev:fresh`            | Clears ports, starts Redis, auto-restarts |

## Startup Procedure

### Recommended: Fresh Start with Crash Recovery

Starts Redis Docker container, clears ports, kills stale processes, starts all servers, auto-restarts on crash (5 retries, 3s delay):

```bash
cd D:/projects/rei-platform && npm run dev:fresh
```

Run with `run_in_background: true` — this is a long-running process.

The script automatically:

1. Starts or reuses the `rei-redis` Docker container on port 6379
2. Exports `REDIS_URL=redis://localhost:6379` for the backend
3. Clears ports 3000 and 3001
4. Starts backend and frontend with concurrently
5. Streams Redis logs alongside backend/frontend output

### Manual: Restart a Single Server

**Clear one port and restart:**

```bash
# Backend only
for pid in $(netstat -ano 2>/dev/null | grep ':3001 ' | grep LISTENING | awk '{print $5}' | sort -u); do
  [ -n "$pid" ] && [ "$pid" != "0" ] && taskkill //PID "$pid" //F 2>/dev/null
done
sleep 1 && cd D:/projects/rei-platform && REDIS_URL=redis://localhost:6379 npm run start:dev -w backend

# Frontend only
for pid in $(netstat -ano 2>/dev/null | grep ':3000 ' | grep LISTENING | awk '{print $5}' | sort -u); do
  [ -n "$pid" ] && [ "$pid" != "0" ] && taskkill //PID "$pid" //F 2>/dev/null
done
sleep 1 && cd D:/projects/rei-platform && npm run dev -w web

# Redis only
docker restart rei-redis
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
docker exec rei-redis redis-cli ping 2>/dev/null && echo " Redis OK" || echo " Redis DOWN"
```

## Continuous Monitoring (Keep Servers Alive)

**Always start monitoring after launching servers.** This polls both servers every 15 seconds and auto-restarts any that go down.

After starting servers (via `dev:fresh`, manual start, or single server), launch this monitor in the background:

```bash
# Run with run_in_background: true
while true; do
  fe=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  be=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/docs 2>/dev/null)
  ts=$(date +"%H:%M:%S")

  if [ "$fe" = "200" ] && [ "$be" = "200" ]; then
    echo "[$ts] OK | Frontend:3000=UP | Backend:3001=UP"
  else
    if [ "$fe" != "200" ]; then
      echo "[$ts] ALERT | Frontend:3000=DOWN (HTTP $fe) - RESTARTING..."
      for pid in $(netstat -ano 2>/dev/null | grep ':3000 ' | grep LISTENING | awk '{print $5}' | sort -u); do
        [ -n "$pid" ] && [ "$pid" != "0" ] && taskkill //PID "$pid" //F 2>/dev/null
      done
      cd D:/projects/rei-platform && nohup npm run dev -w web > /dev/null 2>&1 &
      echo "[$ts] Frontend restart triggered"
    fi
    if [ "$be" != "200" ]; then
      echo "[$ts] ALERT | Backend:3001=DOWN (HTTP $be) - RESTARTING..."
      for pid in $(netstat -ano 2>/dev/null | grep ':3001 ' | grep LISTENING | awk '{print $5}' | sort -u); do
        [ -n "$pid" ] && [ "$pid" != "0" ] && taskkill //PID "$pid" //F 2>/dev/null
      done
      cd D:/projects/rei-platform && nohup npm run start:dev -w backend > /dev/null 2>&1 &
      echo "[$ts] Backend restart triggered"
    fi
  fi

  sleep 15
done
```

**Usage notes:**
- Launch with `run_in_background: true` — this is a long-running loop
- Wait ~15s after initial server start before launching the monitor (give servers time to boot)
- The monitor clears the port before restarting to avoid EADDRINUSE
- Check monitor output with `tail` on the output file to see recent status

**When to use monitoring:**
- User says "start servers", "keep servers up", "monitor servers"
- After any server start — always attach monitoring automatically
- User reports intermittent crashes or flaky dev environment

## When Restart Is Needed

| Change Type                       | Auto-Reloads?   | Action                     |
| --------------------------------- | --------------- | -------------------------- |
| Component/page/service code       | Yes (HMR/watch) | None                       |
| Middleware, new NestJS module     | Yes (watch)     | None                       |
| `.env` / `.env.local`             | **No**          | Full restart               |
| `package.json` (deps change)      | **No**          | `npm install` then restart |
| `next.config.mjs`                 | **No**          | Restart frontend           |
| `nest-cli.json` / `tsconfig.json` | **No**          | Restart backend            |

## Troubleshooting

| Symptom                                 | Fix                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| "Port already in use" / EADDRINUSE      | Run `npm run dev:fresh` (clears ports first)                                                        |
| Backend on wrong port (3005)            | Check `packages/backend/.env` has `PORT=3001`                                                       |
| Frontend can't reach backend            | Verify `NEXT_PUBLIC_API_URL=http://localhost:3001` in frontend `.env.local`                         |
| Server crashes immediately              | Check compile: `npm run build -w backend` or `npm run build -w web`                                 |
| Zombie processes after Ctrl+C           | `taskkill //IM node.exe //F` then restart                                                           |
| Redis not connecting                    | `docker logs rei-redis` to check container health                                                   |
| Redis container missing                 | `docker run -d --name rei-redis -p 6379:6379 --restart unless-stopped redis:7-alpine`               |
| Backend logs "REDIS_URL not configured" | Restart via `dev:fresh` (auto-sets REDIS_URL) or manually export `REDIS_URL=redis://localhost:6379` |

## Port Config Files

| File                           | Key                   | Value                         |
| ------------------------------ | --------------------- | ----------------------------- |
| `packages/frontend/.env.local` | `PORT`                | `3000`                        |
| `packages/frontend/.env.local` | `NEXT_PUBLIC_API_URL` | `http://localhost:3001`       |
| `packages/backend/.env`        | `PORT`                | `3001`                        |
| `packages/backend/.env`        | `REDIS_URL`           | Set at runtime by `dev:fresh` |
| `packages/backend/src/main.ts` | fallback              | `process.env.PORT \|\| 3001`  |
