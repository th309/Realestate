# Unified Embed Builder — Design Spec

**Date:** 2026-03-28
**Status:** Draft
**Scope:** Redesign embed admin page into a single guided wizard workflow
**Replaces:** The two-phase flow (CreateEmbedDialog + WidgetConfigurator) on `/org/[slug]/admin/embeds`

---

## Problem

The current embed creation flow requires two disconnected steps:

1. **Create a token** (name, allowed origins, widget types) via a dialog
2. **Configure a widget** in a separate configurator below the token list

This feels like two separate tools, not one workflow. Non-technical users get confused by "tokens," "allowed origins," and having to mentally connect Step 1 to Step 2. The Widget Configurator already has great UX — the token creation is the friction.

## Solution

Replace both steps with a **single 3-step wizard** called the **Embed Builder**. The token is created behind the scenes — users never see or manage tokens directly. They just pick a widget, configure it, and get copy-paste code.

---

## 1. Page Layout

```
┌─────────────────────────────────────────────────────┐
│  Embed Builder                                       │
│  "Add PropertyIQ data to your website in 3 steps"   │
│                                                      │
│  ● Step 1        ○ Step 2        ○ Step 3           │
│  Choose Widget   Configure       Get Your Code       │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │         [Active step content]                 │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│              [Back]          [Next →]                 │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  ▾ Your Existing Embeds (3)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Score    │  │ Chart    │  │ Map      │          │
│  │ Dallas   │  │ Austin   │  │ State    │          │
│  │ Active ● │  │ Active ● │  │ Revoked  │          │
│  │ [Copy]   │  │ [Copy]   │  │          │          │
│  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────┘
```

The wizard is the primary experience. Existing embeds are a collapsible section below.

---

## 2. Step 1: "What do you want to show?"

Six visual cards in a 3x2 grid (2x3 on mobile). Each card has an icon, label, and one-line description. User clicks one to select — selected card gets an indigo ring highlight.

| Card          | Icon       | Label           | Description                            |
| ------------- | ---------- | --------------- | -------------------------------------- |
| `score`       | Target     | Score Ring      | Show a PropertyIQ score for any market |
| `metric_card` | BarChart3  | Single Metric   | One key number with trend arrow        |
| `map`         | Map        | Map Snapshot    | A small choropleth map                 |
| `map_full`    | Globe      | Interactive Map | Full map visitors can explore          |
| `chart`       | TrendingUp | Trend Chart     | Compare trends across locations        |
| `report`      | FileText   | Full Report     | Embed an entire market report          |

**Behavior:**

- Clicking a card selects it (one selection at a time)
- "Next" button activates once a card is selected
- No other inputs on this step

---

## 3. Step 2: "Configure your widget"

This step adapts based on the widget type from Step 1. All sub-sections appear on one scrollable screen, stacked vertically. A **live preview** updates in real-time as the user configures options.

### 3a. Type-Specific Configuration

Each widget type shows its relevant options at the top of Step 2:

**Score:**

- Score type dropdown: HomeReady / InvestorEdge / Market Health
- Geography search (single)

**Metric Card:**

- Metric dropdown (from registry, grouped by category)
- Geography search (single)

**Map Snapshot:**

- Metric dropdown
- Geography level pills: State / Metro / County / ZIP

**Interactive Map (Full):**

- 7 toggle switches for UI elements (sidebar, search, legend, etc.)
- Default metric dropdown
- Default geography level pills

**Trend Chart:**

- Metric dropdown
- Geography search (multi, max 3 locations)
- Time range pills: 1Y / 3Y / 5Y / 10Y
- Chart type pills: Line / Area
- "Show national benchmark" toggle

**Full Report:**

- Report picker dropdown (fetches recent reports)

### 3b. Geography Search

Uses the existing `GeographySearch` component, styled prominently — full-width with large input.

