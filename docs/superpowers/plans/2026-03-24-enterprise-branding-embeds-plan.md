# Enterprise Branding & Embeds Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add org branding to reports and shared links, build embed token management, and create 3 embeddable widgets (score ring, metric card, interactive map) — all with org branding support.

**Architecture:** Extends the enterprise foundation (Plan 1). New NestJS modules for branding and embed tokens. New frontend admin pages for branding + embeds. New embed widget components with optional token-based auth + org branding. Existing BrandingProvider context wired to org data.

**Spec:** `docs/superpowers/specs/2026-03-24-enterprise-features-design.md` — Sections 4 (Embeddable Widgets) + 5 (Report Branding)

**Tech Stack:** NestJS (file upload, guards), Supabase (Storage for logos, embed token table), Mapbox GL (embed map), React (embed components), Tailwind CSS (M3 tokens).

**Depends on:** Plan 1 (Enterprise Foundation) — org tables, guards, admin portal layout.

**Followed by:** Plan 3 (Platform API).

---

## File Structure

### Backend — New Files

| File                                                                  | Responsibility                     |
| --------------------------------------------------------------------- | ---------------------------------- |
| `packages/backend/src/org-branding/org-branding.module.ts`            | Module registration                |
| `packages/backend/src/org-branding/org-branding.controller.ts`        | Branding CRUD + logo upload        |
| `packages/backend/src/org-branding/org-branding.service.ts`           | Branding logic + Supabase Storage  |
| `packages/backend/src/org-branding/dto/update-branding.dto.ts`        | Branding field validation          |
| `packages/backend/src/org-branding/org-branding-public.controller.ts` | Public branding endpoint (no auth) |
| `packages/backend/src/org-embeds/org-embeds.module.ts`                | Module registration                |
| `packages/backend/src/org-embeds/org-embeds.controller.ts`            | Embed token CRUD (admin)           |
| `packages/backend/src/org-embeds/org-embeds.service.ts`               | Token management logic             |
| `packages/backend/src/org-embeds/embed-token.guard.ts`                | Validates embed token + origin     |
| `packages/backend/src/org-embeds/embed-cors.interceptor.ts`           | Dynamic CORS per embed token       |
| `packages/backend/src/org-embeds/embed-data.controller.ts`            | Widget data endpoints              |
| `packages/backend/src/org-embeds/dto/create-embed-token.dto.ts`       | Token creation DTO                 |
| `scripts/migrations/118-org-logo-storage-bucket.sql`                  | Supabase Storage bucket for logos  |

### Backend — Modified Files

| File                                 | Change                                    |
| ------------------------------------ | ----------------------------------------- |
| `packages/backend/src/app.module.ts` | Import OrgBrandingModule, OrgEmbedsModule |

### Frontend — New Files

