/**
 * GEOJSON DATA FETCHERS
 *
 * API functions for loading GeoJSON map layers.
 */

import { API_URL } from './base';

/**
 * Build the full URL for a GeoJSON API endpoint.
 * Some layers are served statically from /public, those return paths
 * without the API_URL prefix — this function only handles backend routes.
 */
export function getGeoJsonApiUrl(endpoint: string): string {
  return `${API_URL}${endpoint}`;
}
