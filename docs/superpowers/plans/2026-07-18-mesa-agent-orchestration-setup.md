# Mesa Agent Orchestration Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up [msoedov/mesa](https://github.com/msoedov/mesa) as a sibling Docker Compose service that dispatches Claude Code agents against rei-platform's working copy via isolated git worktrees, with push/PR capability physically impossible and a human-approval gate on every run.

**Architecture:** Mesa clones to `D:\projects\mesa` (separate git repo, not part of rei-platform). Its `docker/docker-compose.yml` builds a container that bind-mounts the rei-platform repo read-write as `/workspace` and the user's `~/.claude` OAuth credentials read-only, so the container's own `claude` CLI runner is already authenticated. A `docker-compose.override.yml` strips Mesa's default `~/.config/gh` credential mount, and `GH_TOKEN` is never set — so nothing inside the container ever has git-push or PR-open capability. That same override adds a bind mount + explicit `DB`/`ARCHETYPES` env vars pointing Mesa's SQLite state at `D:\projects\mesa\docker\data`, since upstream's default (`so.db`, relative to `/workspace`) would otherwise write Mesa's database straight into the rei-platform repo. Team roster uses the `saas` template.

**Tech Stack:** Go binary (Mesa, built inside its own multi-stage Docker image), Docker Compose v2 (already installed: Docker Desktop 29.0.1 / Compose v2.40.3), SQLite (Mesa's internal state), Claude Code CLI (agent runner, installed inside the image via `npm install -g @anthropic-ai/claude-code`).

## Global Constraints

- Never mount or set any GitHub push credential (`~/.config/gh`, `GH_TOKEN`) into the Mesa container — agents/Mesa must be physically unable to push or open PRs. (Spec: Guardrails §1)
- Mesa's own source and all its config files live entirely in `D:\projects\mesa`, never inside the `rei-platform` git repository. Files created there are left **untracked** — we don't own `msoedov/mesa`'s git history and never push to it.
- No commits are made to the `rei-platform` repository anywhere in this plan.
- Mesa's HTTP port is `3900`, not the default `3001` (collides with rei-platform's NestJS backend). (Spec: Architecture)
- Team roster: `TEMPLATE=saas` — verified to exist at `cmd/mesa/templates/saas.json` in the Mesa repo (7 agents: CEO, Fullstack Engineer, Product Manager, Marketing Lead, Sales Rep, Support Engineer, Designer). Every agent in this template already has `disallowed_tools: ["Bash(git:*)"]` set by Mesa itself — an additional, Mesa-native guardrail on top of the credential-mount guardrail below.
- Runner: `MODEL=claude`, reusing the host's already-authenticated `~/.claude` OAuth credentials — no `ANTHROPIC_API_KEY` provisioned. (Spec: Configuration)
- `DB` and `ARCHETYPES` must be explicitly set to absolute paths under a bind mount outside `/workspace` (verified: upstream's base `docker-compose.yml` doesn't even pass these two through to the container's `environment:` block, and both env vars default to relative paths — `so.db` / `archetypes` — which Go resolves against the container's CWD, `/workspace` per the Dockerfile's `WORKDIR`. Left unset, Mesa's own SQLite DB would land inside the rei-platform repo itself.)
- Upstream `msoedov/mesa` is a live, evolving repo. Every task below states what its file-content assumptions were verified against on 2026-07-18; if a step's actual output doesn't match the "Expected," stop and re-derive the affected step from the real file before continuing — don't force the plan's assumption onto a changed reality.

---

### Task 1: Clone Mesa and verify assumptions against the live upstream repo

**Files:**

