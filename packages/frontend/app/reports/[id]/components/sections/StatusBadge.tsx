'use client';

import { AlertTriangle, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';

import type { SectionProps } from '../types';
import { getMetricWithAliases } from '../utils/metricHelpers';

type StatusType = 'success' | 'warning' | 'error' | 'info';

interface StatusConfig {
  icon: typeof CheckCircle;
  bg: string;
  text: string;
  border: string;
}

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  success: { icon: CheckCircle, bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  warning: { icon: AlertCircle, bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  error: { icon: XCircle, bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  info: { icon: Info, bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
};

function deriveStatusFromValue(value: number): StatusType {
  if (value > 70) return 'success';
  if (value > 40) return 'warning';
  return 'error';
}

export function StatusBadge({ section, report }: SectionProps): React.ReactElement {
  const status = (section.config?.status || 'info') as StatusType;
  const message = section.config?.message || '';
  const metricId = section.config?.metric as string | undefined;

  let derivedStatus: StatusType = status;

  if (metricId) {
    const value = getMetricWithAliases(report, metricId);

    if (value === null) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border bg-gray-100 border-gray-200">
          <AlertTriangle className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-600">Status not available</span>
        </div>
      );
    }

    derivedStatus = deriveStatusFromValue(value);
  }

  const config = STATUS_CONFIG[derivedStatus] || STATUS_CONFIG.info;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${config.bg} ${config.border}`}>
      <Icon className={`w-5 h-5 ${config.text}`} />
      <span className={`font-medium ${config.text}`}>{message}</span>
    </div>
  );
}
