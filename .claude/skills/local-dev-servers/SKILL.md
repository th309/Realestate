---
name: local-dev-servers
description: Use when starting, restarting, monitoring, or troubleshooting local development servers (frontend :3000, backend :3001, Redis :6379); when ports are blocked, a server is unresponsive, wedged, or returns 500 / "Internal Server Error", a page won't render, or after .env/config/dependency changes that require a restart
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
5. **Wipes `packages/frontend/.next`** for a clean client bundle — this is also what clears a `.next` polluted by a stray `next build` (see **Frontend 500**). NOTE: the wipe can silently fail if an orphaned node worker still holds a handle, which is why the **Restart Workflow always kills node first**
6. Starts backend and frontend (plus the video-template `tsc --watch`) with concurrently
7. Streams Redis logs alongside backend/frontend output

### Manual: Restart a Single Server

Use only when you know the other server is healthy and you want to bounce one process — not a full "restart" per the rule above.

> ⚠️ **Surgical backend restart is unreliable under `dev:fresh`.** Killing just the 3001 listener PID does NOT trigger `concurrently`'s `--restart-tries`, because `nest start --watch` keeps its wrapper alive and silently respawns `dist/main` (often on a new PID). Under `dev:fresh`, "restart the backend" means a **full nuclear restart**, not a single-PID kill. The single-server blocks below are for when you started a server standalone (not via `dev:fresh`).

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

## Health-Check Semantics — a status code is not health

A port being open, a status code, and a rendered page are three different facts. Check the right one:

- **`000` on a live listener = wedged.** If `netstat` shows the port `LISTENING` but `curl` returns `000` even after 30–45s, the process is **wedged** (accepts the socket, never answers) — distinct from dead (no listener at all → `000` instantly) and from compiling (slow but eventually answers). A wedged `next dev` does not recover on its own → nuclear-kill node + `dev:fresh`.
- **`200` ≠ rendered.** A real page is large — frontend `/` and `/map` are ~90–150 KB. A `500` "Internal Server Error" body is ~21 bytes. Check the body size with `curl -s -o /dev/null -w '%{http_code} %{size_download}b'`, and for UI fixes open the actual page in a browser. After any fix, re-hit the route **3–5× over ~20s to confirm it holds** — the first `200` can be a pre-failure compile (see next section).
- **Backend up + frontend down = asymmetric orphan.** After a kill / `TaskStop` / reap, `nest start --watch` resurrects its backend child (3001 stays `200`) but `next dev` dies (3000 → `000`). Do NOT just start the frontend onto a half-alive tree — nuclear-kill **all** node first, then one `dev:fresh`.

## Frontend 500 "Internal Server Error" — a `next build` clobbered `.next`

> **MOSTLY OBSOLETE since 2026-06-27.** `next dev` now writes to `.next-dev` (NODE_ENV branch in `packages/frontend/next.config.mjs`); a default `next build` writes `.next` and can no longer clobber the running dev server. This section applies only if that isolation is reverted, or if someone builds with `NEXT_DIST_DIR=.next-dev` (the `guard-bash.js` hook DENIES that). The dev dir to wipe is now `.next-dev`.

**Symptom:** every frontend route returns HTTP 500 with a 21-byte "Internal Server Error" body; the `dev:fresh` log repeats:

```
Error: ENOENT: no such file or directory, open '…\packages\frontend\.next\dev\routes-manifest.json'
```

**Cause:** `packages/frontend/next.config` uses `distDir: process.env.NEXT_DIST_DIR || '.next'`, so `next build` writes to **`.next`** — the same directory `next dev` uses. Running a production build while the dev server is live replaces the dev layout with a production tree (`BUILD_ID`, `export-marker.json`, `*.nft.json`, root `routes-manifest.json`) and removes `.next/dev/routes-manifest.json`. The dev server stays up but 500s on every route. Tell-tale: `.next/dev/` is missing `routes-manifest.json` while `.next/` root has fresh production artifacts timestamped **after** the dev server booted.

**Fix:**

1. `Get-Process node | Stop-Process -Force` (PowerShell)
2. `rm -rf packages/frontend/.next-dev` (the dev dir; `.next` is the build dir now)
3. `npm run dev:fresh` (regenerates a clean `.next-dev/dev/`)
4. Verify `/map` returns 200 across **repeated** hits — a single 200 may be the pre-clobber compile.

