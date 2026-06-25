# Agent-Readiness (Tier 1) — Design Spec

- **Date:** 2026-06-25
- **Status:** Approved (brainstorming) — pending implementation plan
- **Revised:** 2026-06-25 — server card placement B (www + MCP host); Link header on all routes.
- **Scope:** Frontend (`packages/frontend`) + one additive discovery route in `packages/mcp-server`. No backend changes.
- **Owner:** th309

## 1. Context & Motivation

An automated agent-readiness audit (isitagentready.com) flagged `www.propertyiq.app` as
missing several agent-discovery surfaces (Link headers, an API catalog, an MCP server card,
OAuth discovery metadata, Content Signals, etc.). Many flags are false negatives: the audit
scanned only the apex web domain, while PropertyIQ already runs the relevant infrastructure
on the **MCP subdomain**.

**Already in place (do not rebuild) — verified live 2026-06-25:**

- MCP server at `https://mcp.propertyiq.app` (package `propertyiq` v`0.2.0`, streamable-HTTP,
  47 tools, OAuth 2.1 + PKCE) **already serves** `/.well-known/oauth-protected-resource`
  (RFC 9728, confirmed `200`) and `/.well-known/oauth-authorization-server` (RFC 8414), plus
  dynamic client registration (RFC 7591), a healthy `/health`, and an OpenAPI 3.1 REST wrapper
  at `/api/openapi.json`.
- Frontend already serves `public/.well-known/security.txt`, `public/llms.txt`,
  `public/llms-full.txt`, and a `robots.ts` that allow-lists every AI crawler by name.

**Confirmed NOT in place (this is the gap):** the SEP-1649 MCP **server card** —
`/.well-known/mcp/server-card.json` returns `404` on `mcp.propertyiq.app` and the generic app
HTML on `www`. It exists nowhere today.

Because OAuth discovery metadata is already RFC-correct on the resource server (the MCP
subdomain), this work does **not** duplicate it onto `www`. Instead, `www` becomes
_discoverable_ and _points agents at_ the existing infrastructure.

## 2. Goals

Ship four agent-discovery surfaces:

1. **MCP Server Card** at `/.well-known/mcp/server-card.json` (SEP-1649 shape), served on
   **both** `www.propertyiq.app` (audit + brand-domain discovery) and `mcp.propertyiq.app`
   (the canonical home an MCP client actually probes).
2. **API catalog** at `www/.well-known/api-catalog` (`application/linkset+json`, RFC 9727).
3. **Link response headers** on **all** page routes (RFC 8288) pointing at the catalog + docs.
4. **Content Signals** in `robots.txt` (`search=yes, ai-input=yes, ai-train=no`).

## 3. Non-Goals (explicitly out of scope)

- **Tier 2:** `auth.md`, Markdown-for-Agents content negotiation, agent-skills index.
- **Tier 3:** DNS-AID records, WebMCP browser API.
- **OAuth discovery on `www`:** intentionally omitted — it is correctly served on
  `mcp.propertyiq.app`; the API catalog and server card _link_ to it.
- **NestJS Platform API anchor in the catalog (v1):** deferred. The backend has no clean
  public domain (only the raw Railway host `backend-production-ee4d.up.railway.app`), and
  publishing an infra URL in a public catalog is brittle/poor form. The MCP REST wrapper
  already exposes the agent-relevant data surface. Add a backend anchor later only if a
  clean custom domain (or a `www.propertyiq.app/backend/*` proxy path) is confirmed.
- **Any change to existing MCP server behavior:** the `packages/mcp-server` work is purely
  additive (one new unauthenticated GET route). No existing route, auth path, tool, or
  response is touched.

## 4. Locked Decisions

