"use client";

import React from "react";
import { BarChart3 } from "lucide-react";

// Static hero header for the PropertyIQ report builder page.
export function ReportBuilderHeader() {
  return (
    <div
      className={`
        relative overflow-hidden
        bg-gradient-to-br from-primary/5 via-primary/10 to-transparent
      `}
    >
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20 bg-primary" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 relative">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary/15 text-primary">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-on-surface tracking-tight">
              PropertyIQ Report
            </h2>
            <p className="text-on-surface-variant">
              Powered by PropertyIQ Score
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