```
┌──────────────────────────────────────────────┐
│ 🔍  Search for a city, ZIP, metro, county... │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Dallas-Fort Worth           Metro     │  │
│  │ Dallas County, TX           County    │  │
│  │ 75201 - Dallas, TX          ZIP       │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

For chart widgets (multi-geography), selected locations appear as removable chips below the search input.

### 3c. Shape & Size

Reuses the existing `ShapeSizeSelector` component:

- Shape pills: Square / Horizontal / Vertical
- Size pills: Small / Medium / Large
- Shows pixel dimensions (e.g., "600 x 300px")

Not shown for Interactive Map (Full) or Report widgets — these are always responsive/full-width.

### 3d. Your Website URL

Friendly framing for what is currently "allowed origins":

```
┌──────────────────────────────────────────────┐
│  Where will you put this embed?              │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ https://mybrokerage.com               │  │
│  └────────────────────────────────────────┘  │
│  We'll make sure the embed only works on     │
│  this website.                               │
└──────────────────────────────────────────────┘
```

- Single URL input (not the current multi-origin chip system)
- We auto-extract the origin: `https://myblog.com/about-dallas` → `https://myblog.com`
- Validation: must start with `http://` or `https://`
- Helper text explains why (security, not jargon)
- If they need multiple origins, they create another embed

### 3e. Live Preview

The iframe preview from the current `EmbedPreview` component, shown on the right side (desktop) or below the config (mobile). Updates in real-time as the user changes options.

**Token timing:** A draft token is auto-created when the user enters Step 2. This token is used for the live preview. If the user abandons the wizard, the draft token is cleaned up (marked inactive). If they complete Step 3, the token becomes permanent.

**Layout on desktop (side-by-side):**

```
┌────────────────────────┬─────────────────────┐
│  Configuration         │  Live Preview        │
│  [Score type dropdown] │  ┌─────────────┐    │
│  [Geography search]    │  │   Preview   │    │
│  [Shape & size]        │  │   iframe    │    │
│  [Website URL]         │  │             │    │
│                        │  └─────────────┘    │
└────────────────────────┴─────────────────────┘
```

---

## 4. Step 3: "Your Embed Code"

The payoff screen. Everything is done — just copy the code.

```
┌──────────────────────────────────────────────────┐
│  ✓ Your embed is ready!                          │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │  <iframe                                   │  │
│  │    src="https://www.propertyiq.app/embed/  │  │
│  │      score/metro/31080?scoreType=          │  │
│  │      homeready&token=emb_a1b2c3d4"        │  │
│  │    width="300"                             │  │
│  │    height="300"                            │  │
│  │    frameborder="0"                         │  │
│  │    style="border-radius: 8px;"            │  │
│  │  ></iframe>                                │  │
│  │                                            │  │
│  │              ┌──────────────┐              │  │
│  │              │ 📋 Copy Code │              │  │
│  │              └──────────────┘              │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Paste this into your website's HTML where you   │
│  want the widget to appear.                      │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │          [Live Preview iframe]             │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Name: Score - Dallas-Fort Worth  [edit ✏️]      │
│                                                  │
│          [← Create Another]    [Done]            │
└──────────────────────────────────────────────────┘
```

**Copy button behavior:**

- Default: clipboard icon + "Copy Code" text
- On click: copies full iframe HTML to clipboard
- After click: checkmark icon + "Copied!" text (green) for 2 seconds
- Button is prominent — large, centered, indigo primary color

**Auto-generated name:**

- Format: `"{Widget Type} - {Geography Name}"` (e.g., "Score - Dallas-Fort Worth")
- Shown with inline edit icon so user can customize if they want
- Used to identify the embed in "Your Existing Embeds" section

**Token finalization:**

- When the user reaches Step 3, the draft token is finalized (marked as permanent/active)
- Token name is set to the auto-generated embed name

**Actions:**

- "Create Another" resets the wizard to Step 1
- "Done" scrolls to the existing embeds section (which now includes the new one)

---

## 5. Existing Embeds Section

Collapsible section below the wizard. Header shows count.

### 5a. Embed Cards

Each existing embed displays as a card:

