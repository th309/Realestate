# Agent-Readiness (Tier 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve `/auth.md` (agent auth guide) + an additive `agent_auth` block in the MCP OAuth metadata, and `Accept: text/markdown` content negotiation that returns the markdown source of blog posts and the methodology page (HTML stays the browser default).

**Architecture:** Frontend (`packages/frontend`, Next.js 16 App Router). `/auth.md` is a route handler built from the existing `lib/agent-discovery/manifest.ts`. Markdown-for-Agents: a pure resolver (`lib/agent-markdown/resolve.ts`) maps a pathname → markdown (blog via `@/lib/blog`, methodology via a shared `lib/scores/methodology-report.ts`); a route handler wraps it; an early `middleware.ts` branch rewrites `Accept: text/markdown` content requests to that handler (forwarding the original path as `?path=`), with `Vary: Accept`. One additive field in `packages/mcp-server` OAuth metadata.

**Tech Stack:** Next.js 16 (route handlers, middleware, `next.config.mjs`), Vitest (frontend + mcp-server), Express (mcp-server), TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-25-agent-readiness-tier2-design.md`

## Global Constraints

- **Branch:** Work on `develop`. Run `git branch --show-current` immediately before every commit (parallel git ops happen on this repo).
- **Commits:** Stage with an **explicit pathspec** (only the task's files); verify with `git diff --cached --name-only` before committing. **Never push.** No `Co-Authored-By`. End every commit message with: `Claude-Session: https://claude.ai/code/session_01GYkHF6W2xWFUqnRML27ynx`.
- **Response pattern:** Frontend route handlers return a bare `new Response(body, { headers })`.
- **Single source of truth:** `/auth.md` content derives URLs from `AGENT_DISCOVERY` in `lib/agent-discovery/manifest.ts` — no new hardcoded URLs in the handler.
- **MCP change is additive only:** add one `agent_auth` field; do not modify any existing field/route/behavior. (Project rule: MCP changes preserve exact I/O behavior.)
- **Markdown scope:** only `/blog/{slug}` and `/scores/methodology`. Everything else resolves to `null`.
- **MDX served verbatim** (no JSX→markdown sanitizer in v1).
- **`Vary: Accept`** on both representations of the negotiated URLs (cache correctness).
- **Public URLs only**, no secrets.

---

### Task 1: `/auth.md` route handler + manifest field (www)

**Files:**

- Modify: `packages/frontend/lib/agent-discovery/manifest.ts` (add one field)
- Create: `packages/frontend/app/auth.md/route.ts`
- Test: `packages/frontend/app/auth.md/route.test.ts`

**Interfaces:**

- Consumes: `AGENT_DISCOVERY` from `@/lib/agent-discovery/manifest` (existing; gains `mcp.oauthAuthorizationServer`).
- Produces: `GET(): Promise<Response>` serving `text/markdown`.

- [ ] **Step 1: Write the failing test**

`packages/frontend/app/auth.md/route.test.ts`:

```ts
import { GET } from "./route";

describe("auth.md route", () => {
  it("serves an agent auth guide as text/markdown", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("# PropertyIQ — Agent Authentication");
    expect(body).toContain("https://mcp.propertyiq.app/register");
    expect(body).toContain(
      "https://mcp.propertyiq.app/.well-known/oauth-authorization-server",
    );
    expect(body).toContain("piq_live_");
    expect(body).toContain("/.well-known/api-catalog");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/auth.md/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Add the manifest field**

In `packages/frontend/lib/agent-discovery/manifest.ts`, inside the `mcp` object, immediately after the `oauthProtectedResource` entry, add:

```ts
    oauthAuthorizationServer:
      "https://mcp.propertyiq.app/.well-known/oauth-authorization-server",
```

- [ ] **Step 4: Implement the route handler**

`packages/frontend/app/auth.md/route.ts`:

```ts
import { AGENT_DISCOVERY } from "@/lib/agent-discovery/manifest";

