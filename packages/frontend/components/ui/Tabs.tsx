'use client';

import React, { createContext, useContext, useState } from 'react';

// Tab Context
interface TabContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabContext = createContext<TabContextValue | undefined>(undefined);

const useTabContext = () => {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('Tab components must be used within a Tabs provider');
  }
  return context;
};

// Types
type TabVariant = 'primary' | 'secondary';

interface TabsProps {
  children: React.ReactNode;
  defaultValue: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

interface TabListProps {
  children: React.ReactNode;
  variant?: TabVariant;
  className?: string;
}

interface TabProps {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
  badge?: number | string;
  className?: string;
}

interface TabPanelProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

// Tabs Root
export const Tabs: React.FC<TabsProps> = ({
  children,
  defaultValue,
  value,
  onChange,
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeTab = value !== undefined ? value : internalValue;

  const setActiveTab = (tab: string) => {
    if (value === undefined) {
      setInternalValue(tab);
    }
    onChange?.(tab);
  };

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabContext.Provider>
  );
};

// Tab List Container
export const TabList: React.FC<TabListProps> = ({
  children,
  variant = 'primary',
  className = '',
}) => {
  return (
    <div
      role="tablist"
      className={`
        flex
        ${variant === 'primary'
          ? 'border-b border-outline-variant'
          : 'bg-surface-container rounded-full p-1 gap-1'
        }
        ${className}
      `}
    >
      {children}
    </div>
  );
};

// Individual Tab
export const Tab: React.FC<TabProps> = ({
  value,
  children,
  disabled = false,
  icon,
  badge,
  className = '',
}) => {
  const { activeTab, setActiveTab } = useTabContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-disabled={disabled}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(value)}
      className={`
        relative flex items-center justify-center gap-2 px-4 py-3
        text-sm font-medium transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        ${isActive
          ? 'text-primary'
          : 'text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {icon && <span className="w-5 h-5">{icon}</span>}
      {children}
      {badge !== undefined && (
        <span className={`
          ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full
          ${isActive
            ? 'bg-primary-container text-on-primary-container'
            : 'bg-surface-container-highest text-on-surface-variant'
          }
        `}>
          {badge}
        </span>
      )}
      {/* Active indicator */}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
      )}
    </button>
  );
};

// Tab Panel Content
export const TabPanel: React.FC<TabPanelProps> = ({
  value,
  children,
  className = '',
}) => {
  const { activeTab } = useTabContext();

  if (activeTab !== value) return null;

  return (
    <div
      role="tabpanel"
      tabIndex={0}
      className={`focus:outline-none animate-in fade-in duration-200 ${className}`}
    >
      {children}
    </div>
  );
};

// Pill Tabs variant (for secondary/segmented control style)
interface PillTabsProps {
  options: Array<{
    value: string;
    label: string;
    icon?: React.ReactNode;
    disabled?: boolean;
  }>;
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const pillSizeStyles = {
  sm: 'h-8 text-xs px-3',
  md: 'h-10 text-sm px-4',
  lg: 'h-12 text-base px-5',
};

export const PillTabs: React.FC<PillTabsProps> = ({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}) => {
  return (
    <div
      className={`
        inline-flex bg-surface-container rounded-full p-1 gap-1
        ${className}
      `}
    >
      {options.map((option) => (
        <button
          key={option.value}
          disabled={option.disabled}
          onClick={() => !option.disabled && onChange(option.value)}
          className={`
            inline-flex items-center justify-center gap-2 rounded-full
            font-medium transition-all duration-200
            ${pillSizeStyles[size]}
            ${value === option.value
              ? 'bg-secondary-container text-on-secondary-container elevation-1'
              : 'text-on-surface-variant hover:bg-on-surface/5'
            }
            ${option.disabled ? 'opacity-40 cursor-not-allowed' : ''}
          `}
        >
          {option.icon && <span className="w-4 h-4">{option.icon}</span>}
          {option.label}
        </button>
      ))}
    </div>
  );
};

// Scrollable Tabs for many items
interface ScrollableTabsProps {
  tabs: Array<{
    value: string;
    label: string;
    icon?: React.ReactNode;
  }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const ScrollableTabs: React.FC<ScrollableTabsProps> = ({
  tabs,
  value,
  onChange,
  className = '',
}) => {
  return (
    <div className={`relative ${className}`}>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex border-b border-outline-variant min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onChange(tab.value)}
              className={`
                relative flex items-center gap-2 px-4 py-3
                text-sm font-medium whitespace-nowrap
                transition-colors duration-200
                ${value === tab.value
                  ? 'text-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
                }
              `}
            >
              {tab.icon && <span className="w-5 h-5">{tab.icon}</span>}
              {tab.label}
              {value === tab.value && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>
      {/* Fade edges for scroll indication */}
      <div className="absolute top-0 bottom-0 left-0 w-4 bg-gradient-to-r from-surface to-transparent pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-0 w-4 bg-gradient-to-l from-surface to-transparent pointer-events-none" />
    </div>
  );
};
