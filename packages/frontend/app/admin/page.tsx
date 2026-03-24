"use client";

import React from "react";
import { useAdminDashboardRefresh } from "./components/hooks/useAdminDashboardRefresh";
import { useSystemHealth } from "./components/hooks/useSystemHealth";
import { SystemHealthBanner } from "./components/SystemHealthBanner";
import { DataFeedsWidget } from "./components/widgets/DataFeedsWidget";
import { PipelineRunsWidget } from "./components/widgets/PipelineRunsWidget";
import { ScoreSummaryWidget } from "./components/widgets/ScoreSummaryWidget";
import { MLWorkflowWidget } from "./components/widgets/MLWorkflowWidget";
import { UsersBillingWidget } from "./components/widgets/UsersBillingWidget";
import { FeedbackQueueWidget } from "./components/widgets/FeedbackQueueWidget";

export default function AdminDashboardPage() {
  const { refreshTrigger, lastRefreshTime, triggerRefresh } =
    useAdminDashboardRefresh();
  const { status: systemStatus, summary: healthSummary } =
    useSystemHealth(refreshTrigger);

  return (
    <div className="min-h-screen bg-surface">
      {/* Page header */}
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-semibold text-on-surface">
              Command Center
            </h1>
            <p className="text-sm text-on-surface-variant">
              Live overview of all PropertyIQ systems
            </p>
          </div>
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-tertiary-container text-on-tertiary-container">
            Admin Access
          </span>
        </div>
      </div>

      {/* System health banner */}
      <div className="mt-4">
        <SystemHealthBanner
          status={systemStatus}
          summary={healthSummary}
          lastRefresh={lastRefreshTime}
          onRefresh={triggerRefresh}
        />
      </div>

      {/* Widget grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <DataFeedsWidget refreshTrigger={refreshTrigger} />
          <PipelineRunsWidget refreshTrigger={refreshTrigger} />
          <ScoreSummaryWidget refreshTrigger={refreshTrigger} />
          <MLWorkflowWidget refreshTrigger={refreshTrigger} />
          <UsersBillingWidget refreshTrigger={refreshTrigger} />
          <FeedbackQueueWidget refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </div>
  );
}
