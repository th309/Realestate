import Link from "next/link";

interface Props {
  geoLevel: "state" | "metro" | "county" | "zip";
  geoId: string;
  geoName: string;
}

/**
 * CTA shown on market detail pages that deep-links to the Deal Analyzer
 * pre-filled with this geography. Format: `?piq_market=<level>:<id>`.
 */
export default function AnalyzeCTA({ geoLevel, geoId, geoName }: Props) {
  return (
    <Link
      href={`/analyzer?piq_market=${encodeURIComponent(geoLevel + ":" + geoId)}`}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary shadow-sm hover:shadow-md transition"
    >
      Analyze a property in {geoName} →
    </Link>
  );
}