| #   | Decision                | Choice                                                                                                                                                                          |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Scope                   | Tier 1 only (the four surfaces above)                                                                                                                                           |
| 2   | Content-Signal stance   | `search=yes, ai-input=yes, ai-train=no`                                                                                                                                         |
| 3   | Serving mechanism (www) | **Option Y** — uniform route handlers + `next.config` rewrites + one shared manifest                                                                                            |
| 4   | Link header scope       | **All page routes** — folded into the existing global header block in `next.config.mjs`                                                                                         |
| 5   | API catalog v1 anchors  | MCP service only                                                                                                                                                                |
| 6   | robots train policy     | **Decouple** — keep crawl access for all bots (incl. training bots); declare `ai-train=no` as a usage-license preference; rewrite the comment so access vs. license is coherent |
| 7   | Server card placement   | **B — both hosts:** `www` (frontend route handler + rewrite) **and** `mcp.propertyiq.app` (additive route in the MCP server's existing well-known handler)                      |

## 5. Architecture / Serving Mechanism

### 5.1 `www` surfaces (Option Y)

Next.js App Router ignores dot-prefixed folders, so `app/.well-known/` does not route (this
is why `security.txt` is a static `public/` file today). The two JSON documents need dynamic
control (custom media type for the catalog; a single source of truth for both), so:

- Real handlers live under a normal, routable segment: `app/api/agent-discovery/*/route.ts`.
- `next.config.mjs` `rewrites()` map the canonical public paths to them:
  - `/.well-known/mcp/server-card.json` → `/api/agent-discovery/server-card`
  - `/.well-known/api-catalog` → `/api/agent-discovery/api-catalog`
- Both handlers import canonical facts from **one** module:
  `packages/frontend/lib/agent-discovery/manifest.ts` (single source of truth — no drift).

**Middleware:** `/.well-known/*` paths are not under `/admin`, `/account`, etc., so
`middleware.ts` passes them through; the canonical-host (non-www → www) redirect is harmless.
This must be **confirmed** in the first implementation step (curl the rewritten path through a
running server) rather than assumed; if middleware interferes, add `.well-known` to the
matcher's negative lookahead.

### 5.2 `mcp.propertyiq.app` surface (additive)

The MCP server already serves `/.well-known/oauth-protected-resource` and
`/.well-known/oauth-authorization-server` as unauthenticated discovery routes. Add a
sibling **unauthenticated** `GET /.well-known/mcp/server-card.json` next to them, mirroring
that pattern. The card body is generated from the MCP server's own constants (its `McpServer`
name/version and `MCP_BASE_URL`) — no hardcoded duplication on this side. The exact file
where the oauth well-known routes are registered is pinpointed in the plan (see §10).

## 6. Deliverables (exact shapes)

### 6.1 `lib/agent-discovery/manifest.ts` (single source of truth, `www` side)

Hardcoded public canonical values (these are public URLs, not secrets — consistent with how
`robots.ts` hardcodes the sitemap URL). The MCP `version` carries a
`// keep in sync with packages/mcp-server/src/server.ts` comment.

```ts
export const AGENT_DISCOVERY = {
  siteOrigin: "https://www.propertyiq.app",
  mcp: {
    name: "propertyiq",
    version: "0.2.0", // keep in sync with packages/mcp-server/src/server.ts
    endpoint: "https://mcp.propertyiq.app/mcp",
    transport: "streamable-http",
    auth: "oauth2.1",
    openapi: "https://mcp.propertyiq.app/api/openapi.json",
    health: "https://mcp.propertyiq.app/health",
    docs: "https://www.propertyiq.app/docs/mcp",
    oauthProtectedResource:
      "https://mcp.propertyiq.app/.well-known/oauth-protected-resource",
  },
} as const;
```

### 6.2 MCP Server Card — `/.well-known/mcp/server-card.json` (BOTH hosts)

Identical document shape on both hosts; each host generates it from its own source of truth
(the `www` handler from `manifest.ts`; the MCP-server handler from its own server constants).
SEP-1649 is not finalized, so fields are kept conservative and aligned to MCP's known
`serverInfo`/`Implementation` shape. The tools _capability_ is declared by presence (`{}`),
not a count, so it cannot go stale.

- `www` handler: `app/api/agent-discovery/server-card/route.ts` (served at the well-known path
  via the §5.1 rewrite). `Content-Type: application/json`;
  `Cache-Control: public, max-age=3600, s-maxage=3600`.
- MCP-server handler: additive `GET /.well-known/mcp/server-card.json` (§5.2),
  `Content-Type: application/json`.

```json
{
  "serverInfo": { "name": "propertyiq", "version": "0.2.0" },
  "transport": {
    "type": "streamable-http",
    "endpoint": "https://mcp.propertyiq.app/mcp"
  },
  "capabilities": { "tools": {} },
  "authentication": {
    "type": "oauth2.1",
    "metadata": "https://mcp.propertyiq.app/.well-known/oauth-protected-resource"
  },
  "documentation": "https://www.propertyiq.app/docs/mcp"
}
```

### 6.3 API Catalog — `www/.well-known/api-catalog`

- Handler: `app/api/agent-discovery/api-catalog/route.ts`
- `Content-Type: application/linkset+json`; same cache header.
- RFC 9727 + RFC 9264 (linkset JSON). v1 = single MCP anchor:

```json
{
  "linkset": [
    {
      "anchor": "https://mcp.propertyiq.app/mcp",
      "service-desc": [
        {
          "href": "https://mcp.propertyiq.app/api/openapi.json",
          "type": "application/json"
        }
      ],
      "service-doc": [
        { "href": "https://www.propertyiq.app/docs/mcp", "type": "text/html" }
      ],
      "status": [
        {
          "href": "https://mcp.propertyiq.app/health",
          "type": "application/json"
        }
      ]
    }
  ]
}
```

### 6.4 Link Response Headers — all page routes