| File                                                                             | Responsibility                        |
| -------------------------------------------------------------------------------- | ------------------------------------- |
| `packages/frontend/app/org/[slug]/admin/branding/page.tsx`                       | Branding admin page                   |
| `packages/frontend/app/org/[slug]/admin/embeds/page.tsx`                         | Embed token admin page                |
| `packages/frontend/app/org/components/LogoUploader.tsx`                          | Drag-and-drop logo upload             |
| `packages/frontend/app/org/components/AccentColorPicker.tsx`                     | Color picker with presets             |
| `packages/frontend/app/org/components/BrandingPreview.tsx`                       | Live preview of branded report header |
| `packages/frontend/app/org/components/EmbedTokenCard.tsx`                        | Token card with origins + revoke      |
| `packages/frontend/app/org/components/CreateEmbedDialog.tsx`                     | Create token dialog                   |
| `packages/frontend/app/org/components/EmbedCodeSnippet.tsx`                      | Copyable iframe code                  |
| `packages/frontend/app/embed/components/EmbedShell.tsx`                          | Auth + branding resolver              |
| `packages/frontend/app/embed/components/EmbedBrandingBar.tsx`                    | Top bar: logo + accent color          |
| `packages/frontend/app/embed/components/EmbedScoreRing.tsx`                      | Score widget for embed                |
| `packages/frontend/app/embed/components/EmbedMetricCard.tsx`                     | Metric card for embed                 |
| `packages/frontend/app/embed/components/EmbedMiniMap.tsx`                        | Mapbox mini-map for embed             |
| `packages/frontend/app/embed/components/EmbedLoadingSkeleton.tsx`                | Branded loading state                 |
| `packages/frontend/app/embed/components/EmbedErrorState.tsx`                     | Error with retry                      |
| `packages/frontend/app/embed/metric-card/[metricId]/[geoLevel]/[geoId]/page.tsx` | Metric card embed page                |
| `packages/frontend/app/embed/map/[geoLevel]/page.tsx`                            | Map embed page                        |
| `packages/frontend/app/reports/hooks/useReportBranding.ts`                       | Fetch org branding for reports        |
| `packages/frontend/app/reports/[id]/components/BrandedReportHeader.tsx`          | Branded report header variant         |
| `packages/frontend/lib/data/fetchers/org-branding.ts`                            | Branding API calls                    |
| `packages/frontend/lib/data/fetchers/org-embeds.ts`                              | Embed token API calls                 |

### Frontend — Modified Files

| File                                                             | Change                                |
| ---------------------------------------------------------------- | ------------------------------------- |
| `packages/frontend/app/org/components/OrgAdminSidebar.tsx`       | Add Branding + Embeds nav links       |
| `packages/frontend/app/embed/layout.tsx`                         | Wrap with EmbedShell for branding     |
| `packages/frontend/app/embed/score/[geoLevel]/[geoId]/page.tsx`  | Use EmbedShell + EmbedScoreRing       |
| `packages/frontend/app/reports/[id]/components/ReportHeader.tsx` | Add branded header support            |
| `packages/frontend/app/shared/report/[token]/page.tsx`           | Pass org branding to BrandingProvider |
| `packages/frontend/lib/data/index.ts`                            | Export new fetchers                   |

### Test Files

| File                                                            | What It Tests                                          |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| `packages/backend/test/enterprise/branding.e2e-spec.ts`         | Logo upload, accent color, report branding             |
| `packages/backend/test/enterprise/embeds.e2e-spec.ts`           | Token CRUD, widget data, CORS, origin validation       |
| `packages/frontend/test/enterprise/embed-widgets.e2e-spec.ts`   | Playwright: widget rendering + branding                |
| `packages/frontend/test/enterprise/report-branding.e2e-spec.ts` | Playwright: branded report header in app + shared link |

---

## Task 1: Supabase Storage Bucket for Logos

**Files:**

- Create: `scripts/migrations/118-org-logo-storage-bucket.sql`

- [ ] **Step 1: Create migration for org-logos bucket**

```sql
-- Create org-logos bucket: public read, service_role write
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: anyone can read (logos appear on public shared reports + embeds)
-- Uploads/deletes handled server-side via service_role key (no client-side policy needed)
```

- [ ] **Step 2: Run migration**

Execute via Supabase Dashboard SQL Editor or psql.

- [ ] **Step 3: Commit**

```bash
git add scripts/migrations/118-org-logo-storage-bucket.sql
git commit -m "feat: add Supabase Storage bucket for org logos"
```

---

## Task 2: Org Branding Backend — Service, Controller, DTO

Build the branding management backend: update accent color, upload/delete logo, public branding endpoint for shared reports.

**PREREQUISITE:** Install `@types/multer` for NestJS file upload types:

```bash
cd packages/backend && npm install --save-dev @types/multer
```

**Files:**

- Create: `packages/backend/src/org-branding/dto/update-branding.dto.ts`
- Create: `packages/backend/src/org-branding/org-branding.service.ts`
- Create: `packages/backend/src/org-branding/org-branding.controller.ts`
- Create: `packages/backend/src/org-branding/org-branding-public.controller.ts`
- Create: `packages/backend/src/org-branding/org-branding.module.ts`
- Modify: `packages/backend/src/app.module.ts`

