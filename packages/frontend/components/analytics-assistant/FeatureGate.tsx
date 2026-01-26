'use client';

/**
 * Feature Gate Component
 *
 * Wrapper that checks feature access and shows upgrade prompt if needed.
 */

import React from 'react';
import { useFeatures } from '@/lib/hooks/useFeatures';
import { UpgradePrompt } from './UpgradePrompt';
import { Loader2 } from 'lucide-react';

interface FeatureGateProps {
  feature: string;
  featureName?: string;
  userId?: string;
  tierSlug?: string;
  requiredTier?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  onUpgrade?: () => void;
}

export function FeatureGate({
  feature,
  featureName,
  userId,
  tierSlug,
  requiredTier = 'pro',
  children,
  fallback,
  showUpgradePrompt = true,
  onUpgrade,
}: FeatureGateProps) {
  const { isEnabled, isLoading, features } = useFeatures({
    userId,
    tierSlug,
    autoLoad: true,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  // Feature is enabled
  if (isEnabled(feature)) {
    return <>{children}</>;
  }

  // Feature is disabled - show fallback or upgrade prompt
  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgradePrompt) {
    return (
      <UpgradePrompt
        feature={feature}
        featureName={featureName}
        currentTier={features?.tier || 'free'}
        requiredTier={requiredTier}
        onUpgrade={onUpgrade}
      />
    );
  }

  return null;
}

/**
 * Hook-based feature check for conditional rendering
 */
export function useFeatureAccess(
  feature: string,
  options?: { userId?: string; tierSlug?: string }
): { hasAccess: boolean; isLoading: boolean; tier: string } {
  const { isEnabled, isLoading, features } = useFeatures({
    userId: options?.userId,
    tierSlug: options?.tierSlug,
    autoLoad: true,
  });

  return {
    hasAccess: isEnabled(feature),
    isLoading,
    tier: features?.tier || 'free',
  };
}
