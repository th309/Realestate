'use client';

import React from 'react';
import {
  Share2,
  Database,
  FileJson,
  FileText,
  Image as ImageIcon,
  Map,
  TrendingUp,
} from 'lucide-react';
import { getMetricSource } from '../constants';
import { M3Card, M3CardHeader } from './M3Card';

interface DataFooterProps {
  metric: string;
}

export const DataFooter: React.FC<DataFooterProps> = ({ metric }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Data Source Card */}
      <M3Card variant="outlined" size="sm">
        <M3CardHeader
          icon={<Database className="w-4 h-4 text-primary" />}
          title="Data Source"
        />
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant font-medium">Provider</span>
            <span className="text-[11px] font-medium text-on-surface bg-surface-container px-2 py-1 rounded-lg truncate max-w-[120px]">
              {getMetricSource(metric)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant font-medium">Status</span>
            <span className="text-[10px] font-medium text-primary flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Live
            </span>
          </div>
        </div>
      </M3Card>

      {/* Market Resolution Card */}
      <M3Card variant="outlined" size="sm">
        <M3CardHeader
          icon={<Map className="w-4 h-4 text-primary" />}
          title="Market Resolution"
        />
        <p className="mt-3 text-[11px] text-on-surface-variant leading-relaxed">
          Switch geography levels to drill down from national to local market data.
        </p>
      </M3Card>

      {/* Data Confidence Card */}
      <M3Card variant="outlined" size="sm">
        <M3CardHeader
          icon={<TrendingUp className="w-4 h-4 text-tertiary" />}
          title="Forecast Accuracy"
        />
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full w-[88%] bg-gradient-to-r from-tertiary/70 to-tertiary rounded-full" />
          </div>
          <span className="text-xs font-medium text-tertiary">88%</span>
        </div>
        <p className="mt-2 text-[10px] text-on-surface-variant">
          Based on 24-month trailing data
        </p>
      </M3Card>

      {/* Export Card */}
      <M3Card variant="elevated" size="sm" className="bg-primary border-primary">
        <div className="flex items-center gap-2 mb-3">
          <Share2 className="w-4 h-4 text-on-primary/80" />
          <span className="text-sm font-medium text-on-primary">Export Data</span>
        </div>
        <div className="flex gap-2">
          <button
            title="Export JSON"
            className="flex-1 flex items-center justify-center gap-1.5 p-2 bg-on-primary/10 hover:bg-on-primary/20 rounded-lg transition-all duration-200 text-on-primary text-[10px] font-medium"
          >
            <FileJson className="w-3.5 h-3.5" />
            JSON
          </button>
          <button
            title="Export PDF"
            className="flex-1 flex items-center justify-center gap-1.5 p-2 bg-on-primary/10 hover:bg-on-primary/20 rounded-lg transition-all duration-200 text-on-primary text-[10px] font-medium"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            title="Export Image"
            className="flex-1 flex items-center justify-center gap-1.5 p-2 bg-on-primary/10 hover:bg-on-primary/20 rounded-lg transition-all duration-200 text-on-primary text-[10px] font-medium"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            PNG
          </button>
        </div>
      </M3Card>
    </div>
  );
};
