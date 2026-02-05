'use client';

import React from 'react';

type BadgeVariant = 'filled' | 'outlined' | 'soft';
type BadgeColor = 'primary' | 'secondary' | 'tertiary' | 'error' | 'success' | 'warning' | 'info';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  color?: BadgeColor;
  size?: BadgeSize;
  icon?: React.ReactNode;
  className?: string;
  dot?: boolean;
  removable?: boolean;
  onRemove?: () => void;
}

const colorStyles: Record<BadgeColor, Record<BadgeVariant, string>> = {
  primary: {
    filled: 'bg-primary text-on-primary',
    outlined: 'border-2 border-primary text-primary bg-transparent',
    soft: 'bg-primary-container text-on-primary-container',
  },
  secondary: {
    filled: 'bg-secondary text-on-secondary',
    outlined: 'border-2 border-secondary text-secondary bg-transparent',
    soft: 'bg-secondary-container text-on-secondary-container',
  },
  tertiary: {
    filled: 'bg-tertiary text-on-tertiary',
    outlined: 'border-2 border-tertiary text-tertiary bg-transparent',
    soft: 'bg-tertiary-container text-on-tertiary-container',
  },
  error: {
    filled: 'bg-error text-on-error',
    outlined: 'border-2 border-error text-error bg-transparent',
    soft: 'bg-error-container text-on-error-container',
  },
  success: {
    filled: 'bg-green-600 text-white',
    outlined: 'border-2 border-green-600 text-green-600 bg-transparent',
    soft: 'bg-green-100 text-green-800',
  },
  warning: {
    filled: 'bg-amber-500 text-white',
    outlined: 'border-2 border-amber-500 text-amber-600 bg-transparent',
    soft: 'bg-amber-100 text-amber-800',
  },
  info: {
    filled: 'bg-blue-600 text-white',
    outlined: 'border-2 border-blue-600 text-blue-600 bg-transparent',
    soft: 'bg-blue-100 text-blue-800',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 rounded',
  md: 'text-xs px-2 py-0.5 rounded-md',
  lg: 'text-sm px-2.5 py-1 rounded-lg',
};

const dotColors: Record<BadgeColor, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  tertiary: 'bg-tertiary',
  error: 'bg-error',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'soft',
  color = 'primary',
  size = 'md',
  icon,
  className = '',
  dot = false,
  removable = false,
  onRemove,
}) => {
  return (
    <span
      className={`
        inline-flex items-center gap-1 font-medium
        ${colorStyles[color][variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[color]}`} />
      )}
      {icon && <span className="w-3 h-3">{icon}</span>}
      {children}
      {removable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
};

// Status Badge with predefined states
type StatusType = 'active' | 'inactive' | 'pending' | 'success' | 'error' | 'warning';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: BadgeSize;
  className?: string;
}

const statusConfig: Record<StatusType, { color: BadgeColor; defaultLabel: string }> = {
  active: { color: 'success', defaultLabel: 'Active' },
  inactive: { color: 'secondary', defaultLabel: 'Inactive' },
  pending: { color: 'warning', defaultLabel: 'Pending' },
  success: { color: 'success', defaultLabel: 'Success' },
  error: { color: 'error', defaultLabel: 'Error' },
  warning: { color: 'warning', defaultLabel: 'Warning' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  className = '',
}) => {
  const config = statusConfig[status];
  return (
    <Badge color={config.color} variant="soft" size={size} dot className={className}>
      {label || config.defaultLabel}
    </Badge>
  );
};

// Tier Badge for subscription levels
type TierType = 'free' | 'basic' | 'pro' | 'enterprise';

interface TierBadgeProps {
  tier: TierType;
  size?: BadgeSize;
  className?: string;
}

const tierConfig: Record<TierType, { color: BadgeColor; label: string }> = {
  free: { color: 'secondary', label: 'Free' },
  basic: { color: 'info', label: 'Basic' },
  pro: { color: 'primary', label: 'Pro' },
  enterprise: { color: 'tertiary', label: 'Enterprise' },
};

export const TierBadge: React.FC<TierBadgeProps> = ({
  tier,
  size = 'sm',
  className = '',
}) => {
  const config = tierConfig[tier];
  return (
    <Badge color={config.color} variant="filled" size={size} className={`uppercase tracking-wider ${className}`}>
      {config.label}
    </Badge>
  );
};

// Count Badge (notification style)
interface CountBadgeProps {
  count: number;
  max?: number;
  color?: BadgeColor;
  className?: string;
}

export const CountBadge: React.FC<CountBadgeProps> = ({
  count,
  max = 99,
  color = 'error',
  className = '',
}) => {
  const displayCount = count > max ? `${max}+` : count;

  if (count === 0) return null;

  return (
    <span
      className={`
        inline-flex items-center justify-center min-w-5 h-5 px-1.5
        text-[10px] font-bold rounded-full
        ${colorStyles[color].filled}
        ${className}
      `}
    >
      {displayCount}
    </span>
  );
};
