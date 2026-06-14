"use client";

import { useState, useCallback } from "react";
import { fetchAPIRaw } from "@/lib/data";
import { useAdminDashboardRefresh } from "./components/hooks/useAdminDashboardRefresh";
import { useDetailPanel } from "./components/hooks/useDetailPanel";
import { useTimeRange } from "./components/hooks/useTimeRange";
import { HeroStatsRow } from "./components/hero/HeroStatsRow";
import { TabBar } from "./components/tabs/TabBar";
import type { AdminTab } from "./components/tabs/TabBar";
import { OperationsTab } from "./components/tabs/OperationsTab";
import { DataScoresTab } from "./components/tabs/DataScoresTab";
import { BusinessTab } from "./components/tabs/BusinessTab";
import { DetailPanel } from "./components/shared/DetailPanel";
import { PanelContentRouter } from "./components/panels/PanelContentRouter";

export default function AdminDashboardPage() {
  // Existing refresh hook (auto-refreshes every 5 minutes)
  const { refreshTrigger, lastRefreshTime, triggerRefresh } =
    useAdminDashboardRefresh();

  // New hooks for tabs, detail panel, and time range
  const [activeTab, setActiveTab] = useState<AdminTab>("operations");
  const { isOpen, activeCard, openPanel, closePanel } = useDetailPanel();
  const { range, setRange } = useTimeRange();
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);

  const triggerSnapshots = useCallback(async () => {
    setSnapshotStatus("Recording...");
    const endpoints = [
      "trigger/health-snapshots",
      "trigger/user-snapshots",
      "trigger/cache-snapshots",
      "trigger/score-snapshots",
    ];
    const results = await Promise.allSettled(
      endpoints.map((ep) =>
        fetchAPIRaw(`/api/admin/metrics/${ep}`, { method: "POST" }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    setSnapshotStatus(`${ok}/${endpoints.length} recorded`);
    triggerRefresh();
    setTimeout(() => setSnapshotStatus(null), 3000);
  }, [triggerRefresh]);

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="p-6 pb-0 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">
            Command Center
          </h1>
          <p className="text-sm text-on-surface-variant">
            Live overview of all PropertyIQ systems
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-on-surface-variant">
            Last updated: {formatTimeAgo(lastRefreshTime)}
          </span>
          <button
            onClick={triggerSnapshots}
            disabled={snapshotStatus === "Recording..."}
            className="px-3 py-2 bg-surface-container text-on-surface-variant text-xs font-medium rounded-lg hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            {snapshotStatus ?? "Record Snapshots"}
          </button>
          <button
            data-testid="refresh-button"
            onClick={triggerRefresh}
            className="px-4 py-2 bg-primary text-on-primary text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Hero Stats Row */}
      <div className="px-6 pt-4">
        <HeroStatsRow refreshTrigger={refreshTrigger} />
      </div>

      {/* Tab Bar + Content */}
      <div className="px-6 pt-6">
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="pt-4 pb-6">
          {activeTab === "operations" && (
            <OperationsTab
              refreshTrigger={refreshTrigger}
              onCardClick={openPanel}
            />
          )}
          {activeTab === "data-scores" && (
            <DataScoresTab
              refreshTrigger={refreshTrigger}
              onCardClick={openPanel}
            />
          )}
          {activeTab === "business" && (
            <BusinessTab
              refreshTrigger={refreshTrigger}
              onCardClick={openPanel}
            />
          )}
        </div>
      </div>

      {/* Detail Panel (slide-out from right) */}
      <DetailPanel
        isOpen={isOpen}
        onClose={closePanel}
        title={getPanelTitle(activeCard)}
        timeRangeKey={range.key}
        onTimeRangeChange={setRange}
      >
        <PanelContentRouter
          cardId={activeCard}
          timeRange={range}
          refreshTrigger={refreshTrigger}
        />
      </DetailPanel>
    </div>
  );
}

/** Map card IDs to human-readable panel titles. */
function getPanelTitle(cardId: string | null): string {
  const titles: Record<string, string> = {
    "data-feeds": "Data Feeds",
    "pipeline-runs": "Pipeline Runs",
    "api-performance": "API Performance",
    "cache-performance": "Cache Performance",
    "active-alerts": "Active Alerts",
    "score-health": "Score Health",
    "ml-ops": "ML Ops",
    "geographic-coverage": "Geographic Coverage",
    "data-quality": "Data Quality",
    "score-computation": "Score Computation",
    "users-growth": "Users & Growth",
    "revenue-mrr": "Revenue / MRR",
    "feature-usage": "Feature Usage",
    "tier-distribution": "Tier Distribution",
    "feedback-queue": "Feedback Queue",
  };
  return titles[cardId || ""] || "Details";
}

/** Format a Date as a human-readable relative time string. */
function formatTimeAgo(date: Date | null): string {
  if (!date) return "Never";
  const diff = Date.now() - date.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return "Just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
