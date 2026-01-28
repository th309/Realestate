'use client';
// Deploy trigger: 2026-01-28

import React, { Suspense } from 'react';
import { Dashboard } from './Dashboard';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#f7faf7]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#006d3d] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#414941] font-medium">Loading dashboard...</p>
      </div>
    </div>
  );
}

export default function GraphsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Dashboard />
    </Suspense>
  );
}
