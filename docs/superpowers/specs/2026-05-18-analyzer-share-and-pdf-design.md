# Analyzer Share Link + White-Label PDF — Design Spec

**Date:** 2026-05-18
**Status:** Draft, pending user approval
**Origin:** The analyzer page currently shows a `Pro / Present / PDF` toolbar that is a UI stub — the `mode-context` provider has zero consumers outside the toolbar itself, so the buttons set state nothing reads. User asked to remove `Pro` and `Present`, add a real `Share` (link) button, and wire up `PDF` as a clean, professional, white-label-capable export.

## 1. Summary

Replace the stubbed three-pill toolbar with two real actions:

- **Share** — auto-saves the current analyzer state, mints a public share token, opens a modal with a live print preview and three distribution channels: Copy Link, Email, Download PDF.
- **PDF** — auto-saves silently, then downloads the white-label PDF directly without opening the modal. For users who only want the artifact, not the channels.

Both buttons funnel through the same backend pipeline:

1. `POST /api/analyzer/save` — reuses the existing `AnalyzerPersistenceService.save()` to insert a row in `deal_analyses` and mint a `share_token` (192-bit base64url, already implemented).
2. `POST /api/analyzer/pdf/:token` — new endpoint. Boots Puppeteer, navigates to `/shared/analysis/:token?print=1`, prints to PDF buffer, streams back as `application/pdf`.

The visual design lives in **one place**: the public share page at `app/shared/analysis/[token]/page.tsx`. Without `?print=1` it is the share link recipient view; with `?print=1` it is the PDF render source. One template, two outputs, white-label branding written once.

White-label branding reuses the existing org-scoped branding system (already powering embeds). Branding fields live as columns on the `organizations` table (`logo_url`, `accent_color`, `name`, `phone`, `website_url`, `support_email`, `report_header_text`, `report_footer_text`, `report_disclaimer`, `powered_by_visible`, …). Membership is single-org per user: `user_profiles.organization_id`. Resolution: saved-analysis `owner_id` → `user_profiles.organization_id` → `organizations` row → PropertyIQ default if any link is null. Applied to:

- Share page header (org logo + `organizations.name`)
- PDF header (org logo + name, every page)
- PDF footer (org `phone` + `website_url` + `report_disclaimer` + `page X of Y`, every page)
- Brand-colored accents on PDF (KPI tile borders, headings, dealgrade badge) — `organizations.accent_color` with PropertyIQ indigo (`#3949AB`) fallback
- `powered_by_visible` honored: if the org has set it to false, the PropertyIQ wordmark is omitted from PDF footer and share page

## 2. Goals & Non-Goals

### Goals

- Replace stubbed UI with real, working share + PDF flows on the analyzer page.
- Produce a PDF that looks professional enough that an agent can send it to a client without embarrassment.
- Reuse existing infrastructure: `deal_analyses` table, `share_token` minting, `get_shared_analysis` RPC, `/shared/analysis/[token]` route, the `organizations` branding columns and `OrgBrandingService`, Puppeteer (already in the content pipeline).
- Single visual source-of-truth: the share page is the PDF.
- Zero new browser-chrome bleed: PDF header/footer come from controlled HTML, not browser print defaults.

### Non-Goals

- **No per-user branding.** Org branding only. Solo users without an org get the PropertyIQ default look. Per-user branding is a future enhancement.
- **No client-side `@react-pdf/renderer` parallel render tree.** One template.
- **No share-link revocation or expiry UI** in this phase. The token is already long enough that practical leakage requires deliberate disclosure; rotation can come later if needed.
- **No anonymous-user share tokens.** Share is auth-gated. Anonymous users see "Sign in to share" instead.
- **No re-design of the analyzer's actual content.** Share and PDF render the same `Hero / ThreeStrategyGrid / MarketContextSection` already used by `/analyzer/saved/[id]` and `/shared/analysis/[token]`.
- **No replacement of the `usePDFExport.ts` window.print() pattern in `/reports/[id]`.** Reports stay as-is; this spec only touches the analyzer.