- Create: `D:\projects\mesa\` (git clone destination)

**Interfaces:**

- Produces: a local clone at `D:\projects\mesa` containing `docker/docker-compose.yml`, `docker/Dockerfile`, `docker/docker-entrypoint.sh`, `cmd/mesa/templates/saas.json` — later tasks read/override these exact paths.

- [ ] **Step 1: Clone the repo**

Run:

```bash
git clone https://github.com/msoedov/mesa.git "D:\projects\mesa"
```

Expected: clones successfully; `D:\projects\mesa\docker\docker-compose.yml` exists.

- [ ] **Step 2: Confirm the compose file still matches this plan's assumptions**

Run:

```bash
cat "D:\projects\mesa\docker\docker-compose.yml"
```

Expected: a single `mesa` service with:

- `build.context: ..`, `build.dockerfile: docker/Dockerfile`
- `ports: ["${PORT:-3001}:${PORT:-3001}"]`
- `volumes:` containing exactly these four bind mounts: `${WORKSPACE:-.}:/workspace`, `${HOME}/.claude:/home/so/.claude`, `${HOME}/.codex:/home/so/.codex`, `${HOME}/.gemini:/home/so/.gemini`, `${HOME}/.config/gh:/home/so/.config/gh`
- `environment:` containing `PORT`, `TEMPLATE` (default `startup`), `MODEL` (default `claude`), `GH_TOKEN` (default empty), `ANTHROPIC_API_KEY` (default empty)

If any of this differs from what's on disk, STOP — Task 2's override file targets these exact volume entries by content-match, and a changed upstream file means Task 2 needs to be rewritten first.

- [ ] **Step 3: Confirm the `saas` template still exists**

Run:

```bash
cat "D:\projects\mesa\cmd\mesa\templates\saas.json"
```

Expected: JSON with `"name": "SaaS"` and an `"agents"` array of 7 entries (ceo, fullstack, product, marketing, sales, support, designer archetypes), each with `"disallowed_tools": ["Bash(git:*)"]`.

No commit — this is a clone of an upstream repo we don't own.

---

### Task 2: Neutralize the GitHub push-credential mount and relocate Mesa's own state

**Files:**

- Create: `D:\projects\mesa\docker\docker-compose.override.yml`
- Create: `D:\projects\mesa\docker\data\` (empty directory — Mesa's SQLite DB + archetype overrides land here instead of inside `/workspace`)

**Interfaces:**

- Consumes: the base `docker/docker-compose.yml` service name `mesa`, its default volume list, and its `environment:` block (Task 1, Step 2).
- Produces: a merged Compose config (verified via `docker compose config`) whose `mesa.volumes` list has no entry mounting `.config/gh` or targeting `/home/so/.config/gh`, has a fifth entry bind-mounting `./data:/data`, and whose environment includes `DB=/data/rei-platform.db` + `ARCHETYPES=/data/archetypes`. Task 3's boot step and Task 4's verification both depend on this.

- [ ] **Step 1: Create the data directory**

Run:

```bash
mkdir -p "D:\projects\mesa\docker\data"
```

Expected: directory exists (Docker would auto-create it as a bind-mount target anyway, but creating it explicitly makes it visible/inspectable up front).

- [ ] **Step 2: Write the override file**

```yaml
# D:\projects\mesa\docker\docker-compose.override.yml
#
# Two deliberate deviations from upstream docker-compose.yml:
#
# 1. Omits ${HOME}/.config/gh -> /home/so/.config/gh. That mount would give
#    the container's `gh` CLI (and anything that shells out to it) real
#    push/PR-open capability using the host's already-authenticated GitHub
#    credentials. Mesa is only ever meant to produce local commits here —
#    a human reviews and pushes.
#
# 2. Adds ./data -> /data plus DB/ARCHETYPES env vars. Upstream defaults
#    (DB=so.db, ARCHETYPES=archetypes) are relative paths that resolve
#    against the container's CWD, /workspace — i.e. Mesa's own SQLite DB
#    and archetype overrides would otherwise be written straight into the
#    rei-platform repo. Redirecting them here keeps Mesa's state entirely
#    inside D:\projects\mesa, independent of rei-platform's working tree.
services:
  mesa:
    volumes: !override
      - ${WORKSPACE:-.}:/workspace
      - ${HOME}/.claude:/home/so/.claude
      - ${HOME}/.codex:/home/so/.codex
      - ${HOME}/.gemini:/home/so/.gemini
      - ./data:/data
    environment:
      DB: /data/rei-platform.db
      ARCHETYPES: /data/archetypes
