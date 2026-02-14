'use client';

import React from 'react';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { MyMarket } from '../../hooks/useMyMarkets';

interface ReportCTAProps {
  primaryMarket: MyMarket;
  comparisonMarket: MyMarket;
}

/**
 * ReportCTA - Call to action to generate a full comparison report
 */
export function ReportCTA({ primaryMarket, comparisonMarket }: ReportCTAProps) {
  // Build report wizard URL with pre-filled markets
  const reportUrl = `/reports/new?template=comparison&primary=${encodeURIComponent(primaryMarket.id)}&compare=${encodeURIComponent(comparisonMarket.id)}`;

  return (
    <Link
      href={reportUrl}
      className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-primary text-on-primary rounded-full text-sm font-medium shadow-sm hover:bg-on-primary-container hover:shadow-md transition-all"
    >
      <FileText className="w-[18px] h-[18px]" />
      Generate Full Report
    </Link>
  );
}

export default ReportCTA;