## 3. Scope

| In scope                                                                                                        | Out of scope                                                       |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Remove `mode-context.tsx`, `ModeToolbar.tsx`, and their tests                                                   | Touching the `usePDFExport.ts` pattern in `/reports/[id]/export/`  |
| New `ShareButton` + `PdfButton` components in `app/analyzer/components/chrome/`                                 | Per-user branding profile                                          |
| New `ShareAnalysisModal.tsx` mirroring `ShareMarketModal.tsx`                                                   | Sharing for unsigned/anonymous users                               |
| New `AnalyzerPdfService` wrapping Puppeteer                                                                     | A new content-pipeline-style render queue                          |
| New `POST /api/analyzer/pdf/:token` controller method                                                           | PDF generation for non-analyzer pages                              |
| Print stylesheet (`print-mode.css`) for `/shared/analysis/[token]?print=1`                                      | Visual redesign of the share page itself (only branding additions) |
| Org branding header + footer + brand-color accents on the share page                                            | Branding the analyzer-input view at `/analyzer`                    |
| Migration: alter `get_shared_analysis` RPC to also return public branding fields (no `owner_id` exposed)        | Adding new columns to `deal_analyses`                              |
| Migration: new public RPC `get_shared_analysis_branding(p_token)` returning branding only, for the print iframe | Modifying `organizations` schema                                   |

## 4. Architecture

### 4.1 Components added

```
packages/frontend/app/analyzer/components/chrome/
  ShareButton.tsx           # Toolbar pill — opens ShareAnalysisModal
  PdfButton.tsx             # Toolbar pill — direct PDF download path
  ShareAnalysisModal.tsx    # Mirrors ShareMarketModal pattern

packages/frontend/app/shared/analysis/[token]/
  page.tsx                  # MODIFIED: read branding via new RPC, accept ?print=1
  print-mode.css            # New: print-only stylesheet
  components/
    OrgBrandingHeader.tsx   # Logo + organizations.name (also used by PDF)
    OrgBrandingFooter.tsx   # phone + website_url + report_disclaimer (PDF only)

packages/backend/src/analyzer/
  analyzer.controller.ts    # MODIFIED: + pdfForToken() endpoint
  analyzer-pdf.service.ts   # New: Puppeteer wrapper
  analyzer.module.ts        # MODIFIED: provide AnalyzerPdfService

packages/frontend/lib/data/fetchers/
  analyzer.ts               # MODIFIED: + saveCurrentAnalysis(), + downloadAnalysisPdf(), + fetchSharedAnalysisBranding()

supabase/migrations/
  20260518000100_shared_analysis_branding.sql
```

### 4.2 Components removed

```
packages/frontend/app/analyzer/lib/mode-context.tsx
packages/frontend/app/analyzer/lib/__tests__/mode-context.test.tsx
packages/frontend/app/analyzer/components/chrome/ModeToolbar.tsx
packages/frontend/app/analyzer/components/chrome/__tests__/ModeToolbar.test.tsx
```

`AnalyzerClient.tsx` no longer wraps in `<ModeProvider>` and no longer imports `ModeToolbar`. The header renders `<ShareButton />` and `<PdfButton />` side-by-side instead.

### 4.3 Data flow

#### Share button

```
[Share] click in AnalyzerClient.tsx
  → if !isSignedIn → open auth-prompt modal, end
  → setSaveInProgress(true)
  → POST /api/analyzer/save  (with current analyzer state DTO)
       backend: AnalyzerPersistenceService.save()  →  { id, share_token }
  → setShareToken(token); open ShareAnalysisModal
     ShareAnalysisModal renders:
       - iframe src="/shared/analysis/:token?print=1"   (live preview)
       - Copy Link    → clipboard.writeText(shareUrl)
       - Email        → existing analyzer-share email service (already in repo for markets)
       - Download PDF → POST /api/analyzer/pdf/:token  →  blob  →  trigger download
```

