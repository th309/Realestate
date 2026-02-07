'use client';

import type { TestSectionProps } from './types';
import { useTestApi } from './hooks/useTestApi';

export function ZillowImportSection({ loading, setLoading, setResult }: TestSectionProps) {
  const api = useTestApi({ setLoading, setResult });

  return (
    <div className="mb-8 p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Zillow Data Import (New Schema)</h2>
      <div className="space-y-4">
        <button
          onClick={api.importZillowTest}
          disabled={loading}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Importing...' : 'Test Import (50 regions)'}
        </button>

        <button
          onClick={() => api.importZillowRegions(50)}
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
        >
          {loading ? 'Importing...' : 'Import 50 Regions'}
        </button>
      </div>
    </div>
  );
}
