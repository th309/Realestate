'use client';

import React from 'react';
import { FileText, Plus, History, Sparkles, ArrowRight, Clock, MapPin, TrendingUp } from 'lucide-react';
import { WizardContainer } from './components/wizard/WizardContainer';
import { PreviewPanel } from './components/preview/PreviewPanel';
import { ReportHistoryRefined } from './components/ReportHistoryRefined';
import { useWizardState } from './hooks/useWizardState';
import { useReportGeneration } from './hooks/useReportGeneration';
import './styles/report-theme.css';

export const DashboardRefined: React.FC = () => {
  const wizardState = useWizardState();
  const reportGeneration = useReportGeneration();

  return (
    <div className="report-page min-h-screen">
      {/* Subtle Background Pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(27, 46, 74, 0.03) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-8 lg:py-12">
        {/* Header Section */}
        <header className="mb-12 report-animate-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--report-navy)] flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="report-label">PropertyIQ</p>
              <h1 className="report-heading-lg">Market Reports</h1>
            </div>
          </div>
          <p className="report-body max-w-2xl">
            Generate AI-powered market analysis with deep data insights,
            custom comparisons, and exportable formats tailored to your needs.
          </p>
        </header>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 report-animate-in report-animate-in-delay-1">
          <QuickStat
            icon={<FileText className="w-4 h-4" />}
            label="Reports Generated"
            value="12"
            sublabel="This month"
          />
          <QuickStat
            icon={<Clock className="w-4 h-4" />}
            label="Avg. Generation Time"
            value="18s"
            sublabel="Last 7 days"
          />
          <QuickStat
            icon={<TrendingUp className="w-4 h-4" />}
            label="Most Analyzed"
            value="Metro"
            sublabel="Geography type"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 mb-16">
          {/* Wizard Section */}
          <div className="xl:col-span-3 report-animate-in report-animate-in-delay-2">
            <div className="report-section">
              <div className="report-section-header">
                <div className="report-section-icon">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="report-heading-sm">Create New Report</h2>
                  <p className="report-body-sm">Select a location and customize your analysis</p>
                </div>
              </div>
              <WizardContainer wizardState={wizardState} reportGeneration={reportGeneration} />
            </div>
          </div>

          {/* Preview Section */}
          <div className="xl:col-span-2 report-animate-in report-animate-in-delay-3">
            <div className="xl:sticky xl:top-8">
              <PreviewPanel wizardState={wizardState} />
            </div>
          </div>
        </div>

        {/* Report History Section */}
        <section className="report-animate-in report-animate-in-delay-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="report-section-icon">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h2 className="report-heading-sm">Recent Reports</h2>
                <p className="report-body-sm">View and manage your generated reports</p>
              </div>
            </div>
            <button className="report-btn-ghost">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <ReportHistoryRefined />
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-[rgba(27,46,74,0.06)]">
          <div className="flex items-center justify-between">
            <p className="report-body-sm">
              © {new Date().getFullYear()} PropertyIQ. AI-powered real estate analytics.
            </p>
            <div className="flex items-center gap-1 text-[var(--report-stone-light)]">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-xs">Powered by advanced AI models</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

// Quick Stat Component
interface QuickStatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
}

function QuickStat({ icon, label, value, sublabel }: QuickStatProps) {
  return (
    <div className="report-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[var(--report-stone-light)]">{icon}</span>
        <span className="report-label">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-[var(--report-navy)] font-['Source_Serif_4',serif]">
          {value}
        </span>
        <span className="report-body-sm">{sublabel}</span>
      </div>
    </div>
  );
}

export default DashboardRefined;