- [ ] **Step 1: Create UpdateBrandingDto**

```typescript
// dto/update-branding.dto.ts
import { IsOptional, IsString, MaxLength, Matches } from "class-validator";

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: "accent_color must be a valid hex color (#RRGGBB)",
  })
  accent_color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website_url?: string;
}
```

- [ ] **Step 2: Create OrgBrandingService**

Inject: `@Inject(SUPABASE_CLIENT) supabase`, `OrgAuditService`, `ConfigService`

Methods:

- `getBranding(orgId)` — SELECT logo_url, accent_color, name, website_url from organizations. Return branding config.
- `getBrandingByOrgId(orgId)` — same as above but public-facing (used by shared reports/embeds). No auth check — branding is not sensitive.
- `updateBranding(orgId, dto, actorId)` — UPDATE accent_color and/or website_url on organizations. Audit log 'branding_updated'.
- `uploadLogo(orgId, file: Buffer, mimeType: string, actorId)` — Validate: must be image/\* (png, jpg, webp, svg), max 2MB. Upload to Supabase Storage `org-logos/{orgId}/logo.{ext}`. Get public URL. UPDATE logo_url on organizations. Audit log 'logo_uploaded'.
- `deleteLogo(orgId, actorId)` — Delete from Supabase Storage. SET logo_url = NULL on organizations. Audit log 'logo_removed'.

For Supabase Storage uploads, use the pattern from `app/api/betatest/upload/route.ts`:

```typescript
const { error } = await this.supabase.storage
  .from("org-logos")
  .upload(`${orgId}/logo.${ext}`, file, {
    contentType: mimeType,
    upsert: true, // Overwrite existing logo
  });

const { data: urlData } = this.supabase.storage
  .from("org-logos")
  .getPublicUrl(`${orgId}/logo.${ext}`);
```

- [ ] **Step 3: Create OrgBrandingController (admin, guarded)**

Endpoints (all @UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)):

- `GET /api/org/:slug/branding` — getBranding
- `PUT /api/org/:slug/branding` — updateBranding
- `POST /api/org/:slug/branding/logo` — uploadLogo (multipart form-data using `@UseInterceptors(FileInterceptor('logo'))` + `@UploadedFile()`)
- `DELETE /api/org/:slug/branding/logo` — deleteLogo

For file upload, use NestJS `@UseInterceptors(FileInterceptor('logo'))` from `@nestjs/platform-express` with limits: `{ fileSize: 2 * 1024 * 1024 }` (2MB).

- [ ] **Step 4: Create OrgBrandingPublicController (no auth)**

Public endpoint for shared reports and embeds — no auth guard:

- `GET /api/org-branding/:orgId` — returns only `{ logo_url, accent_color, org_name, website_url }`. No sensitive data.

This is a separate controller to keep the auth boundary clear.

- [ ] **Step 5: Create OrgBrandingModule**

Import OrgAuditModule. Import guards directly from `'../organizations/guards'` (barrel export) — do NOT re-provide them, just import OrganizationsModule which already exports them. Export OrgBrandingService.

- [ ] **Step 6: Register in app.module.ts**

- [ ] **Step 7: Verify build**

```bash
cd packages/backend && npx nest build 2>&1 | tail -10
```

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/org-branding/ packages/backend/src/app.module.ts
git commit -m "feat: add org branding backend — logo upload, accent color, public endpoint"
```

---

## Task 3: Embed Token Backend — Service, Controller, Guard, CORS

Build embed token management and the token authentication guard with dynamic CORS.

**Files:**

- Create: `packages/backend/src/org-embeds/dto/create-embed-token.dto.ts`
- Create: `packages/backend/src/org-embeds/org-embeds.service.ts`
- Create: `packages/backend/src/org-embeds/org-embeds.controller.ts`
- Create: `packages/backend/src/org-embeds/embed-token.guard.ts`
- Create: `packages/backend/src/org-embeds/embed-cors.interceptor.ts`
- Create: `packages/backend/src/org-embeds/embed-data.controller.ts`
- Create: `packages/backend/src/org-embeds/org-embeds.module.ts`
- Modify: `packages/backend/src/app.module.ts`

- [ ] **Step 1: Create CreateEmbedTokenDto**

```typescript
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ArrayMinSize,
  IsIn,
} from "class-validator";

