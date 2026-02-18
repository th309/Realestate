'use client';

import React from 'react';

interface BenchmarkBadgeProps {
  diff: number;
  direction: 'better' | 'worse' | 'similar';
  parentGeoName: string;
  className?: string;
}

export function BenchmarkBadge({ diff, direction, parentGeoName, className = '' }: BenchmarkBadgeProps) {
  if (direction === 'similar') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-container-highest text-on-surface-variant ${className}`}>
        ≈ {parentGeoName} avg
      </span>
    );
  }

  const isBetter = direction === 'better';
  const arrow = diff > 0 ? '↑' : '↓';
  const colorClasses = isBetter
    ? 'bg-green-50 text-green-700'
    : 'bg-red-50 text-red-700';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${colorClasses} ${className}`}>
      {arrow} {Math.abs(diff).toFixed(0)}% vs {parentGeoName}
    </span>
  );
}
