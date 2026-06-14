'use client';

import type { TestSectionProps } from './types';
import { useTestApi } from './hooks/useTestApi';

export function FredImportSection({ loading, setLoading, setResult }: TestSectionProps) {
  const api = useTestApi({ setLoading, setResult });

  return (
    <div className="mb-8 p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">FRED Data Import (Phase 2.2)</h2>
      <div className="space-y-4">
        <button
          onClick={api.importFredMortgage30}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Importing...' : 'Import 30-Year Mortgage Rates'}
        </button>

        <button
          onClick={api.importFredAllMortgage}
          disabled={loading}
          className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
        >
          {loading ? 'Importing...' : 'Import All Mortgage Rates'}
        </button>
      </div>
    </div>
  );
}