#### PDF button (toolbar)

```
[PDF] click in AnalyzerClient.tsx
  → if !isSignedIn → open auth-prompt modal, end
  → setPdfInProgress(true)
  → POST /api/analyzer/save   →  { id, share_token }
  → POST /api/analyzer/pdf/:token  →  application/pdf blob
  → URL.createObjectURL(blob) + <a download="DealAnalysis-{address}.pdf">
  → setPdfInProgress(false)
```

The toolbar buttons disable while their respective flow is in flight. Both surface errors via toast.

#### PDF generation (server-side)

```
POST /api/analyzer/pdf/:token
  → AnalyzerPdfService.renderToBuffer(token)
       resolve INTERNAL_FRONTEND_URL from env
       launch / reuse Puppeteer browser (singleton)
       page = newPage()
       page.goto(`${INTERNAL_FRONTEND_URL}/shared/analysis/${token}?print=1`,
                 { waitUntil: 'networkidle0', timeout: 20000 })
       page.emulateMediaType('print')
       extract data-pdf-header / data-pdf-footer innerHTML from rendered page
       buffer = page.pdf({
         format: 'Letter',
         margin: { top: '0.7in', bottom: '0.7in', left: '0.5in', right: '0.5in' },
         displayHeaderFooter: true,
         headerTemplate: <extracted header HTML, wrapped in Puppeteer's required style>,
         footerTemplate: <extracted footer HTML with page X of Y>,
         printBackground: true,
       })
       page.close()
       return buffer
  → Controller streams buffer with:
       Content-Type: application/pdf
       Content-Disposition: attachment; filename="DealAnalysis-{slug(address)}.pdf"
```

### 4.4 Branding resolution

Membership is single-org per user: each user has at most one `user_profiles.organization_id` (see `packages/backend/src/organizations/invites.service.ts:153`). Branding fields live as columns on `organizations` (see `BRANDING_SELECT` in `packages/backend/src/org-branding/org-branding.service.ts`). No new resolver service is needed — the resolution is a single join.

The share page (and the PDF render that uses it) gets branding through a new public read-only RPC:

```sql
get_shared_analysis_branding(p_token text) RETURNS TABLE (
  logo_url            text,
  org_name            text,    -- alias of organizations.name
  accent_color        text,
  phone               text,
  website_url         text,
  support_email       text,
  report_disclaimer   text,
  report_header_text  text,
  report_footer_text  text,
  powered_by_visible  boolean
)
```

Implementation: `SECURITY DEFINER`, joins `deal_analyses → user_profiles → organizations` keyed by `share_token`. Returns NULL row when the token is invalid, the owner has no `organization_id`, or the org has no branding configured. The owner's `user_id` is never returned, preserving the same PII guarantees as `get_shared_analysis`.

This RPC is callable anonymously (the token is the capability), which is what lets the unauthenticated `/shared/analysis/[token]` page render branded output.

### 4.5 White-label rendering

`OrgBrandingHeader` component (used by share page + PDF):

```
┌────────────────────────────────────────────────────────────┐
│  [LOGO]   Company Name              Deal Analysis           │
└────────────────────────────────────────────────────────────┘
```

`OrgBrandingFooter` component (PDF only — share page uses the existing CTA):

```
┌────────────────────────────────────────────────────────────┐
│  contact@company.com · 555-1234 · company.com              │
│  This is not investment advice. {org disclaimer text}      │
│                                              Page 1 of 3   │
└────────────────────────────────────────────────────────────┘
```

Brand color accents on the share page apply via inline CSS variable injection from `organizations.accent_color`:

```tsx
<div
  style={
    {
      "--brand-primary": branding?.accent_color ?? "#3949AB",
    } as React.CSSProperties
  }
>
  ...
</div>
```

Existing components (`Hero`, `ThreeStrategyGrid`, KPI tiles) get a narrow set of `var(--brand-primary)` substitutions in places where they currently hardcode `bg-primary` / `text-primary`. The Tailwind tokens stay as-is for the rest of the platform; only the share/PDF view re-binds them.

