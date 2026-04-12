"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSocialProof } from "@/lib/data/fetchers/social-proof";

interface SocialProofBadgeProps {
  geoLevel: string;
  geoId: string;
  variant: "tracking" | "score_checks" | "reports";
}

const LABELS: Record<string, (n: number) => string> = {
  tracking: (n) => `${n.toLocaleString()} investors tracking this market`,
  score_checks: (n) => `Viewed ${n.toLocaleString()} times this month`,
  reports: (n) => `${n.toLocaleString()} reports generated this month`,
};

export function SocialProofBadge({
  geoLevel,
  geoId,
  variant,
}: SocialProofBadgeProps) {
  const { data } = useQuery({
    queryKey: ["social-proof", geoLevel, geoId],
    queryFn: () => fetchSocialProof(geoLevel, geoId),
    staleTime: 1000 * 60 * 60,
  });

  if (!data) return null;

  const count =
    variant === "tracking"
      ? data.tracking
      : variant === "score_checks"
        ? data.scoreChecks
        : data.reports;

  if (count < 10) return null;

  return (
    <span className="text-xs text-on-surface-variant/60">
      {LABELS[variant](count)}
    </span>
  );
}
