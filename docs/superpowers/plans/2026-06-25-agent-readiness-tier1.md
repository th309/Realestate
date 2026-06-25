# Agent-Readiness (Tier 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `www.propertyiq.app` agent-discoverable by serving an MCP Server Card, an RFC 9727 API catalog, RFC 8288 Link headers, and a robots.txt Content-Signal — pointing agents at the MCP infrastructure that already exists on `mcp.propertyiq.app` — plus a sibling MCP Server Card on the MCP server itself.

**Architecture:** Frontend (`packages/frontend`, Next.js 16 App Router) serves the two JSON documents via route handlers under `app/api/agent-discovery/*` that are exposed at clean `/.well-known/*` paths through `next.config.mjs` rewrites (the App Router can't route dot-prefixed folders). Both handlers read one shared `lib/agent-discovery/manifest.ts`. The Link header is added to the existing global header block. `robots.ts` is converted to a text route handler so it can emit a Content-Signal. The MCP server (`packages/mcp-server`, Express) gets one additive, unauthenticated `GET /.well-known/mcp/server-card.json` next to its existing oauth well-known routes.

**Tech Stack:** Next.js 16 (App Router, route handlers, `next.config.mjs`), Vitest (frontend + mcp-server), Express 5 + Supertest (mcp-server), TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-25-agent-readiness-tier1-design.md`

## Global Constraints

- **Branch:** Work on `develop`. Verify with `git branch --show-current` immediately before every commit (the user runs parallel git ops).
- **Commits:** Stage with an **explicit pathspec** (only the task's files); verify with `git diff --cached --name-only` before committing. **Never push** (the user pushes). No `Co-Authored-By` lines. End every commit message with the footer line: `Claude-Session: https://claude.ai/code/session_01GYkHF6W2xWFUqnRML27ynx`.
- **Response pattern:** Frontend route handlers return a bare `new Response(body, { headers })` (the established RSS/sitemap pattern), not `NextResponse.json()`.
- **No hardcoded secrets:** all values here are public canonical URLs, which are intentionally hardcoded — do not read them from env.
- **MCP server change is purely additive:** add one new unauthenticated route + one new module only. Do **not** modify, reorder, or refactor any existing route, auth path, tool registration, metadata builder, or response. Name/version stay inline (they are already duplicated inline in `server.ts`, `http.ts`, `api-routes.ts`).
- **Canonical facts (verified live 2026-06-25):** MCP name `propertyiq`, version `0.2.0`, endpoint `https://mcp.propertyiq.app/mcp`, transport `streamable-http`, auth `oauth2.1`. MCP OpenAPI `https://mcp.propertyiq.app/api/openapi.json`; MCP health `https://mcp.propertyiq.app/health`; docs `https://www.propertyiq.app/docs/mcp`; oauth PR metadata `https://mcp.propertyiq.app/.well-known/oauth-protected-resource`. Sitemap `https://www.propertyiq.app/sitemap.xml`.
- **Content-Signal value (verbatim):** `search=yes, ai-input=yes, ai-train=no`.

---

### Task 1: Frontend manifest + MCP Server Card handler (www)

**Files:**

- Create: `packages/frontend/lib/agent-discovery/manifest.ts`
- Create: `packages/frontend/app/api/agent-discovery/server-card/route.ts`
- Test: `packages/frontend/app/api/agent-discovery/server-card/route.test.ts`

**Interfaces:**

- Produces: `AGENT_DISCOVERY` (const) from `@/lib/agent-discovery/manifest`, with `.siteOrigin` and `.mcp` (`{ name, version, endpoint, transport, auth, openapi, health, docs, oauthProtectedResource }`). Consumed by Task 2.
- Produces: `GET(): Promise<Response>` from the server-card route.

- [ ] **Step 1: Write the failing test**

`packages/frontend/app/api/agent-discovery/server-card/route.test.ts`:

```ts
import { GET } from "./route";

describe("MCP server card route", () => {
  it("serves a SEP-1649 card with PropertyIQ server info as application/json", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.serverInfo).toEqual({ name: "propertyiq", version: "0.2.0" });
    expect(body.transport).toEqual({
      type: "streamable-http",
      endpoint: "https://mcp.propertyiq.app/mcp",
    });
    expect(body.capabilities.tools).toBeDefined();
    expect(body.authentication.type).toBe("oauth2.1");
    expect(body.authentication.metadata).toBe(
      "https://mcp.propertyiq.app/.well-known/oauth-protected-resource",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/api/agent-discovery/server-card/route.test.ts`
Expected: FAIL — cannot resolve `./route` (file doesn't exist yet).

- [ ] **Step 3: Create the manifest (single source of truth)**

`packages/frontend/lib/agent-discovery/manifest.ts`:

```ts
// Canonical, public agent-discovery facts for PropertyIQ. These are public
// canonical URLs (not secrets), so they are intentionally hardcoded here as the
// single source of truth consumed by the well-known route handlers.
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

- [ ] **Step 4: Implement the server-card handler**

`packages/frontend/app/api/agent-discovery/server-card/route.ts`:

```ts
import { AGENT_DISCOVERY } from "@/lib/agent-discovery/manifest";

// MCP Server Card (SEP-1649). Reachable at /.well-known/mcp/server-card.json via
// a next.config rewrite. Lets agents auto-discover the PropertyIQ MCP endpoint.
export async function GET(): Promise<Response> {
  const { mcp } = AGENT_DISCOVERY;
  const card = {
    serverInfo: { name: mcp.name, version: mcp.version },
    transport: { type: mcp.transport, endpoint: mcp.endpoint },
    capabilities: { tools: {} },
    authentication: { type: mcp.auth, metadata: mcp.oauthProtectedResource },
    documentation: mcp.docs,
  };
  return new Response(JSON.stringify(card, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/api/agent-discovery/server-card/route.test.ts`
Expected: PASS (1 passed).

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/lib/agent-discovery/manifest.ts \
        packages/frontend/app/api/agent-discovery/server-card/route.ts \
        packages/frontend/app/api/agent-discovery/server-card/route.test.ts
git diff --cached --name-only   # must list ONLY the three files above
git commit -m "feat(agent-discovery): serve MCP server card at www /.well-known/mcp/server-card.json"
```

---

### Task 2: Frontend API catalog handler (www)

**Files:**

- Create: `packages/frontend/app/api/agent-discovery/api-catalog/route.ts`
- Test: `packages/frontend/app/api/agent-discovery/api-catalog/route.test.ts`

**Interfaces:**

- Consumes: `AGENT_DISCOVERY` from `@/lib/agent-discovery/manifest` (Task 1).
- Produces: `GET(): Promise<Response>` returning `application/linkset+json`.

- [ ] **Step 1: Write the failing test**

`packages/frontend/app/api/agent-discovery/api-catalog/route.test.ts`:

```ts
import { GET } from "./route";

describe("API catalog route", () => {
  it("serves an RFC 9727 linkset advertising the MCP service", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain(
      "application/linkset+json",
    );
    const body = await res.json();
    expect(Array.isArray(body.linkset)).toBe(true);
    const entry = body.linkset[0];
    expect(entry.anchor).toBe("https://mcp.propertyiq.app/mcp");
    expect(entry["service-desc"][0].href).toBe(
      "https://mcp.propertyiq.app/api/openapi.json",
    );
    expect(entry["service-doc"][0].href).toBe(
      "https://www.propertyiq.app/docs/mcp",
    );
    expect(entry.status[0].href).toBe("https://mcp.propertyiq.app/health");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/api/agent-discovery/api-catalog/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Implement the api-catalog handler**

`packages/frontend/app/api/agent-discovery/api-catalog/route.ts`:

```ts
import { AGENT_DISCOVERY } from "@/lib/agent-discovery/manifest";

// API catalog (RFC 9727 / RFC 9264 linkset). Reachable at /.well-known/api-catalog
// via a next.config rewrite. v1 advertises the PropertyIQ MCP service only.
export async function GET(): Promise<Response> {
  const { mcp } = AGENT_DISCOVERY;
  const linkset = {
    linkset: [
      {
        anchor: mcp.endpoint,
        "service-desc": [{ href: mcp.openapi, type: "application/json" }],
        "service-doc": [{ href: mcp.docs, type: "text/html" }],
        status: [{ href: mcp.health, type: "application/json" }],
      },
    ],
  };
  return new Response(JSON.stringify(linkset, null, 2), {
    headers: {
      "Content-Type": "application/linkset+json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/api/agent-discovery/api-catalog/route.test.ts`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/app/api/agent-discovery/api-catalog/route.ts \
        packages/frontend/app/api/agent-discovery/api-catalog/route.test.ts
git diff --cached --name-only   # must list ONLY the two files above
git commit -m "feat(agent-discovery): serve RFC 9727 API catalog at www /.well-known/api-catalog"
```

---

### Task 3: Convert robots.ts → robots.txt route handler with Content-Signal

**Files:**

- Create: `packages/frontend/app/robots.txt/route.ts`
- Test: `packages/frontend/app/robots.txt/route.test.ts`
- Delete: `packages/frontend/app/robots.ts`

**Interfaces:**

- Produces: `GET(): Promise<Response>` returning `text/plain` robots output (replaces the Next `MetadataRoute.Robots` default export).

- [ ] **Step 1: Confirm nothing imports the old robots module**

Run: `cd packages/frontend && npx rg -n "robots" --glob '!app/robots.ts' app lib`
Expected: no import of `app/robots` / `./robots` from other modules (matches, if any, are unrelated strings like crawler names). If a real import exists, stop and reconcile before deleting.

- [ ] **Step 2: Write the failing test**

`packages/frontend/app/robots.txt/route.test.ts`:

```ts
import { GET } from "./route";

describe("robots.txt route", () => {
  it("emits the Content-Signal directive under User-agent: *", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = await res.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain(
      "Content-Signal: search=yes, ai-input=yes, ai-train=no",
    );
  });

  it("preserves the existing allow/disallow + AI-bot rules + sitemap", async () => {
    const body = await (await GET()).text();
    expect(body).toContain("Allow: /");
    expect(body).toContain("Allow: /api/og");
    for (const path of [
      "/api/",
      "/admin/",
      "/auth/",
      "/account/",
      "/dev/",
      "/health/",
      "/betatest/",
    ]) {
      expect(body).toContain(`Disallow: ${path}`);
    }
    for (const bot of [
      "OAI-SearchBot",
      "ChatGPT-User",
      "Claude-SearchBot",
      "Claude-User",
      "PerplexityBot",
      "Bingbot",
      "GPTBot",
      "ClaudeBot",
      "Google-Extended",
    ]) {
      expect(body).toContain(`User-agent: ${bot}`);
    }
    expect(body).toContain("Sitemap: https://www.propertyiq.app/sitemap.xml");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/robots.txt/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 4: Implement the robots.txt route handler**

`packages/frontend/app/robots.txt/route.ts`:

```ts
// robots.txt emitted as a text route handler (not Next's MetadataRoute) so it can
// include a Content-Signal directive, which the metadata API can't express.
//
// AI policy (decoupled access vs. usage license): crawl ACCESS is granted to every
// bot — including the training crawlers — for max search + AI-citation reach, while
// the Content-Signal withholds a training LICENSE (ai-train=no). Bots that honor
// Content Signals refrain from training; the rest are bound only by directives they
// already ignore. (Supersedes the 2026-06-19 "training welcomed" rationale; the
// access list is unchanged.)
const allow = ["/", "/api/og"];
const disallow = [
  "/api/",
  "/admin/",
  "/auth/",
  "/account/",
  "/dev/",
  "/health/",
  "/betatest/",
];
const aiBots = [
  // Citation / search — eligibility to be cited in AI answers
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Bingbot",
  // Training — crawl allowed; training license withheld via Content-Signal
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
];
const SITEMAP = "https://www.propertyiq.app/sitemap.xml";
const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";

function group(userAgent: string, withSignal: boolean): string {
  const lines = [`User-agent: ${userAgent}`];
  for (const path of allow) lines.push(`Allow: ${path}`);
  for (const path of disallow) lines.push(`Disallow: ${path}`);
  if (withSignal) lines.push(`Content-Signal: ${CONTENT_SIGNAL}`);
  return lines.join("\n");
}

export async function GET(): Promise<Response> {
  const groups = [group("*", true), ...aiBots.map((bot) => group(bot, false))];
  const body = `${groups.join("\n\n")}\n\nSitemap: ${SITEMAP}\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
```

- [ ] **Step 5: Delete the old robots module**

```bash
git rm packages/frontend/app/robots.ts
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/robots.txt/route.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/app/robots.txt/route.ts \
        packages/frontend/app/robots.txt/route.test.ts
# (git rm already staged the deletion of app/robots.ts)
git diff --cached --name-only   # must list ONLY: the two new files + deleted app/robots.ts
git commit -m "feat(agent-discovery): robots.txt Content-Signal (search=yes, ai-input=yes, ai-train=no)"
```

---

### Task 4: Wire well-known rewrites + global Link header, verify end-to-end

**Files:**

- Modify: `packages/frontend/next.config.mjs` (add `rewrites()`; add `Link` to the `'/(.*)'` header block)

**Interfaces:**

- Consumes: the three handlers from Tasks 1–3 (reachable at `/api/agent-discovery/*` and `/robots.txt`).
- Produces: public `/.well-known/mcp/server-card.json`, `/.well-known/api-catalog`, and a `Link` header on every route.

- [ ] **Step 1: Add the `rewrites()` function**

In `packages/frontend/next.config.mjs`, inside the `nextConfig` object, add a `rewrites()` method immediately after the closing of `async redirects() { ... },` (before `async headers()`):

```js
  // Serve agent-discovery documents at their canonical well-known paths. Next's
  // App Router can't route dot-prefixed folders, so the real handlers live under
  // /api/agent-discovery/* and we rewrite the public paths to them.
  async rewrites() {
    return [
      {
        source: '/.well-known/mcp/server-card.json',
        destination: '/api/agent-discovery/server-card',
      },
      {
        source: '/.well-known/api-catalog',
        destination: '/api/agent-discovery/api-catalog',
      },
    ];
  },
```

- [ ] **Step 2: Add the `Link` header to the all-routes block**

In the `async headers()` return, in the first block (`source: '/(.*)'`), append one entry to its `headers` array (after the `Content-Security-Policy` entry, line ~170):

```js
          { key: 'Link', value: '</.well-known/api-catalog>; rel="api-catalog", </docs/mcp>; rel="service-doc"' },
```

- [ ] **Step 3: Production-preview build (isolated dist — never clobber dev `.next`)**

> Windows note: the Bash tool runs git-bash, so `VAR=val cmd` works. In PowerShell use `$env:NEXT_DIST_DIR='.next-verify'; npx next build --webpack`. Port 3100 is also the `dev:fresh` mobile-web instance — stop that stack first or this build/serve will collide on the port.

Run: `cd packages/frontend && NEXT_DIST_DIR=.next-verify npx next build --webpack`
Expected: build completes ("Compiled successfully" / route list printed), no errors.

- [ ] **Step 4: Serve the preview build in the background**

Run (Bash tool, background): `cd packages/frontend && NEXT_DIST_DIR=.next-verify npx next start -p 3100`
Then poll until ready: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/` returns `200`.

- [ ] **Step 5: Verify all four surfaces live**

```bash
# Server card (via rewrite)
curl -si http://localhost:3100/.well-known/mcp/server-card.json | head -n 20
#   Expect: 200, "Content-Type: application/json", JSON with serverInfo.name "propertyiq".

# API catalog (via rewrite, custom media type)
curl -si http://localhost:3100/.well-known/api-catalog | head -n 20
#   Expect: 200, "Content-Type: application/linkset+json", linkset JSON.

# Link header on the homepage
curl -sI http://localhost:3100/ | grep -i '^link:'
#   Expect: link: </.well-known/api-catalog>; rel="api-catalog", </docs/mcp>; rel="service-doc"

# Link header on a DEEP page (proves all-routes coverage, not just /)
curl -sI http://localhost:3100/docs/mcp | grep -i '^link:'
#   Expect: same Link header present.

# robots.txt Content-Signal + intact rules
curl -s http://localhost:3100/robots.txt
#   Expect: "Content-Signal: search=yes, ai-input=yes, ai-train=no" AND the
#   Disallow list, the named AI bots, and "Sitemap: https://www.propertyiq.app/sitemap.xml".
```

If `/.well-known/api-catalog` does NOT return 200 (middleware intercepted it): open `packages/frontend/middleware.ts`, add `\\.well-known` to the matcher's negative lookahead group (alongside `backend/`, `_next/static`, …), rebuild, and re-verify.

- [ ] **Step 6: Stop the preview server**

Stop the background server (kill the specific `next start` PID you started — do NOT blanket-kill all node if the user has dev servers running).

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/next.config.mjs
git diff --cached --name-only   # must list ONLY next.config.mjs
git commit -m "feat(agent-discovery): rewrite /.well-known/* to handlers + add Link header on all routes"
```

---

### Task 5: MCP server — additive server card route

**Files:**

- Create: `packages/mcp-server/src/lib/mcp-server-card.ts`
- Modify: `packages/mcp-server/src/routes/oauth-discovery-routes.ts` (add one `app.get` + one import)
- Test: `packages/mcp-server/src/routes/oauth-discovery-routes.test.ts`

**Interfaces:**

- Consumes: the existing `serverUrlFromRequest(req)` helper already used by the oauth handlers in `oauth-discovery-routes.ts`, and the exported `mountOAuthDiscoveryRoutes(app)`.
- Produces: `buildServerCard(serverUrl: string)` from `../lib/mcp-server-card`; an unauthenticated `GET /.well-known/mcp/server-card.json`.

- [ ] **Step 1: Write the failing test**

`packages/mcp-server/src/routes/oauth-discovery-routes.test.ts`:

```ts
import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { mountOAuthDiscoveryRoutes } from "./oauth-discovery-routes";

function buildApp() {
  const app = express();
  app.use(express.json());
  mountOAuthDiscoveryRoutes(app);
  return app;
}

describe("GET /.well-known/mcp/server-card.json", () => {
  it("serves an unauthenticated SEP-1649 server card derived from the request host", async () => {
    const res = await request(buildApp())
      .get("/.well-known/mcp/server-card.json")
      .set("Host", "mcp.propertyiq.app");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body.serverInfo).toEqual({
      name: "propertyiq",
      version: "0.2.0",
    });
    expect(res.body.transport).toEqual({
      type: "streamable-http",
      endpoint: "https://mcp.propertyiq.app/mcp",
    });
    expect(res.body.capabilities.tools).toBeDefined();
    expect(res.body.authentication).toEqual({
      type: "oauth2.1",
      metadata:
        "https://mcp.propertyiq.app/.well-known/oauth-protected-resource",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/mcp-server && npx vitest run src/routes/oauth-discovery-routes.test.ts`
Expected: FAIL — route returns 404 (handler not added yet) or `buildServerCard` import unresolved.

- [ ] **Step 3: Create the card builder module**

`packages/mcp-server/src/lib/mcp-server-card.ts`:

```ts
// MCP Server Card (SEP-1649), built from this server's identity. name/version are
// inline to match the existing inline usages in server.ts / http.ts / api-routes.ts
// (they are not exported as constants).
// keep in sync with packages/mcp-server/src/server.ts
export function buildServerCard(serverUrl: string) {
  return {
    serverInfo: { name: "propertyiq", version: "0.2.0" },
    transport: { type: "streamable-http", endpoint: `${serverUrl}/mcp` },
    capabilities: { tools: {} },
    authentication: {
      type: "oauth2.1",
      metadata: `${serverUrl}/.well-known/oauth-protected-resource`,
    },
    documentation: "https://www.propertyiq.app/docs/mcp",
  };
}
```

- [ ] **Step 4: Add the route (additive only)**

In `packages/mcp-server/src/routes/oauth-discovery-routes.ts`:

1. Add the import near the existing imports (the metadata import block, ~line 13):

```ts
import { buildServerCard } from "../lib/mcp-server-card";
```

2. Inside `mountOAuthDiscoveryRoutes(app)`, immediately after the existing `app.get("/.well-known/oauth-authorization-server", …)` handler closes (~line 42), add:

```ts
app.get("/.well-known/mcp/server-card.json", (req, res) => {
  const serverUrl = serverUrlFromRequest(req);
  console.log(
    `[MCP] GET /.well-known/mcp/server-card.json | server=${serverUrl}`,
  );
  res.json(buildServerCard(serverUrl));
});
```

Do not touch the two existing oauth handlers or anything else in the file.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/mcp-server && npx vitest run src/routes/oauth-discovery-routes.test.ts`
Expected: PASS (1 passed).

- [ ] **Step 6: Verify the package still builds and the full suite is green**

Run: `cd packages/mcp-server && npm run build && npm test`
Expected: `tsc` exits 0; vitest reports all tests passing (no regressions in the existing route/oauth tests).

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/mcp-server/src/lib/mcp-server-card.ts \
        packages/mcp-server/src/routes/oauth-discovery-routes.ts \
        packages/mcp-server/src/routes/oauth-discovery-routes.test.ts
git diff --cached --name-only   # must list ONLY the three files above
git commit -m "feat(mcp-server): serve MCP server card at /.well-known/mcp/server-card.json (additive)"
```

---

### Task 6: Definition of Done (post-deploy live verification — no code)

> This task is a checklist, not a code change. It runs after the user pushes and the frontend + MCP server deploy. Do not mark the feature complete until every box is checked.

- [ ] **Frontend (www) live:**
  - `curl -si https://www.propertyiq.app/.well-known/mcp/server-card.json` → 200, `application/json`, valid card.
  - `curl -si https://www.propertyiq.app/.well-known/api-catalog` → 200, `application/linkset+json`, valid linkset.
  - `curl -sI https://www.propertyiq.app/ | grep -i '^link:'` and the same on a deep market/blog page → both show the Link header.
  - `curl -s https://www.propertyiq.app/robots.txt` → Content-Signal line present; Disallow list, AI bots, and Sitemap intact.
- [ ] **MCP server live (after its Railway deploy):**
  - `curl -si https://mcp.propertyiq.app/.well-known/mcp/server-card.json` → 200, `application/json`, valid card.
  - Regression: `curl -s https://mcp.propertyiq.app/.well-known/oauth-protected-resource` and `…/health` still return their original 200 JSON; a normal tool call still works.
- [ ] **Audit:** Re-run isitagentready.com against `www.propertyiq.app` and confirm the four flagged checks (Link headers, API catalog, MCP Server Card, Content Signals) now pass.

---

## Self-Review

**Spec coverage:** Server card on www (Task 1) + mcp.propertyiq.app (Task 5) → spec §2.1/§4#7 ✅. API catalog, MCP-only anchor (Task 2) → §2.2/§4#5/§6.3 ✅. Link header all routes (Task 4) → §2.3/§4#4/§6.4 ✅. robots Content-Signal, decoupled stance (Task 3) → §2.4/§4#6/§6.5 ✅. Option Y serving via rewrites + shared manifest (Tasks 1/2/4) → §3 architecture/§5.1 ✅. Middleware passthrough check + fallback (Task 4 Step 5) → §5.1/§10.1 ✅. robots-import check before delete (Task 3 Step 1) → §10.2 ✅. MCP additive route at the oauth-discovery insertion point (Task 5) → §5.2/§10.3 ✅. Live verification (Tasks 4 & 6) → §8 ✅.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every run step has a command + expected output.

**Type consistency:** `AGENT_DISCOVERY.mcp.{name,version,endpoint,transport,auth,openapi,health,docs,oauthProtectedResource}` defined in Task 1 and consumed identically in Task 2. `GET(): Promise<Response>` signature consistent across Tasks 1–3. `buildServerCard(serverUrl)` defined and consumed in Task 5. Card shape identical between the www handler (Task 1) and the mcp-server builder (Task 5).
