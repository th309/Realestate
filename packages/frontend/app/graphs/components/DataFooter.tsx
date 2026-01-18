'use client';

import React from 'react';
import { Share2, Database, FileJson, FileText, Image as ImageIcon, Map, TrendingUp } from 'lucide-react';
import { getMetricSource } from '../constants';

interface DataFooterProps {
  metric: string;
}

export const DataFooter: React.FC<DataFooterProps> = ({ metric }) => {
  return (
    <>
      <div className="flex flex-col lg:flex-row items-center justify-between mt-8 md:mt-12 pt-6 md:pt-8 border-t border-[#dee5dd] gap-6 md:gap-10">
        <div className="flex flex-col gap-2 md:gap-3 w-full lg:w-auto">
          <div className="flex items-center text-[9px] md:text-[10px] font-black text-[#414941] uppercase tracking-[0.25em] gap-2 md:gap-3">
            <Database className="w-4 md:w-5 h-4 md:h-5 text-[#006d3d]" />
            Compliance Node
          </div>
          <div className="flex flex-wrap items-center text-[11px] md:text-sm text-[#1a1c1a] gap-2 md:gap-3">
            <span className="font-black">Provider:</span>
            <span className="bg-[#e7ece7] px-3 md:px-4 py-1 md:py-1.5 rounded-lg md:rounded-xl text-[#006d3d] border border-[#dee5dd] text-[9px] md:text-[11px] font-black shadow-sm truncate max-w-[200px] md:max-w-none">
              {getMetricSource(metric)}
            </span>
            <span className="hidden md:inline text-[#dee5dd] mx-2">|</span>
            <span className="text-[#414941] text-[10px] md:text-xs font-bold flex items-center gap-2">
              Streamed live
              <div className="w-1.5 md:w-2.5 h-1.5 md:h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 md:gap-4 w-full lg:w-auto">
          <div className="flex items-center bg-[#f1f5f1] border border-[#dee5dd] rounded-xl md:rounded-2xl p-1 shadow-inner">
            <button
              title="JSON"
              className="p-2 md:p-3.5 text-[#414941] hover:bg-white hover:text-[#006d3d] rounded-lg md:rounded-xl transition-all active:scale-90"
            >
              <FileJson className="w-4 md:w-5 h-4 md:h-5" />
            </button>
            <button
              title="PDF"
              className="p-2 md:p-3.5 text-[#414941] hover:bg-white hover:text-[#006d3d] rounded-lg md:rounded-xl transition-all active:scale-90"
            >
              <FileText className="w-4 md:w-5 h-4 md:h-5" />
            </button>
            <button
              title="Image"
              className="p-2 md:p-3.5 text-[#414941] hover:bg-white hover:text-[#006d3d] rounded-lg md:rounded-xl transition-all active:scale-90"
            >
              <ImageIcon className="w-4 md:w-5 h-4 md:h-5" />
            </button>
          </div>

          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 md:gap-3 px-6 md:px-10 py-3 md:py-4 bg-[#006d3d] text-white rounded-xl md:rounded-2xl text-[11px] md:text-sm font-black shadow-lg hover:shadow-2xl active:scale-95 transition-all">
            <Share2 className="w-4 md:w-5 h-4 md:h-5" />
            Export
          </button>
        </div>
      </div>

      <div className="mt-6 md:mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="flex items-start gap-4 md:gap-5 p-5 md:p-6 bg-[#fcfdfc] rounded-[24px] md:rounded-[32px] border border-[#dee5dd] shadow-sm">
          <div className="p-2.5 md:p-3 bg-emerald-50 rounded-xl md:rounded-2xl shrink-0">
            <Map className="w-5 md:w-6 h-5 md:h-6 text-[#006d3d]" />
          </div>
          <div>
            <h4 className="text-[12px] md:text-sm font-black text-[#1a1c1a] mb-1">
              Market Resolution
            </h4>
            <p className="text-[10px] md:text-xs text-[#414941] leading-relaxed">
              Explore data by switching geography levels manually. Compare targets to find
              relative regional momentum.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 md:gap-5 p-5 md:p-6 bg-[#fcfdfc] rounded-[24px] md:rounded-[32px] border border-[#dee5dd] shadow-sm">
          <div className="p-2.5 md:p-3 bg-amber-50 rounded-xl md:rounded-2xl shrink-0">
            <TrendingUp className="w-5 md:w-6 h-5 md:h-6 text-amber-700" />
          </div>
          <div>
            <h4 className="text-[12px] md:text-sm font-black text-[#1a1c1a] mb-1">
              Data Confidence
            </h4>
            <p className="text-[10px] md:text-xs text-[#414941] leading-relaxed">
              Forecast accuracy exceeds 88% based on trailing 24-month regional momentum.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
