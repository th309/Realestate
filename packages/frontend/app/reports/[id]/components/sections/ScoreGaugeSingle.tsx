'use client';

import { AlertTriangle } from 'lucide-react';

import type { SectionProps } from '../types';

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Below Average';
  return 'Poor';
}

function getStrokeColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#eab308';
  return '#ef4444';
}

export function ScoreGaugeSingle({ section, report }: SectionProps): React.ReactElement {
  const scoreType = section.config?.score_type || 'homeready';
  const score = scoreType === 'investoredge'
    ? report.investoredge_score
    : report.homeready_score;
  const label = scoreType === 'investoredge' ? 'InvestorEdge Score' : 'HomeReady Score';

  if (score === null || score === undefined) {
    return (
      <div className="bg-surface-container rounded-2xl p-6 text-center">
        <p className="text-sm text-on-surface-variant mb-2">{label}</p>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <p>Score not available for this location</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-2xl p-6 text-center">
      <p className="text-sm text-on-surface-variant mb-2">{label}</p>
      <div className="relative w-32 h-32 mx-auto mb-4">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="16" fill="none"
            stroke={getStrokeColor(score)}
            strokeWidth="3"
            strokeDasharray={`${score} 100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</span>
        </div>
      </div>
      <p className={`font-semibold ${getScoreColor(score)}`}>{getScoreLabel(score)}</p>
    </div>
  );
}
