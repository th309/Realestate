# Agent-Readiness Tier 3 — reach 100/100 on isitagentready.com

**Date:** 2026-06-27
**Target origin:** `www.propertyiq.app` (apex `propertyiq.app` 301s here)
**Goal:** Close the final five isitagentready.com checks. Tiers 1–2 (see sibling plans
`2026-06-25-agent-readiness-tier1.md` / `tier2.md`) are already live in production.

## Verified production state (2026-06-27)

Probed live; all return **200**:
`/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`,
`/auth.md`, `/.well-known/mcp/server-card.json`, `/.well-known/api-catalog`.
`/.well-known/agent-skills/index.json` → **404**.

Single sources of truth:

- Apex copies: `packages/frontend/lib/agent-discovery/manifest.ts` → consumed by
  `packages/frontend/app/api/agent-discovery/*/route.ts` (rewritten from `/.well-known/*`
  in `next.config.mjs`), plus `app/auth.md/route.ts`.
- MCP host copies: `packages/mcp-server/src/lib/oauth/metadata.ts`.

## Why checks still fail despite 200s

1. **agent_auth wrong shape.** Block currently has `register_uri` / `identity_types_supported`
   / `credential_types_supported`. The WorkOS schema the checker validates expects
   `skill` + `identity_endpoint` + `claim_endpoint` + `identity_types_supported`.
2. **protected-resource `resource` ≠ probed origin.** Doc on `www` declares
   `resource: https://mcp.propertyiq.app`. Checker probing `www` may want the resource to
   match. Confirm via the live checker before changing (the MCP host genuinely IS the resource).
3. **agent-skills index absent** (404).
4. **WebMCP absent.**
5. **DNS-AID absent.**

## Workstreams

### W1 — WebMCP (site-wide, read-only)

- New client component `app/components/agent/WebMcpProvider.tsx` (`'use client'`), mounted once in
  `app/layout.tsx` `<body>`. Registers tools on load via `navigator.modelContext`, providing BOTH
  `registerTool(tool)` and `provideContext({tools})`, with a shim when the API is absent.
- Tools (all read-only, same-origin `/backend/*`, anonymous-safe):
  `search_markets`, `get_market_snapshot`, `get_propertyiq_score`. `execute` returns MCP content
  shape `{ content: [{ type: 'text', text }] }`. Exact endpoints from the data-layer recon.
- CSP already allows `'unsafe-inline'`/`'unsafe-eval'`; a React client component needs neither.

### W2 — Agent-skills discovery index + real SKILL.md artifacts

- Author SKILL.md files under `packages/frontend/public/.well-known/agent-skills/<name>/SKILL.md`:
  `propertyiq-market-analysis`, `propertyiq-deal-analysis`, `agent-auth`. Each has YAML frontmatter
  (`name`, `description`) + body describing how an agent uses PropertyIQ (MCP tools + REST + this site).
- New route `app/api/agent-discovery/agent-skills-index/route.ts` + `next.config.mjs` rewrite
  `/.well-known/agent-skills/index.json` → it. Emits exact `$schema`
  `https://schemas.agentskills.io/discovery/0.2.0/schema.json` and `skills[]` with
  `name`/`type:"skill-md"`/`description`/`url`/`digest`.
- `digest` = `sha256:<64hex>` over the **served bytes**. Compute at build/handler time by reading the
  static files from disk (so digest always matches what's served) — never hand-typed.

### W3 — agent_auth shape fix (both copies)

- Update `metadata.ts` `authorizationServerMetadata()` and the frontend
  `oauth-authorization-server/route.ts` to the WorkOS field names, truthfully:
  `skill` (→ auth.md), `identity_types_supported`, and our real `registration_endpoint`/`register_uri`.
  Add `identity_endpoint`/`claim_endpoint` ONLY if the live checker structurally requires them; if so,
  back them with minimal honest handlers (do not fake an ID-JAG ceremony). Keep top-level RFC 8414 fields.
- Keep manifest/version-sync tests green; update route.test.ts expectations.

### W4 — protected-resource origin match

- Hold until the live checker tells us whether `www` must self-declare as a resource. If yes, add a
  www-origin protected-resource variant; otherwise leave the honest MCP-host value.

### W5 — DNS-AID spec (deliverable; user applies in Cloudflare)

- Produce `docs/agent-readiness/dns-aid-cloudflare.md`: exact SVCB ServiceMode records for
  `_a2a._agents.propertyiq.app` and `_index._agents.propertyiq.app` (alpn/port/mandatory, TargetName),
  plus DNSSEC enable steps (Cloudflare one-click + registrar DS) and `dig +dnssec` verification.

## Verification

- `tsc` + `next build` clean; vitest for new/changed route handlers (digest matches served bytes;
  agent_auth/index JSON shape).
- Re-probe locally; after merge+deploy and DNS apply, run the live isitagentready check (browser),
  iterate to 100. Record results in this file's Review section.

## Review (2026-06-27)

Implemented + verified locally against the running dev server (real rewrites + real browser):

- **W1 WebMCP** — DONE & verified. `app/components/agent/WebMcpProvider.tsx` mounted in
  `app/layout.tsx`. In Chrome on localhost:3000, `navigator.modelContext` exposes 3 read-only tools
  (`search_markets`, `get_market_snapshot`, `get_propertyiq_score`), each with `execute` + `inputSchema`
  - `readOnlyHint`. Invoked `search_markets({query:"Austin"})` end-to-end → live backend returned metro
    12420 in MCP content shape.
- **W2 agent-skills index** — DONE & verified. `lib/agent-discovery/skills.ts` (3 real SKILL.md docs) +
  `api/agent-discovery/agent-skills-index/route.ts` + `api/agent-discovery/agent-skill/[name]/route.ts` +
  2 next.config rewrites. Live: `/.well-known/agent-skills/index.json` 200 with correct `$schema`; all 3
  SKILL.md served as text/markdown; **every `digest` matches sha256 of the served bytes** through the real
  HTTP server (plus a unit test enforcing it).
- **W3 agent_auth shape** — DONE. Both copies (`metadata.ts`, frontend route) now emit the WorkOS schema
  (`skill`, `identity_endpoint`, `claim_endpoint`, `registration_endpoint`,
  `identity_types_supported:["service_auth"]`), all URLs resolving, no fabricated ID-JAG ceremony. Tests
  updated; frontend + mcp-server suites green.
- **W4 protected-resource origin** — NO CODE CHANGE (honest): `resource` stays `https://mcp.propertyiq.app`
  (the real protected resource). The www doc is a discovery mirror. Re-evaluate against the live checker
  after deploy; only revisit if the live run still flags it.
- **W5 DNS-AID** — DONE (deliverable): `docs/agent-readiness/dns-aid-cloudflare.md`. User applies SVCB +
  DNSSEC in Cloudflare.

Verification run: frontend `vitest` agent-discovery suite 8/8; mcp-server metadata 3/3; frontend
`tsc --noEmit` 0 errors; mcp-server `tsc` build clean.

### Remaining (owner = user, then a live re-check)

1. Apply DNS-AID records + enable DNSSEC in Cloudflare (W5 doc).
2. Commit the agent-readiness files (explicit pathspec — the working tree also holds unrelated
   entitlements/e2e WIP) and release `develop -> main` to deploy.
3. After deploy + DNS propagation, run isitagentready.com against `www.propertyiq.app` and iterate on
   W4 / anything still flagged.
