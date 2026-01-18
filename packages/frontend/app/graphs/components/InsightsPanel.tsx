'use client';

import React from 'react';
import { Sparkles, Loader2, TrendingUp } from 'lucide-react';

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
    <div className="mb-6 md:mb-10 p-5 md:p-8 bg-[#d3e8d3] rounded-[24px] md:rounded-[32px] border border-[#b8ccb8] shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 text-[#00210e]">
          <div className="p-2 md:p-2.5 bg-[#006d3d] rounded-xl md:rounded-2xl shadow-md shrink-0">
            <Sparkles className="w-5 md:w-6 h-5 md:h-6 text-white" />
          </div>
          <div>
            <span className="text-[11px] md:text-sm font-black tracking-[0.1em] md:tracking-[0.15em] uppercase block">
              AI Economic Pulse
            </span>
            <span className="text-[9px] md:text-[11px] font-bold text-[#006d3d]/70">
              Analysis powered by Gemini-3
            </span>
          </div>
        </div>
        <button
          onClick={onFetchInsights}
          disabled={isInsightLoading}
          className="bg-[#006d3d] text-white px-6 md:px-8 py-2.5 md:py-3 rounded-full text-[10px] md:text-xs font-black hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isInsightLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <TrendingUp className="w-3.5 h-3.5" />
          )}
          {isInsightLoading ? 'Calculating...' : 'Update Narrative'}
        </button>
      </div>

      {aiInsight ? (
        <div className="space-y-3 md:space-y-4">
          <p className="text-[#00210e] text-sm md:text-lg leading-relaxed font-semibold italic">
            &ldquo;{aiInsight}&rdquo;
          </p>
          <div className="flex flex-wrap gap-2 pt-1 md:pt-2">
            <span className="text-[9px] md:text-[11px] font-bold text-[#006d3d] uppercase tracking-wider mr-1 md:mr-2 self-center">
              Focus Area:
            </span>
            {['Sensitivity', 'Growth', 'Inventory'].map((chip) => (
              <button
                key={chip}
                className="px-2 md:px-3 py-1 md:py-1.5 bg-white/50 hover:bg-white text-[#00210e] text-[9px] md:text-[10px] font-black rounded-lg border border-[#006d3d]/20 transition-all active:scale-95"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[#414941] text-xs md:text-base font-medium">
          Click &ldquo;Update Narrative&rdquo; for an AI summary of these market targets.
        </p>
      )}
    </div>
  );
};
