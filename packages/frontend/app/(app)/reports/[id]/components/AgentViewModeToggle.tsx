"use client";

import React from "react";

interface AgentViewModeToggleProps {
  agentViewMode: "client" | "prep";
  setAgentViewMode: (mode: "client" | "prep") => void;
}

// Client View / Agent Prep switch shown above agent (market-snapshot) reports.
export function AgentViewModeToggle({
  agentViewMode,
  setAgentViewMode,
}: AgentViewModeToggleProps) {
  return (
    <div className="bg-white border-b border-[rgba(27,46,74,0.08)] report-no-print">
      <div className="max-w-6xl mx-auto px-6 py-3">
        <div className="flex items-center justify-center gap-1 p-1 rounded-lg bg-[var(--report-cream)] w-fit mx-auto">
          <button
            onClick={() => setAgentViewMode("client")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              agentViewMode === "client"
                ? "bg-white text-[var(--report-navy)] shadow-sm"
                : "text-[var(--report-stone)] hover:text-[var(--report-navy)]"
            }`}
          >
            Client View
          </button>
          <button
            onClick={() => setAgentViewMode("prep")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              agentViewMode === "prep"
                ? "bg-white text-[var(--report-navy)] shadow-sm"
                : "text-[var(--report-stone)] hover:text-[var(--report-navy)]"
            }`}
          >
            Agent Prep
          </button>
        </div>
      </div>
    </div>
  );
}
