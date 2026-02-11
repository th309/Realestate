'use client';

import React from 'react';
import { SectionProps } from '../types';

export function ScoreGaugeSingle({ section, report }: SectionProps) {
  const scoreType = section.config?.score_type || 'homeready';
  const score = scoreType === 'investoredge'
    ? report.investoredge_score
    : report.homeready_score;
  const label = scoreType === 'investoredge' ? 'InvestorEdge Score' : 'HomeReady Score';

  const getScoreColor = (s: number) => {
    if (s >= 70) return 'text-green-600';
    if (s >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return 'Excellent';
    if (s >= 70) return 'Good';
    if (s >= 50) return 'Moderate';
    if (s >= 30) return 'Below Average';
    return 'Poor';
  };

  return (
    <div className="bg-surface-container rounded-2xl p-6 text-center">
      <p className="text-sm text-on-surface-variant mb-2">{label}</p>
      <div className="relative w-32 h-32 mx-auto mb-4">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="16" fill="none"
            stroke={score && score >= 70 ? '#22c55e' : score && score >= 50 ? '#eab308' : '#ef4444'}
            strokeWidth="3"
            strokeDasharray={`${(score || 0)} 100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold ${getScoreColor(score || 0)}`}>{score || '--'}</span>
        </div>
      </div>
      <p className={`font-semibold ${getScoreColor(score || 0)}`}>{getScoreLabel(score || 0)}</p>
    </div>
  );
}
