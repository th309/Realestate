# Mesa Agent Orchestration Setup — Design

**Date:** 2026-07-18
**Status:** Approved for planning

## Purpose

Set up [Mesa](https://github.com/msoedov/mesa) — a standalone, self-hosted "AI agent organization" platform (Linear-style issue board + agents that take tasks, delegate, review, and ship code) — as a **dev-tooling layer** that orchestrates AI-agent work against the `rei-platform` repository.

This is explicitly a developer-tooling setup, not a product feature. Nothing in this design touches PropertyIQ's frontend, backend, or data pipelines. Mesa is a separate service that happens to point its git worktrees at this repo's working copy.

## Non-goals

- Not embedding Mesa's REST API into the PropertyIQ product.
- Not granting Mesa (or any agent it spawns) push/PR access to GitHub. See Guardrails.
- Not replacing the user's own Claude Code sessions/workflow — Mesa is an additional, separate orchestration surface for autonomous ticket-driven work.

## Architecture / Topology

- **Mesa's own source** clones to `D:\projects\mesa` — a sibling directory to `D:\projects\rei-platform`, its own independent git repository. It is never vendored into or committed inside the `rei-platform` repo.
- **`rei-platform` working copy** (`D:\projects\rei-platform`) is bind-mounted **read-write** into the Mesa container as `WORKSPACE`. Mesa needs write access here because it creates one isolated `git worktree` per agent run.
- **Claude credentials**: the user's existing `~/.claude` directory and `~/.claude.json` (already present, OAuth-based — no separate API key configured) mount **read-only** into the container's home directory. This lets Mesa's `claude` CLI runner execute already-authenticated, without provisioning a separate `ANTHROPIC_API_KEY`.
- **Mesa's state** (SQLite DB + archetype definitions) lives in a named Docker volume anchored under `D:\projects\mesa` — persists across container restarts, independent of the rei-platform repo.
- **Dashboard**: `http://localhost:3900`. Mesa defaults to port 3001, which collides with rei-platform's NestJS backend (also 3001 locally) — moved to 3900, which doesn't collide with any documented local service (3000 frontend, 3001 backend, 3100 mobile-web preview, 6379 Redis).

## Configuration

Deployment via Docker Compose (Docker Desktop 29.0.1 + Compose v2.40.3 already installed and running locally — confirmed via `docker info`). No Go toolchain install needed on the host — the Compose path runs Mesa inside its own container; implementation will confirm whether that pulls a prebuilt image or builds locally from the repo's Dockerfile.

`docker-compose.yml` environment:

| Variable     | Value                                                  | Why                                                                                                                                    |
| ------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`       | `3900`                                                 | Avoids collision with backend's 3001                                                                                                   |
| `WORKSPACE`  | `/workspace` (bind mount ← `D:\projects\rei-platform`) | Target repo for agent worktrees                                                                                                        |
| `TEMPLATE`   | `saas`                                                 | Roster tuned for an existing live product (engineers, QA, growth/ops) rather than a 0-to-1 startup idea — matches rei-platform's stage |
| `MODEL`      | `claude`                                               | Reuses the already-authenticated Claude Code CLI as the default runner                                                                 |
| `DB`         | `/data/rei-platform.db`                                | Persisted in the named volume                                                                                                          |
| `ARCHETYPES` | `/data/archetypes`                                     | Seeded from the `saas` template; editable later via the dashboard                                                                      |

Volumes:

- `D:\projects\rei-platform` → `/workspace` (rw)
- `~/.claude`, `~/.claude.json` → container home (ro)
- named volume → `/data` (rw, Mesa-managed state)

## Guardrails

This is the section that matters most given rei-platform's branch-safety rules (never push without asking, work on `develop`, no force-push, no unauthorized destructive git ops):

1. **No push capability mounted, at all.** No `~/.config/gh`, no push-capable git remote credential, is mounted into the container. This makes "agents can only commit locally, never push" an infrastructure-level fact — not a prompt instruction an agent could be talked out of. If an agent's plan includes "push my branch," it will simply fail for lack of credentials.
2. **Per-run worktree isolation.** Every agent run operates in its own `git worktree`, never the user's actual checked-out `develop` working tree. The user's in-progress, uncommitted work is never touched by a Mesa run.
3. **Per-agent daily token/cost budget**, set conservatively at first boot (Mesa supports hard limits per agent) — prevents an unsupervised agent loop from causing runaway API spend. Adjustable later in the dashboard once real usage patterns are observed.
4. **Human approval gate stays on** (Mesa's default). An agent does not start a run until a human approves the corresponding issue/work-block in the dashboard — no fully unattended ticket-to-run pipeline.

## Verification plan

1. `docker compose up -d` in `D:\projects\mesa`; confirm the dashboard loads at `localhost:3900`.
2. Confirm rei-platform's existing frontend (`:3000`) and backend (`:3001`) are unaffected — no port or resource contention.
3. Create one throwaway test issue (trivial, low-risk — e.g., a harmless comment/doc tweak), assign it to an Engineer archetype, approve it in the dashboard, and watch the run end-to-end. Confirm:
   - A real `git worktree` + diff is produced.
   - Nothing is pushed anywhere (verify no new remote refs, `git log` on `origin/develop` unchanged).
   - The run shows up in Mesa's audit trail / run history.
4. Confirm the container restarts cleanly and the SQLite state (issues, archetypes, run history) persists across `docker compose down && docker compose up -d`.

## Open items deferred to implementation

- Exact per-agent budget figures (dollar/token ceiling) — set a conservative default during setup, tune later in the dashboard.
- Whether to later add read-only `gh` access (e.g., for agents to _read_ PR/issue state without writing) — out of scope for this initial setup; can be revisited once the local-commit-only workflow is validated.
