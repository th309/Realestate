'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { useEntitlements, ResourceType, UserTier } from '@/lib/entitlements';
import Link from 'next/link';

interface PaywallCardProps {
  type: ResourceType;
  id: string;
  title?: string;
  description?: string;
  className?: string;
}

const TIER_LABELS: Record<UserTier, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
  admin: 'Admin',
};

export function PaywallCard({
  type,
  id,
  title,
  description,
  className = '',
}: PaywallCardProps) {
  const { getTierRequired, trackUpgradeClick } = useEntitlements();
  const tierRequired = getTierRequired(type, id) || 'pro';

  const handleUpgradeClick = () => {
    trackUpgradeClick(type, id);
  };

  return (
    <div
      className={`
        bg-surface-container rounded-xl p-6 border border-outline-variant
        flex flex-col items-center text-center gap-4
        ${className}
      `}
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="w-6 h-6 text-primary" />
      </div>

      <div>
        <h3 className="text-lg font-medium text-on-surface">
          {title || 'Upgrade to Unlock'}
        </h3>
        <p className="text-sm text-on-surface-variant mt-1">
          {description || 'Get the data edge. Access 60+ metrics, ZIP-level detail, and full market history \u2014 analytics typically reserved for institutional investors.'}
        </p>
      </div>

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
  );
}
