"use client";

import { MessageSquare } from "lucide-react";
import { DashboardCard } from "../shared/DashboardCard";
import { StatusDot } from "../shared/StatusDot";
import { useAdminAlerts } from "../hooks/useAdminAlerts";

interface FeedbackQueueCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function FeedbackQueueCard({
  refreshTrigger: _refreshTrigger,
  onClick,
}: FeedbackQueueCardProps) {
  const { alerts, isLoading, error } = useAdminAlerts();

  // Filter to feedback-related alerts, or show all info-level items
  const feedbackAlerts = alerts.filter(
    (a) =>
      a.severity === "info" ||
      (a.message && a.message.toLowerCase().includes("feedback")),
  );
  const openCount = feedbackAlerts.filter((a) => a.status === "active").length;
  const acknowledgedCount = feedbackAlerts.filter(
    (a) => a.status === "acknowledged",
  ).length;

  return (
    <DashboardCard
      title="Feedback Queue"
      icon={MessageSquare}
      badge={{
        text: `${openCount} open`,
        color:
          openCount > 5
            ? "bg-amber-500/10 text-amber-700"
            : "bg-green-500/10 text-green-700",
      }}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      <div className="space-y-2">
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1">
            <StatusDot variant="warning" size="sm" /> {openCount} open
          </span>
          <span className="flex items-center gap-1">
            <StatusDot variant="info" size="sm" /> {acknowledgedCount} in
            progress
          </span>
        </div>
        {feedbackAlerts.length > 0 ? (
          <ul className="space-y-1">
            {feedbackAlerts.slice(0, 3).map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-xs">
                <StatusDot
                  variant={item.status === "active" ? "warning" : "info"}
                  size="sm"
                />
                <span className="text-on-surface truncate">{item.message}</span>
              </li>
            ))}
            {feedbackAlerts.length > 3 && (
              <li className="text-xs text-on-surface-variant">
                +{feedbackAlerts.length - 3} more
              </li>
            )}
          </ul>
        ) : (
          <p className="text-xs text-on-surface-variant">No feedback items</p>
        )}
      </div>
    </DashboardCard>
  );
}
