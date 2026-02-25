'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface InsightCategoryCardProps {
  icon: string;
  title: string;
  content: string;
  defaultOpen?: boolean;
}

export function InsightCategoryCard({
  icon,
  title,
  content,
  defaultOpen = true,
}: InsightCategoryCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!content.trim()) return null;

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
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-on-surface-variant" />
        ) : (
          <ChevronRight className="w-5 h-5 text-on-surface-variant" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 prose prose-sm dark:prose-invert max-w-none">
          <div
            className="text-on-surface-variant leading-relaxed [&_strong]:text-on-surface [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-3 [&_h3]:mb-1 [&_ol]:pl-4 [&_ul]:pl-4 [&_li]:mb-2"
            dangerouslySetInnerHTML={{ __html: parseInsightMarkdown(content) }}
          />
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
      '<strong class="inline-flex items-center gap-1"><span class="px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-semibold">$1</span> $2</strong>'
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^\d+\.\s+/gm, (match) => `<li>${match.replace(/^\d+\.\s+/, '')}`)
    .replace(/^- /gm, '<li>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
