'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Loader2,
  FileText,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { BrandingProvider } from '@/app/reports/[id]/components/BrandingProvider';
import { ReportWithTemplate } from '@/app/reports/[id]/components/types';
import { UserType, ReportInstance } from '@/app/reports/types';
import { SectionErrorBoundary } from '@/app/reports/[id]/components/SectionErrorBoundary';
import { getTemplate, ReportTemplateType } from '@/app/reports/[id]/components/templates';
import { formatSectionName } from '@/app/reports/[id]/components/utils/sectionDisplay';
import { ReportFooter } from '@/app/reports/[id]/components/ReportFooter';
import { normalizeReport } from '@/app/reports/[id]/components/utils/normalizeReport';
import { fetchSharedReport } from '@/lib/data';
import '@/app/reports/styles/report-theme.css';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-on-surface-variant">Loading shared report...</p>
      </div>
    </div>
  );
}

export default function SharedReportPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SharedReportViewer />
    </Suspense>
  );
}

function SharedReportViewer() {
  const params = useParams();
  const token = params.token as string;

  const [report, setReport] = useState<ReportWithTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchSharedReport<ReportWithTemplate>(token);
        if (cancelled) return;
        if (data) {
          setReport(normalizeReport(data));
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="report-page min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--report-navy)]/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[var(--report-navy)] animate-spin" />
          </div>
          <p className="report-body">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="report-page min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-[var(--report-error-bg)] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-[var(--report-error)]" />
          </div>
          <h2 className="report-heading-md mb-2">Report not available</h2>
          <p className="report-body mb-6">
            {error || 'This shared report link may have expired or is no longer available.'}
          </p>
          <Link href="/" className="report-btn-primary">
            <ArrowLeft className="w-4 h-4" />
            Go to PropertyIQ
          </Link>
        </div>
      </div>
    );
  }

  if (report.status !== 'ready') {
    return (
      <div className="report-page min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="report-heading-md mb-2">Report not ready</h2>
          <p className="report-body mb-6">This report is still being generated. Please try again later.</p>
          <Link href="/" className="report-btn-primary">
            <ArrowLeft className="w-4 h-4" />
            Go to PropertyIQ
          </Link>
        </div>
      </div>
    );
  }

  const userType = report.user_type as UserType;
  const reportType = report.template?.config?.report_type;
  const isAgentReport = report.user_type === 'agent' || reportType === 'snapshot';
  let templateType: ReportTemplateType;

  if (reportType === 'comparison' && report.comparison_geographies && report.comparison_geographies.length > 0) {
    templateType = 'comparison';
  } else if (isAgentReport) {
    templateType = 'market_snapshot_client';
  } else if (userType === 'investor') {
    templateType = 'investoredge';
  } else {
    templateType = 'homeready';
  }

  const template = getTemplate(templateType);
  const templateSections = template?.sections || [];
  const reportInstance = report as unknown as ReportInstance;

  return (
    <div className="report-page min-h-screen">
      {/* Minimal header for shared reports */}
      <header className="sticky top-0 z-40 bg-[var(--report-cream)] border-b border-[rgba(27,46,74,0.08)] backdrop-blur-sm report-no-print">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--report-navy)] flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-[var(--report-navy)]">PropertyIQ</span>
              <span className="text-xs text-[var(--report-stone-light)] ml-2">Shared Report</span>
            </div>
            <Link
              href="/auth/sign-up"
              className="report-btn-primary text-sm"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </header>

      {/* Report Body */}
      <main>
        <div className="max-w-4xl mx-auto px-6 py-10">
          <BrandingProvider>
            {templateSections.map(({ component: Section, id }, index) => (
              <section
                key={id}
                id={id}
                className={`${id === 'hero' || id === 'investor-hero' || id === 'comparison-hero' || id === 'client-overview' ? 'mb-0' : 'mb-10'} report-animate-in`}
                style={{ animationDelay: `${(index + 1) * 100}ms` }}
              >
                <SectionErrorBoundary sectionId={id}>
                  <Section report={reportInstance} />
                </SectionErrorBoundary>
              </section>
            ))}
          </BrandingProvider>

          <ReportFooter report={report} />
        </div>
      </main>
    </div>
  );
}
