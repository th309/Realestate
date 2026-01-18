'use client';

import React from 'react';
import { Sparkles, Loader2, TrendingUp, Zap } from 'lucide-react';
import { M3Card, M3CardHeader } from './M3Card';

interface InsightsPanelProps {
  aiInsight: string | null;
  isInsightLoading: boolean;
  onFetchInsights: () => void;
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({
  aiInsight,
  isInsightLoading,
  onFetchInsights,
}) => {
  return (
    <M3Card
      variant="filled"
      size="md"
      className="bg-primary-container border-primary-container/50"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <M3CardHeader
          icon={<Sparkles className="w-4 h-4 text-on-primary-container" />}
          title="AI Market Analysis"
          subtitle="Powered by Gemini"
          badge="Beta"
          badgeColor="secondary"
        />
        <button
          onClick={onFetchInsights}
          disabled={isInsightLoading}
          className="flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full text-xs font-medium hover:shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
        >
          {isInsightLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          {isInsightLoading ? 'Analyzing...' : 'Generate Insight'}
        </button>
      </div>

      {aiInsight ? (
        <div className="space-y-4">
          <div className="bg-surface/60 rounded-xl p-4 border border-outline-variant/30">
            <p className="text-on-surface text-sm md:text-base leading-relaxed">
              {aiInsight}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium text-on-primary-container uppercase tracking-wide">
              Focus Areas:
            </span>
            {['Price Sensitivity', 'Growth Trajectory', 'Supply Trends'].map((chip) => (
              <button
                key={chip}
                className="px-3 py-1.5 bg-surface/50 hover:bg-surface text-on-surface text-[10px] font-medium rounded-full border border-outline-variant/30 transition-all duration-200 hover:shadow-sm"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-surface/30 rounded-xl p-4 border border-dashed border-outline-variant/50">
          <p className="text-on-primary-container/70 text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Click "Generate Insight" for an AI-powered market summary
          </p>
        </div>
      )}
    </M3Card>
  );
};
