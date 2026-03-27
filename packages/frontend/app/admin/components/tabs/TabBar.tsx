"use client";

export type AdminTab = "operations" | "data-scores" | "business";

const TAB_LABELS: Record<AdminTab, string> = {
  operations: "Operations",
  "data-scores": "Data & Scores",
  business: "Business",
};

const TAB_ORDER: AdminTab[] = ["operations", "data-scores", "business"];

interface TabBarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div data-testid="tab-bar" className="border-b-2 border-outline-variant/30">
      <div className="flex gap-0">
        {TAB_ORDER.map((tab) => (
          <button
            key={tab}
            data-testid={`tab-${tab}`}
            data-active={activeTab === tab}
            onClick={() => onTabChange(tab)}
            className={`px-6 py-3 text-sm font-medium transition-colors duration-200 ${
              activeTab === tab
                ? "text-on-surface border-b-2 border-primary -mb-[2px]"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
    </div>
  );
}
