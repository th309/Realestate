'use client';

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'filled' | 'outlined' | 'text' | 'elevated' | 'tonal';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  filled: `
    bg-primary text-on-primary
    hover:bg-primary/90 hover:elevation-1
    active:bg-primary/80
    disabled:bg-on-surface/12 disabled:text-on-surface/38
  `,
  outlined: `
    bg-transparent text-primary border-2 border-outline
    hover:bg-primary/8
    active:bg-primary/12
    disabled:border-on-surface/12 disabled:text-on-surface/38
  `,
  text: `
    bg-transparent text-primary
    hover:bg-primary/8
    active:bg-primary/12
    disabled:text-on-surface/38
  `,
  elevated: `
    bg-surface-container-low text-primary elevation-1
    hover:elevation-2
    active:elevation-1
    disabled:bg-on-surface/12 disabled:text-on-surface/38 disabled:shadow-none
  `,
  tonal: `
    bg-secondary-container text-on-secondary-container
    hover:bg-secondary-container/80 hover:elevation-1
    active:bg-secondary-container/70
    disabled:bg-on-surface/12 disabled:text-on-surface/38
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-2xl',
};

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'filled',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center font-medium
          transition-all duration-200 ease-standard
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className={`${iconSizeStyles[size]} animate-spin`} />
            {children && <span className="ml-2">{children}</span>}
          </>
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <span className={iconSizeStyles[size]}>{icon}</span>
            )}
            {children}
            {icon && iconPosition === 'right' && (
              <span className={iconSizeStyles[size]}>{icon}</span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

// FAB (Floating Action Button) variant
interface FABProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'tertiary' | 'surface';
  extended?: boolean;
  icon: React.ReactNode;
  label?: string;
}

const fabVariantStyles: Record<string, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  surface: 'bg-surface-container-high text-primary',
};

const fabSizeStyles = {
  sm: 'w-10 h-10 rounded-xl',
  md: 'w-14 h-14 rounded-2xl',
  lg: 'w-24 h-24 rounded-[28px]',
};

export const FAB = forwardRef<HTMLButtonElement, FABProps>(
  (
    {
      size = 'md',
      variant = 'primary',
      extended = false,
      icon,
      label,
      className = '',
      ...props
    },
    ref
  ) => {
    if (extended && label) {
      return (
        <button
          ref={ref}
          className={`
            inline-flex items-center gap-3 px-4 h-14 rounded-2xl
            elevation-3 hover:elevation-4 transition-all duration-200
            ${fabVariantStyles[variant]}
            ${className}
          `}
          {...props}
        >
          <span className="w-6 h-6">{icon}</span>
          <span className="font-medium pr-2">{label}</span>
        </button>
      );
    }

    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center
          elevation-3 hover:elevation-4 transition-all duration-200
          ${fabVariantStyles[variant]}
          ${fabSizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        <span className={size === 'lg' ? 'w-9 h-9' : 'w-6 h-6'}>{icon}</span>
      </button>
    );
  }
);

FAB.displayName = 'FAB';

// Icon Button variant
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
  icon: React.ReactNode;
}

const iconButtonVariantStyles: Record<string, string> = {
  standard: 'bg-transparent text-on-surface-variant hover:bg-on-surface/8',
  filled: 'bg-primary text-on-primary hover:bg-primary/90',
  tonal: 'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80',
  outlined: 'bg-transparent text-on-surface-variant border border-outline hover:bg-on-surface/8',
};

const iconButtonSizeStyles = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-10 h-10 rounded-xl',
  lg: 'w-12 h-12 rounded-2xl',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', variant = 'standard', icon, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center
          transition-all duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
          ${iconButtonVariantStyles[variant]}
          ${iconButtonSizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        <span className={size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'}>
          {icon}
        </span>
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
