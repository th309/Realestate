'use client';

import type { ViewMode } from '../../types';

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    // M3 Segmented Button
    <div className="mb-4 p-1 bg-surface-container rounded-lg flex">
      <button
        onClick={() => onViewModeChange('homebuyer')}
        className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all duration-200 ${
          viewMode === 'homebuyer'
            ? 'bg-surface-container-lowest text-primary elevation-1'
            : 'text-on-surface-variant hover:text-on-surface'
        }`}
      >
        Homebuyer/Renter
      </button>
      <button
        onClick={() => onViewModeChange('investor')}
        className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all duration-200 ${
          viewMode === 'investor'
            ? 'bg-surface-container-lowest text-primary elevation-1'
            : 'text-on-surface-variant hover:text-on-surface'
        }`}
      >
        Investor
      </button>
    </div>
  );
}
