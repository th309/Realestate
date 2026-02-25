'use client';

/**
 * Saved Insights List
 *
 * Displays saved AI insight reports as M3 elevated cards with
 * title, date, provider badge, recommendation status counts,
 * load/delete/pin actions.
 */

import { useState } from 'react';
import {
  BookmarkPlus,
  Pin,
  PinOff,
  Trash2,
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import type { SavedInsightSummary } from '../hooks/useSavedInsights';

interface SavedInsightsListProps {
  insights: SavedInsightSummary[];
  loading: boolean;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
}

export function SavedInsightsList({
  insights,
  loading,
  onLoad,
  onDelete,
  onTogglePin,
}: SavedInsightsListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="ml-2 text-on-surface-variant">Loading saved reports...</span>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="text-center py-8 bg-surface-container rounded-xl border border-outline-variant">
        <BookmarkPlus className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-2" />
        <p className="text-on-surface-variant text-sm">
          No saved reports yet. Generate insights and click &quot;Save Report&quot; to keep them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="bg-surface-container-low rounded-xl border border-outline-variant p-4 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-medium text-on-surface truncate">
                  {insight.title}
                </h4>
                {insight.is_pinned && (
                  <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                  {insight.provider === 'claude' ? 'Claude' : 'DeepSeek'}
                </span>
                <span>{insight.days_analyzed}d analysis</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(insight.created_at).toLocaleDateString()}
                </span>
              </div>
              {/* Recommendation status counts */}
              <div className="flex items-center gap-3 mt-2 text-xs">
                <span className="flex items-center gap-1 text-on-surface-variant">
                  {insight.recommendation_count} recommendations
                </span>
                {insight.implemented_count > 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-3 h-3" />
                    {insight.implemented_count} implemented
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onTogglePin(insight.id, !insight.is_pinned)}
                className="p-1.5 rounded-full hover:bg-surface-container-high transition-colors"
                title={insight.is_pinned ? 'Unpin' : 'Pin'}
              >
                {insight.is_pinned ? (
                  <PinOff className="w-4 h-4 text-on-surface-variant" />
                ) : (
                  <Pin className="w-4 h-4 text-on-surface-variant" />
                )}
              </button>
              <button
                onClick={() => onLoad(insight.id)}
                className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
              >
                Load
              </button>
              {confirmDeleteId === insight.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      onDelete(insight.id);
                      setConfirmDeleteId(null);
                    }}
                    className="px-2 py-1 text-xs font-medium text-red-600 bg-red-500/10 rounded-full hover:bg-red-500/20"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high rounded-full"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(insight.id)}
                  className="p-1.5 rounded-full hover:bg-red-500/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-on-surface-variant hover:text-red-500" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