When `branding.powered_by_visible === false`, the small "Powered by PropertyIQ" wordmark normally rendered in the PDF footer and share-page footer is suppressed entirely. Default behavior (null or true): wordmark shown.

## 5. Backend Detail

### 5.1 New service: `AnalyzerPdfService`

Location: `packages/backend/src/analyzer/analyzer-pdf.service.ts`.

Public surface:

```typescript
class AnalyzerPdfService {
  async renderToBuffer(token: string): Promise<Buffer>;
}
```

Implementation notes:

- Uses a singleton `puppeteer.launch()` browser, opened lazily on first call, kept alive across requests with a 5-minute idle timeout. Mirrors `puppeteer-lead-magnet-renderer.ts` lifecycle.
- Reads `INTERNAL_FRONTEND_URL` from env. On Railway this should be set to the public frontend URL (`https://propertyiq.up.railway.app`); local dev defaults to `http://localhost:3000`. Must crash on missing env per CLAUDE.md §1.2 ("No Defaults").
- If render fails or times out, throws with a descriptive message; controller turns into a 500 with a sanitized error message.
- Adds `console` event listener; logs frontend-side errors during render so we can debug missing data / failed renders without re-deploying.

### 5.2 Controller method

`packages/backend/src/analyzer/analyzer.controller.ts`:

```typescript
@Post('pdf/:token')
async pdfForToken(@Param('token') token: string, @Res() res: Response) {
  const buffer = await this.pdfService.renderToBuffer(token);
  const row = await this.persistence.getShared(token);
  const filename = `DealAnalysis-${slugify(row?.address_city ?? 'analysis')}.pdf`;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length.toString(),
  }).send(buffer);
}
```

Auth: anyone with the share token can render the PDF — the token itself is the entitlement, same model as the share page. This matches user expectation ("the link works for the recipient, including downloading a PDF").

### 5.3 Migration

`supabase/migrations/20260518000100_shared_analysis_branding.sql`:

Adds **one new** `SECURITY DEFINER` function — `get_shared_analysis_branding(p_token text)` — that joins `deal_analyses → user_profiles → organizations` and returns the public-safe branding fields listed in §4.4. The existing `get_shared_analysis(p_token text)` function is **not modified**, preserving its current PII-stripping contract.

Two-RPC design rationale: the existing `get_shared_analysis` already returns the analysis payload the share page needs to render. Adding branding to it would force every caller (including the existing saved view) to absorb the join cost. A separate branding RPC keeps the two concerns isolated and lets the share page fire both queries in parallel.

Grants: `GRANT EXECUTE ON FUNCTION get_shared_analysis_branding(text) TO anon, authenticated;` — both client roles need this for the share page and the Puppeteer-driven print page.

## 6. Frontend Detail

### 6.1 `ShareButton` and `PdfButton`

Both are filled-tonal pills, side-by-side, in the analyzer header where `ModeToolbar` lives today:

```tsx
<header className="flex items-center justify-between mb-4 gap-4">
  <h1 className="text-xl md:text-2xl font-bold text-on-surface">
    Deal Analyzer
  </h1>
  <div className="flex items-center gap-2">
    <PdfButton />
    <ShareButton />
  </div>
</header>
```

Each button has its own loading + disabled state. `ShareButton` is primary (filled `bg-primary text-on-primary rounded-full`); `PdfButton` is tonal (`bg-surface-container-low text-on-surface rounded-full`).

### 6.2 `ShareAnalysisModal`

Structure mirrors `ShareMarketModal.tsx`:

```
┌─ Share this analysis ─────────────────────── [X] ─┐
│                                                    │
│  Preview                                           │
│  ┌──────────────────────────────────────────────┐ │
│  │ <iframe src=/shared/analysis/:token?print=1> │ │
│  │   ~40vh, with subtle border                  │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  Send via                                          │
│  [📎 Copy Link]  [✉ Email]                         │
│  [⤓ Download PDF]                                  │
│                                                    │
│  Recipients see your branding and the analysis.    │
│  They do not see your full address.                │
└────────────────────────────────────────────────────┘
```

