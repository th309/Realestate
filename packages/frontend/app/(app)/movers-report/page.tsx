import { MagnetLandingShell } from "@/app/components/magnet-landing/MagnetLandingShell";

export const metadata = {
  title: "Movers and Shakers — Monthly Report",
  description:
    "Markets that moved 5+ PropertyIQ points in the last month. Free 3-page PDF.",
};

export default function MoversReportPage() {
  return (
    <MagnetLandingShell
      magnetKind="movers_report"
      eyebrow="Free monthly drop"
      title="Markets that just moved — and the ones that just dropped."
      subtitle="Every month, we pull the markets that gained or lost 5+ PropertyIQ Score points in the last 30 days. Get there before everyone else figures it out."
      bullets={[
        "Top 15 movers up — demand heating fast",
        "Top 15 movers down — sellers losing leverage",
        "Days-on-market and Δ-30d for each",
      ]}
      ctaLabel="Send the next drop"
      marketQueryPlaceholder="Nationwide or a specific state"
      coverEmoji="↗"
    />
  );
}
