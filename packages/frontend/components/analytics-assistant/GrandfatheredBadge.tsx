'use client';

/**
 * Grandfathered Badge Component
 *
 * Displays when a user has grandfathered access to a feature.
 */

import React from 'react';
import { Crown, Clock, Info } from 'lucide-react';

interface GrandfatheredBadgeProps {
  type: 'tier' | 'feature' | 'pricing';
  originalTier?: string;
  featureName?: string;
  expiresAt?: string;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function GrandfatheredBadge({
  type,
  originalTier,
  featureName,
  expiresAt,
  showDetails = false,
  size = 'md',
}: GrandfatheredBadgeProps) {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs gap-1',
    md: 'px-2 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  const formatExpiration = (date: string) => {
    const expires = new Date(date);
    const now = new Date();
    const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return 'Expired';
    if (daysLeft === 0) return 'Expires today';
    if (daysLeft === 1) return 'Expires tomorrow';
    if (daysLeft < 30) return `${daysLeft} days left`;
    if (daysLeft < 365) return `${Math.floor(daysLeft / 30)} months left`;
    return 'Permanent';
  };

  const getLabel = () => {
    switch (type) {
      case 'tier':
        return originalTier ? `${originalTier} tier` : 'Grandfathered';
      case 'feature':
        return featureName || 'Feature preserved';
      case 'pricing':
        return 'Legacy pricing';
      default:
        return 'Grandfathered';
    }
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <span
        className={`inline-flex items-center ${sizeClasses[size]} rounded-full bg-amber-100 text-amber-800 font-medium`}
      >
        <Crown className={iconSizes[size]} />
        {getLabel()}
      </span>
      
      {showDetails && expiresAt && (
        <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
          <Clock className="w-3 h-3" />
          {formatExpiration(expiresAt)}
        </span>
      )}
    </div>
  );
}

/**
 * Grandfathered Info Tooltip Content
 */
interface GrandfatheredInfoProps {
  type: 'tier' | 'feature' | 'pricing';
  originalTier?: string;
  originalPrice?: number;
  featureName?: string;
  expiresAt?: string;
  reason?: string;
}

export function GrandfatheredInfo({
  type,
  originalTier,
  originalPrice,
  featureName,
  expiresAt,
  reason,
}: GrandfatheredInfoProps) {
  const getTitle = () => {
    switch (type) {
      case 'tier':
        return 'Grandfathered Tier';
      case 'feature':
        return 'Grandfathered Feature';
      case 'pricing':
        return 'Grandfathered Pricing';
      default:
        return 'Grandfathered Access';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'tier':
        return `You retain access to all features from your original ${originalTier || ''} tier.`;
      case 'feature':
        return `You retain access to ${featureName || 'this feature'} from your original plan.`;
      case 'pricing':
        return `You're locked in at ${originalPrice ? `$${originalPrice}/mo` : 'your original price'}.`;
      default:
        return 'You have preserved access from your original subscription.';
    }
  };

  return (
    <div className="max-w-xs p-3 bg-surface rounded-lg shadow-lg border border-outline-variant">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
          <Crown className="w-4 h-4 text-amber-700" />
        </div>
        <div>
          <h4 className="font-medium text-on-surface">{getTitle()}</h4>
          {originalTier && (
            <span className="text-xs text-on-surface-variant">
              From {originalTier} plan
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-on-surface-variant mb-3">
        {getDescription()}
      </p>

      {expiresAt && (
        <div className="flex items-center gap-1.5 text-xs text-on-surface-variant border-t border-outline-variant pt-2">
          <Clock className="w-3.5 h-3.5" />
          <span>
            {expiresAt === 'permanent'
              ? 'Valid indefinitely'
              : `Expires ${new Date(expiresAt).toLocaleDateString()}`}
          </span>
        </div>
      )}

      {reason && (
        <div className="flex items-start gap-1.5 text-xs text-on-surface-variant mt-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{reason}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Feature Card with Grandfathered Status
 */
interface FeatureCardProps {
  name: string;
  description?: string;
  isEnabled: boolean;
  isGrandfathered?: boolean;
  grandfatheredFrom?: string;
  expiresAt?: string;
  icon?: React.ReactNode;
}

export function FeatureCard({
  name,
  description,
  isEnabled,
  isGrandfathered,
  grandfatheredFrom,
  expiresAt,
  icon,
}: FeatureCardProps) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        isEnabled
          ? 'bg-surface border-outline-variant'
          : 'bg-surface-container border-transparent opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {icon && (
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isEnabled ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-on-surface">{name}</h4>
              {isGrandfathered && (
                <GrandfatheredBadge
                  type="feature"
                  originalTier={grandfatheredFrom}
                  expiresAt={expiresAt}
                  size="sm"
                />
              )}
            </div>
            {description && (
              <p className="text-sm text-on-surface-variant mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
            isEnabled ? 'bg-green-500' : 'bg-outline-variant'
          }`}
        />
      </div>
    </div>
  );
}
