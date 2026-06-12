import Link from "next/link";
import { FileText } from "lucide-react";

type ReportGeoLevel = "state" | "metro" | "county" | "zip";

interface Props {
  geoLevel: ReportGeoLevel;
  /** Bare geo id: CBSA code (metro), FIPS (county), ZIP, or state abbrev. */
  geoId: string;
  geoName: string;
  /** 2-letter state abbreviation, carried through as report context. */
  stateAbbr?: string;
}

/**
 * CTA on market (geography) pages that bridges into the AI Report builder with
 * this geography preselected — explore a market, then get its full report.
 *
 * Reports are the geography-scale tool. The Deal Analyzer is for SPECIFIC
 * properties only and is intentionally NOT linked from a geography. The report
 * builder reads `mid`/`mname`/`mtype`/`mstate` (app/reports/page.tsx priority-1
 * URL prefill); ids are bare because the report backend resolves metros by
 * CBSA, counties by FIPS, etc.
 */
export default function MarketReportCTA({
  geoLevel,
  geoId,
  geoName,
  stateAbbr,
}: Props) {
  const qs = new URLSearchParams({
    mid: geoId,
    mname: geoName,
    mtype: geoLevel,
  });
  if (stateAbbr) qs.set("mstate", stateAbbr);

  return (
    <Link
      href={`/reports?${qs.toString()}`}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary shadow-sm hover:shadow-md transition"
    >
      <FileText className="w-4 h-4" />
      Get the full {geoName} market report →
    </Link>
  );
}