```

`!override` (not `!reset`) is required here: per the Compose Specification, `!reset` clears a field to empty/null regardless of what value follows it, while `!override` is the tag that actually replaces the base's list with the one given. Using `!reset` on a sequence with a replacement list beneath it empties the field entirely — confirmed by Task 2's first review pass, which found the merged config's `volumes:` section completely absent.

- [ ] **Step 3: Verify the merged config has no gh mount and has the data mount**

Run (from `D:\projects\mesa\docker`):

```bash
HOME=/c/Users/troyh WORKSPACE=D:/projects/rei-platform docker compose config
```

Expected: the rendered `services.mesa.volumes` list has exactly 5 entries (workspace, `.claude`, `.codex`, `.gemini`, `./data:/data`) and **no** entry containing `.config/gh` or `/home/so/.config/gh`.

- [ ] **Step 4: Verify GH_TOKEN resolves empty and DB/ARCHETYPES resolve correctly**

Run:

```bash
HOME=/c/Users/troyh WORKSPACE=D:/projects/rei-platform docker compose config | grep -iE "GH_TOKEN|^\s*DB:|ARCHETYPES"
```

Expected: `GH_TOKEN: ""` (present but empty — confirms Task 3's `.env` must not set it), `DB: /data/rei-platform.db`, `ARCHETYPES: /data/archetypes`.

No commit — left untracked in the Mesa clone; see Global Constraints.

---

### Task 3: Configure environment and boot the stack

**Files:**

- Create: `D:\projects\mesa\docker\.env`

**Interfaces:**

- Consumes: the override from Task 2 (auto-applied by `docker compose` whenever `docker-compose.override.yml` sits next to `docker-compose.yml`).
- Produces: a running `mesa` container reachable at `http://localhost:3900`. Tasks 4–7 all act against this running container.

- [ ] **Step 1: Write `.env`**

```
# D:\projects\mesa\docker\.env
PORT=3900
WORKSPACE=D:/projects/rei-platform
TEMPLATE=saas
MODEL=claude
```

Do **not** add `GH_TOKEN`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY` to this file — see Task 2 and Global Constraints.

- [ ] **Step 2: Build and start**

Run (from `D:\projects\mesa\docker`):

```bash
docker compose up --build -d
```

Expected: the image builds (Go compile stage, then Debian runtime stage installing Node.js, `gh`, and `@anthropic-ai/claude-code`/`@openai/codex`/`@google/gemini-cli` via npm), then the container starts. `docker compose ps` shows the `mesa` service state `running`.

- [ ] **Step 3: Confirm the merged config picked up `.env` correctly**

Run:

```bash
docker compose config | grep -E "PORT|TEMPLATE|MODEL|WORKSPACE"
```

Expected: shows `PORT: "3900"`, `TEMPLATE: saas`, `MODEL: claude`, and the workspace volume source resolving to `D:/projects/rei-platform`.

- [ ] **Step 4: Confirm the dashboard is reachable**

Run:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3900/
```

Expected: `200` (or a `30x` redirect to a setup page) — not `000`/connection-refused.

- [ ] **Step 5: Confirm no regression on rei-platform's own local servers**

If the frontend/backend were already running locally before this task, re-check them now and confirm the status codes are unchanged from before Mesa started:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/health
```

Expected: same codes as observed before starting Mesa (typically `200` for both when the dev servers are up); Mesa listening on `3900` should have no effect on either.

No commit — `.env` is left untracked in the Mesa clone.

---

### Task 4: Verify push-guardrails inside the running container

**Files:** none created — verification only.

**Interfaces:**

- Consumes: the running container from Task 3.
- Produces: a confirmed-safe container that Task 5/6 can be pointed at real (non-dry-run) work without risk of an accidental push.

- [ ] **Step 1: Confirm `gh` has no stored auth**

Run:

```bash
docker compose exec mesa gh auth status
```

Expected: non-zero exit, output indicating no host is authenticated (e.g. "You are not logged into any GitHub hosts").

- [ ] **Step 2: Confirm `GH_TOKEN` is empty inside the container**

Run:

```bash
docker compose exec mesa printenv GH_TOKEN
```

Expected: empty output.

- [ ] **Step 3: Confirm the gh config directory is empty**

Run:

```bash
docker compose exec mesa ls -la /home/so/.config/gh
```

Expected: directory exists (created by the Dockerfile) but contains no `hosts.yml` or credential file — empty or nonexistent contents.

- [ ] **Step 4: Confirm no git credential helper is configured**

Run:

```bash
docker compose exec mesa git config --global credential.helper
```

Expected: empty output (unset) — confirms there's no configured mechanism that could authenticate a push even if one were attempted.

Do **not** attempt an actual `git push` from inside the container as a test — that would be a real, consequential action against the real `origin` remote of `/workspace` if the guardrail somehow failed. Steps 1–4 prove the absence of push capability without ever risking the action itself.

No commit — verification only.

---

### Task 5: Bootstrap the org and run a token-free dry-run smoke test

**Files:** none created — dashboard-driven.

**Interfaces:**

- Consumes: the running, guardrail-verified container from Tasks 3–4.
- Produces: a bootstrapped `saas`-template org with 7 agents, a confirmed-real approval gate, a per-agent budget cap in place, and proof the issue → run → audit-trail pipeline works mechanically before spending any real tokens. Task 6 depends on the budget cap being set first.

- [ ] **Step 1: Load the dashboard and complete first-run bootstrap**

Load `http://localhost:3900/` in a browser (recommended: `claude-in-chrome` — load its tools via `ToolSearch` with `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp` first). Since `TEMPLATE=saas` was set in `.env`, first-run bootstrap should create the org pre-populated with the 7 `saas` agents (CEO, Fullstack Engineer, Product Manager, Marketing Lead, Sales Rep, Support Engineer, Designer) — confirm they appear in the dashboard's roster/agents view. The exact wizard screens aren't knowable ahead of actually loading the page; drive whatever bootstrap flow is presented, selecting/confirming the `saas` template if asked.