```
┌──────────────────────────────────────┐
│  🎯 Score - Dallas-Fort Worth        │
│  Created 2 days ago                  │
│  mybrokerage.com                     │
│  ● Active                           │
│                                      │
│  [📋 Copy Code]        [🗑 Revoke]  │
└──────────────────────────────────────┘
```

- Widget type icon + auto-generated name
- Creation date (relative)
- Origin domain
- Status badge (Active = green dot, Revoked = gray)
- "Copy Code" regenerates the iframe snippet and copies to clipboard
- "Revoke" shows confirmation dialog, then disables the embed

### 5b. Empty State

When no embeds exist yet:

```
No embeds yet. Use the builder above to create your first one!
```

### 5c. Collapsed by Default

- If 0 embeds: collapsed, shows empty state when expanded
- If 1+ embeds: expanded by default, shows cards

---

## 6. Technical Architecture

### 6a. New Component: `EmbedBuilder.tsx`

**Location:** `packages/frontend/app/org/[slug]/admin/embeds/EmbedBuilder.tsx`

Replaces `CreateEmbedDialog` + `WidgetConfigurator` as the primary creation flow. Internal state:

```typescript
interface EmbedBuilderState {
  step: 1 | 2 | 3;
  widgetType: WidgetType | null; // Step 1 selection
  config: WidgetConfig; // Step 2 type-specific config
  geography: GeographySelection | null; // Step 2 geography
  shape: Shape; // Step 2 shape
  size: Size; // Step 2 size
  websiteUrl: string; // Step 2 origin
  embedUrl: string | null; // Generated embed path
  draftTokenId: string | null; // Created in background at Step 2
  draftToken: string | null; // Token value for preview
  finalName: string; // Auto-generated, editable
}
```

### 6b. Step Progress Component: `StepIndicator.tsx`

**Location:** `packages/frontend/app/org/[slug]/admin/embeds/StepIndicator.tsx`

Simple 3-dot progress indicator with labels. Clickable for completed steps (can go back but not forward past current).

### 6c. Draft Token Lifecycle

**Problem:** The live preview in Step 2 needs a valid token, but the user hasn't "created" anything yet.

**Solution:** Background draft token creation:

1. When user enters Step 2, auto-create a token via API:
   ```
   POST /api/org/{slug}/embed-tokens
   { name: "Draft", allowed_origins: ["*"], widget_types: [selectedType], is_draft: true }
   ```
2. Use returned token for live preview iframe
3. On Step 3 (completion): finalize the token:
   ```
   PATCH /api/org/{slug}/embed-tokens/{id}
   { name: finalName, allowed_origins: [extractedOrigin], is_draft: false }
   ```
4. On wizard abandon (navigate away, click "Back" to Step 1 with different type): revoke the draft token

**Backend changes needed:**

- Add `is_draft: boolean` column to embed tokens table (default: false)
- Add `embed_config: jsonb` column to store widget configuration (type, geography, metric, shape, size, embed URL path) — needed so "Copy Code" on existing embeds can regenerate the iframe snippet
- Add `PATCH` endpoint to update token name/origins/config/draft status
- Draft tokens should auto-expire after 1 hour (cron or lazy cleanup)
- Draft tokens are excluded from the "Your Existing Embeds" list

**`embed_config` schema:**

```typescript
interface EmbedConfig {
  widgetType: string; // "score" | "metric_card" | "map" | etc.
  embedPath: string; // "/embed/score/metro/31080?scoreType=homeready"
  geographyName: string; // "Dallas-Fort Worth" (for display in card)
  width: number; // 300
  height: number; // 300
}
```

This is stored when the token is finalized in Step 3, enabling the "Copy Code" button on existing embed cards to reconstruct the full iframe snippet without re-configuring.

### 6d. Reused Components

These existing components are reused as-is:

