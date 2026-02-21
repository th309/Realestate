'use client';

import React from 'react';

type SystemStatus = 'healthy' | 'degraded' | 'error' | 'loading';

interface SystemHealthBannerProps {
  status: SystemStatus;
  lastRefresh: Date;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<SystemStatus, { dotClass: string; label: string }> = {
  healthy: { dotClass: 'bg-green-500', label: 'All Systems Operational' },
  degraded: { dotClass: 'bg-amber-500', label: 'Some Issues Detected' },
  error: { dotClass: 'bg-red-500', label: 'System Issues' },
  loading: { dotClass: 'bg-gray-400 animate-pulse', label: 'Checking...' },
};

function formatTimeSinceRefresh(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'Updated just now';
  if (diffMins === 1) return 'Updated 1 min ago';
  return `Updated ${diffMins} mins ago`;
}

export function SystemHealthBanner({
  status,
  lastRefresh,
  onRefresh,
}: SystemHealthBannerProps) {
  const { dotClass, label } = STATUS_CONFIG[status];

  return (
    <div className="bg-surface-container border-b border-outline-variant py-2 px-4 flex items-center justify-between">
      {/* Left: status indicator */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
        <span className="text-xs font-medium text-on-surface">{label}</span>
      </div>

      {/* Right: last refresh + refresh button */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-on-surface-variant">
          {formatTimeSinceRefresh(lastRefresh)}
        </span>
        <button
          onClick={onRefresh}
          className="text-xs text-primary hover:underline"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
