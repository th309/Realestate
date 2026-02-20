'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { ReportViewer } from '../[id]/ReportViewer';
import { useEntitlements } from '@/lib/entitlements/EntitlementsContext';

const SAMPLE_REPORT_ID = 'f4b04e7c-34cc-4e38-bdac-541fff06de1e';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-on-surface-variant">Loading sample report...</p>
      </div>
    </div>
  );
}

function SampleBanner() {
  const { getAccess } = useEntitlements();
  const hasReports = getAccess('feature', 'reports').level === 'full';

  // Don't show the banner/CTA for users who already have reports access
  if (hasReports) return null;

  return (
    <>
      {/* Top banner */}
      <div className="bg-primary/5 border-b border-primary/15">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">
            Sample Report
          </span>
          <Link
            href="/pricing"
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors hidden sm:block"
          >
            Upgrade to create your own
          </Link>
        </div>
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-surface/95 backdrop-blur-sm border-t border-outline-variant shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-on-surface truncate">
              Like what you see?
            </p>
            <p className="text-xs text-on-surface-variant truncate">
              Generate custom reports for any market
            </p>
          </div>
          <Link
            href="/pricing"
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5
              bg-primary text-on-primary rounded-full
              font-medium text-sm
              hover:bg-primary/90 transition-colors
              shadow-md shadow-primary/20"
          >
            <Sparkles className="w-4 h-4" />
            Create Your Own Report
          </Link>
        </div>
      </div>
    </>
  );
}

export default function SampleReportPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SampleBanner />
      <ReportViewer reportId={SAMPLE_REPORT_ID} />
    </Suspense>
  );
}
