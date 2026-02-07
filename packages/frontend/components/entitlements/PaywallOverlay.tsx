'use client';

import React, { useEffect } from 'react';
import { Lock } from 'lucide-react';
import { useEntitlements, ResourceType } from '@/lib/entitlements';
import Link from 'next/link';

interface PaywallOverlayProps {
  type: ResourceType;
  id: string;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function PaywallOverlay({
  type,
  id,
  children,
  title,
  className = '',
}: PaywallOverlayProps) {
  const { getAccess, trackPaywallView, trackUpgradeClick } = useEntitlements();
  const access = getAccess(type, id);
  const isBlocked = access.level === 'none';

  useEffect(() => {
    if (isBlocked) {
      trackPaywallView(type, id);
    }
  }, [isBlocked, type, id, trackPaywallView]);

  if (!isBlocked) {
    return <>{children}</>;
  }

  const handleUpgradeClick = () => {
    trackUpgradeClick(type, id);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Blurred content */}
      <div className="blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-surface/60 backdrop-blur-sm rounded-xl">
        <div className="text-center p-6 max-w-xs">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium text-on-surface mb-2">
            {title || 'Upgrade to Unlock'}
          </h3>
          <p className="text-sm text-on-surface-variant mb-4">
            This feature requires a {access.tierRequired || 'Pro'} subscription
          </p>
          <Link
            href="/pricing"
            onClick={handleUpgradeClick}
            className="
              inline-flex items-center gap-2 px-6 py-2.5
              bg-primary text-on-primary rounded-full
              font-medium text-sm
              hover:bg-primary/90 transition-colors
            "
          >
            View Plans
          </Link>
        </div>
      </div>
    </div>
  );
}
