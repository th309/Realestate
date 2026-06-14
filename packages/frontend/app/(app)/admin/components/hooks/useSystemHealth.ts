"use client";

import { useState, useEffect } from "react";
import { fetchAPIRaw } from "@/lib/data";

export type SystemStatus = "healthy" | "degraded" | "error" | "loading";

export interface HealthSummary {
  total: number;
  available: number;
  fresh: number;
}

interface DataSourcesResponse {
  status: "healthy" | "degraded" | "unhealthy";
  sources: Array<{ sourceName: string; available: boolean }>;
  summary: HealthSummary;
}

export interface SystemHealthState {
  status: SystemStatus;
  summary: HealthSummary | null;
}

/**
 * Fetches real system health from the backend data-sources endpoint.
 *
 * Uses fetchAPIRaw from the data layer. Maps the response to the
 * SystemStatus union used by the admin banner and returns the summary
 * so the banner can display source counts.
 *
 * Status mapping:
 *  - Fetch failure           → 'error'
 *  - status 'unhealthy'      → 'error'
 *  - status 'degraded'       → 'degraded'
 *  - status 'healthy'        → 'healthy'
 */
export function useSystemHealth(refreshTrigger: number): SystemHealthState {
  const [state, setState] = useState<SystemHealthState>({
    status: "loading",
    summary: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      setState((prev) => ({ ...prev, status: "loading" }));

      try {
        const res = await fetchAPIRaw("/api/health/data-sources");

        if (cancelled) return;

        if (!res.ok) {
          setState({ status: "error", summary: null });
          return;
        }

        const data: DataSourcesResponse = await res.json();

        if (cancelled) return;

        const statusMap: Record<DataSourcesResponse["status"], SystemStatus> = {
          healthy: "healthy",
          degraded: "degraded",
          unhealthy: "error",
        };

        setState({
          status: statusMap[data.status] ?? "error",
          summary: data.summary,
        });
      } catch {
        if (!cancelled) {
          setState({ status: "error", summary: null });
        }
      }
    }

    checkHealth();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  return state;
}
