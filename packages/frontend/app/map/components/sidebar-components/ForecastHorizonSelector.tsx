'use client';

import type { ForecastHorizon } from '../../types';

interface ForecastHorizonSelectorProps {
  value: ForecastHorizon;
  onChange: (horizon: ForecastHorizon) => void;
}

export function ForecastHorizonSelector({ value, onChange }: ForecastHorizonSelectorProps) {
  const options = [
    { value: '1m' as const, label: '1M' },
    { value: '3m' as const, label: '3M' },
    { value: '12m' as const, label: '12M' },
  ];

  return (
    <div className="mt-1 ml-2 p-2 bg-purple-50 rounded-lg border border-purple-200">
      <div className="text-[10px] font-medium text-purple-800 mb-1.5">Forecast Horizon</div>
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={(e) => {
              e.stopPropagation();
              onChange(option.value);
            }}
            className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-all ${
              value === option.value
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-purple-700 border border-purple-300 hover:bg-purple-100'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
