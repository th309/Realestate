'use client';

import React, { Suspense } from 'react';
import { GraphsPage } from './components/GraphsPage';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-on-surface font-medium">Loading Market Explorer...</p>
      </div>
    </div>
  );
}

export default function GraphsPageWrapper() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GraphsPage />
    </Suspense>
  );
}
