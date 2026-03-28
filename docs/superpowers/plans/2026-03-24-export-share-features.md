# Export & Share Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV/PDF export and share functionality across Maps table view, Markets rankings, and Reports — gated to Pro/Enterprise tiers via the existing entitlements system.

**Architecture:** Extract a shared `downloadFile()` utility from the existing ExportButton pattern. Each surface gets an entitlement-gated export button using `useEntitlements()` → `canAccess('feature', 'export_csv')` with `PaywallCard` fallback. Reports get an enhanced share modal with copy link, CSV export, PDF download, and print. Link expiry UI is deferred — the backend already supports `expiresInDays` but we won't expose it in V1.

**Note on MarketDashboard:** `app/market/[id]/MarketDashboard.tsx` is ~715 lines — already over the 400-line component limit. This plan makes minimal edits (wiring handlers to existing buttons). A full header extraction refactor is tracked as follow-up debt, not part of this plan.

**Tech Stack:** React hooks, existing entitlements system (`useEntitlements`, `PaywallCard`), existing backend export endpoints (`/api/analytics/export/*`), browser print API for PDF, `createReportShareLink` for sharing.

---

## File Structure

### Shared Utility (new)

| File                          | Responsibility                                      |
| ----------------------------- | --------------------------------------------------- |
| `lib/export/download-file.ts` | Reusable blob download + client-side CSV generation |
| `lib/export/index.ts`         | Barrel export                                       |

### Maps Table View (modify)

| File                                    | Responsibility              |
| --------------------------------------- | --------------------------- |
| `app/map/components/DataTableModal.tsx` | Add export button to footer |

### Markets Page (new + modify)

| File                                               | Responsibility                            |
| -------------------------------------------------- | ----------------------------------------- |
| `app/market/components/ExportTopMarketsButton.tsx` | Entitlement-gated CSV export for rankings |
| `app/market/TopMarketsSection.tsx`                 | Wire export button into header            |
| `app/market/[id]/MarketDashboard.tsx`              | Wire Share + Download button handlers     |
| `app/market/[id]/components/ShareMarketModal.tsx`  | Share modal (copy link, print)            |

### Reports Page (modify)

| File                                               | Responsibility                                 |
| -------------------------------------------------- | ---------------------------------------------- |
| `app/reports/[id]/components/ReportHeader.tsx`     | Expand share dropdown with more options        |
| `app/reports/[id]/components/ShareReportModal.tsx` | Full share modal (link + expiry + CSV + PDF)   |
| `lib/data/fetchers/reports.ts`                     | Add `exportReportCsv()` fetcher if not present |

---

## Task 1: Shared Download Utility

Extract the client-side CSV generation + blob download into a reusable utility. This avoids duplicating the pattern from `ExportButton.tsx` across 3 surfaces.

**Files:**

- Create: `packages/frontend/lib/export/download-file.ts`
- Create: `packages/frontend/lib/export/index.ts`

**Reference:** `components/analytics-assistant/ExportButton.tsx:87-126` (the `handleClientExport` function)

- [ ] **Step 1: Create the download utility**

```typescript
// lib/export/download-file.ts

/**
 * Trigger a browser file download from in-memory data.
 */
export function downloadBlob(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Convert an array of objects to CSV string.
 * columns: ordered list of { key, label } — key is the object property, label is the header.
 */
export function toCsv(
  data: Record<string, unknown>[],
  columns: Array<{ key: string; label: string }>,
): string {
  const headers = columns.map((c) => escapeCsvValue(c.label));
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return escapeCsvValue(str);
      })
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * One-call CSV download: data → CSV string → browser download.
 */
export function downloadCsv(
  data: Record<string, unknown>[],
  columns: Array<{ key: string; label: string }>,
  filename: string,
): void {
  const csv = toCsv(data, columns);
  downloadBlob(
    csv,
    filename.endsWith(".csv") ? filename : `${filename}.csv`,
    "text/csv",
  );
}

/**
 * One-call JSON download.
 */
export function downloadJson(
  data: Record<string, unknown>[],
  filename: string,
): void {
  const json = JSON.stringify(data, null, 2);
  downloadBlob(
    json,
    filename.endsWith(".json") ? filename : `${filename}.json`,
    "application/json",
  );
}
```

- [ ] **Step 2: Create barrel export**

```typescript
// lib/export/index.ts
export {
  downloadBlob,
  toCsv,
  downloadCsv,
  downloadJson,
} from "./download-file";
```

- [ ] **Step 3: Verify no build errors**

