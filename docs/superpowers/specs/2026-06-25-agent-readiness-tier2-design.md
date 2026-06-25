# Agent-Readiness (Tier 2) — Design Spec

- **Date:** 2026-06-25
- **Status:** Approved (brainstorming) — pending implementation plan
- **Scope:** Frontend (`packages/frontend`) + one additive field in `packages/mcp-server` OAuth metadata. No backend changes.
- **Owner:** th309
- **Builds on:** `docs/superpowers/specs/2026-06-25-agent-readiness-tier1-design.md` (shipped + live).

## 1. Context & Motivation

Tier 1 (MCP server card, API catalog, Link headers, robots Content-Signal) shipped and is live. Tier 2 picks up two of the remaining isitagentready.com recommendations, chosen by fit/effort:

- **auth.md** — a `/auth.md` doc + an `agent_auth` block in OAuth AS metadata, so agents can discover how to authenticate.
- **Markdown for Agents** — `Accept: text/markdown` returns a markdown rendering of content pages while HTML stays the browser default.

The third Tier 2 candidate (agent-skills index) was **rejected** (weak fit — PropertyIQ publishes no `SKILL.md` files; its agent capabilities are already exposed via MCP). Docs-page markdown was **excluded** (component-only TSX, no markdown source — would need lossy conversion or a sync-burden twin).

## 2. Goals

1. Serve `/auth.md` on `www.propertyiq.app` describing agent authentication, sourced from the existing manifest.
2. Add an additive `agent_auth` block to the MCP server's `oauth-authorization-server` metadata.
3. Serve `Accept: text/markdown` renderings of **blog posts** (`/blog/{slug}`) and the **methodology page** (`/scores/methodology`) via same-URL content negotiation; HTML stays the default.

## 3. Non-Goals (explicitly out of scope)

- **Docs-page markdown** (`/docs/mcp`, `/docs/api`) — component-only; deferred.
- **agent-skills index** (`/.well-known/agent-skills/index.json`) — rejected (weak fit).
- **Data-driven page markdown** (market/screener pages) — no markdown source.
- **MDX → plain-markdown sanitizer** — v1 serves the raw `.mdx` body verbatim; embedded JSX components pass through. A sanitizer is a future enhancement, not v1.
- **Backend (NestJS) changes** — none.

## 4. Locked Decisions

| #   | Decision                   | Choice                                                                                           |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | Tier 2 surfaces            | auth.md + Markdown-for-Agents only                                                               |
| 2   | Markdown content scope     | Blog posts (`/blog/{slug}`) + methodology (`/scores/methodology`); **not** docs/data pages       |
| 3   | Markdown mechanism         | Same-URL `Accept: text/markdown` negotiation via an early `middleware.ts` branch → route handler |
| 4   | auth.md `agent_auth` block | **Include** — additive field in MCP `authorizationServerMetadata()`                              |
| 5   | MDX fidelity               | Serve raw `.mdx` body verbatim (no sanitizer in v1)                                              |

## 5. Feature A — `auth.md`

### 5.1 `www/auth.md`

