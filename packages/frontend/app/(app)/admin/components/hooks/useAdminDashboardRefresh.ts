'use client';

import { useState, useEffect, useCallback } from 'react';

export function useAdminDashboardRefresh(intervalMs = 5 * 60 * 1000) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    setLastRefreshTime(new Date());
  }, []);

  useEffect(() => {
    const interval = setInterval(triggerRefresh, intervalMs);
    return () => clearInterval(interval);
  }, [triggerRefresh, intervalMs]);

  return { refreshTrigger, lastRefreshTime, triggerRefresh };
}
