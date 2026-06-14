"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { ReportViewer } from "@/app/reports/[id]/ReportViewer";
import { EmbedLoadingSkeleton } from "../../components";

/**
 * Embeddable Report Viewer Page
 *
 * Renders a read-only, branded report inside an iframe — no entitlement gate,
 * no breadcrumbs, no app navigation. The surrounding EmbedShell (from layout)
 * handles token validation and org branding.
 *
 * URL: /embed/report/:reportId?token=emb_...
 */
export default function EmbedReportPage() {
  const params = useParams();
  const reportId = params.reportId as string;

  if (!reportId) {
    return (
      <div className="flex items-center justify-center min-h-[200px] p-6">
        <p className="text-sm text-on-surface-variant">Missing report ID.</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<EmbedLoadingSkeleton />}>
      <ReportViewer reportId={reportId} />
    </Suspense>
  );
}
