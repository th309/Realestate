'use client';

import React, { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements';
import Link from 'next/link';

interface ContextualUpgradeCTAProps {
  featureSlug: string;
  title: string;
  description: string;
  ctaText?: string;
  ctaHref?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function ContextualUpgradeCTA({
  featureSlug,
  title,
  description,
  ctaText = 'Upgrade to Pro',
  ctaHref = '/pricing',
  icon,
  className = '',
}: ContextualUpgradeCTAProps) {
  const { trackPaywallView, trackUpgradeClick } = useEntitlements();

  useEffect(() => {
    trackPaywallView('feature', featureSlug);
  }, [featureSlug, trackPaywallView]);

  return (
    <div
      className={`
        bg-primary/5 border border-primary/20 rounded-xl p-4
        flex items-start gap-3
        ${className}
      `}
    >
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        {icon || <Sparkles className="w-4 h-4 text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-on-surface">{title}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">{description}</p>
        <Link
          href={ctaHref}
          onClick={() => trackUpgradeClick('feature', featureSlug)}
          className="
            mt-2 inline-flex items-center gap-1
            text-sm font-medium text-primary
            hover:text-primary/80 transition-colors
          "
        >
          {ctaText} →
        </Link>
      </div>
    </div>
  );
}
