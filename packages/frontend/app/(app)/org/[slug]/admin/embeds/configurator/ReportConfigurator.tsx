"use client";

import { useState, useEffect } from "react";
import {
  fetchRecentReports,
  type ReportSummary,
} from "@/lib/data/fetchers/reports-list";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ReportConfiguratorProps {
  onUrlChange: (url: string | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ReportConfigurator({ onUrlChange }: ReportConfiguratorProps) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchRecentReports(50)
      .then((data) => {
        if (!cancelled) {
          setReports(data);
        }
      })
      .catch((err) => {
        console.error("[ReportConfigurator] Failed to fetch reports:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedReportId) {
      onUrlChange(`/embed/report/${selectedReportId}`);
    } else {
      onUrlChange(null);
    }
  }, [selectedReportId, onUrlChange]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-on-surface-variant">
        <LoadingSpinner />
        Loading reports...
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-6 text-center">
        <p className="text-sm text-on-surface-variant">
          No reports available. Generate a report first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-on-surface mb-1.5">
          Report
        </label>
        <select
          value={selectedReportId}
          onChange={(e) => setSelectedReportId(e.target.value)}
          className="w-full h-12 px-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-200"
        >
          <option value="">Select a report...</option>
          {reports.map((report) => (
            <option key={report.id} value={report.id}>
              {formatReportLabel(report)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatReportLabel(report: ReportSummary): string {
  const parts = [report.title || "Untitled Report"];
  if (report.primary_geography_name) {
    parts.push(`- ${report.primary_geography_name}`);
  }
  const date = new Date(report.created_at);
  if (!isNaN(date.getTime())) {
    parts.push(`(${date.toLocaleDateString()})`);
  }
  return parts.join(" ");
}

function LoadingSpinner() {
  return (
    <div className="w-4 h-4 border-2 border-primary-container border-t-primary rounded-full animate-spin" />
  );
}
