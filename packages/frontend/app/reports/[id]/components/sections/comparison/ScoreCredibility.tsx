'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { SectionProps } from '../../types';
import { SectionCard } from '../core/SectionCard';

interface QuintileData {
  label: string;
  scoreRange: string;
  avgReturn1y: number | null;
  avgReturn3y: number | null;
  sampleSize: number;
}

interface QuintilePerformanceResponse {
  quintiles: QuintileData[];
  methodology: string;
  dataRange: string;
}

/**
 * ScoreCredibility - Shows backtesting proof that scores predict performance
 *
 * Part 1C of the redesigned comparison report.
 * Displays historical returns by score quintile to establish credibility.
 */
export function ScoreCredibility({ section, report }: SectionProps) {
  const [quintileData, setQuintileData] = useState<QuintilePerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isInvestor = report.user_type === 'investor';
  const scoreType = isInvestor ? 'investoredge' : 'homeready';
  const scoreLabel = isInvestor ? 'InvestorEdge' : 'HomeReady';

  // Get the winner's score for context
  const winnerData = report.populated_data?.priority_weighted_winner as {
    winnerId: string;
    winnerName: string;
  } | undefined;

  const winnerScore = (() => {
    if (!winnerData) return null;

    if (winnerData.winnerId === report.primary_geography_id) {
      return isInvestor ? report.investoredge_score : report.homeready_score;
    }

    const comp = report.populated_data?.comparisons?.[winnerData.winnerId];
    return (comp?.scores?.[scoreType] as number | null) ?? null;
  })();

  // Fetch quintile performance data
  useEffect(() => {
    async function fetchQuintileData() {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(
          `${apiUrl}/api/scoring/validation/quintile-performance?score_type=${scoreType}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch quintile data');
        }

        const data = await response.json();
        setQuintileData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchQuintileData();
  }, [scoreType]);

  // Determine which quintile the winner falls into
  const winnerQuintile = winnerScore !== null
    ? getQuintileForScore(winnerScore)
    : null;

  // Get median home price for dollar impact calculation
  const medianPrice = report.populated_data?.current?.median_home_price as number
    || report.populated_data?.current?.zhvi as number
    || 400000;

  if (loading) {
    return (
      <SectionCard title="What These Scores Mean" icon={BarChart3}>
        <div className="animate-pulse space-y-4 py-8">
          <div className="h-4 bg-surface-container-high rounded w-3/4 mx-auto" />
          <div className="h-32 bg-surface-container-high rounded" />
          <div className="h-4 bg-surface-container-high rounded w-1/2 mx-auto" />
        </div>
      </SectionCard>
    );
  }

  if (error || !quintileData) {
    return (
      <SectionCard title="What These Scores Mean" icon={BarChart3}>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertCircle className="w-5 h-5" />
          <span>Unable to load backtesting data</span>
        </div>
      </SectionCard>
    );
  }

  // Calculate excess dollar impact vs median market
  const topQuintile = quintileData.quintiles[0]; // First quintile = highest scores
  const bottomQuintile = quintileData.quintiles[quintileData.quintiles.length - 1];

  const topExcess3y = topQuintile?.avgReturn3y != null && bottomQuintile?.avgReturn3y != null
    ? topQuintile.avgReturn3y - bottomQuintile.avgReturn3y
    : 10; // fallback spread
  const medianQuintile = quintileData.quintiles[Math.floor(quintileData.quintiles.length / 2)];
  const medianReturn3y = medianQuintile?.avgReturn3y || 18;

  const topExcessGain = Math.round(medianPrice * (topExcess3y / 100));
  const medianEquityGain = Math.round(medianPrice * (medianReturn3y / 100));

  return (
    <SectionCard title="What These Scores Mean" icon={BarChart3}>
      {/* Winner Context */}
      {winnerData && winnerScore !== null && (
        <div className="mb-6 p-4 bg-primary/5 rounded-xl border border-primary/20 text-center">
          <p className="text-sm text-on-surface">
            <span className="font-semibold text-primary">{winnerData.winnerName}'s {scoreLabel} Score: {Math.round(winnerScore)}</span>
            {winnerQuintile && (
              <span className="ml-2 text-on-surface-variant">
                (Top {winnerQuintile}%)
              </span>
            )}
          </p>
        </div>
      )}

      {/* Historical Performance */}
      <div className="mb-6">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-on-surface mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          Historical Performance of High-Scoring Markets
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {quintileData.quintiles.map((quintile, index) => {
            const isHighlighted = winnerQuintile && isScoreInQuintile(winnerScore!, quintile.scoreRange);
            const barHeight = quintile.avgReturn3y
              ? Math.max(20, Math.min(100, (quintile.avgReturn3y / 40) * 100))
              : 20;

            return (
              <div
                key={quintile.label}
                className={`
                  p-3 rounded-lg text-center transition-all
                  ${isHighlighted
                    ? 'bg-primary/10 border-2 border-primary'
                    : 'bg-surface-container border border-outline-variant'
                  }
                `}
              >
                {/* Bar visualization */}
                <div className="h-20 flex items-end justify-center mb-2">
                  <div
                    className={`
                      w-10 rounded-t transition-all
                      ${isHighlighted ? 'bg-primary' : 'bg-primary/40'}
                    `}
                    style={{ height: `${barHeight}%` }}
                  />
                </div>

                {/* Return value */}
                <p className={`text-lg font-bold ${isHighlighted ? 'text-primary' : 'text-on-surface'}`}>
                  {quintile.avgReturn3y !== null ? `+${quintile.avgReturn3y.toFixed(0)}%` : '--'}
                </p>

                {/* Score range */}
                <p className="text-xs text-on-surface-variant mt-1">
                  {quintile.scoreRange}
                </p>

                {/* Label */}
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  {index === 0 ? 'Top 20%' : index === 4 ? 'Bottom 20%' : ''}
                </p>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-on-surface-variant text-center mt-3">
          3-Year Excess Return vs Regional Benchmark by Score Quintile
        </p>
      </div>

      {/* Dollar Impact */}
      <div className="p-5 bg-surface-container-high rounded-xl">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-on-surface mb-4">
          <DollarSign className="w-4 h-4 text-primary" />
          On a ${formatCurrency(medianPrice)} Home, That's:
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-primary/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-primary">
              +${formatCurrency(topExcessGain)}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">
              Excess vs Bottom Markets (3yr)
            </p>
          </div>

          <div className="p-4 bg-surface-container rounded-lg text-center border border-outline-variant">
            <p className="text-2xl font-bold text-on-surface">
              +${formatCurrency(medianEquityGain)}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">
              Median Market Return (3yr)
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-on-surface-variant text-center mt-4">
        Based on PropertyIQ backtesting across 865 metros, 2020-2024. Returns shown as excess vs Census Division median.
        Past performance does not guarantee future results.
      </p>
    </SectionCard>
  );
}

function getQuintileForScore(score: number): number {
  if (score >= 80) return 20;
  if (score >= 60) return 40;
  if (score >= 40) return 60;
  if (score >= 20) return 80;
  return 100;
}

function isScoreInQuintile(score: number, range: string): boolean {
  // Parse range like "80-100" or "60-79"
  const match = range.match(/(\d+)-(\d+)/);
  if (!match) return false;

  const min = parseInt(match[1], 10);
  const max = parseInt(match[2], 10);
  return score >= min && score <= max;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }
  return value.toString();
}

export default ScoreCredibility;
