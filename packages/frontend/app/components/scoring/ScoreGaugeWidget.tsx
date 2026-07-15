"use client";

/**
 * ScoreGaugeWidget - Connected Gauge Composition
 *
 * A "smart" component that fetches score data (same contract as ScoreWidget:
 * useScoreData keyed on geographyType/geographyId) and renders the editorial
 * gauge composition — ScoreGaugeRing + "PropertyIQ Score" caption + confidence
 * pill + momentum caption — matching the forecast hero's server-rendered
 * layout (app/(public)/forecast/[slug]/page.tsx). Use this wherever the ring
 * needs to fetch its own data (client-rendered market pages); the forecast
 * hero stays server-rendered and inlines the same JSX since it already has
 * the score from a server fetch.
 */

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics/tracker";
import { ScoreGaugeRing } from "./ScoreGaugeRing";
import { confidencePillClass } from "./confidence-pill";
import {
  useScoreData,
  type GeographyType,
  type ScoreType,
} from "@/app/map/hooks/useScoreData";

export interface ScoreGaugeWidgetProps {
  /** Geography type (state, metro, county, etc.) */
  geographyType: GeographyType | null;
  /** Geography ID (FIPS code, CBSA code, etc.) */
  geographyId: string | null;
  /** Which score to display */
  scoreType: ScoreType;
  /** Custom class name for the outer container */
  className?: string;
}

const GAUGE_SIZE = 156;

/**
 * ScoreGaugeWidget fetches score data from useScoreData and renders the full
 * gauge composition.
 *
 * @example
 * <ScoreGaugeWidget
 *   geographyType="metro"
 *   geographyId="31080"
 *   scoreType="propertyiq"
 * />
 */
export function ScoreGaugeWidget({
  geographyType,
  geographyId,
  scoreType,
  className = "",
}: ScoreGaugeWidgetProps) {
  const { data, loading } = useScoreData(geographyType, geographyId);

  // Track score view once per mount, mirroring ScoreWidget's telemetry.
  const hasFiredRef = useRef(false);
  useEffect(() => {
    if (!hasFiredRef.current && !loading && data) {
      hasFiredRef.current = true;
      trackEvent("feature.score_view", {
        geography_type: geographyType,
        score_type: scoreType,
      });
    }
  }, [loading, data, geographyType, scoreType]);

  // Extract score, grade, and confidence percentage for the requested type
  const scoreData = React.useMemo(() => {
    if (!data) return { score: null, grade: null, confidencePct: null };

    const scoreObj = data.propertyiq;
    if (
      typeof scoreObj === "object" &&
      scoreObj !== null &&
      "score" in scoreObj
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = scoreObj as any;
      const score = s.score as number | null;
      const grade = s.confidence?.level
        ? (s.confidence.level as string).toUpperCase()
        : null;
      const confidencePct =
        s.confidence?.percentage != null
          ? (Number(s.confidence.percentage) as number)
          : null;
      return { score, grade, confidencePct };
    }

    return { score: null, grade: null, confidencePct: null };
  }, [data]);

  // Loading state — small spinner, no layout jump
  if (loading) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}
        aria-label="Loading score"
      >
        <Loader2 className="w-8 h-8 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  // No score available — render nothing (callers own surrounding chrome)
  if (scoreData.score === null) {
    return null;
  }

  return (
    <div className={`flex flex-col items-center gap-3.5 ${className}`}>
      <ScoreGaugeRing value={scoreData.score} size={GAUGE_SIZE} showLabel />
      <p className="text-[13px] font-medium text-on-surface-variant">
        PropertyIQ Score
      </p>
      <div className="flex w-full max-w-[240px] flex-col items-center gap-1.5">
        {scoreData.grade && (
          <span
            className={`inline-flex h-6 w-full items-center justify-center rounded-full font-mono text-[11px] font-semibold tracking-[0.05em] ${confidencePillClass(scoreData.grade)}`}
          >
            {scoreData.confidencePct !== null
              ? `${scoreData.grade} · ${Math.round(scoreData.confidencePct)}% CONFIDENCE`
              : scoreData.grade}
          </span>
        )}
        <span className="text-center text-[11px] leading-snug text-on-surface-variant">
          50 = state average · higher = stronger momentum
        </span>
        <Link
          href="/scores/methodology"
          className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
        >
          How it&apos;s calculated →
        </Link>
      </div>
    </div>
  );
}

export default ScoreGaugeWidget;
