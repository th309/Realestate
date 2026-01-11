/**
 * FRED API Client
 */

import { FRED_BASE_URL } from './types';
import { getFredApiKey } from './db-client';

/**
 * Fetch time series data from FRED API
 */
export async function fetchFREDSeries(
  seriesId: string,
  observationStart?: string,
  observationEnd?: string
): Promise<any[]> {
  const apiKey = getFredApiKey();
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: 'json',
    observation_start: observationStart || '2000-01-01',
    observation_end: observationEnd || new Date().toISOString().split('T')[0],
  });

  const url = `${FRED_BASE_URL}/series/observations?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FRED API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error_code) {
      throw new Error(`FRED API error: ${data.error_message || 'Unknown error'}`);
    }

    return data.observations || [];
  } catch (error: any) {
    throw new Error(`Failed to fetch FRED series ${seriesId}: ${error.message}`);
  }
}

/**
 * Fetch series metadata from FRED API
 */
export async function getFREDSeriesInfo(seriesId: string): Promise<any> {
  const apiKey = getFredApiKey();
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: 'json',
  });

  const url = `${FRED_BASE_URL}/series?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`FRED API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error_code) {
      throw new Error(`FRED API error: ${data.error_message || 'Unknown error'}`);
    }

    return data.seriess?.[0] || null;
  } catch (error: any) {
    throw new Error(`Failed to fetch FRED series info ${seriesId}: ${error.message}`);
  }
}
