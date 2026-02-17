'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { ReportViewer } from './ReportViewer';
import { EntitlementGate } from '@/components/entitlements/EntitlementGate';
import { PaywallCard } from '@/components/entitlements/PaywallCard';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-on-surface-variant">Loading report...</p>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const params = useParams();
  const reportId = params.id as string;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <EntitlementGate
        type="feature"
        id="reports"
        fallback={
          <div className="min-h-screen bg-surface flex items-center justify-center p-6">
            <PaywallCard
              type="feature"
              id="reports"
              title="Market Reports"
              description="Generate AI-powered market reports with executive summaries, investment theses, and risk assessments."
            />
          </div>
        }
      >
        <ReportViewer reportId={reportId} />
      </EntitlementGate>
    </Suspense>
  );
}
