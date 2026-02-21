'use client';

import React, { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import { fetchAPIRaw } from '@/lib/data';
import { WidgetShell } from './WidgetShell';

interface CacheGeoEntry {
  record_count: number;
  last_updated: string | null;
  exists: boolean;
}

interface MLWidgetData {
  connected: boolean;
  version: string | null;
  totalRecords: number;
  caches: Record<string, CacheGeoEntry>;
}

interface MLWorkflowWidgetProps {
  refreshTrigger: number;
}

const GEO_KEYS = ['metro', 'county', 'zip', 'state'] as const;

export function MLWorkflowWidget({ refreshTrigger }: MLWorkflowWidgetProps) {
  const [data, setData] = useState<MLWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [healthRes, cacheRes] = await Promise.allSettled([
          fetchAPIRaw('/api/admin/ml-workflow/health'),
          fetchAPIRaw('/api/admin/ml-workflow/cache-status'),
        ]);

        let connected = false;
        let version: string | null = null;
        let totalRecords = 0;
        let caches: Record<string, CacheGeoEntry> = {};

        if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
          const healthJson = await healthRes.value.json();
          // Response shape: { success, data: { status, service, version, timestamp } }
          connected = true;
          version = healthJson?.data?.version ?? null;
        }

        if (cacheRes.status === 'fulfilled' && cacheRes.value.ok) {
          const cacheJson = await cacheRes.value.json();
          // Response shape: { success, data: { caches: {...}, total_records, cache_directory } }
          const cacheData = cacheJson?.data;
          totalRecords = cacheData?.total_records ?? 0;
          caches = cacheData?.caches ?? {};
        }

        if (!cancelled) {
          setData({ connected, version, totalRecords, caches });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  return (
    <WidgetShell
      title="ML Ops"
      icon={Cpu}
      href="/admin/ml-workflow"
      loading={loading}
      error={error}
    >
      {data ? (
        <div className="space-y-3">
          {/* Connection status + version */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                data.connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-on-surface">
              {data.connected ? 'Connected' : 'Disconnected'}
            </span>
            {data.connected && data.version && (
              <span className="text-[10px] text-on-surface-variant ml-auto">
                v{data.version}
              </span>
            )}
          </div>

          {/* Total cache summary */}
          <p className="text-xs text-on-surface-variant">
            {data.totalRecords.toLocaleString()} records cached
          </p>

          {/* Per-geography cache breakdown */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {GEO_KEYS.map((geo) => {
              const entry = data.caches[geo];
              const exists = entry?.exists ?? false;
              return (
                <div key={geo} className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      exists ? 'bg-green-500' : 'bg-red-400'
                    }`}
                  />
                  <span className="text-[11px] text-on-surface-variant">
                    {geo.charAt(0).toUpperCase() + geo.slice(1)}
                  </span>
                  <span className="text-[11px] text-on-surface-variant ml-auto">
                    {exists ? entry.record_count.toLocaleString() : 'No cache'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">Unable to load ML status</p>
      )}
    </WidgetShell>
  );
}
