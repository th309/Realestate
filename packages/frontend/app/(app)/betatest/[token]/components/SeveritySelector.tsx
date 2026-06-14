/**
 * Severity Selector Component
 * 
 * Radio-style selector for bug severity levels.
 */

'use client';

import type { FeedbackSeverity } from '../../types';
import { SEVERITY_CONFIG } from '../../types';

interface SeveritySelectorProps {
  value: FeedbackSeverity;
  onChange: (severity: FeedbackSeverity) => void;
}

const SEVERITIES: FeedbackSeverity[] = ['critical', 'high', 'medium', 'low'];

export function SeveritySelector({ value, onChange }: SeveritySelectorProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {SEVERITIES.map((sev) => {
        const config = SEVERITY_CONFIG[sev];
        const isSelected = value === sev;
        
        return (
          <label
            key={sev}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer
              border transition-all duration-200
              ${isSelected 
                ? 'border-primary bg-primary/5' 
                : 'border-outline hover:border-outline-variant hover:bg-surface-container'
              }
            `}
          >
            <input
              type="radio"
              name="severity"
              value={sev}
              checked={isSelected}
              onChange={() => onChange(sev)}
              className="sr-only"
            />
            <span 
              className={`
                w-3 h-3 rounded-full
                ${isSelected ? config.color : 'bg-gray-300'}
              `}
            />
            <span className={`text-sm font-medium ${isSelected ? 'text-on-surface' : 'text-on-surface-variant'}`}>
              {config.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
