'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface UseCaseCardProps {
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  setupTime: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const DIFFICULTY_COLORS: Record<UseCaseCardProps['difficulty'], string> = {
  Beginner: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Intermediate: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Advanced: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export function UseCaseCard({
  title,
  description,
  difficulty,
  setupTime,
  icon,
  children,
}: UseCaseCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-container transition-colors"
      >
        <span className="text-on-surface-variant shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-medium text-on-surface">{title}</h3>
            <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[difficulty]}`}>
              {difficulty}
            </span>
            <span className="text-xs text-on-surface-variant">~{setupTime}</span>
          </div>
          <p className="text-sm text-on-surface-variant mt-0.5">{description}</p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-on-surface-variant shrink-0 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-outline-variant/50">
          <div className="pt-4 space-y-4 text-sm text-on-surface-variant">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
