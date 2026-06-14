"use client";

import { AlertTriangle } from "lucide-react";
import { DashboardCard } from "../shared/DashboardCard";
import { StatusDot } from "../shared/StatusDot";
import { useAdminAlerts } from "../hooks/useAdminAlerts";

interface ActiveAlertsCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function ActiveAlertsCard({
  refreshTrigger: _refreshTrigger,
  onClick,
}: ActiveAlertsCardProps) {
  const { alerts, isLoading, error } = useAdminAlerts("active");

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const infoCount = alerts.filter((a) => a.severity === "info").length;

  const badgeColor =
    criticalCount > 0
      ? "bg-red-500/10 text-red-700"
      : warningCount > 0
        ? "bg-amber-500/10 text-amber-700"
        : "bg-green-500/10 text-green-700";

  return (
    <DashboardCard
      title="Active Alerts"
      icon={AlertTriangle}
      badge={{ text: `${alerts.length} active`, color: badgeColor }}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {alerts.length > 0 ? (
        <div className="space-y-2">
          <div className="flex gap-4 text-xs">
            {criticalCount > 0 && (
              <span className="flex items-center gap-1">
                <StatusDot variant="error" size="sm" /> {criticalCount} critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1">
                <StatusDot variant="warning" size="sm" /> {warningCount} warning
              </span>
            )}
            {infoCount > 0 && (
              <span className="flex items-center gap-1">
                <StatusDot variant="info" size="sm" /> {infoCount} info
              </span>
            )}
          </div>
          <ul className="space-y-1">
            {alerts.slice(0, 3).map((alert) => (
              <li key={alert.id} className="flex items-center gap-2 text-xs">
                <StatusDot
                  variant={
                    alert.severity === "critical"
                      ? "error"
                      : alert.severity === "warning"
                        ? "warning"
                        : "info"
                  }
                  size="sm"
                />
                <span className="text-on-surface truncate">
                  {alert.message}
                </span>
              </li>
            ))}
            {alerts.length > 3 && (
              <li className="text-xs text-on-surface-variant">
                +{alerts.length - 3} more
              </li>
            )}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-green-600">
          <StatusDot variant="success" size="sm" />
          All systems clear
        </div>
      )}
    </DashboardCard>
  );
}
