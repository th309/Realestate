import type { SharedAnalysisBranding } from "@/lib/data/fetchers/analyzer";

interface Props {
  branding: SharedAnalysisBranding | null;
  compact?: boolean;
}

/**
 * White-label footer. The `compact` variant lives inside the PDF print
 * chrome (Puppeteer's footerTemplate) where Puppeteer renders the page-X-of-Y
 * counter via its own `<span class="pageNumber">` / `<span class="totalPages">`
 * elements. Non-compact is the on-screen share-page footer.
 */
export function OrgBrandingFooter({ branding, compact = false }: Props) {
  const contactBits = [
    branding?.support_email,
    branding?.phone,
    branding?.website_url,
  ].filter(Boolean);

  const disclaimer =
    branding?.report_disclaimer ??
    "This is not investment advice. PropertyIQ projections are estimates based on current market data and assumptions; actual results will vary.";

  const showPoweredBy = branding?.powered_by_visible !== false;

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          {contactBits.length > 0 && (
            <span className="opacity-70">{contactBits.join(" · ")}</span>
          )}
          <span className="opacity-60 text-[7px]">{disclaimer}</span>
        </div>
        <div className="flex items-center gap-3">
          {showPoweredBy && (
            <span className="opacity-50 text-[7px]">Powered by PropertyIQ</span>
          )}
          <span>
            Page <span className="pageNumber"></span> of{" "}
            <span className="totalPages"></span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <footer className="mt-12 pt-6 border-t border-outline-variant text-center text-sm text-on-surface-variant">
      {contactBits.length > 0 && (
        <p className="mb-2">{contactBits.join(" · ")}</p>
      )}
      <p className="text-xs max-w-2xl mx-auto opacity-80">{disclaimer}</p>
      {showPoweredBy && (
        <p className="mt-3 text-xs opacity-60">
          Powered by{" "}
          <a href="/analyzer" className="underline">
            PropertyIQ
          </a>
        </p>
      )}
    </footer>
  );
}