Folded into the **existing global header block** in `next.config.mjs` (the one that already
returns security headers for all routes) — not a new homepage-only block. Rationale: agents
and crawlers enter wherever search/citations send them, which for PropertyIQ is
overwhelmingly _deep_ SEO pages, not `/` (the activation-funnel work found ~94% of traffic
hits SEO pages, not the homepage). A homepage-only Link header would miss almost every real
agent entry point. Cost is an ~80-byte constant header per response — negligible — and there
is nothing to maintain as routes change. Both relation types are IANA-registered (the audit's
complaint was "no agent-useful relation types"):

```
Link: </.well-known/api-catalog>; rel="api-catalog", </docs/mcp>; rel="service-doc"
```

### 6.5 robots.txt Content-Signal

`MetadataRoute.Robots` cannot emit arbitrary directives, so convert
`app/robots.ts` → `app/robots.txt/route.ts` (a text route handler). Requirements:

- **Port the existing rules faithfully**: the `allow` list (`/`, `/api/og`), the `disallow`
  list (`/api/`, `/admin/`, `/auth/`, `/account/`, `/dev/`, `/health/`, `/betatest/`), the
  named AI-bot allow-list, and the `Sitemap:` line. Verify nothing else imports `robots.ts`
  before deletion.
- Add, under the `User-agent: *` group:
  `Content-Signal: search=yes, ai-input=yes, ai-train=no`
- **Rewrite the policy comment** to reflect the decoupled stance: all bots (including
  training crawlers) are granted _crawl access_ for search + AI-citation reach, while the
  Content-Signal withholds a _training license_ (`ai-train=no`). This supersedes the
  2026-06-19 "training welcomed" rationale; the access list is unchanged, only the
  usage-license preference and its explanation change.
- `Content-Type: text/plain; charset=utf-8`; cache consistent with the existing robots output.

## 7. Edge Cases / Non-Functional

- Handlers are pure JSON/text generation — no external calls, no user input, no failure
  modes, no validation surface. Always 200 with correct `Content-Type` + 1h cache.
- No secrets involved; all values are public canonical URLs.
- The `mcp.propertyiq.app` card route is **additive and unauthenticated**, mirroring the
  existing oauth well-known discovery routes. It must not alter any existing route, auth
  path, tool registration, or response (project rule: MCP changes preserve behavior).
- Static-vs-dynamic: `server-card.json` and `api-catalog` are dynamic only to share the
  manifest and (for the catalog) set the `linkset+json` media type — not because they vary
  per request.

## 8. Verification Plan (live, not mocked)

Per the standing "live data only" rule, verify against a production preview build, not dev
(dev cold-compile is unreliable for this).

**Frontend (`.next-verify` build, `next start -p 3100`):**

1. Confirm middleware passthrough + each surface:
   - `curl -sI http://localhost:3100/ | grep -i '^link'` → shows both rel types.
   - `curl -sI http://localhost:3100/<a-deep-market-or-blog-page> | grep -i '^link'` →
     **also** shows the Link header (proves all-routes coverage, not just `/`).
   - `curl -si http://localhost:3100/.well-known/api-catalog` → `200`,
     `Content-Type: application/linkset+json`, body is valid linkset JSON.
   - `curl -si http://localhost:3100/.well-known/mcp/server-card.json` → `200`,
     `application/json`, valid JSON.
   - `curl -s http://localhost:3100/robots.txt` → shows the `Content-Signal` line **and**
     the existing allow/disallow + AI-bot rules + `Sitemap:` intact.

**MCP server (after its deploy):**

2. `curl -si https://mcp.propertyiq.app/.well-known/mcp/server-card.json` → `200`,
   `application/json`, valid JSON; and confirm the existing oauth well-known routes + `/health`
   - a tool call still behave exactly as before (no regression).

**End-to-end:**

3. After deploy, re-run isitagentready.com and confirm the four checks flip to pass.

## 9. Files Touched

**New**

- `packages/frontend/lib/agent-discovery/manifest.ts`
- `packages/frontend/app/api/agent-discovery/server-card/route.ts`
- `packages/frontend/app/api/agent-discovery/api-catalog/route.ts`
- `packages/frontend/app/robots.txt/route.ts`
- `packages/mcp-server/...` — additive `GET /.well-known/mcp/server-card.json` route
  (exact file pinpointed in the plan; registered alongside the existing oauth well-known
  routes)

**Modified**

- `packages/frontend/next.config.mjs` (two `rewrites()` entries + a global `Link` header
  added to the existing all-routes header block)

**Deleted**

- `packages/frontend/app/robots.ts` (replaced by `robots.txt/route.ts`)

## 10. Open Verification Items (non-blocking, handled in the plan)

1. Confirm `middleware.ts` passes `/.well-known/*` through (step 1 of verification). If not,
   add `.well-known` to the matcher's negative lookahead.
2. Confirm no module imports from `app/robots.ts` before deleting it.
3. Pinpoint the exact `packages/mcp-server` file/registration point for the existing
   `/.well-known/oauth-*` routes, and add the server-card route there (additive, unauth).
