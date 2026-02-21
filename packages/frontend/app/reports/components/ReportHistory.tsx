'use client';

import React, { useState, useEffect } from 'react';
import { FileText, MapPin, Clock, MoreVertical, Eye, Download, Share2, Trash2, Loader2 } from 'lucide-react';
import { M3Card } from '@/app/graphs/components/M3Card';
import { SCORE_INFO } from '../constants';
import type { ReportListItem, ReportStatus } from '../types';
import Link from 'next/link';
import { fetchReportHistory } from '@/lib/data';
import { useAuth } from '@/lib/auth';

const STATUS_STYLES: Record<ReportStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-on-surface-variant', bgColor: 'bg-surface-container' },
  generating: { label: 'Generating', color: 'text-tertiary', bgColor: 'bg-tertiary/10' },
  ready: { label: 'Ready', color: 'text-primary', bgColor: 'bg-primary/10' },
  failed: { label: 'Failed', color: 'text-error', bgColor: 'bg-error/10' },
  expired: { label: 'Expired', color: 'text-on-surface-variant', bgColor: 'bg-surface-container' },
};

export const ReportHistory: React.FC = () => {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) { setLoading(false); return; }

    fetchReportHistory({ userId })
      .then((reportsList: any[]) => {
        // Map to expected frontend format
        const mappedReports: ReportListItem[] = reportsList.map((r: any) => ({
          id: r.id,
          title: r.title,
          template_slug: r.template?.slug || r.report_type,
          template_name: r.template?.name || r.report_type,
          template_icon: r.template?.icon || 'FileText',
          user_type: r.user_type,
          primary_geography_name: r.primary_geography_name,
          primary_geography_type: r.primary_geography_type,
          homeready_score: r.homeready_score,
          investoredge_score: r.investoredge_score,
          status: r.status,
          data_as_of_date: r.data_as_of_date,
          created_at: r.created_at,
        }));
        setReports(mappedReports);
      })
      .catch((err) => {
        console.error('Failed to fetch report history:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  // Format date consistently using UTC to avoid hydration mismatch
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
  };

  if (loading) {
    return (
      <M3Card variant="outlined" size="md">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </M3Card>
    );
  }

  if (error) {
    return (
      <M3Card variant="outlined" size="md">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-error mb-2">Failed to load reports</p>
          <p className="text-xs text-on-surface-variant">{error}</p>
        </div>
      </M3Card>
    );
  }

  if (reports.length === 0) {
    return (
      <M3Card variant="outlined" size="md">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-on-surface-variant" />
          </div>
          <h3 className="text-lg font-medium text-on-surface mb-2">No reports yet</h3>
          <p className="text-sm text-on-surface-variant max-w-xs">
            Generate your first report using the wizard above.
          </p>
        </div>
      </M3Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {reports.map((report) => {
        const status = STATUS_STYLES[report.status];
        const heroScore = report.user_type === 'investor' ? 'investoredge' : 'homeready';
        const scoreValue = report.user_type === 'investor' ? report.investoredge_score : report.homeready_score;
        const scoreInfo = SCORE_INFO[heroScore];

        return (
          <Link key={report.id} href={`/reports/${report.id}`}>
          <M3Card variant="elevated" size="sm" className="relative cursor-pointer hover:elevation-3 transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${status.bgColor} ${status.color}`}>
                    {status.label}
                  </span>
                  <span className="text-[9px] text-on-surface-variant">{report.template_name}</span>
                </div>
                <h4 className="font-medium text-on-surface truncate">{report.title}</h4>
              </div>

              {/* Actions Menu */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(menuOpen === report.id ? null : report.id);
                  }}
                  className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-on-surface-variant" />
                </button>

                {menuOpen === report.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(null); }} />
                    <div className="absolute right-0 top-8 z-20 w-40 bg-surface-container-high rounded-xl elevation-2 py-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/reports/${report.id}`}
                        className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container flex items-center gap-2"
                        onClick={() => setMenuOpen(null)}
                      >
                        <Eye className="w-4 h-4" /> View
                      </Link>
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container flex items-center gap-2">
                        <Download className="w-4 h-4" /> Download PDF
                      </button>
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container flex items-center gap-2">
                        <Share2 className="w-4 h-4" /> Share
                      </button>
                      <hr className="my-1 border-outline-variant/30" />
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="w-full px-4 py-2.5 text-left text-sm text-error hover:bg-error/10 flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Geography */}
            <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-4">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{report.primary_geography_name}</span>
            </div>

            {/* Score */}
            {scoreValue && (
              <div className="flex items-center justify-between p-3 bg-surface-container rounded-xl mb-3">
                <div>
                  <div className="text-xs text-on-surface-variant">{scoreInfo.name}</div>
                  <div className={`text-2xl font-bold ${scoreInfo.color}`}>{scoreValue}</div>
                </div>
                <div className={`w-12 h-12 rounded-full ${scoreInfo.bgClass}/20 flex items-center justify-center`}>
                  <div className={`w-8 h-8 rounded-full ${scoreInfo.bgClass}/40`} />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDate(report.created_at)}</span>
              {report.data_as_of_date && (
                <>
                  <span className="text-outline-variant">•</span>
                  <span>Data as of {formatDate(report.data_as_of_date)}</span>
                </>
              )}
            </div>
          </M3Card>
          </Link>
        );
      })}
    </div>
  );
};
