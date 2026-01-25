/**
 * Feedback Detail Modal
 * 
 * Shows full details of a feedback item with status update.
 */

'use client';

import { CATEGORY_CONFIG, STATUS_CONFIG, SEVERITY_CONFIG } from '../../../betatest/types';
import type { FeedbackWithTester, FeedbackStatus, FeedbackCategory, FeedbackSeverity } from '../../../betatest/types';

interface FeedbackDetailModalProps {
  feedback: FeedbackWithTester;
  onClose: () => void;
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

export function FeedbackDetailModal({ feedback, onClose, onStatusUpdate }: FeedbackDetailModalProps) {
  const categoryConfig = CATEGORY_CONFIG[feedback.category as FeedbackCategory];
  const statusConfig = STATUS_CONFIG[feedback.status as FeedbackStatus];
  const severityConfig = feedback.severity ? SEVERITY_CONFIG[feedback.severity as FeedbackSeverity] : null;

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface rounded-[28px] shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-semibold text-on-surface">
              {feedback.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${categoryConfig.color}`}>
                {categoryConfig.icon} {categoryConfig.label}
              </span>
              {severityConfig && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${severityConfig.color}`}>
                  {severityConfig.label}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Meta Info */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-on-surface-variant">Submitted by:</span>{' '}
              <span className="font-medium text-on-surface">{feedback.tester?.name || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-on-surface-variant">Date:</span>{' '}
              <span className="text-on-surface">{formatDate(feedback.created_at)}</span>
            </div>
            {feedback.page_url && (
              <div>
                <span className="text-on-surface-variant">Page:</span>{' '}
                <span className="text-on-surface">{feedback.page_url}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-on-surface-variant mb-2">Description</h3>
            <p className="text-on-surface whitespace-pre-wrap">{feedback.description}</p>
          </div>

          {/* Steps to Reproduce */}
          {feedback.steps_to_reproduce && (
            <div>
              <h3 className="text-sm font-medium text-on-surface-variant mb-2">Steps to Reproduce</h3>
              <p className="text-on-surface whitespace-pre-wrap">{feedback.steps_to_reproduce}</p>
            </div>
          )}

          {/* Expected vs Actual */}
          {(feedback.expected_behavior || feedback.actual_behavior) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {feedback.expected_behavior && (
                <div>
                  <h3 className="text-sm font-medium text-on-surface-variant mb-2">Expected Behavior</h3>
                  <p className="text-on-surface whitespace-pre-wrap">{feedback.expected_behavior}</p>
                </div>
              )}
              {feedback.actual_behavior && (
                <div>
                  <h3 className="text-sm font-medium text-on-surface-variant mb-2">Actual Behavior</h3>
                  <p className="text-on-surface whitespace-pre-wrap">{feedback.actual_behavior}</p>
                </div>
              )}
            </div>
          )}

          {/* Affected Component */}
          {feedback.affected_component && (
            <div>
              <h3 className="text-sm font-medium text-on-surface-variant mb-2">Affected Area</h3>
              <p className="text-on-surface">{feedback.affected_component}</p>
            </div>
          )}

          {/* Attachments */}
          {feedback.attachments && feedback.attachments.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-on-surface-variant mb-2">
                Attachments ({feedback.attachments.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {feedback.attachments.map((att, i) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg bg-surface-container border border-outline-variant hover:border-primary transition-colors"
                  >
                    {att.type.startsWith('image/') ? (
                      <img
                        src={att.url}
                        alt={att.filename}
                        className="w-full h-24 object-cover rounded mb-2"
                      />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center bg-surface-container-high rounded mb-2">
                        <span className="text-3xl">
                          {att.type.startsWith('video/') ? '🎬' : '📄'}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-on-surface truncate">{att.filename}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Browser Info */}
          {feedback.browser_info && (
            <div>
              <h3 className="text-sm font-medium text-on-surface-variant mb-2">Browser Info</h3>
              <div className="text-xs text-on-surface-variant bg-surface-container p-3 rounded-lg font-mono">
                {Object.entries(feedback.browser_info).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-on-surface">{key}:</span> {value}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm text-on-surface-variant">Status:</label>
            <select
              value={feedback.status}
              onChange={(e) => onStatusUpdate(feedback.id, e.target.value as FeedbackStatus)}
              className={`text-sm font-medium px-3 py-2 rounded-lg border-0 cursor-pointer ${statusConfig.color}`}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {STATUS_CONFIG[status].label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
