'use client';

import React from 'react';
import { TrendingUp, TrendingDown, MapPin, Calendar, Shield } from 'lucide-react';

import type { ReportInstance } from '../../../../types';
import {
  getScoreStrokeColor,
  getScoreGrade,
  getScoreLabel,
  deriveConfidence,
  formatComponentLabel,
} from '../../utils/scoreHelpers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HeroProps {
  report: ReportInstance;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/** Score-to-text-color tailwind class (matches ExecutiveSummary) */
function getScoreColorClass(score: number): string {
  if (score >= 70) return 'text-[var(--report-success)]';
  if (score >= 50) return 'text-[var(--report-warning)]';
  return 'text-[var(--report-error)]';
}

/** Confidence badge color mapping */
function getConfidenceColors(level: 'A' | 'B' | 'C' | 'F'): { bg: string; text: string } {
  switch (level) {
    case 'A':
      return { bg: 'var(--report-success-bg)', text: 'var(--report-success)' };
    case 'B':
      return { bg: 'var(--report-warning-bg)', text: 'var(--report-warning)' };
    case 'C':
      return { bg: 'var(--report-error-bg)', text: 'var(--report-error)' };
    case 'F':
      return { bg: 'var(--report-error-bg)', text: 'var(--report-error)' };
  }
}

/** Format a geography type for display */
function formatGeoType(geoType: string): string {
  const map: Record<string, string> = {
    metro: 'Metro Area',
    county: 'County',
    zip: 'ZIP Code',
    city: 'City',
    state: 'State',
    national: 'National',
  };
  return map[geoType] || geoType;
}

