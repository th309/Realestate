/**
 * PipelineStatusBadge Component
 *
 * Displays a status badge for pipeline runs.
 */

'use client';

import React from 'react';
import { getStatusBadgeClasses, getStatusLabel } from './pipelineRuns.types';

interface PipelineStatusBadgeProps {
  status: string;
}

export function PipelineStatusBadge({ status }: PipelineStatusBadgeProps) {
  const baseClasses = 'px-2 py-0.5 text-xs font-medium rounded-full';
  const statusClasses = getStatusBadgeClasses(status);

  if (status === 'running') {
    return (
      <span className={`inline-flex items-center gap-1 ${baseClasses} ${statusClasses}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        {getStatusLabel(status)}
      </span>
    );
  }

  return (
    <span className={`${baseClasses} ${statusClasses}`}>
      {getStatusLabel(status)}
    </span>
  );
}
