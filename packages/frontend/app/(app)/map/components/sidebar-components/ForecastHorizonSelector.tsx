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
    <div className="mt-1 ml-2 p-2 bg-primary-container/30 rounded-lg border border-outline-variant">
      <div className="text-[10px] font-medium text-on-primary-container mb-1.5">Forecast Horizon</div>
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={(e) => {
              e.stopPropagation();
              onChange(option.value);
            }}
            className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-all duration-200 ${
              value === option.value
                ? 'bg-primary text-on-primary elevation-1'
                : 'bg-surface-container-lowest text-primary border border-outline hover:bg-surface-container'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