export class CreateEmbedTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  allowed_origins: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(["score", "metric_card", "map"], { each: true })
  widget_types: string[];
}
```

- [ ] **Step 2: Create OrgEmbedsService**

Methods:

- `listTokens(orgId)` — SELECT from organization_embed_tokens WHERE org_id and is_active
- `createToken(orgId, dto, createdBy)` — Generate token (`emb_${crypto.randomBytes(24).toString('hex')}`), INSERT, audit log
- `updateToken(orgId, tokenId, dto)` — UPDATE allowed_origins, widget_types, name
- `revokeToken(orgId, tokenId, actorId)` — SET is_active = false, audit log
- `validateToken(tokenValue, origin, widgetType)` — Look up token, check is_active, check origin against allowed_origins (with wildcard support for `*.domain.com`), check widgetType against widget_types. Returns `{ valid, orgId, orgBranding }` or throws.

- [ ] **Step 3: Create EmbedTokenGuard**

Reads `?token=` from query params. If present:

1. Calls `orgsEmbedsService.validateToken(token, origin, widgetType)`
2. Sets `request.embedOrg` with org branding data
3. If validation fails → 403

If no token present → allow through (backwards compatibility for existing public embeds).

**IMPORTANT:** Also verify `embed_enabled = true` on the token's org. If the org has embeds disabled, reject with 403 even if the token is valid.

The `widgetType` is derived from the URL path: `/api/embed/score/*` → 'score', `/api/embed/metric-card/*` → 'metric_card', `/api/embed/map/*` → 'map'.

- [ ] **Step 4: Create EmbedCorsInterceptor**

Dynamic CORS interceptor for `/api/embed/*` routes:

1. Reads `?token=` from request
2. If token present: look up allowed_origins from the validated token (already on request from guard)
3. Check `Origin` header against allowed_origins
4. Set `Access-Control-Allow-Origin` to the matched origin (not `*`)
5. Handle preflight `OPTIONS` requests
6. If no token: allow all origins (public embeds)

- [ ] **Step 5: Create OrgEmbedsController (admin token CRUD)**

Endpoints (all @UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)):

- `GET /api/org/:slug/embed-tokens` — list tokens
- `POST /api/org/:slug/embed-tokens` — create token
- `PUT /api/org/:slug/embed-tokens/:id` — update token
- `DELETE /api/org/:slug/embed-tokens/:id` — revoke token

- [ ] **Step 6: Create EmbedDataController (widget data endpoints)**

Protected by `EmbedTokenGuard` + `EmbedCorsInterceptor`:

- `GET /api/embed/score/:geoLevel/:geoId` — Score data (reuses existing ScoringService)
- `GET /api/embed/metric-card/:metricId/:geoLevel/:geoId` — Metric snapshot (reuses existing metric services)
- `GET /api/embed/map/:geoLevel` — GeoJSON + metric data
- `GET /api/embed/branding` — Org branding from token context

Each endpoint returns the minimum data needed for the widget + org branding info.

- [ ] **Step 7: Create OrgEmbedsModule**

Import: OrgAuditModule, scoring modules (for data reuse). Export: OrgEmbedsService, EmbedTokenGuard.

- [ ] **Step 8: Register in app.module.ts**

- [ ] **Step 9: Verify build**

```bash
cd packages/backend && npx nest build 2>&1 | tail -10
```

- [ ] **Step 10: Commit**

```bash
git add packages/backend/src/org-embeds/ packages/backend/src/app.module.ts
git commit -m "feat: add embed token management with guard, CORS, and widget data endpoints"
```

---

## Task 4: Frontend Data Layer — Branding + Embed Fetchers

**Files:**

- Create: `packages/frontend/lib/data/fetchers/org-branding.ts`
- Create: `packages/frontend/lib/data/fetchers/org-embeds.ts`
- Modify: `packages/frontend/lib/data/index.ts`

- [ ] **Step 1: Create branding fetchers**

Functions:

- `fetchOrgBranding(slug)` — GET /api/org/:slug/branding (authenticated)
- `updateOrgBranding(slug, data)` — PUT /api/org/:slug/branding
- `uploadOrgLogo(slug, file: File)` — POST /api/org/:slug/branding/logo (multipart FormData)
- `deleteOrgLogo(slug)` — DELETE /api/org/:slug/branding/logo
- `fetchPublicBranding(orgId)` — GET /api/org-branding/:orgId (public, no auth)

- [ ] **Step 2: Create embed token fetchers**

Functions:

- `fetchOrgEmbedTokens(slug)` — GET /api/org/:slug/embed-tokens
- `createOrgEmbedToken(slug, data)` — POST /api/org/:slug/embed-tokens
- `updateOrgEmbedToken(slug, tokenId, data)` — PUT /api/org/:slug/embed-tokens/:id
- `revokeOrgEmbedToken(slug, tokenId)` — DELETE /api/org/:slug/embed-tokens/:id
- `fetchEmbedBranding(token)` — GET /api/embed/branding?token=:token (public, for embed widgets)

- [ ] **Step 3: Export from data layer index**

- [ ] **Step 4: Verify build**

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/data/
git commit -m "feat: add branding and embed token fetchers to data layer"
```

---

## Task 5: Branding Admin Page

Build the branding management page at `/org/[slug]/admin/branding`.

**Files:**

- Create: `packages/frontend/app/org/[slug]/admin/branding/page.tsx`
- Create: `packages/frontend/app/org/components/LogoUploader.tsx`
- Create: `packages/frontend/app/org/components/AccentColorPicker.tsx`
- Create: `packages/frontend/app/org/components/BrandingPreview.tsx`
- Modify: `packages/frontend/app/org/components/OrgAdminSidebar.tsx` — add Branding link

- [ ] **Step 1: Create LogoUploader component**

Drag-and-drop + click-to-upload. Shows current logo if set. Validates image type + 2MB max client-side. Uses `uploadOrgLogo()` fetcher. Shows upload progress. "Remove" button calls `deleteOrgLogo()`.

- [ ] **Step 2: Create AccentColorPicker component**

Preset palette (8-10 colors that pass WCAG AA against white) + custom hex input. Shows color swatch preview. Validates hex format.

- [ ] **Step 3: Create BrandingPreview component**

Live preview of a mock report header with current branding applied. Shows: org logo (or placeholder), accent color as top border, org name, "Powered by PropertyIQ" footer. Updates in real-time as settings change.

- [ ] **Step 4: Create branding admin page**

Split layout:

- Left: form controls (LogoUploader, AccentColorPicker, website URL input)
- Right: BrandingPreview
- Save button applies changes via `updateOrgBranding()`
- Uses `fetchOrgBranding()` to load current state

- [ ] **Step 5: Add Branding + Embeds links to sidebar**

In `OrgAdminSidebar.tsx`, add nav items for Branding (Palette icon) and Embeds (Code icon) between Billing and Audit.

- [ ] **Step 6: Verify build**

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/app/org/
git commit -m "feat: add branding admin page with logo upload, color picker, and live preview"
```

---

## Task 6: Embeds Admin Page

Build the embed token management page at `/org/[slug]/admin/embeds`.

**Files:**

- Create: `packages/frontend/app/org/[slug]/admin/embeds/page.tsx`
- Create: `packages/frontend/app/org/components/EmbedTokenCard.tsx`
- Create: `packages/frontend/app/org/components/CreateEmbedDialog.tsx`
- Create: `packages/frontend/app/org/components/EmbedCodeSnippet.tsx`

- [ ] **Step 1: Create EmbedTokenCard**

Card showing: token name, allowed origins as chips, widget types as badges, created date, "Revoke" button with confirm. Below the card: `EmbedCodeSnippet` showing the iframe code.

- [ ] **Step 2: Create CreateEmbedDialog**

M3 dialog: name input, allowed origins (multi-input — add/remove chips), widget type checkboxes (Score Ring, Metric Card, Interactive Map). Create button calls `createOrgEmbedToken()`.

- [ ] **Step 3: Create EmbedCodeSnippet**

Tabs for each widget type. Shows copy-pasteable iframe code with the correct token, dimensions, and base URL:

```html
<!-- Score Widget -->
<iframe
  src="https://propertyiq.up.railway.app/embed/score/metro/31080?token=emb_abc123&scoreType=homeready"
  width="280"
  height="320"
  style="border: none; border-radius: 16px;"
/>
```

Each tab shows different dimensions and params. Copy button uses `navigator.clipboard.writeText()`.

- [ ] **Step 4: Create embeds admin page**

Card-based token list. "Create Embed Token" button opens dialog. Each card shows the token info + code snippets. Uses `fetchOrgEmbedTokens()`, `createOrgEmbedToken()`, `revokeOrgEmbedToken()`.

- [ ] **Step 5: Verify build**

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/org/
git commit -m "feat: add embed token management page with code snippets"
```

---

## Task 7: Embed Widget Components

Build the shared embed components and the 3 widget types.

**Files:**

- Create: `packages/frontend/app/embed/components/EmbedShell.tsx`
- Create: `packages/frontend/app/embed/components/EmbedBrandingBar.tsx`
- Create: `packages/frontend/app/embed/components/EmbedScoreRing.tsx`
- Create: `packages/frontend/app/embed/components/EmbedMetricCard.tsx`
- Create: `packages/frontend/app/embed/components/EmbedMiniMap.tsx`
- Create: `packages/frontend/app/embed/components/EmbedLoadingSkeleton.tsx`
- Create: `packages/frontend/app/embed/components/EmbedErrorState.tsx`

- [ ] **Step 1: Create EmbedBrandingBar**

40px tall bar: accent color background, org logo (24px) + org name left-aligned. Falls back to org name only if no logo. CSS variable `--embed-accent` for theming.

- [ ] **Step 2: Create EmbedLoadingSkeleton + EmbedErrorState**

Loading: animated pulse skeleton with branding bar placeholder.
Error: friendly message + retry button, styled for embed context.

- [ ] **Step 3: Create EmbedShell**

Wraps all embed pages. Reads `?token=` from URL. If present: fetches branding via `fetchEmbedBranding(token)`, applies as CSS variables, renders BrandingBar + children + footer. If no token: renders children without branding (backwards compat). Shows loading/error states.

Footer: "Powered by PropertyIQ" link — always visible, not removable.

- [ ] **Step 4: Create EmbedScoreRing**

Compact version of the existing ScoreDisplay component (~280×320px). Reuses `getScoreColor()`, `getScoreLabel()` from `app/components/scoring/ScoreDisplay.tsx`. Shows: score number in ring, label, score type name, geography name.

- [ ] **Step 5: Create EmbedMetricCard**

Compact card (~300×200px). Shows: metric title (from registry), formatted value + trend arrow, geography name, data freshness. Reuses `formatMetricValue()` from `@/lib/data`.

- [ ] **Step 6: Create EmbedMiniMap**

Mapbox GL map (~600×400px, responsive). Shows color-coded regions for a single metric at a given geo level. Click for tooltip. Legend bar at bottom. Reuses map layer logic from the main map but with simplified controls (no sidebar, no metric selector). Query params: `metric`, `center`, `zoom`.

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/app/embed/components/
git commit -m "feat: add embed widget components — score ring, metric card, mini-map"
```

---

## Task 8: Embed Widget Pages

Wire the embed components into Next.js pages.

**Files:**

- Modify: `packages/frontend/app/embed/layout.tsx` — integrate EmbedShell
- Modify: `packages/frontend/app/embed/score/[geoLevel]/[geoId]/page.tsx` — use EmbedShell + EmbedScoreRing
- Create: `packages/frontend/app/embed/metric-card/[metricId]/[geoLevel]/[geoId]/page.tsx`
- Create: `packages/frontend/app/embed/map/[geoLevel]/page.tsx`

- [ ] **Step 1: Update embed layout with EmbedShell**

Wrap children with EmbedShell which handles token resolution + branding. The shell reads `?token=` from the URL (if present) and provides branding context.

- [ ] **Step 2: Update score embed page**

Replace existing score page internals with EmbedScoreRing component. The page fetches score data server-side and passes to the component. Respect existing URL pattern: `/embed/score/:geoLevel/:geoId?scoreType=homeready&token=emb_...`

- [ ] **Step 3: Create metric-card embed page**

New route: `/embed/metric-card/:metricId/:geoLevel/:geoId?token=emb_...`

Fetch metric data server-side, render EmbedMetricCard.

- [ ] **Step 4: Create map embed page**

New route: `/embed/map/:geoLevel?metric=home_value&center=-96.8,32.7&zoom=6&token=emb_...`

Client component (Mapbox requires browser). Fetch GeoJSON + metric data, render EmbedMiniMap.

- [ ] **Step 5: Verify build**

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/embed/
git commit -m "feat: add embed widget pages — score, metric card, and interactive map"
```

---

## Task 9: Report Branding

Wire org branding into reports and shared report links.

**Files:**

- Create: `packages/frontend/app/reports/hooks/useReportBranding.ts`
- Create: `packages/frontend/app/reports/[id]/components/BrandedReportHeader.tsx`
- Modify: `packages/frontend/app/reports/[id]/components/ReportHeader.tsx` — add branding support
- Modify: `packages/frontend/app/shared/report/[token]/page.tsx` — pass org branding to BrandingProvider

- [ ] **Step 1: Create useReportBranding hook**

```typescript
// Takes organization_id from the report record. If null, returns null (no branding).
// If present, fetches public branding via fetchPublicBranding(orgId).
// Caches aggressively — branding rarely changes.
export function useReportBranding(organizationId: string | null) {
  // Uses React Query with staleTime: 30 * 60 * 1000 (30 min)
  // Returns { branding, loading } or { branding: null, loading: false }
}
```

- [ ] **Step 2: Create BrandedReportHeader**

Renders the branded variant from the spec: org logo + accent color top border + report title + geography + date + "Prepared by [Org Name]" + "Powered by PropertyIQ". Falls back to standard ReportHeader when branding is null.

Print CSS: `@media print` rules for accent bar colors, logo sizing, footer text.

- [ ] **Step 3: Update ReportHeader to support branding**

In the existing ReportHeader, check if the report has `organization_id`. If yes, render BrandedReportHeader instead of the standard header. Uses useReportBranding hook.

- [ ] **Step 4: Update shared report page**

In `shared/report/[token]/page.tsx`, fetch org branding from the report's organization_id and pass to BrandingProvider.

**IMPORTANT:** The existing `BrandingProvider` takes a `branding` prop (not `config`), and `BrandingConfig` does NOT have `websiteUrl`. You MUST first update `BrandingConfig` in `app/reports/[id]/components/BrandingProvider.tsx` to add `websiteUrl?: string`, then wire:

```typescript
const brandingData = report.organization_id
  ? await fetchPublicBranding(report.organization_id)
  : null;

<BrandingProvider branding={brandingData ? {
  logoUrl: brandingData.logo_url,
  primaryColor: brandingData.accent_color,
  companyName: brandingData.org_name,
  websiteUrl: brandingData.website_url,
} : undefined}>
```

- [ ] **Step 5: Verify build**

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/reports/ packages/frontend/app/shared/
git commit -m "feat: add org branding to reports and shared report links"
```

---

## Task 10: Backend Integration Tests

**Files:**

- Create: `packages/backend/test/enterprise/branding.e2e-spec.ts`
- Create: `packages/backend/test/enterprise/embeds.e2e-spec.ts`

- [ ] **Step 1: Write branding tests**

7 tests (per spec Section 8):

- Upload logo → file in Supabase Storage, logo_url updated on org
- Update accent color → saved, validated hex format
- Get branding → returns logo + color + name
- Generate report as org member → report has organization_id
- Fetch report branding → includes org logo + accent + name
- Fetch shared report branding → public endpoint returns branding
- Delete logo → cleared, fallback to PropertyIQ logo

- [ ] **Step 2: Write embed tests**

7 tests (per spec Section 8):

- Create embed token → record in DB
- Fetch widget data with valid token + valid origin → data returned, CORS headers set
- Fetch with valid token + wrong origin → 403 ORIGIN_NOT_ALLOWED
- Fetch with revoked token → 401
- Fetch widget type not in token's widget_types → 403
- Branding endpoint returns org branding from token
- Score widget data matches app data for same geo

- [ ] **Step 3: Commit**

```bash
git add packages/backend/test/enterprise/
git commit -m "test: add branding and embed integration tests"
```

---

## Task 11: Frontend E2E Tests

**Files:**

- Create: `packages/frontend/test/enterprise/embed-widgets.e2e-spec.ts`

- [ ] **Step 1: Write Playwright embed tests**

6 tests (per spec Section 8):

- Score widget loads at `/embed/score/metro/31080` → score ring visible
- Metric card loads at `/embed/metric-card/home_value/metro/31080` → value + trend visible
- Map widget loads at `/embed/map/metro` → Mapbox canvas rendered
- Invalid token → error state rendered
- "Powered by PropertyIQ" link present on all widgets
- Widget renders without token (backwards compat) → no branding bar, widget still works

- [ ] **Step 2: Write Playwright report branding tests**

Create `packages/frontend/test/enterprise/report-branding.e2e-spec.ts` with 3 tests:

- Branded report header shows org logo + accent color + "Prepared by [Org Name]"
- Shared report link shows branded header with org branding
- "Powered by PropertyIQ" is always visible on branded reports

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/test/enterprise/
git commit -m "test: add Playwright E2E tests for embeddable widgets and report branding"
```

---

## Task 12: Final Verification

- [ ] **Step 1: Backend build check**

```bash
cd packages/backend && npx nest build 2>&1 | tail -10
```

- [ ] **Step 2: Frontend type check**

```bash
cd packages/frontend && npx tsc --noEmit 2>&1 | tail -20
```

- [ ] **Step 3: Check for uncommitted changes**

```bash
git status
```

- [ ] **Step 4: Commit any fixes**

---

## Summary

| Task | Scope                     | New Files | Modified Files |
| ---- | ------------------------- | --------- | -------------- |
| 1    | Storage bucket            | 1         | 0              |
| 2    | Branding backend          | 5+        | 1              |
| 3    | Embed token backend       | 7+        | 1              |
| 4    | Frontend fetchers         | 2         | 1              |
| 5    | Branding admin page       | 4         | 1              |
| 6    | Embeds admin page         | 4         | 0              |
| 7    | Embed widget components   | 7         | 0              |
| 8    | Embed widget pages        | 2         | 2              |
| 9    | Report branding           | 2         | 2              |
| 10   | Backend integration tests | 2         | 0              |
| 11   | Frontend E2E tests        | 1         | 0              |
| 12   | Final verification        | 0         | 0              |

**Next:** Plan 3 (Platform API) builds on Plans 1 + 2.
