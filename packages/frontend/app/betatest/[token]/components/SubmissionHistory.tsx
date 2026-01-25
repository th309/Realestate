/**
 * Submission History Component
 * 
 * Displays the tester's previous feedback submissions with status.
 */

'use client';

import { CATEGORY_CONFIG, STATUS_CONFIG } from '../../types';
import type { FeedbackCategory, FeedbackStatus } from '../../types';

interface FeedbackSummary {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
}

interface SubmissionHistoryProps {
  feedback: FeedbackSummary[];
}

export function SubmissionHistory({ feedback }: SubmissionHistoryProps) {
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'submitted':
        return '○';
      case 'triaged':
      case 'in_progress':
        return '●';
      case 'fixed':
      case 'deployed':
        return '✓';
      case 'wont_fix':
      case 'duplicate':
        return '—';
      default:
        return '○';
    }
  };

  return (
    <div className="space-y-2">
      {feedback.map((item) => {
        const categoryConfig = CATEGORY_CONFIG[item.category as FeedbackCategory] || CATEGORY_CONFIG.other;
        const statusConfig = STATUS_CONFIG[item.status as FeedbackStatus] || STATUS_CONFIG.submitted;
        
        return (
          <div
            key={item.id}
            className="flex items-center justify-between p-4 rounded-xl bg-surface-container border border-outline-variant hover:bg-surface-container-high transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-lg flex-shrink-0">{categoryConfig.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-on-surface truncate">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${categoryConfig.color}`}>
                    {categoryConfig.label}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {formatDate(item.created_at)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <span className={`
                inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium
                ${statusConfig.color}
              `}>
                <span>{getStatusIcon(item.status)}</span>
                {statusConfig.testerLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
