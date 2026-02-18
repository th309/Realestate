'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchMarketsToWatch, type MarketRecommendation } from './api';
import { useEntitlements } from '@/lib/entitlements';

export function useMarketsToWatch() {
  const [recommendations, setRecommendations] = useState<MarketRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getAccess } = useEntitlements();

  const access = getAccess('feature', 'recommendations');
  const hasAccess = access.level === 'full';

  const refresh = useCallback(async () => {
    if (!hasAccess) {
      setRecommendations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const data = await fetchMarketsToWatch();
    setRecommendations(data);
    setIsLoading(false);
  }, [hasAccess]);

  useEffect(() => { refresh(); }, [refresh]);

  return { recommendations, isLoading, hasAccess, refresh };
}
