"use client";

import { Home, TrendingUp } from "lucide-react";

interface ViewToggleProps {
  activeView: "investor" | "homebuyer";
  onViewChange: (view: "investor" | "homebuyer") => void;
}

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex justify-center mb-8">
      <div className="inline-flex items-center bg-surface-container rounded-full p-1 border border-outline-variant/50">
        <button
          onClick={() => onViewChange("homebuyer")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
            activeView === "homebuyer"
              ? "bg-primary text-on-primary shadow-md"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          }`}
        >
          <Home className="w-4 h-4" />
          Homebuyer
        </button>
        <button
          onClick={() => onViewChange("investor")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
            activeView === "investor"
              ? "bg-tertiary text-on-tertiary shadow-md"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Investor
        </button>
      </div>
    </div>
  );
}
