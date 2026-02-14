'use client';

import React from 'react';
import { TemplateType } from '../../hooks/useGraphsState';

interface TemplateTabsProps {
  activeTemplate: TemplateType;
  onTemplateChange: (template: TemplateType) => void;
}

const TEMPLATES: { id: TemplateType; label: string }[] = [
  { id: 'affordability', label: 'Affordability' },
  { id: 'investment', label: 'Investment' },
  { id: 'momentum', label: 'Momentum' },
  { id: 'custom', label: 'Custom' },
];

/**
 * TemplateTabs - Template selector pills
 */
export function TemplateTabs({ activeTemplate, onTemplateChange }: TemplateTabsProps) {
  return (
    <div className="flex gap-2">
      {TEMPLATES.map(template => (
        <button
          key={template.id}
          onClick={() => onTemplateChange(template.id)}
          className={`
            px-4 py-2 rounded-full text-sm font-medium transition-all
            ${activeTemplate === template.id
              ? 'bg-primary-container text-on-primary-container'
              : 'text-on-surface-variant hover:bg-surface-container'
            }
          `}
        >
          {template.label}
        </button>
      ))}
    </div>
  );
}

export default TemplateTabs;
