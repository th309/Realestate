import { MagnetLandingShell } from "../components/magnet-landing/MagnetLandingShell";

export const metadata = {
  title: "5-Market Deep Comparison — Free PDF",
  description:
    "Side-by-side comparison of 5 markets: PropertyIQ Score, prices, rents, supply, demographics. Free 4-page PDF.",
};

export default function MarketComparisonPage() {
  return (
    <MagnetLandingShell
      magnetKind="market_comparison"
      eyebrow="Free 4-page PDF"
      title="Five markets, side-by-side."
      subtitle="Stop opening 5 browser tabs. We pull every metric you'd want to compare — prices, rents, supply, demographics — into one PDF, sorted by PropertyIQ Score so the strongest market is at the top."
      bullets={[
        "13 metrics × 5 markets in one table",
        "PropertyIQ Score + grade for each",
        "Months of supply, sold-above-list, DOM",
      ]}
      ctaLabel="Send the comparison"
      marketQueryPlaceholder="Austin, Phoenix, Tampa, …"
      coverEmoji="◫"
    />
  );
}
