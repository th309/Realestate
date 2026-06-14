'use client';

import React from 'react';
import { SectionProps } from '../types';
import { AlertTriangle } from 'lucide-react';

type TextVariant = 'heading' | 'subheading' | 'body' | 'caption';

const VARIANT_CLASSES: Record<TextVariant, string> = {
  heading: 'text-2xl font-bold text-on-surface',
  subheading: 'text-lg font-semibold text-on-surface',
  body: 'text-on-surface-variant',
  caption: 'text-sm text-on-surface-variant',
};

export function TextBlock({ section }: SectionProps): React.ReactElement | null {
  const content = section.config?.content;
  const variant = (section.config?.variant as TextVariant) || 'body';

  // Check if content is available
  if (!content || (typeof content === 'string' && content.trim() === '')) {
    return (
      <div className="flex items-center gap-2 text-on-surface-variant py-4">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm">Text content not configured</span>
      </div>
    );
  }

  const className = VARIANT_CLASSES[variant] || VARIANT_CLASSES.body;

  return (
    <div className={className}>
      {content}
    </div>
  );
}
