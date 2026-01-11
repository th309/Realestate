'use client';

import type { ViewMode } from '../../types';

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="mb-4 p-1 bg-gray-100 rounded-lg flex">
      <button
        onClick={() => onViewModeChange('homebuyer')}
        className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all ${
          viewMode === 'homebuyer'
            ? 'bg-white text-purple-700 shadow-sm'
            : 'text-gray-600 hover:text-gray-800'
        }`}
      >
        Homebuyer/Renter
      </button>
      <button
        onClick={() => onViewModeChange('investor')}
        className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all ${
          viewMode === 'investor'
            ? 'bg-white text-purple-700 shadow-sm'
            : 'text-gray-600 hover:text-gray-800'
        }`}
      >
        Investor
      </button>
    </div>
  );
}
