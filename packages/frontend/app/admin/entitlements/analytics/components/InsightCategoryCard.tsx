'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ParsedRecommendation } from '../utils/parseRecommendations';
import { RecommendationItem } from './RecommendationItem';

interface InsightCategoryCardProps {
  icon: string;
  title: string;
  content: string;
  defaultOpen?: boolean;
  /** Structured recommendations for this category (if available). */
  recommendations?: ParsedRecommendation[];
  /** Called when user clicks "Implement" on a recommendation. */
  onImplement?: (rec: ParsedRecommendation) => void;
  /** Called when user clicks "Dismiss" on a recommendation. */
  onDismiss?: (rec: ParsedRecommendation) => void;
  /** ID of the recommendation currently being planned. */
  implementingRecId?: string | null;
}

export function InsightCategoryCard({
  icon,
  title,
  content,
  defaultOpen = true,
  recommendations,
  onImplement,
  onDismiss,
  implementingRecId,
}: InsightCategoryCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!content.trim()) return null;

  const categoryRecs = recommendations?.filter((r) => r.category === title);
  const hasStructuredRecs = categoryRecs && categoryRecs.length > 0;

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 hover:bg-surface-container-high transition-colors"
      >
        <span className="text-xl">{icon}</span>
        <h4 className="text-base font-medium text-on-surface flex-1 text-left">
          {title}
        </h4>
        {hasStructuredRecs && (
          <span className="text-xs text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
            {categoryRecs.filter((r) => r.status === 'pending').length} pending
          </span>
        )}
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-on-surface-variant" />
        ) : (
          <ChevronRight className="w-5 h-5 text-on-surface-variant" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          {hasStructuredRecs ? (
            <div className="space-y-2">
              {categoryRecs.map((rec) => (
                <RecommendationItem
                  key={rec.id}
                  recommendation={rec}
                  onImplement={onImplement ? () => onImplement(rec) : undefined}
                  onDismiss={onDismiss ? () => onDismiss(rec) : undefined}
                  implementLoading={implementingRecId === rec.id}
                />
              ))}
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div
                className="text-on-surface-variant leading-relaxed [&_strong]:text-on-surface [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-3 [&_h3]:mb-1 [&_ol]:pl-4 [&_ul]:pl-4 [&_li]:mb-2"
                dangerouslySetInnerHTML={{
                  __html: parseInsightMarkdown(content),
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Minimal markdown to HTML for insight content.
 * Handles: bold, priority badges, lists, line breaks.
 */
function parseInsightMarkdown(md: string): string {
  return md
    .replace(
      /\*\*\[([^\]]+)\]\s*([^*]+)\*\*/g,
      '<strong class="inline-flex items-center gap-1"><span class="px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-semibold">$1</span> $2</strong>',
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(
      /^\d+\.\s+/gm,
      (match) => `<li>${match.replace(/^\d+\.\s+/, '')}`,
    )
    .replace(/^- /gm, '<li>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
