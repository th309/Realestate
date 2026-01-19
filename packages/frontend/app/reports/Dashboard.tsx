'use client';

import React from 'react';
import { FileText, History } from 'lucide-react';
import { WizardContainer } from './components/wizard/WizardContainer';
import { PreviewPanel } from './components/preview/PreviewPanel';
import { ReportHistory } from './components/ReportHistory';
import { useWizardState } from './hooks/useWizardState';
import { useReportGeneration } from './hooks/useReportGeneration';

export const Dashboard: React.FC = () => {
  const wizardState = useWizardState();
  const reportGeneration = useReportGeneration();

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-primary mb-1">
            <FileText className="w-5 h-5" />
            <span className="text-xs font-medium uppercase tracking-wider">
              PropertyIQ Reports
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-medium text-on-surface tracking-tight">
            Generate Market Report
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            AI-powered market analysis tailored to your needs
          </p>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-8">
          {/* Wizard - Left Side (60%) */}
          <div className="xl:col-span-3">
            <WizardContainer wizardState={wizardState} reportGeneration={reportGeneration} />
          </div>

          {/* Preview - Right Side (40%) */}
          <div className="xl:col-span-2">
            <div className="xl:sticky xl:top-6">
              <PreviewPanel wizardState={wizardState} />
            </div>
          </div>
        </div>

        {/* Report History Section */}
        <div className="border-t border-outline-variant pt-8">
          <div className="flex items-center gap-2 text-on-surface-variant mb-4">
            <History className="w-5 h-5" />
            <h2 className="text-lg font-medium text-on-surface">Recent Reports</h2>
          </div>
          <ReportHistory />
        </div>
      </div>
    </div>
  );
};
