'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  label: string;
  value: string;
}

interface M3SelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: (string | SelectOption)[];
  isPrimary?: boolean;
  disabled?: boolean;
}

export const M3Select: React.FC<M3SelectProps> = ({
  label,
  value,
  onChange,
  options,
  isPrimary,
  disabled,
}) => {
  // Normalize options
  const normalizedOptions: SelectOption[] = options.map(opt => {
    if (typeof opt === 'string') return { label: opt, value: opt };
    return opt;
  });

  return (
    <div
      className={`relative w-full md:flex-1 transition-opacity ${disabled ? 'opacity-50 grayscale' : 'opacity-100'}`}
    >
      <label className="absolute -top-2 left-3 bg-surface-container-low px-1 text-[10px] md:text-[11px] font-medium text-on-surface-variant z-10">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-transparent border ${isPrimary ? 'border-primary border-2 shadow-sm' : 'border-outline'} rounded-xl px-3 md:px-4 py-3 md:py-4 appearance-none focus:outline-none focus:ring-1 focus:ring-primary text-on-surface text-sm font-medium cursor-pointer transition-all`}
        >
          {normalizedOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className={`absolute right-3 md:right-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 pointer-events-none ${isPrimary ? 'text-primary' : 'text-on-surface-variant'}`}
        />
      </div>
    </div>
  );
};
