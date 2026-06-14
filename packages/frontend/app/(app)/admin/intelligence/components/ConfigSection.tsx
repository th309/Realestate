/**
 * ConfigSection
 *
 * Renders a group of config entries as a M3 card with a category heading.
 * Shows loading skeleton, error state, or the list of ConfigFieldEditors.
 */

'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { ConfigFieldEditor } from './ConfigFieldEditor';
import type { ConfigEntry } from '../hooks/useIntelligenceConfig';

interface ConfigSectionProps {
  label: string;
  entries: ConfigEntry[];
  loading: boolean;
  error: string | null;
  onSave: (key: string, value: string) => Promise<void>;
  recentlySaved: Set<string>;
}

export function ConfigSection({
  label,
  entries,
  loading,
  error,
  onSave,
  recentlySaved,
}: ConfigSectionProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl">
      {/* Category heading */}
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
          {label}
        </h3>
      </div>

      {/* Content */}
      <div className="px-5 pb-4">
        {loading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 w-40 bg-surface-container-high rounded animate-pulse" />
                <div className="h-8 w-48 bg-surface-container-high rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 py-3 text-xs text-error">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : entries.length === 0 ? (
          <p className="py-3 text-xs text-on-surface-variant">
            No configuration entries found for this category.
          </p>
        ) : (
          <div className="divide-y divide-outline-variant">
            {entries.map((entry) => (
              <ConfigFieldEditor
                key={entry.key}
                entry={entry}
                onSave={onSave}
                isSaved={recentlySaved.has(entry.key)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
