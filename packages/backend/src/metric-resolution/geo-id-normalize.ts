/**
 * Geography ID Normalization
 *
 * Normalizes a caller-supplied geography ID into the exact key format the
 * target source's tables use (ZIP zero-pad, county FIPS pad, CBSA pad,
 * state FIPS vs 2-letter code). Extracted from SourceFetcherService for
 * file size compliance.
 *
 * Pure function — no class, no DI, no DB access.
 */

import { normalizeZipKey } from '../common/zip';
import {
  normalizeStateToFips,
  normalizeStateToCode,
  normalizeCountyFips,
  normalizeCbsaCode,
} from '../common/geo';
import { GeoLevel, DataSource } from './metric-resolution.types';

export function normalizeGeoId(
  geoLevel: GeoLevel,
  geoId: string,
  source: DataSource,
): string {
  switch (geoLevel) {
    case 'zip':
      return normalizeZipKey(geoId);
    case 'county':
      return /^\d+$/.test(geoId.trim()) ? normalizeCountyFips(geoId) : geoId;
    case 'metro':
      return /^\d+$/.test(geoId.trim()) ? normalizeCbsaCode(geoId) : geoId;
    case 'state':
      if (
        source === 'census' ||
        source === 'economic' ||
        source === 'permits' ||
        // CES writes economic_state.state_fips as FIPS ('06'), so state-level
        // CES employment must resolve on FIPS, not the 2-letter code.
        source === 'ces' ||
        // Redfin Data Center state tables key region_id on STATE FIPS ('08'),
        // not the 2-letter code — covers 'redfin_dc' and every 'redfin_dc_*'.
        source.startsWith('redfin_dc')
      ) {
        return normalizeStateToFips(geoId);
      }
      // Everything else (zillow, realtor, calculated, ...) keys state rows
      // on the 2-letter code.
      return normalizeStateToCode(geoId);
    default:
      return geoId;
  }
}
