import type { Metadata } from "next";
import { fetchScore } from "@/lib/data";
import { EmbedScoreWidget } from "./EmbedScoreWidget";

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
const VALID_SCORE_TYPES = ["homeready", "investoredge", "markethealth"];

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
 * Renders a minimal score display designed for iframe embedding.
 * No auth required. No header/footer/sidebar.
 *
 * URL: /embed/score/:geoLevel/:geoId?scoreType=homeready&theme=light
 *
 * Examples:
 *   /embed/score/metro/31080
 *   /embed/score/county/24001?scoreType=investoredge
 *   /embed/score/zip/90210?scoreType=markethealth&theme=dark
 */
export default async function EmbedScorePage({
  params,
  searchParams,
}: EmbedScorePageProps) {
  const { geoLevel, geoId } = await params;
  const { scoreType: rawScoreType, theme } = await searchParams;

  // Validate geo level
  if (!VALID_GEO_LEVELS.includes(geoLevel)) {
    return <EmbedErrorState message={`Invalid geography level: ${geoLevel}`} />;
  }

  // Validate and default score type
  const scoreType =
    rawScoreType && VALID_SCORE_TYPES.includes(rawScoreType)
      ? (rawScoreType as "homeready" | "investoredge" | "markethealth")
      : "homeready";

  // Fetch score data server-side
  const scoreData = await fetchScore(geoLevel, geoId);

  if (!scoreData || !scoreData.scores) {
    return <EmbedErrorState message="Score data unavailable" />;
  }

  const selectedScore = scoreData.scores[scoreType];
  if (!selectedScore) {
    return <EmbedErrorState message={`No ${scoreType} score available`} />;
  }

  const isDark = theme === "dark";

  return (
    <EmbedScoreWidget
      locationName={scoreData.location_name}
      score={selectedScore.score}
      grade={selectedScore.grade}
      confidenceLevel={selectedScore.confidence_level}
      scoreType={scoreType}
      isDark={isDark}
    />
  );
}

function EmbedErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-[200px] p-4">
      <p className="text-sm text-on-surface-variant">{message}</p>
    </div>
  );
}
