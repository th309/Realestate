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

  const colors = colorScheme === 'purple' ? {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-800',
    active: 'bg-purple-600',
    inactive: 'text-purple-700 border-purple-300 hover:bg-purple-100',
  } : {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    active: 'bg-green-600',
    inactive: 'text-green-700 border-green-300 hover:bg-green-100',
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
              className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-all ${
                isDisabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : value === option.value
                    ? `${colors.active} text-white shadow-sm`
                    : `bg-white ${colors.inactive}`
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
