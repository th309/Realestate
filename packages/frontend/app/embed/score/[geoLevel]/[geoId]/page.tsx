import type { Metadata } from "next";
import { fetchScore } from "@/lib/data";
import { EmbedScoreRing, EmbedErrorState } from "../../../components";

interface EmbedScorePageProps {
  params: Promise<{
    geoLevel: string;
    geoId: string;
  }>;
  searchParams: Promise<{
    scoreType?: string;
    theme?: string;
  }>;
}

const VALID_GEO_LEVELS = ["metro", "county", "zip"];
const VALID_SCORE_TYPES = [
  "propertyiq",
  "homeready",
  "investoredge",
  "markethealth",
];

export async function generateMetadata({
  params,
}: EmbedScorePageProps): Promise<Metadata> {
  const { geoLevel, geoId } = await params;
  return {
    title: `PropertyIQ Score — ${geoLevel} ${geoId}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Embeddable Score Widget Page
 *
 * Server component that fetches score data and renders EmbedScoreRing.
 * Branding (header bar + footer) is handled by EmbedShell in the layout.
 *
 * URL: /embed/score/:geoLevel/:geoId?scoreType=homeready&token=emb_...
 *
 * Examples:
 *   /embed/score/metro/31080
 *   /embed/score/county/24001?scoreType=investoredge
 *   /embed/score/zip/90210?scoreType=markethealth&token=emb_abc123
 */
export default async function EmbedScorePage({
  params,
  searchParams,
}: EmbedScorePageProps) {
  const { geoLevel, geoId } = await params;
  const { scoreType: rawScoreType } = await searchParams;

  // Validate geo level
  if (!VALID_GEO_LEVELS.includes(geoLevel)) {
    return <EmbedErrorState message={`Invalid geography level: ${geoLevel}`} />;
  }

  // Validate and default score type
  const scoreType =
    rawScoreType && VALID_SCORE_TYPES.includes(rawScoreType)
      ? (rawScoreType as
          | "propertyiq"
          | "homeready"
          | "investoredge"
          | "markethealth")
      : "propertyiq";

  // Fetch score data server-side
  const scoreData = await fetchScore(geoLevel, geoId);

  if (!scoreData || !scoreData.scores) {
    return <EmbedErrorState message="Score data unavailable" />;
  }

  const selectedScore = scoreData.scores[scoreType];
  if (!selectedScore) {
    return <EmbedErrorState message={`No ${scoreType} score available`} />;
  }

  return (
    <div className="flex items-center justify-center p-2">
      <EmbedScoreRing
        score={selectedScore.score}
        scoreType={scoreType}
        geoName={scoreData.location_name}
        confidence={{
          level: selectedScore.confidence_level,
          percentage: selectedScore.confidence,
        }}
      />
    </div>
  );
}
