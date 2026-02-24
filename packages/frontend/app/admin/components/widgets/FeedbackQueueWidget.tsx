'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { getAuthHeaders } from '@/lib/data/fetchers/auth-headers';
import { WidgetShell } from './WidgetShell';

type FeedbackStatus = 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';

interface FeedbackItem {
  id: string;
  message: string;
  category: string;
  status: FeedbackStatus;
  tester_id: string;
  created_at: string;
  updated_at: string;
}

interface FeedbackQueueWidgetProps {
  refreshTrigger: number;
}

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  new: 'bg-amber-500',
  acknowledged: 'bg-blue-500',
  in_progress: 'bg-purple-500',
  resolved: 'bg-green-500',
  closed: 'bg-gray-400',
};

function formatShortDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function FeedbackQueueWidget({ refreshTrigger }: FeedbackQueueWidgetProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch('/api/admin/feedback', {
          credentials: 'include',
          headers: { ...authHeaders },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (!cancelled) {
          const feedbackList: FeedbackItem[] = json.feedback ?? [];
          setItems(feedbackList);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const openCount = items.filter((f) => f.status === 'new').length;
  const recentItems = [...items]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  return (
    <WidgetShell
      title="Feedback"
      icon={MessageSquare}
      href="/admin/feedback"
      loading={loading}
      error={error}
    >
      {items.length > 0 || !loading ? (
        <div className="space-y-2">
          {/* Header row: open badge + total */}
          <div className="flex items-center gap-2">
            <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
              {openCount} open
            </span>
            <span className="text-xs text-on-surface-variant">
              {items.length} total
            </span>
          </div>

          {/* Recent items */}
          {recentItems.length > 0 ? (
            <ul className="space-y-1.5">
              {recentItems.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-xs">
                  {/* Status dot */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLORS[item.status] ?? 'bg-gray-400'}`}
                  />
                  {/* Message text */}
                  <span className="text-on-surface truncate flex-1">
                    {item.message}
                  </span>
                  {/* Date */}
                  <span className="text-on-surface-variant shrink-0">
                    {formatShortDate(item.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-on-surface-variant">No recent feedback</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">Unable to load feedback</p>
      )}
    </WidgetShell>
  );
}
