'use client';

import type { TestSectionProps } from './types';
import { useTestApi } from './hooks/useTestApi';

export function ZillowAnalysisSection({ loading, setLoading, setResult }: TestSectionProps) {
  const api = useTestApi({ setLoading, setResult });

  return (
    <div className="mb-8 p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Zillow Data Structure Analysis</h2>
      <button
        onClick={api.analyzeZillow}
        disabled={loading}
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
      >
        {loading ? 'Analyzing...' : 'Analyze Zillow CSV Structure'}
      </button>
    </div>
  );
}
