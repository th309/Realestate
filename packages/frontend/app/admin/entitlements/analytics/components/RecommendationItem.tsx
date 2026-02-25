'use client';

/**
 * Recommendation Item
 *
 * Renders a single parsed recommendation with priority badge,
 * action type icon, expandable content, and implement/dismiss buttons.
 */

import { useState } from 'react';
import {
  Wrench,
  Code2,
  HandHelping,
  Play,
  X,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { ParsedRecommendation } from '../utils/parseRecommendations';

interface RecommendationItemProps {
  recommendation: ParsedRecommendation;
  onImplement?: () => void;
  onDismiss?: () => void;
  implementLoading?: boolean;
}

const PRIORITY_STYLES = {
  High: 'bg-red-500/10 text-red-700 dark:text-red-400',
  Medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  Low: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
} as const;

const ACTION_ICONS = {
  db_change: Wrench,
  code_change: Code2,
  manual: HandHelping,
} as const;

const ACTION_LABELS = {
  db_change: 'DB Change',
  code_change: 'Code Change',
  manual: 'Manual',
} as const;

export function RecommendationItem({
  recommendation: rec,
  onImplement,
  onDismiss,
  implementLoading,
}: RecommendationItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const ActionIcon = ACTION_ICONS[rec.action_type];

  return (
    <div className="border border-outline-variant/50 rounded-lg bg-surface overflow-hidden">
      {/* Clickable header: priority + title + action type */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start gap-2 p-3 hover:bg-surface-container-low/50 transition-colors text-left"
      >
        <span
          className={`px-1.5 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 mt-0.5 ${PRIORITY_STYLES[rec.priority]}`}
        >
          {rec.priority}
        </span>
        <h5 className="text-sm font-medium text-on-surface flex-1">
          {rec.title}
        </h5>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 text-xs text-on-surface-variant">
            <ActionIcon className="w-3.5 h-3.5" />
            <span>{ACTION_LABELS[rec.action_type]}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-on-surface-variant" />
          ) : (
            <ChevronRight className="w-4 h-4 text-on-surface-variant" />
          )}
        </div>
      </button>

      {/* Expandable content + actions */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-outline-variant/30">
          {/* Full content rendered as markdown-like text */}
          <div
            className="text-sm text-on-surface-variant leading-relaxed mt-3 mb-3 prose prose-sm dark:prose-invert max-w-none [&_strong]:text-on-surface [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 [&_ol]:pl-4 [&_ul]:pl-4 [&_li]:mb-1"
            dangerouslySetInnerHTML={{
              __html: formatRecContent(rec.content),
            }}
          />

          {/* Status / Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/30">
            {rec.status === 'implemented' && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Implemented
              </span>
            )}
            {rec.status === 'dismissed' && (
              <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                <XCircle className="w-3.5 h-3.5" />
                Dismissed
              </span>
            )}
            {rec.status === 'pending' && (
              <>
                {onImplement && (
                  <button
                    onClick={onImplement}
                    disabled={implementLoading}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 disabled:opacity-50 transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    {implementLoading
                      ? 'Planning...'
                      : rec.action_type === 'manual'
                        ? 'Get Steps'
                        : 'Implement'}
                  </button>
                )}
                {onDismiss && (
                  <button
                    onClick={onDismiss}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Dismiss
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Convert recommendation markdown content to HTML. */
function formatRecContent(md: string): string {
  return md
    .replace(/\*\*\[([^\]]+)\]\s*([^*]*)\*\*/g, '<strong>$2</strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="text-xs bg-surface-container px-1 py-0.5 rounded">$1</code>')
    .replace(/^#{1,4}\s+(.+)$/gm, '<strong>$1</strong>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
