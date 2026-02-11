'use client';

import { AlertTriangle } from 'lucide-react';

import type { SectionProps } from '../types';

interface ScoreComponent {
  name: string;
  score: number;
}

function getBarColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

function formatComponentName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
}

export function ScoreBreakdown({ section, report }: SectionProps): React.ReactElement {
  const scoreType = section.config?.score_type || (report.user_type === 'investor' ? 'investoredge' : 'homeready');
  const details = scoreType === 'investoredge'
    ? report.scores_snapshot?.investoredge_details
    : report.scores_snapshot?.homeready_details;

  if (!details) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">Score Breakdown</h3>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <p>Score breakdown not available for this location</p>
        </div>
      </div>
    );
  }

  const components: ScoreComponent[] = Object.entries(details).map(([key, value]) => ({
    name: formatComponentName(key),
    score: value as number,
  }));

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
