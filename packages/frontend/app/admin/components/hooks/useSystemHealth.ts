"use client";

import { useState, useEffect } from "react";

type SystemStatus = "healthy" | "degraded" | "error" | "loading";

interface HealthCheckResponse {
  status: string;
  timestamp: string;
  database?: string;
}

interface DataSourcesResponse {
  status: "healthy" | "degraded" | "unhealthy";
  sources: Array<{ sourceName: string; available: boolean }>;
  summary: { total: number; available: number; fresh: number };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Fetches real system health from the backend health endpoints.
 *
 * Calls GET /api/health and GET /api/health/data-sources, then maps
 * the combined result to the SystemStatus union used by the admin banner.
 *
 * Status mapping:
 *  - Fetch failure or database error  → 'error'
 *  - Any data source unhealthy        → 'degraded'
 *  - Everything nominal               → 'healthy'
 */
export function useSystemHealth(refreshTrigger: number): {
  status: SystemStatus;
} {
  const [status, setStatus] = useState<SystemStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      setStatus("loading");

      try {
        // Fetch both endpoints in parallel
        const [healthRes, sourcesRes] = await Promise.all([
          fetch(`${API_URL}/api/health`),
          fetch(`${API_URL}/api/health/data-sources`),
        ]);

        if (cancelled) return;

        // If the primary health endpoint failed, treat as error
        if (!healthRes.ok) {
          setStatus("error");
          return;
        }

        const healthData: HealthCheckResponse = await healthRes.json();

        // Database connectivity failure → error
        if (healthData.database === "error") {
          setStatus("error");
          return;
        }

        // If data-sources endpoint returned OK, inspect sources
        if (sourcesRes.ok) {
          const sourcesData: DataSourcesResponse = await sourcesRes.json();

          if (cancelled) return;

          const hasUnhealthySource = sourcesData.sources.some(
            (source) => !source.available,
          );

          if (hasUnhealthySource || sourcesData.status === "unhealthy") {
            setStatus("degraded");
            return;
          }

          if (sourcesData.status === "degraded") {
            setStatus("degraded");
            return;
          }
        }

        // Everything looks good
        setStatus("healthy");
      } catch {
        // Network failure or other unrecoverable error
        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    checkHealth();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  return { status };
}
