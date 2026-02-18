'use client';

import React, { useEffect } from 'react';
import { useEntitlements } from '@/lib/entitlements';
import type { ResourceType } from '@/lib/entitlements';
import Link from 'next/link';

interface BlurredTeaserProps {
  children: React.ReactNode;
  title: string;
  description: string;
  ctaText?: string;
  ctaHref?: string;
  resourceType: ResourceType;
  resourceId: string;
}

export function BlurredTeaser({
  children,
  title,
  description,
  ctaText = 'Go Pro \u2192',
  ctaHref = '/pricing',
  resourceType,
  resourceId,
}: BlurredTeaserProps) {
  const { trackPaywallView, trackUpgradeClick } = useEntitlements();

  useEffect(() => {
    trackPaywallView(resourceType, resourceId);
  }, [resourceType, resourceId, trackPaywallView]);

  return (
    <div className="relative">
      <div className="blur-md pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-surface-container/95 backdrop-blur-sm rounded-2xl p-6 max-w-sm text-center shadow-lg border border-outline-variant">
          <p className="text-on-surface-variant text-sm mb-1">{title}</p>
          <p className="text-on-surface font-medium mb-4">{description}</p>
          <Link
            href={ctaHref}
            onClick={() => trackUpgradeClick(resourceType, resourceId)}
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {ctaText}
          </Link>
        </div>
      </div>
    </div>
  );
}
