/**
 * Public read-only shared analysis page.
 *
 * Accessed via /shared/analysis/<share_token> with NO auth — the share token
 * itself is the capability. Backend endpoint /api/analyzer/share/:token uses a
 * SECURITY DEFINER Postgres function that strips PII (owner_id, full address,
 * lat/lon) before returning the row.
 *
 * Two render modes share this single template:
 * - Default: the recipient view (with org branding + on-screen CTA footer).
 * - `?print=1`: source for the Puppeteer-backed PDF render. Same content,
 *   different chrome (PDF header/footer extracted via data-pdf-header /
 *   data-pdf-footer attributes).
 *
 * Branding loads in parallel with the analysis row; null branding (owner has
 * no organization) falls back to PropertyIQ defaults.
 */

import { fetchSharedAnalysis } from "@/lib/data/fetchers/analyzer";
import { fetchSharedAnalysisBranding } from "@/lib/data/fetchers/analyzer-share";
import { notFound } from "next/navigation";
import { OrgBrandingHeader } from "./components/OrgBrandingHeader";
import { OrgBrandingFooter } from "./components/OrgBrandingFooter";
import { ReadonlyAnalyzerView } from "./ReadonlyAnalyzerView";
import "./print-mode.css";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ print?: string }>;
}

export default async function SharedAnalysisPage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const [row, branding] = await Promise.all([
    fetchSharedAnalysis(token),
    fetchSharedAnalysisBranding(token),
  ]);
  if (!row) notFound();

  const isPrintMode = (await searchParams)?.print === "1";
  const accentColor = branding?.accent_color ?? "#3949AB";

  return (
    <main
      className={`min-h-screen bg-surface ${isPrintMode ? "print-mode" : ""}`}
      style={
        { ["--brand-primary" as string]: accentColor } as React.CSSProperties
      }
    >
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className={isPrintMode ? "header-rule" : ""}>
          <OrgBrandingHeader branding={branding} subtitle="Deal Analysis" />
        </div>

        <ReadonlyAnalyzerView row={row} branding={branding} />

        {!isPrintMode && (
          <footer
            data-share-cta
            className="mt-12 pt-6 border-t border-outline-variant text-center"
          >
            <a
              href="/analyzer"
              className="inline-block px-6 py-3 rounded-full bg-primary text-on-primary"
            >
              Analyze a property of your own →
            </a>
            <OrgBrandingFooter branding={branding} />
          </footer>
        )}

        {/* Hidden PDF chrome sources — Puppeteer extracts innerHTML and feeds
            it into headerTemplate / footerTemplate. Display:none on screen. */}
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
}
