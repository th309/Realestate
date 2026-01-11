'use client';

import type { ZillowFetcherSectionProps } from './types';
import { useTestApi } from './hooks/useTestApi';

export function ZillowFetcherSection({
  loading,
  setLoading,
  setResult,
  zillowDatasets,
  setZillowDatasets,
  storeData,
  setStoreData
}: ZillowFetcherSectionProps) {
  const api = useTestApi({ setLoading, setResult });

  return (
    <div className="mb-8 p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Zillow Data Fetcher Test (Phase 2.1) - Simplified</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Datasets (comma-separated):
          </label>
          <input
            type="text"
            value={zillowDatasets}
            onChange={(e) => setZillowDatasets(e.target.value)}
            placeholder="zhvi, inventory, zori"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Options: zhvi, zori, inventory, daysOnMarket, priceCuts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="storeData"
            checked={storeData}
            onChange={(e) => setStoreData(e.target.checked)}
            disabled={loading}
            className="w-4 h-4"
          />
          <label htmlFor="storeData" className="text-sm">
            Store data in database (default: fetch only)
          </label>
        </div>

        <button
          onClick={() => api.testZillowFetcher(zillowDatasets, storeData)}
          disabled={loading}
          className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Fetching Zillow Data...' : 'Test Zillow Fetcher'}
        </button>
      </div>
    </div>
  );
}
