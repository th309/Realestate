'use client';

import React, { Suspense } from 'react';
import { Dashboard } from './Dashboard';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-on-surface-variant font-medium">Loading reports...</p>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Dashboard />
    </Suspense>
  );
}