**Prevent:** as of 2026-06-27 this is structural — `next dev` uses `.next-dev`, builds use `.next`, so they no longer collide (see `next.config.mjs`). A throwaway verification build can still use an isolated dir: `NEXT_DIST_DIR=.next-verify npm run build -w web`. Never build with `NEXT_DIST_DIR=.next-dev` (it would clobber dev; the guard hook blocks it).

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

**In-session task vs dedicated terminal (persistence):** a `dev:fresh` started as an agent `run_in_background` task is tied to the agent/session lifecycle and can be terminated when that task is reaped — the **whole `concurrently` tree** dies at once, abruptly, mid-request, with **no app error and no `concurrently` teardown** in the log (the log just ends mid-line). Distinguish reap vs crash: a crash logs a stack trace or `concurrently`'s `--> Sending SIGTERM to other processes`; a reap leaves the log ending cleanly mid-line. If the servers must survive long idle gaps, have the **user run `npm run dev:fresh` in their own terminal window** — that is decoupled from the agent and immune to anything on the agent side. Verify from the agent with the one-shot health block; don't relaunch in a loop.

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

| Symptom | Fix |
| --- | --- |
| "Port already in use" / EADDRINUSE | Restart Workflow (PowerShell node-kill → confirm 000 → `dev:fresh`); orphans from a prior `TaskStop` are the usual cause |
| Frontend 500 / "Internal Server Error" on every route; log shows `ENOENT … .next-dev/dev/routes-manifest.json` | Rare since dev moved to `.next-dev` (2026-06-27). Means the next.config isolation was reverted or a build targeted `.next-dev`. Fix: kill node → `rm -rf packages/frontend/.next-dev` → `dev:fresh` |
| Frontend port LISTENING but `curl` returns `000` (even after 45s) | Wedged `next dev` — not dead, not compiling. Nuclear restart. See **Health-Check Semantics** |
| Backend up (3001→200) but frontend gone (3000→000) after a kill/`TaskStop` | Asymmetric orphan — `nest --watch` resurrected the backend, `next dev` died. Nuclear-kill ALL node, then `dev:fresh`. Don't just start the frontend |
| SSR shows new code but browser DOM is stale | Orphaned webpack workers locked `.next`. `Get-Process node \| Stop-Process -Force` (PowerShell) then `dev:fresh` (wipes `.next`) |
| Backend on wrong port (3005) | Check `packages/backend/.env` has `PORT=3001` |
| Frontend can't reach backend | Verify `NEXT_PUBLIC_API_URL=http://localhost:3001` in frontend `.env.local` |
| Backend won't start / `npm install` hangs / `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | Norton intercepts node TLS. Ensure `NODE_OPTIONS=--use-system-ca` is set (Windows User env); `dev:fresh`'s backend already passes it via cross-env |
| Server crashes immediately on boot | Read the `dev:fresh` background log for the TS compile error. Do NOT run `npm run build -w web` to "check" — it clobbers the dev `.next` (see Frontend 500). For a standalone build use `NEXT_DIST_DIR=.next-verify`. Backend-only standalone check: `npm run build -w backend` |
| Zombie processes after Ctrl+C | `Get-Process node \| Stop-Process -Force` (PowerShell) then restart |
| Redis not connecting | `docker logs rei-redis` to check container health |
| Redis container missing | `docker run -d --name rei-redis -p 6379:6379 --restart unless-stopped redis:7-alpine` |
| Backend logs "REDIS_URL not configured" | Restart via `dev:fresh` (auto-sets REDIS_URL) or export `REDIS_URL=redis://localhost:6379` |

## Port Config Files

| File                           | Key                   | Value                         |
| ------------------------------ | --------------------- | ----------------------------- |
| `packages/frontend/.env.local` | `PORT`                | `3000`                        |
| `packages/frontend/.env.local` | `NEXT_PUBLIC_API_URL` | `http://localhost:3001`       |
| `packages/backend/.env`        | `PORT`                | `3001`                        |
| `packages/backend/.env`        | `REDIS_URL`           | Set at runtime by `dev:fresh` |
| `packages/backend/src/main.ts` | fallback              | `process.env.PORT \|\| 3001`  |