- Handler: `app/auth.md/route.ts` (route handler, mirroring `app/robots.txt/route.ts`). Returns `Content-Type: text/markdown; charset=utf-8`, `Cache-Control: public, max-age=3600, s-maxage=3600`.
- Content built from `lib/agent-discovery/manifest.ts` (single source of truth). MCP auth endpoints are derived from the existing `mcp.endpoint` origin (`new URL(AGENT_DISCOVERY.mcp.endpoint).origin`) → `/register`, `/authorize`, `/token`, and the existing `mcp.oauthProtectedResource`; a new `mcp.oauthAuthorizationServer` field is added to the manifest for the link. The document covers:
  - **MCP access (recommended for agents):** endpoint `mcp.propertyiq.app/mcp`, OAuth 2.1 + PKCE, dynamic client registration at `/register`, pointers to `oauth-protected-resource` + `oauth-authorization-server` metadata; link to `/docs/mcp`.
  - **Platform API access:** REST with `piq_live_` bearer keys; link to `/docs/api` for key issuance + base URL (the raw backend host is intentionally **not** embedded — same rationale as Tier 1's catalog).
  - **Discovery links:** `/.well-known/api-catalog`, `/.well-known/mcp/server-card.json`.

### 5.2 `agent_auth` block (MCP server, additive)

- File: `packages/mcp-server/src/lib/oauth/metadata.ts`, function `authorizationServerMetadata(serverUrl)`.
- Add one field; **do not modify any existing field**:

```ts
agent_auth: {
  register_uri: `${url}/register`,
  identity_types_supported: ["dynamic_client"],
  credential_types_supported: ["oauth2_access_token", "api_key"],
},
```

- Additive and safe: RFC 8414 consumers ignore unknown members. No revocation endpoint exists, so `revocation` is omitted ("where applicable").
- Update the existing AS-metadata test (or add one) to assert `agent_auth.register_uri` is present **and** that the pre-existing fields (`issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `grant_types_supported`, `code_challenge_methods_supported`) are unchanged. Per project rule, the MCP change is additive only.

## 6. Feature B — Markdown for Agents (blog + methodology)

### 6.1 Resolver — `lib/agent-markdown/resolve.ts`

`resolveMarkdown(pathname: string): string | null`:

- `/blog/{slug}` (regex `^/blog/([^/]+)$`, excluding `rss.xml`): `getPostBySlug(slug)` from `@/lib/blog`; if `null` → `null`; else return `` `# ${post.frontmatter.title}\n\n${post.content}` `` (`post.content` is the raw markdown body, frontmatter already stripped by gray-matter).
- `/scores/methodology`: return the raw methodology markdown. To avoid duplicating the existing dev-vs-standalone path resolution in `app/(app)/scores/methodology/page.tsx`, extract that logic into a shared `lib/scores/methodology-report.ts` exporting `readMethodologyReport(): string`; the page and the resolver both call it (small DRY refactor — page behavior unchanged).
- anything else → `null`.

### 6.2 Route handler — `app/api/agent-markdown/route.ts`

- Reads the intended pathname from the request header `x-md-pathname` (set by middleware), calls `resolveMarkdown`.
- `null` → `404` (plain text "Not found").
- else → `200`, `Content-Type: text/markdown; charset=utf-8`, `Vary: Accept`, `Cache-Control: public, max-age=3600, s-maxage=3600`, and `x-markdown-tokens: <ceil(len/4)>` (rough token estimate; the audit notes this header "if available").

### 6.3 Middleware branch — `middleware.ts`

- Add an **early** branch (before host-redirect/session/A-B/auth — markdown is public, no session work needed). Condition: `request.headers.get("accept")?.includes("text/markdown")` **and** the pathname is a supported content route (`/^\/blog\/[^/]+$/` or `=== "/scores/methodology"`).
- On match: `NextResponse.rewrite(new URL("/api/agent-markdown", request.url))` with the original pathname forwarded via a request header `x-md-pathname`; set `Vary: Accept` on the response. Return immediately.
- For the **HTML pass-through** of those same two route patterns (non-markdown Accept), set `Vary: Accept` on the response so CDNs/caches never cross-serve HTML and markdown for one URL.
- Accept parsing is intentionally simple: presence of `text/markdown` in the Accept header. Browsers send `text/html,...` (no `text/markdown`) → unaffected.

### 6.4 Standalone build tracing (critical)

`app/api/agent-markdown/route.ts` reads `content/blog/*.mdx` and the methodology `.md` at runtime. Next's standalone build does not auto-trace dynamic `fs` reads (see the existing `outputFileTracingIncludes` note in `next.config.mjs` for `/scores/methodology`). **Add** `outputFileTracingIncludes` entries for `/api/agent-markdown` covering `./content/blog/**` and `./app/(app)/scores/methodology/validation-report.md`, or the route 500s in production.

## 7. Edge Cases / Non-Functional

- **Caching:** `Vary: Accept` on both representations of the negotiated URLs is mandatory (CDN correctness). Verified in the test/curl plan.
- **MDX fidelity:** blog bodies may contain JSX; served verbatim (documented non-goal to sanitize).
- **Public, no auth:** the markdown branch short-circuits before any auth/session logic; markdown content is already public (same content as the public HTML page).
- **Method:** `GET`/`HEAD` only for the markdown route; the negotiation is read-only.
- **No secrets;** `auth.md` references only public canonical URLs + doc pages.

## 8. Verification Plan (live, prod-preview — not mocked)

Build to `.next-verify`, `next start` on a free port, then:

1. `curl -s -H 'Accept: text/markdown' <base>/blog/<a-real-slug>` → `200`, `Content-Type: text/markdown`, body starts with `# <title>` then markdown.
2. `curl -sI <base>/blog/<slug>` (default `Accept: */*` or text/html) → still HTML; `Vary: Accept` present.
3. `curl -s -H 'Accept: text/markdown' <base>/scores/methodology` → `200`, `text/markdown`, the validation-report content.
4. `curl -si <base>/auth.md` → `200`, `text/markdown`, the auth doc.
5. `curl -s <base>/blog` (index) and `<base>/docs/mcp` with `Accept: text/markdown` → still HTML (not in scope; resolver returns null → no rewrite / 404 only on the api route).
6. MCP: `curl -s https://mcp.propertyiq.app/.well-known/oauth-authorization-server` (post-deploy) → includes `agent_auth.register_uri`; existing fields intact.
7. Re-run isitagentready.com.

## 9. Files Touched

**New**

- `packages/frontend/app/auth.md/route.ts`
- `packages/frontend/lib/agent-markdown/resolve.ts`
- `packages/frontend/app/api/agent-markdown/route.ts`
- `packages/frontend/lib/scores/methodology-report.ts`

**Modified**

- `packages/frontend/lib/agent-discovery/manifest.ts` (add `mcp.oauthAuthorizationServer`)
- `packages/frontend/middleware.ts` (early Accept-markdown branch + `Vary: Accept`)
- `packages/frontend/next.config.mjs` (`outputFileTracingIncludes` for `/api/agent-markdown`)
- `packages/frontend/app/(app)/scores/methodology/page.tsx` (use the extracted `readMethodologyReport()`)
- `packages/mcp-server/src/lib/oauth/metadata.ts` (additive `agent_auth` block) + its test

## 10. Open Verification Items (non-blocking, handled in the plan)

1. Confirm the exact `BlogFrontmatter.title` field name and `getPostBySlug` import path from `@/lib/blog` (resolver depends on them).
2. Confirm the methodology page's path-resolution helper name/shape before extracting it to `lib/scores/methodology-report.ts`.
3. Locate the existing test that covers `authorizationServerMetadata()` (or add one) for the `agent_auth` assertion.
4. Confirm `NextResponse.rewrite` with a modified request header (`x-md-pathname`) is read correctly by the route handler under the project's Next version (else pass the path via a query param).
