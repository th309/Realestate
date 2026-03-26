# API Documentation & Developer Experience Design

**Date:** 2026-03-26
**Status:** Approved
**Scope:** Improve API documentation, admin UI contextual help, and add health check endpoint

---

## Problem

Enterprise users have API keys but lack clear guidance on how to use them. The current docs page is a single long scroll aimed at developers. Many PropertyIQ enterprise users are brokerage admins who use Wix/Squarespace-level tools — they need copy-paste-friendly walkthroughs, not just endpoint references. There's also no way to verify a key works without hitting a real data endpoint.

## Audience

**Primary:** Non-technical brokerage admin who manages their own website and tools. Should be able to copy-paste a snippet and get data flowing.

**Secondary:** Developer or contractor hired to build integrations. Needs full technical reference, error handling patterns, and pagination details.

**Design principle:** Progressive disclosure — simple on top, technical depth underneath.

## Approach

**Progressive Enhancement + Admin UX** — Keep the existing endpoint reference (it's solid), wrap it in a tabbed layout, add missing sections (Getting Started, Use Cases, Troubleshooting), and add contextual help in the API keys admin page. Plus a new health check endpoint.

---

## 1. Docs Page Restructure (`/docs/api`)

### Tab Layout

| Tab                 | Audience             | Purpose                                                               |
| ------------------- | -------------------- | --------------------------------------------------------------------- |
| **Getting Started** | Layman / first-timer | Step-by-step from key creation to first API call                      |
| **Use Cases**       | All users            | 10 guided walkthroughs with copy-paste code                           |
| **API Reference**   | Developer            | Existing 12 endpoints + new health endpoint, scopes, response formats |
| **Troubleshooting** | All users            | Common errors in plain English, FAQ                                   |

- Default tab: **Getting Started**
- Navigation: horizontal tab bar, sticky at top of docs content
- Tabs update the URL hash (`/docs/api#getting-started`, `/docs/api#use-cases`, etc.) for deep linking
- **Hash behavior:** On page load, if a hash is present, open that tab. If no hash, default to Getting Started. Browser back/forward should switch tabs (push hash to history on tab click). Clicking a link like `/docs/api#troubleshooting` from another page (e.g., the admin panel) should open the correct tab on load.
- **Mobile:** On viewports < 768px, tabs render as a horizontal scroll strip (M3 scrollable tabs pattern). No dropdown or stacking.
- **Code snippets:** All code blocks across all tabs use the existing `CodeBlock` component with a "Copy" button and syntax highlighting. Multi-language examples (curl / JS / Python) use a language tab selector that persists the user's last choice via localStorage.

---

## 2. Getting Started Tab

**Content authorship:** All prose, code examples, and snippets in this tab and the Use Cases tab are authored during implementation — they are not pre-written. The implementer writes them following the outlines below.

Three steps. Plain English throughout. Jargon gets inline definitions on first use.

### Step 1: Create Your API Key

- Plain-English intro: "An API key is like a password that lets your other tools pull data from PropertyIQ automatically."
- Numbered walkthrough: Admin → API Keys → Create Key → Name it → Select scopes → Copy key
- Warning callout (red/amber): "Your key is shown only once. Copy it now and store it somewhere safe. If you lose it, you'll need to create a new one."
- Direct link: "Go to API Keys →"

### Step 2: Verify Your Key Works

- curl example hitting `GET /api/v1/health` with placeholder `YOUR_API_KEY`
- Expected success response shown (matches the canonical format from Section 7):
  ```json
  {
    "data": {
      "status": "ok",
      "organization": "Your Brokerage Name",
      "scopes": ["scores:read", "metrics:read"],
      "rate_limit_rpm": 120
    },
    "meta": { "request_id": "req_...", "timestamp": "..." }
  }
  ```
- Failure case: link to Troubleshooting tab with the specific error code

### Step 3: Make Your First Real Call

- Leads with reports (priority #1): "Generate a market report for any ZIP, county, or metro"
- curl example hitting `POST /api/v1/reports`
- Show response with report ID
- "Now what?" card linking to Use Cases tab

### Tone Guidelines

- No jargon without explanation
- First use of "endpoint": _(the URL you send your request to)_
- First use of "header": _(the line that tells our server who you are)_
- First use of "Bearer token": _(the word "Bearer" followed by your API key)_

---

## 3. Use Cases Tab

10 guided walkthroughs, each as a collapsible card (title + one-line description visible, click to expand). Ordered by user priority.

### Use Case 1: Auto-Generate Reports

- **Goal:** Create client-ready market reports on demand
- **Steps:** POST to create → poll GET for status → retrieve finished report with download URL
- **Code:** curl + JavaScript + Python
- **Tip:** "Trigger from CRM automation — when a new lead comes in, auto-generate a report for their market"

### Use Case 2: Embed a Score on Your Website

- **Goal:** Show a live PropertyIQ score on Wix, Squarespace, or WordPress
- **Steps:** Two options: (a) Use PropertyIQ's existing embed widget system (no API key needed — uses embed tokens), (b) API-based approach with a serverless proxy for full customization
- **Provides:** Ready-made embed snippet for option (a); proxy + render template for option (b)
- **Security note:** The snippet must NOT include the raw API key in client-side JavaScript. Option (a) uses embed tokens (separate, safe for browsers). Option (b) routes through a proxy. Guide explains tradeoffs: simplicity (embed widget) vs. customization (API + proxy).
- **Platform tips:** One-liner each for Wix (Custom Embed / Velo backend), Squarespace (Code Block / external proxy), WordPress (Custom HTML widget / shortcode plugin)

### Use Case 3: Pull Data into Google Sheets

- **Goal:** Get market metrics into a spreadsheet that updates automatically
- **Steps:** Google Sheets → Extensions → Apps Script → paste provided script → set daily trigger
- **Provides:** Complete Apps Script snippet (~15 lines)
- **Bonus:** "Works the same way with Excel + Power Automate"

### Use Case 4: Automated Client Alerts

- **Goal:** Email clients when their market score changes significantly
- **Steps:** Daily cron/Zapier pulls scores for watchlist markets → compares to previous → sends email if score moved > X points
- **Value:** Positions the agent as proactive — clients get "Your market just improved to 82" without asking

### Use Case 5: Market Comparison for Listing Presentations

- **Goal:** Pull side-by-side data for two markets to win a listing
- **Steps:** Fetch scores + key metrics for two ZIPs/metros → format into comparison table
- **Output:** Paste into pitch deck or print as one-pager
- **Value:** Agents do this manually with screenshots — API makes it live data

### Use Case 6: Monthly Market Newsletter

- **Goal:** Auto-generate a monthly market update email for your sphere
- **Steps:** Fetch top movers from rankings → pull metrics for focus markets → format into email template → send via Mailchimp/Resend/SendGrid
- **Value:** Creating newsletter content is the bottleneck — this automates the data portion

### Use Case 7: Website Market Pages

- **Goal:** Create dynamic market pages on your site that update automatically
- **Steps:** For each market, fetch scores + 5 key metrics → render a page
- **Works with:** Any site builder supporting custom code or a headless CMS
- **Value:** SEO-friendly, always-fresh content

### Use Case 8: Investor Pipeline Scoring

- **Goal:** Score every market in your pipeline and rank them
- **Steps:** Fetch rankings endpoint for a score type + geo level → filter to watchlist → output ranked spreadsheet
- **Value:** Investor-focused brokerages manage portfolios across many markets — this automates the analysis

### Use Case 9: Slack/Teams Market Alerts

- **Goal:** Get a daily market summary posted to your team's channel
- **Steps:** Fetch scores for your markets → format message → POST to Slack incoming webhook
- **Value:** Keeps the whole team informed without opening the dashboard

### Use Case 10: Connect to Your CRM or Dashboard

- **Goal:** Feed PropertyIQ data into internal tools
- **Content:** More technical — authentication pattern, pagination, error handling, retry logic
- **Code:** Node.js with axios, Python with requests + retry decorator
- **Covers:** Batch fetching, rate limit handling with exponential backoff, caching responses

### Card Format

Each card shows:

- Icon + title + one-line description (always visible)
- Difficulty badge: "Beginner" / "Intermediate" / "Advanced"
- Estimated setup time: "5 min" / "15 min" / "30 min"
- Click to expand full walkthrough

---

## 4. API Reference Tab

### Changes from current

- Existing 12 endpoints kept as-is (they're well-documented)
- Add the new `GET /api/v1/health` endpoint at the top
- Add language tabs to all code examples (curl / JavaScript / Python) — currently some only have curl
- No other structural changes — this tab is already the strongest section

---

## 5. Troubleshooting Tab

### "My key isn't working"

| What You See            | What It Means                                  | How to Fix It                                                                                 |
| ----------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `UNAUTHORIZED` (401)    | Key is missing, malformed, expired, or revoked | Check you included `Bearer ` prefix. Verify key in Admin → API Keys. If lost, create new one. |
| `API_KEY_EXPIRED` (401) | Key passed its expiration date                 | Create a new key in Admin → API Keys.                                                         |
| `API_KEY_REVOKED` (401) | Someone on your team revoked this key          | Check audit log. Create a new key.                                                            |

### "I'm getting an error on a specific endpoint"

| What You See               | What It Means                                 | How to Fix It                                                                          |
| -------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `INSUFFICIENT_SCOPE` (403) | Key doesn't have permission for this endpoint | Check scopes in Admin → API Keys. Update or create a new key with the needed scope.    |
| `RESOURCE_NOT_FOUND` (404) | Geography ID or resource doesn't exist        | Double-check geoLevel and geoId format. Use health endpoint to verify key works first. |
| `VALIDATION_ERROR` (400)   | Something wrong with request format           | Check request body against API Reference. Common issue: missing required fields.       |

### "I'm being rate limited"

- Plain English: "You're making too many requests too quickly"
- How to read `X-RateLimit-*` headers
- Simple backoff: "Wait until the time in X-RateLimit-Reset, then try again"
- Code snippet for automatic retry with backoff (JS + Python)
- "Need a higher limit? Update your key's RPM in Admin → API Keys"
- **Tip:** "The health endpoint (`GET /api/v1/health`) doesn't count against your rate limit — use it to verify your key still works while you wait for the limit to reset."

### "Everything looks right but I'm still stuck"

- Checklist: (1) Run health check (2) Check key isn't revoked (3) Check scopes (4) Try exact curl from Getting Started
- "Still stuck? Contact support at [email] with your request ID"

### FAQ

- "Can I have multiple API keys?" → Yes, one per integration for easy management.
- "What happens if I lose my key?" → Create a new one. Old key still works until revoked.
- "Is there a test environment?" → Not currently. Health endpoint verifies safely.
- "How fresh is the data?" → Metrics update monthly. Scores recalculate weekly.
- "Can I use the API from a browser?" → Yes, but store your key server-side. Never expose in client-side JavaScript.

---

## 6. Admin UI Contextual Help

### During Key Creation (CreateApiKeyDialog)

- **Scope checkboxes:** One-line helper under each group. E.g., under "Reports": _"Lets you auto-generate and retrieve market reports via the API"_
- **Rate limit dropdown:** Helper text: _"How many requests per minute this key can make. 60 is fine for most use cases. Increase if you're fetching data for many markets at once."_

### After Key Creation (KeyRevealDialog — embedded inside CreateApiKeyDialog)

Note: `KeyRevealDialog` is a sub-component rendered within `CreateApiKeyDialog.tsx` after key creation. All changes are in `CreateApiKeyDialog.tsx`.

- Strengthen warning: bold red callout — _"Copy this key now. It will never be shown again."_
- **"What's Next?" card** below the key (shown after the user copies or dismisses the reveal):
  1. "Verify your key works → [Test it now](/docs/api#getting-started)"
  2. "See what you can build → [Use case guides](/docs/api#use-cases)"
  3. "Full endpoint reference → [API Reference](/docs/api#reference)"

### API Keys List Page

- **Empty state:** Replace "No API keys yet" with: _"API keys let you pull PropertyIQ data into your website, spreadsheets, CRM, and automations. Create your first key to get started."_ + link to docs
- **API disabled state:** _"API access is available on Enterprise plans. Contact your account manager to enable it."_

### Each ApiKeyCard

- **Last used (never):** Show _"Never used — [See quickstart guide](/docs/api#getting-started)"_ instead of a dash
- **Scope badges:** Clickable — link to relevant endpoint section in API Reference

---

## 7. Health Check Endpoint

### Route

```
GET /api/v1/health
```

### Guards

- `ApiKeyAuthGuard` — validates the key
- No scope requirement — any valid key can hit it
- **Does not count against rate limit** — free for debugging

### Success Response (200)

```json
{
  "data": {
    "status": "ok",
    "organization": "Acme Realty Group",
    "scopes": ["scores:read", "metrics:read", "reports:read", "reports:write"],
    "rate_limit_rpm": 120
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-03-26T12:00:00Z"
  }
}
```

### Error Response (401)

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key",
    "request_id": "req_abc123"
  }
}
```

### Edge Cases

- **Zero-scope key:** Returns `"scopes": []`. The Getting Started tab should warn: "If your key has no scopes, the health check will pass but all data endpoints will return 403. Make sure to select at least one scope when creating your key."
- **Expiring key:** Include `"expires_at"` in the response (null if no expiration set). Helps users spot keys about to expire.
- **Specific error codes:** The health endpoint inherits the full error taxonomy from `ApiKeyAuthGuard` — it can return `API_KEY_EXPIRED` and `API_KEY_REVOKED`, not just generic `UNAUTHORIZED`.

### Implementation

- New controller: `health.controller.ts` in `packages/backend/src/platform-api/v1/`
- ~30 lines — reads org name, scopes, rate limit, and expiration from `request.apiKeyOrg` (set by the guard)
- **Throttle exemption:** Apply only `@UseGuards(ApiKeyAuthGuard)` on the health controller — omit `ApiThrottleGuard` from the decorator. While `ApiThrottleGuard` is registered as a shared provider in `platform-api.module.ts`, it is opt-in per controller via `@UseGuards`, not globally enforced. Existing v1 controllers all explicitly include it: `@UseGuards(ApiKeyAuthGuard, ApiThrottleGuard)`. The health controller simply leaves it out.
- Use `@UseInterceptors(ApiResponseInterceptor)` to keep the standard `{ data, meta }` envelope consistent with other v1 endpoints.
- No request body → no input DTO needed. Response shape is documented above; a response DTO/interface is optional (follow existing v1 pattern).

---

## 8. Architecture Notes

### Page.tsx is currently a Server Component

The existing `/docs/api/page.tsx` is a Server Component (no `'use client'`). Adding hash-based tab routing requires client-side state. **Solution:** Extract a `DocsPageClient.tsx` client component that handles tab state, hash routing, and renders the tab panels. The `page.tsx` server component imports and renders `DocsPageClient`.

### Existing sidebar navigation is replaced

The current page has a sticky left sidebar with 7 anchor links. The tab bar replaces this navigation pattern entirely. Within long tabs (like API Reference), internal scroll-based navigation can be added if needed.

### Existing CodeBlock has no syntax highlighting

The current `CodeBlock.tsx` is a plain `<pre><code>` with a copy button. No highlighting library is used. For this iteration, keep it simple — add the copy button UX and language label but defer syntax highlighting to a future enhancement. The `CodeTabs` component adds language selection but renders each language's code using the existing `CodeBlock`.

### Components live in `/components/` subdirectory

All existing docs components (`CodeBlock`, `EndpointsReference`, `CodeExamplesSection`, `api-docs-data.ts`) are in `app/docs/api/components/`. New files must follow this pattern.

---

## 9. Files to Create / Modify

### Backend (new)

- `packages/backend/src/platform-api/v1/health.controller.ts` — Health check endpoint

### Backend (modify)

- `packages/backend/src/platform-api/platform-api.module.ts` — Register `HealthV1Controller` in controllers array

### Backend (test)

- Health endpoint test — verify auth, response shape, throttle exemption, error codes (follow existing v1 test patterns in `packages/backend/test/enterprise/`)

### Frontend (new)

- `packages/frontend/app/docs/api/components/DocsPageClient.tsx` — Client component wrapper handling tab state + hash routing
- `packages/frontend/app/docs/api/components/GettingStartedTab.tsx` — Getting Started content
- `packages/frontend/app/docs/api/components/UseCasesTab.tsx` — Use Cases with collapsible cards
- `packages/frontend/app/docs/api/components/TroubleshootingTab.tsx` — Error guide + FAQ
- `packages/frontend/app/docs/api/components/UseCaseCard.tsx` — Reusable collapsible card component
- `packages/frontend/app/docs/api/components/CodeTabs.tsx` — Multi-language code example component (curl/JS/Python tabs with localStorage persistence). Renders each language via the existing `CodeBlock`. Replaces the sequential rendering in `CodeExamplesSection`.

### Frontend (modify)

- `packages/frontend/app/docs/api/page.tsx` — Simplify to server component shell that renders `DocsPageClient`
- `packages/frontend/app/docs/api/components/EndpointsReference.tsx` — Add health endpoint to reference, add anchor IDs to each endpoint section for scope badge deep linking
- `packages/frontend/app/docs/api/components/api-docs-data.ts` — Add health endpoint data, use case metadata, scope-to-anchor mapping
- `packages/frontend/app/docs/api/components/CodeExamplesSection.tsx` — Refactor to use `CodeTabs` instead of sequential rendering
- `packages/frontend/app/org/[slug]/admin/api-keys/page.tsx` — Empty state + disabled state copy
- `packages/frontend/app/org/components/CreateApiKeyDialog.tsx` — Scope helpers, rate limit helper, What's Next card in KeyRevealDialog sub-component (KeyRevealDialog is defined at the bottom of this same file)
- `packages/frontend/app/org/components/ApiKeyCard.tsx` — "Never used" quickstart link, clickable scope badges

---

## 9. Out of Scope (Future)

- API key rotation workflow (create new before revoking old)
- Usage analytics dashboard per key
- Interactive API playground / explorer in the docs
- SDK generation or official client libraries
- Webhook documentation
- Test/sandbox environment
