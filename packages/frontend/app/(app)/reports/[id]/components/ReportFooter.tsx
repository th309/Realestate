import React from 'react';
import { FileText } from 'lucide-react';
import { ReportWithTemplate } from './types';

interface ReportFooterProps {
  report: ReportWithTemplate;
}

export function ReportFooter({ report }: ReportFooterProps) {
  return (
    <footer className="mt-16 pt-8 border-t border-[rgba(27,46,74,0.08)]">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--report-navy)] flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-[var(--report-navy)]">PropertyIQ</span>
        </div>
        <p className="report-body-sm mb-2">AI-powered real estate market intelligence</p>
        <p className="text-xs text-[var(--report-stone-light)]">
          Report generated on {new Date(report.created_at).toLocaleDateString()} ·
          Data as of {report.data_as_of_date}
        </p>
      </div>
    </footer>
  );
}