Expected: dashboard loads without error; agent roster shows all 7 `saas`-template agents.

- [ ] **Step 2: Create a `dry_run` smoke-test issue and confirm the approval gate actually blocks it**

Create one issue (any trivial description, e.g. "smoke test — dry run") and assign it to any agent, with that run's runner overridden to `dry_run` (per README: "records the would-be prompt without invoking a CLI; for iterating on archetypes without burning tokens"). **Do not approve it yet.**

Expected: the issue sits in a pending/awaiting-approval state and no run starts — this proves the human-approval gate is a real block, not a no-op default that happens to never have been tested.

Now approve it.

Expected: the run starts and completes without invoking any real CLI or touching `/workspace`; the dashboard's run history shows a completed `dry_run` entry with the recorded prompt.

- [ ] **Step 3: Confirm nothing touched the real repo**

Run (from the host):

```bash
git -C "D:\projects\rei-platform" status --short
```

Expected: identical to whatever it showed before Task 5 started (the `dry_run` should not have created worktrees or file changes).

- [ ] **Step 4: Set a conservative per-agent budget cap before any real run**

In the dashboard's org/agent settings, find the per-agent daily token/cost budget control and set a conservative cap for every agent (e.g. the lowest unit the UI exposes — a few dollars/day or a low six-figure token/day ceiling — enough to complete Task 6's one trivial test issue without meaningfully more). The exact figure isn't load-bearing; the point is a hard ceiling exists before Task 6 spends any real tokens, per the spec's guardrail #3.

Expected: budget field accepts and saves the value; re-opening the settings page shows it persisted.

No commit — dashboard/verification only.

---

### Task 6: Real end-to-end test with the `claude` runner

**Files:** none created directly by this task — the agent run itself will create files inside a Mesa-managed git worktree under `D:\projects\rei-platform`.

**Interfaces:**

- Consumes: the bootstrapped org from Task 5.
- Produces: proof that a real agent run produces an isolated worktree + diff, and that the diff never reaches `origin`.

- [ ] **Step 1: Create one trivial, low-risk issue using the real `claude` runner**

In the dashboard, create an issue with a genuinely low-risk, easily-verified scope — e.g. "add a one-line comment to `README.md` noting the current date" — assigned to the Fullstack Engineer agent (default runner `claude`, per `MODEL=claude`). Approve it and let it run.

Expected: the dashboard's run view shows the agent working, then completing, with a captured diff.

- [ ] **Step 2: Confirm a real git worktree was created on the host**

Run:

```bash
git -C "D:\projects\rei-platform" worktree list
```

Expected: an additional worktree entry beyond the main `D:\projects\rei-platform` checkout, pointing at a Mesa-managed path, on its own branch (not `develop`).

- [ ] **Step 3: Confirm the diff exists and is exactly what was asked for**

Run:

```bash
git -C "D:\projects\rei-platform" log --all --oneline -5
```

Expected: a new commit on the worktree's branch matching the requested change (the one-line `README.md` comment), authored within the last few minutes.

- [ ] **Step 4: Confirm nothing was pushed**

Run:

