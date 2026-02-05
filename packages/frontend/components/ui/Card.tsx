'use client';

import React from 'react';

type CardVariant = 'elevated' | 'filled' | 'outlined';
type CardSize = 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  size?: CardSize;
  className?: string;
  header?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
  onClick?: () => void;
  hoverable?: boolean;
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
  sm: 'p-3',
  md: 'p-4 md:p-5',
  lg: 'p-5 md:p-6',
};

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  size = 'md',
  className = '',
  header,
  headerAction,
  footer,
  noPadding = false,
  onClick,
  hoverable = false,
}) => {
  const isClickable = !!onClick || hoverable;

  return (
    <div
      onClick={onClick}
      className={`
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        transition-all duration-200
        ${isClickable ? 'cursor-pointer hover:elevation-2' : ''}
        ${className}
      `}
    >
      {(header || headerAction) && (
        <div
          className={`
            flex items-center justify-between gap-4
            ${noPadding ? paddingStyles[size] : `${paddingStyles[size]} pb-0`}
          `}
        >
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
      <div className={noPadding ? '' : paddingStyles[size]}>{children}</div>
      {footer && (
        <div
          className={`
            border-t border-outline-variant/50
            ${paddingStyles[size]}
          `}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

// Card Header component for complex headers
interface CardHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success';
}

const badgeColors = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  error: 'bg-error-container text-on-error-container',
  success: 'bg-green-100 text-green-800',
};

export const CardHeader: React.FC<CardHeaderProps> = ({
  icon,
  title,
  subtitle,
  badge,
  badgeColor = 'primary',
}) => {
  return (
    <div className="flex items-center gap-3">
      {icon && (
        <div className="p-2 bg-primary-container rounded-xl shrink-0">{icon}</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-on-surface tracking-tight truncate">
            {title}
          </h3>
          {badge && (
            <span
              className={`text-[9px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${badgeColors[badgeColor]}`}
            >
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

// Card with loading skeleton state
interface SkeletonCardProps {
  variant?: CardVariant;
  size?: CardSize;
  className?: string;
  lines?: number;
  showHeader?: boolean;
  showFooter?: boolean;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  variant = 'elevated',
  size = 'md',
  className = '',
  lines = 3,
  showHeader = true,
  showFooter = false,
}) => {
  return (
    <div
      className={`
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${paddingStyles[size]}
        animate-pulse
        ${className}
      `}
    >
      {showHeader && (
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-surface-container-highest rounded-xl" />
          <div className="flex-1">
            <div className="h-4 bg-surface-container-highest rounded w-3/4 mb-2" />
            <div className="h-3 bg-surface-container-highest rounded w-1/2" />
          </div>
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-surface-container-highest rounded"
            style={{ width: `${Math.random() * 40 + 60}%` }}
          />
        ))}
      </div>
      {showFooter && (
        <div className="mt-4 pt-4 border-t border-outline-variant/50">
          <div className="h-8 bg-surface-container-highest rounded-lg w-24" />
        </div>
      )}
    </div>
  );
};

// Horizontal Card variant for list items
interface HorizontalCardProps {
  children: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  variant?: CardVariant;
  className?: string;
  onClick?: () => void;
}

export const HorizontalCard: React.FC<HorizontalCardProps> = ({
  children,
  leading,
  trailing,
  variant = 'filled',
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-4 p-4 rounded-xl
        ${variantStyles[variant]}
        ${onClick ? 'cursor-pointer hover:bg-surface-container-high' : ''}
        transition-colors duration-200
        ${className}
      `}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">{children}</div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
};
