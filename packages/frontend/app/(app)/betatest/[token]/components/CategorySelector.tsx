/**
 * Category Selector Component
 * 
 * Chip-based selector for feedback categories.
 * Material Design 3 Filter Chips pattern.
 */

'use client';

import type { FeedbackCategory } from '../../types';
import { CATEGORY_CONFIG } from '../../types';

interface CategorySelectorProps {
  value: FeedbackCategory;
  onChange: (category: FeedbackCategory) => void;
}

const CATEGORIES: FeedbackCategory[] = [
  'bug',
  'workflow',
  'ux_ui',
  'feature_request',
  'performance',
  'other',
];

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((cat) => {
        const config = CATEGORY_CONFIG[cat];
        const isSelected = value === cat;
        
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium
              border transition-all duration-200
              ${isSelected 
                ? 'bg-primary/10 border-primary text-primary' 
                : 'bg-surface border-outline text-on-surface-variant hover:bg-surface-container hover:border-outline-variant'
              }
            `}
          >
            <span className="mr-2">{config.icon}</span>
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
