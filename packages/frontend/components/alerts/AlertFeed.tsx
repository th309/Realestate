'use client';

import React from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { AlertHistoryEntry } from '@/lib/alerts/api';

interface AlertFeedProps {
  entries: AlertHistoryEntry[];
  isLoading: boolean;
  onMarkRead?: (id: string) => void;
  className?: string;
}

export function AlertFeed({ entries, isLoading, onMarkRead, className = '' }: AlertFeedProps) {
  if (isLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl bg-surface-container-low animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Bell className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-3" />
        <p className="text-sm font-medium text-on-surface">No triggered alerts</p>
        <p className="text-xs text-on-surface-variant mt-1">
          When your alerts trigger, they&apos;ll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {entries.map(entry => (
        <div
          key={entry.id}
          className={`rounded-xl border border-outline-variant p-3 flex items-center gap-3 ${
            !entry.read_at ? 'bg-primary/5 border-primary/20' : 'bg-surface-container-low'
          }`}
        >
          {!entry.read_at && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-on-surface truncate">
              {entry.alert?.geography_name || 'Market'} &mdash; {entry.alert?.metric_id}
            </p>
            <p className="text-xs text-on-surface-variant">
              Value: {entry.metric_value} (threshold: {entry.alert?.threshold}) &bull; {new Date(entry.triggered_at).toLocaleDateString()}
            </p>
          </div>
          {entry.alert && (
            <Link
              href={`/map?geo=${entry.alert.geography_type}&id=${entry.alert.geography_id}`}
              className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-on-surface-variant" />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
