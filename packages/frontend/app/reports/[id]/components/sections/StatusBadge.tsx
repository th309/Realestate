'use client';

import React from 'react';
import { SectionProps } from '../types';
import { CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';

export function StatusBadge({ section, report }: SectionProps) {
  const status = section.config?.status || 'info';
  const message = section.config?.message || '';
  const metric = section.config?.metric;

  // Derive status from metric if provided
  let derivedStatus = status;
  if (metric) {
    const value = report.populated_data?.current?.[metric] as number;
    if (value > 70) derivedStatus = 'success';
    else if (value > 40) derivedStatus = 'warning';
    else derivedStatus = 'error';
  }

  const statusConfig = {
    success: { icon: CheckCircle, bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    warning: { icon: AlertCircle, bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
    error: { icon: XCircle, bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
    info: { icon: Info, bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  };

  const config = statusConfig[derivedStatus as keyof typeof statusConfig] || statusConfig.info;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${config.bg} ${config.border}`}>
      <Icon className={`w-5 h-5 ${config.text}`} />
      <span className={`font-medium ${config.text}`}>{message}</span>
    </div>
  );
}