```bash
git -C "D:\projects\rei-platform" fetch origin --dry-run
git -C "D:\projects\rei-platform" log origin/develop --oneline -3
```

Expected: `origin/develop`'s log is unchanged from before this task — no new remote refs, no trace of the agent's branch on `origin`.

- [ ] **Step 5: Confirm the run appears in Mesa's audit trail**

In the dashboard, open the run's detail/history view.

Expected: shows the full run record — stdout capture, diff, timing — matching what Task 6 produced.

No commit — this task's "commit" is the agent's own local commit inside its Mesa-managed worktree, already covered by Step 3. Nothing here touches the rei-platform repo's actual `develop` checkout or its own git history.

---

### Task 7: Verify restart persistence and document the setup

**Files:**

- Create: `D:\projects\mesa\docker\SETUP-NOTES.md`

**Interfaces:**

- Consumes: the fully verified setup from Tasks 1–6.
- Produces: a documented, restart-safe local setup — the terminal deliverable of this plan.

- [ ] **Step 1: Record state before restart**

Run:

```bash
docker compose exec mesa sh -c 'ls /data 2>/dev/null; echo ---; sqlite3 /data/rei-platform.db "select count(*) from issues;" 2>/dev/null || echo "sqlite3 not installed - skip count, note issue exists via dashboard instead"'
```

(If `sqlite3` isn't in the image, just note in the dashboard how many issues/runs exist — the two smoke-test issues from Tasks 5–6 — before restarting.)

- [ ] **Step 2: Restart the stack**

Run (from `D:\projects\mesa\docker`):

```bash
docker compose down
docker compose up -d
```

Expected: container stops and restarts cleanly (no rebuild needed, image already built); dashboard reachable again at `http://localhost:3900/`.

- [ ] **Step 3: Confirm state persisted**

Reload the dashboard. Expected: the org, the 7 `saas` agents, and both smoke-test issues/runs from Tasks 5–6 are still present — proving the bind-mounted `./data:/data` directory (Task 2) persisted the SQLite DB across the restart.

- [ ] **Step 4: Write the setup notes**

```markdown
# Mesa Local Setup Notes

Set up 2026-07-18 to orchestrate AI-agent dev work against `D:\projects\rei-platform`.

## Running it

    cd D:\projects\mesa\docker
    docker compose up -d        # start
    docker compose down         # stop
    docker compose logs -f mesa # tail logs

Dashboard: http://localhost:3900

## Config

- `.env` (untracked): PORT=3900, WORKSPACE=D:/projects/rei-platform, TEMPLATE=saas, MODEL=claude
- `docker-compose.override.yml` (untracked): removes the upstream `~/.config/gh` volume mount; adds `./data:/data` + `DB=/data/rei-platform.db` + `ARCHETYPES=/data/archetypes` so Mesa's own state never lands inside the rei-platform repo
- `data/` (untracked): Mesa's SQLite DB + archetype overrides live here — `cp data/rei-platform.db data/backup.db` to back up

## Guardrails — why agents can never push

1. No GitHub credential is ever mounted into the container (`docker-compose.override.yml` strips it) and `GH_TOKEN` is never set — `gh auth status` inside the container confirms no host is authenticated.
2. Every agent in the `saas` template has `disallowed_tools: ["Bash(git:*)"]` set by Mesa itself — agents can't invoke git directly even if asked to.
3. Every run happens in its own isolated `git worktree`, never the actual checked-out `develop` working tree.
4. Mesa's human-approval gate is on by default — no run starts without an explicit approval in the dashboard.

To review or land agent work: `git -C D:\projects\rei-platform worktree list`, inspect the branch, then merge/push manually through the normal rei-platform git workflow (`release:main`, PR, etc.) — Mesa never does this itself.

## Verified 2026-07-18

- Dashboard boots on :3900, no collision with rei-platform's :3000/:3001.
- Approval gate genuinely blocks an unapproved issue from running.
- Per-agent daily budget cap set in org/agent settings.
- `dry_run` smoke test completes without touching `/workspace`.
- Real `claude`-runner test produces a worktree + local commit; `origin/develop` unchanged after.
- State (org, agents, issues, runs) persists across `docker compose down && up -d`.
```

No commit — left untracked in the Mesa clone (see Global Constraints); this file is the plan's terminal deliverable, not rei-platform source.
