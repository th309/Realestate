'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useAlertHistory } from '@/lib/alerts/hooks';

export function AlertBell() {
  const { entries, unreadCount, markRead } = useAlertHistory();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const recentEntries = entries.slice(0, 5);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-surface-container transition-colors"
      >
        <Bell className="w-5 h-5 text-on-surface-variant" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-error text-on-error text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container rounded-xl border border-outline-variant shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
            <h3 className="text-sm font-semibold text-on-surface">Alerts</h3>
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:text-primary/80"
            >
              View All
            </Link>
          </div>

          {recentEntries.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Bell className="w-6 h-6 text-on-surface-variant/30 mx-auto mb-2" />
              <p className="text-xs text-on-surface-variant">No alerts yet</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {recentEntries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => { markRead(entry.id); }}
                  className={`w-full px-4 py-3 text-left hover:bg-surface-container-high transition-colors border-b border-outline-variant/30 last:border-0 ${
                    !entry.read_at ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {!entry.read_at && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                    <p className="text-xs font-medium text-on-surface truncate">
                      Alert triggered: {entry.metric_value}
                    </p>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    {new Date(entry.triggered_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
