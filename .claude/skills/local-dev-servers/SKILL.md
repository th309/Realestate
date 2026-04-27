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

## Restart Rule (CRITICAL)

**There must be exactly one frontend and one backend running at any time.** When the user says "restart", that means: kill what was running before, then start a single instance. No zombies, no parallel process trees.

`TaskStop <task_id>` on a `dev:fresh` background task is **NOT a restart**. It kills only the `concurrently` orchestrator — the spawned `next dev` and `nest start --watch` child node processes survive and keep listening on 3000/3001. The next `dev:fresh` then dies with `EADDRINUSE` and Next.js's "Unable to acquire lock at .next/dev/lock", but `curl` still returns 200 against the orphans, faking success. Witnessed and corrected 2026-04-26.

### Restart Workflow (mandatory when user says "restart")

1. **Kill all node processes via PowerShell** — the only reliable way on Windows:
   ```powershell
   Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
   ```
   Use the PowerShell tool, NOT `taskkill //IM node.exe //F` in bash — the bash version has been observed to time out on this codebase. PowerShell node-kill also disconnects MCP servers running under node; they reconnect on next use.

2. **Confirm ports are free** before starting anything new:
   ```bash
   curl -s -o /dev/null -w "Frontend: %{http_code}\n" http://localhost:3000
   curl -s -o /dev/null -w "Backend: %{http_code}\n" http://localhost:3001/api/docs
   ```
   Both must return `000` (no listener). A `200` means orphans are still alive — re-run the kill until they're gone.

3. **Start ONE `dev:fresh`** in background:
   ```bash
   cd D:/projects/rei-platform && npm run dev:fresh
   ```
   Run with `run_in_background: true`.

4. **Verify single instance per port** after boot:
   ```bash
   netstat -ano 2>/dev/null | grep -E ':3000 |:3001 ' | grep LISTENING
   ```
   Exactly one PID per port is required. The total `node.exe` count of ~10–11 is expected and not a problem (npm wrappers + concurrently + next-dev + webpack workers + nest-start + tsc-watch + MCP servers); only the **listener count per port** matters.

## Startup Procedure

### Recommended: Fresh Start with Crash Recovery

Starts Redis Docker container, clears ports, kills stale processes, starts all servers, auto-restarts on crash (5 retries, 3s delay):

```bash
cd D:/projects/rei-platform && npm run dev:fresh
```

Run with `run_in_background: true` — this is a long-running process.

The script automatically:

1. Starts or reuses the `rei-redis` Docker container on port 6379 (Redis is **optional** locally — backend runs fine without it; cache layers degrade gracefully)
2. Exports `REDIS_URL=redis://localhost:6379` for the backend
3. Clears ports 3000 and 3001
4. **Wipes `packages/backend/dist/` and `*.tsbuildinfo`** so `nest start --watch` can't serve stale compiled code on restart (fix added 2026-04-26 — `nest-cli.json`'s `deleteOutDir: true` only fires on `nest build`, not `nest start --watch`, so without this step `incremental: true` + a stale tsbuildinfo could skip emit and run yesterday's code)
5. Starts backend and frontend with concurrently
6. Streams Redis logs alongside backend/frontend output

### Manual: Restart a Single Server

Use only when you know the other server is healthy and you want to bounce one process — not a full "restart" per the rule above.

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

Use when ports refuse to free, zombie processes persist, or as step 1 of the **Restart Workflow** above. PowerShell is preferred over bash `taskkill`:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

Then re-run `npm run dev:fresh`.

### Verify Servers Are Running

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null && echo " Frontend OK" || echo " Frontend DOWN"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/docs 2>/dev/null && echo " Backend OK" || echo " Backend DOWN"
docker exec rei-redis redis-cli ping 2>/dev/null && echo " Redis OK" || echo " Redis DOWN (informational locally — backend runs without it)"
```

**Caution:** A `200` response only proves *something* is listening on that port — it does not prove that the listener is the `dev:fresh` you just started. After a restart, also run the netstat check from the Restart Workflow to confirm the listener PID belongs to the new tree.

## Crash Recovery Is Built In — Do NOT Layer External Monitors

`npm run dev:fresh` already runs both servers under `concurrently --restart-tries 5 --restart-after 3000`, which restarts a crashed server up to 5 times with a 3s backoff. **Do NOT wrap it in an external `while true` curl-loop monitor that calls `taskkill` + `nohup npm run start:dev`.**

The two recovery paths race each other on cold start: the curl probe sees a non-200 during boot, kills the still-starting PID, and spawns a parallel `nohup npm` process while `concurrently` is also retrying — producing zombie node trees, double-bound ports, and EADDRINUSE storms. Real-world incident: ~120 zombie node processes + 18 orphaned `nest.js start --watch` pairs in one ~65-min editing session.

**Rules:**
- NEVER write a `while true; do curl … taskkill … nohup npm … & done` loop on top of `dev:fresh`. Period.
- NEVER use `TaskStop <task_id>` alone as a restart — see the **Restart Rule** section. It only kills `concurrently` and orphans the children.
- To check liveness on demand, run the one-shot **Verify Servers Are Running** block above — single execution, no loop.
- If a server actually wedges past `concurrently`'s 5 retries, restart it once with the **Manual: Restart a Single Server** block — single execution, no loop.
- If `concurrently` itself has died, use the **Nuclear Option** (PowerShell), then re-run `dev:fresh`.

**When servers seem flaky:** read the `dev:fresh` background output first — concurrently logs each retry attempt and the failure reason. The actual crash is usually a TS compile error or port conflict, not something a polling loop can fix.

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
| "Port already in use" / EADDRINUSE      | Use the **Restart Workflow** (PowerShell node-kill → confirm 000 → `dev:fresh`); orphans from a prior `TaskStop` are the usual cause |
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
