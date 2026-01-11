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

export default function TestPage() {
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
        <h1 className="text-3xl font-bold mb-6">Development Test Page</h1>

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
      </div>
    </div>
  );
}
