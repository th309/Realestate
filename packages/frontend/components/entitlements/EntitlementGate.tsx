'use client';

import React, { useEffect } from 'react';
import { useEntitlements, ResourceType } from '@/lib/entitlements';

interface EntitlementGateProps {
  type: ResourceType;
  id: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showTeaser?: boolean;
}

export function EntitlementGate({
  type,
  id,
  children,
  fallback,
  showTeaser = false,
}: EntitlementGateProps) {
  const { getAccess, trackPaywallView } = useEntitlements();
  const access = getAccess(type, id);

  useEffect(() => {
    if (access.level === 'none' || (access.level === 'preview' && !showTeaser)) {
      trackPaywallView(type, id);
    }
  }, [access.level, type, id, showTeaser, trackPaywallView]);

  if (access.level === 'full') {
    return <>{children}</>;
  }

  if (access.level === 'preview' && showTeaser) {
    return <>{children}</>;
  }

  return <>{fallback}</> || null;
}
