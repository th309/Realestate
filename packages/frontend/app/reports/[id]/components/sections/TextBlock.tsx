'use client';

import React from 'react';
import { SectionProps } from '../types';

export function TextBlock({ section }: SectionProps) {
  const content = section.config?.content || '';
  const variant = section.config?.variant || 'body';

  const variantClasses = {
    heading: 'text-2xl font-bold text-on-surface',
    subheading: 'text-lg font-semibold text-on-surface',
    body: 'text-on-surface-variant',
    caption: 'text-sm text-on-surface-variant',
  };

  return (
    <div className={variantClasses[variant as keyof typeof variantClasses] || variantClasses.body}>
      {content}
    </div>
  );
}
