'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'h-9 text-sm px-3',
  md: 'h-11 text-sm px-4',
  lg: 'h-12 text-base px-4',
};

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  error,
  disabled = false,
  searchable = false,
  clearable = false,
  size = 'md',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search
  const filteredOptions = searchable
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          opt.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-on-surface mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2
          bg-surface-container-lowest border rounded-xl
          transition-all duration-200
          ${sizeStyles[size]}
          ${error
            ? 'border-error focus:ring-error/20'
            : 'border-outline focus:border-primary focus:ring-2 focus:ring-primary/20'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed bg-surface-container' : 'cursor-pointer'}
          ${isOpen ? 'border-primary ring-2 ring-primary/20' : ''}
        `}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon && (
            <span className="w-5 h-5 shrink-0">{selectedOption.icon}</span>
          )}
          <span className={selectedOption ? 'text-on-surface' : 'text-on-surface-variant'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        <span className="flex items-center gap-1 shrink-0">
          {clearable && selectedOption && !disabled && (
            <button
              onClick={handleClear}
              className="p-0.5 hover:bg-on-surface/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-on-surface-variant" />
            </button>
          )}
          <ChevronDown
            className={`w-5 h-5 text-on-surface-variant transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {error && <p className="mt-1.5 text-sm text-error">{error}</p>}

      {/* Dropdown */}
      {isOpen && (
        <div
          className="
            absolute z-50 w-full mt-1
            bg-surface-container-high rounded-xl elevation-2
            border border-outline-variant
            overflow-hidden
            animate-in fade-in slide-in-from-top-2 duration-200
          "
        >
          {/* Search */}
          {searchable && (
            <div className="p-2 border-b border-outline-variant">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="
                    w-full h-9 pl-9 pr-3 text-sm
                    bg-surface-container rounded-lg
                    text-on-surface placeholder:text-on-surface-variant
                    focus:outline-none focus:ring-2 focus:ring-primary/20
                  "
                />
              </div>
            </div>
          )}

          {/* Options */}
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-on-surface-variant text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  disabled={option.disabled}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-left
                    transition-colors duration-150
                    ${option.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-on-surface/5 cursor-pointer'
                    }
                    ${option.value === value ? 'bg-primary-container/30' : ''}
                  `}
                >
                  {option.icon && (
                    <span className="w-5 h-5 shrink-0">{option.icon}</span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-on-surface truncate">
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="block text-xs text-on-surface-variant truncate">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {option.value === value && (
                    <Check className="w-5 h-5 text-primary shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Multi-select variant
interface MultiSelectProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  max?: number;
  className?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select options',
  label,
  error,
  disabled = false,
  searchable = false,
  max,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else if (!max || value.length < max) {
      onChange([...value, optionValue]);
    }
  };

  const removeOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-on-surface mb-1.5">
          {label}
        </label>
      )}

      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          min-h-11 px-3 py-2 flex flex-wrap items-center gap-2
          bg-surface-container-lowest border rounded-xl
          transition-all duration-200 cursor-pointer
          ${error ? 'border-error' : 'border-outline'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${isOpen ? 'border-primary ring-2 ring-primary/20' : ''}
        `}
      >
        {value.length === 0 ? (
          <span className="text-sm text-on-surface-variant">{placeholder}</span>
        ) : (
          value.map((v) => {
            const opt = options.find((o) => o.value === v);
            return (
              <span
                key={v}
                className="
                  inline-flex items-center gap-1 px-2 py-0.5
                  bg-secondary-container text-on-secondary-container
                  text-xs font-medium rounded-full
                "
              >
                {opt?.label}
                <button
                  onClick={(e) => removeOption(v, e)}
                  className="hover:bg-on-secondary-container/10 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })
        )}
        <ChevronDown
          className={`w-5 h-5 text-on-surface-variant ml-auto transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {error && <p className="mt-1.5 text-sm text-error">{error}</p>}

      {isOpen && (
        <div
          className="
            absolute z-50 w-full mt-1
            bg-surface-container-high rounded-xl elevation-2
            border border-outline-variant overflow-hidden
            animate-in fade-in slide-in-from-top-2 duration-200
          "
        >
          {searchable && (
            <div className="p-2 border-b border-outline-variant">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="
                  w-full h-9 px-3 text-sm
                  bg-surface-container rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary/20
                "
              />
            </div>
          )}

          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.map((option) => {
              const isSelected = value.includes(option.value);
              const isMaxReached = !!(max && value.length >= max && !isSelected);

              return (
                <button
                  key={option.value}
                  disabled={option.disabled || isMaxReached}
                  onClick={() => toggleOption(option.value)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-left
                    transition-colors duration-150
                    ${option.disabled || isMaxReached
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-on-surface/5'
                    }
                    ${isSelected ? 'bg-primary-container/30' : ''}
                  `}
                >
                  <div
                    className={`
                      w-5 h-5 rounded border-2 flex items-center justify-center
                      ${isSelected
                        ? 'bg-primary border-primary'
                        : 'border-outline'
                      }
                    `}
                  >
                    {isSelected && <Check className="w-3 h-3 text-on-primary" />}
                  </div>
                  <span className="text-sm text-on-surface">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
