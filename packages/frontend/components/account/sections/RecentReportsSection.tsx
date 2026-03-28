"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";
import { fetchRecentReports } from "@/lib/data/fetchers/reports-list";
import type { ReportSummary } from "@/lib/data/fetchers/reports-list";

export function RecentReportsSection() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchRecentReports(5)
      .then((data) => {
        if (!cancelled) {
          setReports(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReports([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-white rounded-xl border border-indigo-200/50 p-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-[#3949AB]" />
        <h2 className="text-lg font-semibold text-on-surface">
          Recent Reports
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" />
        </div>
      ) : reports.length === 0 ? (
        <div className="py-6 text-center">
          <FileText className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-3" />
          <p className="text-sm font-medium text-on-surface">No reports yet</p>
          <p className="text-xs text-on-surface-variant mt-1">
            Generate your first market report to see it here.
          </p>
          <Link
            href="/reports/builder"
            className="inline-flex mt-4 px-4 py-2 bg-[#3949AB] text-white rounded-lg text-sm font-medium hover:bg-[#3949AB]/90 transition-colors"
          >
            Create Report
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => {
            const date = new Date(report.created_at).toLocaleDateString(
              "en-US",
              {
                month: "short",
                day: "numeric",
                year: "numeric",
              },
            );
            const typeBadge =
              report.user_type === "investor"
                ? {
                    label: "Investor",
                    className: "bg-emerald-100 text-emerald-700",
                  }
                : report.user_type === "homebuyer"
                  ? {
                      label: "Homebuyer",
                      className: "bg-blue-100 text-blue-700",
                    }
                  : {
                      label: "Report",
                      className: "bg-on-surface/10 text-on-surface-variant",
                    };

            return (
              <div
                key={report.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant hover:border-[#3949AB]/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">
                      {report.title ||
                        report.primary_geography_name ||
                        "Untitled Report"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeBadge.className}`}
                      >
                        {typeBadge.label}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {date}
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href={`/reports/${report.id}`}
                  className="text-xs font-medium text-[#3949AB] hover:text-[#3949AB]/80 transition-colors flex-shrink-0"
                >
                  Reopen
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
