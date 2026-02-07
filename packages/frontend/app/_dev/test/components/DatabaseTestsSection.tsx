'use client';

import type { TestSectionProps } from './types';
import { useTestApi } from './hooks/useTestApi';

export function DatabaseTestsSection({ loading, setLoading, setResult }: TestSectionProps) {
  const api = useTestApi({ setLoading, setResult });

  return (
    <div className="mb-8 p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Database Tests</h2>
      <div className="flex flex-wrap gap-4">
        <button
          onClick={api.testConnection}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Testing...' : 'Test Connection'}
        </button>

        <button
          onClick={api.setupTestData}
          disabled={loading}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Setting up...' : 'Insert Test Data'}
        </button>

        <button
          onClick={api.verifyTestData}
          disabled={loading}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Verifying...' : 'Verify Data'}
        </button>
      </div>
    </div>
  );
}
