'use client';

import React from 'react';
import { Database } from 'lucide-react';
import { getMetricSource } from '../constants';

interface DataFooterProps {
  metric: string;
}

export const DataFooter: React.FC<DataFooterProps> = ({ metric }) => {
  const source = getMetricSource(metric);

  return (
    <div className="flex items-center justify-center gap-2 py-3 px-4 text-xs text-on-surface-variant bg-surface-container-lowest rounded-lg border-t border-outline-variant">
      <Database className="w-3.5 h-3.5" />
      <span>Data Source: <span className="font-medium">{source}</span></span>
    </div>
  );
};
