/**
 * Custom hook for test page API calls
 */

import type { TestResult } from '../types';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface UseTestApiOptions {
  setLoading: SetState<boolean>;
  setResult: SetState<TestResult | null>;
}

export function useTestApi({ setLoading, setResult }: UseTestApiOptions) {
  const callApi = async (
    url: string,
    options?: RequestInit
  ): Promise<void> => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = () => callApi('/api/test-db');

  const setupTestData = () => callApi('/api/setup-test-data', { method: 'POST' });

  const verifyTestData = () => callApi('/api/verify-test-data');

  const importZillowTest = () => callApi('/api/import-zillow?test=true');

  const importZillowRegions = (limit: number = 50) =>
    callApi(`/api/import-zillow?metric=zhvi&limit=${limit}`);

  const importFredMortgage30 = () =>
    callApi('/api/import-fred?series=mortgage_rate_30yr');

  const importFredAllMortgage = () =>
    callApi('/api/import-fred?series=mortgage_rate_30yr,mortgage_rate_15yr');

  const countCensusMetros = (year: number = 2022) =>
    callApi(`/api/count-census-metros?year=${year}`);

  const importCensusMetros = (year: number = 2022) =>
    callApi(`/api/import-census?variables=population,median_household_income&year=${year}&geo_level=metropolitan statistical area/micropolitan statistical area`);

  const importCensusState = (year: number = 2022) =>
    callApi(`/api/import-census?variables=population&year=${year}&geo_level=state`);

  const verifyRedfinData = (filename?: string, limit?: number, showAll?: boolean) => {
    let url = '/api/verify-redfin-data';
    const params = new URLSearchParams();
    if (filename) params.append('filename', filename);
    if (limit) params.append('limit', String(limit));
    if (showAll) params.append('showAll', 'true');
    if (params.toString()) url += `?${params.toString()}`;
    return callApi(url);
  };

  const clearRedfinData = async () => {
    if (!confirm('WARNING: This will delete ALL Redfin data from the database (markets and time series records).\n\nThis action cannot be undone. Are you sure?')) {
      return;
    }
    if (!confirm('Are you absolutely sure? This will permanently delete all Redfin data.')) {
      return;
    }
    await callApi('/api/clear-redfin-data?confirm=true', { method: 'DELETE' });
  };

  const analyzeZillow = () => callApi('/api/analyze-zillow');

  const testZillowFetcher = (datasets: string, storeData: boolean) => {
    const datasetsParam = datasets.split(',').map(d => d.trim()).join(',');
    const storeParam = storeData ? 'true' : 'false';
    return callApi(`/api/test-zillow-simple?datasets=${datasetsParam}&store=${storeParam}`);
  };

  return {
    testConnection,
    setupTestData,
    verifyTestData,
    importZillowTest,
    importZillowRegions,
    importFredMortgage30,
    importFredAllMortgage,
    countCensusMetros,
    importCensusMetros,
    importCensusState,
    verifyRedfinData,
    clearRedfinData,
    analyzeZillow,
    testZillowFetcher
  };
}
