"use client";

/**
 * USE ADMIN ALERTS HOOK
 *
 * Fetches admin alerts with optional status filtering.
 * Provides acknowledge and resolve mutations that invalidate the alerts cache on success.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAPIWithParams, fetchAPIRaw } from "@/lib/data";

export type AlertStatus = "active" | "acknowledged" | "resolved";
export type AlertSeverity = "critical" | "warning" | "info";

export interface AdminAlert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  metadata?: Record<string, unknown>;
}

interface AlertsResponse {
  alerts: AdminAlert[];
  total: number;
}

const ALERTS_QUERY_KEY = ["admin", "alerts"] as const;
const STALE_TIME = 2 * 60 * 1000; // 2 minutes

async function postAlertAction(id: string, action: "acknowledge" | "resolve") {
  const res = await fetchAPIRaw(`/api/admin/metrics/alerts/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to ${action} alert ${id}: ${res.status}`);
  }
  return res.json();
}

export function useAdminAlerts(statusFilter?: AlertStatus) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<AlertsResponse>({
    queryKey: [...ALERTS_QUERY_KEY, statusFilter],
    queryFn: () =>
      fetchAPIWithParams<AlertsResponse>("/api/admin/metrics/alerts", {
        status: statusFilter,
      }),
    staleTime: STALE_TIME,
    gcTime: STALE_TIME * 5,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => postAlertAction(id, "acknowledge"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => postAlertAction(id, "resolve"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY });
    },
  });

  return {
    alerts: data?.alerts ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error as Error | null,
    refetch,
    acknowledge: acknowledgeMutation.mutateAsync,
    resolve: resolveMutation.mutateAsync,
    isAcknowledging: acknowledgeMutation.isPending,
    isResolving: resolveMutation.isPending,
  };
}