| Component            | From                                  | Used In                    |
| -------------------- | ------------------------------------- | -------------------------- |
| `GeographySearch`    | `configurator/GeographySearch.tsx`    | Step 2 geography selection |
| `ShapeSizeSelector`  | `configurator/ShapeSizeSelector.tsx`  | Step 2 dimensions          |
| `EmbedPreview`       | `configurator/EmbedPreview.tsx`       | Step 2 live preview        |
| `ScoreConfigurator`  | `configurator/ScoreConfigurator.tsx`  | Step 2 (score type)        |
| `MetricConfigurator` | `configurator/MetricConfigurator.tsx` | Step 2 (metric selection)  |
| `MapConfigurator`    | `configurator/MapConfigurator.tsx`    | Step 2 (map toggles)       |
| `ChartConfigurator`  | `configurator/ChartConfigurator.tsx`  | Step 2 (chart options)     |
| `ReportConfigurator` | `configurator/ReportConfigurator.tsx` | Step 2 (report picker)     |

### 6e. Removed/Replaced Components

| Component            | Disposition                                                  |
| -------------------- | ------------------------------------------------------------ |
| `CreateEmbedDialog`  | Replaced by EmbedBuilder wizard flow                         |
| `TokenRevealDialog`  | Replaced by Step 3 code display                              |
| `EmbedTokenCard`     | Replaced by simplified embed cards in "Your Existing Embeds" |
| `EmbedCodeSnippet`   | Replaced by Step 3 code block                                |
| `WidgetConfigurator` | Replaced by EmbedBuilder Step 2                              |

These files can be deleted after the new implementation is verified.

### 6f. Modified Page

**`packages/frontend/app/org/[slug]/admin/embeds/page.tsx`**

The page simplifies to:

```tsx
export default function OrgAdminEmbeds() {
  // Existing: useOrg(), embed_enabled check
  // Removed: token CRUD state, createOpen, revealToken
  // Added: onEmbedCreated callback to refresh existing embeds list

  return (
    <>
      <EmbedBuilder orgSlug={org.slug} onCreated={refreshEmbeds} />
      <ExistingEmbeds
        orgSlug={org.slug}
        embeds={embeds}
        onRevoke={handleRevoke}
      />
    </>
  );
}
```

---

## 7. Copy Button Spec

The copy button is prominent and satisfying to use:

**Default state:**

```
┌─────────────────────┐
│  📋  Copy Code      │
└─────────────────────┘
```

- Indigo primary background (`bg-primary text-on-primary`)
- Clipboard icon (lucide `Copy`)
- Centered, full-width within the code block

**Copied state (2 seconds):**

```
┌─────────────────────┐
│  ✓  Copied!         │
└─────────────────────┘
```

- Green background (`bg-green-600 text-white`)
- Check icon (lucide `Check`)
- Auto-reverts after 2 seconds

**Implementation:** Uses `navigator.clipboard.writeText()` — same pattern as existing `EmbedCodeSnippet` and `TokenRevealDialog`.

---

## 8. Responsive Behavior

**Desktop (>1024px):**

- Step 2: side-by-side layout (config left, preview right)
- Step 1: 3x2 card grid
- Existing embeds: horizontal card row

**Tablet (768-1024px):**

- Step 2: stacked (config above, preview below)
- Step 1: 3x2 card grid
- Existing embeds: 2-column grid

**Mobile (<768px):**

- Step 2: stacked (config above, preview below)
- Step 1: 2x3 card grid (2 columns, 3 rows)
- Existing embeds: single-column stack

---

## 9. Edge Cases

| Scenario                      | Behavior                                                   |
| ----------------------------- | ---------------------------------------------------------- |
| User abandons wizard mid-flow | Draft token auto-expires after 1 hour                      |
| User clicks browser back      | Standard browser behavior — wizard state lost              |
| embed_enabled is false        | Show informational message (same as current)               |
| No internet during preview    | Preview shows error state with retry                       |
| Invalid website URL           | Inline validation error, "Next" disabled                   |
| User enters URL with path     | Auto-extract origin, show extracted domain                 |
| Token creation fails          | Show error toast, allow retry                              |
| User has 0 existing embeds    | "Existing Embeds" section collapsed, empty state on expand |

---

## 10. Out of Scope

- Multi-origin support per embed (users create separate embeds per origin)
- Token rotation/regeneration
- Embed analytics (views, clicks)
- Custom CSS theming per embed
- Embed versioning
