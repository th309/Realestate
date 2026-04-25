import { MagnetLandingShell } from "../components/magnet-landing/MagnetLandingShell";

export const metadata = {
  title: "Top 50 Cashflow Markets — Free Report",
  description:
    "5-page PDF ranking the top 50 cashflow markets in your state. Built on Zillow ZHVI, Redfin, and the PropertyIQ Score.",
};

export default function TopCashflowReportPage() {
  return (
    <MagnetLandingShell
      magnetKind="top_50_cashflow_report"
      eyebrow="Free 5-page PDF"
      title="Top 50 cashflow markets in your state."
      subtitle="Where rent-to-price actually pencils, ranked. No vibes — just the numbers, blended with the PropertyIQ Score so you skip markets that look cheap but bleed tenants."
      bullets={[
        "Top 50 markets ranked by rent-to-price ratio",
        "PropertyIQ Score for each — strength of the surrounding market",
        "Median price, median rent, vacancy",
      ]}
      ctaLabel="Send my report"
      marketQueryPlaceholder="Texas, California, …"
      coverEmoji="$"
    />
  );
}
