'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { ReportViewer } from './ReportViewer';

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
      <ReportViewer reportId={reportId} />
    </Suspense>
  );
}
