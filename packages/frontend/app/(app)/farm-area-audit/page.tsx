import { MagnetLandingShell } from "@/app/components/magnet-landing/MagnetLandingShell";

export const metadata = {
  title: "Farm Area Audit — Free Report for Agents",
  description:
    "The 20 strongest farm areas in your metro, ranked by turnover, absentee ownership, and median value. Free 6-page PDF.",
};

export default function FarmAreaAuditPage() {
  return (
    <MagnetLandingShell
      magnetKind="farm_area_audit"
      eyebrow="Free 6-page PDF · For agents"
      title="Where to plant your farm — ranked."
      subtitle="The 20 strongest farm areas in your metro, scored by an opportunity blend of turnover (deals per year), absentee ownership (rentals = listing churn), and median value (your fee scales with it)."
      bullets={[
        "Top 20 ZIPs / neighborhoods in your metro",
        "Turnover %, absentee %, median value",
        "Opportunity score that blends all three",
      ]}
      ctaLabel="Send my audit"
      marketQueryPlaceholder="Your metro (Phoenix, Atlanta, …)"
      coverEmoji="⌖"
    />
  );
}
