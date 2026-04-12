"use client";

import { useState } from "react";
import Link from "next/link";

const CHECKLIST_ITEMS = [
  { id: "create_account", label: "Create account", href: null },
  {
    id: "search_market",
    label: "Search your first market",
    href: "/get-started",
  },
  { id: "view_score", label: "View a PropertyIQ Score", href: "/market" },
  { id: "compare_markets", label: "Compare two markets", href: "/market" },
  {
    id: "generate_report",
    label: "Generate a market report",
    href: "/reports",
  },
] as const;

interface ProgressChecklistProps {
  completedTasks: string[];
}

export function ProgressChecklist({ completedTasks }: ProgressChecklistProps) {
  const [dismissed, setDismissed] = useState(false);

  const completed = new Set([...completedTasks, "create_account"]);
  const totalDone = completed.size;
  const total = CHECKLIST_ITEMS.length;
  const progress = (totalDone / total) * 100;
  const allDone = totalDone === total;

  if (dismissed || allDone) return null;

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant/30 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-on-surface">Getting Started</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-primary">
            {Math.round(progress)}%
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="text-on-surface-variant/40 hover:text-on-surface-variant text-xs"
            aria-label="Dismiss checklist"
          >
            ×
          </button>
        </div>
      </div>
      <div className="h-1 bg-outline-variant/20 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-[#00c853] rounded-full transition-all duration-600 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="space-y-2">
        {CHECKLIST_ITEMS.map((item) => {
          const isDone = completed.has(item.id);
          const inner = (
            <div
              className={`flex items-center gap-2.5 text-sm ${isDone ? "text-on-surface-variant line-through" : "text-on-surface"}`}
            >
              <span
                className={isDone ? "text-[#00c853]" : "text-outline-variant"}
              >
                {isDone ? "✓" : "○"}
              </span>
              {item.label}
            </div>
          );

          if (!isDone && item.href) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className="block hover:bg-surface-container-high rounded-lg px-2 py-1 -mx-2 transition-colors"
              >
                {inner}
              </Link>
            );
          }

          return (
            <div key={item.id} className="px-2 py-1 -mx-2">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
