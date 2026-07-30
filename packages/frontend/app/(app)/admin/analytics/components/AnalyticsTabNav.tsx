/**
 * Analytics Tab Navigation
 *
 * Six-tab bar with M3 active indicator underline.
 * Tabs: Overview, Journeys, Visitors, Retention, Acquisition, Conversion.
 *
 * Visitors sits next to Journeys deliberately: Journeys aggregates paths across
 * everyone, Visitors follows one person down one of them.
 */

"use client";

import {
  BarChart3,
  Route,
  RefreshCcw,
  Users,
  TrendingUp,
  UserSearch,
} from "lucide-react";

type TabId =
  | "overview"
  | "journeys"
  | "visitors"
  | "retention"
  | "acquisition"
  | "conversion";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: Tab[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "journeys", label: "Journeys", icon: Route },
  { id: "visitors", label: "Visitors", icon: UserSearch },
  { id: "retention", label: "Retention", icon: RefreshCcw },
  { id: "acquisition", label: "Acquisition", icon: Users },
  { id: "conversion", label: "Conversion", icon: TrendingUp },
];

interface AnalyticsTabNavProps {
  activeTab: string;
  onChange: (tab: TabId) => void;
}

export function AnalyticsTabNav({ activeTab, onChange }: AnalyticsTabNavProps) {
  return (
    <div className="border-b border-outline-variant overflow-x-auto">
      <nav
        className="flex gap-1 min-w-max"
        role="tablist"
        aria-label="Analytics sections"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(id)}
              className={`relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {/* M3 active indicator */}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-primary" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
