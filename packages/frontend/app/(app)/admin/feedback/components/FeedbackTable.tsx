/**
 * Feedback Table Component
 * 
 * Displays feedback items in a table with selection and status controls.
 */

'use client';

import { useState } from 'react';
import { CATEGORY_CONFIG, STATUS_CONFIG, SEVERITY_CONFIG } from '../../../betatest/types';
import type { FeedbackWithTester, FeedbackStatus, FeedbackCategory, FeedbackSeverity } from '../../../betatest/types';
import { FeedbackDetailModal } from './FeedbackDetailModal';

interface FeedbackTableProps {
  feedback: FeedbackWithTester[];
  loading: boolean;
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  onStatusUpdate: (id: string, status: FeedbackStatus) => void;
}

const STATUS_OPTIONS: FeedbackStatus[] = [
  'submitted',
  'triaged',
  'in_progress',
  'fixed',
  'deployed',
  'wont_fix',
  'duplicate',
];

export function FeedbackTable({
  feedback,
  loading,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onStatusUpdate,
}: FeedbackTableProps) {
  const [detailItem, setDetailItem] = useState<FeedbackWithTester | null>(null);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && feedback.length === 0) {
    return (
      <div className="p-8 text-center text-on-surface-variant">
        Loading feedback...
      </div>
    );
  }

  if (feedback.length === 0) {
    return (
      <div className="p-8 text-center text-on-surface-variant">
        No feedback found matching the current filters.
      </div>
    );
  }

  const allSelected = feedback.length > 0 && feedback.every(f => selectedIds.has(f.id));
  const someSelected = feedback.some(f => selectedIds.has(f.id)) && !allSelected;

  return (
    <>
      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-container-high">
              <tr>
                <th className="w-12 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="rounded border-outline"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                  Severity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                  Tester
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {feedback.map((item) => {
                const categoryConfig = CATEGORY_CONFIG[item.category as FeedbackCategory];
                const statusConfig = STATUS_CONFIG[item.status as FeedbackStatus];
                const severityConfig = item.severity ? SEVERITY_CONFIG[item.severity as FeedbackSeverity] : null;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-container-high transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={(e) => onSelectOne(item.id, e.target.checked)}
                        className="rounded border-outline"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetailItem(item)}
                        className="text-left hover:text-primary"
                      >
                        <div className="font-medium text-on-surface max-w-xs truncate">
                          {item.title}
                        </div>
                        {item.page_url && (
                          <div className="text-xs text-on-surface-variant">
                            {item.page_url}
                          </div>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${categoryConfig.color}`}>
                        {categoryConfig.icon} {categoryConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {severityConfig ? (
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${severityConfig.color}`}>
                          {severityConfig.label}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-on-surface">
                        {item.tester?.name || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.status}
                        onChange={(e) => onStatusUpdate(item.id, e.target.value as FeedbackStatus)}
                        className={`text-xs font-medium px-2 py-1 rounded border-0 cursor-pointer ${statusConfig.color}`}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_CONFIG[status].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {detailItem && (
        <FeedbackDetailModal
          feedback={detailItem}
          onClose={() => setDetailItem(null)}
          onStatusUpdate={onStatusUpdate}
        />
      )}
    </>
  );
}
