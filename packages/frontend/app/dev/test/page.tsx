'use client';

import { useState } from 'react';
import type { TestResult, ImportProgress, UploadedFile } from './components/types';
import { DatabaseTestsSection } from './components/DatabaseTestsSection';
import { ZillowImportSection } from './components/ZillowImportSection';
import { FredImportSection } from './components/FredImportSection';
import { CensusImportSection } from './components/CensusImportSection';
import { RedfinImportSection } from './components/RedfinImportSection';
import { ZillowAnalysisSection } from './components/ZillowAnalysisSection';
import { ZillowFetcherSection } from './components/ZillowFetcherSection';
import { ResultDisplay } from './components/ResultDisplay';
import { AnalyticsAssistantSection } from './components/AnalyticsAssistantSection';

type TabId = 'imports' | 'analytics';

interface Tab {
  id: TabId;
  label: string;
  description: string;
}

const TABS: Tab[] = [
  { id: 'imports', label: 'Data Imports', description: 'Database tests and data source imports' },
  { id: 'analytics', label: 'Analytics Assistant', description: 'Test AI analytics interface' },
];

export default function TestPage() {
  const [activeTab, setActiveTab] = useState<TabId>('imports');
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [zillowDatasets, setZillowDatasets] = useState('zhvi');
  const [storeData, setStoreData] = useState(false);

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Development Test Page</h1>
        <p className="text-gray-600 mb-6">Tools for testing and importing data</p>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'imports' && (
          <>
            <DatabaseTestsSection
              loading={loading}
              setLoading={setLoading}
              setResult={setResult}
            />

            <ZillowImportSection
              loading={loading}
              setLoading={setLoading}
              setResult={setResult}
            />

            <FredImportSection
              loading={loading}
              setLoading={setLoading}
              setResult={setResult}
            />

            <CensusImportSection
              loading={loading}
              setLoading={setLoading}
              setResult={setResult}
            />

            <RedfinImportSection
              loading={loading}
              setLoading={setLoading}
              setResult={setResult}
              uploadProgress={uploadProgress}
              setUploadProgress={setUploadProgress}
              importProgress={importProgress}
              setImportProgress={setImportProgress}
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
            />

            <ZillowAnalysisSection
              loading={loading}
              setLoading={setLoading}
              setResult={setResult}
            />

            <ZillowFetcherSection
              loading={loading}
              setLoading={setLoading}
              setResult={setResult}
              zillowDatasets={zillowDatasets}
              setZillowDatasets={setZillowDatasets}
              storeData={storeData}
              setStoreData={setStoreData}
            />

            <ResultDisplay result={result} />
          </>
        )}

        {activeTab === 'analytics' && <AnalyticsAssistantSection />}
      </div>
    </div>
  );
}
