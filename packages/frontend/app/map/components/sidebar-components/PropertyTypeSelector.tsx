'use client';

import type { GeoLevel, RentIndexType, RenterDemandType } from '../../types';

interface PropertyTypeSelectorProps {
  value: RentIndexType | RenterDemandType;
  geoLevel: GeoLevel;
  colorScheme: 'purple' | 'green';
  onChange: (type: any) => void;
}

export function PropertyTypeSelector({ value, geoLevel, colorScheme, onChange }: PropertyTypeSelectorProps) {
  const options = [
    { value: 'all', label: 'All Homes' },
    { value: 'sfr', label: 'Single Family' },
    { value: 'mfr', label: 'Multi-Family' },
  ];

  // M3: Use semantic colors with different tints for color schemes
  const colors = colorScheme === 'purple' ? {
    bg: 'bg-primary-container/30',
    border: 'border-outline-variant',
    text: 'text-on-primary-container',
    active: 'bg-primary',
    activeText: 'text-on-primary',
    inactive: 'text-primary border-outline hover:bg-surface-container',
  } : {
    bg: 'bg-tertiary-container/30',
    border: 'border-outline-variant',
    text: 'text-on-tertiary-container',
    active: 'bg-tertiary',
    activeText: 'text-on-tertiary',
    inactive: 'text-tertiary border-outline hover:bg-surface-container',
  };

  return (
    <div className={`mt-1 ml-2 p-2 ${colors.bg} rounded-lg border ${colors.border}`}>
      <div className={`text-[10px] font-medium ${colors.text} mb-1.5`}>Property Type</div>
      <div className="flex gap-1">
        {options.map((option) => {
          const isDisabled = (option.value === 'sfr' || option.value === 'mfr') && (geoLevel === 'county' || geoLevel === 'zip');

          return (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDisabled) onChange(option.value);
              }}
              disabled={isDisabled}
              title={isDisabled ? "Not available for County/Zip level" : ""}
              className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-all duration-200 ${
                isDisabled
                  ? 'bg-surface-container text-on-surface-variant/50 cursor-not-allowed border border-outline-variant'
                  : value === option.value
                    ? `${colors.active} ${colors.activeText} elevation-1`
                    : `bg-surface-container-lowest ${colors.inactive}`
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