// /auth.md — agent authentication guide (WorkOS auth.md convention), served as
// text/markdown so agents can discover how to authenticate to PropertyIQ.
export async function GET(): Promise<Response> {
  const { siteOrigin, mcp } = AGENT_DISCOVERY;
  const mcpOrigin = new URL(mcp.endpoint).origin;
  const body = `# PropertyIQ — Agent Authentication

PropertyIQ exposes its real-estate analytics to agents two ways.

## MCP (recommended for AI agents)

- Endpoint: \`${mcp.endpoint}\` (transport: ${mcp.transport})
- Auth: OAuth 2.1 + PKCE with dynamic client registration (RFC 7591).
  - Register: \`${mcpOrigin}/register\`
  - Authorize: \`${mcpOrigin}/authorize\`
  - Token: \`${mcpOrigin}/token\`
- Discovery metadata:
  - Protected resource (RFC 9728): ${mcp.oauthProtectedResource}
  - Authorization server (RFC 8414): ${mcp.oauthAuthorizationServer}
- Docs: ${mcp.docs}

## Platform API (REST)

- Authenticate with a bearer API key prefixed \`piq_live_\`.
- Get a key and the base URL from the API docs: ${siteOrigin}/docs/api

## Discovery

- API catalog: ${siteOrigin}/.well-known/api-catalog
- MCP server card: ${siteOrigin}/.well-known/mcp/server-card.json
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/auth.md/route.test.ts`
Expected: PASS (1 passed).

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/lib/agent-discovery/manifest.ts \
        packages/frontend/app/auth.md/route.ts \
        packages/frontend/app/auth.md/route.test.ts
git diff --cached --name-only   # must list ONLY those three files
git commit -m "feat(agent-discovery): serve /auth.md agent auth guide"
```

---

### Task 2: additive `agent_auth` block in MCP AS metadata (mcp-server)

**Files:**

- Modify: `packages/mcp-server/src/lib/oauth/metadata.ts` (add one field to `authorizationServerMetadata`)
- Test: `packages/mcp-server/src/lib/oauth/metadata.test.ts`

**Interfaces:**

- Consumes: existing `authorizationServerMetadata(serverUrl?)`.
- Produces: the same function, now returning an additional `agent_auth` member.

- [ ] **Step 1: Write the failing test**

`packages/mcp-server/src/lib/oauth/metadata.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { authorizationServerMetadata } from "./metadata";

describe("authorizationServerMetadata", () => {
  const md = authorizationServerMetadata("https://mcp.propertyiq.app");

  it("includes an additive agent_auth block", () => {
    expect(md.agent_auth).toEqual({
      register_uri: "https://mcp.propertyiq.app/register",
      identity_types_supported: ["dynamic_client"],
      credential_types_supported: ["oauth2_access_token", "api_key"],
    });
  });

  it("leaves the existing RFC 8414 fields unchanged", () => {
    expect(md.issuer).toBe("https://mcp.propertyiq.app");
    expect(md.authorization_endpoint).toBe(
      "https://mcp.propertyiq.app/authorize",
    );
    expect(md.token_endpoint).toBe("https://mcp.propertyiq.app/token");
    expect(md.registration_endpoint).toBe(
      "https://mcp.propertyiq.app/register",
    );
    expect(md.grant_types_supported).toEqual([
      "authorization_code",
      "refresh_token",
    ]);
    expect(md.code_challenge_methods_supported).toEqual(["S256"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/mcp-server && npx vitest run src/lib/oauth/metadata.test.ts`
Expected: FAIL — `md.agent_auth` is `undefined`.

- [ ] **Step 3: Add the `agent_auth` field**

In `packages/mcp-server/src/lib/oauth/metadata.ts`, in `authorizationServerMetadata`, add `agent_auth` as the final member of the returned object (after `token_endpoint_auth_methods_supported`), leaving every existing field untouched:

```ts
    token_endpoint_auth_methods_supported: ["none"],
    agent_auth: {
      register_uri: `${url}/register`,
      identity_types_supported: ["dynamic_client"],
      credential_types_supported: ["oauth2_access_token", "api_key"],
    },
```

- [ ] **Step 4: Run the focused test, then the full suite (no regressions)**

Run: `cd packages/mcp-server && npx vitest run src/lib/oauth/metadata.test.ts`
Expected: PASS (2 passed).
Run: `cd packages/mcp-server && npm run build && npm test`
Expected: tsc exits 0; full Vitest suite passes (the existing oauth/route tests still green — additive change).

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/mcp-server/src/lib/oauth/metadata.ts \
        packages/mcp-server/src/lib/oauth/metadata.test.ts
git diff --cached --name-only   # must list ONLY those two files
git commit -m "feat(mcp-server): add additive agent_auth block to oauth-authorization-server metadata"
```

---

### Task 3: shared methodology-report util + page refactor (www)

**Files:**

- Create: `packages/frontend/lib/scores/methodology-report.ts`
- Modify: `packages/frontend/app/(app)/scores/methodology/page.tsx` (use the shared util; drop the local helper)
- Test: `packages/frontend/lib/scores/methodology-report.test.ts`

**Interfaces:**

- Produces: `resolveMethodologyReportPath(): string` and `readMethodologyReport(): string` from `@/lib/scores/methodology-report`. Consumed by Task 4.

- [ ] **Step 1: Write the failing test**

`packages/frontend/lib/scores/methodology-report.test.ts`:

```ts
import {
  readMethodologyReport,
  resolveMethodologyReportPath,
} from "./methodology-report";

describe("methodology report reader", () => {
  it("resolves an existing path ending in validation-report.md", () => {
    expect(resolveMethodologyReportPath()).toMatch(/validation-report\.md$/);
  });

  it("reads non-empty markdown", () => {
    expect(readMethodologyReport().length).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/frontend && npx vitest run lib/scores/methodology-report.test.ts`
Expected: FAIL — cannot resolve `./methodology-report`.

- [ ] **Step 3: Create the shared util (lift the existing logic verbatim)**

`packages/frontend/lib/scores/methodology-report.ts`:

```ts
import fs from "fs";
import path from "path";

// Resolver/reader for the scoring methodology markdown (validation-report.md),
// shared by the methodology page AND the agent-markdown resolver so the
// dev-vs-standalone path logic lives in exactly one place.
//
// NOTE: the "(app)" route-group segment IS part of the on-disk path (it is only
// hidden from the URL). Omitting it makes both candidates miss → ENOENT.
export function resolveMethodologyReportPath(): string {
  const candidates = [
    // Co-located file (Docker/Vercel where docs/ isn't available)
    path.join(
      process.cwd(),
      "app",
      "(app)",
      "scores",
      "methodology",
      "validation-report.md",
    ),
    // Workspace root (Turbopack dev: cwd = workspace root)
    path.join(
      process.cwd(),
      "packages",
      "frontend",
      "app",
      "(app)",
      "scores",
      "methodology",
      "validation-report.md",
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

export function readMethodologyReport(): string {
  return fs.readFileSync(resolveMethodologyReportPath(), "utf-8");
}
```

- [ ] **Step 4: Point the methodology page at the shared util**

In `packages/frontend/app/(app)/scores/methodology/page.tsx`:

1. Add the import: `import { readMethodologyReport } from "@/lib/scores/methodology-report";`
2. Delete the local `resolveReportPath()` function (the `function resolveReportPath() { ... }` block, ~lines 88-118).
3. Change the read (line ~121) from `const reportContent = fs.readFileSync(resolveReportPath(), "utf-8");` to `const reportContent = readMethodologyReport();`
4. If `fs` and/or `path` are now unused in `page.tsx` (grep the file — they were only used by the deleted helper + the read), remove their top-of-file imports. If still referenced elsewhere, leave them.

- [ ] **Step 5: Run the test + verify the page typechecks**

Run: `cd packages/frontend && npx vitest run lib/scores/methodology-report.test.ts`
Expected: PASS (2 passed).
Run: `cd packages/frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "scores/methodology|methodology-report" || echo "no type errors in touched files"`
Expected: `no type errors in touched files` (the page + new util typecheck clean).

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/lib/scores/methodology-report.ts \
        packages/frontend/lib/scores/methodology-report.test.ts \
        "packages/frontend/app/(app)/scores/methodology/page.tsx"
git diff --cached --name-only   # must list ONLY those three files
git commit -m "refactor(scores): extract shared methodology-report reader"
```

---

### Task 4: markdown resolver + `/api/agent-markdown` route handler (www)

**Files:**

- Create: `packages/frontend/lib/agent-markdown/resolve.ts`
- Test: `packages/frontend/lib/agent-markdown/resolve.test.ts`
- Create: `packages/frontend/app/api/agent-markdown/route.ts`
- Test: `packages/frontend/app/api/agent-markdown/route.test.ts`

**Interfaces:**

- Consumes: `getPostBySlug`, `getAllSlugs` from `@/lib/blog`; `readMethodologyReport` from `@/lib/scores/methodology-report` (Task 3).
- Produces: `resolveMarkdown(pathname: string): string | null`; the route handler `GET(request: Request): Promise<Response>`.

- [ ] **Step 1: Write the failing resolver test**

`packages/frontend/lib/agent-markdown/resolve.test.ts`:

```ts
import { resolveMarkdown } from "./resolve";
import { getAllSlugs } from "@/lib/blog";

describe("resolveMarkdown", () => {
  it("returns markdown for a real blog post, prefixed with its title", () => {
    const slug = getAllSlugs()[0];
    expect(slug).toBeTruthy();
    const md = resolveMarkdown(`/blog/${slug}`);
    expect(md).not.toBeNull();
    expect(md!.startsWith("# ")).toBe(true);
  });

  it("returns markdown for the methodology page", () => {
    const md = resolveMarkdown("/scores/methodology");
    expect(md).not.toBeNull();
    expect(md!.length).toBeGreaterThan(100);
  });

  it("returns null for the blog index, a docs path, and a missing slug", () => {
    expect(resolveMarkdown("/blog")).toBeNull();
    expect(resolveMarkdown("/docs/mcp")).toBeNull();
    expect(resolveMarkdown("/blog/this-slug-does-not-exist-xyz")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/frontend && npx vitest run lib/agent-markdown/resolve.test.ts`
Expected: FAIL — cannot resolve `./resolve`.

- [ ] **Step 3: Implement the resolver**

`packages/frontend/lib/agent-markdown/resolve.ts`:

```ts
import { getPostBySlug } from "@/lib/blog";
import { readMethodologyReport } from "@/lib/scores/methodology-report";

// Map a content pathname to its markdown source for agent content negotiation.
// Returns null for any path with no markdown representation.
export function resolveMarkdown(pathname: string): string | null {
  const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    const post = getPostBySlug(blogMatch[1]);
    if (!post) return null;
    return `# ${post.frontmatter.title}\n\n${post.content}`;
  }
  if (pathname === "/scores/methodology") {
    return readMethodologyReport();
  }
  return null;
}
```

- [ ] **Step 4: Run the resolver test to verify it passes**

Run: `cd packages/frontend && npx vitest run lib/agent-markdown/resolve.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Write the failing route-handler test**

`packages/frontend/app/api/agent-markdown/route.test.ts`:

```ts
import { GET } from "./route";
import { getAllSlugs } from "@/lib/blog";

function req(path: string): Request {
  return new Request(
    `http://localhost/api/agent-markdown?path=${encodeURIComponent(path)}`,
  );
}

describe("agent-markdown route", () => {
  it("returns text/markdown with Vary + token headers for a blog post", async () => {
    const slug = getAllSlugs()[0];
    const res = await GET(req(`/blog/${slug}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    expect(res.headers.get("vary")).toBe("Accept");
    expect(Number(res.headers.get("x-markdown-tokens"))).toBeGreaterThan(0);
    expect((await res.text()).startsWith("# ")).toBe(true);
  });

  it("404s for an unsupported path", async () => {
    const res = await GET(req("/docs/mcp"));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd packages/frontend && npx vitest run app/api/agent-markdown/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 7: Implement the route handler**

`packages/frontend/app/api/agent-markdown/route.ts`:

```ts
import { resolveMarkdown } from "@/lib/agent-markdown/resolve";

// Markdown representation endpoint. middleware.ts rewrites content requests that
// carry `Accept: text/markdown` here, forwarding the original path as ?path=.
export async function GET(request: Request): Promise<Response> {
  const path = new URL(request.url).searchParams.get("path") ?? "";
  const markdown = resolveMarkdown(path);
  if (markdown === null) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      Vary: "Accept",
      "x-markdown-tokens": String(Math.ceil(markdown.length / 4)),
    },
  });
}
```

- [ ] **Step 8: Run the route-handler test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/api/agent-markdown/route.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 9: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/lib/agent-markdown/resolve.ts \
        packages/frontend/lib/agent-markdown/resolve.test.ts \
        packages/frontend/app/api/agent-markdown/route.ts \
        packages/frontend/app/api/agent-markdown/route.test.ts
git diff --cached --name-only   # must list ONLY those four files
git commit -m "feat(agent-markdown): resolver + /api/agent-markdown route handler"
```

---

### Task 5: middleware `Accept` branch + build tracing + live verification (www)

**Files:**

- Modify: `packages/frontend/middleware.ts` (early Accept-markdown branch + `Vary: Accept` on HTML pass-through)
- Modify: `packages/frontend/next.config.mjs` (`outputFileTracingIncludes` for `/api/agent-markdown`)

**Interfaces:**

- Consumes: the `/api/agent-markdown` handler from Task 4.
- Produces: same-URL `Accept: text/markdown` negotiation on `/blog/{slug}` + `/scores/methodology`.

- [ ] **Step 1: Add the middleware branch**

In `packages/frontend/middleware.ts`, immediately **after** the `propertyiq.up.railway.app` redirect block (the `if (host === "propertyiq.up.railway.app") { ... }` that ends ~line 85) and **before** the `/go/` short-link block, insert:

```ts
// Markdown for Agents: a request carrying `Accept: text/markdown` for a
// supported content route gets the markdown SOURCE; browsers (text/html) fall
// through to the normal HTML render. Public content — handled before the
// Supabase session refresh so it skips the getUser() round-trip. `Vary: Accept`
// keeps caches from cross-serving HTML and markdown for the same URL.
const mdPathname = request.nextUrl.pathname;
const isMarkdownContentRoute =
  /^\/blog\/[^/]+$/.test(mdPathname) || mdPathname === "/scores/methodology";
if (
  isMarkdownContentRoute &&
  (request.headers.get("accept") || "").includes("text/markdown")
) {
  const url = request.nextUrl.clone();
  url.pathname = "/api/agent-markdown";
  url.searchParams.set("path", mdPathname);
  const rewrite = NextResponse.rewrite(url);
  rewrite.headers.set("Vary", "Accept");
  return rewrite;
}
```

Then, at the **end** of the function, change the final `return supabaseResponse;` (line ~264) to set `Vary: Accept` for the HTML representation of those same routes first:

```ts
if (isMarkdownContentRoute) {
  supabaseResponse.headers.set("Vary", "Accept");
}
return supabaseResponse;
```

(`isMarkdownContentRoute` is declared in the early block and is in scope here. `/blog/{slug}` and `/scores/methodology` are not protected/auth/admin routes, so an HTML request for them reaches this final return.)

- [ ] **Step 2: Add the standalone-build tracing**

In `packages/frontend/next.config.mjs`, extend the existing `outputFileTracingIncludes` object with an entry for the markdown route (the handler reads `.mdx` blog files + the methodology `.md` at runtime, which Next does not auto-trace):

```js
  outputFileTracingIncludes: {
    '/scores/methodology': [
      './app/(app)/scores/methodology/validation-report.md',
    ],
    '/api/agent-markdown': [
      './content/blog/**',
      './app/(app)/scores/methodology/validation-report.md',
    ],
  },
```

- [ ] **Step 3: Production-preview build (isolated dist)**

> Bash tool = git-bash, so `VAR=val cmd` works. Port 3100 is the dev:fresh mobile-web instance — use a free port (3200). Build to `.next-verify` so no dev `.next` is clobbered.

Run: `cd packages/frontend && NEXT_DIST_DIR=.next-verify npx next build --webpack`
Expected: completes, exit 0; route list shows `ƒ /api/agent-markdown` and `○ /auth.md`.

- [ ] **Step 4: Serve + verify negotiation live**

Start (background): `cd packages/frontend && NEXT_DIST_DIR=.next-verify npx next start -p 3200`
Pick a real slug: `SLUG=$(ls packages/frontend/content/blog | grep '\.mdx$' | head -1 | sed 's/\.mdx$//')`
Then:

```bash
B=http://localhost:3200
# 1. Blog markdown via Accept negotiation
curl -si -H 'Accept: text/markdown' "$B/blog/$SLUG" | grep -iE '^HTTP|^content-type|^vary'
#   Expect: 200, content-type: text/markdown, vary: Accept
curl -s  -H 'Accept: text/markdown' "$B/blog/$SLUG" | head -1
#   Expect: "# <title>"
# 2. Same URL, browser Accept → still HTML, Vary present
curl -sI -H 'Accept: text/html' "$B/blog/$SLUG" | grep -iE '^content-type|^vary'
#   Expect: content-type: text/html...; vary: Accept
# 3. Methodology markdown
curl -si -H 'Accept: text/markdown' "$B/scores/methodology" | grep -iE '^HTTP|^content-type'
#   Expect: 200, text/markdown
# 4. auth.md
curl -si "$B/auth.md" | grep -iE '^HTTP|^content-type'
#   Expect: 200, text/markdown
# 5. Out-of-scope path is NOT negotiated (stays HTML)
curl -sI -H 'Accept: text/markdown' "$B/docs/mcp" | grep -i '^content-type'
#   Expect: text/html (no markdown rewrite)
```

Then stop the server (kill only the PID on 3200; leave any backend on 3001 running).

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/middleware.ts packages/frontend/next.config.mjs
git diff --cached --name-only   # must list ONLY those two files
git commit -m "feat(agent-markdown): Accept: text/markdown negotiation in middleware + build tracing"
```

---

### Task 6: Definition of Done (post-deploy, no code)

> Checklist, runs after push + deploy.

- [ ] `curl -si https://www.propertyiq.app/auth.md` → 200 text/markdown.
- [ ] `curl -s -H 'Accept: text/markdown' https://www.propertyiq.app/blog/<slug>` → text/markdown body; same URL with `Accept: text/html` → HTML, `Vary: Accept`.
- [ ] `curl -s -H 'Accept: text/markdown' https://www.propertyiq.app/scores/methodology` → text/markdown.
- [ ] `curl -s https://mcp.propertyiq.app/.well-known/oauth-authorization-server` → includes `agent_auth.register_uri`; existing fields intact; regression check oauth-protected-resource + /health still 200.
- [ ] Re-run isitagentready.com.

---

## Self-Review

**Spec coverage:** auth.md doc (Task 1) → spec §5.1 ✅; `agent_auth` block (Task 2) → §5.2 ✅; methodology shared util (Task 3) → §6.1 ✅; resolver + route handler (Task 4) → §6.1/§6.2 ✅; middleware negotiation + `Vary` (Task 5) → §6.3 ✅; `outputFileTracingIncludes` (Task 5 Step 2) → §6.4 ✅; live verification (Task 5 Step 4 + Task 6) → §8 ✅. Non-goals (docs/agent-skills/data-page markdown, MDX sanitizer) not implemented ✅.

**Open items resolved:** §10.1 `frontmatter.title: string` confirmed (used in Task 4). §10.2 methodology helper lifted verbatim (Task 3). §10.3 no existing AS-metadata test → added (Task 2). §10.4 path forwarded via `?path=` query param (Task 5), not a header.

**Placeholder scan:** none — every code step shows full code; every run step has a command + expected output.

**Type consistency:** `resolveMarkdown(pathname): string | null` defined in Task 4, consumed by Task 4's route handler + Task 5's middleware (which calls the route, not the function). `readMethodologyReport()` / `resolveMethodologyReportPath()` defined in Task 3, consumed in Task 4. `AGENT_DISCOVERY.mcp.oauthAuthorizationServer` added in Task 1, used in Task 1. `getPostBySlug`/`getAllSlugs` from `@/lib/blog` (existing) used consistently.