Three channels:

- **Copy Link** — `navigator.clipboard.writeText(${origin}/shared/analysis/${token})`, then "Copied!" check for 2s.
- **Email** — opens an inline email form (same pattern as `ShareMarketModal`); POSTs to a new `POST /api/analyzer/share/email` endpoint that wraps existing email infrastructure (`packages/backend/src/email/`).
- **Download PDF** — POSTs to `/api/analyzer/pdf/:token`, gets blob, triggers download. Shows spinner while in flight.

Anonymous-user variant: same modal shell, but body says "Sign in to share this analysis" with a sign-in CTA. The analyzer state is preserved across the auth round-trip via `?address=…&zip=…` deep-link params already supported by `AnalyzerClient`.

### 6.3 `app/shared/analysis/[token]/page.tsx` changes

```tsx
const [row, branding] = await Promise.all([
  fetchSharedAnalysis(token),
  fetchSharedAnalysisBranding(token), // new RPC; returns null if owner has no org
]);
if (!row) notFound();

const isPrintMode = (await searchParams)?.print === "1";

return (
  <main
    className={`min-h-screen bg-surface ${isPrintMode ? "print-mode" : ""}`}
    style={
      {
        "--brand-primary": branding?.accent_color ?? "#3949AB",
      } as React.CSSProperties
    }
  >
    <div className="max-w-5xl mx-auto px-6 py-12">
      <OrgBrandingHeader branding={branding} subtitle="Deal Analysis" />

      <PropertyHeader address={heading} piqByGeo={null} />

      <div className="space-y-6">
        <Hero verdict={verdict} kpiTiles={kpiTiles} />
        <ThreeStrategyGrid strategies={strategyCards} />
        {row.market_context && <MarketContextSection {...marketProps} />}
      </div>

      {isPrintMode ? (
        <OrgBrandingFooter branding={branding} />
      ) : (
        <footer className="mt-12 pt-6 border-t border-outline-variant text-center">
          {/* existing CTA — adapted to use org branding contact if present */}
        </footer>
      )}

      {/* Hidden header/footer source for Puppeteer to extract */}
      {isPrintMode && (
        <>
          <div data-pdf-header style={{ display: "none" }}>
            <OrgBrandingHeader
              branding={branding}
              subtitle="Deal Analysis"
              compact
            />
          </div>
          <div data-pdf-footer style={{ display: "none" }}>
            <OrgBrandingFooter branding={branding} compact />
          </div>
        </>
      )}
    </div>
  </main>
);
```

`print-mode.css`:

- `body { background: white; }`
- Hide the bottom CTA, any nav, any interactive controls.
- `page-break-inside: avoid` on `.strategy-card`, `.kpi-tile`, `.market-context-section`.
- `page-break-after: always` between major sections (KPI strip → strategy grid → market context).
- Tighten vertical spacing by ~20% so the printed analysis fits in fewer pages.

## 7. Error Handling

| Failure                                           | User-visible behavior                                                                                                 | Backend behavior                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Save fails (DB down)                              | Toast: "Could not save. Please try again." Buttons re-enable.                                                         | 500 with error; logged.                              |
| Save succeeds, PDF render times out (>20s)        | Modal shows: "PDF render failed. The link still works — try again or copy the link." Copy Link + Email remain usable. | 504; logged with token + duration.                   |
| Puppeteer crashes mid-render                      | Same as timeout — user sees PDF failure, link still works.                                                            | Browser singleton resets on next call. Error logged. |
| Share page (with `?print=1`) errors during render | PDF endpoint catches console errors, returns 500 with sanitized message.                                              | Frontend errors logged for diagnosis.                |
| Invalid / expired token                           | PDF endpoint returns 404.                                                                                             | `getShared(token)` returns null.                     |
| Anonymous user clicks Share or PDF                | Modal: "Sign in to share — your work is preserved." Address deep-linked through auth.                                 | No backend call.                                     |
| Org branding lookup fails                         | Falls back to PropertyIQ defaults silently.                                                                           | Logged at WARN, does not fail render.                |

