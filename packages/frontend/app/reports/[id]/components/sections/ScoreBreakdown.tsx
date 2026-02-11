'use client';

import React from 'react';
import { SectionProps } from '../types';

export function ScoreBreakdown({ section, report }: SectionProps) {
  const scoreType = section.config?.score_type || report.user_type === 'investor' ? 'investoredge' : 'homeready';
  const details = scoreType === 'investoredge'
    ? report.scores_snapshot?.investoredge_details
    : report.scores_snapshot?.homeready_details;

  if (!details) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <p className="text-on-surface-variant text-center">Score breakdown not available</p>
      </div>
    );
  }

  const components = Object.entries(details).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    score: value as number,
  }));

  const getBarColor = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">Score Breakdown</h3>
      <div className="space-y-4">
        {components.map((comp) => (
          <div key={comp.name}>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-on-surface">{comp.name}</span>
              <span className="text-sm font-medium text-on-surface">{comp.score}</span>
            </div>
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(comp.score)}`}
                style={{ width: `${comp.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
