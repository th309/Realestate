'use client';

import React from 'react';
import { FileText, Sparkles } from 'lucide-react';

interface NarrativeSectionProps {
  title: string;
  content: string;
  showAiBadge?: boolean;
}

export function NarrativeSection({ title, content, showAiBadge = true }: NarrativeSectionProps) {
  // Split content by numbered lists if present
  const paragraphs = content.split(/(?=\(\d+\)|\d+\.\s)/g).filter(Boolean);
  const hasNumberedItems = paragraphs.length > 1 && /^\(\d+\)|^\d+\.\s/.test(paragraphs[1] || '');

  return (
    <section className="bg-surface-container rounded-3xl p-6 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-on-surface">{title}</h2>
        </div>
        {showAiBadge && (
          <div className="flex items-center gap-1 text-xs text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-full">
            <Sparkles className="w-3 h-3" />
            <span>AI Generated</span>
          </div>
        )}
      </div>

      <div className="prose prose-sm max-w-none">
        {hasNumberedItems ? (
          <div className="space-y-3">
            {paragraphs.map((para, i) => {
              // Check if this is a numbered item
              const match = para.match(/^\((\d+)\)\s*(.*)$|^(\d+)\.\s*(.*)$/);
              if (match) {
                const text = match[2] || match[4];
                return (
                  <div key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                      {match[1] || match[3]}
                    </span>
                    <p className="text-on-surface leading-relaxed flex-1">{text}</p>
                  </div>
                );
              }
              return (
                <p key={i} className="text-on-surface leading-relaxed">
                  {para.trim()}
                </p>
              );
            })}
          </div>
        ) : (
          <p className="text-on-surface leading-relaxed whitespace-pre-wrap">{content}</p>
        )}
      </div>
    </section>
  );
}