## 8. Testing

### 8.1 Unit (backend)

- `AnalyzerPdfService.renderToBuffer` calls Puppeteer with the right URL + header/footer HTML extracted from rendered page.
- Falls back to PropertyIQ default header when `get_shared_analysis_branding` returns null (owner has no org or org has no branding configured).
- New `get_shared_analysis_branding` RPC returns expected columns when owner's `user_profiles.organization_id` resolves to an `organizations` row; returns null row when the owner has no organization. SQL-level test under `supabase/tests/` (mirroring existing migration test patterns).

### 8.2 Unit (frontend)

- `ShareAnalysisModal` opens → auto-save fires once → modal shows preview iframe + 3 channel buttons.
- Anonymous user sees auth prompt, no save fires.
- `ShareButton` and `PdfButton` correctly disable while their flow is in flight.

### 8.3 E2E (backend)

- `POST /api/analyzer/pdf/:token` with seeded saved analysis returns `application/pdf` and a buffer > 10KB.
- Same endpoint with invalid token returns 404.

### 8.4 E2E (Playwright)

- Full happy path: visit `/analyzer` → fill in property → click Share → modal opens → click Copy Link → assert clipboard contents → open copied URL → assert branded share page renders (org logo visible if user is in an org, default if not).
- PDF flow: click `[PDF]` toolbar button → wait for download → assert downloaded file is `application/pdf` and > 10KB.
- Print-mode preview iframe inside the modal renders without console errors.

### 8.5 Visual regression

- Take a Playwright screenshot of `/shared/analysis/:token?print=1` for both a branded org (test fixture: logo, primary color, disclaimer) and an unbranded user (PropertyIQ default).
- Diff against checked-in fixtures. CI flags any visual delta over a small tolerance.

## 9. Telemetry

Track these events through the existing `user_events` table (see [Activation Funnel project memory](project_activation-funnel.md)):

- `analyzer_share_button_clicked` (with `is_signed_in`)
- `analyzer_pdf_button_clicked` (with `is_signed_in`)
- `analyzer_share_link_copied`
- `analyzer_pdf_downloaded` (with `from_modal | from_toolbar`)
- `analyzer_share_email_sent`
- `analyzer_share_anonymous_signin_prompt_shown`

## 10. Open Risks

1. **Puppeteer on Railway.** The analyzer backend service may not have Chromium available out of the box. Mitigation: confirm during plan, install via nixpacks if needed, mirror the working content-pipeline service config.
2. **`INTERNAL_FRONTEND_URL` env var.** Backend reaching the frontend over the public URL works but is wasteful. Investigate Railway internal hostname during plan. Crash on missing env per CLAUDE.md §1.2.
3. **Print-mode CSS coverage.** First PDF render may show layout quirks (charts that don't paginate cleanly, KPI tile borders that disappear in print). Plan should include a "PDF visual polish" task after the first end-to-end test.
4. **Embedded `<iframe>` of `/shared/analysis/[token]?print=1` in modal.** Browsers may block same-origin iframes if any CSP rule is set. Verify against the existing `next.config.js` CSP, relax for the shared route if needed.
5. **Render duration.** First PDF render (cold Puppeteer) may take 8-10s. Subsequent renders, ~2-3s. Add a loading spinner with a "this can take a few seconds" message after 3s.

## 11. Rollout

- Single-PR feature off `feat/deal-analyzer` (current branch). No feature flag — the change is opt-in by clicking the new buttons, and the toolbar swap is purely visual.
- After merge to develop, hit staging with a sample analysis, download the PDF, eyeball it, then promote to prod.
- Post-launch: monitor `analyzer_pdf_downloaded` and PDF endpoint p95 latency. If render time consistently exceeds 6s, revisit Puppeteer warm-pool sizing.
