/**
 * Analytics Tab Navigation
 *
 * Five-tab bar with M3 active indicator underline.
 * Tabs: Overview, Journeys, Retention, Acquisition, Conversion.
 */

"use client";

import { BarChart3, Route, RefreshCcw, Users, TrendingUp } from "lucide-react";

type TabId =
  | "overview"
  | "journeys"
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
    <div className="border-b border-outline-variant">
      <nav
        className="flex gap-1"
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
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
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
