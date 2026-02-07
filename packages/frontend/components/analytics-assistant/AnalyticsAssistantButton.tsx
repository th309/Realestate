'use client';

/**
 * Analytics Assistant Trigger Button
 *
 * Drop this anywhere to add the assistant capability.
 */

import React, { useState } from 'react';
import { Sparkles, Lock } from 'lucide-react';
import { AnalyticsAssistantModal } from './AnalyticsAssistantModal';
import { AnalyticsAssistantProps } from './types';
import { useEntitlements } from '@/lib/entitlements';
import { PaywallCard } from '@/components/entitlements/PaywallCard';

interface ButtonProps extends AnalyticsAssistantProps {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Custom label */
  label?: string;
  /** Show icon only */
  iconOnly?: boolean;
  /** Custom className */
  className?: string;
}

export function AnalyticsAssistantButton({
  variant = 'primary',
  size = 'md',
  label = 'Ask AI',
  iconOnly = false,
  className = '',
  ...modalProps
}: ButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const { canAccess } = useEntitlements();
  const canUseAssistant = canAccess('feature', 'analytics_assistant');

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
  };

  const variantClasses = {
    primary: 'bg-primary text-on-primary hover:bg-primary/90',
    secondary:
      'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80',
    ghost: 'text-primary hover:bg-primary/10',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <>
      <button
        onClick={() => canUseAssistant ? setIsOpen(true) : setShowPaywall(true)}
        className={`
          inline-flex items-center justify-center rounded-full font-medium
          transition-colors
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          ${iconOnly ? '!px-2.5 !py-2.5' : ''}
          ${!canUseAssistant ? 'opacity-70' : ''}
          ${className}
        `}
        aria-label={iconOnly ? label : undefined}
      >
        {canUseAssistant ? (
          <Sparkles className={iconSizes[size]} />
        ) : (
          <Lock className={iconSizes[size]} />
        )}
        {!iconOnly && <span>{label}</span>}
      </button>

      {canUseAssistant && (
        <AnalyticsAssistantModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          {...modalProps}
        />
      )}

      {showPaywall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40"
          onClick={() => setShowPaywall(false)}
        >
          <div className="max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <PaywallCard
              type="feature"
              id="analytics_assistant"
              title="Unlock AI Analytics"
              description="Ask natural language questions about any market. Get instant data-driven answers with charts, comparisons, and rankings."
            />
          </div>
        </div>
      )}
    </>
  );
}
