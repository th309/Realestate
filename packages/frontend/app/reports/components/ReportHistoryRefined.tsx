'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  MapPin,
  Clock,
  MoreHorizontal,
  Eye,
  Download,
  Share2,
  Trash2,
  Loader2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { SCORE_INFO } from '../constants';
import type { ReportListItem, ReportStatus } from '../types';
import Link from 'next/link';
import { fetchReportHistory } from '@/lib/data';

const STATUS_CONFIG: Record<ReportStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'report-badge-pending' },
  generating: { label: 'Generating', className: 'report-badge-generating' },
  ready: { label: 'Ready', className: 'report-badge-ready' },
  failed: { label: 'Failed', className: 'report-badge-failed' },
  expired: { label: 'Expired', className: 'report-badge-pending' },
};

const GEO_TYPE_LABELS: Record<string, string> = {
  metro: 'Metro Area',
  county: 'County',
  zip: 'ZIP Code',
  city: 'City',
  state: 'State',
};

export const ReportHistoryRefined: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = '4003d650-6a5e-4419-98d5-cf5374e1885d';

    fetchReportHistory({ userId })
      .then((reportsList: any[]) => {
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateStr);
  };

  if (loading) {
    return (
      <div className="report-card p-12 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[var(--report-navy)] animate-spin" />
          <p className="report-body-sm">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="report-card p-12 text-center">
        <p className="text-[var(--report-error)] mb-2">Failed to load reports</p>
        <p className="report-body-sm">{error}</p>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="report-card p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--report-cream-dark)] flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-[var(--report-stone)]" />
        </div>
        <h3 className="report-heading-sm mb-2">No reports yet</h3>
        <p className="report-body-sm max-w-sm mx-auto">
          Generate your first report using the wizard above. Your reports will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {reports.map((report, index) => {
        const status = STATUS_CONFIG[report.status];
        const heroScore = report.user_type === 'investor' ? 'investoredge' : 'homeready';
        const scoreValue = report.user_type === 'investor' ? report.investoredge_score : report.homeready_score;
        const scoreInfo = SCORE_INFO[heroScore];
        const geoLabel = GEO_TYPE_LABELS[report.primary_geography_type] || report.primary_geography_type;

        return (
          <Link
            key={report.id}
            href={`/reports/${report.id}`}
            className="group report-card-elevated p-0 overflow-hidden block"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Card Header */}
            <div className="p-5 pb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`report-badge ${status.className}`}>
                      {status.label}
                    </span>
                    <span className="text-[10px] text-[var(--report-stone-light)] uppercase tracking-wider">
                      {report.template_name}
                    </span>
                  </div>
                  <h4 className="report-heading-sm truncate pr-2 group-hover:text-[var(--report-navy-light)] transition-colors">
                    {report.title}
                  </h4>
                </div>

                {/* Menu */}
                <div className="relative shrink-0">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuOpen(menuOpen === report.id ? null : report.id);
                    }}
                    className="p-2 rounded-lg hover:bg-[var(--report-cream-dark)] transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4 text-[var(--report-stone)]" />
                  </button>

                  {menuOpen === report.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpen(null);
                        }}
                      />
                      <div
                        className="absolute right-0 top-10 z-20 w-44 bg-white rounded-xl shadow-lg py-2 border border-[rgba(27,46,74,0.08)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link
                          href={`/reports/${report.id}`}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--report-navy)] hover:bg-[var(--report-cream)] transition-colors"
                          onClick={() => setMenuOpen(null)}
                        >
                          <Eye className="w-4 h-4" /> View Report
                        </Link>
                        <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--report-navy)] hover:bg-[var(--report-cream)] transition-colors">
                          <Download className="w-4 h-4" /> Download PDF
                        </button>
                        <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--report-navy)] hover:bg-[var(--report-cream)] transition-colors">
                          <Share2 className="w-4 h-4" /> Share Report
                        </button>
                        <hr className="my-2 border-[var(--report-cream-dark)]" />
                        <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--report-error)] hover:bg-[var(--report-error-bg)] transition-colors">
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Geography */}
              <div className="flex items-center gap-2 text-sm text-[var(--report-stone)]">
                <MapPin className="w-4 h-4 shrink-0 text-[var(--report-stone-light)]" />
                <span className="truncate">{report.primary_geography_name}</span>
                <span className="text-[var(--report-stone-light)]">·</span>
                <span className="text-xs text-[var(--report-stone-light)]">{geoLabel}</span>
              </div>
            </div>

            {/* Score Section */}
            {scoreValue && (
              <div className="px-5 pb-4">
                <div className="flex items-center justify-between p-4 bg-[var(--report-cream)] rounded-xl">
                  <div>
                    <p className="report-label mb-1">{scoreInfo.name}</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-semibold text-[var(--report-navy)] font-['Source_Serif_4',serif]">
                        {scoreValue}
                      </span>
                      <span className="text-sm text-[var(--report-stone-light)]">/100</span>
                    </div>
                  </div>
                  <ScoreRing score={scoreValue} size={56} />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-4 bg-[var(--report-cream)] border-t border-[rgba(27,46,74,0.04)] flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-[var(--report-stone-light)]">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatRelativeTime(report.created_at)}</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-[var(--report-navy)] opacity-0 group-hover:opacity-100 transition-opacity">
                View report <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

// Score Ring Component
interface ScoreRingProps {
  score: number;
  size?: number;
}

function ScoreRing({ score, size = 56 }: ScoreRingProps) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;

  const getScoreColor = (s: number) => {
    if (s >= 70) return 'var(--report-success)';
    if (s >= 50) return 'var(--report-gold)';
    if (s >= 30) return 'var(--report-warning)';
    return 'var(--report-error)';
  };

  return (
    <div className="report-score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="report-score-ring-bg"
          style={{ stroke: 'var(--report-cream-dark)' }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          stroke={getScoreColor(score)}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-xs font-semibold"
        style={{ color: getScoreColor(score) }}
      >
        {score >= 70 ? (
          <TrendingUp className="w-4 h-4" />
        ) : score < 50 ? (
          <TrendingDown className="w-4 h-4" />
        ) : null}
      </div>
    </div>
  );
}

export default ReportHistoryRefined;