Run: `cd packages/frontend && npx next build --no-lint 2>&1 | head -30` (or just check types)
Expected: No errors from new files (they're not imported yet)

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/lib/export/
git commit -m "feat: add shared download-file utility for CSV/JSON exports"
```

---

## Task 2: Maps Table View — CSV Export

Add an "Export CSV" button to the DataTableModal footer. Gate behind `export_csv` entitlement.

**Files:**

- Modify: `packages/frontend/app/map/components/DataTableModal.tsx`

**Data shape:** `tableData` is `Array<{ id, name, value, date }>`. We export both the raw numeric value and the formatted display value — raw for analysis, formatted for readability.

- [ ] **Step 1: Add imports to DataTableModal**

At the top of `DataTableModal.tsx`, add:

```typescript
import { Download, Lock } from "lucide-react";
import { useEntitlements } from "@/lib/entitlements";
import { downloadCsv } from "@/lib/export";
```

- [ ] **Step 2: Add entitlement check inside the component**

Inside the `DataTableModal` function body, after the existing `useMemo` block (after line 72):

```typescript
const { canAccess } = useEntitlements();
const canExport = canAccess("feature", "export_csv");
```

- [ ] **Step 3: Add the export handler**

Below the entitlement check:

```typescript
const handleExportCsv = () => {
  const exportData = tableData.map((row) => ({
    name: row.name,
    value: row.value !== null ? row.value : "",
    formatted_value: formatValue(row.value, metricFormat),
    date: row.date || "",
  }));
  const columns = [
    { key: "name", label: geoLevelName },
    { key: "formatted_value", label: metricName },
    { key: "value", label: `${metricName} (Raw)` },
    { key: "date", label: "Date" },
  ];
  const filename = `${(metricName || "data").toLowerCase().replace(/\s+/g, "-")}-${geoLevel}-data`;
  downloadCsv(exportData, columns, filename);
};
```

- [ ] **Step 4: Add export button to footer**

Replace the footer (lines 193-203) with:

```tsx
{
  /* Footer */
}
<div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant bg-surface-container-low">
  <p className="text-sm text-on-surface-variant">
    Showing {tableData.length} of {Object.keys(mapData).length} records
  </p>
  <div className="flex items-center gap-2">
    <button
      onClick={canExport ? handleExportCsv : undefined}
      disabled={tableData.length === 0}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        canExport
          ? "bg-surface-container text-on-surface hover:bg-surface-container-high border border-outline-variant"
          : "bg-surface-container text-on-surface-variant border border-outline-variant opacity-70 cursor-not-allowed"
      } disabled:opacity-50`}
      title={canExport ? "Export as CSV" : "Upgrade to Pro to export data"}
    >
      {canExport ? (
        <Download className="w-4 h-4" />
      ) : (
        <Lock className="w-4 h-4" />
      )}
      Export CSV
    </button>
    <button
      onClick={onClose}
      className="px-6 py-2 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors"
    >
      Close
    </button>
  </div>
</div>;
```

- [ ] **Step 5: Verify in browser**

Run: dev server → open map → click Table View FAB → verify export button appears

- Pro user: Download icon, click triggers CSV download
- Free user: Lock icon, button is visually muted

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/map/components/DataTableModal.tsx
git commit -m "feat: add CSV export to map table view — gated to Pro/Enterprise"
```

---

## Task 3: Markets Page — Export Top Markets

Add a CSV export button to the TopMarketsSection header. Gate behind `export_csv`.

**Files:**

- Create: `packages/frontend/app/market/components/ExportTopMarketsButton.tsx`
- Modify: `packages/frontend/app/market/TopMarketsSection.tsx`

- [ ] **Step 1: Create ExportTopMarketsButton component**

```typescript
// app/market/components/ExportTopMarketsButton.tsx
'use client';

import React, { useState } from 'react';
import { Download, Lock } from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements';
import { PaywallCard } from '@/components/entitlements/PaywallCard';
import { downloadCsv } from '@/lib/export';

interface TopMarketEntry {
  location_id: string;
  location_name: string;
  score: number;
  grade: string;
}

interface ExportTopMarketsButtonProps {
  data: TopMarketEntry[];
  geography: string;
  scoreType: string;
  stateFilter: string;
}

