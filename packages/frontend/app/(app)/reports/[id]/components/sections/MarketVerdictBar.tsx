'use client';

import { AlertTriangle, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';

import type { SectionProps } from '../types';

interface VerdictConfig {
  text: string;
  icon: typeof ThumbsUp;
  color: string;
  textColor: string;
}

function getVerdict(score: number): VerdictConfig {
  if (score >= 70) return { text: 'Strong Buy', icon: ThumbsUp, color: 'bg-green-500', textColor: 'text-green-700' };
  if (score >= 55) return { text: 'Moderate Buy', icon: ThumbsUp, color: 'bg-green-300', textColor: 'text-green-600' };
  if (score >= 45) return { text: 'Hold / Research', icon: Minus, color: 'bg-yellow-400', textColor: 'text-yellow-700' };
  if (score >= 30) return { text: 'Caution', icon: ThumbsDown, color: 'bg-orange-400', textColor: 'text-orange-700' };
  return { text: 'Avoid', icon: ThumbsDown, color: 'bg-red-500', textColor: 'text-red-700' };
}

export function MarketVerdictBar({ section, report }: SectionProps): React.ReactElement {
  const score = report.user_type === 'investor'
    ? report.investoredge_score
    : report.homeready_score;

  if (score === null || score === undefined) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">Market Verdict</h3>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <p>Score not available for this location</p>
        </div>
      </div>
    );
  }

  const verdict = getVerdict(score);
  const Icon = verdict.icon;

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-on-surface">Market Verdict</h3>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${verdict.color}/20`}>
          <Icon className={`w-4 h-4 ${verdict.textColor}`} />
          <span className={`font-semibold ${verdict.textColor}`}>{verdict.text}</span>
        </div>
      </div>
      <div className="relative h-3 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 rounded-full">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-on-surface rounded-full shadow-md transition-all"
          style={{ left: `${score}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-on-surface-variant">
        <span>Avoid</span>
        <span>Neutral</span>
        <span>Strong Buy</span>
      </div>
    </div>
  );
}
