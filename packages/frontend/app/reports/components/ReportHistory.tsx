'use client';

import React from 'react';
import { FileText, MapPin, Clock, MoreVertical, Eye, Download, Share2, Trash2 } from 'lucide-react';
import { M3Card } from '@/app/graphs/components/M3Card';
import { SCORE_INFO } from '../constants';
import type { ReportListItem, ReportStatus } from '../types';

// Mock data for recent reports
const MOCK_REPORTS: ReportListItem[] = [
  {
    id: '1',
    title: 'Phoenix Market Analysis',
    template_slug: 'snapshot',
    template_name: 'Market Snapshot',
    template_icon: 'BarChart3',
    user_type: 'investor',
    primary_geography_name: 'Phoenix-Mesa-Chandler, AZ',
    primary_geography_type: 'metro',
    homeready_score: 72,
    investoredge_score: 78,
    status: 'ready',
    data_as_of_date: '2026-01-15',
    created_at: '2026-01-15T10:30:00Z',
  },
  {
    id: '2',
    title: 'Austin vs Denver Comparison',
    template_slug: 'comparison',
    template_name: 'Market Comparison',
    template_icon: 'GitCompare',
    user_type: 'homebuyer',
    primary_geography_name: 'Austin-Round Rock-Georgetown, TX',
    primary_geography_type: 'metro',
    homeready_score: 68,
    investoredge_score: 71,
    status: 'ready',
    data_as_of_date: '2026-01-10',
    created_at: '2026-01-10T14:20:00Z',
  },
  {
    id: '3',
    title: 'Tampa Investment Deep Dive',
    template_slug: 'investment',
    template_name: 'Investment Analysis',
    template_icon: 'PiggyBank',
    user_type: 'investor',
    primary_geography_name: 'Tampa-St. Petersburg-Clearwater, FL',
    primary_geography_type: 'metro',
    homeready_score: 65,
    investoredge_score: 82,
    status: 'ready',
    data_as_of_date: '2026-01-05',
    created_at: '2026-01-05T09:15:00Z',
  },
];

const STATUS_STYLES: Record<ReportStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-on-surface-variant', bgColor: 'bg-surface-container' },
  generating: { label: 'Generating', color: 'text-tertiary', bgColor: 'bg-tertiary/10' },
  ready: { label: 'Ready', color: 'text-primary', bgColor: 'bg-primary/10' },
  failed: { label: 'Failed', color: 'text-error', bgColor: 'bg-error/10' },
  expired: { label: 'Expired', color: 'text-on-surface-variant', bgColor: 'bg-surface-container' },
};

export const ReportHistory: React.FC = () => {
  const [menuOpen, setMenuOpen] = React.useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (MOCK_REPORTS.length === 0) {
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
      {MOCK_REPORTS.map((report) => {
        const status = STATUS_STYLES[report.status];
        const heroScore = report.user_type === 'investor' ? 'investoredge' : 'homeready';
        const scoreValue = report.user_type === 'investor' ? report.investoredge_score : report.homeready_score;
        const scoreInfo = SCORE_INFO[heroScore];

        return (
          <M3Card key={report.id} variant="elevated" size="sm" className="relative">
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
                  onClick={() => setMenuOpen(menuOpen === report.id ? null : report.id)}
                  className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-on-surface-variant" />
                </button>

                {menuOpen === report.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                    <div className="absolute right-0 top-8 z-20 w-40 bg-surface-container-high rounded-xl elevation-2 py-1 overflow-hidden">
                      <button className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container flex items-center gap-2">
                        <Eye className="w-4 h-4" /> View
                      </button>
                      <button className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container flex items-center gap-2">
                        <Download className="w-4 h-4" /> Download PDF
                      </button>
                      <button className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container flex items-center gap-2">
                        <Share2 className="w-4 h-4" /> Share
                      </button>
                      <hr className="my-1 border-outline-variant/30" />
                      <button className="w-full px-4 py-2.5 text-left text-sm text-error hover:bg-error/10 flex items-center gap-2">
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
                  <div className={`text-2xl font-bold ${scoreInfo.colorClass}`}>{scoreValue}</div>
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
        );
      })}
    </div>
  );
};