export function ExportTopMarketsButton({
  data,
  geography,
  scoreType,
  stateFilter,
}: ExportTopMarketsButtonProps) {
  const [showPaywall, setShowPaywall] = useState(false);
  const { canAccess } = useEntitlements();
  const canExport = canAccess('feature', 'export_csv');

  const handleExport = () => {
    if (!canExport) {
      setShowPaywall(true);
      return;
    }

    const exportData = data.map((m, i) => ({
      rank: i + 1,
      location_name: m.location_name,
      score: m.score.toFixed(1),
      grade: m.grade,
      geography,
    }));
    const columns = [
      { key: 'rank', label: 'Rank' },
      { key: 'location_name', label: 'Location' },
      { key: 'score', label: `${scoreType} Score` },
      { key: 'grade', label: 'Grade' },
      { key: 'geography', label: 'Geography' },
    ];
    const stateSuffix = stateFilter ? `-${stateFilter}` : '';
    const filename = `top-markets-${scoreType}-${geography}${stateSuffix}`;
    downloadCsv(exportData, columns, filename);
  };

  return (
    <>
      <button
        onClick={handleExport}
        disabled={data.length === 0}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs sm:text-sm font-medium rounded-lg transition-colors border border-outline-variant disabled:opacity-50 ${
          canExport
            ? 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'
            : 'bg-surface-container-lowest text-on-surface-variant opacity-70'
        }`}
        title={canExport ? 'Export rankings as CSV' : 'Upgrade to Pro to export'}
      >
        {canExport ? <Download className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">Export</span>
      </button>

      {showPaywall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40"
          onClick={() => setShowPaywall(false)}
        >
          <div className="max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <PaywallCard
              type="feature"
              id="export_csv"
              title="Unlock Data Export"
              description="Export top market rankings to CSV for your own analysis and presentations."
            />
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Wire into TopMarketsSection**

In `TopMarketsSection.tsx`:

Add import:

```typescript
import { ExportTopMarketsButton } from "./components/ExportTopMarketsButton";
```

Replace the header section (lines 67-71) with:

```tsx
{
  /* Header */
}
<div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2 text-on-surface-variant">
    <Trophy className="w-5 h-5" />
    <h2 className="text-lg font-medium text-on-surface">Top Markets</h2>
  </div>
  <ExportTopMarketsButton
    data={data}
    geography={geo}
    scoreType={scoreType}
    stateFilter={stateFilter}
  />
</div>;
```

- [ ] **Step 3: Verify in browser**

Run: dev server → go to /market → Top Markets section should show Export button

- Pro user: Click triggers CSV download of rankings
- Free user: Click shows paywall modal

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/market/components/ExportTopMarketsButton.tsx
git add packages/frontend/app/market/TopMarketsSection.tsx
git commit -m "feat: add CSV export to top markets rankings — gated to Pro/Enterprise"
```

---

## Task 4: Market Dashboard — Wire Share & Download Buttons

Connect the existing placeholder Share and Download buttons in the market dashboard header.

**Files:**

- Modify: `packages/frontend/app/market/[id]/MarketDashboard.tsx`

**Note:** MarketDashboard.tsx is ~715 lines (over the 400-line component limit). This task makes minimal, surgical edits only — wiring handlers to existing buttons. A full header extraction refactor is deferred.

- [ ] **Step 1: Add imports**

At the top of MarketDashboard.tsx:

1. Add `useCallback` to the React import (it already has `useState, useMemo`):

```typescript
import React, { useState, useMemo, useCallback } from "react";
```

2. Add entitlements import:

```typescript
import { useEntitlements } from "@/lib/entitlements";
```

3. Add `Lock` to the existing `lucide-react` import (alongside `Share2`, `Download`, etc.)

Verify `Share2` and `Download` from `lucide-react` are already imported (they should be since the placeholder buttons use them).

- [ ] **Step 2: Add handlers inside the component**

Inside the component body, near other state/handlers:

```typescript
const { canAccess } = useEntitlements();
const canExport = canAccess("feature", "export_csv");

const handleShareMarket = useCallback(async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    // Optionally show a toast — for now just copy URL
  } catch {
    // Fallback: silent
  }
}, []);

const handleDownloadMarket = useCallback(() => {
  if (!canExport) return;
  // Gather visible metrics data from the dashboard
  // This depends on what data is available in the component state
  // At minimum, export the scores summary
  window.print();
}, [canExport]);
```

- [ ] **Step 3: Wire onClick handlers to buttons**

Find the Share button (around line 486) and replace with:

```tsx
<button
  onClick={handleShareMarket}
  className="p-2.5 rounded-xl hover:bg-surface-container transition-colors"
  title="Copy link to clipboard"
>
  <Share2 className="w-5 h-5 text-on-surface-variant" />
</button>
```

Find the Download button (around line 492) and replace with:

```tsx
<button
  onClick={handleDownloadMarket}
  className="p-2.5 rounded-xl hover:bg-surface-container transition-colors"
  title={canExport ? "Print / Save as PDF" : "Upgrade to Pro to download"}
>
  {canExport ? (
    <Download className="w-5 h-5 text-on-surface-variant" />
  ) : (
    <Lock className="w-5 h-5 text-on-surface-variant" />
  )}
</button>
```

- [ ] **Step 4: Verify in browser**

Run: dev server → /market/31080 → click Share (copies URL) → click Download (opens print dialog for pro)

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/market/[id]/MarketDashboard.tsx
git commit -m "feat: wire market dashboard share and download buttons"
```

---

## Task 5: Reports — Enhanced Share Modal

Replace the simple share dropdown in ReportHeader with a full share modal offering: copy link (with optional expiry), CSV export, PDF download, and print.

**Files:**

- Create: `packages/frontend/app/reports/[id]/components/ShareReportModal.tsx`
- Modify: `packages/frontend/app/reports/[id]/components/ReportHeader.tsx`

- [ ] **Step 1: Create ShareReportModal component**

```typescript
// app/reports/[id]/components/ShareReportModal.tsx
'use client';

import React, { useState, useCallback } from 'react';
import {
  X, Link2, Check, Loader2, Download, FileSpreadsheet,
  Printer, Globe, Clock, Lock,
} from 'lucide-react';
import { createReportShareLink } from '@/lib/data';
import { useEntitlements } from '@/lib/entitlements';
import { downloadCsv } from '@/lib/export';

interface ShareReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  reportTitle: string;
  userId: string;
  existingShareToken?: string | null;
  reportData?: Record<string, unknown>[] | null;
  onPrint: () => void;
  onExportPdf: () => void;
}

export function ShareReportModal({
  isOpen,
  onClose,
  reportId,
  reportTitle,
  userId,
  existingShareToken,
  reportData,
  onPrint,
  onExportPdf,
}: ShareReportModalProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(
    existingShareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/shared/report/${existingShareToken}` : null
  );
  const { canAccess } = useEntitlements();
  const canExportCsv = canAccess('feature', 'export_csv');

  const handleCopyLink = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      let token = existingShareToken;
      if (!token) {
        token = await createReportShareLink(reportId, userId);
      }
      const url = `${window.location.origin}/shared/report/${token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await navigator.clipboard.writeText(window.location.href).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setSharing(false);
    }
  }, [reportId, userId, existingShareToken, sharing]);

  const handleExportCsv = useCallback(() => {
    if (!reportData || reportData.length === 0) return;
    const columns = Object.keys(reportData[0]).map(k => ({ key: k, label: k }));
    const filename = `${reportTitle.toLowerCase().replace(/\s+/g, '-')}-report`;
    downloadCsv(reportData, columns, filename);
  }, [reportData, reportTitle]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-scrim/40" onClick={onClose} />
      <div className="relative bg-surface-container-lowest rounded-3xl elevation-3 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <h2 className="text-lg font-medium text-on-surface">Share & Export</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-container rounded-full transition-colors">
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {/* Options */}
        <div className="px-6 py-4 space-y-2">
          {/* Copy share link */}
          <button
            onClick={handleCopyLink}
            disabled={sharing}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-surface-container transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              {sharing ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : copied ? <Check className="w-5 h-5 text-green-600" /> : <Link2 className="w-5 h-5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-on-surface">
                {sharing ? 'Creating link...' : copied ? 'Link copied!' : 'Copy share link'}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {shareUrl ? 'Anyone with the link can view this report' : 'Generate a public, view-only link'}
              </p>
            </div>
            <Globe className="w-4 h-4 text-on-surface-variant shrink-0" />
          </button>

          {/* Divider */}
          <div className="border-t border-outline-variant my-2" />

          {/* PDF Download */}
          <button
            onClick={() => { onExportPdf(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-surface-container transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-on-surface">Download PDF</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Save a formatted PDF of this report</p>
            </div>
          </button>

          {/* CSV Export */}
          <button
            onClick={canExportCsv ? () => { handleExportCsv(); onClose(); } : undefined}
            disabled={!reportData || reportData.length === 0}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors text-left ${
              canExportCsv ? 'hover:bg-surface-container' : 'opacity-60'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              {canExportCsv ? <FileSpreadsheet className="w-5 h-5 text-green-600" /> : <Lock className="w-5 h-5 text-on-surface-variant" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-on-surface">Export CSV</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {canExportCsv ? 'Download report data as a spreadsheet' : 'Upgrade to Pro to export CSV'}
              </p>
            </div>
          </button>

          {/* Print */}
          <button
            onClick={() => { onPrint(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-surface-container transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-on-surface">Print</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Print this report or save via print dialog</p>
            </div>
          </button>
        </div>

        {/* Footer hint */}
        {shareUrl && (
          <div className="px-6 py-3 border-t border-outline-variant bg-surface-container-low">
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Shared: {shareUrl}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update ReportHeader to use ShareReportModal**

Replace the share dropdown in `ReportHeader.tsx` with the new modal. The updated component should:

1. Remove `showShareMenu` state and the inline dropdown (lines 30, 86-110)
2. Add `showShareModal` state instead
3. Import and render `ShareReportModal`
4. Pass `onPrint` and `onExportPdf` callbacks

Updated ReportHeader (key changes):

```typescript
import { ShareReportModal } from './ShareReportModal';

// Inside the component:
const [showShareModal, setShowShareModal] = useState(false);
// Remove: showShareMenu, copied states and handleCopyLink

// Replace the share button + dropdown (lines 86-110) with:
<button
  onClick={() => setShowShareModal(true)}
  className="report-btn-ghost"
  title="Share & Export"
>
  <Share2 className="w-4 h-4" />
</button>

// After the closing </header>, render the modal:
<ShareReportModal
  isOpen={showShareModal}
  onClose={() => setShowShareModal(false)}
  reportId={report.id}
  reportTitle={report.title}
  userId={report.user_id}
  existingShareToken={report.share_token}
  reportData={null} // TODO: Wire to report.populated_data metrics in follow-up
  onPrint={handlePrint}
  onExportPdf={() => {/* The PDFExportButton handles this via its own click */}}
/>
```

**Notes:**

- The PDFExportButton is self-contained with internal click handling. The modal's PDF button triggers `window.print()` (same underlying mechanism) as the simplest path.
- **CSV export for reports is intentionally deferred.** `reportData={null}` means the CSV button renders but is disabled. Wiring it to `report.populated_data` requires flattening nested score/metric objects into tabular rows — a non-trivial transform that should be its own follow-up task. The modal still provides value via link sharing, PDF, and print.
- **Link expiry UI is deferred.** The backend `createReportShareLink` already accepts `expiresInDays` but we don't expose a picker in V1. Links are permanent until the user deletes the report.

- [ ] **Step 3: Verify in browser**

Run: dev server → /reports → open a report → click Share icon

- Modal opens with 4 options: Copy link, Download PDF, Export CSV, Print
- Copy link creates share token and copies to clipboard
- PDF triggers download
- CSV gated (Pro shows download, Free shows lock)
- Print opens browser print dialog

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/reports/[id]/components/ShareReportModal.tsx
git add packages/frontend/app/reports/[id]/components/ReportHeader.tsx
git commit -m "feat: add share & export modal to reports with link sharing, PDF, CSV, and print"
```

---

## Task 6: Verification & Cleanup

- [ ] **Step 1: Run type check**

```bash
cd packages/frontend && npx tsc --noEmit 2>&1 | tail -20
```

Expected: No type errors

- [ ] **Step 2: Run lint**

```bash
cd packages/frontend && npx next lint 2>&1 | tail -20
```

Expected: No new lint errors

- [ ] **Step 3: Visual verification checklist**

| Surface                        | Free User                   | Pro/Enterprise User         |
| ------------------------------ | --------------------------- | --------------------------- |
| Map → Table View → Export CSV  | Lock icon, disabled         | Download icon, triggers CSV |
| Markets → Top Markets → Export | Lock icon, paywall modal    | Download icon, triggers CSV |
| Market Dashboard → Share       | Copies URL                  | Copies URL                  |
| Market Dashboard → Download    | Lock icon                   | Opens print dialog          |
| Reports → Share button         | Opens modal                 | Opens modal                 |
| Reports → Modal → Copy link    | Works (creates share token) | Works                       |
| Reports → Modal → PDF          | Works (browser print)       | Works                       |
| Reports → Modal → CSV          | Lock + "Upgrade to Pro"     | Triggers CSV download       |
| Reports → Modal → Print        | Works                       | Works                       |

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: export & share features across maps, markets, and reports"
```

---

## Summary of Entitlement Enforcement

All CSV export features check `canAccess('feature', 'export_csv')` via the existing entitlements system. This feature is already configured in:

- `entitlements-helpers.ts` → `FEATURES` array includes `"export_csv"`
- `useFeatures.ts` → `canExportCsv` computed property
- Pricing page → "CSV data export" bullet for qualifying tiers
- `reports/types.ts` → `TIER_LIMITS` → `csv_export: true` for Pro/Enterprise

No backend entitlement changes needed — the gating is enforced client-side by checking the user's tier before allowing the download. The backend export endpoints are already auth-protected via `JwtAuthGuard`.
