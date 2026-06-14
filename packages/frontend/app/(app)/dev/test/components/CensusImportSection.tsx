'use client';

import type { TestSectionProps } from './types';
import { useTestApi } from './hooks/useTestApi';

export function CensusImportSection({ loading, setLoading, setResult }: TestSectionProps) {
  const api = useTestApi({ setLoading, setResult });

  return (
    <div className="mb-8 p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Census Data Import (Phase 2.2)</h2>
      <div className="space-y-4">
        <button
          onClick={() => api.countCensusMetros(2022)}
          disabled={loading}
          className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Counting...' : 'Count Metro Areas in Census Data'}
        </button>

        <button
          onClick={() => api.importCensusMetros(2022)}
          disabled={loading}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
        >
          {loading ? 'Importing...' : 'Import Metro Demographics (2022)'}
        </button>

        <button
          onClick={() => api.importCensusState(2022)}
          disabled={loading}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
        >
          {loading ? 'Importing...' : 'Import State Population (2022)'}
        </button>
      </div>
    </div>
  );
}
