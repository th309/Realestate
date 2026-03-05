"use client";

import React from "react";
import Link from "next/link";
import { Bell, TrendingUp, TrendingDown, Lock } from "lucide-react";
import type { UserTier } from "@/lib/entitlements";

interface AlertHistoryEntry {
  id: string;
  alert_id: string;
  triggered_at: string;
  metric_value: number;
  alert?: {
    name?: string;
    condition?: {
      geography_name?: string;
      metric?: string;
      direction?: string;
    };
  };
}

interface AlertHistorySectionProps {
  entries: AlertHistoryEntry[];
  isLoading: boolean;
  tier: UserTier;
}

export function AlertHistorySection({
  entries,
  isLoading,
  tier,
}: AlertHistorySectionProps) {
  if (tier === "free") {
    return (
      <section className="bg-white rounded-xl border border-purple-200/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-[#7C3AED]" />
          <h2 className="text-lg font-semibold text-on-surface">Alerts</h2>
        </div>
        <div className="py-6 text-center">
          <Lock className="w-8 h-8 text-on-surface-variant/20 mx-auto mb-3" />
          <p className="text-sm font-medium text-on-surface">
            Alerts are a Pro feature
          </p>
          <p className="text-xs text-on-surface-variant mt-1 mb-3">
            Get notified when market conditions change.
          </p>
          <Link
            href="/pricing"
            className="inline-flex px-4 py-2 bg-[#7C3AED] text-white rounded-lg text-sm font-medium hover:bg-[#7C3AED]/90 transition-colors"
          >
            Upgrade to Pro
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-purple-200/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#7C3AED]" />
          <h2 className="text-lg font-semibold text-on-surface">Alerts</h2>
        </div>
        <Link
          href="/alerts"
          className="text-sm font-medium text-[#7C3AED] hover:text-[#7C3AED]/80 transition-colors"
        >
          Manage Alerts
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 bg-surface-container-highest rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="py-6 text-center">
          <Bell className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-3" />
          <p className="text-sm font-medium text-on-surface">
            No alerts triggered yet
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            Your triggered alerts will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isUp = entry.alert?.condition?.direction === "up";
            const geoName =
              entry.alert?.condition?.geography_name ?? "Unknown market";
            const metricName =
              entry.alert?.condition?.metric?.replace(/_/g, " ") ?? "metric";
            const date = new Date(entry.triggered_at).toLocaleDateString(
              "en-US",
              {
                month: "short",
                day: "numeric",
                year: "numeric",
              },
            );

            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant"
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isUp ? "bg-green-100" : "bg-red-100"
                  }`}
                >
                  {isUp ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-on-surface truncate">
                    {geoName}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {metricName} changed &middot; {date}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
