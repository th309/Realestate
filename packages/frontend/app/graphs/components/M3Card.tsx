'use client';

import React from 'react';

type CardVariant = 'elevated' | 'filled' | 'outlined';
type CardSize = 'sm' | 'md' | 'lg';

interface M3CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  size?: CardSize;
  className?: string;
  header?: React.ReactNode;
  headerAction?: React.ReactNode;
  noPadding?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  elevated: 'bg-surface-container-low elevation-1 border border-outline-variant/30',
  filled: 'bg-surface-container border border-outline-variant/50',
  outlined: 'bg-surface border-2 border-outline-variant',
};

const sizeStyles: Record<CardSize, string> = {
  sm: 'rounded-xl',
  md: 'rounded-2xl',
  lg: 'rounded-3xl',
};

const paddingStyles: Record<CardSize, string> = {
  sm: 'p-4',
  md: 'p-5 md:p-6',
  lg: 'p-6 md:p-8',
};

export const M3Card: React.FC<M3CardProps> = ({
  children,
  variant = 'elevated',
  size = 'md',
  className = '',
  header,
  headerAction,
  noPadding = false,
}) => {
  return (
    <div
      className={`
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        transition-shadow duration-200
        ${className}
      `}
    >
      {(header || headerAction) && (
        <div className={`flex items-center justify-between gap-4 ${noPadding ? paddingStyles[size] : `${paddingStyles[size]} pb-0`}`}>
          {header && (
            <div className="flex-1 min-w-0">
              {typeof header === 'string' ? (
                <h3 className="text-sm font-medium text-on-surface tracking-tight truncate">
                  {header}
                </h3>
              ) : (
                header
              )}
            </div>
          )}
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className={noPadding ? '' : paddingStyles[size]}>
        {children}
      </div>
    </div>
  );
};

// Card Header component for complex headers
interface M3CardHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: 'primary' | 'secondary' | 'tertiary' | 'error';
}

const badgeColors = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  error: 'bg-error-container text-on-error-container',
};

export const M3CardHeader: React.FC<M3CardHeaderProps> = ({
  icon,
  title,
  subtitle,
  badge,
  badgeColor = 'primary',
}) => {
  return (
    <div className="flex items-center gap-3">
      {icon && (
        <div className="p-2 bg-primary-container rounded-xl shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-on-surface tracking-tight truncate">
            {title}
          </h3>
          {badge && (
            <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${badgeColors[badgeColor]}`}>
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
};