/** Format the report date for display */
function formatDate(dateStr: string | null): string {
  if (!dateStr) {
    return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return dateStr;
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Score Ring Sub-component
// ---------------------------------------------------------------------------

function ScoreRing({ score }: { score: number }) {
  const size = 140;
  const strokeWidth = 10;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const progress = (Math.min(score, 100) / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`HomeReady Score: ${score} out of 100`}
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--report-cream-dark)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getScoreStrokeColor(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
      </svg>
      {/* Score number and label inside the ring */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-4xl font-bold ${getScoreColorClass(score)}`}
          style={{ fontFamily: 'var(--report-font-display)' }}
        >
          {score}
        </span>
        <span
          className="text-[10px] font-medium uppercase tracking-wide mt-0.5"
          style={{ color: 'var(--report-stone-light)', fontFamily: 'var(--report-font-body)' }}
        >
          HomeReady
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero Component
// ---------------------------------------------------------------------------

export function Hero({ report }: HeroProps): React.ReactElement {
  const score = report.homeready_score ?? report.scores_snapshot?.homeready_score ?? null;
  const grade = (report.scores_snapshot as any)?.homeready_grade as string | undefined;
  const components = report.scores_snapshot?.homeready_components;
  const heroVerdict = report.ai_narrative?.hero_verdict;
  const priorities = report.user_inputs?.priorities;
  const trendChange =
    (report.scores_snapshot as any)?.homeready_trend ??
    (report.scores_snapshot as any)?.trend_change ??
    null;

  const hasScore = score !== null && score !== undefined;
  const computedGrade = hasScore ? (grade || getScoreGrade(score)) : null;
  const computedLabel = hasScore ? getScoreLabel(score) : null;

  const confidence = hasScore
    ? deriveConfidence(report.confidence_level, components)
    : null;

  // If there is genuinely nothing to show, provide a loading state
  if (!hasScore && !heroVerdict) {
    return (
      <section
        className="report-animate-in rounded-[var(--report-radius-xl)] p-[var(--report-space-xl)] md:p-[var(--report-space-2xl)] text-center"
        style={{ backgroundColor: 'white', border: '1px solid rgba(27, 46, 74, 0.04)' }}
      >
        <p
          className="text-[0.9375rem]"
          style={{ color: 'var(--report-stone-light)', fontFamily: 'var(--report-font-body)' }}
        >
          Your HomeReady report is being prepared. Check back shortly.
        </p>
      </section>
    );
  }

  return (
    <section
      className="report-animate-in rounded-[var(--report-radius-xl)] overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, white 0%, var(--report-cream) 100%)',
        border: '1px solid rgba(27, 46, 74, 0.06)',
        boxShadow: 'var(--report-shadow-md)',
      }}
      aria-label="HomeReady Score Hero"
    >
      <div className="p-[var(--report-space-xl)] md:p-[var(--report-space-2xl)]">
        {/* ----------------------------------------------------------------- */}
        {/* Score Ring + Grade Row                                             */}
        {/* ----------------------------------------------------------------- */}
        {hasScore && (
          <div className="flex flex-col items-center text-center mb-[var(--report-space-xl)]">
            <ScoreRing score={score} />

            {/* Grade + Label */}
            <div className="flex items-center gap-2 mt-4">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor:
                    score >= 70
                      ? 'var(--report-success-bg)'
                      : score >= 50
                        ? 'var(--report-warning-bg)'
                        : 'var(--report-error-bg)',
                  color: getScoreStrokeColor(score),
                  fontFamily: 'var(--report-font-body)',
                }}
              >
                {computedGrade} {'\u00B7'} {computedLabel}
              </span>

              {/* Confidence badge */}
              {confidence && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[0.625rem] font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: getConfidenceColors(confidence).bg,
                    color: getConfidenceColors(confidence).text,
                    fontFamily: 'var(--report-font-body)',
                  }}
                >
                  <Shield className="w-3 h-3" aria-hidden="true" />
                  {confidence}
                </span>
              )}
            </div>

            {/* Trend change */}
            {trendChange !== null && trendChange !== undefined && trendChange !== 0 && (
              <div
                className="flex items-center gap-1 mt-2 text-xs font-medium"
                style={{
                  color:
                    trendChange > 0
                      ? 'var(--report-success)'
                      : 'var(--report-error)',
                }}
              >
                {trendChange > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>
                  {trendChange > 0 ? '+' : ''}
                  {typeof trendChange === 'number' ? trendChange.toFixed(1) : trendChange} from last
                  period
                </span>
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* AI Verdict                                                         */}
        {/* ----------------------------------------------------------------- */}
        {heroVerdict && (
          <blockquote
            className="text-center mx-auto max-w-2xl mb-[var(--report-space-xl)] report-animate-in report-animate-in-delay-1"
          >
            <p
              className="text-lg md:text-xl leading-relaxed italic"
              style={{
                color: 'var(--report-navy)',
                fontFamily: 'var(--report-font-display)',
                fontWeight: 500,
              }}
            >
              {'\u201C'}{heroVerdict}{'\u201D'}
            </p>
          </blockquote>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Priority Tags                                                      */}
        {/* ----------------------------------------------------------------- */}
        {priorities && priorities.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-[var(--report-space-lg)] report-animate-in report-animate-in-delay-2">
            {priorities.map((priority) => (
              <span
                key={priority}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: 'var(--report-cream-dark)',
                  color: 'var(--report-stone)',
                  fontFamily: 'var(--report-font-body)',
                }}
              >
                {formatComponentLabel(priority)}
              </span>
            ))}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Component Quick Glance (top 3 components as compact pills)         */}
        {/* ----------------------------------------------------------------- */}
        {components && components.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mb-[var(--report-space-lg)] report-animate-in report-animate-in-delay-2">
            {[...components]
              .sort((a, b) => b.score - a.score)
              .slice(0, 3)
              .map((comp) => (
                <div
                  key={comp.component}
                  className="flex items-center gap-2 px-4 py-2 rounded-[var(--report-radius-md)]"
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid rgba(27, 46, 74, 0.06)',
                  }}
                >
                  <span
                    className="text-sm font-semibold"
                    style={{
                      color: getScoreStrokeColor(comp.score),
                      fontFamily: 'var(--report-font-display)',
                    }}
                  >
                    {comp.score}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{
                      color: 'var(--report-stone)',
                      fontFamily: 'var(--report-font-body)',
                    }}
                  >
                    {formatComponentLabel(comp.component)}
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Meta Line: Market, Geo Type, Date                                  */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex items-center justify-center gap-3 text-xs report-animate-in report-animate-in-delay-3"
          style={{ color: 'var(--report-stone-light)', fontFamily: 'var(--report-font-body)' }}
        >
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" aria-hidden="true" />
            {report.primary_geography_name}
          </span>
          <span aria-hidden="true">{'\u00B7'}</span>
          <span>{formatGeoType(report.primary_geography_type)}</span>
          <span aria-hidden="true">{'\u00B7'}</span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" aria-hidden="true" />
            {formatDate(report.data_as_of_date)}
          </span>
        </div>
      </div>
    </section>
  );
}

export default Hero;
